-- Hugmeid pre-release schema baseline.
--
-- Generated from the immutable pre-release migration history on PostgreSQL 16,
-- then reviewed as the only supported bootstrap path for an empty database.
-- Apply this file only through scripts/cloudsql-migrate.mjs. The runner wraps
-- the file in a transaction, records its checksum, and refuses non-empty
-- unmanaged databases.

-- Dumped from database version 16.14 (Debian 16.14-1.pgdg13+1)
-- Dumped by pg_dump version 16.14 (Debian 16.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: line_friend_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.line_friend_status AS ENUM (
    'active',
    'unsubscribed',
    'unknown'
);


--
-- Name: syllabus_source_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.syllabus_source_type AS ENUM (
    'official',
    'manual_user',
    'manual_import'
);


--
-- Name: admin_users_require_active_owner(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_users_require_active_owner() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if exists (select 1 from admin_users where role = 'owner' and is_active = true) then
    return null;
  end if;
  raise exception 'at least one active owner admin_users row is required';
end;
$$;


--
-- Name: enforce_revision_no(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_revision_no() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    if new.revision_no is null then
      new.revision_no := 1;
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.revision_no <= old.revision_no then
      raise exception 'revision_no must be greater than current version';
    end if;
    return new;
  end if;

  return new;
end;
$$;


--
-- Name: preserve_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.preserve_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version text PRIMARY KEY,
    name text NOT NULL,
    kind text NOT NULL,
    checksum_sha256 text NOT NULL,
    applied_at timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
    applied_by text DEFAULT CURRENT_USER NOT NULL,
    CONSTRAINT schema_migrations_version_format CHECK ((version ~ '^[0-9]{14}$'::text)),
    CONSTRAINT schema_migrations_kind_check CHECK ((kind = ANY (ARRAY['baseline'::text, 'migration'::text, 'seed'::text]))),
    CONSTRAINT schema_migrations_checksum_format CHECK ((checksum_sha256 ~ '^[0-9a-f]{64}$'::text))
);

--
-- Name: activities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    kind text NOT NULL,
    title text NOT NULL,
    host_name text NOT NULL,
    summary text,
    description_md text,
    action_type text NOT NULL,
    action_url text,
    target_audience text,
    location_pref text,
    location_detail text,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    deadline_at timestamp with time zone,
    capacity_display text,
    requirements_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    benefits_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    source_name text,
    source_url text,
    source_last_modified_at timestamp with time zone,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT activities_action_type_check CHECK ((action_type = ANY (ARRAY['apply'::text, 'signup'::text, 'join'::text, 'attend'::text, 'inquire'::text]))),
    CONSTRAINT activities_action_url_check CHECK (((action_url IS NULL) OR (action_url ~* '^https://'::text))),
    CONSTRAINT activities_benefits_json_check CHECK ((jsonb_typeof(benefits_json) = 'array'::text)),
    CONSTRAINT activities_requirements_json_check CHECK ((jsonb_typeof(requirements_json) = 'array'::text)),
    CONSTRAINT activities_source_url_check CHECK (((source_url IS NULL) OR (source_url ~* '^https://'::text)))
);


--
-- Name: activity_bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_kinds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_kinds (
    code text NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_admin_id uuid,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id text,
    before_snapshot jsonb,
    after_snapshot jsonb,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: admin_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admin_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_admin_id uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT admin_users_deleted_must_be_inactive CHECK (((deleted_at IS NULL) OR (is_active = false))),
    CONSTRAINT admin_users_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'editor'::text])))
);


--
-- Name: app_environment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_environment (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_environment_key_check CHECK ((key = 'database_environment'::text)),
    CONSTRAINT app_environment_value_check CHECK ((value = ANY (ARRAY['local'::text, 'staging'::text, 'production'::text])))
);


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket text NOT NULL,
    object_path text NOT NULL,
    public_url text NOT NULL,
    content_type text NOT NULL,
    byte_size bigint NOT NULL,
    checksum text NOT NULL,
    uploaded_by_admin_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    purged_at timestamp with time zone,
    CONSTRAINT assets_byte_size_check CHECK (((byte_size > 0) AND (byte_size <= 5242880))),
    CONSTRAINT assets_content_type_check CHECK ((content_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text])))
);


--
-- Name: clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clubs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    content_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: content_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_categories (
    code text NOT NULL,
    name text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: content_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    content_id uuid NOT NULL,
    version_no integer NOT NULL,
    snapshot jsonb NOT NULL,
    created_by_admin_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: contents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    content_type text NOT NULL,
    category text NOT NULL,
    title text NOT NULL,
    dek text,
    body_md text,
    hero_image_url text,
    related_activity_id uuid,
    related_job_id uuid,
    published_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_admin_id uuid,
    updated_by_admin_id uuid,
    approval_status text DEFAULT 'draft'::text NOT NULL,
    approval_requested_by_admin_id uuid,
    approval_requested_at timestamp with time zone,
    approved_by_admin_id uuid,
    approved_at timestamp with time zone,
    first_published_at timestamp with time zone,
    CONSTRAINT contents_approval_status_check CHECK ((approval_status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'changes_requested'::text]))),
    CONSTRAINT contents_content_type_check CHECK ((content_type = ANY (ARRAY['article'::text, 'guide'::text, 'story'::text, 'sponsor_story'::text, 'faq'::text]))),
    CONSTRAINT contents_hero_image_url_check CHECK (((hero_image_url IS NULL) OR (hero_image_url ~* '^https://'::text)))
);


