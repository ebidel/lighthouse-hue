[Lighthouse](https://github.com/GoogleChrome/lighthouse) changing the color
of [Philips Hue](https://www.developers.meethue.com/philips-hue-api) light bulbs
based on overall report score.

### Get started

`yarn install`

### Run it

Create a `.hueusername` in the root folder and fill it with a username
registered on your Hue Bridge. If you don't have a username:

1. press the Link Button on the Hue Bridge
2. run the app (below). Doing so will create a "Lighthouse" user on the bridge.

```
node index.js <URL>
node index.js --view <URL>
node index.js --output=json --output-path=results.json <URL>
```

You can also run the UI version which starts a web server on http://localhost:8080:

    yarn start

Both ways should should launch Chrome and run Lighthouse against the URL that you input.
