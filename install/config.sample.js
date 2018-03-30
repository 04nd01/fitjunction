// -----------------------
// Fill out these settings, then copy file to root directory and rename to config.js
// -----------------------
const MYSQL_HOST = '';
const MYSQL_USER = '';
const MYSQL_PASSWORD = '';
const MYSQL_DB = 'qsaggregator';

const FITBIT_REDIRECT_URL = ''; // Needs to point back at the server running the application. Needs to be the same as Callback URL in fitbit api settings https://dev.fitbit.com/
const FITBIT_CLIENT_ID = '';
const FITBIT_CLIENT_SECRET = '';

const FITBIT_ACCOUNT_CREATION = '2016-01-01 00:00:00'; // Day where we start looking for logged data
const REQUEST_FREQUENCY = '5'; // Retrieval of new days will run every x minutes. One run makes 9 requests, the Fitbit API allows 150 requests per hour for this type of application. It's not recommended to go lower than every 4 minutes (135 requests/hour)
const STORE_JSON = true; // If this is set to true every json object returned from the Fitbit API will be stored in the directory "result_history". This is not necessary but the pure unmodified information Fitbit can be useful. One file contains a single day's data, if a day is queried multiple times the .json file will be overwritten.

// ----------------------------------------------
// Only touch these if you know what you're doing
// ----------------------------------------------
const LOG_LEVEL = 'warn'; // Log level for fitjunction.log. Error levels are: error, warn, info, verbose, debug, silly.
const FITBIT_OAUTH_URL = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = 'https://api.fitbit.com/oauth2/token';
const FITBIT_RESOURCE_BASE_URL = 'https://api.fitbit.com/1/';
const FITBIT_SCOPE = ['activity','heartrate','location','nutrition','profile','settings','sleep','social','weight']; // Full list: 'activity','heartrate','location','nutrition','profile','settings','sleep','social','weight'
const FITBIT_ID_SECRET_BASE64 = new Buffer(FITBIT_CLIENT_ID + ':' + FITBIT_CLIENT_SECRET).toString('base64');

module.exports = {
  REQUEST_FREQUENCY: REQUEST_FREQUENCY,
  FITBIT_OAUTH_URL: FITBIT_OAUTH_URL,
  FITBIT_TOKEN_URL: FITBIT_TOKEN_URL,
  FITBIT_RESOURCE_BASE_URL: FITBIT_RESOURCE_BASE_URL,
  FITBIT_REDIRECT_URL: FITBIT_REDIRECT_URL,
  FITBIT_CLIENT_ID: FITBIT_CLIENT_ID,
  FITBIT_CLIENT_SECRET: FITBIT_CLIENT_SECRET,
  FITBIT_SCOPE: FITBIT_SCOPE,
  FITBIT_ID_SECRET_BASE64: FITBIT_ID_SECRET_BASE64,
  FITBIT_ACCOUNT_CREATION: FITBIT_ACCOUNT_CREATION,
  MYSQL_HOST: MYSQL_HOST,
  MYSQL_USER: MYSQL_USER,
  MYSQL_PASSWORD: MYSQL_PASSWORD,
  MYSQL_DB: MYSQL_DB,
  STORE_JSON: STORE_JSON
};