--
-- Name: employment_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employment_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    intent text NOT NULL,
    job_id uuid,
    activity_id uuid,
    content_id uuid,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inquiries_intent_check CHECK ((intent = ANY (ARRAY['job'::text, 'activity'::text, 'content'::text, 'school_career'::text, 'sponsor_partner'::text, 'problem_report'::text, 'other'::text]))),
    CONSTRAINT inquiries_message_check CHECK (((length(TRIM(BOTH FROM message)) >= 1) AND (length(TRIM(BOTH FROM message)) <= 4000))),
    CONSTRAINT inquiries_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'closed'::text])))
);


--
-- Name: job_bookmarks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_bookmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    job_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: job_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    external_source text NOT NULL,
    external_id text NOT NULL,
    external_slug text,
    title text NOT NULL,
    job_category_id uuid NOT NULL,
    employment_type_id uuid NOT NULL,
    university_id uuid,
    location_pref text,
    location_detail text,
    summary text,
    description_md text,
    company_name text,
    company_type text,
    salary_min integer,
    salary_display text,
    work_schedule text,
    requirements_summary text,
    requirements_list jsonb DEFAULT '[]'::jsonb NOT NULL,
    benefits jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    published_at timestamp with time zone,
    source_last_modified_at timestamp with time zone,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    slug text,
    apply_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT jobs_apply_url_https_check CHECK (((apply_url IS NULL) OR (apply_url ~* '^https://'::text))),
    CONSTRAINT jobs_benefits_check CHECK ((jsonb_typeof(benefits) = 'array'::text)),
    CONSTRAINT jobs_requirements_list_check CHECK ((jsonb_typeof(requirements_list) = 'array'::text)),
    CONSTRAINT jobs_salary_min_check CHECK (((salary_min IS NULL) OR (salary_min >= 0)))
);


--
-- Name: rate_limit_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limit_buckets (
    namespace text NOT NULL,
    identity text NOT NULL,
    client_key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    reset_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT rate_limit_buckets_count_check CHECK ((count >= 0))
);


--
-- Name: specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.specialties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: syllabus_class_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syllabus_class_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    syllabus_page_id uuid NOT NULL,
    class_key text NOT NULL,
    title text NOT NULL,
    instructor text,
    room text,
    location text,
    schedule jsonb NOT NULL,
    source_type public.syllabus_source_type DEFAULT 'manual_user'::public.syllabus_source_type NOT NULL,
    created_by_user_id uuid,
    is_official boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    revision_no integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT syllabus_class_entries_check CHECK ((((source_type = 'official'::public.syllabus_source_type) AND (is_official = true)) OR ((source_type <> 'official'::public.syllabus_source_type) AND (is_official = false))))
);


--
-- Name: syllabus_class_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syllabus_class_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    syllabus_class_entry_id uuid NOT NULL,
    resource_type text NOT NULL,
    title text,
    url text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT syllabus_class_resources_resource_type_check CHECK ((resource_type = ANY (ARRAY['zoom_url'::text, 'material_url'::text, 'other_url'::text]))),
    CONSTRAINT syllabus_class_resources_url_https_check CHECK ((url ~* '^https://'::text))
);


--
-- Name: syllabus_class_revisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syllabus_class_revisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    syllabus_class_entry_id uuid NOT NULL,
    revision_no integer NOT NULL,
    snapshot jsonb NOT NULL,
    changed_by_user_id uuid,
    change_note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_archived boolean DEFAULT false NOT NULL
);


--
-- Name: syllabus_class_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syllabus_class_tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    syllabus_class_entry_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    due_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: syllabus_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syllabus_pages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    university_id uuid NOT NULL,
    academic_year integer NOT NULL,
    term_number smallint NOT NULL,
    source_kind text DEFAULT 'ocr'::text NOT NULL,
    source_file_url text,
    raw_text text,
    parsed_json jsonb,
    effective_start_date date,
    effective_end_date date,
    is_manual_override boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    source_last_modified_at timestamp with time zone,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT syllabus_pages_term_number_check CHECK (((term_number >= 1) AND (term_number <= 4)))
);


