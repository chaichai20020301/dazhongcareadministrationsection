/* 員工教育訓練系統 — 共用程式（學習頁 / 管理頁 / 編輯頁共用） */

/* ====== 設定 ====== */
var TRAIN_API   = "";   /* 後端（Apps Script /exec 網址）。空白＝示範模式 */
var TRAIN_TOKEN = "";   /* 後端有設 API_TOKEN 才需要 */

var ROOT = new URL(".", document.currentScript.src).href;

/* ====== 工具 ====== */
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function fmtDate(d) { return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function today() { return fmtDate(new Date()); }
function addDays(s, n) { var d = new Date(s); d.setDate(d.getDate() + Number(n)); return fmtDate(d); }
function toast(m) { var t = document.createElement("div"); t.className = "toast"; t.textContent = m; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
function safeUrl(u) { u = String(u || "").trim(); return /^https?:\/\//i.test(u) ? u : ""; }

/* ====== 線條圖示（與設計稿一致）。icon 欄位存圖示名稱；舊資料若是 emoji 就原樣顯示 ====== */
var ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4.1 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  award: '<circle cx="12" cy="8" r="6"/><path d="M15.5 12.9 17 22l-5-3-5 3 1.5-9.1"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4A2 2 0 0 0 7 17.8V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6.5C9 13.8 11 13 13 11"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  crown: '<path d="m2 8 4 4 6-8 6 8 4-4-2 12H4z"/>',
  cap: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
  pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/>',
  paperclip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>'
};
function ico(name, size, extra) {
  size = size || 20;
  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + ">" + (ICONS[name] || "") + "</svg>";
}
/* 取使用者設定的圖示：名稱→線條圖示；其他（舊的 emoji 或文字）→原樣顯示 */
function iconOr(v, size, dflt) {
  v = v || dflt || "book";
  return ICONS[v] ? ico(v, size) : '<span style="font-size:' + Math.round(size * .9) + 'px;line-height:1">' + esc(v) + "</span>";
}

var ME = (lsGet("handover_name") || "").trim();
if (!ME) { ME = (prompt("請輸入你的名字（與入口網站登入名字一致）") || "").trim() || "訪客"; lsSet("handover_name", ME); }

/* ====== 資料層 ====== */
var DEMO = !TRAIN_API;
var DB = null;

async function api(action, data) {
  if (DEMO) return demoApi(action, data || {});
  var r = await fetch(TRAIN_API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(Object.assign({ action: action, user: ME, token: TRAIN_TOKEN }, data || {})) });
  var j = await r.json();
  if (!j.ok) throw new Error(j.error || "失敗");
  return j;
}

/* 示範模式：同樣的動作存 localStorage */
var DEMO_KEY = "train_demo_v2";
function demoState() {
  var s = null; try { s = JSON.parse(lsGet(DEMO_KEY)); } catch (e) {}
  if (s) return s;
  var jd = addDays(today(), -3);
  s = {
    tracks: [
      { id: "T1", name: "新入住作業", icon: "home", sort: 1 },
      { id: "T2", name: "環境與安全", icon: "shield", sort: 2 }
    ],
    levels: [
      { id: "L1", trackId: "T1", name: "新入住 1級", threshold: 10 },
      { id: "L2", trackId: "T1", name: "新入住 2級", threshold: 25 },
      { id: "L3", trackId: "T2", name: "安全 1級", threshold: 8 }
    ],
    skills: [
      { id: "S1", trackId: "T1", levelId: "L1", name: "入住流程認識", icon: "clipboard", points: 5, required: true, dueDays: 14, practical: false, passScore: 80, prereq: "", desc: "了解住民入住當天的行政流程與應備文件。", materials: [{ title: "範例講義（請換成實際連結）", url: "https://example.com" }],
        questions: [{ q: "住民入住當天，行政第一步應做什麼？", o: ["核對身分與入住文件", "直接帶進房間", "先收費用"], a: 0 }, { q: "入住文件缺漏時應如何處理？", o: ["忽略", "通知家屬補齊並記錄", "自行補填"], a: 1 }], sort: 1 },
      { id: "S2", trackId: "T1", levelId: "L1", name: "住民資料建檔", icon: "folder", points: 5, required: true, dueDays: 14, practical: true, passScore: 80, prereq: "", desc: "在系統建立住民基本資料。通過測驗後需主管實作簽核。", materials: [], questions: [{ q: "住民資料建檔後應？", o: ["核對一次再存檔", "不用檢查"], a: 0 }], sort: 2 },
      { id: "S3", trackId: "T1", levelId: "L2", name: "入住費用說明", icon: "banknote", points: 8, required: false, dueDays: 0, practical: false, passScore: 80, prereq: "S1", desc: "向家屬說明入住費用組成。", materials: [], questions: [{ q: "費用說明應包含？", o: ["月費與代墊項目", "只有月費"], a: 0 }], sort: 1 },
      { id: "S4", trackId: "T1", levelId: "L2", name: "入住後追蹤", icon: "phone", points: 10, required: false, dueDays: 0, practical: false, passScore: 80, prereq: "S3", desc: "入住後一週的家屬追蹤與回報。", materials: [], questions: [{ q: "入住後追蹤的重點？", o: ["適應狀況與家屬回饋", "只看帳務"], a: 0 }], sort: 2 },
      { id: "S5", trackId: "T2", levelId: "L3", name: "防火逃生", icon: "flame", points: 4, required: true, dueDays: 30, practical: false, passScore: 80, prereq: "", desc: "", materials: [], questions: [{ q: "發現火源第一步？", o: ["通報並引導避難", "自己先滅火"], a: 0 }], sort: 1 },
      { id: "S6", trackId: "T2", levelId: "L3", name: "感染管制", icon: "droplet", points: 4, required: true, dueDays: 30, practical: false, passScore: 80, prereq: "", desc: "", materials: [], questions: [{ q: "接觸住民前應？", o: ["洗手", "戴手套即可"], a: 0 }], sort: 2 }
    ],
    staff: [
      { name: ME, dept: "行政", email: "", joinDate: jd },
      { name: "王小明", dept: "行政", email: "", joinDate: addDays(today(), -40) },
      { name: "李小華", dept: "行政", email: "", joinDate: addDays(today(), -10) }
    ],
    progress: [
      { key: "王小明|S1", name: "王小明", skillId: "S1", status: "done", score: 100, attempts: 1, passedAt: addDays(today(), -30) },
      { key: "王小明|S2", name: "王小明", skillId: "S2", status: "awaiting", score: 100, attempts: 2, passedAt: addDays(today(), -1) },
      { key: "李小華|S5", name: "李小華", skillId: "S5", status: "done", score: 90, attempts: 1, passedAt: addDays(today(), -5) }
    ],
    settings: { managers: "", reminderEmails: "", reminderDays: "7" }
  };
  lsSet(DEMO_KEY, JSON.stringify(s)); return s;
}
function demoApi(a, p) {
  var s = demoState(), save = function () { lsSet(DEMO_KEY, JSON.stringify(s)); };
  if (!s.staff.some(function (x) { return x.name === ME; })) { s.staff.push({ name: ME, dept: "行政", email: "", joinDate: "" }); save(); }
  var keyOf = { "職能": ["tracks", "id"], "等級": ["levels", "id"], "技能": ["skills", "id"], "員工": ["staff", "name"] };
  if (a === "load") return Promise.resolve(Object.assign({ ok: true, me: { name: ME, isEditor: true } }, JSON.parse(JSON.stringify(s))));
  if (a === "save") {
    if (p.table === "設定") { s.settings = p.row; }
    else { var m = keyOf[p.table], arr = s[m[0]], i = arr.findIndex(function (x) { return x[m[1]] === p.row[m[1]]; }); if (i >= 0) arr[i] = p.row; else arr.push(p.row); }
    save(); return Promise.resolve({ ok: true });
  }
  if (a === "remove") {
    var m2 = keyOf[p.table]; s[m2[0]] = s[m2[0]].filter(function (x) { return x[m2[1]] !== p.id; });
    if (p.table === "職能") { s.levels = s.levels.filter(function (x) { return x.trackId !== p.id; }); s.skills = s.skills.filter(function (x) { return x.trackId !== p.id; }); }
    save(); return Promise.resolve({ ok: true });
  }
  if (a === "submitQuiz") {
    var sk = s.skills.find(function (x) { return x.id === p.skillId; }), right = 0;
    sk.questions.forEach(function (q, i) { if (Number(p.answers[i]) === Number(q.a)) right++; });
    var score = sk.questions.length ? Math.round(right * 100 / sk.questions.length) : 0, passed = score >= Number(sk.passScore || 80);
    var key = ME + "|" + sk.id, r = s.progress.find(function (x) { return x.key === key; });
    if (!r) { r = { key: key, name: ME, skillId: sk.id, status: "", score: 0, attempts: 0 }; s.progress.push(r); }
    r.attempts++;
    if (r.status !== "done") { r.score = Math.max(r.score, score); if (passed) { r.status = sk.practical ? "awaiting" : "done"; r.passedAt = today(); } }
    save(); return Promise.resolve({ ok: true, score: score, passed: passed, status: r.status });
  }
  if (a === "signoff") {
    var r2 = s.progress.find(function (x) { return x.key === p.name + "|" + p.skillId; });
    if (p.approve) { r2.status = "done"; r2.signedBy = ME; r2.signedAt = today(); } else { r2.status = ""; r2.signedBy = ""; r2.signedAt = ""; }
    save(); return Promise.resolve({ ok: true });
  }
  if (a === "remind") return Promise.resolve({ ok: true, sent: 0 });
  return Promise.reject(new Error("未知動作"));
}

/* ====== 計算 ====== */
function prog(name, skillId) { return DB.progress.find(function (r) { return r.name === name && r.skillId === skillId; }); }
function isDone(name, skillId) { var r = prog(name, skillId); return !!r && r.status === "done"; }
function trackPoints(name, trackId) {
  return DB.skills.filter(function (s) { return s.trackId === trackId && isDone(name, s.id); }).reduce(function (a, s) { return a + Number(s.points || 0); }, 0);
}
function trackLevels(trackId) { return DB.levels.filter(function (l) { return l.trackId === trackId; }).sort(function (a, b) { return a.threshold - b.threshold; }); }
function levelOf(name, trackId) {
  var pts = trackPoints(name, trackId), got = null, next = null;
  trackLevels(trackId).forEach(function (l) { if (pts >= Number(l.threshold)) got = l; else if (!next) next = l; });
  return { pts: pts, got: got, next: next };
}
function staffOf(name) { return DB.staff.find(function (s) { return s.name === name; }) || {}; }
function dueOf(name, sk) {
  if (!sk.required || !Number(sk.dueDays)) return "";
  var jd = staffOf(name).joinDate; return jd ? addDays(jd, sk.dueDays) : "";
}
function nodeState(name, sk) {
  var r = prog(name, sk.id);
  if (r && r.status === "done") return "done";
  if (r && r.status === "awaiting") return "awaiting";
  if (sk.prereq && !isDone(name, sk.prereq)) return "locked";
  return "open";
}

/* ====== 版面 ====== */
function modal(html, wide) {
  closeModal();
  var d = document.createElement("div"); d.className = "modalbg"; d.id = "modal";
  d.innerHTML = '<div class="modal' + (wide ? " wide" : "") + '">' + html + "</div>";
  d.addEventListener("mousedown", function (e) { if (e.target === d) closeModal(); });
  document.body.appendChild(d);
}
function closeModal() { var m = $("modal"); if (m) m.remove(); }

/* 頁面頂端切換列：學習 / 管理 / 編輯 */
function navHtml(active) {
  var t = [["learn", "技能樹", ROOT + "index.html"]];
  if (DB.me.isEditor) { t.push(["manage", "管理", ROOT + "manage/index.html"]); t.push(["edit", "編輯", ROOT + "editor/index.html"]); }
  return t.map(function (x) { return '<a class="tab' + (active === x[0] ? " on" : "") + '" href="' + x[2] + '">' + x[1] + "</a>"; }).join("");
}

/* 啟動：載入資料 → 呼叫該頁的 render()。opts.needEditor 為 true 時，非管理者看到提示 */
async function reload() {
  DB = await api("load");
  pageRender();
}
var pageRender = function () {};
function boot(render, opts) {
  opts = opts || {};
  pageRender = function () {
    $("who").textContent = ME + (DB.me.isEditor ? "（管理者）" : "");
    $("demoBanner").classList.toggle("hide", !DEMO);
    $("tabs").innerHTML = navHtml(opts.active);
    if (opts.needEditor && !DB.me.isEditor) { $("view").innerHTML = '<div class="card">這個頁面只有管理者可以使用。</div>'; return; }
    render();
  };
  reload().catch(function (e) { $("view").innerHTML = '<div class="card">載入失敗：' + esc(e.message) + "</div>"; });
}
