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

const lighthouse = require('lighthouse');
const ChromeLauncher = require('lighthouse/lighthouse-cli/chrome-launcher.js').ChromeLauncher;
const Log = require('lighthouse/lighthouse-core/lib/log');

const _SIGINT = 'SIGINT';
const _SIGINT_EXIT_CODE = 130;

class LighthouseRunner {
  constructor(url, flags, config) {
    this.url = url;
    this.flags = flags;
    this.config = config;
  }

  _handleError(err) {
    console.error(Log.redify(err));
  }

  launchChrome() {
    this.launcher = new ChromeLauncher({
      port: this.flags.port,
      autoSelectChrome: !this.flags.selectChrome,
    });

    // Kill spawned Chrome process in case of ctrl-C.
    process.on(_SIGINT, () => {
      this.launcher.kill().then(() => process.exit(_SIGINT_EXIT_CODE), this._handleError);
    });

    return this.launcher.isDebuggerReady()
      .catch(() => {
        if (this.flags.skipAutolaunch) {
          return;
        }

        console.log((`${Log.purple}Launching Chrome${Log.reset}`));
        return this.launcher.run();
      });
  }

  run() {
    return this.launchChrome()
      .then(() => {
        console.log(`${Log.yellow}Lighthouse:${Log.reset} running...`);
        return lighthouse(this.url, this.flags, this.config);
      })
      .then(results => this.launcher.kill().then(_ => results))
      .catch(err => {
        return this.launcher.kill().then(() => {
          throw err;
        }, this._handleError);
      });
  }

  getOverallScore(lighthouseResults) {
    const scoredAggregations = lighthouseResults.aggregations.filter(a => a.scored);
    const total = scoredAggregations.reduce((sum, aggregation) => {
      return sum + aggregation.total;
    }, 0);
    return (total / scoredAggregations.length) * 100;
  }

  print(score) {
    let output = `${Log.red}${score}${Log.reset}`;
    if (score > 45) {
      output = `${Log.yellow}${score}${Log.reset}`
    }
    if (score > 75) {
      output = `${Log.green}${score}${Log.reset}`
    }
    console.log(`${Log.yellow}Lighthouse${Log.reset} score: ${output}`);
  }
}

module.exports = LighthouseRunner;
