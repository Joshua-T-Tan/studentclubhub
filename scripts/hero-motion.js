/* ============================================================
   hero-motion.js - 10-second looping motion graphic behind the
   homepage hero (replaces the old photo). A quiet street-map of
   local businesses and school clubs wired together like circuit
   traces: pulses run both ways (perks/sponsorship one way,
   customers the other), a radar sweep crosses once per loop, and
   two small chart panels tick along. Every motion is periodic in
   LOOP, so frame 10.0s == frame 0.0s and the loop is seamless.
   Canvas only - no files, no network. Loaded after pages.js.
   ============================================================ */
(function () {
  var LOOP = 10;
  var TAU = Math.PI * 2;
  /* Palette follows the page theme; RED = business pulses/icons, AMBER = club pulses, NOTE = sticky notes */
  var PALETTES = {
    light: { RED: '214,40,40', AMBER: '224,160,0', INK: '26,26,26', GROUND: '255,255,255', BADGE: '255,255,255', NOTE: '255,216,77' },
    dark:  { RED: '239,68,68', AMBER: '255,216,77', INK: '242,239,232', GROUND: '22,22,22', BADGE: '34,33,32', NOTE: '255,216,77' }
  };
  var RED, AMBER, INK, GROUND, BADGE, NOTE;
  function applyPalette() {
    var pal = PALETTES[document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'];
    RED = pal.RED; AMBER = pal.AMBER; INK = pal.INK; GROUND = pal.GROUND; BADGE = pal.BADGE; NOTE = pal.NOTE;
  }

  /* Nodes: x/y are fractions of the hero box. kind 'biz' = local business, 'club' = school/club. */
  var NODES = [
    { kind: 'biz',  icon: 'cup',    label: 'Daybreak Coffee',   x: 0.07, y: 0.16 },
    { kind: 'club', icon: 'cap',    label: 'West High',         x: 0.10, y: 0.42 },
    { kind: 'biz',  icon: 'burger', label: 'Ocean Ave Grill',   x: 0.10, y: 0.86 },
    { kind: 'club', icon: 'gear',   label: 'Robotics Club',     x: 0.30, y: 0.08 },
    { kind: 'club', icon: 'note',   label: 'Jazz Band',         x: 0.67, y: 0.07 },
    { kind: 'biz',  icon: 'pizza',  label: 'Slice Bros. Pizza', x: 0.91, y: 0.15 },
    { kind: 'club', icon: 'trophy', label: 'Varsity Track',     x: 0.88, y: 0.38 },
    { kind: 'biz',  icon: 'store',  label: 'Corner Market',     x: 0.92, y: 0.84 },
    { kind: 'club', icon: 'leaf',   label: 'Green Earth Club',  x: 0.78, y: 0.89 },
    { kind: 'club', icon: 'people', label: 'Key Club',          x: 0.22, y: 0.89 }
  ];
  /* Edges: [a, b, route]. route 'h' = run horizontally from a first, 'v' = vertically first. */
  var EDGES = [
    [0, 1, 'v'], [0, 3, 'h'], [0, 4, 'h'], [2, 1, 'v'], [2, 9, 'h'],
    [5, 4, 'h'], [5, 6, 'v'], [7, 6, 'v'], [7, 8, 'h'], [3, 1, 'v']
  ];
  /* Irregular street lines (fractions) so the backdrop reads as a neighborhood map, not a grid. */
  var STREETS_X = [0.04, 0.19, 0.23, 0.41, 0.52, 0.58, 0.74, 0.81, 0.97];
  var STREETS_Y = [0.11, 0.27, 0.33, 0.58, 0.71, 0.79, 0.97];

  var canvas, ctx, W = 0, H = 0, dpr = 1, running = false, visible = true, raf = 0, paths = [];
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- periodic helpers ---------- */
  function wave(t, cycles, phase) { return Math.sin(TAU * (cycles * t / LOOP + phase)); }
  /* 0→1→0 bump centred at `at` seconds, `half` seconds wide, wrapping around the loop */
  function bump(t, at, half) {
    var d = Math.abs(t - at); d = Math.min(d, LOOP - d);
    var k = Math.max(0, 1 - d / half);
    return k * k * (3 - 2 * k);
  }

  /* ---------- geometry ---------- */
  function px(n) { return { x: n.x * W, y: n.y * H }; }
  function buildPaths() {
    paths = EDGES.map(function (e) {
      var a = px(NODES[e[0]]), b = px(NODES[e[1]]);
      var mid = e[2] === 'h' ? { x: b.x, y: a.y } : { x: a.x, y: b.y };
      var l1 = Math.hypot(mid.x - a.x, mid.y - a.y), l2 = Math.hypot(b.x - mid.x, b.y - mid.y);
      return { a: a, m: mid, b: b, l1: l1, len: l1 + l2 };
    });
  }
  function pointAt(p, f) {
    var d = f * p.len;
    if (d <= p.l1) { var k = p.l1 ? d / p.l1 : 0; return { x: p.a.x + (p.m.x - p.a.x) * k, y: p.a.y + (p.m.y - p.a.y) * k }; }
    var k2 = (d - p.l1) / (p.len - p.l1 || 1);
    return { x: p.m.x + (p.b.x - p.m.x) * k2, y: p.m.y + (p.b.y - p.m.y) * k2 };
  }

  /* ---------- drawing: backdrop ---------- */
  function drawStreets() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(' + INK + ',0.05)';
    ctx.beginPath();
    STREETS_X.forEach(function (f) { var x = Math.round(f * W) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, H); });
    STREETS_Y.forEach(function (f) { var y = Math.round(f * H) + 0.5; ctx.moveTo(0, y); ctx.lineTo(W, y); });
    ctx.moveTo(0, H * 0.64); ctx.lineTo(W * 0.3, H);            // one diagonal avenue
    ctx.stroke();
  }
  function sweepX(t) { return (t / LOOP) * (W + 400) - 200; }   // starts and ends fully off-screen
  function drawSweep(t) {
    var x = sweepX(t);
    var g = ctx.createLinearGradient(x - 160, 0, x, 0);
    g.addColorStop(0, 'rgba(' + RED + ',0)');
    g.addColorStop(1, 'rgba(' + RED + ',0.06)');
    ctx.fillStyle = g; ctx.fillRect(x - 160, 0, 160, H);
    ctx.fillStyle = 'rgba(' + RED + ',0.35)'; ctx.fillRect(x, 0, 1, H);
  }
  function sweepGlow(t, nx) { return Math.max(0, 1 - Math.abs(sweepX(t) - nx) / 140); }

  /* ---------- drawing: traces + pulses ---------- */
  function strokePath(p) {
    ctx.beginPath(); ctx.moveTo(p.a.x, p.a.y); ctx.lineTo(p.m.x, p.m.y); ctx.lineTo(p.b.x, p.b.y); ctx.stroke();
  }
  function drawEdges(t) {
    ctx.lineWidth = 1;
    paths.forEach(function (p, i) {
      var lit = bump(t, (i * 1.37) % LOOP, 1.6);
      ctx.strokeStyle = 'rgba(' + INK + ',' + (0.16 + 0.2 * lit) + ')';
      strokePath(p);
      // corner tick, like a solder joint
      ctx.fillStyle = 'rgba(' + INK + ',' + (0.18 + 0.2 * lit) + ')';
      ctx.fillRect(p.m.x - 1.5, p.m.y - 1.5, 3, 3);
    });
  }
  function drawPulse(p, f, rgb) {
    var tail = Math.min(0.18, 46 / p.len), steps = 8;
    for (var s = 0; s < steps; s++) {
      var f0 = f - tail * (s / steps), f1 = f - tail * ((s + 1) / steps);
      if (f1 < 0) break;
      var A = pointAt(p, f0), B = pointAt(p, f1);
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.9 * (1 - s / steps)) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    }
  }
  function drawPulses(t) {
    paths.forEach(function (p, i) {
      var biz = NODES[EDGES[i][0]].kind === 'biz';
      // business → club (perks, sponsorship): mint; club → business (members as customers): sky
      var f1 = ((t / LOOP) * (1 + (i % 2)) + i * 0.29) % 1;
      var f2 = ((t / LOOP) * 1 + i * 0.61 + 0.5) % 1;
      drawPulse(p, f1, biz ? RED : AMBER);
      var rev = { a: p.b, m: p.m, b: p.a, l1: p.len - p.l1, len: p.len };
      drawPulse(rev, f2, biz ? AMBER : RED);
      if (f1 > 0.86) ring(p.b, (f1 - 0.86) / 0.14, biz ? RED : AMBER);
    });
  }
  function ring(c, k, rgb) {
    ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.5 * (1 - k)) + ')';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(c.x, c.y, 22 + 18 * k, 0, TAU); ctx.stroke();
  }

  /* ---------- drawing: node badges + icons ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  var ICONS = {
    cup: function () {
      ctx.moveTo(-6, -3); ctx.lineTo(-5, 7); ctx.lineTo(5, 7); ctx.lineTo(6, -3); ctx.closePath();
      ctx.moveTo(6, -1); ctx.arc(7.5, 1.5, 2.6, -Math.PI / 2, Math.PI / 2);
      ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-3.5, -8, -2, -10);
      ctx.moveTo(2, -6); ctx.quadraticCurveTo(0.5, -8, 2, -10);
    },
    pizza: function () {
      ctx.moveTo(-7, -5); ctx.lineTo(7, -5); ctx.lineTo(0, 8); ctx.closePath();
      ctx.moveTo(-8, -7.5); ctx.quadraticCurveTo(0, -10, 8, -7.5);
      ctx.moveTo(-0.5, -1.5); ctx.arc(-2, -1.5, 1.5, 0, TAU);
      ctx.moveTo(2.8, 2); ctx.arc(1.3, 2, 1.5, 0, TAU);
    },
    burger: function () {
      ctx.moveTo(-8, -1); ctx.quadraticCurveTo(-8, -8, 0, -8); ctx.quadraticCurveTo(8, -8, 8, -1); ctx.closePath();
      ctx.moveTo(-8.5, 2.5); ctx.lineTo(8.5, 2.5);
      ctx.moveTo(-7.5, 5.5); ctx.lineTo(-7.5, 7.5); ctx.lineTo(7.5, 7.5); ctx.lineTo(7.5, 5.5);
    },
    store: function () {
      ctx.moveTo(-8, -3); ctx.lineTo(-6.5, -8); ctx.lineTo(6.5, -8); ctx.lineTo(8, -3); ctx.closePath();
      ctx.moveTo(-7, -3); ctx.lineTo(-7, 8); ctx.lineTo(7, 8); ctx.lineTo(7, -3);
      ctx.moveTo(-2.5, 8); ctx.lineTo(-2.5, 2); ctx.lineTo(2.5, 2); ctx.lineTo(2.5, 8);
      ctx.moveTo(-2.7, -3); ctx.lineTo(-2.2, -8); ctx.moveTo(2.7, -3); ctx.lineTo(2.2, -8);
    },
    cap: function () {
      ctx.moveTo(-9, -2); ctx.lineTo(0, -6.5); ctx.lineTo(9, -2); ctx.lineTo(0, 2.5); ctx.closePath();
      ctx.moveTo(-5, 0.5); ctx.lineTo(-5, 4.5); ctx.quadraticCurveTo(0, 8, 5, 4.5); ctx.lineTo(5, 0.5);
      ctx.moveTo(9, -2); ctx.lineTo(9, 5);
    },
    gear: function () {
      ctx.moveTo(4, 0); ctx.arc(0, 0, 4, 0, TAU);
      for (var i = 0; i < 8; i++) {
        var a = i * TAU / 8;
        ctx.moveTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5); ctx.lineTo(Math.cos(a) * 8.5, Math.sin(a) * 8.5);
      }
    },
    note: function () {
      ctx.moveTo(-3, 6); ctx.arc(-5, 6, 2.2, 0, TAU);
      ctx.moveTo(7, 4); ctx.arc(5, 4, 2.2, 0, TAU);
      ctx.moveTo(-2.8, 6); ctx.lineTo(-2.8, -6); ctx.lineTo(7.2, -8); ctx.lineTo(7.2, 4);
      ctx.moveTo(-2.8, -2.5); ctx.lineTo(7.2, -4.5);
    },
    trophy: function () {
      ctx.moveTo(-5, -8); ctx.lineTo(5, -8); ctx.lineTo(5, -3); ctx.quadraticCurveTo(5, 2, 0, 2);
      ctx.quadraticCurveTo(-5, 2, -5, -3); ctx.closePath();
      ctx.moveTo(-5, -6); ctx.quadraticCurveTo(-9, -6, -8, -2); ctx.quadraticCurveTo(-7, 0, -4.5, -0.5);
      ctx.moveTo(5, -6); ctx.quadraticCurveTo(9, -6, 8, -2); ctx.quadraticCurveTo(7, 0, 4.5, -0.5);
      ctx.moveTo(0, 2); ctx.lineTo(0, 5.5); ctx.moveTo(-4, 8); ctx.lineTo(4, 8); ctx.lineTo(3, 5.5); ctx.lineTo(-3, 5.5); ctx.closePath();
    },
    leaf: function () {
      ctx.moveTo(-7, 7); ctx.quadraticCurveTo(-8, -6, 7, -8); ctx.quadraticCurveTo(8, 6, -7, 7); ctx.closePath();
      ctx.moveTo(-7, 7); ctx.lineTo(3, -3);
    },
    people: function () {
      ctx.moveTo(-1.5, -4); ctx.arc(-4, -4, 2.5, 0, TAU);
      ctx.moveTo(6.5, -4); ctx.arc(4, -4, 2.5, 0, TAU);
      ctx.moveTo(-9, 7); ctx.quadraticCurveTo(-9, 0, -4, 0); ctx.quadraticCurveTo(-0.5, 0, 0, 4);
      ctx.moveTo(0, 4); ctx.quadraticCurveTo(0.5, 0, 4, 0); ctx.quadraticCurveTo(9, 0, 9, 7);
    }
  };
  function drawNodes(t, small) {
    var size = small ? 30 : 40, half = size / 2;
    ctx.font = '500 11px Roboto, -apple-system, sans-serif';
    ctx.textBaseline = 'top';
    NODES.forEach(function (n, i) {
      var c = px(n), rgb = n.kind === 'biz' ? RED : INK;
      var glow = sweepGlow(t, c.x);
      var bob = wave(t, 1, i * 0.13) * 1.5;          // tiny float, one cycle per loop
      var y = c.y + bob;
      if (glow > 0) {
        ctx.fillStyle = 'rgba(' + rgb + ',' + (0.16 * glow) + ')';
        ctx.beginPath(); ctx.arc(c.x, y, half + 10, 0, TAU); ctx.fill();
      }
      rr(c.x - half + 3, y - half + 3, size, size, 3);           // hard offset shadow, like the page's boxes
      ctx.fillStyle = 'rgba(' + INK + ',0.9)'; ctx.fill();
      rr(c.x - half, y - half, size, size, 3);
      ctx.fillStyle = 'rgba(' + (glow > 0.4 ? NOTE : BADGE) + ',1)'; ctx.fill();
      ctx.strokeStyle = 'rgba(' + INK + ',0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save();
      ctx.translate(c.x, y); ctx.scale(small ? 0.8 : 1, small ? 0.8 : 1);
      ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.75 + 0.25 * glow) + ')';
      ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ICONS[n.icon](); ctx.stroke();
      ctx.restore();
      if (!small) {
        var tw = ctx.measureText(n.label).width;
        var lx = Math.min(Math.max(c.x - tw / 2, 8), W - tw - 8);
        ctx.fillStyle = 'rgba(' + GROUND + ',0.92)';          // backing so traces never cut through a name
        ctx.fillRect(lx - 4, y + half + 4, tw + 8, 15);
        ctx.fillStyle = 'rgba(' + INK + ',' + (0.72 + 0.28 * glow) + ')';
        ctx.fillText(n.label, lx, y + half + 6);
      }
    });
  }

  /* ---------- drawing: chart panels + perk tags ---------- */
  function panel(x, y, w, h, title) {
    rr(x + 4, y + 4, w, h, 3); ctx.fillStyle = 'rgba(' + INK + ',0.9)'; ctx.fill();
    rr(x, y, w, h, 3);
    ctx.fillStyle = 'rgba(' + BADGE + ',1)'; ctx.fill();
    ctx.strokeStyle = 'rgba(' + INK + ',0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = 'rgba(' + INK + ',0.75)';
    ctx.font = '500 10.5px Roboto, -apple-system, sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(title, x + 12, y + 10);
  }
  function drawBarPanel(t) {
    var w = 176, h = 92, x = W * 0.035, y = H * 0.56;
    panel(x, y, w, h, 'Club-member visits');
    var n = 8, bw = 12, gap = 7, base = y + h - 12, top = y + 32;
    for (var i = 0; i < n; i++) {
      var v = 0.45 + 0.08 * i / n + 0.22 * wave(t, 1, i * 0.11) + 0.08 * wave(t, 2, i * 0.27);
      var bh = Math.max(4, (base - top) * Math.min(1, v));
      ctx.fillStyle = i === n - 1 ? 'rgba(' + RED + ',1)' : 'rgba(' + INK + ',0.8)';
      ctx.fillRect(x + 12 + i * (bw + gap), base - bh, bw, bh);
    }
  }
  function drawLinePanel(t) {
    var w = 176, h = 92, x = W * 0.965 - w, y = H * 0.55;
    panel(x, y, w, h, 'New sign-ups');
    var x0 = x + 12, x1 = x + w - 12, y0 = y + 34, y1 = y + h - 12, pts = 28;
    ctx.beginPath();
    for (var i = 0; i <= pts; i++) {
      var u = i / pts + t / LOOP;                    // scroll exactly one period per loop
      var v = 0.5 + 0.22 * Math.sin(TAU * u) + 0.12 * Math.sin(TAU * 3 * u + 1) + 0.06 * Math.sin(TAU * 5 * u);
      var px_ = x0 + (x1 - x0) * i / pts, py = y1 - (y1 - y0) * v;
      i ? ctx.lineTo(px_, py) : ctx.moveTo(px_, py);
    }
    ctx.strokeStyle = 'rgba(' + RED + ',1)'; ctx.lineWidth = 2; ctx.stroke();
  }
  var TAGS = [
    { text: 'Members get 15% off', node: 0, at: 2.2, dx: 30, dy: -6, tilt: -2 },
    { text: 'Sponsoring the beach cleanup', node: 7, at: 6.8, dx: -210, dy: -46, tilt: 1.5 },
    { text: '+38 student customers', node: 5, at: 4.6, dx: -150, dy: 56, tilt: -1 }
  ];
  function drawTags(t) {
    ctx.font = '500 11.5px Roboto, -apple-system, sans-serif'; ctx.textBaseline = 'middle';
    TAGS.forEach(function (g) {
      var k = bump(t, g.at, 1.4);
      if (k <= 0.01) return;
      var c = px(NODES[g.node]), tw = ctx.measureText(g.text).width;
      var x = Math.min(Math.max(c.x + g.dx, 8), W - tw - 30), y = c.y + g.dy + (1 - k) * 6;
      // yellow sticky note, slightly crooked, pressed onto the map
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(x + (tw + 22) / 2, y); ctx.rotate(g.tilt * Math.PI / 180); ctx.translate(-(x + (tw + 22) / 2), -y);
      ctx.fillStyle = 'rgba(' + INK + ',0.85)'; ctx.fillRect(x + 3, y - 13 + 3, tw + 22, 28);
      ctx.fillStyle = 'rgba(' + NOTE + ',1)'; ctx.fillRect(x, y - 13, tw + 22, 28);
      ctx.strokeStyle = 'rgba(' + INK + ',0.9)'; ctx.lineWidth = 1.2; ctx.strokeRect(x, y - 13, tw + 22, 28);
      ctx.fillStyle = 'rgb(26,26,26)'; ctx.fillText(g.text, x + 11, y + 1);
      ctx.restore();
    });
  }

  /* Darken the middle so the headline always reads cleanly on top. */
  function drawVignette(small) {
    var g = ctx.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, Math.max(W, H) * (small ? 0.75 : 0.5));
    g.addColorStop(0, 'rgba(' + GROUND + ',' + (small ? 0.9 : 0.88) + ')');
    g.addColorStop(0.55, 'rgba(' + GROUND + ',0.55)');
    g.addColorStop(1, 'rgba(' + GROUND + ',0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  function frame(t) {
    var small = W < 720;
    applyPalette();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawStreets();
    drawSweep(t);
    drawEdges(t);
    drawPulses(t);
    if (small) {                                     // phones: badges stay faint, under the centre fade
      ctx.globalAlpha = 0.5; drawNodes(t, true); ctx.globalAlpha = 1;
      drawVignette(true);
      return;
    }
    drawVignette(false);
    drawNodes(t, false);
    drawBarPanel(t); drawLinePanel(t); drawTags(t);
  }

  /* ---------- lifecycle ---------- */
  function resize() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    buildPaths();
    if (reduced || !running) frame(3.2);
  }
  function tick(now) {
    if (!running) return;
    frame((now / 1000) % LOOP);
    raf = requestAnimationFrame(tick);
  }
  function setRunning(on) {
    on = on && visible && !document.hidden && !reduced;
    if (on === running) return;
    running = on;
    if (on) raf = requestAnimationFrame(tick); else cancelAnimationFrame(raf);
  }
  function initHeroMotion() {
    canvas = document.getElementById('heroMotion');
    if (!canvas || !canvas.getContext) return;
    ctx = canvas.getContext('2d');
    resize();
    if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas); else window.addEventListener('resize', resize);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; setRunning(true); }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { setRunning(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!running) frame(3.2); });
    setRunning(true);
  }
  window.renderHeroMotionFrame = function (t) { frame(t); };   // debug/preview hook
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHeroMotion); else initHeroMotion();
})();

