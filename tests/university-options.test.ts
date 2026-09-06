import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { filterUniversityOptions, listUniversityPrefectures } from "../lib/university-options";

const universities = [
  { id: "hamamatsu", name: "浜松医科大学", prefecture: "静岡県" },
  { id: "nagoya", name: "名古屋大学", prefecture: "愛知県" },
  { id: "nagoya-city", name: "名古屋市立大学", prefecture: "愛知県" },
];

test("university options support normalized name search and prefecture filters", () => {
  assert.deepEqual(
    filterUniversityOptions(universities, { query: " 名古屋 ", prefecture: "" }).map((item) => item.id),
    ["nagoya", "nagoya-city"],
  );
  assert.deepEqual(
    filterUniversityOptions(universities, { query: "", prefecture: "静岡県" }).map((item) => item.id),
    ["hamamatsu"],
  );
  assert.deepEqual(filterUniversityOptions(universities, { query: "札幌", prefecture: "" }), []);
  assert.deepEqual(listUniversityPrefectures(universities), ["愛知県", "静岡県"]);
});

test("registered university seeds contain exactly 50 unique active medical universities", () => {
  const originalSeed = readFileSync(
    join(process.cwd(), "cloudsql/seeds/20260730000001_required_lookups.sql"),
    "utf8",
  );
  const nationalPublicSeed = readFileSync(
    join(process.cwd(), "cloudsql/seeds/20260813000000_national_public_medical_universities.sql"),
    "utf8",
  );
  const tuplePattern = /\('([0-9a-f-]{36})', '([^']+)', '([^']+)', '([^']+)', '([^']+)', true\)/g;
  const rows = [...originalSeed.matchAll(tuplePattern), ...nationalPublicSeed.matchAll(tuplePattern)].map((match) => ({
    id: match[1],
    name: match[2],
    regionCode: match[3],
    prefecture: match[4],
    city: match[5],
  }));

  assert.equal(rows.length, 50);
  assert.equal(new Set(rows.map((row) => row.id)).size, 50);
  assert.equal(new Set(rows.map((row) => row.name)).size, 50);
  assert.ok(rows.every((row) => row.regionCode && row.prefecture && row.city));
  assert.equal(rows.filter((row) => row.name === "浜松医科大学").length, 1);
});

