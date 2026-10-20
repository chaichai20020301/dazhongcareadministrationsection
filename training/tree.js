/* 技能樹畫面（學習頁與管理頁的員工檢視共用）：角色面板、技能樹、技能詳情、測驗、慶祝特效 */

var AVATARS = ["user", "star", "heart", "leaf", "sun", "bolt", "shield", "flag"];
var TITLES = [[0, "見習生"], [1, "新手"], [2, "熟手"], [4, "達人"], [7, "大師"]];

function myAvatar(name) { var a = lsGet("train_avatar_" + name); return ICONS[a] ? a : AVATARS[0]; }
function pickAvatar() {
  modal("<h2>選一個你的角色圖示</h2><div class=\"row\" style=\"margin-top:12px\">" + AVATARS.map(function (a) {
    return '<button class="btn avpick" aria-label="' + a + '" onclick="setAvatar(\'' + a + '\')">' + ico(a, 30) + "</button>"; }).join("") + "</div>");
}
function setAvatar(a) { lsSet("train_avatar_" + ME, a); closeModal(); pageRender(); }

function totalLevels(name) { return DB.tracks.reduce(function (n, t) { var pts = trackPoints(name, t.id); return n + trackLevels(t.id).filter(function (l) { return pts >= l.threshold; }).length; }, 0); }
function titleOf(name) { var n = totalLevels(name), t = TITLES[0][1]; TITLES.forEach(function (x) { if (n >= x[0]) t = x[1]; }); return t; }
function totalXp(name) { return DB.tracks.reduce(function (a, t) { return a + trackPoints(name, t.id); }, 0); }

function medalsOf(name) {
  var done = DB.skills.filter(function (s) { return isDone(name, s.id); });
  var attempts = DB.progress.filter(function (r) { return r.name === name; }).reduce(function (a, r) { return a + Number(r.attempts || 0); }, 0);
  var perfect = DB.progress.some(function (r) { return r.name === name && r.status === "done" && Number(r.score) >= 100; });
  var allTracks = DB.tracks.length > 0 && DB.tracks.every(function (t) { return !!levelOf(name, t.id).got; });
  return [
    ["check", "初次踏出：完成第 1 個技能", done.length >= 1],
    ["target", "滿分達人：測驗拿過 100 分", perfect],
    ["link", "連過三關：完成 3 個技能", done.length >= 3],
    ["award", "職能新星：取得任一職能等級", totalLevels(name) >= 1],
    ["book", "勤學不倦：累積測驗 10 次", attempts >= 10],
    ["crown", "全職能達人：每個職能都有等級", allTracks]
  ];
}

function heroHtml(name, canPick) {
  var late = DB.skills.filter(function (s) { return s.required && !isDone(name, s.id) && dueOf(name, s); }).sort(function (a, b) { return dueOf(name, a) < dueOf(name, b) ? -1 : 1; });
  var todo = late.length ? '<div class="tl">待辦必修</div><div class="tn">' + esc(late[0].name) + '</div><div class="td">期限 ' + dueOf(name, late[0]) + (dueOf(name, late[0]) < today() ? "（已逾期）" : "") + (late.length > 1 ? "，還有 " + (late.length - 1) + " 項" : "") + "</div>" : '<div class="tl">待辦必修</div><div class="td">目前沒有待辦必修</div>';
  return '<div class="hero"><div class="avatar"' + (canPick ? ' role="button" tabindex="0" onclick="pickAvatar()" title="換角色圖示"' : "") + ">" + ico(myAvatar(name), 46) + '</div><div class="info"><div class="nm">' + esc(name) + '</div><span class="title">Lv.' + totalLevels(name) + " " + titleOf(name) + '</span>' +
    '<div class="xp">' + ico("star", 16, ' fill="currentColor"') + " 總技能點 " + totalXp(name) + '</div><div class="medals">' + medalsOf(name).map(function (m) { return '<span class="medal' + (m[2] ? " on" : "") + '" title="' + esc(m[1]) + '">' + ico(m[0], 20) + "</span>"; }).join("") + '</div></div><div class="todo">' + todo + "</div></div>";
}

