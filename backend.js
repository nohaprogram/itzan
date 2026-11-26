/* backend.js — يربط الموقع بـ Supabase عبر واجهة REST مباشرة (بدون مكتبات).
   يوفّر نفس الواجهة التي يستخدمها الموقع: user / db / assets / downloads. */
(function(){
  "use strict";
  var C = window.ITZAN_CONFIG || {};
  var URL_ = (C.SUPABASE_URL || "").replace(/\/+$/, ""), KEY = C.SUPABASE_ANON_KEY || "";
  var ON = !!(URL_ && KEY), SKEY = "itzan.session.v1";
  var sess = null, staffFlag = null, authP = null;

  function load(){ try{ return JSON.parse(localStorage.getItem(SKEY) || "null"); }catch(e){ return null; } }
  function save(s){ sess = s; try{ if(s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); }catch(e){} }
  function norm(r){
    if(!r || !r.access_token) throw new Error("auth");
    return {at:r.access_token, rt:r.refresh_token, exp:Date.now() + (r.expires_in || 3600) * 1000 - 60000,
            uid:r.user && r.user.id, anon:!!(r.user && (r.user.is_anonymous || !r.user.email)), email:r.user && r.user.email};
  }
  async function authCall(path, body){
    var res = await fetch(URL_ + "/auth/v1/" + path, {method:"POST", headers:{"apikey":KEY, "Content-Type":"application/json"}, body:JSON.stringify(body || {})});
    var j = await res.json().catch(function(){ return {}; });
    if(!res.ok){ var e = new Error(j.msg || j.error_description || j.message || "auth"); e.code = j.error_code || res.status; throw e; }
    return j;
  }
  async function ensure(){
    if(authP) return authP;
    authP = (async function(){
      var s = sess || load();
      if(s && s.exp > Date.now()){ sess = s; return s; }
      if(s && s.rt){
        try{ var r = await authCall("token?grant_type=refresh_token", {refresh_token:s.rt}); var n = norm(r); save(n); return n; }catch(e){ save(null); }
      }
      var a = await authCall("signup", {data:{}, gotrue_meta_security:{}});
      var m = norm(a); m.anon = true; save(m); return m;
    })();
    try{ return await authP; } finally { authP = null; }
  }
  async function hdr(extra){
    var s = await ensure(), h = {"apikey":KEY, "Authorization":"Bearer " + s.at};
    for(var k in extra) h[k] = extra[k]; return h;
  }
  async function rest(path, opt){
    opt = opt || {};
    var res = await fetch(URL_ + "/rest/v1/" + path, {method:opt.method || "GET", headers:await hdr(opt.headers || {}), body:opt.body});
    if(!res.ok){ var t = await res.text().catch(function(){ return ""; }); var e = new Error("db " + res.status + " " + t); e.status = res.status; throw e; }
    return res.status === 204 ? null : res.json().catch(function(){ return null; });
  }

  /* ---------- قاعدة البيانات: مسار «مجموعة/وثيقة» ---------- */
  var watchers = {}, poller = null;
  function splitDoc(p){ var i = p.indexOf("/"); return [p.slice(0, i), p.slice(i + 1)]; }
  async function fetchColl(coll){
    var rows = await rest("docs?select=id,data&coll=eq." + encodeURIComponent(coll));
    return rows || [];
  }
  function snapColl(rows){ return {docs: rows.map(function(r){ return {id:r.id, data:function(){ return r.data; }}; })}; }
  function snapDoc(rows, id){
    var r = rows.filter(function(x){ return x.id === id; })[0];
    return {exists: !!r, data:function(){ return r ? r.data : undefined; }};
  }
  async function tick(w){
    try{
      var rows = await fetchColl(w.coll), sig = JSON.stringify(rows);
      if(sig === w.sig) return; w.sig = sig;
      w.fns.forEach(function(f){ f.fn(w.doc ? snapDoc(rows, w.doc) : snapColl(rows)); });
    }catch(e){ w.fns.forEach(function(f){ if(f.err) f.err(e); }); }
  }
  function watch(coll, doc, fn, err){
    var key = coll + "|" + (doc || ""), w = watchers[key];
    if(!w){ w = watchers[key] = {coll:coll, doc:doc, fns:[], sig:null}; }
    w.fns.push({fn:fn, err:err}); w.sig = null; tick(w);
    if(!poller) poller = setInterval(function(){ if(document.hidden) return; Object.keys(watchers).forEach(function(k){ tick(watchers[k]); }); }, 20000);
  }
  function refreshColl(coll){ Object.keys(watchers).forEach(function(k){ if(watchers[k].coll === coll) tick(watchers[k]); }); }

  var DB = {
    doc: function(path){
      var p = splitDoc(path), coll = p[0], id = p[1];
      return {
        get: async function(){ var rows = await rest("docs?select=id,data&coll=eq." + encodeURIComponent(coll) + "&id=eq." + encodeURIComponent(id)); return snapDoc(rows || [], id); },
        set: async function(data){
          await rest("docs", {method:"POST", headers:{"Content-Type":"application/json", "Prefer":"resolution=merge-duplicates,return=minimal"},
                              body:JSON.stringify({coll:coll, id:id, data:data, updated_at:new Date().toISOString()})});
          refreshColl(coll);
        },
        onSnapshot: function(fn, err){ watch(coll, id, fn, err); }
      };
    },
    collection: function(coll){ return { onSnapshot: function(fn, err){ watch(coll, null, fn, err); } }; }
  };

  /* ---------- ملفات الصور والفيديو (للمرشدة والمعلمات الموكلات) ---------- */
  var ASSETS = {
    upload: async function(file){
      var ext = (file.name.match(/\.[A-Za-z0-9]{1,6}$/) || [""])[0].toLowerCase();
      var id = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + ext;
      var s = await ensure();
      var r = await fetch(URL_ + "/storage/v1/object/media/" + id, {method:"POST", headers:{"apikey":KEY, "Authorization":"Bearer " + s.at, "Content-Type":file.type || "application/octet-stream", "x-upsert":"false"}, body:file});
      if(!r.ok) throw new Error("upload " + r.status);
      var sg = await fetch(URL_ + "/storage/v1/object/sign/media/" + id, {method:"POST", headers:await hdr({"Content-Type":"application/json"}), body:JSON.stringify({expiresIn:31536000})});
      var j = await sg.json(); if(!sg.ok || !j.signedURL) throw new Error("sign");
      return {id:id, url:URL_ + "/storage/v1" + j.signedURL, contentType:file.type, sizeBytes:file.size};
    },
    delete: async function(id){
      var r = await fetch(URL_ + "/storage/v1/object/media/" + id, {method:"DELETE", headers:await hdr({})});
      if(!r.ok) throw new Error("delete " + r.status);
    }
  };

  /* ---------- التنزيل ---------- */
  var DL = { save: function(o){
    var blob = o.data instanceof Blob ? o.data : new Blob([o.data]);
    var a = document.createElement("a"), u = URL.createObjectURL(blob);
    a.href = u; a.download = o.filename; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); }, 1500);
    return Promise.resolve();
  }};

  /* ---------- المستخدم ---------- */
  async function checkStaff(){
    if(staffFlag !== null) return staffFlag;
    var s = await ensure();
    if(s.anon){ staffFlag = false; return false; }
    try{ var r = await rest("rpc/is_staff", {method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"}); staffFlag = (r === true); }
    catch(e){ staffFlag = false; }
    return staffFlag;
  }
  var roleCache = null;
  async function staffRole(){
    if(roleCache) return roleCache;
    try{ var r = await rest("rpc/staff_role", {method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"}); roleCache = (r === "teacher") ? "teacher" : "counselor"; }
    catch(e){ roleCache = "counselor"; }
    return roleCache;
  }
  var USER = { canEdit: checkStaff, id: async function(){ return (await ensure()).uid; }, isOwner: checkStaff };

  window.itzanAuth = {
    on: ON,
    role: staffRole,
    rpc: async function(name){ var r = await rest("rpc/"+name, {method:"POST", headers:{"Content-Type":"application/json"}, body:"{}"}); return r; },
    token: async function(){ return (await ensure()).at; },
    login: async function(email, pw){
      var r = await authCall("token?grant_type=password", {email:email, password:pw});
      var n = norm(r); n.anon = false; save(n); staffFlag = null; roleCache = null;
      var ok = await checkStaff();
      if(!ok){ save(null); staffFlag = null; throw new Error("not-staff"); }
      return true;
    },
    loginWith: async function(r){
      var n = norm(r); n.anon = false; save(n); staffFlag = null; roleCache = null;
      if(!(await checkStaff())){ save(null); staffFlag = null; throw new Error("not-staff"); }
      return true;
    },
    logout: function(){ save(null); staffFlag = null; },
    isStaff: checkStaff
  };

  window.claude = { use: async function(name){
    if(name === "downloads") return DL;
    if(!ON) return null;
    try{ await ensure(); }catch(e){ return null; }
    if(name === "user") return USER;
    if(name === "db") return DB;
    if(name === "assets") return (await checkStaff()) ? ASSETS : null;
    return null;
  }};
})();
