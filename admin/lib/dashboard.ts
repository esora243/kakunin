import "server-only";

import { listPendingCacheInvalidationRetries } from "./cache-invalidate";
import { CONTENT_DRAFT_APPROVAL_STATUSES } from "./content-workflow";
import { dbQuery, DatabaseConfigError } from "./db/postgres";

export type DashboardCounts = {
  contents: {
    total: number;
    draft: number;
    review: number;
    approved: number;
    scheduled: number;
    published: number;
    deactivated: number;
  };
  inquiries: { open: number; inProgress: number; closed: number };
  assets: { total: number; deleted: number };
  adminUsers: { activeOwners: number; activeEditors: number; inactiveTotal: number };
  jobs: { total: number };
  activities: { total: number };
  pendingCacheRetries: Awaited<ReturnType<typeof listPendingCacheInvalidationRetries>>;
};

export type DashboardData = DashboardCounts | { error: string };

async function countRows(sql: string, values: readonly unknown[] = []): Promise<number> {
  const { rows } = await dbQuery<{ count: string }>(sql, values);
  return Number(rows[0]?.count ?? 0);
}

/**
 * Loads all dashboard counters and the owner-visible cache-invalidation
 * retry queue with a handful of small, independent queries. Never throws:
 * a DatabaseConfigError (e.g. missing Cloud SQL config in an unconfigured
 * environment) is turned into an `{ error }` sentinel so the page can render
 * a clear "database not reachable" state instead of crashing, mirroring
 * app/api/health/route.ts's pattern.
 */
export async function loadDashboardData(): Promise<DashboardData> {
  try {
    const [
      contentsTotal,
      contentsDraft,
      contentsReview,
      contentsApproved,
      contentsScheduled,
      contentsPublished,
      contentsDeactivated,
      inquiriesOpen,
      inquiriesInProgress,
      inquiriesClosed,
      assetsTotal,
      assetsDeleted,
      activeOwners,
      activeEditors,
      inactiveAdminTotal,
      jobsTotal,
      activitiesTotal,
      pendingCacheRetries,
    ] = await Promise.all([
      countRows("select count(*) from contents"),
      countRows(
        `select count(*) from contents where is_active = true and published_at is null and approval_status in (${CONTENT_DRAFT_APPROVAL_STATUSES.map((status) => `'${status}'`).join(", ")})`,
      ),
      countRows("select count(*) from contents where is_active = true and published_at is null and approval_status = 'in_review'"),
      countRows("select count(*) from contents where is_active = true and published_at is null and approval_status = 'approved'"),
      countRows("select count(*) from contents where is_active = true and published_at is not null and published_at > now()"),
      countRows("select count(*) from contents where is_active = true and published_at is not null and published_at <= now()"),
      countRows("select count(*) from contents where is_active = false"),
      countRows("select count(*) from inquiries where status = 'open'"),
      countRows("select count(*) from inquiries where status = 'in_progress'"),
      countRows("select count(*) from inquiries where status = 'closed'"),
      countRows("select count(*) from assets"),
      countRows("select count(*) from assets where deleted_at is not null"),
      countRows("select count(*) from admin_users where role = 'owner' and is_active = true and deleted_at is null"),
      countRows("select count(*) from admin_users where role = 'editor' and is_active = true and deleted_at is null"),
      countRows("select count(*) from admin_users where is_active = false and deleted_at is null"),
      countRows("select count(*) from jobs"),
      countRows("select count(*) from activities"),
      listPendingCacheInvalidationRetries(10),
    ]);

    return {
      contents: {
        total: contentsTotal,
        draft: contentsDraft,
        review: contentsReview,
        approved: contentsApproved,
        scheduled: contentsScheduled,
        published: contentsPublished,
        deactivated: contentsDeactivated,
      },
      inquiries: { open: inquiriesOpen, inProgress: inquiriesInProgress, closed: inquiriesClosed },
      assets: { total: assetsTotal, deleted: assetsDeleted },
      adminUsers: { activeOwners, activeEditors, inactiveTotal: inactiveAdminTotal },
      jobs: { total: jobsTotal },
      activities: { total: activitiesTotal },
      pendingCacheRetries,
    };
  } catch (error) {
    if (error instanceof DatabaseConfigError) {
      return { error: `Database is not reachable (${error.code})` };
    }
    return { error: "Database is not reachable" };
  }
}
