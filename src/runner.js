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
const {ChromeLauncher} = require('lighthouse/lighthouse-cli/chrome-launcher.js');
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
    Log.error('Lighthouse runner:', err);
  }

  launchChrome(headless = this.flags.headless) {
    this.launcher = new ChromeLauncher({
      port: this.flags.port,
      autoSelectChrome: !this.flags.selectChrome,
      additionalFlags: [
        '--window-position=40,100',
        '--window-size=412,732', // Nexus 5x
        headless ? '--headless' : ''
      ]
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

        Log.log('Lighthouse runner:', 'Launching Chrome');
        return this.launcher.run();
      });
  }

  run() {
    return this.launchChrome()
      .then(() => {
        Log.log('Lighthouse runner:', 'running...');
        return lighthouse(this.url, this.flags, this.config);
      })
      .then(results => {
        // Workaround for headless Chrome. Introduce slight delay before killing Chrome.
        // See https://github.com/GoogleChrome/lighthouse/issues/1931
        return new Promise(resolve => {
          setTimeout(() => {
            resolve(results);
          }, 10);
        });
      })
      .then(results => this.launcher.kill().then(_ => results))
      .catch(err => {
        return this.launcher.kill().then(() => {
          throw err;
        }, this._handleError);
      });
  }

  getOverallScore(lighthouseResults) {
    if (lighthouseResults) {
      return lighthouseResults.score; // v2
    }
    const scoredAggregations = lighthouseResults.aggregations.filter(a => a.scored);
    const total = scoredAggregations.reduce((sum, aggregation) => {
      return sum + aggregation.total;
    }, 0);
    return (total / scoredAggregations.length) * 100;
  }

  print(score) {
    Log.log('LIGHTHOUSE SCORE:', score);
  }
}

module.exports = LighthouseRunner;
