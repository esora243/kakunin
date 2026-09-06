-- Minimal lookup data required by profile and job APIs.

begin;

insert into universities (id, name, region_code, prefecture, city, is_active)
values
  ('11111111-1111-4111-8111-111111111111', '浜松医科大学', 'chubu', '静岡県', '浜松市', true)
on conflict (name) do update
set region_code = excluded.region_code,
    prefecture = excluded.prefecture,
    city = excluded.city,
    is_active = excluded.is_active;

insert into clubs (id, name, is_active)
values
  ('22222222-2222-4222-8222-222222222221', '運動部', true),
  ('22222222-2222-4222-8222-222222222222', '文化部', true),
  ('22222222-2222-4222-8222-222222222223', '医療系サークル', true),
  ('22222222-2222-4222-8222-222222222224', 'その他', true),
  ('22222222-2222-4222-8222-222222222225', '所属していない', true)
on conflict (name) do update
set is_active = excluded.is_active;

insert into specialties (id, name, is_active)
values
  ('33333333-3333-4333-8333-333333333331', '内科', true),
  ('33333333-3333-4333-8333-333333333332', '外科', true),
  ('33333333-3333-4333-8333-333333333333', '小児科', true),
  ('33333333-3333-4333-8333-333333333334', '産婦人科', true),
  ('33333333-3333-4333-8333-333333333335', '整形外科', true),
  ('33333333-3333-4333-8333-333333333336', '精神科', true),
  ('33333333-3333-4333-8333-333333333337', '皮膚科', true),
  ('33333333-3333-4333-8333-333333333338', '眼科', true),
  ('33333333-3333-4333-8333-333333333339', '耳鼻咽喉科', true),
  ('33333333-3333-4333-8333-33333333333a', 'その他', true),
  ('33333333-3333-4333-8333-33333333333b', '未定', true)
on conflict (name) do update
set is_active = excluded.is_active;

insert into job_categories (id, code, name)
values
  ('44444444-4444-4444-8444-444444444441', 'other', 'その他'),
  ('44444444-4444-4444-8444-444444444442', 'clinical', '臨床補助'),
  ('44444444-4444-4444-8444-444444444443', 'research', '研究補助')
on conflict (code) do update
set name = excluded.name;

insert into employment_types (id, code, name)
values
  ('55555555-5555-4555-8555-555555555551', 'other', 'その他'),
  ('55555555-5555-4555-8555-555555555552', 'part_time', 'アルバイト'),
  ('55555555-5555-4555-8555-555555555553', 'internship', 'インターン')
on conflict (code) do update
set name = excluded.name;

commit;
