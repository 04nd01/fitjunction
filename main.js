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

function queryPromised() {
  let firstLevelArgs = arguments;
  return new Promise(function(fulfill, reject){
    pool.getConnection(function(err, connection) {
      if (err) { reject(err); return; }
      connection.query(...firstLevelArgs, function(err, rows, fields) {
        if (err) { reject(err); return; }
        //DEBUG console.log('REQUEST: ' + JSON.stringify(firstLevelArgs) + '\nRESULT: ' + JSON.stringify(rows));
        fulfill(rows);
      });
    });
  });
};

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

    // Single Data types commented for testing

    // BODY FAT
    fitbitConnector.apiRequest('body/log/fat/date/' + completeness.body_fat.startDay.format('YYYY-MM-DD') + '.json')
    .then(fitbitDataWriter)
    .catch(function(err) { console.log(err); });

    /*
    // WEIGHT
    fitbitConnector.apiRequest('body/log/weight/date/' + completeness.weight.startDay.format('YYYY-MM-DD') + '.json')
    .then(fitbitDataWriter)
    .catch(function(err) { console.log(err); });
    */

    /*
    // HEART RATE
    fitbitConnector.apiRequest('activities/heart/date/' + completeness.hr_intraday.startDay.format('YYYY-MM-DD') + '/1d/1sec.json')
    .then(fitbitDataWriter)
    .catch(function(err) { console.log(err); });
    */

    /*
    // ACTIVITY INTRADAY
    let getActivities = [
      fitbitConnector.apiRequest('activities/steps/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
      fitbitConnector.apiRequest('activities/distance/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
      fitbitConnector.apiRequest('activities/floors/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
      fitbitConnector.apiRequest('activities/elevation/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json'),
      fitbitConnector.apiRequest('activities/calories/date/' + completeness.activity_intraday.startDay.format('YYYY-MM-DD') + '/1d/1min.json')
    ];

    Promise.all(getActivities)
    .then(function(result) {
      return new Promise(function(fulfill, reject){
        fulfill({
          'steps': result[0]['activities-steps-intraday']['dataset'],
          'distance': result[1]['activities-distance-intraday']['dataset'],
          'floors': result[2]['activities-floors-intraday']['dataset'],
          'elevation': result[3]['activities-elevation-intraday']['dataset'],
          'calories': result[4]['activities-calories-intraday']['dataset']
        });
      });
    })
    .then(fitbitDataWriter)
    .catch(function(err) { console.log(err); });
    */

/*
    // SLEEP (incomplete)
    fitbitConnector.apiRequest('sleep/date/' + completeness.sleep.startDay.format('YYYY-MM-DD') + '.json')
    .then(fitbitDataWriter)
    .catch(function(err) { console.log(err); });
*/



    fulfill();
  });
})
.catch(function(err) { console.log(err); });

function updateCompleteness(tableName, currentEntry) {
  if (currentEntry == null) console.log('No "' + tableName + '" data for ' + completeness[tableName].startDay.format('YYYY-MM-DD') + ', updating completeness table');
  if (completeness[tableName].startDay < completeness[tableName].currentDay) queryPromised('UPDATE completeness SET time = ? WHERE table_name = ?', [completeness[tableName].nextDay.format('YYYY-MM-DD'), tableName]).catch(function(err) { reject(err); return; });
  else
  {
    if (currentEntry == null) queryPromised('UPDATE completeness SET time = ? WHERE table_name = ?', [completeness[tableName].currentDay.format('YYYY-MM-DD'), tableName]).catch(function(err) { reject(err); return; });
    else queryPromised('UPDATE completeness SET time = ? WHERE table_name = ?', [currentEntry, tableName]).catch(function(err) { reject(err); return; });
  }
};

function fitbitDataWriter(result) {
  return new Promise(function(fulfill, reject){
    switch(Object.keys(result)[0]) {
      case 'fat':
        let fat = result['fat'];
        if (Object.keys(fat).length == 0) updateCompleteness('body_fat');
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
          queryPromised('INSERT INTO body_fat (time, fat) VALUES ' + allRows).catch(function(err) { reject(err); return; });
          updateCompleteness('body_fat', newestEntry);
        }
        fulfill();
        break;
      case 'weight':
        let weight = result['weight'];
        if (Object.keys(weight).length == 0) updateCompleteness('weight');
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
          queryPromised('INSERT INTO weight (time, weight, bmi) VALUES ' + allRows).catch(function(err) { reject(err); return; });
          updateCompleteness('weight', newestEntry);
        }
        fulfill();
        break;
      case 'activities-heart':
        let restingHeartRate = result['activities-heart'][0]['value']['restingHeartRate'];  // value might still be undefined even if there's Intraday Data
        let heartRateIntraday = result['activities-heart-intraday']['dataset'];
        if (Object.keys(heartRateIntraday).length == 0) updateCompleteness('hr_intraday');
        else {
          if(restingHeartRate) queryPromised('INSERT INTO hr_resting (date, hr) VALUES (?, ?) ON DUPLICATE KEY UPDATE hr = ?', [completeness.hr_intraday.startDay.format('YYYY-MM-DD'), restingHeartRate, restingHeartRate]).catch(function(err) { reject(err); return; });
          let rows = [];
          let currentEntry;
          Object.keys(heartRateIntraday).forEach(function(key) {
            currentEntry = moment(completeness.hr_intraday.startDay.format('YYYY-MM-DD') + ' ' + heartRateIntraday[key]['time']);
            if (currentEntry > completeness.hr_intraday.startTime)
            {
              rows.push('("' + currentEntry.format('YYYY-MM-DD HH:mm:ss') + '", "' + heartRateIntraday[key]['value'] + '")');
            }
          });
          console.log(rows.length);
          let allRows = rows.join(', ');
          queryPromised('INSERT INTO hr_intraday (time, hr) VALUES ' + allRows).catch(function(err) { console.log(err); return; });
          updateCompleteness('weight', currentEntry);
        }
        fulfill();
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

        // reset currententry to the minute before the last row and remove last row. This is to make sure only complete minutes are written to the db
        currentEntry = moment(completeness.activity_intraday.startDay.format('YYYY-MM-DD') + ' ' + result.steps[lastKey]['time']);
        currentEntry = moment(currentEntry).subtract(30, 'seconds');
        rows.splice(-1,1);
        let allRows = rows.join(', ');

        queryPromised('INSERT INTO activity_intraday (time, steps, distance, floors, elevation, activity_level) VALUES ' + allRows).catch(function(err) { console.log(err); return; });
        updateCompleteness('activity_intraday', currentEntry);
        fulfill();
        break;
      case 'sleep':
        let sleep = result['sleep'];
        if (Object.keys(sleep).length == 0) updateCompleteness('sleep');

        // forEach minuteData

        fulfill();
        break;
      default:
        reject("Can't recognize data type of API result.");
    }
  });
};

//deactivated for testing
//fitbitConnector.connect();
//console.log('listening...');
