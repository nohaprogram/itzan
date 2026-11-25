# اتزان — الإرشاد الطلابي

موقع إرشادي عربي: جانب مفتوح للطالبات وأولياء الأمور، وصفحة `/admin` للمرشدة والمعلمات الموكلات.

> المستودع عام. **لا تضعي فيه أسماء الطالبات ولا بيانات الموظفات.** تُحفظ في قاعدة البيانات فقط.

## الملفات
- `index.html` — الموقع كاملًا
- `config.js` — بيانات الاتصال بقاعدة البيانات (تملئينها أنتِ)
- `backend.js` — الربط مع Supabase
- `supabase.sql` — يُشغَّل مرة واحدة لإنشاء الجداول وقواعد الحماية
- `templates.json` — قوالب نماذج Word
- `vercel.json` — إعدادات النشر

## التشغيل (مرة واحدة)
1. **Supabase**: أنشئي مشروعًا مجانيًا على supabase.com.
2. من **Authentication ← Sign In / Providers** فعّلي **Allow anonymous sign-ins**، وعطّلي **Allow new users to sign up**.
3. افتحي **SQL Editor**، غيّري البريد في آخر `supabase.sql` إلى بريدك، ثم الصقي الملف كاملًا واضغطي Run.
4. من **Authentication ← Users ← Add user**: أضيفي بريدك وكلمة سر، وفعّلي Auto Confirm User. كرّري لكل معلمة موكلة، ثم أضيفي بريدها في جدول `staff_emails`.
5. من **Project Settings ← API** انسخي `Project URL` و`anon public` إلى `config.js`.
6. **Vercel**: Add New Project ← اختاري هذا المستودع ← Deploy (لا إعدادات إضافية).
7. افتحي `رابط-الموقع/admin` وسجلي الدخول.
