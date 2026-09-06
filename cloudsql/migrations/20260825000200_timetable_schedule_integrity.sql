alter table public.syllabus_class_entries
  add constraint syllabus_class_entries_schedule_shape_check
  check (
    not is_active
    or (
      jsonb_typeof(schedule) = 'object'
      and schedule ? 'day'
      and jsonb_typeof(schedule -> 'day') = 'string'
      and schedule ->> 'day' in ('月', '火', '水', '木', '金')
      and schedule ? 'period'
      and jsonb_typeof(schedule -> 'period') = 'number'
      and schedule ->> 'period' ~ '^[1-6]$'
      and (not (schedule ? 'starts_at') or jsonb_typeof(schedule -> 'starts_at') in ('string', 'null'))
      and (not (schedule ? 'ends_at') or jsonb_typeof(schedule -> 'ends_at') in ('string', 'null'))
    )
  ) not valid;