--
-- Name: syllabus_revision_prune_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.syllabus_revision_prune_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    syllabus_class_entry_id uuid NOT NULL,
    removed_revision_ids jsonb,
    removed_count integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: universities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.universities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    region_code text,
    prefecture text,
    city text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_class_memos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_class_memos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    syllabus_class_entry_id uuid NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_class_tags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_class_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    syllabus_class_entry_id uuid NOT NULL,
    label text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_class_task_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_class_task_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    syllabus_class_task_id uuid NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_class_task_statuses_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'submitted'::text, 'skipped'::text])))
);


--
-- Name: user_club_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_club_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    club_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_desired_specialties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_desired_specialties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    specialty_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_legal_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_legal_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    version text NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_legal_consents_version_check CHECK ((length(TRIM(BOTH FROM version)) > 0))
);


--
-- Name: user_notification_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notification_settings (
    user_id uuid NOT NULL,
    class_reminder_enabled boolean DEFAULT true NOT NULL,
    class_reminder_minutes_before integer DEFAULT 30 NOT NULL,
    task_due_reminder_enabled boolean DEFAULT true NOT NULL,
    task_due_reminder_days_before integer DEFAULT 2 NOT NULL,
    class_change_notification_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_timetable_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_timetable_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    syllabus_class_entry_id uuid NOT NULL,
    color_label text,
    display_order integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    line_uid text NOT NULL,
    external_auth_uid uuid,
    line_login_provider text DEFAULT 'line_login'::text NOT NULL,
    gender text,
    university_id uuid,
    graduation_year integer,
    is_profile_complete boolean DEFAULT false NOT NULL,
    consent_marketing_at timestamp with time zone,
    line_friend_status public.line_friend_status DEFAULT 'unknown'::public.line_friend_status NOT NULL,
    push_enabled boolean DEFAULT false NOT NULL,
    deactivated_at timestamp with time zone,
    graduation_year_updated_at timestamp with time zone,
    graduation_year_updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activities activities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_pkey PRIMARY KEY (id);


--
-- Name: activities activities_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_slug_key UNIQUE (slug);


--
-- Name: activity_bookmarks activity_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_bookmarks
    ADD CONSTRAINT activity_bookmarks_pkey PRIMARY KEY (id);


--
-- Name: activity_bookmarks activity_bookmarks_user_id_activity_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_bookmarks
    ADD CONSTRAINT activity_bookmarks_user_id_activity_id_key UNIQUE (user_id, activity_id);


--
-- Name: activity_kinds activity_kinds_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_kinds
    ADD CONSTRAINT activity_kinds_name_key UNIQUE (name);


--
-- Name: activity_kinds activity_kinds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_kinds
    ADD CONSTRAINT activity_kinds_pkey PRIMARY KEY (code);


--
-- Name: admin_audit_logs admin_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: admin_users admin_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_email_key UNIQUE (email);


--
-- Name: admin_users admin_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_pkey PRIMARY KEY (id);


--
-- Name: app_environment app_environment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_environment
    ADD CONSTRAINT app_environment_pkey PRIMARY KEY (key);


--
-- Name: assets assets_bucket_object_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_bucket_object_path_key UNIQUE (bucket, object_path);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: clubs clubs_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_name_key UNIQUE (name);


--
-- Name: clubs clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clubs
    ADD CONSTRAINT clubs_pkey PRIMARY KEY (id);


--
-- Name: content_bookmarks content_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_bookmarks
    ADD CONSTRAINT content_bookmarks_pkey PRIMARY KEY (id);


--
-- Name: content_bookmarks content_bookmarks_user_id_content_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_bookmarks
    ADD CONSTRAINT content_bookmarks_user_id_content_id_key UNIQUE (user_id, content_id);


--
-- Name: content_categories content_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_categories
    ADD CONSTRAINT content_categories_name_key UNIQUE (name);


--
-- Name: content_categories content_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_categories
    ADD CONSTRAINT content_categories_pkey PRIMARY KEY (code);


--
-- Name: content_versions content_versions_content_id_version_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_versions
    ADD CONSTRAINT content_versions_content_id_version_no_key UNIQUE (content_id, version_no);


--
-- Name: content_versions content_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_versions
    ADD CONSTRAINT content_versions_pkey PRIMARY KEY (id);


--
-- Name: contents contents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_pkey PRIMARY KEY (id);


--
-- Name: contents contents_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_slug_key UNIQUE (slug);


--
-- Name: employment_types employment_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_types
    ADD CONSTRAINT employment_types_code_key UNIQUE (code);


--
-- Name: employment_types employment_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_types
    ADD CONSTRAINT employment_types_name_key UNIQUE (name);


--
-- Name: employment_types employment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employment_types
    ADD CONSTRAINT employment_types_pkey PRIMARY KEY (id);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: job_bookmarks job_bookmarks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_bookmarks
    ADD CONSTRAINT job_bookmarks_pkey PRIMARY KEY (id);


--
-- Name: job_bookmarks job_bookmarks_user_id_job_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_bookmarks
    ADD CONSTRAINT job_bookmarks_user_id_job_id_key UNIQUE (user_id, job_id);


--
-- Name: job_categories job_categories_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories
    ADD CONSTRAINT job_categories_code_key UNIQUE (code);


--
-- Name: job_categories job_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories
    ADD CONSTRAINT job_categories_name_key UNIQUE (name);


--
-- Name: job_categories job_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_categories
    ADD CONSTRAINT job_categories_pkey PRIMARY KEY (id);


--
-- Name: jobs jobs_external_source_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_external_source_external_id_key UNIQUE (external_source, external_id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: rate_limit_buckets rate_limit_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limit_buckets
    ADD CONSTRAINT rate_limit_buckets_pkey PRIMARY KEY (namespace, identity, client_key);


--
-- Name: specialties specialties_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_name_key UNIQUE (name);


--
-- Name: specialties specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.specialties
    ADD CONSTRAINT specialties_pkey PRIMARY KEY (id);


--
-- Name: syllabus_class_entries syllabus_class_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_entries
    ADD CONSTRAINT syllabus_class_entries_pkey PRIMARY KEY (id);


--
-- Name: syllabus_class_entries syllabus_class_entries_syllabus_page_id_class_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_entries
    ADD CONSTRAINT syllabus_class_entries_syllabus_page_id_class_key_key UNIQUE (syllabus_page_id, class_key);


--
-- Name: syllabus_class_resources syllabus_class_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_resources
    ADD CONSTRAINT syllabus_class_resources_pkey PRIMARY KEY (id);


--
-- Name: syllabus_class_revisions syllabus_class_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_revisions
    ADD CONSTRAINT syllabus_class_revisions_pkey PRIMARY KEY (id);


--
-- Name: syllabus_class_revisions syllabus_class_revisions_syllabus_class_entry_id_revision_n_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_revisions
    ADD CONSTRAINT syllabus_class_revisions_syllabus_class_entry_id_revision_n_key UNIQUE (syllabus_class_entry_id, revision_no);


--
-- Name: syllabus_class_tasks syllabus_class_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_tasks
    ADD CONSTRAINT syllabus_class_tasks_pkey PRIMARY KEY (id);


--
-- Name: syllabus_pages syllabus_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_pages
    ADD CONSTRAINT syllabus_pages_pkey PRIMARY KEY (id);


--
-- Name: syllabus_pages syllabus_pages_university_id_academic_year_term_number_sour_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_pages
    ADD CONSTRAINT syllabus_pages_university_id_academic_year_term_number_sour_key UNIQUE (university_id, academic_year, term_number, source_kind);


--
-- Name: syllabus_revision_prune_events syllabus_revision_prune_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_revision_prune_events
    ADD CONSTRAINT syllabus_revision_prune_events_pkey PRIMARY KEY (id);


--
-- Name: universities universities_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universities
    ADD CONSTRAINT universities_name_key UNIQUE (name);


--
-- Name: universities universities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.universities
    ADD CONSTRAINT universities_pkey PRIMARY KEY (id);


--
-- Name: user_class_memos user_class_memos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_memos
    ADD CONSTRAINT user_class_memos_pkey PRIMARY KEY (id);


--
-- Name: user_class_memos user_class_memos_user_id_syllabus_class_entry_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_memos
    ADD CONSTRAINT user_class_memos_user_id_syllabus_class_entry_id_key UNIQUE (user_id, syllabus_class_entry_id);


--
-- Name: user_class_tags user_class_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_tags
    ADD CONSTRAINT user_class_tags_pkey PRIMARY KEY (id);


--
-- Name: user_class_tags user_class_tags_user_id_syllabus_class_entry_id_label_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_tags
    ADD CONSTRAINT user_class_tags_user_id_syllabus_class_entry_id_label_key UNIQUE (user_id, syllabus_class_entry_id, label);


--
-- Name: user_class_task_statuses user_class_task_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_task_statuses
    ADD CONSTRAINT user_class_task_statuses_pkey PRIMARY KEY (id);


--
-- Name: user_class_task_statuses user_class_task_statuses_user_id_syllabus_class_task_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_task_statuses
    ADD CONSTRAINT user_class_task_statuses_user_id_syllabus_class_task_id_key UNIQUE (user_id, syllabus_class_task_id);


--
-- Name: user_club_memberships user_club_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_club_memberships
    ADD CONSTRAINT user_club_memberships_pkey PRIMARY KEY (id);


--
-- Name: user_club_memberships user_club_memberships_user_id_club_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_club_memberships
    ADD CONSTRAINT user_club_memberships_user_id_club_id_key UNIQUE (user_id, club_id);


--
-- Name: user_desired_specialties user_desired_specialties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_desired_specialties
    ADD CONSTRAINT user_desired_specialties_pkey PRIMARY KEY (id);


--
-- Name: user_desired_specialties user_desired_specialties_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_desired_specialties
    ADD CONSTRAINT user_desired_specialties_user_id_key UNIQUE (user_id);


--
-- Name: user_desired_specialties user_desired_specialties_user_id_specialty_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_desired_specialties
    ADD CONSTRAINT user_desired_specialties_user_id_specialty_id_key UNIQUE (user_id, specialty_id);


--
-- Name: user_legal_consents user_legal_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_legal_consents
    ADD CONSTRAINT user_legal_consents_pkey PRIMARY KEY (id);


--
-- Name: user_legal_consents user_legal_consents_user_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_legal_consents
    ADD CONSTRAINT user_legal_consents_user_id_version_key UNIQUE (user_id, version);


--
-- Name: user_notification_settings user_notification_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_settings
    ADD CONSTRAINT user_notification_settings_pkey PRIMARY KEY (user_id);


--
-- Name: user_timetable_entries user_timetable_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_timetable_entries
    ADD CONSTRAINT user_timetable_entries_pkey PRIMARY KEY (id);


--
-- Name: user_timetable_entries user_timetable_entries_user_id_syllabus_class_entry_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_timetable_entries
    ADD CONSTRAINT user_timetable_entries_user_id_syllabus_class_entry_id_key UNIQUE (user_id, syllabus_class_entry_id);


--
-- Name: users users_external_auth_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_external_auth_uid_key UNIQUE (external_auth_uid);


--
-- Name: users users_line_uid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_line_uid_key UNIQUE (line_uid);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: activities_active_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_active_published_idx ON public.activities USING btree (is_active, published_at);


--
-- Name: activities_deadline_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_deadline_idx ON public.activities USING btree (deadline_at) WHERE (deadline_at IS NOT NULL);


--
-- Name: activities_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activities_kind_idx ON public.activities USING btree (kind);


--
-- Name: activity_bookmarks_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_bookmarks_activity_idx ON public.activity_bookmarks USING btree (activity_id);


--
-- Name: activity_bookmarks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX activity_bookmarks_user_idx ON public.activity_bookmarks USING btree (user_id);


--
-- Name: admin_audit_logs_actor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_logs_actor_idx ON public.admin_audit_logs USING btree (actor_admin_id);


--
-- Name: admin_audit_logs_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_logs_created_idx ON public.admin_audit_logs USING btree (created_at DESC);


--
-- Name: admin_audit_logs_resource_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_audit_logs_resource_idx ON public.admin_audit_logs USING btree (resource_type, resource_id);


--
-- Name: admin_users_deleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_users_deleted_idx ON public.admin_users USING btree (deleted_at);


--
-- Name: admin_users_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admin_users_role_idx ON public.admin_users USING btree (role);


--
-- Name: assets_deleted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_deleted_idx ON public.assets USING btree (deleted_at);


--
-- Name: assets_purged_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_purged_idx ON public.assets USING btree (purged_at);


--
-- Name: assets_uploaded_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assets_uploaded_by_idx ON public.assets USING btree (uploaded_by_admin_id);


--
-- Name: content_bookmarks_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_bookmarks_content_idx ON public.content_bookmarks USING btree (content_id);


--
-- Name: content_bookmarks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_bookmarks_user_idx ON public.content_bookmarks USING btree (user_id);


--
-- Name: content_versions_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_versions_content_idx ON public.content_versions USING btree (content_id, version_no DESC);


--
-- Name: contents_active_published_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contents_active_published_idx ON public.contents USING btree (is_active, published_at);


--
-- Name: contents_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contents_category_idx ON public.contents USING btree (category);


--
-- Name: contents_first_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contents_first_published_at_idx ON public.contents USING btree (first_published_at);


--
-- Name: contents_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contents_type_idx ON public.contents USING btree (content_type);


--
-- Name: inquiries_activity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inquiries_activity_idx ON public.inquiries USING btree (activity_id) WHERE (activity_id IS NOT NULL);


--
-- Name: inquiries_content_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inquiries_content_idx ON public.inquiries USING btree (content_id) WHERE (content_id IS NOT NULL);


--
-- Name: inquiries_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inquiries_job_idx ON public.inquiries USING btree (job_id) WHERE (job_id IS NOT NULL);


--
-- Name: inquiries_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inquiries_status_idx ON public.inquiries USING btree (status);


--
-- Name: inquiries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inquiries_user_idx ON public.inquiries USING btree (user_id);


--
-- Name: job_bookmarks_job_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_bookmarks_job_idx ON public.job_bookmarks USING btree (job_id);


--
-- Name: job_bookmarks_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_bookmarks_user_idx ON public.job_bookmarks USING btree (user_id);


--
-- Name: jobs_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_active_idx ON public.jobs USING btree (is_active);


--
-- Name: jobs_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_category_idx ON public.jobs USING btree (job_category_id);


--
-- Name: jobs_emp_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_emp_type_idx ON public.jobs USING btree (employment_type_id);


--
-- Name: jobs_location_pref_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_location_pref_idx ON public.jobs USING btree (location_pref) WHERE (location_pref IS NOT NULL);


--
-- Name: jobs_salary_min_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_salary_min_idx ON public.jobs USING btree (salary_min) WHERE (salary_min IS NOT NULL);


--
-- Name: jobs_slug_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX jobs_slug_unique_idx ON public.jobs USING btree (slug) WHERE (slug IS NOT NULL);


--
-- Name: jobs_univ_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_univ_idx ON public.jobs USING btree (university_id);


--
-- Name: rate_limit_buckets_reset_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rate_limit_buckets_reset_idx ON public.rate_limit_buckets USING btree (reset_at);


--
-- Name: syllabus_class_entries_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_class_entries_active_idx ON public.syllabus_class_entries USING btree (is_active);


--
-- Name: syllabus_class_entries_page_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_class_entries_page_idx ON public.syllabus_class_entries USING btree (syllabus_page_id);


--
-- Name: syllabus_class_entries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_class_entries_user_idx ON public.syllabus_class_entries USING btree (created_by_user_id);


--
-- Name: syllabus_class_resources_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_class_resources_class_idx ON public.syllabus_class_resources USING btree (syllabus_class_entry_id);


--
-- Name: syllabus_class_revisions_entry_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_class_revisions_entry_created_idx ON public.syllabus_class_revisions USING btree (syllabus_class_entry_id, created_at DESC);


--
-- Name: syllabus_class_tasks_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_class_tasks_class_idx ON public.syllabus_class_tasks USING btree (syllabus_class_entry_id);


--
-- Name: syllabus_class_tasks_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_class_tasks_due_idx ON public.syllabus_class_tasks USING btree (due_at);


--
-- Name: syllabus_pages_univ_term_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX syllabus_pages_univ_term_idx ON public.syllabus_pages USING btree (university_id, academic_year, term_number);


--
-- Name: user_class_memos_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_class_memos_user_idx ON public.user_class_memos USING btree (user_id);


--
-- Name: user_class_tags_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_class_tags_user_idx ON public.user_class_tags USING btree (user_id);


--
-- Name: user_class_task_statuses_task_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_class_task_statuses_task_idx ON public.user_class_task_statuses USING btree (syllabus_class_task_id);


--
-- Name: user_class_task_statuses_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_class_task_statuses_user_idx ON public.user_class_task_statuses USING btree (user_id);


--
-- Name: user_timetable_entries_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_timetable_entries_class_idx ON public.user_timetable_entries USING btree (syllabus_class_entry_id);


--
-- Name: user_timetable_entries_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_timetable_entries_user_idx ON public.user_timetable_entries USING btree (user_id);


--
-- Name: users_graduation_year_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_graduation_year_idx ON public.users USING btree (graduation_year);


--
-- Name: users_line_uid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_line_uid_idx ON public.users USING btree (line_uid);


--
-- Name: users_university_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_university_idx ON public.users USING btree (university_id);


--
-- Name: activities activities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: activity_kinds activity_kinds_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER activity_kinds_updated_at BEFORE UPDATE ON public.activity_kinds FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: admin_users admin_users_require_active_owner; Type: TRIGGER; Schema: public; Owner: -
--

CREATE CONSTRAINT TRIGGER admin_users_require_active_owner AFTER INSERT OR DELETE OR UPDATE ON public.admin_users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.admin_users_require_active_owner();


--
-- Name: admin_users admin_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: app_environment app_environment_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER app_environment_updated_at BEFORE UPDATE ON public.app_environment FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: clubs clubs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: content_categories content_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER content_categories_updated_at BEFORE UPDATE ON public.content_categories FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: contents contents_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contents_updated_at BEFORE UPDATE ON public.contents FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: employment_types employment_types_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER employment_types_updated_at BEFORE UPDATE ON public.employment_types FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: inquiries inquiries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER inquiries_updated_at BEFORE UPDATE ON public.inquiries FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: job_categories job_categories_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER job_categories_updated_at BEFORE UPDATE ON public.job_categories FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: jobs jobs_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: specialties specialties_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER specialties_updated_at BEFORE UPDATE ON public.specialties FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: syllabus_class_entries syllabus_class_entries_enforce_revision_no; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER syllabus_class_entries_enforce_revision_no BEFORE INSERT OR UPDATE ON public.syllabus_class_entries FOR EACH ROW EXECUTE FUNCTION public.enforce_revision_no();


--
-- Name: syllabus_class_resources syllabus_class_resources_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER syllabus_class_resources_updated_at BEFORE UPDATE ON public.syllabus_class_resources FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: syllabus_class_tasks syllabus_class_tasks_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER syllabus_class_tasks_updated_at BEFORE UPDATE ON public.syllabus_class_tasks FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: syllabus_class_entries syllabus_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER syllabus_entries_updated_at BEFORE UPDATE ON public.syllabus_class_entries FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: syllabus_pages syllabus_pages_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER syllabus_pages_updated_at BEFORE UPDATE ON public.syllabus_pages FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: universities universities_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER universities_updated_at BEFORE UPDATE ON public.universities FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: user_class_memos user_class_memos_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_class_memos_updated_at BEFORE UPDATE ON public.user_class_memos FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: user_class_tags user_class_tags_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_class_tags_updated_at BEFORE UPDATE ON public.user_class_tags FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: user_class_task_statuses user_class_task_statuses_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_class_task_statuses_updated_at BEFORE UPDATE ON public.user_class_task_statuses FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: user_notification_settings user_notification_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_notification_settings_updated_at BEFORE UPDATE ON public.user_notification_settings FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: user_timetable_entries user_timetable_entries_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_timetable_entries_updated_at BEFORE UPDATE ON public.user_timetable_entries FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.preserve_updated_at();


--
-- Name: activities activities_kind_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activities
    ADD CONSTRAINT activities_kind_fkey FOREIGN KEY (kind) REFERENCES public.activity_kinds(code);


--
-- Name: activity_bookmarks activity_bookmarks_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_bookmarks
    ADD CONSTRAINT activity_bookmarks_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id) ON DELETE CASCADE;


--
-- Name: activity_bookmarks activity_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_bookmarks
    ADD CONSTRAINT activity_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: admin_audit_logs admin_audit_logs_actor_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_audit_logs
    ADD CONSTRAINT admin_audit_logs_actor_admin_id_fkey FOREIGN KEY (actor_admin_id) REFERENCES public.admin_users(id);


--
-- Name: admin_users admin_users_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admin_users
    ADD CONSTRAINT admin_users_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_users(id);


--
-- Name: assets assets_uploaded_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_uploaded_by_admin_id_fkey FOREIGN KEY (uploaded_by_admin_id) REFERENCES public.admin_users(id);


--
-- Name: content_bookmarks content_bookmarks_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_bookmarks
    ADD CONSTRAINT content_bookmarks_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: content_bookmarks content_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_bookmarks
    ADD CONSTRAINT content_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: content_versions content_versions_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_versions
    ADD CONSTRAINT content_versions_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id) ON DELETE CASCADE;


