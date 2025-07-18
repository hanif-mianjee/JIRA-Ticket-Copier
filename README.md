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
- Automated build, lint, test, versioning, and packaging workflow

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

## Build, Test, and Release Workflow

### 1. Lint Code

```sh
npm run lint      # Check code quality
```

### 2. Run Unit Tests

```sh
npm test
```

- Tests use Jest and jsdom
- All utility functions are covered in `src/content.test.js`

### 3. Validate Manifest

```sh
npm run validate-manifest
```

- Checks manifest fields and referenced files

### 4. Build the Extension

```sh
npm run build
```

- Bundles content script and copies icons to `dist/icons/`
- Manifest references all assets from `dist/`

### 5. Versioning & Changelog

```sh
npm run release
```

- Uses standard-version to bump versions in `package.json`, `manifest.json`, and `package-lock.json`
- Generates/updates `CHANGELOG.md`

### 6. (Optional) Continuous Integration

- GitHub Actions workflow runs lint, test, build, and packaging on every push/PR
- Produces distributable ZIP as an artifact

### 7. Package for Chrome Web Store (Final Step)

```sh
npm run package
```

- Builds and creates `jira-ticket-copier.zip` with only the required files:
  - `manifest.json`
  - `dist/` (contains `content.js` and `icons/`)
  - `README.md` (optional)
  - `packaging_instructions.txt` (optional)

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

## Developer Checklist Before Release

- [ ] Lint all code (`npm run lint`)
- [ ] Run all unit tests and ensure 100% pass (`npm test`)
- [ ] Validate the manifest and all referenced files (`npm run validate-manifest`)
- [ ] Build the extension (`npm run build`)
- [ ] Bump version and update changelog (`npm run release`)
- [ ] Review the extension in Chrome locally for UI/UX and functionality
- [ ] Only after all above steps, run the packaging step:

  ```sh
  npm run package
  ```

- [ ] Upload the resulting `jira-ticket-copier.zip` to the Chrome Web Store

---

## Contributing

PRs and issues welcome! Please document code and update/add tests for new features.

## License

MIT
