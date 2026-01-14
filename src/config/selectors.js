export const STATUS_LIST = [
  "Waiting for Input",
  "Released",
  "Analysis",
  "In Review",
  "PR Raised",
  "Analysis/Comment added",
  "Blocked",
  "Blocked/Comment added",
  "Blocked/Waiting for Input",
  "Waiting for Input",
  "Review suggestions applied",
];

export const PAGE_CONFIGS = [
  {
    id: "ticket-detail",
    urlPattern: /\/browse\/|\/issues\//,
    selectors: {
      ticketId: "[data-testid=\"issue.views.issue-base.foundation.breadcrumbs.current-issue.item\"]",
      status: "[data-testid=\"issue-field-status.ui.status-view.status-button.status-button\"]",
      title: "[data-testid='issue.views.issue-base.foundation.summary.heading']",
      container: "[data-testid='issue.views.issue-base.foundation.status.status-field-wrapper']",
      insertAfter: "[data-testid='issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container']",
    },
    buttons: ["copyTicketInfo", "statusDropdown", "gitButton", "linkButton"],
    groupId: "jira-ticket-copier-group",
  },
  {
    id: "list-view",
    urlPattern: /\/jira\/software\//,
    selectors: {
      row: "[role=\"row\"], .BaseTable__row",
      ticketId: "[data-testid=\"business-list.ui.list-view.key-cell.issue-key\"]",
      title: "[data-testid=\"business-list.ui.list-view.summary-cell\"]",
      status: "[data-testid=\"business-list.ui.list-view.status-cell.cell-container\"]",
      buttonContainer: "[data-testid=\"business-list.ui.list-view.text-cell.text-cell-wrapper\"]",
    },
    buttons: ["listLinkButton"],
    buttonClass: "jira-list-copy-link-btn",
    settingKey: "enableListView",
  },
];
