-- اتزان: إعداد قاعدة البيانات. الصقيه كاملًا في Supabase ← SQL Editor ← Run
-- قبل التشغيل: غيّري البريد في آخر الملف إلى بريدك.

create table if not exists public.docs (
  coll text not null,
  id text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);
alter table public.docs enable row level security;

create table if not exists public.staff_emails (email text primary key);
alter table public.staff_emails enable row level security;   -- بلا سياسات: لا أحد يقرؤها من الموقع

-- هل المستخدم الحالي من الموظفات (مسجّل بإيميل وكلمة سر وموجود في القائمة)؟
create or replace function public.is_staff() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
     and exists (select 1 from public.staff_emails s
                 where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

revoke all on public.docs from anon, authenticated;
grant select, insert, update, delete on public.docs to authenticated;

drop policy if exists staff_all on public.docs;
drop policy if exists public_read on public.docs;
drop policy if exists own_read on public.docs;
drop policy if exists own_insert on public.docs;
drop policy if exists own_update on public.docs;

-- الموظفات: كل شيء
create policy staff_all on public.docs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- الجميع: قراءة المواعيد المحجوزة (بلا أسماء) وإعدادات المقاييس والبرامج المعروضة
create policy public_read on public.docs for select to authenticated
  using (coll in ('slots', 'config'));

-- كل زائرة: تقرأ وتكتب وثيقتها هي فقط (شكوى / استشارة / حجز / نتيجة مقياس / مشاركة)
create policy own_read on public.docs for select to authenticated
  using (coll in ('inbox','bookings','scaleResults','parts','slots') and id = auth.uid()::text);
create policy own_insert on public.docs for insert to authenticated
  with check (coll in ('inbox','bookings','scaleResults','parts','slots') and id = auth.uid()::text
              and pg_column_size(data) < 300000);
create policy own_update on public.docs for update to authenticated
  using (coll in ('inbox','bookings','scaleResults','parts','slots') and id = auth.uid()::text)
  with check (coll in ('inbox','bookings','scaleResults','parts','slots') and id = auth.uid()::text
              and pg_column_size(data) < 300000);

-- مخزن الصور والفيديوهات (خاص: للموظفات فقط)
insert into storage.buckets (id, name, public) values ('media', 'media', false)
on conflict (id) do nothing;
drop policy if exists staff_media on storage.objects;
create policy staff_media on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_staff())
  with check (bucket_id = 'media' and public.is_staff());

-- أضيفي بريدك (ثم بريد كل معلمة موكلة) هنا:
insert into public.staff_emails (email) values ('ضعي-بريدك@example.com') on conflict do nothing;
