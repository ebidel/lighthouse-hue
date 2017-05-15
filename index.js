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
const ReportGeneratorV2 = require('lighthouse/lighthouse-core/report/v2/report-generator');
const Log = require('lighthouse/lighthouse-core/lib/log');
const LighthouseRunner = require('./src/runner');
const HueLights = require('./src/huelights');
const player = require('play-sound')({});

// const PERF_CONFIG = require('lighthouse/lighthouse-core/config/perf.json');
// const DEFAULT_CONFIG = require('lighthouse/lighthouse-core/config/default.json');

const APP_DESCRIPTION = 'Lighthouse';
const USERNAME = fs.readFileSync('.hueusername', 'utf8');
const BRIDGE_IP = fs.readFileSync('.bridgeipaddress', 'utf8') || null;

const SOUNDS = {
  good: {score: 95, file: './src/audio/shiphorn.mp3'},
  bad: {score: 20, file: './src/audio/foghorn.mp3'}
};

const flags = yargs
  .help('h')
  .alias('h', 'help')
  .usage('Usage: $0 URL')
  .version(() => require('./package.json').version)
  .alias('v', 'version')
  .showHelpOnFail(false, 'Specify --help for available options')
  .boolean(['reset', 'view', 'headless'])
  .default('output', 'domhtml')
  .default('output-path', './public/results.html')
  .default('log-level', 'info')
  .argv;

const url = yargs.argv._[0];

const runner = new LighthouseRunner(url, flags);//, PERF_CONFIG);
const lights = new HueLights(BRIDGE_IP, USERNAME);

Log.setLevel(flags.logLevel);

/**
 * Creates new "Lighthouse" user on the Hue bridge if needed.
 */
function createHueUserIfNeeded() {
  const setHostNamePromise = BRIDGE_IP ? Promise.resolve(BRIDGE_IP) :
                                         lights.setHostnameOfBridge();
  return setHostNamePromise
    .then(hostname => lights.config())
    .then(config => {
      // Username is registered with the Hue.
      if ('linkbutton' in config) {
        console.log(`${Log.purple}Hue:${Log.reset} Re-using known user`);
        return lights.username;
      }

      console.log(`${Log.purple}Hue:${Log.reset} Creating new user on bridge.`);

      return lights.createUser(APP_DESCRIPTION);
    });
}

/**
 * Runs Lighthouse and saves the HTML report to disk.
 * @return {number} Overall score.
 */
function runLighthouse() {
  return runner.run().then(results => {
    results.artifacts = undefined; // prevent circular references in the JSON.

    let html;
    if (flags.output === 'domhtml') {
      html = new ReportGeneratorV2().generateReportHtml(results);
    } else {
      html = new ReportGenerator().generateHTML(results, 'cli');
    }

    fs.writeFileSync(flags.outputPath, html);

    const score = runner.getOverallScore(results);
    runner.print(score);

    return score;
  });
}

/**
 * Plays funny sound if score is low/high outlier.
 * @param {number} score
 */
function playScoreSound(score) {
  let file;

  if (score >= SOUNDS.good.score) {
    file = SOUNDS.good.file;
  } else if (score <= SOUNDS.bad.score) {
    file = SOUNDS.bad.file;
  }

  if (file) {
    const audio = player.play(file, err => {
      if (err && !err.killed) {
        console.error(err);
      }
    });
    // audio.kill();
  }
}

if (flags.reset) {
  createHueUserIfNeeded().then(username => {
    console.log(`${Log.purple}Hue user:${Log.reset} ${username}`);
    lights.resetLights();
  });
  return;
}

createHueUserIfNeeded()
  .then(username => {
    console.log(`${Log.purple}Hue user:${Log.reset} ${username}`);
    lights.resetLights();
  })
  .catch(err => {
    Log.log('Lighthouse runner:', 'Hue Lights unavailable.');
  })
  .then(_ => runLighthouse())
  .then(score => lights.setLightsBasedOnScore(score).then(_ => score))
  .then(score => {
    if (flags.view) {
      opn(flags.outputPath, {wait: false});
    }

    playScoreSound(score);

  }).catch(err => {
    lights.resetLights();
    console.error(Log.redify(err));
  });

process.on('unhandledRejection', reason => {
  // Log.log('Lighthouse runner:', reason);
  console.log('Lighthouse runner:', reason);
});

// module.exports = LigthouseRunner;
