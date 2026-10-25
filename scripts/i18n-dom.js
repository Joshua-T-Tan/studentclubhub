/* ============================================================
   i18n-dom.js — translates the site's fixed English UI text.
   Most screens are built from English strings in JS. Instead of
   wrapping every one in t(), this layer watches the page and swaps
   any text node (plus placeholder / title / aria-label) whose whole
   text is a known UI phrase for the chosen language. Phrases live
   in scripts/lang/<code>.js (UI_PHRASES + UI_PATTERNS for messages
   that contain a name or number), loaded only when that language
   is picked. Things people wrote (club names, descriptions, chat,
   reviews, bios) are never touched. English is the source text, so
   switching back simply restores it. Loaded right after auth.js.
   ============================================================ */
var UI_PHRASES = {};    // { es: { "English text": "Texto", ... }, ... }
var UI_PATTERNS = {};   // { es: [ ["^Welcome back, (.+)!$", "¡Hola de nuevo, $1!"], ... ] }
var UI_HTML = {};       // whole sentences with <strong>/<em>/<br> inside: { es: { "innerHTML": "translated innerHTML" } }
var _uiLoaded = { en: true }, _uiLoading = {};
var TR_ATTRS = ['placeholder', 'title', 'aria-label'];
/* User-written content: never translate inside these. */
var TR_SKIP = 'script,style,textarea,select option[data-raw],[data-no-tr],[contenteditable="true"],' +
  '.card-title h3,.card-desc,.card-meta,.chat-feed,.review-text,.review-head .n,.tquote,.tby-text .tn,.tby-text .tr,' +
  '.name-row h1,.biz-cuisines,.about-text,.club-about,.perk-box p,.pdeal-box p,.pdeal-tag,.adm-text,.adm-meta,.adm-card-top strong,' +
  '.profile-head h1,.pt-identity span,.roster-row .who,.leader-row .who,.club-id-chip,.biz-idchip,.brand-text,' +
  '#shareLinkInput,.adm-code,.adm-row-note,.tc-body h3,.tc-meta,.gp-title,.reach-contact a,.contact-emailline a';

