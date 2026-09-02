import assert from "node:assert/strict";
import test from "node:test";
import {
  listActivityKindsWithReferenceCounts,
  listContentCategoriesWithReferenceCounts,
  listEmploymentTypesWithReferenceCounts,
  listJobCategoriesWithReferenceCounts,
} from "../lib/master-data";

type QueryCall = { text: string; values?: readonly unknown[] };

function fakeQuery(rows: object[]) {
  const calls: QueryCall[] = [];
  const query = async <T extends object>(text: string, values?: readonly unknown[]) => {
    calls.push({ text, values });
    return { rows: rows as T[] };
  };
  return { query, calls };
}

const timestamps = {
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-02T00:00:00.000Z",
};

test("content category aggregate list maps counts and uses one active-only LEFT JOIN query", async () => {
  const { query, calls } = fakeQuery([
    {
      code: "career",
      name: "Career",
      display_order: 1,
      is_active: true,
      reference_count: "2",
      ...timestamps,
    },
    {
      code: "unused",
      name: "Unused",
      display_order: 2,
      is_active: false,
      reference_count: "0",
      ...timestamps,
    },
  ]);

  const result = await listContentCategoriesWithReferenceCounts({ query });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /left join contents c on c\.category = cc\.code and c\.is_active = true/i);
  assert.deepEqual(result.map(({ category, referenceCount }) => [category.code, referenceCount]), [
    ["career", 2],
    ["unused", 0],
  ]);
});

test("activity kind aggregate list maps counts and uses one active-only LEFT JOIN query", async () => {
  const { query, calls } = fakeQuery([
    { code: "sports", name: "Sports", display_order: 1, reference_count: "0", ...timestamps },
  ]);

  const result = await listActivityKindsWithReferenceCounts({ query });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /left join activities a on a\.kind = ak\.code and a\.is_active = true/i);
  assert.equal(result[0].activityKind.code, "sports");
  assert.equal(result[0].referenceCount, 0);
});

test("job category aggregate list maps counts and uses one active-only LEFT JOIN query", async () => {
  const { query, calls } = fakeQuery([
    { id: "category-1", code: "engineer", name: "Engineer", reference_count: "3", ...timestamps },
  ]);

  const result = await listJobCategoriesWithReferenceCounts({ query });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /left join jobs j on j\.job_category_id = jc\.id and j\.is_active = true/i);
  assert.equal(result[0].jobCategory.id, "category-1");
  assert.equal(result[0].referenceCount, 3);
});

test("employment type aggregate list maps counts and uses one active-only LEFT JOIN query", async () => {
  const { query, calls } = fakeQuery([
    { id: "type-1", code: "full-time", name: "Full time", reference_count: "0", ...timestamps },
  ]);

  const result = await listEmploymentTypesWithReferenceCounts({ query });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /left join jobs j on j\.employment_type_id = et\.id and j\.is_active = true/i);
  assert.equal(result[0].employmentType.id, "type-1");
  assert.equal(result[0].referenceCount, 0);
});