--
-- Name: content_versions content_versions_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_versions
    ADD CONSTRAINT content_versions_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_users(id);


--
-- Name: contents contents_approval_requested_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_approval_requested_by_admin_id_fkey FOREIGN KEY (approval_requested_by_admin_id) REFERENCES public.admin_users(id);


--
-- Name: contents contents_approved_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_approved_by_admin_id_fkey FOREIGN KEY (approved_by_admin_id) REFERENCES public.admin_users(id);


--
-- Name: contents contents_category_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_category_fkey FOREIGN KEY (category) REFERENCES public.content_categories(code);


--
-- Name: contents contents_created_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_created_by_admin_id_fkey FOREIGN KEY (created_by_admin_id) REFERENCES public.admin_users(id);


--
-- Name: contents contents_related_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_related_activity_id_fkey FOREIGN KEY (related_activity_id) REFERENCES public.activities(id);


--
-- Name: contents contents_related_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_related_job_id_fkey FOREIGN KEY (related_job_id) REFERENCES public.jobs(id);


--
-- Name: contents contents_updated_by_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contents
    ADD CONSTRAINT contents_updated_by_admin_id_fkey FOREIGN KEY (updated_by_admin_id) REFERENCES public.admin_users(id);


--
-- Name: inquiries inquiries_activity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES public.activities(id);


