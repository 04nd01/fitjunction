var fs = require('fs');
var mysql = require('mysql');
var moment = require('moment');
var config = require('./config.js');
var pool = mysql.createPool({
  'host': config.MYSQL_HOST,
  'user': config.MYSQL_USER,
  'password': config.MYSQL_PASSWORD,
  'database': config.MYSQL_DB,
  'dateStrings': true // output date as raw string to avoid automatic timezone conversion
});
var fitbitConnector = require('./fitbit_connector.js');
var completeness;
var processingFlag = false;

fitbitConnector.connect();

console.log('Press "r" to retrieve another day or "q" to quit.');
var stdin = process.stdin;
// without this, we would only get streams once enter is pressed
stdin.setRawMode(true);
stdin.resume();
stdin.setEncoding('utf8');
stdin.on('data', function(key) {
  // "q", "Q", "ctrl-c"
  if (key === '\u0071' || key === '\u0051' || key === '\u0003') {
    pool.end(function (err) {
      process.exit(0);
    });
  }
  else if (!processingFlag && (key === '\u0072' || key === '\u0052')) {
    retrieveData();
  }
});

retrieveData()
// split up retrievedata into another promise.all construct
// promisify and see if everything finishes properly


function queryPromised() {
  let firstLevelArgs = arguments;
  //console.log('REQUEST: ' + JSON.stringify(firstLevelArgs));
  return new Promise(function(fulfill, reject){
    pool.getConnection(function(err, connection) {
      if (err) { reject(err); return; }
      connection.query(...firstLevelArgs, function(err, rows, fields) {
        connection.release();
        if (err) { reject(err); return; }
        //console.log('RESULT: ' + JSON.stringify(rows));
        fulfill(rows);
      });
    });
  });
};

function retrieveData() {
  processingFlag = true;
  fitbitConnector.tokenRefresh()
  .then(() => queryPromised('SELECT table_name, time FROM completeness')) // queryAsync will run asynchronous to the promise chain if called directly with static arguments
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
      Promise.all(itemList)
      .then(() => { console.log('Work unit processed. Press "r" to retrieve another day or "q" to quit.'); processingFlag = false; })
      .catch(function(err) { processingFlag = false; reject(err); return; });

      fulfill();
    });
  })
  .catch(function(err) { console.log(err); });
};

function processItem(dataType) {
  switch(dataType) {
    case 'fat':
      return fitbitConnector.apiRequest('body/log/fat/date/' + completeness.body_fat.startDay.format('YYYY-MM-DD') + '.json')
      .then(fitbitDataWriter)
      .catch(function(err) { console.log(err); });
      break;
    case 'weight':
      return fitbitConnector.apiRequest('body/log/weight/date/' + completeness.weight.startDay.format('YYYY-MM-DD') + '.json')
      .then(fitbitDataWriter)
      .catch(function(err) { console.log(err); });
      break;
    case 'hr':
      return fitbitConnector.apiRequest('activities/heart/date/' + completeness.hr_intraday.startDay.format('YYYY-MM-DD') + '/1d/1sec.json')
      .then(fitbitDataWriter)
      .catch(function(err) { console.log(err); });
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
      .catch(function(err) { console.log(err); });
      break;
    case 'sleep':
      return fitbitConnector.apiRequest('sleep/date/' + completeness.sleep.startDay.format('YYYY-MM-DD') + '.json')
      .then(fitbitDataWriter)
      .catch(function(err) { console.log(err); });
      break;
    default:
      console.log('unknown data type requested');
      return Promise.resolve();
  }
};

function updateCompleteness(tableName, currentEntry) {
  if (currentEntry == null) console.log('No "' + tableName + '" data for ' + completeness[tableName].startDay.format('YYYY-MM-DD') + ', updating completeness table.');
  else console.log('"' + tableName + '" data for ' + completeness[tableName].startDay.format('YYYY-MM-DD') + ' written, updating completeness table.');
  if (completeness[tableName].startDay < completeness[tableName].currentDay) return queryPromised('UPDATE completeness SET time = ? WHERE table_name = ?', [completeness[tableName].nextDay.format('YYYY-MM-DD'), tableName]);
  else
  {
    if (currentEntry == null) return queryPromised('UPDATE completeness SET time = ? WHERE table_name = ?', [completeness[tableName].currentDay.format('YYYY-MM-DD'), tableName]);
    else return queryPromised('UPDATE completeness SET time = ? WHERE table_name = ?', [currentEntry.format('YYYY-MM-DD HH:mm:ss'), tableName]);
  }
};

