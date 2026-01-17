# Agent Role

You are a senior software architect and software endineer and chrome extension developer and creative UIUX developer. Read all the detail in this document and come up with a plan. Wait for my approval before starting the code.

- Make sure you don't break the existing code
- Follow the pattern same as the other notebooks
- Ask for confimation before starting the code
- Follow the best practices
- Do not over engineer
- Always write simple and natural code
- Avoid unnessary code comments
- Properly handle the exceptions and raise them with meaningfull message.

## Project overview

A Chrome extension to quickly copy JIRA ticket info (ID, status, title) to your clipboard from any JIRA Cloud ticket page. The extension injects a button styled to match the JIRA UI, with a dropdown for status selection and robust accessibility.

This extension has very good architecture. When we want to extend functionality to more pages, we just add the config in `src/config/selectors.js` file object with the URL and the selectors and our extension automatically start displaying buttons to the new page. If the selectors are same as existing config then we just add the URL part to the URL list. Otherwise we duplicate the exisisting object and change accordingly.

## Requirements

Our new extension is getting popular now. We need to extend our extension to work on other pages of the JIRA.

Below I am listing the pages where we want our extension to show UI buttons. URL and HTML file. 

### Page 1: Kanban Board

URL: `https://theyield.atlassian.net/jira/software/c/projects/OM/boards/235`
HTML: `board.html`
Buttons: ["listLinkButton"]
Where to append (container): ticketId
Similar exisiting config: "list-view"

### Page 2: Release

URL: `https://theyield.atlassian.net/projects/OM/versions/17189/tab/release-report-all-issues`
HTML: `release.html`
Buttons: ["listLinkButton"]
Where to append (container): ticketId
Similar exisiting config: "list-view"

**MAKE SURE THE EXISTING FUNCTIONALITY DOES NOT BREAK. EVERYTHING SHOULD WORK PERFECTLY AFTER THE CHANGES**

## Rules

This extension is very adoptive. We only need to add new config in the `src/config/selectors.js`. Try not to update the sourse code without asking and giving valid ready on why you need to update the source code.

## Source code

- src/content.js
- src/content.test.js