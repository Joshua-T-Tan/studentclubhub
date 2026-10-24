/* ============================================================
   icons.js — the site's drawn icon set + school-doodle banners.
   Replaces emoji everywhere: line icons share one style (24px
   grid, 2px round strokes, currentColor) so they read as ink
   drawings on the Paper theme. Doodles are small SVG sketches
   (pencil, ruler, sticky note, …) colored by theme tokens via
   .dd-* classes in styles/theme.css. Loaded before auth.js.
   ============================================================ */

var ICON_PATHS = {
  /* ---- general UI ---- */
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  directions: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  crown: '<path d="m2 6 3 12h14l3-12-6 6-4-8-4 8-6-6z"/><path d="M5 21h14"/>',
  exit: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  swap: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  doc: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h4"/>',
  draft: '<path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v10"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10.4 12.6a2 2 0 1 1 3 3L8 21l-4 1 1-4Z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9h18v1.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13v8h14v-8"/><path d="M10 21v-5h4v5"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  /* ---- club categories ---- */
  flask: '<path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>',
  growth: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  palette: '<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  stethoscope: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
  ball: '<circle cx="12" cy="12" r="10"/><path d="M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94"/><path d="M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32"/><path d="M8.56 2.75c4.37 6 6 9.42 8 17.72"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h.01"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/>',
  /* ---- business categories ---- */
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'
};
/* Inline SVG for a named icon. size in px (default 18). */
function svgIcon(name, size, cls) {
  var p = ICON_PATHS[name]; if (!p) return '';
  var s = size || 18;
  return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s +
    '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
}

/* ============================================================
   SCHOOL DOODLES — for banners with no uploaded image and the
   About Us page banners. Each doodle is its own little SVG,
   placed by percentage so it works at any banner size.
   ============================================================ */
