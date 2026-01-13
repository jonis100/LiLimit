# <img src="https://raw.githubusercontent.com/jonis100/LiLimit/main/public/images/lily.png" alt="LiLimit Logo" width="40" height="40" style="vertical-align: middle;"> LiLimit

![Chrome Web Store](https://img.shields.io/chrome-web-store/v/opbckjpgnijalnbanlpgaolmegdmajob?label=Chrome%20Web%20Store) ![Chrome Web Store Downloads](https://img.shields.io/chrome-web-store/users/opbckjpgnijalnbanlpgaolmegdmajob?label=Downloads) ![Node Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen) ![Tests](https://github.com/jonis100/LiLimit/actions/workflows/ci.yml/badge.svg)

![LiLimit Welcome](https://raw.githubusercontent.com/jonis100/LiLimit/main/public/images/welcomePadded.png)

A Chrome extension to control your time online by limiting time spent and daily visits to any website.

## Installation

### Chrome Web Store

Install directly from the [Chrome Web Store](https://chrome.google.com/webstore/detail/lilimit/opbckjpgnijalnbanlpgaolmegdmajob).

### Manual Installation

1. Download and extract the source code from [GitHub](https://github.com/jonis100/LiLimit)
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Navigate to `chrome://extensions/` and enable Developer mode
5. Click "Load unpacked" and select the `dist` folder from the built project

## Features

- **Daily Visit Limits**: Set maximum visits per day (resets daily at midnight)
- **Time Limits**: Limit time per visit (tracked while tab is open, even if inactive)
- **Flexible Configuration**: Set time limits only, visit limits only, or both
- **Manage Limits**: Add, update, or delete limits for any website
- **View Dashboard**: See all configured limits at a glance

## Usage

### Visit Limit Demo

![Demonstration of the visit limit feature](https://raw.githubusercontent.com/jonis100/LiLimit/main/public/demo/VisitLimit.gif)

### Time Limit Demo

![Demonstration of the time limit feature](https://raw.githubusercontent.com/jonis100/LiLimit/main/public/demo/TimeLimit.gif)

### Setting Limits

1. Click the LiLimit icon in the extension bar
2. Enter the website URL
3. Set desired time limit per visit (optional)
4. Set desired visits per day (optional)
5. Click "Set Limits"

### Managing Limits

- **Update**: Repeat the steps above for an existing website
- **Delete**: Enter the website URL and click "Delete Limits"
- **View All**: Click "Show Limits" to see all configured limits

## License

MIT

**Free Software**
