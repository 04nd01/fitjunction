var fs = require('fs');
var moment = require('moment');
var cron = require('node-cron');
var config = require('./config.js');
var fitbitConnector = require('./fitbitconnector.js');
var dataProcessor = require('./dataprocessor.js');
var mysql = require('./mysql.js');
var completeness;

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
    dataProcessor.setQuitFlag(true);
    dataProcessor.retrieveData();
  }
  // "r", "R"
  else if (key === '\u0072' || key === '\u0052') {
    dataProcessor.retrieveData();
  }
});

// run once at start and then every x minutes
setTimeout(dataProcessor.retrieveData,100);
cron.schedule('*/' + config.REQUEST_FREQUENCY + ' * * * *', function(){
  dataProcessor.retrieveData();
});
