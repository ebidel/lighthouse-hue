/**
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const fs = require('fs');
const opn = require('opn');
const yargs = require('yargs');
const ReportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
const Log = require('lighthouse/lighthouse-core/lib/log');
const LighthouseRunner = require('./src/runner');
const HueLights = require('./src/huelights');

// const PERF_CONFIG = require('lighthouse/lighthouse-core/config/perf.json');
// const DEFAULT_CONFIG = require('lighthouse/lighthouse-core/config/default.json');

const APP_DESCRIPTION = 'Lighthouse';
const USERNAME = fs.readFileSync('.hueusername', 'utf8');

const flags = yargs
  .help('h')
  .alias('h', 'help')
  .usage('Usage: $0 URL')
  .version(() => require('./package.json').version)
  .alias('v', 'version')
  .showHelpOnFail(false, 'Specify --help for available options')
  .boolean(['view'])
  .default('output', 'html')
  .default('output-path', 'results.html')
  .argv;

const url = yargs.argv._[0];

process.on('unhandledRejection', reason => {
  console.log(reason);
});

const runner = new LighthouseRunner(url, flags);//, PERF_CONFIG);
runner.run().then(results => {
  results.artifacts = undefined; // prevent circular references in the JSON.

  const reportGenerator = new ReportGenerator();
  fs.writeFileSync(flags.outputPath, reportGenerator.generateHTML(results, 'cli'));

  const score = runner.getOverallScore(results);
  runner.print(score);

  return score;
}).then(score => {
  const lights = new HueLights(null, USERNAME);
  lights.setHostnameOfBridge()
    .then(hostname => lights.config())
    .then(config => {
      // Username is registered with the Hue.
      if ('linkbutton' in config) {
        console.log(`${Log.purple}Hue:${Log.reset} Re-using known user`);
        return lights.username;
      }

      console.log(`${Log.purple}Hue:${Log.reset} Creating new user on bridge.`);

      return lights.createUser(); // Create new user on bridge.
    }).then(username => {
      // console.log(`Username: ${username}`);
      // const state = hue.lightState.create().on();//.white(500, 100);
      // const state = hue.lightState.create().on().brightness(100).transition(300);
      // const state = hue.lightState.create().shortAlert();
      // const state = hue.lightState.create().longAlert();
      lights.setLightsBasedOnScore(score);
    }).then(() => {
      if (flags.view) {
        opn(flags.outputPath, {wait: false});
      }
    })
}).catch(err => {
  console.error(Log.redify(err));
});

// module.exports = LigthouseRunner;
