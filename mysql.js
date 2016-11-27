var log = require('winston');
var config = require('./config.js');
var mysql = require('mysql');
var pool;

open();
// a pool is created on require so it's only necessary to open a pool if it's been closed manually
function open() {
  log.verbose('Opening MySQL connection pool.');
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
  // seome quick unique-enough identifier to match queries to their respective results during async operations
  let rnd = Math.random().toString().substring(2);
  log.debug('MySQL query (' + rnd + '): ', firstLevelArgs);
  return new Promise(function(fulfill, reject){
    pool.getConnection(function(err, connection) {
      if (err) { reject(err); return; }
      connection.query(...firstLevelArgs, function(err, rows, fields) {
        connection.release();
        if (err) { reject(err); return; }
        log.debug('MySQL result (' + rnd + '): ', rows);
        fulfill(rows);
      });
    });
  });
};

function close() {
  log.verbose('Closing MySQL connection pool.');
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