--
-- Name: inquiries inquiries_content_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_content_id_fkey FOREIGN KEY (content_id) REFERENCES public.contents(id);


--
-- Name: inquiries inquiries_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id);


--
-- Name: inquiries inquiries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: job_bookmarks job_bookmarks_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_bookmarks
    ADD CONSTRAINT job_bookmarks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_bookmarks job_bookmarks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_bookmarks
    ADD CONSTRAINT job_bookmarks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_employment_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_employment_type_id_fkey FOREIGN KEY (employment_type_id) REFERENCES public.employment_types(id);


--
-- Name: jobs jobs_job_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_job_category_id_fkey FOREIGN KEY (job_category_id) REFERENCES public.job_categories(id);


--
-- Name: jobs jobs_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id);


--
-- Name: syllabus_class_entries syllabus_class_entries_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_entries
    ADD CONSTRAINT syllabus_class_entries_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: syllabus_class_entries syllabus_class_entries_syllabus_page_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_entries
    ADD CONSTRAINT syllabus_class_entries_syllabus_page_id_fkey FOREIGN KEY (syllabus_page_id) REFERENCES public.syllabus_pages(id) ON DELETE CASCADE;


--
-- Name: syllabus_class_resources syllabus_class_resources_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_resources
    ADD CONSTRAINT syllabus_class_resources_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: syllabus_class_resources syllabus_class_resources_syllabus_class_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_resources
    ADD CONSTRAINT syllabus_class_resources_syllabus_class_entry_id_fkey FOREIGN KEY (syllabus_class_entry_id) REFERENCES public.syllabus_class_entries(id) ON DELETE CASCADE;


