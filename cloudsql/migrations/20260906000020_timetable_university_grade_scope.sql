-- 【M020】 Admin/CSV で学年 (grade) を扱うため syllabus_pages に列追加
alter table public.syllabus_pages
  add column if not exists grade smallint;

-- 学年での絞り込み用インデックス
create index if not exists ix_syllabus_pages_grade
  on public.syllabus_pages(university_id, academic_year, term_number, grade);
