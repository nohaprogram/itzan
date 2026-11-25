-- اتزان: دور «معلمة» بصلاحيات أضيق. شغّليه مرة واحدة في Supabase ← SQL Editor ← Run
-- المرشدة: كل شيء. المعلمة: نماذج المعلمات + شواهد البرامج + قراءة القوائم فقط (لا ترى الوارد ولا الحجوزات ولا نتائج المقاييس).

grant usage on schema public to service_role;
grant select, insert, update, delete on public.staff_emails to service_role;

alter table public.staff_emails add column if not exists role text not null default 'counselor';

create or replace function public.is_counselor() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and exists (select 1 from public.staff_emails s
                 where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and s.role = 'counselor');
$$;
revoke all on function public.is_counselor() from public, anon;
grant execute on function public.is_counselor() to authenticated;

create or replace function public.staff_role() returns text
language sql security definer stable set search_path = public as $$
  select s.role from public.staff_emails s
  where coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')) limit 1;
$$;
revoke all on function public.staff_role() from public, anon;
grant execute on function public.staff_role() to authenticated;

drop policy if exists staff_all on public.docs;
drop policy if exists counselor_all on public.docs;
drop policy if exists teacher_read on public.docs;
drop policy if exists teacher_write on public.docs;
drop policy if exists teacher_update on public.docs;
drop policy if exists teacher_delete on public.docs;

create policy counselor_all on public.docs for all to authenticated
  using (public.is_counselor()) with check (public.is_counselor());

create policy teacher_read on public.docs for select to authenticated
  using (public.is_staff() and coll in ('lists','progStaff','config'));
create policy teacher_write on public.docs for insert to authenticated
  with check (public.is_staff() and ((coll = 'progStaff') or (coll = 'config' and id in ('progs','homeStats'))));
create policy teacher_update on public.docs for update to authenticated
  using (public.is_staff() and ((coll = 'progStaff') or (coll = 'config' and id in ('progs','homeStats'))))
  with check (public.is_staff() and ((coll = 'progStaff') or (coll = 'config' and id in ('progs','homeStats'))));

-- إضافة معلمة (غيّري البريد):
-- insert into public.staff_emails (email, role) values ('teacher@alzikr.edu.sa', 'teacher') on conflict (email) do update set role = 'teacher';
