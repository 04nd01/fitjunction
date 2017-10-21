# fitjunction
Fitjunction uses the Fitbit API to periodically query your activity data and store it in a local MySQL database for safe-keeping or further analysis.

## Motivation
I've logged a lot of fitness data in the past years. Jogging, weight lifting, steps and heart rate to name a few. Some of that data is lost forever in services that have since been discontinued. To get the most out of my data collection efforts I'm in the process of creating a self-hosted centralized database of all quantified-self metrics that are of interest to me. Fitbit is the first step.

Fitjunction will extract more detailed data from your Fitbit account than the built-in export function will. Whether you'd like to run more advanced analytics or you just want to have an offline backup fitjunction will give your data back to you. To that end the database structure has been kept close to the structure provided by Fitbit and the raw data for every single day queried from the Fitbit API is stored as a .json file.

## Fitbit API setup
You'll need to create your own Fitbit app for this but it only takes a few minutes. Go to https://dev.Fitbit.com/apps and create an app with the following settings:
  * OAuth 2.0 Application Type: Personal
  * Callback URL: The URL should lead to the machine where you're running fitjunction, if your machine isn't reachable from the internet you can get around this by entering a URL that doesn't exist and changing that in your browser to http://localhost/ during authentication.
  * Default Access Type: Read-Only

## Installation
1. Download this repository and run "npm install" in root directory.
1. Execute createdatabase.sql on your MySQL server to create the qsaggregator db and fill it with default values.
2. Fill out config.sample.js and copy it to <fitjunction-root-directory>\\config.js. Make sure the MySQL user you enter in the config has access to the qsaggregator database.

## Updating
Unless otherwise stated download newest [release](https://github.com/04nd01/fitjunction/releases) and overwrite old files.

### Updating from 1.0.0 (see package.json for version number)
  * Overwrite files
  * Run "ALTER TABLE `activity_intraday` ADD UNIQUE(`time`);" or recreate database with current .sql file. (If this fails there's duplicate entries, either fix them manually or start over with a fresh database. Starting with v1.1.0 errors like this should not be possible anymore.)
  * Create new config from config.sample.js (or insert changes into existing config, lines 13, 39 and 40 are different. Storing of json files is now optional.)

## Usage
1. Run "node main.js" in root directory.
2. Got to http://localhost/?mode=auth to start authorization.
3. fitjunction will periodically update the database. After a few hours or days it will have reached the current day and keep updating the current day as new data is added on the Fitbit website.

## Known issues
I've observed a few cases where processing will stop and Fitjunction needs to be manually restarted and haven't tracked down the cause yet but as of version 1.1.0 the mysql module utilizes transactions to ensure database consistency in case of unexpected errors.

## Planned features
Capability to run as a background service.
