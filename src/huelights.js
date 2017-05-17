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
  // poor: hexToRgb('#e53935'),
  // average: hexToRgb('#ef6c00'),
  // good: hexToRgb('#43a047'),
  poor: 65463,
  average: 5842,
  good: 24460,
  white: 41564
};

// function hexToRgb(hex) {
//   if (hex.startsWith('#')) {
//     hex = hex.slice(1);
//   }

//   const bigint = parseInt(hex, 16);
//   const r = (bigint >> 16) & 255;
//   const g = (bigint >> 8) & 255;
//   const b = bigint & 255;
//   return [r, g, b];
// }

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
    const [ipaddress, port] = hostname.split(':');
    this.hostname = ipaddress;
    this.username = username;
    this.api = new hue.api(this.hostname, this.username, null, port);
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

  createUser(appDescription) {
    const fn = this.api.createUser.bind(this.api, this.hostname, appDescription);
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

  /**
   * Turns off all lights on the bridge.
   * @param {number} transition Transition time. Defaults to 500.
   */
  turnAllLightsOff(transition=500) {
    const state = hue.lightState.create().transition(transition).off();

    return this.lights().then(lights => {
      lights.forEach(light => {
        this.api.setLightState(light.id, state);
      });
    });
  }

  resetLights() {
    const state = hue.lightState.create().on().hue(COLORS.white)
        .bri(255).sat(0).transition(1500);

    return this.lights().then(lights => {
      lights.map(light => this.api.setLightState(light.id, state));
    });
  }

  /**
   * Pulses lights specified number of times.
   * @param {number} times
   * @param {number=} timeout Delay (ms) between pulses. Defaults to 2000.
   * @param {number=} color
   * @return {number} A setInterval id.
   */
  async pulseLights(times, timeout=2000, color=COLORS.white) {
    let iteration = 0;

    // await this.resetLights();
    await this.turnAllLightsOff();

    return new Promise(resolve => {

      const doPulse = async () => {
        const lights = await this.lights();
        const sat = color === COLORS.white ? 0 : 255;
        const state = hue.lightState.create().hue(color).bri(255).sat(sat);//.shortAlert();
        lights.forEach(light => {
          // let state = hue.lightState.create().turnOff();
          // this.api.setLightState(light.id, state);

          // state = hue.lightState.create().on().alertShort();
          // this.api.setLightState(light.id, state);

          // let state;
          if (light.state.on) {
            state.off();
          } else {
            state.on();
          }

          this.api.setLightState(light.id, state);
        });

        setTimeout(() => {
          // One pulse is an on and off.
          if (iteration < times) {
            doPulse();
          } else {
            // await this.turnAllLightsOff();
            resolve();
          }
          iteration++;
        }, timeout);
      };

      doPulse();
    });
  }

  /**
   * Sequentially turns on/off each bulb on the bridge. If the lights are in a
   * circular arrangement, this will create the effect of a rotating beacon.
   * @param {number=} rotations
   * @param {number=} timeout Delay between each light activating.
   * @param {number=} color
   */
  async beaconLights(rotations = Infinity, timeout=1000, color=COLORS.white) {
    let activeLightId;
    let idx = 0;
    let iteration = 0;

    // await this.resetLights();
    await this.turnAllLightsOff();

    let lights = await this.lights();
    lights = lights.filter(light => light.name !== 'lightstrip');

    const incrementSpin = () => {
      activeLightId = lights[idx].id;

      lights.forEach(light => {
        //const state = hue.lightState.create().hue(color).bri(255).sat(0);//.transition(1000);
        const state = hue.lightState.create().hue(color).bri(255).sat(255);

        if (light.id === activeLightId) {
          state.on();
        } else {
          state.off();
        }
        this.api.setLightState(light.id, state);
      });

      idx = ++idx % lights.length;
    }

    return new Promise(resolve => {
      const interval_ = setInterval(() => {
        // A full rotation is when all lights have been activated once.
        if (iteration < rotations * lights.length) {
          incrementSpin();
          iteration++;
        } else {
          incrementSpin(true);
          clearInterval(interval_);
          this.turnAllLightsOff().then(resolve);
        }
      }, timeout);
    });
  }

  setLightsBasedOnScore(score) {
    let color = COLORS.poor;
    if (score > 45) {
      color = COLORS.average;
    }
    if (score > 75) {
      color = COLORS.good;
    }

    const state = hue.lightState.create().on().hue(color).bri(255).sat(255);
    // const state = hue.lightState.create().on();//.white(500, 100);
    // const state = hue.lightState.create().on().brightness(100).transition(300);
    // const state = hue.lightState.create().shortAlert();
    // const state = hue.lightState.create().longAlert();

    return this.lights().then(lights => {
      lights.map(light => this.api.setLightState(light.id, state));
    });
  }
}

module.exports = {
  HueLights,
  COLORS
};
