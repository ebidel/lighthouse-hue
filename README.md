[Lighthouse](https://github.com/GoogleChrome/lighthouse) changing the color
of Philips Hue light bulbs based on overall report score.

### Get started

`yarn install`

### Run it

```
node index.js <URL>
node index.js --view <URL>
node index.js --output=json --output-path=results.json <URL>
```

Testing a site should launch Chrome and run Lighthouse against the URL.

**Note:** You can update `USERNAME` in index.js with a username registered on the Hue Bridge. If you don't have a username,
first press the Link Button on the Hue Bridge, then run the app. Doing so will create "Lighthouse" user on the bridge.
