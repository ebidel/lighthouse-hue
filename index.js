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

const yargs = require('yargs');

const Printer = require('lighthouse/lighthouse-cli/printer');
// const stringifySafe = require('json-stringify-safe');

// const Log = require('lighthouse/lighthouse-core/lib/log');
const Log = require('./src/log');
const LighthouseRunner = require('./src/runner');
const HueLights = require('./src/huelights');

const PERF_CONFIG = require('lighthouse/lighthouse-core/config/perf.json');
const DEFAULT_CONFIG = require('lighthouse/lighthouse-core/config/default.json');

const APP_DESCRIPTION = 'Lighthouse';
const USERNAME = 'FILL IN';

const flags = yargs
  .help('h')
  .alias('h', 'help')
  .usage('Usage: $0 URL')
  .version(() => require('./package.json').version)
  .alias('v', 'version')
  .showHelpOnFail(false, 'Specify --help for available options')
  .describe({
    'port': 'The port to use for the debugging protocol. Use 0 for a random port'
  })
  // .default('port', 9222)
  .default('output', 'pretty')
  .argv;

const url = yargs.argv._[0];

// Set logging preferences, assume quiet.
// flags.logLevel = flags.logLevel || 'verbose';
// Log.setLevel(flags.logLevel);

process.on('unhandledRejection', reason => {
  console.log(reason);
});

const runner = new LighthouseRunner(url, flags, PERF_CONFIG);
runner.run().then(results => {
  const score = runner.getOverallScore(results);

  // console.log(stringifySafe(results))
  // results = stringifySafe(results);

  Printer.write(results, flags.output);

  const lights = new HueLights(null, USERNAME);
  lights.setHostnameOfBridge().then(hostname => {
    lights.config().then(config => {
      if ('linkbutton' in config) {
        return config;
      }

      // Create new user on bridge if config doesn't have auth'd user's fields.
      return lights.createUser().then(username => {
        lights.username = username;
        return config;
      });
    }).then(config => {
      // const state = hue.lightState.create().on();//.white(500, 100);
      // const state = hue.lightState.create().on().brightness(100).transition(300);
      // const state = hue.lightState.create().shortAlert();
      // const state = hue.lightState.create().longAlert();
      lights.setLightsBasedOnScore(score);
    });

  });

}).catch(err => {
  console.error(Log.redify(err));
});

// module.exports = LigthouseRunner;
