var log = require('winston');
var config = require('./config/config.js');
var mysql = require('mysql');
var pool;

function startTransaction() {
  return new Promise(function(fulfill, reject){
    log.verbose('Getting connection from pool.');
    pool.getConnection(function (err, connection) {
      if (err) reject(err);
      else {
        log.verbose('Starting transaction.');
        connection.beginTransaction(function(err) {
          if (err) reject(err);
          else fulfill(connection);
        });
      }
    });
  });
};

function commit(connection) {
  return new Promise(function(fulfill, reject){
    log.verbose('Committing transaction.');
    connection.commit(function(err) {
      if (err) {
        log.error('Commit failed. Rolling back transaction.');
        return rollback(connection, err);
      }
      else { connection.release(); fulfill(); }
    });
  });
};

function rollback(connection, reason) {
  return new Promise(function(fulfill, reject){
    log.error('Rolling back transaction.');
    connection.rollback(function(err) {
      if (err) { connection.release(); reject([reason, err]); }
      else { connection.release(); reject(reason); }
    });
  });
};

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

function query(firstLevelArgs, connection) { // if a mysql connection is supplied it will be used for the query, otherwise one will be pulled from the pool
  // seome quick unique-enough identifier to match queries to their respective results during async operations
  let rnd = Math.random().toString().substring(2);
  log.debug('MySQL query (' + rnd + '): ', firstLevelArgs);
  return new Promise(function(fulfill, reject){
    function callback(err, rows, fields) {
      if (err) { reject(err); return; }
      log.debug('MySQL result (' + rnd + '): ', rows);
      fulfill(rows);
    };
    if (connection != null) { log.debug('Executing query (' + rnd + ') using connection ID ' + connection.threadId + '.'); connection.query(...firstLevelArgs, callback); }
    else { log.debug('Executing query (' + rnd + ') using connection from pool.'); pool.query(...firstLevelArgs, callback); }
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
  startTransaction: startTransaction,
  commit: commit,
  rollback: rollback,
};
