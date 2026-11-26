-- اتزان: دخول المعلمات برمز من ٤ أرقام. شغّليه مرة واحدة في Supabase ← SQL Editor ← Run
-- (يتطلب أن تكوني شغّلتِ supabase-teachers.sql سابقًا)
grant usage on schema public to service_role;
grant select, insert, update, delete on public.docs to service_role;
grant select, insert, update, delete on public.staff_emails to service_role;
