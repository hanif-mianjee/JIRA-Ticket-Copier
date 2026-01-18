// UI Text Constants - Centralized for easy maintenance
export const BUTTON_TEXT = {
  copyTicketInfo: "Copy Info",
  copied: "✓ Copied!",
  failed: "✗ Failed",
  statusNotFound: "No status found",
};

// Feedback timing (in milliseconds)
export const FEEDBACK_TIMING = {
  success: 1200,
  error: 1800,
};

// Debounce timing for MutationObserver (in milliseconds)
export const OBSERVER_DEBOUNCE_MS = 150;

// Default status list for dropdown - single source of truth
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
  "Review suggestions applied",
];
