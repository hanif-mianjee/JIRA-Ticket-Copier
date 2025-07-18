# JIRA Ticket Copier Chrome Extension

## Overview

A Chrome extension to quickly copy JIRA ticket info (ID, status, title) to your clipboard from any JIRA Cloud ticket page. The extension injects a button styled to match the JIRA UI, with a dropdown for status selection and robust accessibility.

---

## Features

- Detects JIRA ticket pages (`https://*.atlassian.net/browse/*`)
- Extracts ticket ID, status, and title from the DOM
- Button to copy info in format: `AB-1234: In Progress - Sample ticket title here`
- Dropdown for status override (predefined list)
- Accessible, keyboard-friendly, and visually integrated with JIRA
- Modular, well-documented code (JavaScript, Manifest v3)
- Unit tests for all utility functions (Jest, jsdom)
- Automated build and packaging workflow

---

## Development Setup

### Prerequisites

- Node.js v23.1.0 or later
- npm v10.9.0 or later

### Install Dependencies

```sh
npm install
```

### Project Structure

- `src/` — Source code (content script, utils, icons)
- `dist/` — Build output (content.js, icons)
- `manifest.json` — Chrome extension manifest
- `copy-icons.mjs` — Script to copy icons to dist/
- `README.md`, `packaging_instructions.txt` — Documentation

---

## Build & Test Workflow

### Build the Extension

This bundles the content script and copies icons to `dist/icons/`:

```sh
npm run build
```

- Output: `dist/content.js` and `dist/icons/`
- Manifest references all assets from `dist/`

### Run Unit Tests

```sh
npm test
```

- Tests use Jest and jsdom
- All utility functions are covered in `src/content.test.js`

---

## Chrome Extension Development

1. Build the extension:

   ```sh
   npm run build
   ```

2. Open `chrome://extensions` in Chrome.
3. Enable Developer Mode.
4. Click "Load unpacked" and select the project root folder (must include `manifest.json` and `dist/`).
5. Open a JIRA ticket page to test the button.
6. Use DevTools Console for debug output.

---

## Packaging for Chrome Web Store

1. Build the extension:

   ```sh
   npm run build
   ```

2. Create a ZIP archive with only the following:

   - `manifest.json`
   - `dist/` (contains `content.js` and `icons/`)
   - `README.md` (optional)
   - `packaging_instructions.txt` (optional)

   Example:

   ```sh
   zip -r jira-ticket-copier.zip manifest.json dist/ README.md packaging_instructions.txt
   ```

3. Upload the ZIP to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
4. Fill out extension details, upload icons/screenshots, and submit for review.

---

## Post-Submission & Next Steps

- After submission, document reviewer feedback and any required changes in `instruction.txt`.
- Note any bugs or user suggestions from initial usage.
- Plan next improvements (e.g., context menu support, options page, localization).

---

## File Structure (Summary)

- `manifest.json` — Chrome extension manifest
- `src/content.js` — Content script (injects button, handles copy)
- `src/utils.js` — Utility functions (DOM extraction, formatting)
- `src/icons/` — Source icons (copied to `dist/` during build)
- `dist/` — Build output (content.js, icons)
- `README.md` — Dev/test/packaging guide
- `.gitignore` — Ignore dev/prod artifacts

---

## Contributing

PRs and issues welcome! Please document code and update/add tests for new features.

## License

MIT
