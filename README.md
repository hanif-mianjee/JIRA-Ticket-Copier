# JIRA Ticket Copier Chrome Extension

## Overview

This extension adds a button to JIRA ticket pages (cloud interface) that copies the ticket ID, status, and title to your clipboard in the format:

`AB-1234: In Progress - Sample ticket title here`

## Features

- Detects JIRA ticket pages (`https://*.atlassian.net/browse/*`)
- Extracts ticket ID, status, and title from the DOM
- Injects a button into the JIRA UI to copy info to clipboard
- Clean, modular code (JavaScript, manifest v3)
- Unit tests for utility functions
- Styling blends with JIRA UI

## Dev/Test Setup

1. Clone this repo.

2. Run unit tests:

   - Install dependencies: `npm install jest @babel/preset-env --save-dev`
   - Add to `package.json`:

     ```json
     "scripts": {
       "test": "jest"
     },
     "jest": {
       "testEnvironment": "jsdom",
       "transform": {}
     }
     ```

   - Run: `npm test`

3. Load extension in Chrome:
   - Go to `chrome://extensions`
   - Enable Developer Mode
   - Click "Load unpacked" and select this folder
   - Open a JIRA ticket page to test

## Packaging for Chrome Web Store

- Zip the entire extension folder (excluding test files)
- Submit to Chrome Web Store

## File Structure

- `manifest.json` — Chrome extension manifest
- `src/content.js` — Content script (injects button, handles copy)
- `src/background.js` — Background script (required for v3)
- `src/utils.js` — Utility functions (DOM extraction, formatting)
- `src/utils.test.js` — Unit tests
- `src/icons/` — Extension icons

## License

MIT
