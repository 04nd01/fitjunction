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
  return new Promise(function (fulfill, reject){
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
  return new Promise(function (fulfill, reject){
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

    /*
    // BODY FAT
    fitbitConnector.apiRequest('body/log/fat/date/' + completeness.body_fat.startDay.format('YYYY-MM-DD') + '.json')
    .then(fitbitDataWriter)
    .catch(function(err) { console.log(err); });
    */

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

    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    // look for nested promises and make sure only the deepest nested promise fulfills to prevent premature continuation of the promise chains
    //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    /* incomplete
    ACTIVITY
    fitbitConnector.apiRequest('sleep/date/' + completeness.sleep.startDay.format('YYYY-MM-DD') + '/1d/1sec.json')
    .then(fitbitDataWriter)
    .catch(function(err) { console.log(err); });

    let activitiesStepsPromise= fitbitConnector.apiRequest('ACTIVITIES--------' + completeness.ACTIVITIES-------.startDay.format('YYYY-MM-DD') + '.json')


    var activities = require('./beispieldaten/_activities.json');
    var activities_calories = require('./beispieldaten/_activities_calories.json');
    var activities_steps = require('./beispieldaten/_activities_steps.json');
    var activities_floors = require('./beispieldaten/_activities_floors.json');
    var activities_elevation = require('./beispieldaten/_activities_elevation.json');

    */

    fulfill();
  });
})
.catch(function(err) { console.log(err); });

function fitbitDataWriter(payload) {
  return new Promise(function (fulfill, reject){
    let result = JSON.parse(payload);
    switch(Object.keys(result)[0]) {
      case 'fat':
        let fat = result['fat'];
        if (Object.keys(fat).length == 0) {
          console.log('No Body Fat data for ' + completeness.body_fat.startDay.format('YYYY-MM-DD') + ', updating completeness table');
          if (completeness.body_fat.startDay < completeness.body_fat.currentDay) queryPromised('UPDATE completeness SET time = ? WHERE table_name = "body_fat"', [completeness.body_fat.nextDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
          else queryPromised('UPDATE completeness SET time = ? WHERE table_name = "body_fat"', [completeness.body_fat.currentDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
        }
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
          if (completeness.body_fat.startDay < completeness.body_fat.currentDay) queryPromised('UPDATE completeness SET time = ? WHERE table_name = "body_fat"', [completeness.body_fat.nextDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
          else queryPromised('UPDATE completeness SET time = ? WHERE table_name = "body_fat"', [newestEntry.format('YYYY-MM-DD HH:mm:ss')]).catch(function(err) { reject(err); return; });
        }
        fulfill();
        break;
      case 'weight':
        let weight = result['weight'];
        if (Object.keys(weight).length == 0) {
          console.log('No Weight data for ' + completeness.weight.startDay.format('YYYY-MM-DD') + ', updating completeness table');
          if (completeness.weight.startDay < completeness.weight.currentDay) queryPromised('UPDATE completeness SET time = ? WHERE table_name = "weight"', [completeness.weight.nextDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
          else queryPromised('UPDATE completeness SET time = ? WHERE table_name = "weight"', [completeness.weight.currentDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
        }
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
          if (completeness.weight.startDay < completeness.weight.currentDay) queryPromised('UPDATE completeness SET time = ? WHERE table_name = "weight"', [completeness.weight.nextDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
          else queryPromised('UPDATE completeness SET time = ? WHERE table_name = "weight"', [newestEntry.format('YYYY-MM-DD HH:mm:ss')]).catch(function(err) { reject(err); return; });
        }
        fulfill();
        break;
      case 'activities-heart':
        let restingHeartRate = result['activities-heart'][0]['value']['restingHeartRate'];  // value might still be undefined even if there's Intraday Data
        let heartRateIntraday = result['activities-heart-intraday']['dataset'];
        if (Object.keys(heartRateIntraday).length == 0) {
          console.log('No Heart Rate data for ' + completeness.hr_intraday.startDay.format('YYYY-MM-DD') + ', updating completeness table');
          if (completeness.hr_intraday.startDay < completeness.hr_intraday.currentDay) queryPromised('UPDATE completeness SET time = ? WHERE table_name = "hr_intraday"', [completeness.hr_intraday.nextDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
          else queryPromised('UPDATE completeness SET time = ? WHERE table_name = "hr_intraday"', [completeness.hr_intraday.currentDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
        }
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

          if (completeness.hr_intraday.startDay < completeness.hr_intraday.currentDay) queryPromised('UPDATE completeness SET time = ? WHERE table_name = "hr_intraday"', [completeness.hr_intraday.nextDay.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });
          else queryPromised('UPDATE completeness SET time = ? WHERE table_name = "hr_intraday"', [currentEntry.format('YYYY-MM-DD')]).catch(function(err) { reject(err); return; });  // as intraday hr values are in ascending order the last inserted entry will be the newest one
        }
        fulfill();
        break;
      case 'activities':

        fulfill();
        break;
      case 'sleep':

        fulfill();
        break;
      default:
        console.log("Can't recognize data type of API result.");
        fulfill();
    }
  });
};

//deactivated for testing
//fitbitConnector.connect();
//console.log('listening...');
