var log = require('winston');
var moment = require('moment');
var config = require('./config/config.js');
var fitbitConnector = require('./fitbitconnector.js');
var mysql = require('./mysql.js');
var processingFlag = false;
var quitFlag = false;

function retrieveData() {
  if(!processingFlag && !quitFlag) {
    processingFlag = true;
    fitbitConnector.tokenRefresh()
    .then(() => mysql.query(['SELECT table_name, time FROM completeness'])) // queryAsync will run asynchronous to the promise chain if called directly with static arguments
    .then(function(rows) {
      return new Promise(function(fulfill, reject){
        completeness = {};
        for(var i=0;i<rows.length;i++)
        {
          let startTime;
          if (rows[i].time === null) startTime = moment(config.FITBIT_ACCOUNT_CREATION);
          else startTime = moment(rows[i].time);
          let startDay = moment(startTime).startOf('day');
          completeness[rows[i].table_name] = {
            'startTime': startTime,
            'startDay': startDay,
            'currentDay': moment().startOf('day'),
            'nextDay': moment(startDay).add(1, 'd')
          };
        }
        var itemList = [processItem('fat'), processItem('weight'), processItem('hr'), processItem('activity'), processItem('sleep')];
        // processItem('fat'), processItem('weight'), processItem('hr'), processItem('activity'), processItem('sleep')
        Promise.all(itemList)
        .then(() => { log.info('Work unit processed.'); if (process.argv[2] != 'notinteractive') log.info('Press "r" to retrieve another day or "q" to quit.'); processingFlag = false; })
        .then(() => { abortPoint(quitFlag, processingFlag); })
        .catch(function(err) { processingFlag = false; reject(err); return; });
        fulfill();
      });
    })
    .catch(function(err) { log.error(err); processingFlag = false; });
  }
  else {
    if(processingFlag) log.warn('retrieveData() is already running.');
    abortPoint(quitFlag, processingFlag)
    .catch(log.error);
  }
};

function abortPoint(quit, processing) {
  return new Promise(function(fulfill, reject){
    if(!quit) { Promise.resolve(); return; }
    if (!processing)
    {
      log.info('fitjunction shutting down.');
      mysql.close()
      .then(() => process.exit(0))
      .catch(function(err) { log.error(err); process.exit(1); });
    }
    else { log.info('Exit requested but tasks are still running. Fitjunction will shutdown after tasks are finished.'); Promise.resolve(); }
  });
};

function setQuitFlag() {
  quitFlag = true;
};

