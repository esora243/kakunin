import "server-only";

import type { PoolClient } from "pg";
import type { AuthSessionPayload, MeDto, ProfileOptionsDto, UpdateProfileRequest } from "@/lib/auth/types";
import { assertLoginUserCanReceiveSession } from "@/lib/auth/line-session";
import { dbQuery, dbTransaction } from "@/lib/db/postgres";
import {
  createDefaultProfileOptions,
  normalizeUpdateProfileRequestForOptions,
  type NormalizedUpdateProfileRequest,
} from "@/lib/profile";

type Relation = { id: string; name: string } | null;

type UserRow = {
  id: string;
  line_uid: string;
  gender: string | null;
  university_id: string | null;
  graduation_year: number | null;
  is_profile_complete: boolean;
  consent_marketing_at: string | null;
  line_friend_status: "active" | "unsubscribed" | "unknown";
  push_enabled: boolean;
  deactivated_at: string | null;
  universities?: Relation;
  user_club_memberships?: Array<{ clubs: Relation }>;
  user_desired_specialties?: Array<{ specialties: Relation }>;
};

const USER_SELECT_SQL = `
  select
    u.id::text,
    u.line_uid,
    u.gender,
    u.university_id::text,
    u.graduation_year,
    u.is_profile_complete,
    u.consent_marketing_at::text,
    u.line_friend_status::text,
    u.push_enabled,
    u.deactivated_at::text,
    case
      when universities.id is null then null
      else json_build_object('id', universities.id::text, 'name', universities.name)
    end as universities,
    coalesce(
      (
        select json_agg(
          json_build_object('clubs', json_build_object('id', clubs.id::text, 'name', clubs.name))
          order by clubs.name
        )
        from user_club_memberships
        join clubs on clubs.id = user_club_memberships.club_id
        where user_club_memberships.user_id = u.id
      ),
      '[]'::json
    ) as user_club_memberships,
    coalesce(
      (
        select json_agg(
          json_build_object('specialties', json_build_object('id', specialties.id::text, 'name', specialties.name))
          order by specialties.name
        )
        from user_desired_specialties
        join specialties on specialties.id = user_desired_specialties.specialty_id
        where user_desired_specialties.user_id = u.id
      ),
      '[]'::json
    ) as user_desired_specialties
  from users u
  left join universities on universities.id = u.university_id
`;

function maskLineUid(lineUid: string) {
  if (lineUid.length <= 6) return "***";
  return `${lineUid.slice(0, 2)}***${lineUid.slice(-4)}`;
}

function mapUserToMe(row: UserRow): MeDto {
  return {
    id: row.id,
    lineUidMasked: maskLineUid(row.line_uid),
    gender: row.gender,
    university: row.universities ?? null,
    graduationYear: row.graduation_year,
    isProfileComplete: row.is_profile_complete,
    consentMarketingAt: row.consent_marketing_at,
    lineFriendStatus: row.line_friend_status,
    pushEnabled: row.push_enabled,
    clubs: (row.user_club_memberships ?? []).map((item) => item.clubs).filter((item): item is NonNullable<Relation> => Boolean(item)),
    desiredSpecialty: row.user_desired_specialties?.[0]?.specialties ?? null,
  };
}

async function fetchUserById(userId: string) {
  const { rows } = await dbQuery<UserRow>(
    `
      ${USER_SELECT_SQL}
      where u.id = $1
      limit 1
    `,
    [userId],
  );
  return rows[0] ?? null;
}

async function fetchUserByIdWithClient(client: PoolClient, userId: string) {
  const { rows } = await client.query<UserRow>(
    `
      ${USER_SELECT_SQL}
      where u.id = $1
      limit 1
    `,
    [userId],
  );
  return rows[0] ?? null;
}

