-- اتزان: حفظ بيان المتأخرات دراسيًا لتراه الموجهة. شغّليه مرة واحدة في Supabase ← SQL Editor ← Run
-- (يتطلب أنك شغّلتِ supabase-teachers.sql سابقًا)
-- كل معلمة تكتب وتقرأ سجلها هي فقط، والموجهة ترى الجميع.

drop policy if exists lag_teacher_read on public.docs;
drop policy if exists lag_teacher_write on public.docs;
drop policy if exists lag_teacher_update on public.docs;

create policy lag_teacher_read on public.docs for select to authenticated
  using (public.is_staff() and coll = 'lagRows' and lower(coalesce(auth.jwt() ->> 'email','')) = 't' || id || '@teachers.example.com');
create policy lag_teacher_write on public.docs for insert to authenticated
  with check (public.is_staff() and coll = 'lagRows' and lower(coalesce(auth.jwt() ->> 'email','')) = 't' || id || '@teachers.example.com');
create policy lag_teacher_update on public.docs for update to authenticated
  using (public.is_staff() and coll = 'lagRows' and lower(coalesce(auth.jwt() ->> 'email','')) = 't' || id || '@teachers.example.com')
  with check (public.is_staff() and coll = 'lagRows' and lower(coalesce(auth.jwt() ->> 'email','')) = 't' || id || '@teachers.example.com');
