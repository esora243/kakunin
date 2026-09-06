// No "server-only" marker here: this is a pure Markdown->sanitized-HTML
// transform with no secrets or DB access, and is unit tested directly.

import { marked } from "marked";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";
import rehypeStringify from "rehype-stringify";

// Launch body storage is Markdown; raw HTML input is not allowed and the
// rendered output is sanitized to a limited feature set before display, per
// docs/admin-management-app-spec.md "Body format".

const ALLOWED_TAG_NAMES = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "em",
  "blockquote",
  "img",
  "br",
  "hr",
  "code",
  "pre",
];

const SANITIZE_SCHEMA: Schema = {
  tagNames: ALLOWED_TAG_NAMES,
  attributes: {
    a: ["href", "title"],
    img: ["src", "alt", "title"],
  },
  protocols: {
    href: ["https"],
    src: ["https"],
  },
};

const renderer = new marked.Renderer();
// Strip any raw HTML the author typed — only Markdown syntax is rendered.
renderer.html = () => "";

marked.setOptions({ renderer, gfm: true, breaks: false });

export async function renderSanitizedContentHtml(bodyMd: string): Promise<string> {
  const rawHtml = await marked.parse(bodyMd ?? "", { async: true });
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize, SANITIZE_SCHEMA)
    .use(rehypeStringify)
    .process(rawHtml);
  return String(file);
}
