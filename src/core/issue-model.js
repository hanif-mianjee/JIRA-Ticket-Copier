import { adfToMarkdown, isAdfDoc } from "./adf-to-markdown.js";
import { buildMediaFilenameMap, buildMediaFilenameMapFromHtml, buildReplyParentMap } from "./issue-dom.js";

// Fields rendered in their own part of the document, or that carry no value for
// a reader. Everything else is discovered generically from the `names` map, so
// no custom field id is hardcoded anywhere.
const HANDLED_FIELDS = new Set([
  "summary", "description", "issuetype", "status", "resolution", "project",
  "assignee", "reporter", "creator", "priority", "labels", "components",
  "fixVersions", "versions", "parent", "subtasks", "issuelinks", "attachment",
  "comment", "worklog", "duedate", "created", "updated", "resolutiondate",
  "lastViewed", "statuscategorychangedate", "watches", "votes", "progress",
  "aggregateprogress", "aggregatetimeestimate", "aggregatetimeoriginalestimate",
  "aggregatetimespent", "timeestimate", "timeoriginalestimate", "timespent",
  "timetracking", "workratio", "thumbnail", "security", "environment",
]);

const STORY_POINT_LABELS = ["story point estimate", "story points"];
const SPRINT_LABEL = "sprint";

/**
 * Read a ticket's attachments straight from a REST bundle, before the rest of the
 * ticket is built, so they can be downloaded first and linked to locally.
 * @param {Object} bundle - Result of fetchIssueBundle.
 * @returns {Array} Normalized attachments.
 */
export function readBundleAttachments(bundle) {
  const fields = ((bundle || {}).issue || {}).fields || {};
  return readAttachments(fields.attachment);
}

/**
 * Read the key and summary from a REST bundle, falling back to scraped info.
 * @param {Object} bundle - Result of fetchIssueBundle.
 * @param {Object} info - Basic info scraped by the content script.
 * @returns {Object} {key, title}.
 */
export function readBundleIdentity(bundle, info) {
  const issue = (bundle || {}).issue || {};
  const fields = issue.fields || {};
  return {
    key: issue.key || info.ticketId || "",
    title: fields.summary || info.title || "",
  };
}

/**
 * Build the normalized ticket the Markdown writer consumes from a REST bundle.
 * @param {Object} bundle - Result of fetchIssueBundle.
 * @param {Object} info - Basic info scraped by the content script.
 * @param {Object} [config] - Build options.
 * @param {Document|Element} [config.root=document] - Page root, used to resolve media.
 * @param {Map<string, string>} [config.assetPaths] - File name to local path, when attachments were saved.
 * @returns {Object} A normalized ticket.
 */
export function buildTicketFromRest(bundle, info, config = {}) {
  const root = config.root || (typeof document === "undefined" ? null : document);
  const assetPaths = config.assetPaths || null;
  const issue = bundle.issue || {};
  const fields = issue.fields || {};
  const names = bundle.names || {};
  const origin = originOf(info.ticketUrl);
  const attachments = readAttachments(fields.attachment).map((attachment) => ({
    ...attachment,
    localPath: assetPaths ? assetPaths.get(attachment.filename) || "" : "",
  }));
  const options = {
    baseUrl: origin,
    headingOffset: 2,
    resolveMedia: createMediaResolver(attachments, assetPaths, () => collectMediaFilenames(root, issue, bundle.comments)),
  };

  const custom = readCustomFields(fields, names, options);

  return {
    key: issue.key || info.ticketId || "",
    title: fields.summary || info.title || "",
    url: issue.key && origin ? `${origin}/browse/${issue.key}` : info.ticketUrl || "",
    type: nameOf(fields.issuetype),
    status: nameOf(fields.status) || info.status || "",
    resolution: nameOf(fields.resolution),
    assignee: displayNameOf(fields.assignee),
    reporter: displayNameOf(fields.reporter),
    parent: fields.parent ? `${fields.parent.key} ${summaryOf(fields.parent)}`.trim() : "",
    priority: nameOf(fields.priority),
    storyPoints: custom.storyPoints,
    sprint: custom.sprint,
    labels: Array.isArray(fields.labels) ? fields.labels : [],
    components: (fields.components || []).map(nameOf).filter(Boolean),
    fixVersions: (fields.fixVersions || []).map(nameOf).filter(Boolean),
    dueDate: fields.duedate || "",
    created: fields.created || "",
    updated: fields.updated || "",
    resolved: fields.resolutiondate || "",
    sections: buildSections(fields, options, custom.sections),
    otherFields: custom.otherFields,
    links: readLinks(fields.issuelinks, origin),
    children: readChildren(fields.subtasks, origin),
    attachments,
    remoteLinks: readRemoteLinks(bundle.remoteLinks),
    comments: readComments(bundle.comments, options, root),
    degraded: false,
    warnings: bundle.warnings || [],
  };
}

function buildSections(fields, options, customSections) {
  const sections = [];
  const description = adfToMarkdown(fields.description, options);
  if (description) sections.push({ label: "Description", markdown: description });

  const environment = adfToMarkdown(fields.environment, options);
  if (environment) sections.push({ label: "Environment", markdown: environment });

  return sections.concat(customSections);
}