--
-- Name: syllabus_class_resources syllabus_class_resources_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_resources
    ADD CONSTRAINT syllabus_class_resources_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: syllabus_class_revisions syllabus_class_revisions_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_revisions
    ADD CONSTRAINT syllabus_class_revisions_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id);


--
-- Name: syllabus_class_revisions syllabus_class_revisions_syllabus_class_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_revisions
    ADD CONSTRAINT syllabus_class_revisions_syllabus_class_entry_id_fkey FOREIGN KEY (syllabus_class_entry_id) REFERENCES public.syllabus_class_entries(id) ON DELETE CASCADE;


--
-- Name: syllabus_class_tasks syllabus_class_tasks_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_tasks
    ADD CONSTRAINT syllabus_class_tasks_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id);


--
-- Name: syllabus_class_tasks syllabus_class_tasks_syllabus_class_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_tasks
    ADD CONSTRAINT syllabus_class_tasks_syllabus_class_entry_id_fkey FOREIGN KEY (syllabus_class_entry_id) REFERENCES public.syllabus_class_entries(id) ON DELETE CASCADE;


--
-- Name: syllabus_class_tasks syllabus_class_tasks_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_class_tasks
    ADD CONSTRAINT syllabus_class_tasks_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.users(id);


--
-- Name: syllabus_pages syllabus_pages_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_pages
    ADD CONSTRAINT syllabus_pages_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id);


