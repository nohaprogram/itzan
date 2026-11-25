-- تشغيل مرة واحدة في Supabase → SQL Editor: عدّاد الزوار
drop policy if exists own_read on public.docs;
drop policy if exists own_insert on public.docs;
drop policy if exists own_update on public.docs;
create policy own_read on public.docs for select to authenticated
  using (coll in ('inbox','bookings','scaleResults','parts','slots','visits') and id = auth.uid()::text);
create policy own_insert on public.docs for insert to authenticated
  with check (coll in ('inbox','bookings','scaleResults','parts','slots','visits') and id = auth.uid()::text
              and pg_column_size(data) < 300000);
create policy own_update on public.docs for update to authenticated
  using (coll in ('inbox','bookings','scaleResults','parts','slots','visits') and id = auth.uid()::text)
  with check (coll in ('inbox','bookings','scaleResults','parts','slots','visits') and id = auth.uid()::text
              and pg_column_size(data) < 300000);

create or replace function public.visit_stats() returns json
language sql security definer set search_path = public as $$
  select json_build_object(
    'visitors', count(*),
    'visits', coalesce(sum(case when (data->>'n') ~ '^[0-9]+$' then (data->>'n')::int else 1 end), 0))
  from public.docs where coll = 'visits';
$$;
revoke all on function public.visit_stats() from public;
grant execute on function public.visit_stats() to authenticated;
