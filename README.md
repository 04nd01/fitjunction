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

##  Docker deployment

### Requirements
  * A MySQL server
  * If you have multiple web applications running, a reverse proxy like nginx or traefik

### Deploying the container
1. create directories for config and the result_history.
2. Execute install/createdatabase.sql on your MySQL server to create the qsaggregator db and fill it with default values.
3. Fill out install/config.sample.js and copy it to <your-config-directory>/config.js. Make sure the MySQL user you enter in the config has access to the qsaggregator database.
4. Run the container with the previously created directories mounted into it.

```
docker run -d -p 80:80 --name fitjunction \
-v /opt/fitjunction/config:/fitjunction/config \
-v /opt/fitjunction/result_history:/fitjunction/config \
-v /etc/localtime:/etc/localtime:ro \
fourandone/fitjunction
```

##  Manual Installation
1. Download this repository and run "npm install" in root directory.
1. Execute install/createdatabase.sql on your MySQL server to create the qsaggregator db and fill it with default values.
2. Fill out install/config.sample.js and copy it to <fitjunction-root-directory>/config/config.js. Make sure the MySQL user you enter in the config has access to the qsaggregator database.

### Usage
1. Run "node main.js" in root directory.
2. Got to http://localhost/?mode=auth to start authorization.
3. fitjunction will periodically update the database. After a few hours or days it will have reached the current day and keep updating the current day as new data is added on the Fitbit website.
