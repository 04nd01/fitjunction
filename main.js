var fs = require('fs');
var moment = require('moment');
var cron = require('node-cron');
var config = require('./config.js');
var fitbitConnector = require('./fitbitconnector.js');
var dataProcessor = require('./dataprocessor.js');
var mysql = require('./mysql.js');
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
    mysql.close()
    .then(() => process.exit(0))
    .catch(function(err) { console.log(err); });
  }
  // "r", "R"
  else if (!processingFlag && (key === '\u0072' || key === '\u0052')) {
    dataProcessor.retrieveData();
  }
});

// run once at start and then every 5 minutes (108 of 150 allowed Fitbit API requests per hour)
dataProcessor.retrieveData();
cron.schedule('*/5 * * * *', function(){
  dataProcessor.retrieveData();
});