--
-- Name: syllabus_revision_prune_events syllabus_revision_prune_events_syllabus_class_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.syllabus_revision_prune_events
    ADD CONSTRAINT syllabus_revision_prune_events_syllabus_class_entry_id_fkey FOREIGN KEY (syllabus_class_entry_id) REFERENCES public.syllabus_class_entries(id) ON DELETE CASCADE;


--
-- Name: user_class_memos user_class_memos_syllabus_class_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_memos
    ADD CONSTRAINT user_class_memos_syllabus_class_entry_id_fkey FOREIGN KEY (syllabus_class_entry_id) REFERENCES public.syllabus_class_entries(id) ON DELETE CASCADE;


--
-- Name: user_class_memos user_class_memos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_memos
    ADD CONSTRAINT user_class_memos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_class_tags user_class_tags_syllabus_class_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_tags
    ADD CONSTRAINT user_class_tags_syllabus_class_entry_id_fkey FOREIGN KEY (syllabus_class_entry_id) REFERENCES public.syllabus_class_entries(id) ON DELETE CASCADE;


--
-- Name: user_class_tags user_class_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_tags
    ADD CONSTRAINT user_class_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_class_task_statuses user_class_task_statuses_syllabus_class_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_task_statuses
    ADD CONSTRAINT user_class_task_statuses_syllabus_class_task_id_fkey FOREIGN KEY (syllabus_class_task_id) REFERENCES public.syllabus_class_tasks(id) ON DELETE CASCADE;


