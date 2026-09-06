function privilegeSet(...privileges) {
  return new Set(privileges);
}

export const PUBLIC_RUNTIME_GRANTS = {
  app_environment: privilegeSet("SELECT"),
  universities: privilegeSet("SELECT"),
  clubs: privilegeSet("SELECT"),
  specialties: privilegeSet("SELECT"),
  job_categories: privilegeSet("SELECT"),
  employment_types: privilegeSet("SELECT"),
  activity_kinds: privilegeSet("SELECT"),
  content_categories: privilegeSet("SELECT"),
  jobs: privilegeSet("SELECT"),
  activities: privilegeSet("SELECT"),
  contents: privilegeSet("SELECT"),
  syllabus_pages: privilegeSet("SELECT"),
  syllabus_class_entries: privilegeSet("SELECT"),
  syllabus_class_resources: privilegeSet("SELECT", "INSERT"),
  syllabus_class_tasks: privilegeSet("SELECT", "INSERT"),
  rate_limit_buckets: privilegeSet("SELECT", "INSERT", "UPDATE", "DELETE"),
  users: privilegeSet("SELECT", "INSERT", "UPDATE"),
  user_club_memberships: privilegeSet("SELECT", "INSERT", "DELETE"),
  user_desired_specialties: privilegeSet("SELECT", "INSERT", "DELETE"),
  job_bookmarks: privilegeSet("SELECT", "INSERT", "DELETE"),
  activity_bookmarks: privilegeSet("SELECT", "INSERT", "DELETE"),
  content_bookmarks: privilegeSet("SELECT", "INSERT", "DELETE"),
  user_timetable_entries: privilegeSet("SELECT", "INSERT", "UPDATE"),
  user_class_task_statuses: privilegeSet("SELECT", "INSERT", "UPDATE"),
  user_class_memos: privilegeSet("SELECT", "INSERT", "UPDATE"),
  user_class_tags: privilegeSet("SELECT", "INSERT", "UPDATE"),
  user_notification_settings: privilegeSet("SELECT", "INSERT", "UPDATE"),
  inquiries: privilegeSet("SELECT", "INSERT", "UPDATE"),
  user_legal_consents: privilegeSet("SELECT", "INSERT"),
};

export const ADMIN_RUNTIME_GRANTS = {
  app_environment: privilegeSet("SELECT"),
  admin_users: privilegeSet("SELECT", "INSERT", "UPDATE"),
  admin_audit_logs: privilegeSet("SELECT", "INSERT"),
  assets: privilegeSet("SELECT", "INSERT", "UPDATE"),
  asset_variants: privilegeSet("SELECT", "INSERT"),
  contents: privilegeSet("SELECT", "INSERT", "UPDATE"),
  content_versions: privilegeSet("SELECT", "INSERT"),
  content_categories: privilegeSet("SELECT", "INSERT", "UPDATE"),
  activity_kinds: privilegeSet("SELECT", "UPDATE"),
  job_categories: privilegeSet("SELECT", "UPDATE"),
  employment_types: privilegeSet("SELECT", "UPDATE"),
  universities: privilegeSet("SELECT"),
  clubs: privilegeSet("SELECT"),
  specialties: privilegeSet("SELECT"),
  jobs: privilegeSet("SELECT", "INSERT", "UPDATE"),
  activities: privilegeSet("SELECT", "INSERT", "UPDATE"),
  syllabus_pages: privilegeSet("SELECT", "UPDATE"),
  syllabus_class_entries: privilegeSet("SELECT", "UPDATE"),
  syllabus_class_resources: privilegeSet("SELECT"),
  syllabus_class_tasks: privilegeSet("SELECT"),
  inquiries: privilegeSet("SELECT", "UPDATE"),
  rate_limit_buckets: privilegeSet("SELECT", "INSERT", "UPDATE", "DELETE"),
  public_cache_invalidation_jobs: privilegeSet("SELECT", "INSERT", "UPDATE"),
};

export const RUNTIME_GRANTS_BY_ROLE = {
  hugmeid_public_runtime: PUBLIC_RUNTIME_GRANTS,
  hugmeid_admin_runtime: ADMIN_RUNTIME_GRANTS,
};

export function privilegeMapDifferences(actualRows, roleName, expected) {
  const differences = [];
  const actual = new Map();
  for (const row of actualRows.filter((candidate) => candidate.grantee === roleName)) {
    const privileges = actual.get(row.table_name) ?? new Set();
    privileges.add(row.privilege_type);
    actual.set(row.table_name, privileges);
  }
  if (actual.size !== Object.keys(expected).length) {
    differences.push(`unexpected table set: ${[...actual.keys()].sort().join(", ")}`);
  }
  for (const [table, expectedPrivileges] of Object.entries(expected)) {
    const actualPrivileges = actual.get(table);
    if (!actualPrivileges) {
      differences.push(`missing ${table}`);
      continue;
    }
    if (
      ![...expectedPrivileges].every((privilege) => actualPrivileges.has(privilege)) ||
      ![...actualPrivileges].every((privilege) => expectedPrivileges.has(privilege))
    ) {
      differences.push(
        `${table}: actual=${[...actualPrivileges].sort().join(",")} expected=${[
          ...expectedPrivileges,
        ].sort().join(",")}`,
      );
    }
  }
  return differences;
}