/* ---- 技能樹 ---- */
function treeHtml(name, readonly) {
  if (!DB.tracks.length) return '<div class="card muted">還沒有任何職能。' + (DB.me.isEditor ? '請到「編輯」頁新增。' : "") + "</div>";
  return DB.tracks.slice().sort(function (a, b) { return a.sort - b.sort; }).map(function (t) { return stageHtml(name, t, readonly); }).join("");
}
function stageHtml(name, t, readonly) {
  var L = levelOf(name, t.id), lv = trackLevels(t.id);
  var h = '<div class="stage"><div class="stagehead"><span class="ico">' + iconOr(t.icon, 28, "star") + "</span><h2>" + esc(t.name) + '</h2><span class="badge ' + (L.got ? "" : "none") + '">' + (L.got ? esc(L.got.name) : "尚未取得等級") + '</span><span class="muted">技能點 ' + L.pts + (L.next ? "，距「" + esc(L.next.name) + "」還差 " + (L.next.threshold - L.pts) + " 點" : "，已達最高等級") + '</span></div><div class="arena"><svg class="lines"></svg><div class="col">';
  h += '<div class="start got" data-id="start">' + ico("flag", 18) + " 出發</div>";
  var prev = "start";
  var groups = lv.map(function (l) { return { l: l, sk: DB.skills.filter(function (s) { return s.levelId === l.id; }) }; });
  var loose = DB.skills.filter(function (s) { return s.trackId === t.id && !lv.some(function (l) { return l.id === s.levelId; }); });
  if (loose.length) groups.unshift({ l: null, sk: loose });
  groups.forEach(function (g) {
    var sks = g.sk.slice().sort(function (a, b) { return a.sort - b.sort; });
    if (sks.length) h += '<div class="tierrow">' + sks.map(function (s) { return nodeHtml(name, s, prev, readonly); }).join("") + "</div>";
    if (g.l) {
      var got = L.pts >= Number(g.l.threshold), pct = Math.min(100, Math.round(L.pts * 100 / (Number(g.l.threshold) || 1)));
      var from = sks.length ? sks.map(function (s) { return s.id; }).join(",") : prev;
      h += '<div class="gate' + (got ? " got" : "") + '" data-id="G' + g.l.id + '" data-from="' + from + '"><div class="gn">' + ico(got ? "award" : "lock", 18) + " " + esc(g.l.name) + '</div><div class="gp">' + (got ? "已取得" : "累積 " + L.pts + " / " + g.l.threshold + " 點") + '</div><div class="gb"><i style="width:' + pct + '%"></i></div></div>';
      prev = "G" + g.l.id;
    }
  });
  return h + "</div></div></div>";
}
function nodeHtml(name, s, prevGate, readonly) {
  var st = nodeState(name, s), due = dueOf(name, s), tag = "";
  if (st !== "done" && due) { if (due < today()) tag = '<span class="tag">逾期</span>'; else if (due <= addDays(today(), 7)) tag = '<span class="tag soon">快到期</span>'; }
  var from = s.prereq && DB.skills.some(function (x) { return x.id === s.prereq; }) ? s.prereq : prevGate;
  var sub = { done: "已完成", awaiting: "待簽核", locked: "未解鎖", open: "可挑戰" }[st];
  var bdg = { done: ico("check", 14, ' stroke-width="3.2"'), awaiting: ico("hourglass", 14), locked: ico("lock", 14), open: "" }[st];
  return '<div class="gnode ' + st + '" data-id="' + s.id + '" data-from="' + from + '"' + (readonly ? "" : " role=\"button\" tabindex=\"0\" onclick=\"openSkill('" + s.id + "')\"") + ">" + tag + '<div class="c">' + iconOr(s.icon, 30, "book") + (bdg ? '<span class="bdg">' + bdg + "</span>" : "") + '</div><div class="n">' + esc(s.name) + '</div><div class="p">' + s.points + " 點 · " + sub + "</div></div>";
}

