# Display Development Server
[![npm-version](https://img.shields.io/npm/v/@whoisxavier/display-dev-server)](https://www.npmjs.com/package/@whoisxavier/display-dev-server)
[![npm-downloads](https://img.shields.io/npm/dm/@whoisxavier/display-dev-server)](https://www.npmjs.com/package/@whoisxavier/display-dev-server)

**x-code.studio Display Development Server** - Build and develop display ads with ease.

## Installation

```sh
yarn add @whoisxavier/display-dev-server
```

```sh
npm i @whoisxavier/display-dev-server
```

## Basic Usage

```js
// for building
dds --mode production

// for developing
dds --mode development
```

The easiest way to get started is by using the yeoman template [@whoisxavier/generator-display-boilerplate](https://github.com/xaviergdiez/generator-display-boilerplate)

## Documentation

Refer to your project documentation for setup and usage instructions.

## 🆕 Latest Updates (v11.8.0)
### Enhanced Animation Controls
- ⌨️ Keyboard Controls
  - `Space` - Play/Pause animations
  - `R` - Reload all visible banners
  - `→` - Skip to end frame
  - `.` - Forward 250ms
- 🖱 Mouse click support for play/pause
- ⏱ Animation time tracker
- ⚙️ Configurable controls visibility via `controlsOff` setting

### Configuration
```javascript
{
  // Hide visual controls while maintaining keyboard shortcuts
  controlsOff: false
}

## Contribute

View [CONTRIBUTING.md](./CONTRIBUTING.md)

## LICENSE

[MIT](./LICENSE) © x-code.studio

Based on the original work by MediaMonks (MIT License)