function readCustomFields(fields, names, options) {
  const sections = [];
  const otherFields = [];
  let storyPoints = "";
  let sprint = "";

  Object.keys(fields).forEach((key) => {
    if (HANDLED_FIELDS.has(key)) return;

    const value = fields[key];
    if (isEmptyValue(value)) return;

    const label = names[key] || key;

    if (isAdfDoc(value)) {
      const markdown = adfToMarkdown(value, options);
      if (markdown) sections.push({ label, markdown });
      return;
    }

    const text = coerceValue(value);
    if (text === "") return;

    const normalizedLabel = label.trim().toLowerCase();
    if (STORY_POINT_LABELS.includes(normalizedLabel)) {
      storyPoints = text;
      return;
    }
    if (normalizedLabel === SPRINT_LABEL) {
      sprint = text;
      return;
    }

    otherFields.push({ label, value: text });
  });

  return { sections, otherFields, storyPoints, sprint };
}

/**
 * Turn a Jira field value into readable text. Shapes that are not understood are
 * skipped rather than dumped as raw JSON.
 * @param {*} value - Field value.
 * @returns {string} Readable text, or "" when the shape is not supported.
 */
export function coerceValue(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  if (Array.isArray(value)) {
    return value.map(coerceValue).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    const label = value.value || value.name || value.displayName || value.text;
    return typeof label === "string" ? label.trim() : "";
  }

  return "";
}

function isEmptyValue(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function readAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.map((attachment) => ({
    id: String(attachment.id || ""),
    filename: attachment.filename || "",
    size: Number(attachment.size) || 0,
    mimeType: attachment.mimeType || "",
    url: attachment.content || "",
    created: attachment.created || "",
    author: displayNameOf(attachment.author),
  }));
}

/**
 * Gather media id to file name pairs from every place they appear together.
 * An ADF media node carries only a Media Services id, which does not match the
 * Jira attachment id, so the rendered markup is the only bridge between them.
 * The live page covers the description and any comment on screen; the rendered
 * HTML from the API covers comments that are not.
 */
function collectMediaFilenames(root, issue, comments) {
  const map = new Map();
  const merge = (source) => {
    source.forEach((filename, id) => {
      if (!map.has(id)) map.set(id, filename);
    });
  };

  if (root && typeof root.querySelectorAll === "function") merge(buildMediaFilenameMap(root));

  Object.values(issue.renderedFields || {}).forEach((value) => {
    if (typeof value === "string") merge(buildMediaFilenameMapFromHtml(value));
  });

  (comments || []).forEach((comment) => {
    merge(buildMediaFilenameMapFromHtml(comment.renderedBody));
  });

  return map;
}

/**
 * Resolve an ADF media node to a real attachment by its file name. Prefers the
 * downloaded copy on disk, because a Jira attachment URL needs a login to open.
 */
function createMediaResolver(attachments, assetPaths, getMediaNames) {
  let mediaNames = null;

  return (attrs) => {
    if (!attrs || !attrs.id) return null;
    if (mediaNames === null) mediaNames = getMediaNames();

    const filename = mediaNames.get(attrs.id);
    if (!filename) return null;

    const local = assetPaths ? assetPaths.get(filename) : "";
    const match = attachments.find((attachment) => attachment.filename === filename);
    if (!match) return local ? { label: filename, href: local } : { label: filename };

    return {
      label: filename,
      href: local || match.url,
      isImage: match.mimeType.startsWith("image/"),
    };
  };
}

function readLinks(issuelinks, origin) {
  if (!Array.isArray(issuelinks)) return [];

  return issuelinks
    .map((link) => {
      const type = link.type || {};
      const target = link.outwardIssue || link.inwardIssue;
      if (!target) return null;

      return {
        relationship: link.outwardIssue ? type.outward || "relates to" : type.inward || "relates to",
        key: target.key || "",
        summary: summaryOf(target),
        status: nameOf((target.fields || {}).status),
        url: target.key && origin ? `${origin}/browse/${target.key}` : "",
      };
    })
    .filter(Boolean);
}

function readChildren(subtasks, origin) {
  if (!Array.isArray(subtasks)) return [];
  return subtasks.map((task) => ({
    key: task.key || "",
    summary: summaryOf(task),
    status: nameOf((task.fields || {}).status),
    url: task.key && origin ? `${origin}/browse/${task.key}` : "",
  }));
}

function readRemoteLinks(remoteLinks) {
  if (!Array.isArray(remoteLinks)) return [];
  return remoteLinks
    .map((link) => {
      const object = link.object || {};
      return {
        relationship: link.relationship || "relates to",
        title: object.title || object.url || "",
        url: object.url || "",
      };
    })
    .filter((link) => link.url);
}

function readComments(comments, options, root) {
  if (!Array.isArray(comments)) return [];

  const domParents = root && typeof root.querySelectorAll === "function" ? buildReplyParentMap(root) : new Map();
  const ids = new Set(comments.map((comment) => String(comment.id)));

  return comments.map((comment) => {
    const id = String(comment.id);
    // Jira's comment payload does not reliably expose a parent pointer for
    // threaded replies, so the rendered page fills the gap. That means threading
    // only covers comments currently loaded on the page.
    const parentId = comment.parentId ? String(comment.parentId) : domParents.get(id) || null;

    return {
      id,
      author: displayNameOf(comment.author),
      created: comment.created || "",
      updated: comment.updated || "",
      edited: Boolean(comment.updated && comment.created && comment.updated !== comment.created),
      markdown: adfToMarkdown(comment.body, options),
      parentId: parentId && ids.has(parentId) ? parentId : null,
    };
  });
}

function nameOf(value) {
  return value && typeof value === "object" && value.name ? String(value.name) : "";
}

function summaryOf(issue) {
  const fields = (issue && issue.fields) || {};
  return fields.summary ? String(fields.summary) : "";
}

function displayNameOf(user) {
  if (!user || typeof user !== "object") return "";
  const name = user.displayName || user.name || "";
  return user.active === false && name ? `${name} (inactive)` : name;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return typeof window !== "undefined" && window.location ? window.location.origin : "";
  }
}
