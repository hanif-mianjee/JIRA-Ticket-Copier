# JIRA Ticket Copier Chrome Extension

## Overview

Copy JIRA ticket info (ID, status, title) to clipboard from ticket pages. Button blends with JIRA UI and works on JIRA cloud (`https://*.atlassian.net/browse/*`).

## Features

- Detects JIRA ticket pages
- Extracts ticket ID, status, and title from DOM
- Button to copy info in format: `AB-1234: In Progress - Sample ticket title here`
- Clean, modular code (JavaScript, manifest v3)
- Unit tests for utility functions (Jest)
- Dev/prod ready structure

## Development Environment Setup

### Prerequisites

- Node.js v23.1.0
- npm v10.9.0

### Installation

```sh
npm install
```

## Running Unit Tests

```sh
npm test
```

Tests use Jest and jsdom. See `src/utils.test.js` for coverage.

## Chrome Extension Development

1. Open `chrome://extensions` in Chrome.
2. Enable Developer Mode.
3. Click "Load unpacked" and select this folder.
4. Open a JIRA ticket page to test the button.
5. Use DevTools Console for debug output.

## Packaging for Chrome Web Store

1. Clean up: remove test files, `.DS_Store`, etc.
2. Run:

   ```sh
   zip -r jira-ticket-copier.zip manifest.json src/ README.md packaging_instructions.txt
   zip -d jira-ticket-copier.zip src/utils.test.js src/.DS_Store src/icons/.DS_Store
   ```

3. Submit ZIP to Chrome Web Store.

## Publishing

1. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
2. Upload ZIP, fill out details, add icons/screenshots.
3. Submit for review.
4. Record feedback and update code as needed.

## File Structure

- `manifest.json` — Chrome extension manifest
- `src/content.js` — Content script (injects button, handles copy)
- `src/background.js` — Background script (required for v3)
- `src/utils.js` — Utility functions (DOM extraction, formatting)
- `src/icons/` — Extension icons
- `README.md` — Dev/test/packaging guide
- `.gitignore` — Ignore dev/prod artifacts

## Contributing

PRs and issues welcome! Please document code and update tests.

## License

MIT
