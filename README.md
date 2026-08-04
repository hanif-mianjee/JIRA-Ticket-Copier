# JIRA Ticket Copier Chrome Extension

## Overview

A Chrome extension to quickly copy JIRA ticket info (ID, status, title) to your clipboard from any JIRA Cloud ticket page, or export a whole ticket to a Markdown file for an AI coding agent. The extension injects buttons styled to match the JIRA UI, with a dropdown for status selection and robust accessibility.

---

## Features

- Detects JIRA ticket pages (`https://*.atlassian.net/browse/*`)
- Extracts ticket ID, status, and title from the DOM
- Button to copy info in format: `AB-1234: In Progress - Sample ticket title here`
- Git button to copy commit message in format: `AB-1234: Sample ticket title here` (with feedback UI)
- Link button to copy a clickable hyperlink for Slack, Confluence, or Google Docs
- **Export button to download the full ticket as Markdown** — see [Markdown Export](#markdown-export)
- Dropdown for status override (predefined list)
- All buttons styled to match JIRA UI, with rounded corners and consistent sizing
- Accessible, keyboard-friendly, and visually integrated with JIRA
- Feedback text (e.g. "Copied!") is visually distinct with padding for clarity
- Modular, well-documented code (JavaScript, Manifest v3)
- Unit tests for all utility functions (Jest, jsdom)
- Manual build, lint, test, versioning, and packaging workflow (GitHub Actions removed to avoid charges)

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

```text
src/
├── background.js           # Service worker - install/update detection
├── content.js              # Entry point - page detection & button injection
├── content.test.js         # Unit tests
├── utils.js                # Backward-compatible utility exports
├── config/
│   ├── constants.js        # UI text, timings, default status list
│   └── selectors.js        # Page configurations (selectors, buttons)
├── core/
│   ├── clipboard.js        # Clipboard operations & feedback
│   ├── storage.js          # Chrome storage wrapper
│   ├── jira-api.js         # Same-origin Jira REST calls
│   ├── assets.js           # Saves attachments beside the exported file
│   ├── issue-model.js      # REST payload -> normalized ticket
│   ├── issue-dom.js        # Reads the rendered page (reply threading, fallback)
│   ├── adf-to-markdown.js  # ADF -> Markdown, block nodes & public API
│   ├── adf-inline.js       # ADF inline nodes & mark ordering
│   ├── adf-table.js        # ADF tables -> GFM tables
│   ├── markdown-utils.js   # Escaping, indenting, normalization, YAML scalars
│   └── export.js           # File name, document assembly, download, action
├── ui/
│   ├── buttons.js          # Button factory (all button types)
│   ├── dropdown.js         # Status dropdown component
│   ├── icons.js            # SVG icon definitions
│   └── styles.js           # Colors & shared styles
├── icons/                  # Extension icons (16, 48, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── options/                # Extension options/settings page
│   ├── options.html
│   ├── options.css
│   └── options.js
└── welcome/                # Welcome/onboarding page
    ├── welcome.html
    ├── welcome.css
    └── welcome.js

copy-background.mjs         # Build script - copies background worker
copy-icons.mjs              # Build script - copies icons to dist
copy-options.mjs            # Build script - copies options page
copy-welcome.mjs            # Build script - copies welcome page
```

- `dist/` — Build output (content.js, background.js, icons, options, welcome)
- `manifest.json` — Chrome extension manifest (Manifest V3)
- `.versionrc` — Configuration for automated versioning

---

## Adding Support for New JIRA Pages

The extension uses a **config-driven architecture**. To add buttons to a new JIRA page, simply add an entry to `src/config/selectors.js`:

### Single Page (Ticket Detail Style)

```javascript
{
  id: "my-new-page",
  urlPattern: /\/my-url-pattern\//,
  selectors: {
    ticketId: '[data-testid="..."]',     // Element containing ticket ID
    status: '[data-testid="..."]',       // Element containing status
    title: '[data-testid="..."]',        // Element containing title
    container: '[data-testid="..."]',    // Parent container (fallback)
    insertAfter: '[data-testid="..."]',  // Insert buttons after this element
  },
  buttons: ["copyTicketInfo", "statusDropdown", "gitButton", "linkButton"],
  groupId: "my-unique-group-id",
}
```

### List/Board View (Multiple Rows)

```javascript
{
  id: "my-list-page",
  urlPattern: /\/my-list-url\//,
  selectors: {
    row: '[role="row"]',                 // Row selector (triggers list mode)
    ticketId: '[data-testid="..."]',
    title: '[data-testid="..."]',
    status: '[data-testid="..."]',
    buttonContainer: '[data-testid="..."]',
  },
  buttons: ["listLinkButton"],
  buttonClass: "my-list-btn-class",
  settingKey: "enableMyListView",        // Optional: user setting to enable/disable
}
```

### Available Buttons

| Button Name | Description |
|-------------|-------------|
| `copyTicketInfo` | Main copy button (ticket info with status) |
| `statusDropdown` | Dropdown to override status |
| `gitButton` | Copy git commit message format |
| `linkButton` | Copy as hyperlink |
| `exportButton` | Download the full ticket as a Markdown file |
| `listLinkButton` | Compact link button for list views |

**No code changes required** — just add the config entry and rebuild.

---

## Markdown Export

The download button saves the whole ticket as one Markdown file, intended to be handed to an AI coding agent such as Claude Code.

It appears on the two places a ticket is fully rendered:

- a ticket detail page — `https://your-site.atlassian.net/browse/PROJ-1234`
- a board with the ticket preview open — `.../boards/667?selectedIssue=PROJ-1234`

### File name

`{ID}_{Title}.md`, for example `YO-518_DBX_parsing_of_raw_CSV_files.md`. The hyphen inside the key is kept; `&` becomes `and`; spaces, colons and anything unsafe for a file system become a single underscore. Non-Latin titles are preserved. The name is capped at 150 characters.

### Images and attachments

By default the file links back to Jira, and those links need a login — so an AI agent cannot open the ticket's screenshots or files. Turn on **Download attachments** in the extension options and the export also saves every image and file into a folder beside the Markdown:

```text
Downloads/
├── YO-396_TWE_AU_Prediction_and_Harvest_Actual_Dates_Not_Aligned.md
└── YO-396_files/
    ├── image-20260504-055858.png     <- inline image from the description
    ├── screenshot-in-comment.png     <- inline image from a comment
    └── TheYield_Delivery.csv         <- panel attachment
```

Links use the **absolute path on disk**, not a relative one, so the Markdown works from anywhere — you can leave it in `Downloads`, move it into a project, or paste its contents straight into a chat, and the images still resolve:

```markdown
---
attachments_dir: "/Users/you/Downloads/YO-396_files"
---

![image-20260504-055858.png](/Users/you/Downloads/YO-396_files/image-20260504-055858.png)
```

Inline images in the description **and** in comments are rewritten this way, whatever the file type — images, CSV, spreadsheets, anything else. The Attachments table links the saved copy and keeps a `Source` column pointing at Jira. The `attachments_dir` frontmatter key records the folder so an agent can find the rest.

Chrome returns a download id before it has decided on a filename, so the service worker waits for the real path on the first file, then derives the rest from the downloads directory it learned — `conflictAction: "overwrite"` means nothing gets renamed. If the path cannot be determined at all, links fall back to a relative `./PROJ-1234_files/name.png`, which still works as long as the Markdown stays beside the folder.

**When a ticket has attachments but the permission has not been granted**, clicking export opens a dialog listing what was found, with a choice between exporting without them and opening the settings to enable them. It only appears when there is something to download and the permission is missing, and it has a "Don't ask again" option.

This uses an **optional** `downloads` permission, declared in `optional_permissions` so nobody is prompted on install or update. Chrome asks once, when you switch the toggle on; if you decline, the export still works and keeps the Jira links, with a note in the file explaining how to enable it. Files are written with `conflictAction: "overwrite"` inside the ticket's own folder, so re-exporting a ticket refreshes its files instead of accumulating `(1)` copies.

### What ends up in the file

```text
---
key, title, type, status, resolution, url, assignee, reporter, parent,
priority, story_points, sprint, due_date, created, updated, resolved,
labels, components, fix_versions, attachments_dir, exported
---

# PROJ-1234: Ticket title

## Description                 <- rich text converted from ADF
## <each custom rich-text field, labelled from the Jira field name map>
## Other Fields                <- remaining non-empty fields, as a table
## Linked Work Items           <- relationship, key, summary, status
## Child Work Items
## Attachments                 <- file, size, type, upload date, local path, Jira source
## Remote Links                <- Confluence pages and web links
## Comments (n)
### 1. Author — 2026-07-14T09:12:00+10:00
#### ↳ Reply: Author — 2026-07-14T11:04:00+10:00
```

Rich text is converted from Atlassian Document Format, so code blocks keep their language, tables become GitHub-flavoured Markdown tables, and panels, expands, ordered and nested lists, task lists, mentions, dates and status lozenges all survive. Custom fields are discovered from the API's field name map, so no custom field id is hardcoded — an "Acceptance Criteria" field appears under that heading automatically.

### How the data is read

The content script calls your own Jira site over the REST API on the same origin, so your existing browser session authenticates the request and **no additional permission is required** beyond the `https://*.atlassian.net/*` host permission the extension already has:

- `GET /rest/api/3/issue/{key}?fields=*all&expand=names,renderedFields`
- `GET /rest/api/3/issue/{key}/comment?expand=renderedBody` (paged)
- `GET /rest/api/3/issue/{key}/remotelink`

The prose comes from ADF, not from the rendered HTML. `renderedFields` and `renderedBody` are requested for one specific reason: an ADF media node carries only a Media Services id, which does not match the Jira attachment id, and the rendered markup is the only place that id appears next to its file name. That is what lets an inline image be matched to the attachment it came from — including in a comment that is not currently on screen.

Only the issue request is fatal. If comments or remote links fail, the export still runs and records a note in the file. If the issue request itself fails — no session, a restricted issue, no network — the exporter falls back to reading the rendered page and marks the file `export_source: page`.

### Known limits

- **Relative timestamps in a fallback export.** The rendered page shows "5 hours ago" with no machine-readable date, so a fallback export keeps those strings verbatim. A normal export has ISO 8601 timestamps.
- **Attachments are only saved with the optional permission.** Without it, images and files stay as Jira links that need a login. An image whose media id cannot be matched to an attachment gets a reference to the Attachments table instead of a direct link — the file is still on disk if attachment downloading is on.
- **The fallback export saves no attachments.** Reading from the page yields no attachment list, so a degraded export has no Attachments section.
- **Comment threading covers loaded comments.** Jira's comment payload does not reliably expose a parent pointer for threaded replies, so reply nesting is read from the page. Replies to comments outside the loaded window appear as top-level comments.
- **Table fidelity.** ADF tables allow merged cells and block content; Markdown tables do not. Cells are flattened to a single line using `<br>` and `<code>`. Lossy where it has to be, never dropped.
- Legacy `/secure/RapidBoard.jspa?...` board URLs are not matched by any page config, so no buttons appear there. This is pre-existing behaviour.

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
- `testMatch` is `src/**/*.test.js`, so tests can live next to the module they cover
- Page detection and injection are covered in `src/content.test.js`; the exporter is covered by `src/core/*.test.js` (ADF conversion, file naming, document assembly, REST paging, DOM fallback, and the button's loading/feedback states)

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

### 6. Publish a GitHub Release

After running `npm run release` and pushing your tag, you must publish a GitHub Release manually:

1. Go to the "Releases" tab on GitHub
2. Click "Draft a new release" and select the latest tag (e.g., `v0.1.0`)
3. Add release notes (or let GitHub auto-generate them) and publish
4. Optionally attach the built ZIP file from `npm run package`

**To create a release:**

```sh
npm run release
git push --follow-tags
# Then manually create the release on GitHub
```

### 6. (Optional) Manual Quality Checks

**Note:** GitHub Actions workflows have been removed to avoid usage charges. Run these commands manually before releases:

```sh
# Full quality check sequence
npm run lint
npm test  
npm run validate-manifest
npm run build
npm run package
```

**Why Manual?** GitHub Actions charges based on compute minutes. For a Chrome extension project, manual testing is often more cost-effective than automated CI/CD, especially during active development.

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

## Versioning & Release

This project uses [standard-version](https://github.com/conventional-changelog/standard-version) for automated versioning and changelog generation.

### How It Works

`npm run release` automatically:
1. Analyzes git commits since last release
2. Determines version bump (major/minor/patch) based on conventional commits
3. Updates version in `package.json` and `manifest.json`
4. Generates/updates `CHANGELOG.md`
5. Creates git commit and tag

### Usage

```sh
# Automatic version bump based on commits
npm run release

# Manually specify version type
npm run release -- --release-as minor
npm run release -- --release-as major
npm run release -- --release-as 1.0.0

# First release
npm run release -- --first-release

# Dry run (see what would happen)
npm run release -- --dry-run
```

### Commit Message Format

Use [conventional commits](https://www.conventionalcommits.org/) for automatic versioning:

- `feat: add new feature` → **minor** version bump (0.1.0 → 0.2.0)
- `fix: bug fix` → **patch** version bump (0.1.0 → 0.1.1)
- `BREAKING CHANGE:` or `feat!:` → **major** version bump (0.1.0 → 1.0.0)
- `chore:`, `docs:`, `style:` → no version bump

### After Release

```sh
# Push commits and tags to GitHub
git push --follow-tags origin main

# Build and package for Chrome Web Store
npm run package
```

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

See [Project Structure](#project-structure) above for detailed layout.

---

## Developer Checklist Before Release

- [ ] Lint all code (`npm run lint`)
- [ ] Run all unit tests and ensure 100% pass (`npm test`)
- [ ] Validate the manifest and all referenced files (`npm run validate-manifest`)
- [ ] Build the extension (`npm run build`)
- [ ] Bump version and update changelog (`npm run release`)
- [ ] Push tags and publish a GitHub Release (see instructions above)
- [ ] Review the extension in Chrome locally for UI/UX and functionality (including git button feedback and a Markdown export on both a ticket page and a board preview)
- [ ] Only after all above steps, run the packaging step:

  ```sh
  npm run package
  ```

- [ ] Upload the resulting `jira-ticket-copier.zip` to the Chrome Web Store

## Screenshots & Usage

The extension injects a button group into the JIRA ticket page:

- **Copy Ticket Info**: Copies ticket ID, status, and title in the format `AB-1234: In Progress - Sample ticket title here`.
- **Status Dropdown**: Lets you override the status before copying.
- **Git Button**: Copies commit message in the format `AB-1234: Sample ticket title here`. Shows feedback (e.g. "Copied!") with extra padding for clarity.
- **Link Button**: Copies a clickable hyperlink.
- **Export Button**: Downloads the full ticket as Markdown. Shows a spinner while it works, then the usual success or failure feedback.

All UI elements are styled to match JIRA, with rounded corners, consistent height, and spacing. Feedback text is visually distinct.

See `/screenshots/` for example UI.

---

# Privacy & Security

This extension collects no analytics, sends nothing to any third party, and requires no account. Copying and Markdown conversion happen locally in your browser, and your settings are stored in Chrome's own synced storage.

The Markdown export is the only feature that makes a network request: it reads the ticket from **your own JIRA site** over the same-origin REST API, authenticated by the browser session you are already signed in to. No other host is contacted, and the resulting file is written by your browser to your downloads folder.

The `downloads` permission is **optional** and declared under `optional_permissions`, so it is not requested on install or update. It is asked for only if you switch on **Download attachments**, and it is used for one thing: saving that ticket's own images and files into a folder next to the exported Markdown. Declining it leaves every other feature working.

## Contributing

PRs and issues welcome! Please document code and update/add tests for new features.

## License

MIT