--
-- Name: user_class_task_statuses user_class_task_statuses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_class_task_statuses
    ADD CONSTRAINT user_class_task_statuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_club_memberships user_club_memberships_club_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_club_memberships
    ADD CONSTRAINT user_club_memberships_club_id_fkey FOREIGN KEY (club_id) REFERENCES public.clubs(id);


--
-- Name: user_club_memberships user_club_memberships_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_club_memberships
    ADD CONSTRAINT user_club_memberships_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_desired_specialties user_desired_specialties_specialty_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_desired_specialties
    ADD CONSTRAINT user_desired_specialties_specialty_id_fkey FOREIGN KEY (specialty_id) REFERENCES public.specialties(id);


--
-- Name: user_desired_specialties user_desired_specialties_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_desired_specialties
    ADD CONSTRAINT user_desired_specialties_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_legal_consents user_legal_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_legal_consents
    ADD CONSTRAINT user_legal_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_notification_settings user_notification_settings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notification_settings
    ADD CONSTRAINT user_notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_timetable_entries user_timetable_entries_syllabus_class_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_timetable_entries
    ADD CONSTRAINT user_timetable_entries_syllabus_class_entry_id_fkey FOREIGN KEY (syllabus_class_entry_id) REFERENCES public.syllabus_class_entries(id) ON DELETE CASCADE;


--
-- Name: user_timetable_entries user_timetable_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_timetable_entries
    ADD CONSTRAINT user_timetable_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_graduation_year_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_graduation_year_updated_by_fkey FOREIGN KEY (graduation_year_updated_by) REFERENCES public.users(id);


--
-- Name: users users_university_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_university_id_fkey FOREIGN KEY (university_id) REFERENCES public.universities(id);


--
-- PostgreSQL database dump complete
--