function fitbitDataWriter(result) {
  switch(Object.keys(result)[0]) {
    case 'fat':
      let fat = result['fat'];
      if (Object.keys(fat).length == 0) return updateCompleteness('body_fat');
      else {
        let rows = [];
        let newestEntry = moment(completeness.body_fat.startTime);
        let currentEntry;
        Object.keys(fat).forEach(function(key) {
          currentEntry = moment(fat[key]['date'] + ' ' + fat[key]['time']);
          if (currentEntry > completeness.body_fat.startTime)
          {
            rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "' + fat[key]['fat'] + '")');
            if (currentEntry > newestEntry) newestEntry = currentEntry;
          }
        });
        let allRows = rows.join(', ');
        return  queryPromised('INSERT INTO body_fat (time, fat) VALUES ' + allRows)
        .then(() => updateCompleteness('body_fat', newestEntry));
      }
      break;
    case 'weight':
      let weight = result['weight'];
      if (Object.keys(weight).length == 0) return updateCompleteness('weight');
      else {
        let rows = [];
        let newestEntry = moment(completeness.weight.startTime);
        let currentEntry;
        Object.keys(weight).forEach(function(key) {
          currentEntry = moment(weight[key]['date'] + ' ' + weight[key]['time']);
          if (currentEntry > completeness.weight.startTime)
          {
            rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "' + weight[key]['weight'] + '", "' + weight[key]['bmi'] + '")');
            if (currentEntry > newestEntry) newestEntry = currentEntry;
          }
        });
        let allRows = rows.join(', ');
        return queryPromised('INSERT INTO weight (time, weight, bmi) VALUES ' + allRows)
        .then(() => updateCompleteness('weight', newestEntry));
      }
      break;
    case 'activities-heart':
      let restingHeartRate = result['activities-heart'][0]['value']['restingHeartRate'];  // value might still be undefined even if there's Intraday Data
      let heartRateIntraday = result['activities-heart-intraday']['dataset'];
      if (Object.keys(heartRateIntraday).length == 0) return updateCompleteness('hr_intraday');
      else {
        if(restingHeartRate) queryPromised('INSERT INTO hr_resting (date, hr) VALUES (?, ?) ON DUPLICATE KEY UPDATE hr = ?', [completeness.hr_intraday.startDay.format('YYYY-MM-DD'), restingHeartRate, restingHeartRate]).catch(function(err) { reject(err); return; });
        let rows = [];
        let currentEntry;
        Object.keys(heartRateIntraday).forEach(function(key) {
          currentEntry = moment(completeness.hr_intraday.startDay.format('YYYY-MM-DD') + ' ' + heartRateIntraday[key]['time']);
          if (currentEntry > completeness.hr_intraday.startTime) rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "' + heartRateIntraday[key]['value'] + '")');
        });
        let allRows = rows.join(', ');
        return queryPromised('INSERT INTO hr_intraday (time, hr) VALUES ' + allRows)
        .then(() => updateCompleteness('hr_intraday', currentEntry));
      }
      break;
    case 'steps':
      let rows = [];
      let currentEntry, lastKey;
      Object.keys(result.steps).forEach(function(key) {
        currentEntry = moment(completeness.activity_intraday.startDay.format('YYYY-MM-DD') + ' ' + result.steps[key]['time']);
        if (currentEntry > completeness.activity_intraday.startTime && result.steps[key]['value'] > 0)
        {
          lastKey = key;
          rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "'
          + result.steps[key]['value'] + '", "'
          + result.distance[key]['value'] + '", "'
          + result.floors[key]['value'] + '", "'
          + result.elevation[key]['value'] + '", "'
          + result.calories[key]['level'] + '")');
        }
      });
      if (rows.length == 0) return updateCompleteness('activity_intraday');
      else {
        // reset currentEntry to the minute before the last row and remove last row. This is to make sure only complete minutes are written to the db
        currentEntry = moment(completeness.activity_intraday.startDay.format('YYYY-MM-DD') + ' ' + result.steps[lastKey]['time']);
        currentEntry = moment(currentEntry).subtract(30, 'seconds');
        rows.splice(-1,1);
        let allRows = rows.join(', ');
        return queryPromised('INSERT INTO activity_intraday (time, steps, distance, floors, elevation, activity_level) VALUES ' + allRows)
        .then(() => updateCompleteness('activity_intraday', currentEntry));
      }
      fulfill();
      break;
    case 'sleep':
      let sleep = result['sleep'];
      if (Object.keys(sleep).length == 0) return updateCompleteness('sleep');
      else {
        let currentEntry;
        let insertSleep = [];
        function sleepLog(key) {
          let isMainSleep, startTime, endTime;
          if (sleep[key]['isMainSleep'] == true) isMainSleep = 1;
          else isMainSleep = 0;
          startTime = moment(sleep[key]['startTime']);
          endTime = moment(sleep[key]['startTime']);
          endTime.add(sleep[key]['timeInBed'], 'minutes');
          return queryPromised('INSERT INTO sleep (is_main_sleep, efficiency, start_time, end_time, minutes_to_sleep, minutes_awake, minutes_after_wake, awake_count, awake_duration, restless_count, restless_duration, minutes_in_bed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [isMainSleep, sleep[key]['efficiency'], startTime.format('YYYY-MM-DD HH:mm:ss'), endTime.format('YYYY-MM-DD HH:mm:ss'), sleep[key]['minutesToFallAsleep'], sleep[key]['minutesAwake'], sleep[key]['minutesAfterWakeup'], sleep[key]['awakeCount'], sleep[key]['awakeDuration'], sleep[key]['restlessCount'], sleep[key]['restlessDuration'], sleep[key]['timeInBed']])
          .then(function(result) {
            let rows = [];
            let minuteData = sleep[key]['minuteData'];
            let currentMinute = moment(startTime); // incrementing from the startTime value instead of using the dateTime value from minuteData so we don't have to deal with changing from one day another
            Object.keys(minuteData).forEach(function(sleepMinute) {
              rows.push('("' + currentMinute.format('YYYY-MM-DD HH:mm:ss') + '", "' + result.insertId + '", "' + minuteData[sleepMinute]['value'] + '")');
              currentMinute.add(1, 'minutes');
            });
            let allRows = rows.join(', ');
            queryPromised('INSERT INTO sleep_by_minute (time, id_sleep, id_sleep_states) VALUES ' + allRows).catch(function(err) { reject(err); return; });
          })
          .then(queryPromised);
        };
        Object.keys(sleep).forEach(function(key) {
          currentEntry = moment(sleep[key]['startTime']).add(sleep[key]['timeInBed'], 'minutes'); // using endTime because the start time of the sleep will usually be the day before
          if (currentEntry > completeness.sleep.startTime) insertSleep.push(sleepLog(key));
        });
        return Promise.all(insertSleep)
        .then(() => updateCompleteness('sleep', currentEntry));
      }
      break;
    default:
      Promise.reject("can't recognize data type of API result");
  }
};
