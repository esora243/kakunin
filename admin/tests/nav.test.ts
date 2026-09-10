import assert from "node:assert/strict";
import test from "node:test";
import { NAV_ITEMS, navItemsForRole } from "../lib/nav";

test("owners see every nav item", () => {
  assert.equal(navItemsForRole("owner").length, NAV_ITEMS.length);
});

test("editors do not see Master Data, Admin Users, or Audit Logs", () => {
  const editorHrefs = navItemsForRole("editor").map((item) => item.href);
  for (const restricted of ["/master-data", "/admin-users", "/audit-logs"]) {
    assert.equal(editorHrefs.includes(restricted), false, `editor should not see ${restricted}`);
  }
});

test("editors see owner-editable launch domains as read-only", () => {
  const editorItems = navItemsForRole("editor");
  for (const href of ["/jobs", "/activities", "/school"]) {
    const item = editorItems.find((entry) => entry.href === href);
    assert.ok(item, `expected editor nav to include ${href}`);
    assert.equal(item?.readOnlyForEditor, true);
  }
});