function _trNorm(s) { return String(s).replace(/\s+/g, ' ').trim(); }
function _trCompiled(lang) {
  var list = UI_PATTERNS[lang];
  if (!list) return [];
  if (!list._re) list._re = list.map(function (p) { return [new RegExp(p[0]), p[1]]; });
  return list._re;
}
/* The translation for one whole English phrase, or null. */
function trPhrase(s, lang) {
  lang = lang || LANG; if (lang === 'en') return null;
  var d = UI_PHRASES[lang]; if (!d) return null;
  var k = _trNorm(s); if (!k) return null;
  if (Object.prototype.hasOwnProperty.call(d, k)) return d[k];
  var pats = _trCompiled(lang);
  for (var i = 0; i < pats.length; i++) { var m = k.match(pats[i][0]); if (m) return k.replace(pats[i][0], pats[i][1]); }
  return null;
}
var _trText = new WeakMap();   // text node -> { en, out }
var _trAttr = new WeakMap();   // element -> { attr: { en, out } }
function _trSkipped(el) { return !el || (el.closest && el.closest(TR_SKIP)); }
function _trTextNode(n) {
  var p = n.parentNode; if (!p || p.nodeType !== 1 || _trSkipped(p)) return;
  var rec = _trText.get(n), cur = n.nodeValue;
  if (rec && cur !== rec.out) rec = null;            // the app rewrote it: that's the new English
  var en = rec ? rec.en : cur;
  if (!/[A-Za-z]/.test(en)) return;
  var tr = trPhrase(en);
  var out = tr == null ? en : en.replace(en.trim(), tr);
  if (cur !== out) n.nodeValue = out;
  if (out !== en) _trText.set(n, { en: en, out: out }); else _trText.delete(n);
}
function _trAttrs(el) {
  if (_trSkipped(el)) return;
  var store = _trAttr.get(el) || {};
  TR_ATTRS.forEach(function (a) {
    if (!el.hasAttribute(a)) return;
    var cur = el.getAttribute(a), rec = store[a];
    if (rec && cur !== rec.out) rec = null;
    var en = rec ? rec.en : cur; if (!/[A-Za-z]/.test(en)) return;
    var tr = trPhrase(en), out = tr == null ? en : tr;
    if (cur !== out) el.setAttribute(a, out);
    if (out !== en) store[a] = { en: en, out: out }; else delete store[a];
  });
  _trAttr.set(el, store);
}
/* Sentences split by bold/italic words are translated as one piece (innerHTML), so word order works. */
var TR_INLINE_ONLY = /^(?:[^<]|<(?:strong|em|b|i|br)\s*\/?>|<\/(?:strong|em|b|i)>)*$/i;
var TR_BLOCKS = 'p,li,h1,h2,h3,h4,label,small,span,div,td,strong';
var _trHtml = new WeakMap();   // element -> { en, out }
function _trBlockKey(html) { return (html.indexOf('<') > -1 && TR_INLINE_ONLY.test(html)) ? _trNorm(html) : null; }
function _trBlock(el) {
  if (_trSkipped(el)) return;
  var rec = _trHtml.get(el), cur = el.innerHTML;
  if (rec && cur !== rec.out) rec = null;
  var en = rec ? rec.en : cur, key = _trBlockKey(en);
  if (!key) return;
  var d = UI_HTML[LANG], tr = (LANG !== 'en' && d && Object.prototype.hasOwnProperty.call(d, key)) ? d[key] : null;
  var out = tr == null ? en : tr;
  if (cur !== out) el.innerHTML = out;
  if (out !== en) _trHtml.set(el, { en: en, out: out }); else _trHtml.delete(el);
}
function translateTree(root) {
  root = root || document.body; if (!root) return;
  if (root.nodeType === 3) return _trTextNode(root);
  if (root.nodeType !== 1) return;
  if (root.matches && root.matches(TR_BLOCKS)) _trBlock(root);
  root.querySelectorAll(TR_BLOCKS).forEach(function (el) { if (el.innerHTML.indexOf('<') > -1) _trBlock(el); });
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
  while ((n = w.nextNode())) _trTextNode(n);
  _trAttrs(root);
  root.querySelectorAll('[placeholder],[title],[aria-label]').forEach(_trAttrs);
}
/* Watch for anything the app renders and translate it as it appears. */
var _trQueue = new Set(), _trScheduled = false, _trObserver = null;
function _trFlush() {
  _trScheduled = false;
  var items = Array.from(_trQueue); _trQueue.clear();
  items.forEach(function (n) { if (n.isConnected) translateTree(n); });
}
function _trStartObserver() {
  if (_trObserver || !window.MutationObserver) return;
  _trObserver = new MutationObserver(function (muts) {
    muts.forEach(function (m) {
      if (m.type === 'childList') m.addedNodes.forEach(function (n) { _trQueue.add(n); });
      else _trQueue.add(m.target);
    });
    _trFlush();   // right away (observer callbacks already run after the app's DOM work; rAF would stall in background tabs)
  });
  _trObserver.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TR_ATTRS });
}
/* Called by applyLanguage(): load that language's phrase file (once), then re-translate the page. */
function uiLanguageChanged() {
  var lang = LANG;
  var go = function () { if (LANG === lang && document.body) translateTree(document.body); };
  if (_uiLoaded[lang]) return go();
  if (_uiLoading[lang]) return;
  _uiLoading[lang] = true;
  var s = document.createElement('script');
  s.src = 'scripts/lang/' + lang + '.js';
  s.onload = function () { _uiLoaded[lang] = true; go(); };
  s.onerror = function () { _uiLoading[lang] = false; };
  document.head.appendChild(s);
}
document.addEventListener('DOMContentLoaded', function () { _trStartObserver(); if (LANG !== 'en') uiLanguageChanged(); });

/* ---- developer helper: collect the English UI text currently on screen (used to build lang files) ---- */
function harvestUiText(into, htmlInto) {
  into = into || new Set();
  var inBlock = new Set();
  document.body.querySelectorAll(TR_BLOCKS).forEach(function (el) {
    if (_trSkipped(el) || (el.closest && el.closest('.hidden'))) return;
    var key = _trBlockKey(el.innerHTML); if (!key || !/[A-Za-z]{2}/.test(key)) return;
    if (htmlInto) htmlInto.add(key);
    inBlock.add(el);
  });
  var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
  while ((n = w.nextNode())) {
    var p = n.parentNode; if (!p || _trSkipped(p)) continue;
    if (p.closest && p.closest('.hidden')) continue;
    var b = p; while (b && b !== document.body) { if (inBlock.has(b)) break; b = b.parentNode; } if (b && b !== document.body) continue;   // part of a whole-sentence block
    var k = _trNorm(n.nodeValue); if (k && /[A-Za-z]{2}/.test(k)) into.add(k);
  }
  document.body.querySelectorAll('[placeholder],[title],[aria-label]').forEach(function (el) {
    if (_trSkipped(el) || (el.closest && el.closest('.hidden'))) return;
    TR_ATTRS.forEach(function (a) { var v = el.getAttribute(a); if (v && /[A-Za-z]{2}/.test(v)) into.add(_trNorm(v)); });
  });
  return into;
}
