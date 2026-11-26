// وظيفة Vercel: إدارة حسابات الموظفات من داخل الموقع (لموجهة الطالبات فقط).
// المفتاح السري يُوضع في Vercel ← Settings ← Environment Variables باسم SUPABASE_SERVICE_KEY ولا يظهر للمتصفح.
const URL_ = process.env.SUPABASE_URL || "https://dhvcrpidxpoyftxfltca.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_T4bnZP02hm4trJNQ7cTxXw_2iRdrd6F";
const SVC = process.env.SUPABASE_SERVICE_KEY;

const J = (res, code, o) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
const emailOk = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

module.exports = async (req, res) => {
  if (req.method !== "POST") return J(res, 405, { error: "method" });
  if (!SVC) return J(res, 500, { error: "no-service-key" });
  const tok = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!tok) return J(res, 401, { error: "auth" });
  // التحقق أن المتصلة موجهة الطالبات
  const c = await fetch(URL_ + "/rest/v1/rpc/is_counselor", { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: "{}" });
  if (!c.ok) return J(res, 500, { error: "rpc-failed", detail: c.status + " " + (await c.text()).slice(0, 200) });
  if ((await c.json()) !== true) return J(res, 403, { error: "not-counselor" });

  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const H = { apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json" };
  const email = String(b.email || "").trim().toLowerCase();

  if (b.action === "list") {
    const r = await fetch(URL_ + "/rest/v1/staff_emails?select=email,role&order=email", { headers: H });
    const t = await r.text();
    if (!r.ok) return J(res, 500, { error: "list-failed", detail: r.status + " " + t.slice(0, 200) });
    return J(res, 200, { list: JSON.parse(t) });
  }
  if (!emailOk(email)) return J(res, 400, { error: "bad-email" });

  if (b.action === "add") {
    const role = b.role === "counselor" ? "counselor" : "teacher";
    const pw = String(b.password || "");
    if (pw.length < 8) return J(res, 400, { error: "short-password" });
    const u = await fetch(URL_ + "/auth/v1/admin/users", { method: "POST", headers: H, body: JSON.stringify({ email, password: pw, email_confirm: true }) });
    if (!u.ok) {
      const t = await u.json().catch(() => ({}));
      const exists = u.status === 422 || /already|registered|exists/i.test(JSON.stringify(t));
      if (!exists) return J(res, 400, { error: "create-failed", detail: t.msg || t.message || "" });
      // الحساب موجود: نحدّث كلمة المرور
      const l = await fetch(URL_ + "/auth/v1/admin/users?per_page=1000", { headers: H });
      const users = ((await l.json()).users) || [];
      const f = users.find(x => (x.email || "").toLowerCase() === email);
      if (f) await fetch(URL_ + "/auth/v1/admin/users/" + f.id, { method: "PUT", headers: H, body: JSON.stringify({ password: pw, email_confirm: true }) });
    }
    const s = await fetch(URL_ + "/rest/v1/staff_emails?on_conflict=email", { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ email, role }) });
    if (!s.ok) return J(res, 500, { error: "staff-insert" });
    return J(res, 200, { ok: true });
  }
  if (b.action === "remove") {
    const me = await fetch(URL_ + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + tok } });
    if (((await me.json()).email || "").toLowerCase() === email) return J(res, 400, { error: "self" });
    await fetch(URL_ + "/rest/v1/staff_emails?email=eq." + encodeURIComponent(email), { method: "DELETE", headers: H });
    return J(res, 200, { ok: true });
  }
  return J(res, 400, { error: "action" });
};