function _ddRuler() {
  var t = '';
  for (var i = 0; i < 17; i++) { var x = 12 + i * 9.5; t += '<path class="dd-ink" d="M' + x + ' 2v' + (i % 2 ? 7 : 13) + '"/>'; }
  return '<svg viewBox="0 0 170 36"><rect class="dd-ink dd-paper" x="2" y="2" width="166" height="32" rx="3"/>' + t + '</svg>';
}
var DOODLES = {
  pencil: '<svg viewBox="0 0 140 28"><rect class="dd-ink dd-note" x="22" y="4" width="96" height="20"/><path class="dd-ink" d="M22 11h96M22 17h96"/>' +
    '<path class="dd-ink dd-wood" d="M22 4 4 14l18 10Z"/><path class="dd-solid" d="M4 14 10 10.7v6.6Z"/><rect class="dd-ink dd-red" x="118" y="4" width="18" height="20" rx="2"/></svg>',
  ruler: _ddRuler(),
  clip: '<svg viewBox="0 0 30 80"><path class="dd-ink" d="M20 22v38a8 8 0 0 1-16 0V14a6 6 0 0 1 12 0v42a2.5 2.5 0 0 1-5 0V24"/></svg>',
  note: '<svg viewBox="0 0 96 96"><path class="dd-ink dd-note" d="M6 6h84v66L72 90H6Z"/><path class="dd-ink" d="M72 90V72h18"/><path class="dd-ink" d="M18 28h52M18 42h44M18 56h30"/></svg>',
  bulb: '<svg viewBox="0 0 76 80"><path class="dd-ink dd-note" d="M38 10a20 20 0 0 1 12 36c-3 2.5-4 5-4 9H30c0-4-1-6.5-4-9A20 20 0 0 1 38 10z"/>' +
    '<path class="dd-ink" d="M30 62h16M31 68h14M34 74h8M38 55V41M33 37l5 4 5-4M38 1v5M14 12l4 4M62 12l-4 4M7 32h5M64 32h5"/></svg>',
  star: '<svg viewBox="0 0 40 40"><polygon class="dd-ink dd-note" points="20,2 25,15 39,15 28,24 32,38 20,29 8,38 12,24 1,15 15,15"/></svg>',
  cap: '<svg viewBox="0 0 100 64"><path class="dd-ink" d="M24 31v15c0 8 52 8 52 0V31"/><path class="dd-ink dd-paper" d="M50 6 94 24 50 42 6 24Z"/>' +
    '<path class="dd-ink" d="M50 24 88 30v16"/><circle class="dd-ink dd-red" cx="88" cy="50" r="4"/></svg>',
  books: '<svg viewBox="0 0 100 74"><rect class="dd-ink dd-red" x="10" y="50" width="80" height="20" rx="2"/><rect class="dd-ink dd-note" x="16" y="30" width="70" height="20" rx="2"/>' +
    '<rect class="dd-ink dd-paper" x="8" y="10" width="74" height="20" rx="2"/><path class="dd-ink" d="M22 50v20M28 30v20M70 10v20"/></svg>',
  apple: '<svg viewBox="0 0 60 64"><path class="dd-ink dd-red" d="M30 20c-6-5-22-6-24 12-2 16 10 30 18 30 3 0 4-2 6-2s3 2 6 2c8 0 20-14 18-30-2-18-18-17-24-12z"/>' +
    '<path class="dd-ink" d="M30 20c0-6 2-10 6-14"/><path class="dd-ink dd-paper" d="M34 13c6-6 14-4 16-2-4 6-12 6-16 2z"/></svg>',
  arrow: '<svg viewBox="0 0 130 60"><path class="dd-ink dd-dash" d="M6 44C30 8 60 8 70 32s35 20 50-14"/><path class="dd-ink" d="m109 17 11 1-3 11"/></svg>',
  aplus: '<svg viewBox="0 0 84 70"><text class="dd-aplus" x="42" y="47" text-anchor="middle">A+</text>' +
    '<path class="dd-redline" d="M14 38c0-22 56-27 60-5 3 18-40 28-56 14-6-5-5-16 6-22"/></svg>',
  squiggle: '<svg viewBox="0 0 120 24"><path class="dd-redline" d="M4 14c10-12 18 8 28-2s18 8 28-2 18 8 28-2 18 8 28-2"/></svg>'
};
/* name, left%, top%, width px, rotation°, hide-on-small-screens */
var DOODLE_LAYOUTS = {
  /* club/business banner: the name + chips sit bottom-left, so keep that corner clear */
  banner: [
    ['ruler', 7, 15, 180, 4, 0], ['aplus', 30, 10, 78, -8, 0], ['clip', 41, 8, 24, 20, 1], ['star', 48, 14, 32, 12, 1],
    ['pencil', 56, 18, 170, -16, 0], ['note', 81, 14, 96, 6, 0], ['star', 93, 6, 24, -10, 1], ['cap', 19, 38, 96, -6, 1],
    ['arrow', 46, 44, 130, 0, 1], ['bulb', 70, 50, 58, 8, 1], ['apple', 61, 66, 50, -10, 1], ['books', 87, 60, 100, -4, 1]
  ],
  /* About Us page banner: title on the left, doodles mostly on the right */
  page: [
    ['star', 34, 14, 26, 12, 1], ['pencil', 52, 16, 160, -14, 1], ['note', 76, 12, 92, 6, 0], ['star', 92, 10, 24, -8, 1],
    ['aplus', 44, 56, 74, -6, 1], ['bulb', 63, 52, 56, 8, 1], ['books', 84, 56, 96, -4, 0], ['squiggle', 8, 80, 110, 0, 1], ['clip', 96, 46, 22, 18, 1]
  ]
};
/* The doodle layer + two strips of yellow tape. Purely decorative. */
function doodleLayer(layout) {
  var items = DOODLE_LAYOUTS[layout] || DOODLE_LAYOUTS.banner;
  return '<div class="doodles" aria-hidden="true"><span class="dd-tape dd-tape-l"></span><span class="dd-tape dd-tape-r"></span>' +
    items.map(function (d) {
      return '<span class="dd' + (d[5] ? ' dd-sm-hide' : '') + '" style="left:' + d[1] + '%;top:' + d[2] + '%;width:' + d[3] + 'px;transform:rotate(' + d[4] + 'deg)">' + DOODLES[d[0]] + '</span>';
    }).join('') + '</div>';
}
