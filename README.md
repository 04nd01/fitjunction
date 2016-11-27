#fitjunction

<<<<<<< HEAD
##Fitbit API setup
You'll need to create your own fitbit app for this but it only takes a few minutes. Go to https://dev.fitbit.com/apps and create an app with the following settings:
  * OAuth 2.0 Application Type: Personal
  * Callback URL: The URL should lead to the machine where you're running fitjunction, if your machine isn't reachable from the internet you can get around this by entering a URL that doesn't exist and changing that in your browser to http://localhost/ during authentification.
  * Default Access Type: Read-Only

=======

##Fitbit API setup
You'll need to create your own fitbit app for this but it only takes a few minutes. Go to https://dev.fitbit.com/apps and create an app with the following settings:
  * OAuth 2.0 Application Type: Personal
  * Callback URL: The URL should lead to the machine where you're running fitjunction, if your machine isn't reachable from the internet you can get around this by entering a URL that doesn't exist and changing that in your browser to http://localhost/ during authentification.
  * Default Access Type: Read-Only

>>>>>>> origin/master
##Installation
1. run "npm install" in root directory.
1. Execute createdatabase.sql on your MySQL server to create the qsaggregator db and fill it with default values.
2. Fill out config.sample.js and copy it to <fitjunction-root-directory>\\config.js. Make sure the MySQL user you enter in the has access to the qsaggregator database.

##Usage
1. Run "node main.js" in root directory.
2. Got to http://localhost/?mode=auth to start authorization.
3. fitjunction will periodically update the database. After a few hours or days it will have reached the current day and keep updating the current day as new data is added on the Fitbit website.
