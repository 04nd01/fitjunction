var config = require('./config.js');
var mysql = require('mysql');
var pool;

open();
// a pool is created on require so it's only necessary to open a pool if it's been closed manually
function open() {
  pool = mysql.createPool({
    'host': config.MYSQL_HOST,
    'user': config.MYSQL_USER,
    'password': config.MYSQL_PASSWORD,
    'database': config.MYSQL_DB,
    'dateStrings': true // output dates as raw strings to avoid automatic timezone conversion
  });
  return Promise.resolve();
};

function query() {
  let firstLevelArgs = arguments;
  //console.log('MYSQL QUERY: ' + JSON.stringify(firstLevelArgs));
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

function close() {
  console.log('closing MySQL connection')
  return new Promise(function(fulfill, reject){
    pool.end(function (err) {
      if (err) reject(err);
      else fulfill();
    });
  });
};

module.exports = {
  open: open,
  query: query,
  close: close,
};
