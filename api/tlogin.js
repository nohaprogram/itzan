// وظيفة Vercel: دخول المعلمات برمز من ٤ أرقام (رمز عام تضعه الموجهة، ثم رمز شخصي تغيّره كل معلمة).
// تستخدم المفتاح السري SUPABASE_SERVICE_KEY (نفس المستخدم في api/staff.js) ولا يظهر للمتصفح.
const crypto = require("crypto");
const URL_ = process.env.SUPABASE_URL || "https://dhvcrpidxpoyftxfltca.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY || "sb_publishable_T4bnZP02hm4trJNQ7cTxXw_2iRdrd6F";
const SVC = process.env.SUPABASE_SERVICE_KEY;
const DOM = "@teachers.example.com";
const MAXFAIL = 5, IPFAIL = 40, LOCKMS = 15 * 60 * 1000;

const J = (res, code, o) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(o)); };
const H = () => ({ apikey: SVC, Authorization: "Bearer " + SVC, "Content-Type": "application/json" });
const codeOk = c => /^[0-9]{4}$/.test(String(c || ""));
const hash = (id, code) => crypto.createHash("sha256").update("itzan|" + id + "|" + code + "|" + SVC).digest("hex");
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const derivedPw = id => crypto.createHmac("sha256", SVC).update("teacher-pw|" + id).digest("hex");

async function getDoc(coll, id) {
  const r = await fetch(URL_ + "/rest/v1/docs?select=data&coll=eq." + coll + "&id=eq." + encodeURIComponent(id), { headers: H(), signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("db-read");
  const a = await r.json();
  return a[0] ? a[0].data : null;
}
async function putDoc(coll, id, data) {
  const r = await fetch(URL_ + "/rest/v1/docs?on_conflict=coll,id", { method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ coll, id, data, updated_at: new Date().toISOString() }) });
  if (!r.ok) throw new Error("db-write");
}
async function delDoc(coll, id) {
  await fetch(URL_ + "/rest/v1/docs?coll=eq." + coll + "&id=eq." + encodeURIComponent(id), { method: "DELETE", headers: H() });
}
async function teacherList() {
  const d = await getDoc("lists", "main");
  return ((d && d.teachers) || []).filter(t => t && t.id !== undefined && t.n);
}
async function lockState(key) {
  const d = await getDoc("tlock", key);
  if (!d) return { n: 0, until: 0 };
  if (d.until && d.until < Date.now()) return { n: 0, until: 0 };
  return d;
}
async function fail(key, max) {
  const s = await lockState(key); s.n = (s.n || 0) + 1;
  if (s.n >= max) s.until = Date.now() + LOCKMS;
  await putDoc("tlock", key, s);
}
async function isCounselor(tok) {
  const c = await fetch(URL_ + "/rest/v1/rpc/is_counselor", { method: "POST", headers: { apikey: ANON, Authorization: "Bearer " + tok, "Content-Type": "application/json" }, body: "{}" });
  return c.ok && (await c.json()) === true;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return J(res, 405, { error: "method" });
  if (!SVC) return J(res, 500, { error: "no-service-key" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const tok = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    // ----- عامة: أسماء المعلمات لقائمة الاختيار -----
    if (b.action === "names") {
      const sh = await getDoc("tcodes", "shared");
      const list = (await teacherList()).map(t => ({ id: String(t.id), n: t.n }));
      return J(res, 200, { enabled: !!(sh && sh.code), names: list });
    }

    // ----- عامة: دخول معلمة -----
    if (b.action === "login") {
      const id = String(b.id || ""), code = String(b.code || "");
      const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || "ip").trim();
      const [lt, li] = [await lockState("t:" + id), await lockState("ip:" + ip)];
      if ((lt.until && lt.until > Date.now()) || (li.until && li.until > Date.now())) return J(res, 429, { error: "locked" });
      if (!codeOk(code)) return J(res, 400, { error: "bad-code" });
      const t = (await teacherList()).find(x => String(x.id) === id);
      const sh = await getDoc("tcodes", "shared");
      if (!t || !sh || !sh.code) return J(res, 403, { error: "wrong" });
      const mine = await getDoc("tcodes", id);
      const ok = mine && mine.h ? same(mine.h, hash(id, code)) : same(sh.code, code);
      if (!ok) { await fail("t:" + id, MAXFAIL); await fail("ip:" + ip, IPFAIL); return J(res, 403, { error: "wrong" }); }
      await delDoc("tlock", "t:" + id);
      const email = "t" + id + DOM, pw = derivedPw(id);
      const u = await fetch(URL_ + "/auth/v1/admin/users", { method: "POST", headers: H(), body: JSON.stringify({ email, password: pw, email_confirm: true }) });
      if (!u.ok && u.status !== 422) {
        const x = await u.json().catch(() => ({}));
        if (!/already|registered|exists/i.test(JSON.stringify(x))) return J(res, 500, { error: "create-failed" });
      }
      const s = await fetch(URL_ + "/rest/v1/staff_emails?on_conflict=email", { method: "POST", headers: { ...H(), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ email, role: "teacher" }) });
      if (!s.ok) return J(res, 500, { error: "staff-insert" });
      const g = await fetch(URL_ + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw }) });
      const sess = await g.json().catch(() => ({}));
      if (!g.ok || !sess.access_token) return J(res, 500, { error: "signin-failed" });
      return J(res, 200, { ok: true, session: sess, name: t.n, personal: !!(mine && mine.h) });
    }

    if (!tok) return J(res, 401, { error: "auth" });

    // ----- معلمة مسجّلة: تغيير رمزها -----
    if (b.action === "setcode") {
      if (!codeOk(b.code)) return J(res, 400, { error: "bad-code" });
      const me = await fetch(URL_ + "/auth/v1/user", { headers: { apikey: ANON, Authorization: "Bearer " + tok } });
      const em = me.ok ? String((await me.json()).email || "").toLowerCase() : "";
      const m = em.match(/^t(\d+)@teachers\.example\.com$/);
      if (!m) return J(res, 403, { error: "not-teacher" });
      await putDoc("tcodes", m[1], { h: hash(m[1], b.code), at: Date.now() });
      return J(res, 200, { ok: true });
    }

    // ----- الموجهة فقط -----
    if (!(await isCounselor(tok))) return J(res, 403, { error: "not-counselor" });
    if (b.action === "status") {
      const sh = await getDoc("tcodes", "shared");
      const r = await fetch(URL_ + "/rest/v1/docs?select=id&coll=eq.tcodes", { headers: H() });
      const ids = r.ok ? (await r.json()).map(x => x.id).filter(x => x !== "shared") : [];
      return J(res, 200, { shared: (sh && sh.code) || "", personal: ids });
    }
    if (b.action === "setshared") {
      if (!codeOk(b.code)) return J(res, 400, { error: "bad-code" });
      await putDoc("tcodes", "shared", { code: String(b.code), at: Date.now() });
      return J(res, 200, { ok: true });
    }
    if (b.action === "resetone") {
      const id = String(b.id || "");
      if (!/^\d+$/.test(id)) return J(res, 400, { error: "bad-id" });
      await delDoc("tcodes", id); await delDoc("tlock", "t:" + id);
      return J(res, 200, { ok: true });
    }
    return J(res, 400, { error: "action" });
  } catch (e) {
    return J(res, 500, { error: "server", detail: String(e.message || e).slice(0, 120) });
  }
};
