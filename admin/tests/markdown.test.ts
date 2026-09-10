import assert from "node:assert/strict";
import test from "node:test";
import { renderSanitizedContentHtml } from "../lib/markdown";

test("renders headings, paragraphs, lists, links, emphasis, and images", async () => {
  const html = await renderSanitizedContentHtml(
    [
      "# Heading",
      "",
      "A **bold** and *italic* paragraph with a [link](https://example.com).",
      "",
      "- one",
      "- two",
      "",
      "> a quote",
      "",
      "![alt text](https://example.com/image.png)",
    ].join("\n"),
  );

  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
  assert.match(html, /<a href="https:\/\/example.com">link<\/a>/);
  assert.match(html, /<li>one<\/li>/);
  assert.match(html, /<blockquote>/);
  assert.match(html, /<img src="https:\/\/example.com\/image.png" alt="alt text">/);
});

test("strips raw HTML the author typed, including script/iframe/style/event handlers", async () => {
  const html = await renderSanitizedContentHtml(
    [
      "<script>alert(1)</script>",
      "<iframe src=\"https://evil.example\"></iframe>",
      "<style>body{display:none}</style>",
      "<img src=\"https://example.com/x.png\" onerror=\"alert(2)\">",
      "<div onclick=\"alert(3)\">click me</div>",
      "",
      "Still renders normal text.",
    ].join("\n"),
  );

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /<style/i);
  assert.doesNotMatch(html, /onerror/i);
  assert.doesNotMatch(html, /onclick/i);
  assert.doesNotMatch(html, /<div/i);
  assert.match(html, /Still renders normal text\./);
});

test("drops non-https link and image protocols", async () => {
  const html = await renderSanitizedContentHtml(
    "[bad](javascript:alert(1))\n\n![bad](http://example.com/insecure.png)",
  );

  assert.doesNotMatch(html, /javascript:/i);
  assert.doesNotMatch(html, /http:\/\/example.com/);
});
