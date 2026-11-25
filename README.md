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
2. من **Authentication ← Sign In / Providers** فعّلي **Allow anonymous sign-ins** (واتركي التسجيل الحر كما هو).
3. افتحي **SQL Editor**، غيّري البريد في آخر `supabase.sql` إلى بريدك، ثم الصقي الملف كاملًا واضغطي Run.
4. من **Authentication ← Users ← Add user**: أضيفي بريدك وكلمة سر، وفعّلي Auto Confirm User. كرّري لكل معلمة موكلة، ثم أضيفي بريدها في جدول `staff_emails`.
5. من **Project Settings ← API** انسخي `Project URL` و`anon public` إلى `config.js`.
6. **Vercel**: Add New Project ← اختاري هذا المستودع ← Deploy (لا إعدادات إضافية).
7. افتحي `رابط-الموقع/admin` وسجلي الدخول.

## دور «معلمة»
شغّلي `supabase-teachers.sql` مرة واحدة، ثم أضيفي كل معلمة بالسطر الأخير فيه (`role = 'teacher'`). المعلمة ترى نماذج المعلمات وشواهد البرامج وقراءة القوائم فقط.

## إضافة الموظفات من الموقع
لوحة المرشدة ← «حسابات الموظفات». تحتاج متغيرًا سريًا في Vercel: Settings ← Environment Variables ← الاسم `SUPABASE_SERVICE_KEY` والقيمة مفتاح `secret` من Supabase ← Settings ← API Keys. ثم Redeploy. لا يوضع في GitHub.
