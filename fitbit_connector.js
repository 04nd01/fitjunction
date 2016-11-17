var http = require('http');
var url = require('url');
var request = require('request');
var fs = require('fs');
var config = require('./config.js');

// Tokens are accessed through global variables everywhere. token.json is only read at start and written when tokens are created/updated.
var accessToken;
var accessTokenExpiry;
var refreshToken;
var userId;
try {
  var tokenStorage = require('./token.json');
  accessToken = tokenStorage.accessToken;
  accessTokenExpiry = tokenStorage.accessTokenExpiry;
  refreshToken = tokenStorage.refreshToken;
  userId = tokenStorage.userId;
}
catch (e) {
  if (e instanceof Error && e.code === 'MODULE_NOT_FOUND') {
    console.log('token.json not found, visit http://localhost/?mode=auth to authorize.');
  } else {
    throw e;
  }
}

function connect() {
  var requestListener = function(req, response) {
    var query = url.parse(req.url, true)['query'];
    if(query['mode'] == 'auth') {
      response.writeHead(307, {'Location': config.FITBIT_OAUTH_URL + '?response_type=code&client_id=' + config.FITBIT_CLIENT_ID + '&redirect_uri=' + config.FITBIT_REDIRECT_URL + '&scope=' + config.FITBIT_SCOPE.join('%20')});
    } else if ('code' in query) {
      // This is executed when the user has authorized with fitbit and is redirected back to the server
      let options = {
        url: config.FITBIT_TOKEN_URL,
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + config.FITBIT_ID_SECRET_BASE64,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
          clientId: config.FITBIT_CLIENT_ID,
          grant_type: 'authorization_code',
          redirect_uri: config.FITBIT_REDIRECT_URL,
          code: query['code']
        }
      }
      request(options, function (err, res, body) {
        if (!err && res.statusCode == 200) {
          let data = JSON.parse(body);
          accessToken = data.access_token;
          accessTokenExpiry = Date.now()+(data.expires_in*1000);
          refreshToken = data.refresh_token;
          userId = data.user_id;
          updateTokenStorage();
        }
      });
    } else {
      let expiresIn = Math.floor((accessTokenExpiry-Date.now())/1000);
      response.write('Access token: ' + accessToken + '\nExpires in: ' + expiresIn + '\nRefresh token: ' + refreshToken + '\nUser ID: ' + userId);
    }
    response.end();
  }
  var server = http.createServer(requestListener);
  server.listen(80);
  console.log('listening on port 80...');
}

function tokenRefresh() {
  return new Promise(function (fulfill, reject){
    var buffer = 300;  // Subtract 5 minutes so the token will be renewed if it's about to expire soon
    if (typeof accessToken !== 'undefined' && Date.now()>(Number(accessTokenExpiry)-buffer)) {
      var options = {
        url: config.FITBIT_TOKEN_URL,
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + config.FITBIT_ID_SECRET_BASE64,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        form: {
          grant_type: 'refresh_token',
          refresh_token: refreshToken
        }
      }

      request(options, function (err, res, body) {
        if (!err && res.statusCode == 200) {
          let data = JSON.parse(body);
          accessToken = data.access_token;
          accessTokenExpiry = Date.now()+(data.expires_in*1000);
          refreshToken = data.refresh_token;
          userId = data.user_id;
          console.log('Access token refreshed');
          updateTokenStorage();
          fulfill();
        }
        else reject({'Error': err, 'Statuscode': res.statusCode});
      });
    } else if (typeof accessToken !== 'undefined' && Date.now()<=(Number(accessTokenExpiry)-buffer)) {
      fulfill();
    }
    else {
      reject(new Error('Access token could not be renewed, visit http://localhost/?mode=auth to authorize.'));
    }
  });
}

function updateTokenStorage() {
  var content = JSON.stringify({
    'accessToken': accessToken,
    'accessTokenExpiry': accessTokenExpiry,
    'refreshToken': refreshToken,
    'userId': userId
  })
  fs.writeFile('./token.json', content, function (err) {
    if (err) throw err;
  });
}

function apiRequest(resourcePath) {
  return new Promise(function (fulfill, reject){
    console.log('Fetching: ' + config.FITBIT_RESOURCE_BASE_URL + 'user/-/' + resourcePath);
    var options = {
      url: config.FITBIT_RESOURCE_BASE_URL + 'user/-/' + resourcePath,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      }
    }
    request(options, function (err, res, body) {
      if (!err && res.statusCode == 200) fulfill(body);
      else reject({'Error': err, 'Statuscode': res.statusCode});
    });
  });
}

module.exports = {
  connect: connect,
  tokenRefresh: tokenRefresh,
  apiRequest: apiRequest
};