function drawLines() {
  document.querySelectorAll(".arena").forEach(function (ar) {
    var svg = ar.querySelector("svg.lines"), box = ar.getBoundingClientRect();
    svg.setAttribute("width", ar.scrollWidth); svg.setAttribute("height", ar.scrollHeight);
    var rect = function (el) { var r = (el.querySelector(".c") || el).getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, t: r.top - box.top, b: r.bottom - box.top }; };
    var out = "";
    ar.querySelectorAll("[data-from]").forEach(function (B) {
      B.dataset.from.split(",").forEach(function (fid) {
        var A = ar.querySelector('[data-id="' + fid + '"]'); if (!A) return;
        var a = rect(A), b = rect(B), lit = A.classList.contains("done") || A.classList.contains("got") ? " lit" : "", d;
        if (Math.abs(a.t - b.t) < 24) { var y = (a.t + a.b) / 2, x1 = a.l < b.l ? a.r : a.l, x2 = a.l < b.l ? b.l : b.r; d = "M" + x1 + " " + y + " L" + x2 + " " + y; }
        else { var x1b = (a.l + a.r) / 2, y1 = a.t, x2b = (b.l + b.r) / 2, y2 = b.b, ym = (y1 + y2) / 2; d = "M" + x1b + " " + y1 + " C" + x1b + " " + ym + "," + x2b + " " + ym + "," + x2b + " " + y2; }
        out += '<path class="' + lit.trim() + '" d="' + d + '"/>';
      });
    });
    svg.innerHTML = out;
  });
}
window.addEventListener("resize", function () { drawLines(); });
function afterTree() { drawLines(); setTimeout(drawLines, 120); }

/* ---- 技能詳情 / 測驗 ---- */
function openSkill(id) {
  var s = DB.skills.find(function (x) { return x.id === id; }), st = nodeState(ME, s), r = prog(ME, id);
  if (st === "locked") { toast("先完成前置技能：" + (DB.skills.find(function (x) { return x.id === s.prereq; }) || {}).name); return; }
  var due = dueOf(ME, s);
  var mats = (s.materials || []).map(function (m) { var u = safeUrl(m.url); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + ico("paperclip", 18) + " " + esc(m.title || u) + "</a>" : ""; }).join("");
  modal('<h2 class="mh"><span class="mico">' + iconOr(s.icon, 26, "book") + "</span>" + esc(s.name) + '</h2><div class="chips"><span class="chip gold">' + s.points + " 技能點</span><span class=\"chip\">及格 " + (s.passScore || 80) + " 分</span>" + (s.required ? '<span class="chip">必修</span>' : "") + (s.practical ? '<span class="chip">需主管實作簽核</span>' : "") + (due ? '<span class="chip">期限 ' + due + "</span>" : "") + "</div>" +
    (s.desc ? "<p>" + esc(s.desc) + "</p>" : "") +
    '<label class="f">學習教材</label><div class="mats">' + (mats || '<span class="muted">尚未提供教材</span>') + "</div>" +
    (r ? '<p class="muted">你的紀錄：最高 ' + r.score + " 分，已測驗 " + r.attempts + " 次" + (r.status === "done" ? "，已完成" : r.status === "awaiting" ? "，等待主管簽核" : "") + "</p>" : "") +
    '<div class="row" style="margin-top:14px">' + (st === "done" || st === "awaiting" ? "" : (s.questions && s.questions.length ? '<button class="btn pri big" onclick="startQuiz(\'' + id + '\')">開始挑戰</button>' : '<span class="muted">尚未設定題目</span>')) +
    '<button class="btn" onclick="closeModal()">關閉</button></div>');
}
function startQuiz(id) {
  var s = DB.skills.find(function (x) { return x.id === id; });
  modal("<h2>挑戰：" + esc(s.name) + '</h2><div class="muted">共 ' + s.questions.length + " 題，及格 " + (s.passScore || 80) + " 分</div><div id=\"qs\">" +
    s.questions.map(function (q, i) {
      return '<div class="q"><b>' + (i + 1) + ". " + esc(q.q) + "</b>" + q.o.map(function (o, j) { return '<label><input type="radio" name="a' + i + '" value="' + j + '"> ' + String.fromCharCode(65 + j) + ". " + esc(o) + "</label>"; }).join("") + "</div>";
    }).join("") + '</div><div id="res"></div><div class="row"><button class="btn pri" id="sub" onclick="submitQuiz(\'' + id + '\')">交卷</button><button class="btn" onclick="closeModal()">取消</button></div>');
}
async function submitQuiz(id) {
  var s = DB.skills.find(function (x) { return x.id === id; }), ans = [];
  for (var i = 0; i < s.questions.length; i++) { var c = document.querySelector('input[name="a' + i + '"]:checked'); if (!c) { toast("第 " + (i + 1) + " 題還沒作答"); return; } ans.push(Number(c.value)); }
  $("sub").disabled = true;
  try {
    var r = await api("submitQuiz", { skillId: id, answers: ans });
    DB = await api("load");
    var msg = r.passed ? (r.status === "awaiting" ? r.score + " 分，通過測驗！請主管實作簽核後即可獲得技能點。" : r.score + " 分，通過！獲得 " + s.points + " 技能點。") : r.score + " 分，未達 " + (s.passScore || 80) + " 分，再看一次教材後可重考。";
    $("res").innerHTML = '<div class="result ' + (r.passed ? "ok" : "no") + '">' + msg + "</div>";
    $("sub").outerHTML = '<button class="btn pri" onclick="closeModal()">關閉</button>';
    if (r.passed) { confetti(18); if (r.status === "done") xpFloat("+" + s.points + " XP"); window.__lvlCheck = true; }
    pageRender();
  } catch (e) { $("sub").disabled = false; toast("交卷失敗：" + e.message); }
}