export async function upsertUserByLineUid(lineUid: string, legalConsentVersion: string): Promise<MeDto> {
  return dbTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `
        insert into users (line_uid, line_login_provider)
        values ($1, 'line_liff')
        on conflict (line_uid) do update
          set line_login_provider = excluded.line_login_provider
        returning id::text
      `,
      [lineUid],
    );
    const user = inserted.rows[0] ? await fetchUserByIdWithClient(client, inserted.rows[0].id) : null;
    if (!user) {
      throw new Error("LINE user upsert returned no user");
    }
    assertLoginUserCanReceiveSession(user);

    await client.query(
      `
        insert into user_legal_consents (user_id, version)
        values ($1, $2)
        on conflict (user_id, version) do nothing
      `,
      [user.id, legalConsentVersion],
    );

    return mapUserToMe(user);
  });
}

export async function getMeForSession(session: AuthSessionPayload): Promise<MeDto | null> {
  const user = await fetchUserById(session.userId);
  if (!user || user.deactivated_at) return null;
  return mapUserToMe(user);
}

async function fetchRelations(table: "clubs" | "specialties") {
  const { rows } = await dbQuery<{ id: string; name: string }>(
    `
      select id::text, name
      from ${table}
      where is_active = true
      order by name asc
    `,
  );
  return rows;
}

async function fetchUniversities() {
  const { rows } = await dbQuery<{ id: string; name: string; prefecture: string | null }>(
    `
      select id::text, name, prefecture
      from universities
      where is_active = true
      order by name asc
    `,
  );
  return rows;
}

export async function getProfileOptions(): Promise<ProfileOptionsDto> {
  const [universities, clubs, specialties] = await Promise.all([
    fetchUniversities(),
    fetchRelations("clubs"),
    fetchRelations("specialties"),
  ]);
  return {
    ...createDefaultProfileOptions(),
    universities,
    clubs,
    specialties,
  };
}

async function updateUserProfileRow(client: PoolClient, userId: string, normalized: NormalizedUpdateProfileRequest) {
  const result = await client.query(
    `
      update users
      set gender = $2,
          university_id = $3,
          graduation_year = $4,
          is_profile_complete = true,
          consent_marketing_at = case when $5::boolean then now() else null end,
          push_enabled = $6,
          updated_at = now()
      where id = $1
        and deactivated_at is null
    `,
    [
      userId,
      normalized.gender,
      normalized.universityId,
      normalized.graduationYear,
      normalized.consentMarketing,
      normalized.pushEnabled,
    ],
  );
  return result.rowCount === 1;
}

async function replaceUserClubMemberships(client: PoolClient, userId: string, clubIds: string[]) {
  await client.query("delete from user_club_memberships where user_id = $1", [userId]);
  if (clubIds.length > 0) {
    await client.query(
      `
        insert into user_club_memberships (user_id, club_id)
        select $1::uuid, club_id
        from unnest($2::uuid[]) as requested(club_id)
      `,
      [userId, clubIds],
    );
  }
}

async function replaceUserDesiredSpecialty(client: PoolClient, userId: string, desiredSpecialtyId: string | null) {
  await client.query("delete from user_desired_specialties where user_id = $1", [userId]);
  if (desiredSpecialtyId) {
    await client.query("insert into user_desired_specialties (user_id, specialty_id) values ($1, $2)", [
      userId,
      desiredSpecialtyId,
    ]);
  }
}

async function replaceUserProfileRelations(client: PoolClient, userId: string, normalized: NormalizedUpdateProfileRequest) {
  await replaceUserClubMemberships(client, userId, normalized.clubIds);
  await replaceUserDesiredSpecialty(client, userId, normalized.desiredSpecialtyId);
}

export async function updateProfileForSession(session: AuthSessionPayload, request: UpdateProfileRequest): Promise<MeDto | null> {
  const existing = await fetchUserById(session.userId);
  if (!existing || existing.deactivated_at) return null;
  const normalized = normalizeUpdateProfileRequestForOptions(request, await getProfileOptions());
  await dbTransaction(async (client) => {
    if (await updateUserProfileRow(client, session.userId, normalized)) {
      await replaceUserProfileRelations(client, session.userId, normalized);
    }
  });

  const updated = await fetchUserById(session.userId);
  return updated ? mapUserToMe(updated) : null;
}
