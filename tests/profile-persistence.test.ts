import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("profile save uses an app-owned Cloud SQL transaction", () => {
  const source = readFileSync(join(process.cwd(), "lib/users.ts"), "utf8");

  assert.match(source, /dbTransaction/);
  assert.match(source, /update users/);
  assert.match(source, /delete from user_club_memberships/);
  assert.match(source, /insert into user_club_memberships/);
  assert.match(source, /delete from user_desired_specialties/);
  assert.match(source, /insert into user_desired_specialties/);
  assert.doesNotMatch(source, /rpc\/update_liff_profile/);
});

test("Cloud SQL schema preserves transactional relation constraints for profile data", () => {
  const schema = readFileSync(join(process.cwd(), "cloudsql/baseline/20260730000000_schema.sql"), "utf8");

  assert.match(schema, /UNIQUE \(user_id, club_id\)/);
  assert.match(schema, /UNIQUE \(user_id, specialty_id\)/);
  assert.match(schema, /UNIQUE \(user_id\)/);
  assert.match(schema, /FOREIGN KEY \(university_id\) REFERENCES public\.universities\(id\)/);
});
