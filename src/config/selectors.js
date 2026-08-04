export const PAGE_CONFIGS = [
  {
    id: "board-view",
    urlPattern: /\/boards\//,
    selectors: {
      row: "[data-testid=\"platform-board-kit.ui.card.card\"]",
      ticketId: "[data-testid=\"platform-card.common.ui.key.key\"] a",
      title: "[data-testid=\"issue-field-single-line-text-readview-card.ui.single-line-text.container.box\"]",
      status: "[data-testid=\"platform-card.common.ui.custom-fields.card-custom-field.text-card-custom-field-content.field\"]",
      buttonContainer: "[data-testid=\"platform-card.ui.card.card-content.footer\"] > div > div:first-child",
    },
    buttons: ["listLinkButton"],
    buttonClass: "jira-list-copy-link-btn",
    settingKey: "enableListView",
  },
  {
    id: "release-view",
    urlPattern: /\/versions\/.*\/tab\//,
    selectors: {
      row: "[data-testid=\"software-releases-version-detail-issue-list.ui.issues.issue-card\"]",
      ticketId: "img + span",
      title: "[role=\"presentation\"] div",
      status: "[data-testid=\"common-components-status-lozenge.status-lozenge--text\"]",
      buttonContainer: "[role=\"presentation\"]",
    },
    buttons: ["listLinkButton"],
    buttonClass: "jira-list-copy-link-btn",
    settingKey: "enableListView",
  },
  {
    id: "ticket-detail",
    urlPattern: /\/browse\/|\/issues\/|\/jira\/software\/|\/projects\//,
    selectors: {
      ticketId: "[data-testid=\"issue.views.issue-base.foundation.breadcrumbs.current-issue.item\"]",
      status: "[data-testid=\"issue-field-status.ui.status-view.status-button.status-button\"]",
      title: "[data-testid='issue.views.issue-base.foundation.summary.heading']",
      container: "[data-testid='issue.views.issue-base.foundation.status.status-field-wrapper']",
      insertAfter: "[data-testid='issue.views.issue-base.foundation.breadcrumbs.breadcrumb-current-issue-container']",
    },
    buttons: ["copyTicketInfo", "statusDropdown", "gitButton", "linkButton", "exportButton"],
    groupId: "jira-ticket-copier-group",
  },
  {
    id: "list-view",
    urlPattern: /\/jira\/software\/|\/issues\/|\/projects\//,
    excludePattern: /\/boards\/|\/versions\/.*\/tab\//,
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

// Selectors used by the Markdown exporter to read the rendered issue view.
export const EXPORT_SELECTORS = {
  commentItem: "[data-testid^=\"comment-base-item-\"]",
  commentIdPrefix: "comment-base-item-",
  replyWrapper: "section[data-testid=\"issue-view-activity-comment.comment-reply-wrapper.reply-container\"]",
  commentHeader: "[data-testid^=\"issue-comment-base.ui.comment.ak-comment.\"][data-testid$=\"-header\"]",
  commentBody: "[data-testid^=\"issue-comment-base.ui.comment.ak-comment.\"][data-testid$=\"-body\"]",
  commentAuthor: "h3",
  relativeTime: "[data-testid=\"issue-timestamp.relative-time\"]",
  editedFlag: "[data-testid=\"issue-comment-base.ui.comment.ak-tool-tip--container\"]",
  renderedBody: ".ak-renderer-document",
  description: "[data-testid=\"issue.views.field.rich-text.description\"]",
  issueTypeButton: "[data-testid=\"issue.views.issue-base.foundation.change-issue-type.button\"]",
  // The rendered media node is the only place the media UUID and the file name
  // appear together, which is what lets media be matched to a real attachment.
  mediaNode: "[data-node-type=\"media\"][data-file-name], [data-node-type=\"mediaInline\"][data-file-name]",
};
