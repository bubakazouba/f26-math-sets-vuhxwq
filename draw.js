/* Pencil canvas for the pset site (Sahmoud 2026-10-17: "can I have a button here I can click on
   where I start writing a solution with the pencil on iPad, like it opens a canvas for that
   question"; then "make it in general a bit notability style"). Adds a "Write" button to every
   .item.prob; the canvas opens full screen with the problem pinned on top as a card.
   - Apple Pencil / mouse ink; a finger NEVER inks (it scrolls, and double-taps for the eraser).
   - Notability-style floating toolbar: pen, highlighter (drawn under the ink), eraser, colour and
     size swatches, undo/redo, paper (lined with margin / grid / blank).
   - Finger double-tap = eraser for ONE stroke, then back to the previous tool. Safari never exposes
     the Pencil's own barrel double-tap to web pages (native UIPencilInteraction only).
   - Strokes are vectors in localStorage on THIS device, keyed by course + problem id, so the same
     problem on a chapter page and the "all" page shares one drawing. Old pen-only saves still load.
   Written into the site by build_pset_site.py. */
(function () {
  var COURSE = (location.pathname.split("/").pop() || "").slice(0, 4);
  var PEN_COLORS = ["#1c1c1e", "#1f4fa8", "#c0392b", "#1e8449", "#7d3c98", "#d35400"];
  var HL_COLORS = ["#ffe14d", "#7ee08a", "#ff8fc1", "#8fd3ff"];
  var PEN_SIZES = [1.8, 2.8, 4.2], HL_SIZES = [14, 22, 32];
  var PAGE_H = 1400, LINE = 34;

  function key(id) { return "pencil:" + COURSE + ":" + id; }
  function load(id) { try { return JSON.parse(localStorage.getItem(key(id)) || "null"); } catch (e) { return null; } }
  function save(id, d) { try { localStorage.setItem(key(id), JSON.stringify(d)); return true; } catch (e) { return false; } }
  // per-problem status: "done" | "again" | "" (10/17: "can u also add a button for done and a button for do again")
  function skey(id) { return "pstatus:" + COURSE + ":" + id; }
  function getStatus(id) { try { return localStorage.getItem(skey(id)) || ""; } catch (e) { return ""; } }
  function setStatus(id, v) { try { if (v) localStorage.setItem(skey(id), v); else localStorage.removeItem(skey(id)); } catch (e) {} }
  function pref(k, v) { try { if (v === undefined) return localStorage.getItem("pencilpref:" + k); localStorage.setItem("pencilpref:" + k, v); } catch (e) { return null; } }

  var UI = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif";
  var css = document.createElement("style");
  css.textContent =
    ".wbtn{font:600 13px/1 " + UI + ";border:0;color:#fff;background:linear-gradient(#5b8def,#3b6fd8);" +
    "border-radius:14px;padding:7px 12px;cursor:pointer;float:left;margin:4px 0 2px;box-shadow:0 1px 3px rgba(40,70,140,.35)}" +
    ".wbtn.has{background:linear-gradient(#ffb347,#f39c12);box-shadow:0 1px 3px rgba(160,100,10,.35)}" +
    ".sbtn{font:600 13px/1 " + UI + ";border:1px solid #d1d1d6;color:#3a3a3c;background:#fff;border-radius:14px;padding:6px 11px;cursor:pointer;float:left;margin:4px 0 2px 6px}" +
    ".sbtn.d.on{background:#34c759;border-color:#34c759;color:#fff}" +
    ".sbtn.a.on{background:#ff9f0a;border-color:#ff9f0a;color:#fff}" +
    ".item.prob.st-done{border-left-color:#34c759!important;background:#f3fbf5}" +
    ".item.prob.st-again{border-left-color:#ff9f0a!important;background:#fff8ee}" +
    "#pcov .hdr .sbtn{float:none;margin:0}" +
    // no iOS double-tap-to-zoom anywhere in the canvas UI (10/17: "when I press undo multiple times safari
    // thinks I want to zoom on the undo button"); the canvas itself stays touch-action:none
    "#pcov,#pcov *,.wbtn,.sbtn{touch-action:manipulation;-webkit-user-select:none;user-select:none;" +
    "-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}" +
    "#pcov .toast{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%) scale(.9);background:rgba(28,28,30,.86);color:#fff;" +
    "font:600 20px " + UI + ";padding:14px 22px;border-radius:16px;opacity:0;pointer-events:none;transition:opacity .15s,transform .15s;z-index:10000}" +
    "#pcov .toast.show{opacity:1;transform:translate(-50%,-50%) scale(1)}" +
    "#pcov .tools .t.on.er1{background:#ffe1e1}" +
    "#pcov{position:fixed;inset:0;z-index:9999;background:#ececf0;display:flex;flex-direction:column;font:15px/1.3 " + UI + "}" +
    "#pcov .hdr{display:flex;align-items:center;gap:10px;padding:10px 14px 6px;color:#1c1c1e}" +
    "#pcov .hdr .done{font:600 16px " + UI + ";color:#2f6fe4;background:none;border:0;cursor:pointer;padding:4px 2px}" +
    "#pcov .hdr .ttl{flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}" +
    "#pcov .hdr .st{font-size:12px;color:#8e8e93;min-width:5em;text-align:right}" +
    "#pcov .hdr .png{font:15px " + UI + ";color:#2f6fe4;background:none;border:0;cursor:pointer}" +
    "#pcov .tools{align-self:center;display:flex;align-items:center;gap:4px;background:#fff;border-radius:22px;" +
    "padding:6px 10px;margin:2px 10px 8px;box-shadow:0 4px 18px rgba(0,0,0,.12);flex-wrap:wrap;justify-content:center;max-width:calc(100% - 20px)}" +
    "#pcov .tools .t{width:40px;height:40px;border-radius:12px;border:0;background:none;font-size:20px;cursor:pointer;line-height:40px;padding:0}" +
    "#pcov .tools .t.on{background:#e3ecfd}" +
    "#pcov .tools .sep{width:1px;height:26px;background:#e5e5ea;margin:0 4px}" +
    "#pcov .tools .sw{width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #d1d1d6;margin:0 3px;cursor:pointer;padding:0}" +
    "#pcov .tools .sw.on{box-shadow:0 0 0 2px #2f6fe4}" +
    "#pcov .tools .sz{width:30px;height:30px;border-radius:50%;border:0;background:none;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}" +
    "#pcov .tools .sz i{display:block;border-radius:50%;background:#1c1c1e}" +
    "#pcov .tools .sz.on{background:#e3ecfd}" +
    "#pcov .q{margin:0 14px 10px;padding:10px 14px;background:#fff;border-radius:14px;box-shadow:0 1px 4px rgba(0,0,0,.08);" +
    "max-height:26vh;overflow:auto;font:16px/1.5 Georgia,'Times New Roman',serif;color:#1c1c1e}" +
    "#pcov .q.min{max-height:2.6em;overflow:hidden;opacity:.85}" +
    "#pcov .q .tosol,#pcov .q .wbtn{display:none}" +
    "#pcov .wrap{flex:1;overflow:auto;-webkit-overflow-scrolling:touch;padding:0 14px}" +
    "#pcov .sheet{background:#fffdf7;border-radius:6px 6px 0 0;box-shadow:0 2px 12px rgba(0,0,0,.10);position:relative}" +
    "#pcov canvas{display:block;width:100%;touch-action:none}" +
    "#pcov .more{display:block;margin:14px auto 40px;font:600 14px " + UI + ";color:#2f6fe4;padding:9px 16px;border-radius:18px;border:0;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.1);cursor:pointer}";
  document.head.appendChild(css);

  function paperCss(kind) {
    if (kind === "grid") return "linear-gradient(#e3e9f3 1px,transparent 1px) 0 0/28px 28px,linear-gradient(90deg,#e3e9f3 1px,transparent 1px) 0 0/28px 28px,#fffdf7";
    if (kind === "blank") return "#fffdf7";
    return "linear-gradient(90deg,transparent 64px,#f3b3b3 64px,#f3b3b3 66px,transparent 66px)," +
      "repeating-linear-gradient(#fffdf7 0 " + (LINE - 1) + "px,#cfe0f3 " + (LINE - 1) + "px " + LINE + "px)";
  }

  function open(item) {
    var id = item.id;
    var data = load(id) || { h: PAGE_H, strokes: [] };
    var redo = [];
    var tool = "pen", penColor = PEN_COLORS[0], hlColor = HL_COLORS[0];
    var penSize = PEN_SIZES[1], hlSize = HL_SIZES[1];
    var paper = pref("paper") || "lined";
    var oneShot = false, prevTool = "pen";

    var cov = document.createElement("div"); cov.id = "pcov";
    function el(tag, cls, parent, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; (parent || cov).appendChild(e); return e; }

    var hdr = el("div", "hdr");
    var doneB = el("button", "done", hdr, "‹ Done"); doneB.onclick = close;
    var ttl = el("div", "ttl", hdr, (item.querySelector(".lead") || {}).textContent || document.title);
    var st = el("span", "st", hdr);
    var hd = el("button", "sbtn d", hdr, "✅ Done"), ha = el("button", "sbtn a", hdr, "🔁 Do again");
    function syncHdr() { var v = getStatus(id); hd.classList.toggle("on", v === "done"); ha.classList.toggle("on", v === "again"); }
    hd.onclick = function () { toggleStatus(item, "done"); syncHdr(); };
    ha.onclick = function () { toggleStatus(item, "again"); syncHdr(); };
    syncHdr();
    var pngB = el("button", "png", hdr, "Share PNG"); pngB.onclick = exportPng;

    var tools = el("div", "tools");
    function tbtn(icon, title, fn) { var b = el("button", "t", tools, icon); b.title = title; b.onclick = fn; return b; }
    var penB = tbtn("✒️", "Pen", function () { setTool("pen"); });
    var hlB = tbtn("🖍️", "Highlighter", function () { setTool("hl"); });
    var erB = tbtn("🧽", "Eraser (or double-tap with a finger)", function () { setTool("eraser"); });
    el("span", "sep", tools);
    var swWrap = el("span", "", tools); swWrap.style.display = "flex";
    el("span", "sep", tools);
    var szWrap = el("span", "", tools); szWrap.style.display = "flex";
    el("span", "sep", tools);
    tbtn("↶", "Undo", function () { if (data.strokes.length) { redo.push(data.strokes.pop()); redraw(); persist(); } });
    tbtn("↷", "Redo", function () { if (redo.length) { data.strokes.push(redo.pop()); redraw(); persist(); } });
    var paperB = tbtn("📄", "Paper: lined / grid / blank", function () {
      paper = paper === "lined" ? "grid" : paper === "grid" ? "blank" : "lined"; pref("paper", paper); sheet.style.background = paperCss(paper); flash("paper: " + paper);
    });
    tbtn("🗑️", "Clear page", function () { if (data.strokes.length && confirm("Erase everything on this page?")) { data.strokes = []; redo = []; redraw(); persist(); } });

    function renderSwatches() {
      swWrap.innerHTML = ""; szWrap.innerHTML = "";
      var hl = tool === "hl", cols = hl ? HL_COLORS : PEN_COLORS, cur = hl ? hlColor : penColor;
      cols.forEach(function (c) {
        var b = el("button", "sw" + (c === cur ? " on" : ""), swWrap); b.style.background = c; b.title = "colour";
        b.onclick = function () { if (tool === "hl") hlColor = c; else { penColor = c; if (tool !== "pen") setTool("pen"); } renderSwatches(); };
      });
      var sizes = hl ? HL_SIZES : PEN_SIZES, curS = hl ? hlSize : penSize;
      sizes.forEach(function (s, i) {
        var b = el("button", "sz" + (s === curS ? " on" : ""), szWrap), d = el("i", "", b);
        var px = [6, 10, 15][i]; d.style.width = d.style.height = px + "px"; d.style.background = hl ? hlColor : penColor;
        b.onclick = function () { if (tool === "hl") hlSize = s; else penSize = s; renderSwatches(); };
      });
    }
    function setTool(t, keep) {
      if (!keep) oneShot = false;
      tool = t;
      penB.classList.toggle("on", t === "pen"); hlB.classList.toggle("on", t === "hl"); erB.classList.toggle("on", t === "eraser");
      erB.classList.remove("er1");
      renderSwatches();
    }

    var q = el("div", "q"); q.innerHTML = item.innerHTML;
    // fold via an explicit button only: a resting palm on the card must not fold it
    var foldB = el("button", "t", tools, "▴"); foldB.title = "Fold / unfold the problem";
    foldB.onclick = function () { q.classList.toggle("min"); foldB.textContent = q.classList.contains("min") ? "▾" : "▴"; size(); };
    var wrap = el("div", "wrap");
    var sheet = el("div", "sheet", wrap); sheet.style.background = paperCss(paper);
    var cv = el("canvas", "", sheet);
    var more = el("button", "more", wrap, "+ Add page"); more.onclick = function () { data.h += 1000; size(); persist(); };
    document.body.appendChild(cov);
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    if (window.renderMathInElement) try { window.renderMathInElement(q, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false }); } catch (e) {}

    var ctx = cv.getContext("2d"), dpr = Math.max(1, window.devicePixelRatio || 1), W = 0;
    function size() {
      W = sheet.clientWidth;
      cv.style.height = data.h + "px";
      cv.width = Math.round(W * dpr); cv.height = Math.round(data.h * dpr);
      redraw();
    }
    // strokes are stored in a 1000-unit-wide coordinate space so they survive rotation / resize
    function sx(x) { return x * W / 1000; }
    function styleFor(s) {
      ctx.globalCompositeOperation = s.t === "hl" ? "multiply" : "source-over";
      ctx.globalAlpha = s.t === "hl" ? 0.55 : 1;
      ctx.strokeStyle = ctx.fillStyle = s.c; ctx.lineJoin = "round"; ctx.lineCap = s.t === "hl" ? "butt" : "round";
    }
    function widthAt(s, pr) { return s.t === "hl" ? sx(s.w) : sx(s.w * (0.45 + pr)); }
    // smooth ink: quadratic curves through segment midpoints
    function drawStroke(s) {
      var p = s.p; if (!p.length) return;
      styleFor(s);
      if (p.length === 1) { ctx.beginPath(); ctx.arc(sx(p[0][0]), p[0][1], widthAt(s, p[0][2]) / 2, 0, 7); ctx.fill(); ctx.globalAlpha = 1; return; }
      if (s.t === "hl") {
        ctx.lineWidth = widthAt(s, 0.5); ctx.beginPath(); ctx.moveTo(sx(p[0][0]), p[0][1]);
        for (var k = 1; k < p.length; k++) ctx.lineTo(sx(p[k][0]), p[k][1]);
        ctx.stroke(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; return;
      }
      var mx = sx(p[0][0]), my = p[0][1];
      for (var i = 1; i < p.length; i++) {
        var nx = (sx(p[i - 1][0]) + sx(p[i][0])) / 2, ny = (p[i - 1][1] + p[i][1]) / 2;
        ctx.beginPath(); ctx.lineWidth = widthAt(s, p[i][2]);
        ctx.moveTo(mx, my); ctx.quadraticCurveTo(sx(p[i - 1][0]), p[i - 1][1], nx, ny); ctx.stroke();
        mx = nx; my = ny;
      }
      var L = p[p.length - 1]; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(sx(L[0]), L[1]); ctx.stroke();
    }
    function redraw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, data.h);
      data.strokes.forEach(function (s) { if (s.t === "hl") drawStroke(s); });   // highlighter sits under the ink
      data.strokes.forEach(function (s) { if (s.t !== "hl") drawStroke(s); });
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    }
    var t0 = null, f0 = null;
    function flash(msg) { st.textContent = msg; clearTimeout(f0); f0 = setTimeout(function () { st.textContent = ""; }, 2200); }
    // big centred banner for mode switches, so the double-tap eraser is impossible to miss
    var toast = el("div", "toast"), tt0 = null;
    function banner(msg) { toast.textContent = msg; toast.classList.add("show"); clearTimeout(tt0); tt0 = setTimeout(function () { toast.classList.remove("show"); }, 1300); }
    function persist() {
      clearTimeout(t0);
      t0 = setTimeout(function () { flash(save(id, data) ? "saved" : "NOT saved (storage full?)"); }, 250);
      item._wbtn && item._wbtn.classList.toggle("has", data.strokes.length > 0);
    }
    function pt(e) {
      var r = cv.getBoundingClientRect();
      var pr = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
      return [Math.round((e.clientX - r.left) * 1000 / W * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10, Math.round(pr * 100) / 100];
    }
    function eraseAt(p) {
      var before = data.strokes.length, r = 14, px = sx(p[0]), py = p[1];
      data.strokes = data.strokes.filter(function (s) {
        var rr = r + (s.t === "hl" ? sx(s.w) / 2 : 0);
        // hit-test every segment, not just sampled points, so a fast straight stroke still erases
        for (var i = 0; i < s.p.length; i++) {
          var ax = sx(s.p[i][0]), ay = s.p[i][1], b = s.p[Math.min(i + 1, s.p.length - 1)];
          var bx = sx(b[0]), by = b[1], dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
          var t = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L)) : 0;
          var cx = ax + t * dx - px, cy = ay + t * dy - py;
          if (cx * cx + cy * cy < rr * rr) return false;
        }
        return true;
      });
      if (data.strokes.length !== before) { redraw(); persist(); }
    }

    // Finger double-tap = eraser for ONE stroke, then back to whatever tool was in use
    // (10/17: "can I double tap to turn on eraser then after erasure u switch back to pencil").
    var lastTap = 0, tapStart = null;
    function toolName(t) { return t === "hl" ? "🖍️ Highlighter" : "✒️ Pen"; }
    function fingerTapped() {
      var now = Date.now();
      if (now - lastTap < 500) {
        lastTap = 0;
        if (tool === "eraser" && oneShot) { setTool(prevTool); banner(toolName(prevTool)); }
        else { prevTool = tool === "eraser" ? "pen" : tool; setTool("eraser"); oneShot = true; erB.classList.add("er1"); banner("🧽 Eraser (1 stroke)"); }
        return true;
      }
      lastTap = now; return false;
    }

    // Pencil and finger are tracked separately by pointerId. A finger NEVER inks, it only scrolls /
    // double-taps (10/17: "make sure only the pencil gets to write on the page not my finger"), and any
    // touch while the Pencil is writing (or just lifted) is treated as a resting palm and ignored
    // completely (10/17: "my palm ... keeps accidentally selecting html elements").
    var cur = null, scrollY0 = null, touchY0 = 0, touchId = null, penId = null, penLast = 0;
    function penBusy() { return penId !== null || Date.now() - penLast < 700; }
    function isPalm(e) { return (e.width || 0) > 40 || (e.height || 0) > 40; }
    cv.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") {
        e.preventDefault();
        if (penBusy() || isPalm(e) || touchId !== null) return;          // palm / second finger: ignore
        touchId = e.pointerId; tapStart = { t: Date.now(), x: e.clientX, y: e.clientY };
        scrollY0 = wrap.scrollTop; touchY0 = e.clientY; return;
      }
      if (penId !== null) return;
      penId = e.pointerId;
      touchId = null; scrollY0 = null; tapStart = null;                  // pen wins over any finger in flight
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      var p = pt(e);
      if (tool === "eraser") { cur = { erase: true }; eraseAt(p); return; }
      cur = tool === "hl" ? { t: "hl", c: hlColor, w: hlSize, p: [p] } : { c: penColor, w: penSize, p: [p] };
      redo = [];
      if (cur.t !== "hl") { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawStroke(cur); }
    });
    cv.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") {
        e.preventDefault();
        if (e.pointerId === touchId && scrollY0 !== null && !penBusy()) wrap.scrollTop = scrollY0 - (e.clientY - touchY0);
        return;
      }
      if (e.pointerId !== penId || !cur) return;
      e.preventDefault();
      var evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      if (!evs.length) evs = [e];
      evs.forEach(function (ev) {
        var p = pt(ev);
        if (cur.erase) { eraseAt(p); return; }
        var last = cur.p[cur.p.length - 1];
        cur.p.push(p);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (cur.t === "hl") {   // live highlighter preview: redraw so the translucent stroke doesn't stack on itself
          redraw(); drawStroke(cur); data.strokes.forEach(function (s) { if (s.t !== "hl") drawStroke(s); });
        } else {
          styleFor(cur); ctx.lineWidth = widthAt(cur, p[2]);
          ctx.beginPath(); ctx.moveTo(sx(last[0]), last[1]); ctx.lineTo(sx(p[0]), p[1]); ctx.stroke();
        }
      });
    });
    function up(e) {
      if (e.pointerType === "touch") {
        if (e.pointerId !== touchId) return;                              // a palm lifting: ignore
        touchId = null; scrollY0 = null;
        // forgiving tap: real iPad finger taps run longer and drift more than a mouse click (10/17: "double
        // tap to switch to eraser mode isn't working")
        var tap = e.type === "pointerup" && tapStart && Date.now() - tapStart.t < 400 &&
          Math.abs(e.clientX - tapStart.x) < 24 && Math.abs(e.clientY - tapStart.y) < 24;
        tapStart = null;
        if (tap && !penBusy()) fingerTapped();
        return;
      }
      if (e.pointerId !== penId) return;
      penId = null; penLast = Date.now();
      if (cur && !cur.erase) { data.strokes.push(cur); redraw(); persist(); }
      if (cur && cur.erase && oneShot) { setTool(prevTool); banner(toolName(prevTool)); }
      cur = null;
    }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

    function exportPng() {
      var out = document.createElement("canvas"); out.width = cv.width; out.height = cv.height;
      var o = out.getContext("2d"); o.fillStyle = "#fffdf7"; o.fillRect(0, 0, out.width, out.height); o.drawImage(cv, 0, 0);
      var name = (document.title + " " + id).replace(/[^\w.-]+/g, "_") + ".png";
      out.toBlob(function (blob) {
        var file = blob && window.File ? new File([blob], name, { type: "image/png" }) : null;
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(function () {}); return; }
        var a = document.createElement("a"); a.download = name; a.href = out.toDataURL("image/png"); a.click();
      }, "image/png");
    }
    function close() {
      clearTimeout(t0); save(id, data);
      window.removeEventListener("resize", size);
      document.body.style.overflow = prevOverflow; cov.remove();
    }
    window.addEventListener("resize", size);
    setTool("pen");
    size();
    if (data.strokes.length) flash("loaded");
  }

  function paintStatus(item) {
    var v = getStatus(item.id);
    item.classList.toggle("st-done", v === "done"); item.classList.toggle("st-again", v === "again");
    if (item._sd) item._sd.classList.toggle("on", v === "done");
    if (item._sa) item._sa.classList.toggle("on", v === "again");
  }
  function toggleStatus(item, v) {   // tap again to clear; Done and Do again are mutually exclusive
    setStatus(item.id, getStatus(item.id) === v ? "" : v);
    document.querySelectorAll(".item.prob").forEach(function (it) { if (it.id === item.id) paintStatus(it); });
  }

  function init() {
    document.querySelectorAll(".item.prob[id]").forEach(function (item) {
      var b = document.createElement("button");
      b.className = "wbtn" + ((load(item.id) || { strokes: [] }).strokes.length ? " has" : "");
      b.type = "button"; b.textContent = "✏️ Write";
      b.onclick = function () { open(item); };
      item._wbtn = b;
      var d = document.createElement("button"); d.type = "button"; d.className = "sbtn d"; d.textContent = "✅ Done";
      var a = document.createElement("button"); a.type = "button"; a.className = "sbtn a"; a.textContent = "🔁 Do again";
      d.onclick = function () { toggleStatus(item, "done"); };
      a.onclick = function () { toggleStatus(item, "again"); };
      item._sd = d; item._sa = a;
      var link = item.querySelector(".tosol");
      if (link) { link.insertBefore(a, link.firstChild); link.insertBefore(d, a); link.insertBefore(b, d); }
      else { item.appendChild(b); item.appendChild(d); item.appendChild(a); }
      paintStatus(item);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
