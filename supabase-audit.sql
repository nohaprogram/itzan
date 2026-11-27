-- اتزان: سجل النشاط (من فعل ماذا ومتى). شغّليه مرة واحدة في Supabase ← SQL Editor ← Run
-- (يتطلب أنك شغّلتِ supabase-teachers.sql سابقًا)
-- المعلمات يستطعن إضافة سجل فقط: لا يقرأن السجل ولا يعدّلنه ولا يحذفنه.
-- الموجهة وحدها تقرأ السجل (بصلاحيتها العامة).

drop policy if exists audit_staff_insert on public.docs;
create policy audit_staff_insert on public.docs for insert to authenticated
  with check (public.is_staff() and coll = 'audit');
