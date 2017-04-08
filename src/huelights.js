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

const hue = require('node-hue-api');

const COLORS = {
  poor: hexToRgb('#eb211e'),
  average: hexToRgb('#ffae00'),
  good: hexToRgb('#8BC34A')
};

function hexToRgb(hex) {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r, g, b];
}

/**
 * Turn a callback into a Promise.
 * node-hue-api uses silly Q Promises which require calling .done() at the end
 * of the promise chain. Instead, use real promises by wrapping the API calls
 * in a native Promise.
 */
function promiseify(fn, ...args) {
  return new Promise((resolve, reject) => {
    const callback = (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(result);
    };

    fn(callback);
  });
}

class HueLights {
  constructor(hostname=null, username=null) {
    this.hostname = hostname;
    this.username = username;
    this.api = new hue.api(this.hostname, this.username);
  }

  setHostnameOfBridge() {
    return promiseify(hue.nupnpSearch).then(bridges => {
      this.hostname = bridges[0].ipaddress; // set first bridge as ip.
      this.api = new hue.api(this.hostname, this.username);
      return this.hostname;
    });
  }

  config() {
    return promiseify(this.api.config.bind(this.api));
  }

  createUser() {
    const fn = this.api.createUser.bind(this.api, this.hostname, APP_DESCRIPTION);
    return promiseify(fn).then(username => {
      this.username = username;
      this.api = new hue.api(this.hostname, this.username);
      return this.username;
    });
  }

  listUsers() {
    return promiseify(this.api.registeredUsers.bind(this.api));
  }

  lights() {
    return promiseify(this.api.lights.bind(this.api)).then(result => result.lights);
  }

  setLightsBasedOnScore(score) {
    let color = COLORS.poor;
    if (score > 45) {
      color = COLORS.average;
    }
    if (score > 75) {
      color = COLORS.good;
    }

    const state = hue.lightState.create().on().rgb(color).brightness(100);

    this.lights().then(lights => {
      lights.forEach(light => {
         this.api.setLightState(light.id, state);
      });
    });
  }
}

module.exports = HueLights;
