/* Pencil canvas for the pset site (Sahmoud 2026-10-17: "can I have a button here I can click on
   where I start writing a solution with the pencil on iPad, like it opens a canvas for that
   question"). Adds a "Write" button to every .item.prob; the canvas opens full screen with the
   problem pinned on top. Apple Pencil / mouse draw, a finger scrolls (palm never inks). Strokes are
   saved as vectors in localStorage on THIS device, keyed by course + problem id, so the same
   problem on a chapter page and the "all" page shares one drawing. Written by build_pset_site.py. */
(function () {
  var COURSE = (location.pathname.split("/").pop() || "").slice(0, 4);
  var COLORS = ["#111111", "#1f5fbf", "#c62828"];
  var PAGE_H = 1400;

  function key(id) { return "pencil:" + COURSE + ":" + id; }
  function load(id) { try { return JSON.parse(localStorage.getItem(key(id)) || "null"); } catch (e) { return null; } }
  function save(id, d) { try { localStorage.setItem(key(id), JSON.stringify(d)); return true; } catch (e) { return false; } }

  var css = document.createElement("style");
  css.textContent =
    ".wbtn{font:14px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;border:1px solid var(--acc,#2f5f93);" +
    "color:var(--acc,#2f5f93);background:#fff;border-radius:16px;padding:6px 12px;cursor:pointer;float:left;margin:4px 0 2px}" +
    ".wbtn.has{background:var(--acc,#2f5f93);color:#fff}" +
    "#pcov{position:fixed;inset:0;z-index:9999;background:#fbfaf7;display:flex;flex-direction:column}" +
    "#pcov .bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 10px;border-bottom:1px solid #d9dde3;" +
    "background:#fff;font:15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +
    "#pcov .bar button{font:inherit;border:1px solid #c9ced6;background:#fff;border-radius:8px;padding:8px 11px;cursor:pointer}" +
    "#pcov .bar button.on{border-color:#2f5f93;box-shadow:0 0 0 2px #2f5f93 inset}" +
    "#pcov .bar .sw{width:30px;height:30px;padding:0;border-radius:50%}" +
    "#pcov .bar .sp{flex:1}" +
    "#pcov .bar .st{color:#5f6368;font-size:13px;min-width:4em}" +
    "#pcov .q{max-height:30vh;overflow:auto;padding:8px 14px;border-bottom:2px solid #2f5f93;background:#fff;font-size:16px}" +
    "#pcov .q .tosol,#pcov .q .wbtn{display:none}" +
    "#pcov .wrap{flex:1;overflow:auto;-webkit-overflow-scrolling:touch}" +
    "#pcov canvas{display:block;width:100%;touch-action:none;background:" +
    "repeating-linear-gradient(#fff 0 39px,#e8ecf2 39px 40px)}" +
    "#pcov .more{display:block;margin:10px auto 40px;font:15px -apple-system,sans-serif;padding:8px 14px;border-radius:8px;border:1px solid #c9ced6;background:#fff}";
  document.head.appendChild(css);

  function open(item) {
    var id = item.id;
    var data = load(id) || { h: PAGE_H, strokes: [] };
    var redo = [];
    var tool = "pen", color = COLORS[0], penSeen = false;

    var cov = document.createElement("div"); cov.id = "pcov";
    var bar = document.createElement("div"); bar.className = "bar";
    function btn(label, fn, cls) { var b = document.createElement("button"); b.textContent = label; if (cls) b.className = cls; b.onclick = fn; bar.appendChild(b); return b; }
    var closeB = btn("✕ Close", close);
    var penB = btn("✏️ Pen", function () { setTool("pen"); }, "on");
    var swB = COLORS.map(function (c, i) { var b = btn("", function () { color = c; setTool("pen"); swB.forEach(function (x, j) { x.classList.toggle("on", j === i); }); }, "sw" + (i ? "" : " on")); b.style.background = c; b.title = "colour"; return b; });
    var erB = btn("⌫ Eraser", function () { setTool("eraser"); });
    btn("↶ Undo", function () { if (data.strokes.length) { redo.push(data.strokes.pop()); redraw(); persist(); } });
    btn("↷ Redo", function () { if (redo.length) { data.strokes.push(redo.pop()); redraw(); persist(); } });
    btn("Clear", function () { if (data.strokes.length && confirm("Erase everything on this page?")) { data.strokes = []; redo = []; redraw(); persist(); } });
    var sp = document.createElement("span"); sp.className = "sp"; bar.appendChild(sp);
    var st = document.createElement("span"); st.className = "st"; bar.appendChild(st);
    btn("⬇ PNG", exportPng);
    function setTool(t, keepShot) { if (!keepShot) oneShot = false; tool = t; penB.classList.toggle("on", t === "pen"); erB.classList.toggle("on", t === "eraser"); }

    var q = document.createElement("div"); q.className = "q"; q.innerHTML = item.innerHTML;
    var wrap = document.createElement("div"); wrap.className = "wrap";
    var cv = document.createElement("canvas"); wrap.appendChild(cv);
    var more = document.createElement("button"); more.className = "more"; more.textContent = "+ More space";
    more.onclick = function () { data.h += 1000; size(); persist(); };
    wrap.appendChild(more);
    cov.appendChild(bar); cov.appendChild(q); cov.appendChild(wrap);
    document.body.appendChild(cov);
    var prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";

    var ctx = cv.getContext("2d"), dpr = Math.max(1, window.devicePixelRatio || 1), W = 0;
    function size() {
      W = wrap.clientWidth;
      cv.style.height = data.h + "px";
      cv.width = Math.round(W * dpr); cv.height = Math.round(data.h * dpr);
      redraw();
    }
    // strokes are stored in a 1000-unit-wide coordinate space so they survive rotation / resize
    function sx(x) { return x * W / 1000; }
    function drawStroke(s) {
      var p = s.p; if (!p.length) return;
      ctx.strokeStyle = s.c; ctx.fillStyle = s.c; ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (p.length === 1) { ctx.beginPath(); ctx.arc(sx(p[0][0]), p[0][1], sx(s.w * (0.4 + p[0][2])) / 2, 0, 7); ctx.fill(); return; }
      for (var i = 1; i < p.length; i++) {
        ctx.beginPath(); ctx.lineWidth = sx(s.w * (0.4 + p[i][2]));
        ctx.moveTo(sx(p[i - 1][0]), p[i - 1][1]); ctx.lineTo(sx(p[i][0]), p[i][1]); ctx.stroke();
      }
    }
    function redraw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, data.h);
      data.strokes.forEach(drawStroke);
    }
    var t0 = null;
    function persist() {
      clearTimeout(t0);
      t0 = setTimeout(function () { st.textContent = save(id, data) ? "saved" : "NOT saved (storage full?)"; }, 250);
      item._wbtn && item._wbtn.classList.toggle("has", data.strokes.length > 0);
    }
    function pt(e) {
      var r = cv.getBoundingClientRect();
      var pr = e.pointerType === "pen" ? (e.pressure || 0.5) : 0.5;
      return [Math.round((e.clientX - r.left) * 1000 / W * 10) / 10, Math.round((e.clientY - r.top) * 10) / 10, Math.round(pr * 100) / 100];
    }
    function eraseAt(p) {
      var before = data.strokes.length, r = 14;
      data.strokes = data.strokes.filter(function (s) {
        return !s.p.some(function (q2) { return Math.abs(sx(q2[0]) - sx(p[0])) < r && Math.abs(q2[1] - p[1]) < r; });
      });
      if (data.strokes.length !== before) { redraw(); persist(); }
    }

    // Finger double-tap = eraser for ONE stroke, then back to the pen (10/17: "can I double tap to
    // turn on eraser then after erasure u switch back to pencil"). Safari never exposes the Pencil's
    // own barrel double-tap to web pages (native UIPencilInteraction only), so a finger double-tap
    // on the page is the closest a website can get.
    var oneShot = false, lastTap = 0, tapStart = null;
    function fingerTapped(e) {
      var now = Date.now();
      if (now - lastTap < 350) {
        lastTap = 0;
        if (tool === "eraser" && oneShot) { oneShot = false; setTool("pen"); st.textContent = "pen"; }
        else { setTool("eraser"); oneShot = true; st.textContent = "eraser: 1 stroke"; }
        return true;
      }
      lastTap = now; return false;
    }

    var cur = null, scrollY0 = null, touchY0 = 0;
    cv.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "pen") penSeen = true;
      if (e.pointerType === "touch") tapStart = { t: Date.now(), x: e.clientX, y: e.clientY };
      if (e.pointerType === "touch" && penSeen) { scrollY0 = wrap.scrollTop; touchY0 = e.clientY; return; }  // finger = scroll once a Pencil is in use
      e.preventDefault(); cv.setPointerCapture(e.pointerId);
      var p = pt(e);
      if (tool === "eraser") { cur = { erase: true }; eraseAt(p); return; }
      cur = { c: color, w: 2.6, p: [p] }; redo = [];
      drawStroke(cur);
    });
    cv.addEventListener("pointermove", function (e) {
      if (scrollY0 !== null && e.pointerType === "touch") { wrap.scrollTop = scrollY0 - (e.clientY - touchY0); return; }
      if (!cur) return;
      e.preventDefault();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      evs.forEach(function (ev) {
        var p = pt(ev);
        if (cur.erase) { eraseAt(p); return; }
        var last = cur.p[cur.p.length - 1];
        cur.p.push(p);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.strokeStyle = cur.c; ctx.lineCap = "round"; ctx.lineWidth = sx(cur.w * (0.4 + p[2]));
        ctx.beginPath(); ctx.moveTo(sx(last[0]), last[1]); ctx.lineTo(sx(p[0]), p[1]); ctx.stroke();
      });
    });
    function up(e) {
      scrollY0 = null;
      var tap = e && e.pointerType === "touch" && tapStart && Date.now() - tapStart.t < 250 &&
        Math.abs(e.clientX - tapStart.x) < 12 && Math.abs(e.clientY - tapStart.y) < 12;
      tapStart = null;
      if (tap) {
        if (cur && !cur.erase && !penSeen) { cur = null; redraw(); }   // a finger tap is a gesture, not ink
        else if (cur && cur.erase) cur = null;
        if (fingerTapped(e)) return;
      }
      if (cur && !cur.erase) { data.strokes.push(cur); persist(); }
      if (cur && cur.erase && oneShot) { oneShot = false; setTool("pen"); st.textContent = "back to pen"; }
      cur = null;
    }
    cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);

    function exportPng() {
      var a = document.createElement("a");
      a.download = (document.title + " " + id).replace(/[^\w.-]+/g, "_") + ".png";
      var out = document.createElement("canvas"); out.width = cv.width; out.height = cv.height;
      var o = out.getContext("2d"); o.fillStyle = "#fff"; o.fillRect(0, 0, out.width, out.height); o.drawImage(cv, 0, 0);
      a.href = out.toDataURL("image/png"); a.click();
    }
    function close() {
      clearTimeout(t0); save(id, data);
      window.removeEventListener("resize", size);
      document.body.style.overflow = prevOverflow; cov.remove();
    }
    window.addEventListener("resize", size);
    size();
    st.textContent = data.strokes.length ? "loaded" : "";
  }

  function init() {
    document.querySelectorAll(".item.prob[id]").forEach(function (item) {
      var b = document.createElement("button");
      b.className = "wbtn" + ((load(item.id) || { strokes: [] }).strokes.length ? " has" : "");
      b.type = "button"; b.textContent = "✏️ Write";
      b.onclick = function () { open(item); };
      item._wbtn = b;
      var link = item.querySelector(".tosol");
      if (link) link.insertBefore(b, link.firstChild); else item.appendChild(b);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
