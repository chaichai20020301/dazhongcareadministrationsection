/* 共用按鈕動效：水波、送出轉圈打勾、頂端載入線、分頁滑動膠囊、入口卡片浮現。
   全部包在 try/catch 裡，出任何狀況都不會影響頁面原本功能。不改變任何 fetch 的結果。 */
(function(){
  "use strict";
  var reduce = false;
  try{ reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; }catch(e){}
  var BTN = "button,[role=button],a.btn,.btn,input[type=submit]";
  var ACT = /送出|儲存|新增|確認|登入|刪除|更新|重新整理|刷新|匯出|產生|登錄|提交|核准|退回|完成|預約|下載|上傳|建立|發布|寄|簽核|結帳|解鎖/;
  var lastClick = {el:null, t:0};

  function safe(fn){ return function(){ try{ return fn.apply(this, arguments); }catch(e){} }; }

  /* ---------- 水波＋記住最近點的按鈕 ---------- */
  document.addEventListener("pointerdown", safe(function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest(BTN + ",.grid>.card") : null;
    if(!el || el.disabled) return;
    lastClick = {el:el, t:Date.now()};
    if(reduce) return;
    var cs = getComputedStyle(el);
    if(cs.position === "static") el.style.position = "relative";
    var wrap = el.querySelector(":scope>.mo-rip");
    if(!wrap){ wrap = document.createElement("span"); wrap.className = "mo-rip"; wrap.setAttribute("aria-hidden","true"); el.appendChild(wrap); }
    var r = el.getBoundingClientRect(), size = Math.max(r.width, r.height) * 2.2;
    var i = document.createElement("i");
    i.style.cssText = "width:"+size+"px;height:"+size+"px;left:"+(ev.clientX-r.left-size/2)+"px;top:"+(ev.clientY-r.top-size/2)+"px";
    wrap.appendChild(i);
    setTimeout(function(){ if(i.parentNode) i.parentNode.removeChild(i); }, 700);
  }), true);

  /* ---------- 送出狀態：轉圈 → 打勾 / 搖一下 ---------- */
  function wantsStatus(el){
    if(!el) return false;
    if(el.matches("[type=submit],.primary,.btn-primary")) return true;
    var txt = (el.textContent || el.value || "").replace(/\s+/g,"");
    return txt.length <= 14 && ACT.test(txt);
  }
  function setBusy(el){
    if(el.__moBusy) return;
    el.__moBusy = true;
    var cs = getComputedStyle(el);
    el.style.setProperty("--mo-fg", cs.color);
    if(cs.position === "static") el.style.position = "relative";
    el.classList.remove("mo-fail"); el.classList.add("mo-busy");
    el.__moTimer = setTimeout(function(){ clear(el); }, 25000);   // 保險：最久 25 秒一定放開
  }
  function clear(el){
    clearTimeout(el.__moTimer);
    el.classList.remove("mo-busy","mo-done","mo-fail");
    el.style.removeProperty("--mo-fg");
    el.__moBusy = false;
  }
  function finish(el, ok){
    if(!el.__moBusy) return;
    clearTimeout(el.__moTimer);
    el.classList.remove("mo-busy");
    if(ok && !reduce){
      el.classList.add("mo-done");
      el.__moTimer = setTimeout(function(){ clear(el); }, 900);
    }else if(!ok && !reduce){
      el.classList.add("mo-fail");
      el.__moTimer = setTimeout(function(){ clear(el); }, 450);
    }else{ clear(el); }
  }

  /* ---------- 頂端載入線 ---------- */
  var bar, pending = 0, barTimer, loadStart = Date.now();
  function barOn(){ if(!bar){ bar = document.createElement("div"); bar.id = "mo-bar"; document.body.appendChild(bar); }
    clearTimeout(barTimer); bar.className = ""; void bar.offsetWidth; bar.className = "on"; }
  function barOff(){ if(!bar) return; bar.className = "end"; barTimer = setTimeout(function(){ if(bar) bar.className = ""; }, 500); }

  /* ---------- 包 fetch：只「旁觀」，原本的結果完全照舊 ---------- */
  if(window.fetch && !reduce){
    var _fetch = window.fetch;
    window.fetch = function(){
      var p = _fetch.apply(this, arguments);
      try{
        var now = Date.now();
        var btn = (lastClick.el && now - lastClick.t < 500 && wantsStatus(lastClick.el)) ? lastClick.el : null;
        var showBar = (now - lastClick.t < 1500) || (now - loadStart < 10000);
        if(btn) setBusy(btn);
        if(showBar && document.body){ pending++; if(pending === 1) barOn(); }
        var counted = showBar;
        var done = function(ok){
          if(counted){ pending = Math.max(0, pending - 1); if(!pending) barOff(); }
          if(btn) finish(btn, ok);
        };
        p.then(function(res){
          var ok = !!(res && res.ok);
          if(ok && btn){
            try{ res.clone().json().then(function(j){ done(!(j && (j.ok === false || j.error))); }, function(){ done(true); }); return; }catch(e){}
          }
          done(ok);
        }, function(){ done(false); });
      }catch(e){}
      return p;
    };
  }

  /* ---------- 分頁：滑動選取膠囊 ---------- */
  var ON = ["on","active","sel","selected","is-active","cur"];
  function onClass(el){ for(var i=0;i<ON.length;i++) if(el.classList.contains(ON[i])) return ON[i]; return null; }
  function scanSeg(){
    var seen = new Set();
    document.querySelectorAll("button.on,button.active,button.sel,button.selected,a.on,a.active,.tab.on").forEach(function(on){
      var box = on.parentElement;
      if(!box || seen.has(box) || box.__moSeg || box.classList.contains("mo-seg")) return;
      seen.add(box);
      var kids = [].slice.call(box.children).filter(function(k){ return !k.classList.contains("mo-pill") && k.offsetParent !== null; });
      if(kids.length < 2 || kids.length > 8) return;
      if(!kids.every(function(k){ return k.tagName === on.tagName; })) return;
      var ons = kids.filter(function(k){ return onClass(k); });
      if(ons.length !== 1) return;
      var cs = getComputedStyle(box);
      if(cs.display === "grid") return;
      // 同樣 class 的兄弟容器（例如月曆每週一列）不處理
      var sib = [].slice.call(box.parentElement ? box.parentElement.children : []).filter(function(s){ return s !== box && s.className === box.className && box.className; });
      if(sib.length) return;
      // 選中按鈕要有自己的底色，才有東西可滑
      var oc = getComputedStyle(ons[0]);
      var hasBg = (oc.backgroundColor && oc.backgroundColor !== "rgba(0, 0, 0, 0)" && oc.backgroundColor !== "transparent") || (oc.backgroundImage && oc.backgroundImage !== "none");
      if(!hasBg) return;
      setupSeg(box, kids, ons[0], oc);
    });
  }
  function setupSeg(box, kids, on, oc){
    box.__moSeg = true;
    var pill = document.createElement("i");
    pill.className = "mo-pill"; pill.setAttribute("aria-hidden","true");
    pill.style.background = oc.backgroundColor;
    if(oc.backgroundImage && oc.backgroundImage !== "none") pill.style.backgroundImage = oc.backgroundImage;
    pill.style.borderRadius = oc.borderRadius;
    pill.style.boxShadow = oc.boxShadow;
    pill.style.border = oc.borderTopWidth + " " + oc.borderTopStyle + " " + oc.borderTopColor;
    pill.style.boxSizing = "border-box";
    pill.style.transition = "none";
    box.appendChild(pill);
    if(getComputedStyle(box).position === "static") box.style.position = "relative";
    box.classList.add("mo-seg");
    kids.forEach(function(k){ k.classList.add("mo-b"); });
    var move = function(){
      if(!box.contains(pill)){ box.__moSeg = false; box.classList.remove("mo-seg"); return; }   // 頁面重畫了分頁：放掉，之後重新掃描
      var cur = null;
      [].slice.call(box.children).forEach(function(k){ if(!k.classList.contains("mo-pill") && onClass(k)) cur = k; });
      if(!cur || cur.offsetParent === null){ pill.style.opacity = "0"; return; }
      pill.style.opacity = "1";
      pill.style.width = cur.offsetWidth + "px";
      pill.style.height = cur.offsetHeight + "px";
      pill.style.transform = "translate(" + cur.offsetLeft + "px," + cur.offsetTop + "px)";
    };
    move();
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ if(!reduce) pill.style.transition = ""; }); });
    var obs = new MutationObserver(safe(move));
    obs.observe(box, {attributes:true, attributeFilter:["class"], subtree:true, childList:true});
    window.addEventListener("resize", safe(move));
    if(window.ResizeObserver) new ResizeObserver(safe(move)).observe(box);
  }

  /* ---------- 入口卡片：依序浮現 ---------- */
  function portal(){
    var cards = document.querySelectorAll(".grid>.card[data-key]");
    if(!cards.length) return;
    document.body.classList.add("mo-portal");
    var obs = new MutationObserver(safe(function(){
      var i = 0; [].forEach.call(cards, function(c){ if(c.offsetParent !== null){ c.style.setProperty("--mo-i", i++); } });
    }));
    cards.forEach(function(c){ obs.observe(c, {attributes:true, attributeFilter:["style","class","hidden"]}); });
    var i = 0; [].forEach.call(cards, function(c){ if(c.offsetParent !== null) c.style.setProperty("--mo-i", i++); });
  }

  function init(){
    safe(portal)();
    if(reduce) return;
    safe(scanSeg)();
    // 頁面後來才長出來的分頁（資料載入後才畫）：偶爾再掃一次
    var t, mo = new MutationObserver(function(){ clearTimeout(t); t = setTimeout(safe(scanSeg), 300); });
    mo.observe(document.body, {childList:true, subtree:true});
  }
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
