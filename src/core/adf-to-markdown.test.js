import { adfToMarkdown, isAdfDoc } from "./adf-to-markdown.js";

const doc = (...content) => ({ type: "doc", version: 1, content });
const p = (...content) => ({ type: "paragraph", content });
const t = (text, ...marks) => (marks.length ? { type: "text", text, marks } : { type: "text", text });
const mark = (type, attrs) => (attrs ? { type, attrs } : { type });
const li = (...content) => ({ type: "listItem", content });
const ul = (...content) => ({ type: "bulletList", content });
const ol = (order, ...content) => ({ type: "orderedList", attrs: { order }, content });
const codeBlock = (language, text) => ({ type: "codeBlock", attrs: { language }, content: [t(text)] });
const cell = (...content) => ({ type: "tableCell", content });
const th = (...content) => ({ type: "tableHeader", content });
const row = (...content) => ({ type: "tableRow", content });
const table = (...content) => ({ type: "table", content });

const md = (adf, options) => adfToMarkdown(adf, options).trimEnd();

// Every case below must satisfy this, so the whitespace rules are enforced
// rather than hoped for.
function expectNormalized(output) {
  if (output !== "") expect(output.endsWith("\n")).toBe(true);

  // Fence interiors are exempt: blank runs and trailing spaces can be
  // significant in code, so only the prose around them is checked.
  const prose = [];
  let inFence = false;
  output.split("\n").forEach((line) => {
    if (/^\s*(`{3,}|~{3,})/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (!inFence) prose.push(line);
  });

  expect(prose.join("\n")).not.toMatch(/\n\n\n/);
  expect(prose.join("\n")).not.toMatch(/[ \t]+$/m);
}

describe("input tolerance", () => {
  it("returns an empty string for empty input", () => {
    expect(adfToMarkdown(null)).toBe("");
    expect(adfToMarkdown(undefined)).toBe("");
    expect(adfToMarkdown({ type: "doc", content: [] })).toBe("");
  });

  it("passes a plain string through", () => {
    expect(adfToMarkdown("  legacy wiki text  ")).toBe("legacy wiki text");
  });

  it("never throws on malformed input", () => {
    expect(adfToMarkdown({ type: "doc", content: "nope" })).toBe("");
    expect(typeof adfToMarkdown({ type: "doc", content: [null, 5] })).toBe("string");
  });

  it("identifies ADF documents", () => {
    expect(isAdfDoc({ type: "doc", content: [] })).toBe(true);
    expect(isAdfDoc("text")).toBe(false);
    expect(isAdfDoc(null)).toBe(false);
    expect(isAdfDoc({ type: "paragraph", content: [] })).toBe(false);
  });
});

describe("paragraphs and headings", () => {
  it("renders a plain paragraph", () => {
    expect(md(doc(p(t("Hello"))))).toBe("Hello");
  });

  it("drops empty paragraphs", () => {
    expect(md(doc(p(t("a")), p(t(" ")), p(t("b"))))).toBe("a\n\nb");
  });

  it("clamps heading levels to six", () => {
    const output = md(doc({ type: "heading", attrs: { level: 7 }, content: [t("Deep")] }));
    expect(output).toBe("###### Deep");
  });

  it("applies headingOffset", () => {
    const adf = doc({ type: "heading", attrs: { level: 1 }, content: [t("Title")] });
    expect(md(adf, { headingOffset: 2 })).toBe("### Title");
  });

  it("renders a hard break as a backslash break", () => {
    expect(md(doc(p(t("a"), { type: "hardBreak" }, t("b"))))).toBe("a\\\nb");
  });
});

describe("escaping", () => {
  it("escapes Markdown syntax characters", () => {
    expect(md(doc(p(t("a*b_c[d]<e>\\f"))))).toBe("a\\*b\\_c\\[d\\]\\<e>\\\\f");
  });

  it("escapes only doubled tildes, so a lone tilde stays readable", () => {
    expect(md(doc(p(t("~5 and ~~x~~"))))).toBe("~5 and \\~\\~x\\~\\~");
  });

  it("escapes ambiguous line starts", () => {
    expect(md(doc(p(t("- not a list"))))).toBe("\\- not a list");
    expect(md(doc(p(t("1. not a list"))))).toBe("\\1. not a list");
  });

  it("leaves pipes alone in prose", () => {
    expect(md(doc(p(t("a | b"))))).toBe("a | b");
  });

  it("normalizes invisible characters", () => {
    expect(md(doc(p(t("a b​"))))).toBe("a b");
  });
});

describe("marks", () => {
  it("puts link outside code so the label survives", () => {
    const adf = doc(p(t("npm test", mark("code"), mark("link", { href: "https://npmjs.com" }))));
    expect(md(adf)).toBe("[`npm test`](https://npmjs.com)");
  });

  it("nests strong, em and link in a fixed order", () => {
    const marks = [mark("strong"), mark("em"), mark("link", { href: "https://x.test" })];
    expect(md(doc(p({ type: "text", text: "text", marks })))).toBe("[**_text_**](https://x.test)");
  });

  it("keeps emphasis delimiters off whitespace", () => {
    expect(md(doc(p(t("bold ", mark("strong")), t("text"))))).toBe("**bold** text");
  });

  it("skips marks on a whitespace-only run", () => {
    expect(md(doc(p(t("a"), t("  ", mark("strong")), t("b"))))).toBe("a  b");
  });

  it("suppresses escaping inside a code mark", () => {
    expect(md(doc(p(t("a*b", mark("code")))))).toBe("`a*b`");
  });

  it("widens the code span when content has backticks", () => {
    expect(md(doc(p(t("a`b", mark("code")))))).toBe("``a`b``");
  });

  it("renders underline, strike and subsup as inline HTML or GFM", () => {
    expect(md(doc(p(t("x", mark("underline")))))).toBe("<u>x</u>");
    expect(md(doc(p(t("x", mark("strike")))))).toBe("~~x~~");
    expect(md(doc(p(t("2", mark("subsup", { type: "sup" })))))).toBe("<sup>2</sup>");
  });

  it("drops the indentation mark without adding leading spaces", () => {
    const output = md(doc(p(t("x", mark("indentation", { level: 2 })))));
    expect(output).toBe("x");
  });

  it("drops colour marks but keeps the content", () => {
    const marks = [mark("textColor", { color: "#ff0000" }), mark("backgroundColor", { color: "#eee" })];
    expect(md(doc(p({ type: "text", text: "red", marks })))).toBe("red");
  });

  it("angle-wraps a link destination containing a space instead of escaping it", () => {
    const adf = doc(p(t("x", mark("link", { href: "https://x.test/a b" }))));
    expect(md(adf)).toBe("[x](<https://x.test/a b>)");
  });
});

describe("lists", () => {
  it("nests an ordered list inside a bullet", () => {
    const adf = doc(ul(li(p(t("Fruit")), ol(1, li(p(t("Apple"))), li(p(t("Banana")))))));
    expect(md(adf)).toBe("- Fruit\n  1. Apple\n  2. Banana");
  });

  it("honours the ordered list start", () => {
    const adf = doc(ol(5, li(p(t("a"))), li(p(t("b"))), li(p(t("c")))));
    expect(md(adf)).toBe("5. a\n6. b\n7. c");
  });

  it("separates multiple paragraphs in one item", () => {
    expect(md(doc(ul(li(p(t("one")), p(t("two"))))))).toBe("- one\n\n  two");
  });

  it("indents a code block inside a bullet item by two", () => {
    const adf = doc(ul(li(p(t("Install:")), codeBlock("js", "npm i\nnpm test"))));
    expect(md(adf)).toBe("- Install:\n\n  ```js\n  npm i\n  npm test\n  ```");
  });

  it("indents a code block inside item 10 by four", () => {
    const adf = doc(ol(10, li(p(t("Step")), codeBlock("", "x"))));
    expect(md(adf)).toBe("10. Step\n\n    ```\n    x\n    ```");
  });

  it("renders task lists as checkboxes", () => {
    const adf = doc({
      type: "taskList",
      content: [
        { type: "taskItem", attrs: { state: "TODO" }, content: [t("a")] },
        { type: "taskItem", attrs: { state: "DONE" }, content: [t("b")] },
      ],
    });
    expect(md(adf)).toBe("- [ ] a\n- [x] b");
  });

  it("labels decision items", () => {
    const adf = doc({
      type: "decisionList",
      content: [{ type: "decisionItem", attrs: { state: "DECIDED" }, content: [t("Ship it")] }],
    });
    expect(md(adf)).toBe("- **Decision:** Ship it");
  });
});

describe("quotes, panels and expands", () => {
  it("keeps a list inside a blockquote", () => {
    const adf = doc({ type: "blockquote", content: [p(t("Note:")), ul(li(p(t("a"))), li(p(t("b"))))] });
    expect(md(adf)).toBe("> Note:\n>\n> - a\n> - b");
  });

  it("nests blockquotes", () => {
    const adf = doc({ type: "blockquote", content: [{ type: "blockquote", content: [p(t("x"))] }] });
    expect(md(adf)).toBe("> > x");
  });

  it("renders a panel as a labelled blockquote", () => {
    const adf = doc({ type: "panel", attrs: { panelType: "warning" }, content: [p(t("Frozen"))] });
    expect(md(adf)).toBe("> **Warning**\n>\n> Frozen");
  });

  it("falls back to Note for an unknown panel type", () => {
    const adf = doc({ type: "panel", attrs: { panelType: "custom" }, content: [p(t("x"))] });
    expect(md(adf)).toBe("> **Note**\n>\n> x");
  });

  it("indents a code block inside a panel", () => {
    const adf = doc({ type: "panel", attrs: { panelType: "info" }, content: [codeBlock("", "x")] });
    expect(md(adf)).toBe("> **Info**\n>\n> ```\n> x\n> ```");
  });

  it("renders an expand as a details block", () => {
    const adf = doc({ type: "expand", attrs: { title: "Steps" }, content: [ol(1, li(p(t("Open"))), li(p(t("Click"))))] });
    expect(md(adf)).toBe("<details><summary>Steps</summary>\n\n1. Open\n2. Click\n\n</details>");
  });

  it("html-escapes the expand title", () => {
    const adf = doc({ type: "expand", attrs: { title: "a<b & c" }, content: [p(t("x"))] });
    expect(md(adf)).toContain("<summary>a&lt;b &amp; c</summary>");
  });

  it("renders a rule without creating a setext heading", () => {
    expect(md(doc(p(t("p1")), { type: "rule" }, p(t("p2"))))).toBe("p1\n\n---\n\np2");
  });
});

describe("code blocks", () => {
  it("tags the fence with the language", () => {
    expect(md(doc(codeBlock("sql", "SELECT 1")))).toBe("```sql\nSELECT 1\n```");
  });

  it("maps language aliases and plain text to no language", () => {
    expect(md(doc(codeBlock("Plaintext", "x")))).toBe("```\nx\n```");
    expect(md(doc(codeBlock("sh", "ls")))).toBe("```bash\nls\n```");
  });

  it("widens the fence when the code contains one", () => {
    expect(md(doc(codeBlock("", "```\nnested")))).toBe("````\n```\nnested\n````");
  });

  it("never escapes code content", () => {
    expect(md(doc(codeBlock("", "a*b_c[d]")))).toBe("```\na*b_c[d]\n```");
  });

  it("converts non-breaking spaces pasted into code", () => {
    expect(md(doc(codeBlock("", "SELECT 1")))).toBe("```\nSELECT 1\n```");
  });
});

describe("tables", () => {
  it("uses a real header row when present", () => {
    const adf = doc(table(row(th(p(t("A"))), th(p(t("B")))), row(cell(p(t("1"))), cell(p(t("2"))))));
    expect(md(adf)).toBe("| A | B |\n| --- | --- |\n| 1 | 2 |");
  });

  it("synthesises an empty header when the table has none", () => {
    const adf = doc(table(row(cell(p(t("a"))), cell(p(t("b")))), row(cell(p(t("c"))), cell(p(t("d"))))));
    expect(md(adf)).toBe("|  |  |\n| --- | --- |\n| a | b |\n| c | d |");
  });

  it("flattens a multi-line code block in a cell", () => {
    const adf = doc(table(row(cell(codeBlock("bash", "npm run build\nnpm test")), cell(p(t("Runs both"))))));
    expect(md(adf)).toContain("| <code>npm run build<br>npm test</code> | Runs both |");
  });

  it("uses a code span for a single-line code block in a cell", () => {
    const adf = doc(table(row(cell(codeBlock("", "npm test")))));
    expect(md(adf)).toContain("| `npm test` |");
  });

  it("flattens a list in a cell", () => {
    const adf = doc(table(row(cell(ul(li(p(t("a"))), li(p(t("b"))))))));
    expect(md(adf)).toContain("| - a<br>- b |");
  });

  it("flattens two paragraphs in a cell", () => {
    const adf = doc(table(row(cell(p(t("x")), p(t("y"))))));
    expect(md(adf)).toContain("| x<br><br>y |");
  });

  it("escapes a pipe even inside a code span", () => {
    const adf = doc(table(row(cell(p(t("a|b", mark("code")))))));
    expect(md(adf)).toContain("| `a\\|b` |");
  });

  it("keeps columns aligned under a colspan", () => {
    const adf = doc(table(
      row({ type: "tableCell", attrs: { colspan: 2 }, content: [p(t("wide"))] }),
      row(cell(p(t("a"))), cell(p(t("b")))),
    ));
    expect(md(adf)).toBe("|  |  |\n| --- | --- |\n| wide |  |\n| a | b |");
  });

  it("keeps columns aligned under a rowspan", () => {
    const adf = doc(table(
      row({ type: "tableCell", attrs: { rowspan: 2 }, content: [p(t("A"))] }, cell(p(t("b1")))),
      row(cell(p(t("b2")))),
    ));
    expect(md(adf)).toBe("|  |  |\n| --- | --- |\n| A | b1 |\n|  | b2 |");
  });
});

describe("inline nodes", () => {
  it("renders a mention using its display text", () => {
    expect(md(doc(p({ type: "mention", attrs: { text: "@Jane Doe", id: "123" } })))).toBe("@Jane Doe");
  });

  it("falls back to the mention id", () => {
    expect(md(doc(p({ type: "mention", attrs: { id: "abc" } })))).toBe("@abc");
  });

  it("renders a date as an ISO day", () => {
    expect(md(doc(p({ type: "date", attrs: { timestamp: "1767225600000" } })))).toBe("2026-01-01");
  });

  it("keeps a malformed date timestamp verbatim", () => {
    expect(md(doc(p({ type: "date", attrs: { timestamp: "later" } })))).toBe("later");
  });

  it("renders a status lozenge as a code span", () => {
    const adf = doc(p({ type: "status", attrs: { text: "In Progress", color: "blue" } }));
    expect(md(adf)).toBe("`[In Progress]`");
  });

  it("prefers real unicode for emoji", () => {
    expect(md(doc(p({ type: "emoji", attrs: { text: "\u{1F604}", shortName: ":smile:" } })))).toBe("\u{1F604}");
    expect(md(doc(p({ type: "emoji", attrs: { shortName: ":party:" } })))).toBe(":party:");
  });

  it("drops placeholder text the author never typed", () => {
    expect(md(doc(p({ type: "placeholder", attrs: { text: "Type here" } })))).toBe("");
  });
});

describe("cards and media", () => {
  it("titles an inline card when data is resolved", () => {
    const adf = doc(p({ type: "inlineCard", attrs: { url: "https://x.test/page", data: { name: "Name" } } }));
    expect(md(adf)).toBe("[Name](https://x.test/page)");
  });

  it("autolinks an unresolved inline card", () => {
    expect(md(doc(p({ type: "inlineCard", attrs: { url: "https://x.test/page" } })))).toBe("<https://x.test/page>");
  });

  it("shortens a same-site issue link to its key", () => {
    const url = "https://site.atlassian.net/browse/OM-410";
    const adf = doc(p({ type: "inlineCard", attrs: { url } }));
    expect(md(adf, { baseUrl: "https://site.atlassian.net" })).toBe(`[OM-410](${url})`);
  });

  it("points unresolved media at the attachments section", () => {
    const media = { type: "media", attrs: { id: "9f0e12ab", type: "file", alt: "shot.png" } };
    const output = md(doc({ type: "mediaSingle", content: [media] }));
    expect(output).toBe("[attachment: shot.png](#attachments) <!-- media id=9f0e12ab type=file -->");
  });

  it("uses the resolver when one is supplied", () => {
    const media = { type: "media", attrs: { id: "abc", type: "file" } };
    const resolveMedia = () => ({ label: "shot.png", href: "https://site/attachment/1", isImage: true });
    const output = md(doc({ type: "mediaSingle", content: [media] }), { resolveMedia });
    expect(output).toBe("![shot.png](https://site/attachment/1)");
  });

  it("embeds an external image directly", () => {
    const media = { type: "media", attrs: { type: "external", url: "https://x.test/a.png", alt: "a" } };
    expect(md(doc({ type: "mediaSingle", content: [media] }))).toBe("![a](https://x.test/a.png)");
  });

  it("renders each file in a media group on its own line", () => {
    const file = (name) => ({ type: "media", attrs: { id: name, type: "file", alt: name } });
    const output = md(doc({ type: "mediaGroup", content: [file("a"), file("b")] }));
    expect(output.split("\n")).toHaveLength(2);
  });
});

describe("robustness", () => {
  it("marks an unknown node but still renders its children", () => {
    const adf = doc({ type: "futureThing", content: [p(t("text"))] });
    expect(md(adf)).toBe("<!-- unsupported: futureThing -->\n\ntext");
  });

  it("emits a comment for an unknown leaf node", () => {
    expect(md(doc({ type: "weird" }))).toBe("<!-- unsupported: weird -->");
  });

  it("unwraps unsupportedBlock via its original value", () => {
    const adf = doc({ type: "unsupportedBlock", attrs: { originalValue: p(t("kept")) } });
    expect(md(adf)).toBe("kept");
  });

  it("flattens transparent layout containers without a marker", () => {
    const adf = doc({
      type: "layoutSection",
      content: [
        { type: "layoutColumn", content: [p(t("left"))] },
        { type: "layoutColumn", content: [p(t("right"))] },
      ],
    });
    expect(md(adf)).toBe("left\n\nright");
  });

  it("stops at the depth guard instead of throwing", () => {
    let node = p(t("deep"));
    for (let index = 0; index < 60; index += 1) {
      node = { type: "blockquote", content: [node] };
    }
    const output = adfToMarkdown(doc(node));
    expect(output).toContain("max nesting depth exceeded");
  });
});

describe("normalization invariant", () => {
  const cases = [
    doc(p(t("a")), p(t("b"))),
    doc(ul(li(p(t("Install:")), codeBlock("js", "npm i\n\n\nnpm test")))),
    doc({ type: "blockquote", content: [p(t("Note:")), ul(li(p(t("a"))))] }),
    doc({ type: "expand", attrs: { title: "T" }, content: [p(t("x"))] }),
    doc(table(row(cell(p(t("a"))), cell(p(t("b")))))),
    doc({ type: "panel", attrs: { panelType: "error" }, content: [codeBlock("", "x  ")] }),
  ];

  it.each(cases.map((adf, index) => [index, adf]))("case %i is normalized", (index, adf) => {
    expectNormalized(adfToMarkdown(adf));
  });

  it("preserves significant whitespace inside a fence", () => {
    const output = adfToMarkdown(doc(codeBlock("", "a   \n\n\nb")));
    expect(output).toBe("```\na   \n\n\nb\n```\n");
  });
});
