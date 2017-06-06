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

const express = require('express');
// const bodyParser = require('body-parser');
const exec = require('child_process').exec;
const opn = require('opn');
const spawn = require('child_process').spawn;
const player = require('play-sound')({});

const app = express();
app.use(express.static('public'));
// app.use(bodyParser.json());

const KIOSK_MODE = process.env.KIOSK;

const SOUNDS = {
  good: {score: 90, file: './src/audio/harbor.mp3'},
  bad: {score: 30, file: './src/audio/foghorn.mp3'}
};

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

app.get('/run', (req, res) => {
  // exec(`node index.js --view ${req.query.url}`, (err, stdout, stderr) => {
  //      if (err) {
  //     console.error(err);
  //     res.status(500).send(err);
  //     return;
  //   }
  //   res.status(200).send(stdout);
  // });

  // Send headers for event-stream connection.
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const args = ['index.js'];//['index.js', '--view'];
  if (req.query.headless) {
    args.push('--headless');
  }

  const child = spawn('node', [...args, req.query.url]);

  let log = '';

  child.stderr.on('data', data => {
    // res.write(`id: ${id}\n`);
    res.write(`data: ${data.toString()}\n\n`);
    log += data.toString();
    // res.flush();
  });

  child.on('close', code => {
    res.write(`data: done\n\n`);
    res.status(410).end();

    const match = log.match(/.*LIGHTHOUSE SCORE:\s+(.*)/);
    if (match) {
      playScoreSound(Number(match[1]));
    }
    log = '';
  });
});

app.get('/reset', (req, res) => {
  exec(`node index.js --reset`, (err, stdout, stderr) => {
    res.status(200).send('reset');
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log('Press Ctrl+C to quit.');
  if (KIOSK_MODE) {
    opn(`http://localhost:${PORT}`, {wait: false});
    opn(`http://localhost:${PORT}?kiosk`, {wait: false});
  }
});