/* ---- 特效 ---- */
function confetti(n) {
  var cols = ["#f6c343", "#5fc38e", "#5fe3d0", "#ffffff", "#e29a1a"];
  for (var i = 0; i < n; i++) {
    var d = document.createElement("div"); d.className = "confetti"; d.style.background = cols[i % cols.length];
    d.style.left = Math.random() * 100 + "vw"; d.style.animationDuration = 1.8 + Math.random() * 1.6 + "s"; d.style.animationDelay = Math.random() * .4 + "s";
    document.body.appendChild(d); setTimeout(function (x) { x.remove(); }, 4200, d);
  }
}
function xpFloat(t) { var d = document.createElement("div"); d.className = "xpfloat"; d.textContent = t; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 1500); }

/* 升級偵測：和上次看過的等級比對，有新等級就慶祝（首次造訪只記錄不慶祝） */
function checkLevelUps() {
  var key = "train_seen_" + ME, seen = null;
  try { seen = JSON.parse(lsGet(key)); } catch (e) {}
  var now = {}, ups = [];
  DB.tracks.forEach(function (t) { var g = levelOf(ME, t.id).got; now[t.id] = g ? g.id : ""; if (seen && now[t.id] && seen[t.id] !== now[t.id]) ups.push({ t: t, l: g }); });
  lsSet(key, JSON.stringify(now));
  if (!ups.length) return;
  var u = ups[0];
  confetti(40);
  modal('<div class="levelup"><div class="big">' + ico("award", 72) + '</div><h2>恭喜升級！</h2><div class="lvname">' + esc(u.t.name) + " → " + esc(u.l.name) + "</div><p class=\"muted\">你累積的技能點已達門檻，取得新的職能等級。</p><button class=\"btn pri\" onclick=\"closeModal()\">太棒了</button></div>");
}
var _closeModal = closeModal;
closeModal = function () { var had = !!$("modal"); _closeModal(); if (had && window.__lvlCheck) { window.__lvlCheck = false; setTimeout(checkLevelUps, 60); } };