function processItem(dataType) {
  switch(dataType) {
    case 'fat':
      return fitbitConnector.apiRequest('body/log/fat/date/' + completeness.body_fat.startDay.format('YYYY-MM-DD') + '.json')
      .then(fitbitDataWriter)
      .catch(log.error);
      break;
    case 'weight':
      return fitbitConnector.apiRequest('body/log/weight/date/' + completeness.weight.startDay.format('YYYY-MM-DD') + '.json')
      .then(fitbitDataWriter)
      .catch(log.error);
      break;
    case 'hr':
      return fitbitConnector.apiRequest('activities/heart/date/' + completeness.hr_intraday.startDay.format('YYYY-MM-DD') + '/1d/1sec.json')
      .then(fitbitDataWriter)
      .catch(log.error);
      break;
    case 'activity':
      let getActivities = [
        fitbitConnector.apiRequest('activities/steps/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
        fitbitConnector.apiRequest('activities/distance/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
        fitbitConnector.apiRequest('activities/floors/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
        fitbitConnector.apiRequest('activities/elevation/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
        fitbitConnector.apiRequest('activities/calories/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json')
      ];
      return Promise.all(getActivities)
      .then(function(result) {
        return Promise.resolve({
            'steps': result[0]['activities-steps-intraday']['dataset'],
            'distance': result[1]['activities-distance-intraday']['dataset'],
            'floors': result[2]['activities-floors-intraday']['dataset'],
            'elevation': result[3]['activities-elevation-intraday']['dataset'],
            'calories': result[4]['activities-calories-intraday']['dataset']
        });
      })
      .then(fitbitDataWriter)
      .catch(log.error);
      break;
    case 'sleep':
      return fitbitConnector.apiRequest('sleep/date/' + completeness.sleep.startDay.format('YYYY-MM-DD') + '.json')
      .then(fitbitDataWriter)
      .catch(log.error);
      break;
    default:
      log.error('unknown data type requested');
      return Promise.resolve();
  }
};

function updateCompleteness(tableName, currentEntry, connection) {
  if (currentEntry == 'false') log.info('No "' + tableName + '" data for ' + completeness[tableName].startDay.format('YYYY-MM-DD') + ', updating completeness table.');
  else log.info('"' + tableName + '" data for ' + completeness[tableName].startDay.format('YYYY-MM-DD') + ' written, updating completeness table.');
  if (completeness[tableName].startDay < completeness[tableName].currentDay) return mysql.query(['UPDATE completeness SET time = ? WHERE table_name = ?', [completeness[tableName].nextDay.format('YYYY-MM-DD'), tableName]], connection);
  else
  {
    if (currentEntry == 'false') return mysql.query(['UPDATE completeness SET time = ? WHERE table_name = ?', [completeness[tableName].currentDay.format('YYYY-MM-DD'), tableName]], connection);
    else {
      log.debug('Setting completeness to ' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + ' for table ' + tableName);
      return mysql.query(['UPDATE completeness SET time = ? WHERE table_name = ?', [currentEntry.format('YYYY-MM-DD HH:mm:ss'), tableName]], connection);
    }
  }
};

function fitbitDataWriter(result) {
  switch(Object.keys(result)[0]) {
    case 'fat':
      log.verbose('Start processing body fat data.');
      let fat = result['fat'];
      if (Object.keys(fat).length == 0) return updateCompleteness('body_fat','false');
      else {
        let rows = [];
        let newestEntry = moment(completeness.body_fat.startTime);
        let currentEntry;
        Object.keys(fat).forEach(function(key) {
          currentEntry = moment(fat[key]['date'] + ' ' + fat[key]['time']);
          if (currentEntry > completeness.body_fat.startTime)
          {
            rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "' + fat[key]['fat'] + '")');
            if (currentEntry > newestEntry) newestEntry = moment(currentEntry);
          }
        });
        let allRows = rows.join(', ');
        return mysql.startTransaction()
        .then(function(connection) {
          return mysql.query(['INSERT INTO body_fat (time, fat) VALUES ' + allRows], connection)
          .then(() => updateCompleteness('body_fat', newestEntry, connection))
          .then(() => mysql.commit(connection))
          .catch((err) => mysql.rollback(connection, err));
        })
        .catch(log.error);
      }
      break;
    case 'weight':
      log.verbose('Start processing weight data.');
      let weight = result['weight'];
      if (Object.keys(weight).length == 0) return updateCompleteness('weight','false');
      else {
        let rows = [];
        let newestEntry = moment(completeness.weight.startTime);
        let currentEntry;
        Object.keys(weight).forEach(function(key) {
          currentEntry = moment(weight[key]['date'] + ' ' + weight[key]['time']);
          if (currentEntry > completeness.weight.startTime)
          {
            rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "' + weight[key]['weight'] + '", "' + weight[key]['bmi'] + '")');
            if (currentEntry > newestEntry) newestEntry = moment(currentEntry);
          }
        });
        let allRows = rows.join(', ');
        return mysql.startTransaction()
        .then(function(connection) {
          return mysql.query(['INSERT INTO weight (time, weight, bmi) VALUES ' + allRows], connection)
          .then(() => updateCompleteness('weight', newestEntry, connection))
          .then(() => mysql.commit(connection))
          .catch((err) => mysql.rollback(connection, err));
        })
        .catch(log.error);
      }
      break;
    case 'activities-heart':
      log.verbose('Start processing hr data.');
      let restingHeartRate = result['activities-heart'][0]['value']['restingHeartRate'];  // value might still be undefined even if there's Intraday Data
      let heartRateIntraday = result['activities-heart-intraday']['dataset'];
      if (Object.keys(heartRateIntraday).length == 0) return updateCompleteness('hr_intraday','false');
      else {
        let rows = [];
        let currentEntry;
        if(completeness.hr_intraday.startTime.get('h')+completeness.hr_intraday.startTime.get('m')+completeness.hr_intraday.startTime.get('s') == 0) {
          // subtract 1 second if the day starts at 00:00:00 in case the first value is also 00:00:00
          completeness.hr_intraday.startTime.subtract(1, 's');
        }
        Object.keys(heartRateIntraday).forEach(function(key) {
          currentEntry = moment(completeness.hr_intraday.startDay.format('YYYY-MM-DD') + ' ' + heartRateIntraday[key]['time']);
          if(currentEntry > completeness.hr_intraday.startTime && currentEntry.format('HH:mm:ss') == heartRateIntraday[key]['time']) rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "' + heartRateIntraday[key]['value'] + '")'); // second condition of if detects if time has been adjusted for begin of DST
          else if(currentEntry.format('HH:mm:ss') != heartRateIntraday[key]['time']) log.debug('Skipping over DST transition (hr_intraday time: ' + heartRateIntraday[key]['time'] + ')');
        });
        let allRows = rows.join(', ');
        return mysql.startTransaction()
        .then(function(connection) {
          function writeIntraday(connection) {
            if(allRows.length > 0) return mysql.query(['INSERT INTO hr_intraday (time, hr) VALUES ' + allRows], connection);
            else return Promise.resolve();
          };
          function writeResting(connection) {
            if(restingHeartRate) return mysql.query(['INSERT INTO hr_resting (date, hr) VALUES (?, ?) ON DUPLICATE KEY UPDATE hr = ?', [completeness.hr_intraday.startDay.format('YYYY-MM-DD'), restingHeartRate, restingHeartRate]], connection);
            else return Promise.resolve();
          };

          return Promise.resolve()
          .then(() => writeIntraday(connection))
          .then(() => writeResting(connection))
          .then(() => updateCompleteness('hr_intraday', currentEntry, connection))
          .then(() => mysql.commit(connection))
          .catch((err) => mysql.rollback(connection, err));
        })
        .catch(log.error);
      }
      break;
    case 'steps':
      let rows = [];
      let currentEntry = moment(completeness.activity_intraday.startTime);
      let lastWrittenEntry = moment(completeness.activity_intraday.startTime);
      let lastKey = 0;
      Object.keys(result.steps).forEach(function(key) {
        currentEntry = moment(completeness.activity_intraday.startDay.format('YYYY-MM-DD') + ' ' + result.steps[key]['time']);
        if (currentEntry > completeness.activity_intraday.startTime && result.steps[key]['value'] > 0 && currentEntry.format('HH:mm:ss') == result.steps[key]['time'])  // third condition of if detects if time has been adjusted for begin of DST
        {
          lastKey = key;
          lastWrittenEntry = moment(currentEntry);
          rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "'
          + result.steps[key]['value'] + '", "'
          + result.distance[key]['value'] + '", "'
          + result.floors[key]['value'] + '", "'
          + result.elevation[key]['value'] + '", "'
          + result.calories[key]['level'] + '")');
        }
        else if(currentEntry.format('HH:mm:ss') != result.steps[key]['time']) log.debug('Skipping over DST transition (activity_intraday time: ' + result.steps[key]['time'] + ')');
      });
      log.debug('*** After activity loop');
      if (rows.length == 0) return updateCompleteness('activity_intraday', lastWrittenEntry);
      else {
        if (completeness.activity_intraday.startDay == completeness.activity_intraday.currentDay)
        {
          // reset currentEntry to the minute before the last row and remove last row. This is to make sure only complete minutes are written to the db
          // only if the day isn't over yet
          lastWrittenEntry = moment(completeness.activity_intraday.startDay.format('YYYY-MM-DD') + ' ' + result.steps[lastKey]['time']);
          lastWrittenEntry = moment(lastWrittenEntry).subtract(30, 'seconds');
          rows.splice(-1,1);
        }
        let allRows = rows.join(', ');
        return mysql.startTransaction()
        .then(function(connection) {
          return mysql.query(['INSERT INTO activity_intraday (time, steps, distance, floors, elevation, activity_level) VALUES ' + allRows], connection)
          .then(() => updateCompleteness('activity_intraday', lastWrittenEntry, connection))
          .then(() => mysql.commit(connection))
          .catch((err) => mysql.rollback(connection, err));
        })
        .catch(log.error);
      }
      break;
    case 'sleep':
      log.verbose('Start processing sleep data.');
      let sleep = result['sleep'];
      if (Object.keys(sleep).length == 0) return updateCompleteness('sleep','false');
      else {
        let currentEntry;
        let newestEntry = moment(completeness.sleep.startTime);
        let insertSleep = [];
        function sleepLog(key, connection) {
          let isMainSleep, startTime, endTime;
          if (sleep[key]['isMainSleep'] == true) isMainSleep = 1;
          else isMainSleep = 0;
          startTime = moment(sleep[key]['startTime']);
          endTime = moment(sleep[key]['startTime']);
          endTime.add(sleep[key]['timeInBed'], 'minutes');
          return mysql.query(['INSERT INTO sleep (is_main_sleep, efficiency, start_time, end_time, minutes_to_sleep, minutes_awake, minutes_after_wake, awake_count, awake_duration, restless_count, restless_duration, minutes_in_bed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [isMainSleep, sleep[key]['efficiency'], startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss'), sleep[key]['minutesToFallAsleep'], sleep[key]['minutesAwake'], sleep[key]['minutesAfterWakeup'], sleep[key]['awakeCount'], sleep[key]['awakeDuration'], sleep[key]['restlessCount'], sleep[key]['restlessDuration'], sleep[key]['timeInBed']]], connection)
          .then(function(result) {
            let rows = [];
            let minuteData = sleep[key]['minuteData'];
            let currentMinute = moment(startTime); // incrementing from the startTime value instead of using the dateTime value from minuteData so we don't have to deal with changing from one day another
            var previousDst = currentMinute.isDST();
            Object.keys(minuteData).forEach(function(sleepMinute) {
              rows.push('("' + currentMinute.format('YYYY-MM-DD HH:mm:ss') + '", "' + result.insertId + '", "' + minuteData[sleepMinute]['value'] + '")');
              currentMinute.add(1, 'minutes');
              if(previousDst == true && currentMinute.isDST() == false) currentMinute.add(1, 'hours'); // Adjust for switch from DST to no DST. For lack of a better solution we push the sleep 1 hour ahead. Wakeup time will be off by one hour but the sleep by minute data will be complete
            	previousDst = currentMinute.isDST();
            });
            let allRows = rows.join(', ');
            return Promise.resolve(['INSERT INTO sleep_by_minute (time, id_sleep, id_sleep_states) VALUES ' + allRows]);
          })
          .then((query) => mysql.query(query, connection));
          // No catch to prevent mysql.rollback from being called twice on the same connection
        };
        return mysql.startTransaction()
        .then(function(connection) {
          Object.keys(sleep).forEach(function(key) {
            currentEntry = moment(sleep[key]['startTime']).add(sleep[key]['timeInBed'], 'minutes'); // using endTime because the start time of the sleep will usually be the day before
            if (currentEntry > completeness.sleep.startTime) insertSleep.push(sleepLog(key, connection));
            if (currentEntry > newestEntry) newestEntry = moment(currentEntry);
          });
          return Promise.all(insertSleep)
          .then(() => updateCompleteness('sleep', newestEntry, connection))
          .then(() => mysql.commit(connection))
          .catch((err) => mysql.rollback(connection, err));
        })
        .catch(log.error);
      }
      break;
    default:
      Promise.reject('Data type of API result not recognized.');
  }
};

module.exports = {
  retrieveData: retrieveData,
  setQuitFlag: setQuitFlag,
};
