// Unit tests for utils.js
// Run with Jest or similar framework

import { extractJiraTicketInfo, formatJiraString } from "./utils";

describe("formatJiraString", () => {
  it("formats correctly", () => {
    const input = {
      ticketId: "AB-1234",
      status: "In Progress",
      title: "Sample ticket title here",
    };
    expect(formatJiraString(input)).toBe(
      "AB-1234: In Progress - Sample ticket title here"
    );
  });
});

describe("extractJiraTicketInfo", () => {
  it("returns empty strings if elements not found", () => {
    document.body.innerHTML = "";
    expect(extractJiraTicketInfo()).toEqual({
      ticketId: "",
      status: "",
      title: "",
    });
  });
  it("extracts info from DOM", () => {
    document.body.innerHTML = `
      <span data-test-id="issue.views.issue-base.issue-header.issue-key">AB-1234</span>
      <span data-test-id="issue.views.issue-base.status.status-field">In Progress</span>
      <h1 data-test-id="issue.views.issue-base.summary.heading">Sample ticket title here</h1>
    `;
    expect(extractJiraTicketInfo()).toEqual({
      ticketId: "AB-1234",
      status: "In Progress",
      title: "Sample ticket title here",
    });
  });
});
