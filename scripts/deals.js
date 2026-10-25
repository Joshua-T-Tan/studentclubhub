/* ============================================================
   deals.js — how partnerships and promotions show up on the site.

   Two different things, two different looks:
   - Partnership (red, puzzle piece): an approved agreement between
     two clubs/businesses (partner_agreements, see partnerships.js).
   - Promotion (yellow sticky note, black price tag): a business's
     own deal with no partner (business_promotions). Up to 3 at once.

   Rules used everywhere (cards, banner, page, search, filters):
   - Visitors see an item only while it is live (start ≤ today ≤ end)
     and its owner hasn't hidden it. Owners also see their hidden and
     scheduled items on their own page, marked "Only visible to you".
   - Card bottom box: a visible partnership wins; otherwise the first
     visible promotion.
   - Name-row squares: yellow puzzle = open to partnerships, red puzzle
     = partnered (×2/×3 on hover), price tag = running a promotion.
   - Optional countdown timer per item, only while it is live.
   Loaded after partnerships.js, before editors.js.
   ============================================================ */

var PROMO_KINDS = [
  ['discount', 'Discount'], ['bogo', 'Buy one, get one'], ['coupon', 'Coupon / promo code'],
  ['freebie', 'Free item or add-on'], ['bundle', 'Bundle deal'], ['other', 'Other']
];
var PROMO_LIMIT = 3, PARTNER_LIMIT = 3;
/* Filled price tag (black on the yellow note) */
var ICON_TAG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' +
  '<path fill-rule="evenodd" d="M21.41 11.58l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM6.5 8a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>';
/* Clock: the countdown's ticking face (hands animate in CSS) and the plain toggle icon */
var ICON_CLOCK_TICK = '<svg class="dt-clock" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9.5"/><line class="dt-min" x1="12" y1="12" x2="12" y2="6.5"/><line class="dt-sec" x1="12" y1="12" x2="16.5" y2="12"/></svg>';
var ICON_CLOCK = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9.5 2h5"/><path d="M12 2v3"/></svg>';

function promoKindLabel(p) { if (p.kind === 'other') return p.kind_other || 'Other'; var k = PROMO_KINDS.find(function (x) { return x[0] === p.kind; }); return k ? k[1] : 'Promotion'; }
function _dToday() { return _todayStr(); }
function _fmtDealDate(s) { return _fmtAgrDate(s); }
function _dealRange(start, end) { return (start ? _fmtDealDate(start) : '') + (end ? ' – ' + _fmtDealDate(end) : ''); }

/* ---------- Promotions: one load, mapped by business ---------- */
var _promosByBiz = {}, _promosLoaded = false;
function loadPromotions() {
  if (typeof sbRest !== 'function') return Promise.resolve();
  return sbRest('business_promotions?select=*&order=created_at.asc').then(function (rows) {
    _promosByBiz = {};
    (rows || []).forEach(function (p) { (_promosByBiz[p.business_id] = _promosByBiz[p.business_id] || []).push(p); });
    _promosLoaded = true; refreshDealViews();
  }).catch(function () {});
}
function promoLive(p) { var t = _dToday(); return String(p.starts) <= t && t <= String(p.ends); }
function promoExpired(p) { return String(p.ends) < _dToday(); }
function promoUpcoming(p) { return String(p.starts) > _dToday(); }
function promosOf(bizId) { return _promosByBiz[String(bizId)] || []; }
/* What visitors see: live and not hidden. */
function publicPromos(bizId) { return promosOf(bizId).filter(function (p) { return !p.hidden && promoLive(p); }); }
/* Promotions that count toward the limit (not ended yet). */
function openPromos(bizId) { return promosOf(bizId).filter(function (p) { return !promoExpired(p); }); }

/* ---------- Partnerships (from partnerships.js → _agreementFor) ---------- */
function partnershipsOf(kind, id) { return (_agreementFor[kind] && _agreementFor[kind][String(id)]) || []; }
function agrLive(a) { return !a.upcoming; }
function publicPartnerships(kind, id) { return partnershipsOf(kind, id).filter(function (a) { return !a.hidden && agrLive(a); }); }

/* ---------- Countdown timer ---------- */
/* Counts down to the END of the end date (local time). */
function _dealEndMs(end) { var d = new Date(end + 'T23:59:59'); return d.getTime(); }
function _dealLeft(end) {
  var ms = _dealEndMs(end) - Date.now(); if (!(ms > 0)) return null;
  var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var unit = { ja: '日', 'zh-CN': '天', 'zh-TW': '天' }[typeof LANG !== 'undefined' ? LANG : 'en'] || 'd';
  return (d ? d + unit + ' ' : '') + p2(h) + ':' + p2(m) + ':' + p2(x);
}
function dealTimerHTML(end, label) {
  var left = _dealLeft(end); if (!left) return '';
  return '<span class="deal-timer" data-end="' + escAttr(end) + '" title="' + escAttr(label || 'Time left') + '">' + ICON_CLOCK_TICK + '<span class="dt-txt" data-no-tr>' + left + '</span></span>';
}
function _tickDealTimers() {
  document.querySelectorAll('.deal-timer[data-end]').forEach(function (el) {
    var t = el.querySelector('.dt-txt'), left = _dealLeft(el.getAttribute('data-end'));
    if (!t) return;
    if (left) { if (t.textContent !== left) t.textContent = left; }
    else if (!el.classList.contains('is-done')) { el.classList.add('is-done'); t.textContent = '0:00:00'; }
  });
}
setInterval(_tickDealTimers, 1000);

/* ---------- Name-row squares (directory cards) ---------- */
function _countTag(n) { return n > 1 ? '<span class="sq-n">×' + n + '</span>' : ''; }
/* The item a card features: a visible partnership first, else a visible promotion. */
function _featured(kind, obj) {
  var ps = publicPartnerships(kind, obj.id);
  if (ps.length) return { kind: 'partner', item: ps[0] };
  var pr = kind === 'business' ? publicPromos(obj.id) : [];
  if (pr.length) return { kind: 'promo', item: pr[0] };
  return null;
}
/* Which visible item's countdown a card shows: the featured one if its timer is on, else any visible one with a timer. */
function _cardTimerItem(kind, obj) {
  var f = _featured(kind, obj);
  if (f && f.item.timer) return f;
  var ps = publicPartnerships(kind, obj.id).filter(function (a) { return a.timer; });
  if (ps.length) return { kind: 'partner', item: ps[0] };
  var pr = (kind === 'business' ? publicPromos(obj.id) : []).filter(function (p) { return p.timer; });
  return pr.length ? { kind: 'promo', item: pr[0] } : null;
}
function dealSquares(kind, obj) {
  var ps = publicPartnerships(kind, obj.id), pr = kind === 'business' ? publicPromos(obj.id) : [];
  var open = kind === 'business' ? !!obj.partnership_open : !!obj.partnershipOpen;
  var tm = _cardTimerItem(kind, obj);
  var timer = function (which) { return (tm && tm.kind === which) ? dealTimerHTML(tm.kind === 'partner' ? tm.item.end : tm.item.ends, 'Time left') : ''; };
  var html = '';
  if (ps.length) {
    html += '<span class="deal-sq is-partner" tabindex="0" title="' + escAttr('Partnered with ' + ps.map(function (a) { return a.partnerName; }).join(', ')) + '">' + ICON_PARTNER + _countTag(ps.length) + '</span>' + timer('partner');
  } else if (open) {
    html += '<span class="name-openp-ico" title="Open to partnerships">' + ICON_PARTNER + '</span>';
  }
  if (pr.length) html += '<span class="deal-sq is-promo" tabindex="0" title="' + escAttr(pr.length > 1 ? pr.length + ' promotions running' : 'Promotion running') + '">' + ICON_TAG + _countTag(pr.length) + '</span>' + timer('promo');
  return html;
}
/* Banner chips (already showing the count). */
function dealBannerChips(kind, obj) {
  var ps = publicPartnerships(kind, obj.id), pr = kind === 'business' ? publicPromos(obj.id) : [];
  var html = '';
  if (ps.length) html += '<span class="deal-chip is-partner" title="' + escAttr('Partnered with ' + ps.map(function (a) { return a.partnerName; }).join(', ')) + '">' + ICON_PARTNER + '<span>Partnership</span>' + (ps.length > 1 ? '<b>×' + ps.length + '</b>' : '') + '</span>';
  if (pr.length) html += '<span class="deal-chip is-promo">' + ICON_TAG + '<span>Promotion</span>' + (pr.length > 1 ? '<b>×' + pr.length + '</b>' : '') + '</span>';
  return html;
}

/* ---------- Business card bottom box (partnership > promotion) ---------- */
function cardDealBox(b) {
  var f = _featured('business', b), priv = false;
  if (!f && isBizOwner(b)) {   // nothing public: the owner still sees what they've hidden or scheduled
    var hp = partnershipsOf('business', b.id)[0], hq = openPromos(b.id)[0];
    if (hp) f = { kind: 'partner', item: hp }; else if (hq) f = { kind: 'promo', item: hq };
    priv = !!f;
  }
  if (!f) return '';
  var chip = priv ? ' <span class="deal-vis is-private is-compact" title="Only visible to you" aria-label="Only visible to you">' + ICON_EYE_OFF + '</span>' : '';
  if (f.kind === 'partner') {
    return '<div class="perk-box perk-2row card-pbox' + (priv ? ' is-private' : '') + '"><div class="pbox-head"><span class="perk-tag">' + ICON_PARTNER + ' Partnership</span>' +
      '<span class="pbox-with"><span>with</span> <span class="pbox-name">' + escHtml(f.item.partnerName) + '</span></span>' + chip + '</div>' +
      '<p>' + escHtml(f.item.deal || '') + '</p></div>';
  }
  var p = f.item;
  return '<div class="perk-box perk-2row card-promo' + (priv ? ' is-private' : '') + '"><div class="pbox-head"><span class="perk-tag">' + ICON_TAG + ' <span class="pk-label">' + escHtml(promoKindLabel(p)) + '</span></span>' +
    '<span class="perk-aud">' + (p.audience === 'everyone' ? 'Everyone' : 'Students') + '</span>' + chip + '</div>' +
    '<p>' + escHtml(p.description) + '</p></div>';
}

/* ---------- On-page boxes ---------- */
function _visChip(hidden, upcoming, start) {
  if (hidden) return '<span class="deal-vis is-private">' + ICON_EYE_OFF + ' Only visible to you</span>';
  if (upcoming) return '<span class="deal-vis is-private">' + svgIcon('calendar', 13) + ' Scheduled, starts ' + escHtml(_fmtDealDate(start)) + '</span>';
  return '<span class="deal-vis is-public">' + ICON_EYE + ' Visible to everyone</span>';
}
function _timerBtn(on, live, call) {
  if (!live) return '';   // a countdown only makes sense while the deal is running
  return '<button class="deal-eye timer-btn' + (on ? ' on' : '') + '" title="' + (on ? 'Turn off the countdown timer' : 'Show a countdown timer') + '" aria-pressed="' + on + '" onclick="' + call + '">' + ICON_CLOCK + '</button>';
}
/* One red box per partnership (club or business page). */
function partnershipDealBox(kind, obj, owner) {
  return partnershipsOf(kind, obj.id).map(function (a) {
    if ((a.hidden || a.upcoming) && !owner) return '';
    var live = agrLive(a), priv = a.hidden || a.upcoming;
    var ctrls = owner ? '<div class="deal-ctrls">' +
      _timerBtn(a.timer, live, 'togglePartnerTimer(\'' + a.id + '\',\'' + a.side + '\')') +
      '<button class="deal-eye" title="' + (a.hidden ? 'Show this partnership to visitors again' : 'Hide this partnership from visitors') + '" onclick="togglePartnerDealHide(\'' + a.id + '\',\'' + a.side + '\')">' + (a.hidden ? ICON_EYE_OFF : ICON_EYE) + '</button></div>' : '';
    var open = a.partnerType === 'business' ? 'openBusiness(\'' + jsArg(a.partnerId) + '\')' : 'openClub(\'' + jsArg(a.partnerId) + '\')';
    var timer = (a.timer && live) ? dealTimerHTML(a.end, 'Time left in this partnership') : '';
    return '<div class="pdeal-box' + (priv ? ' is-private' : '') + '">' + ctrls +
      '<div class="dbox-title">' + ICON_PARTNER + ' <span>Partnership with</span> <a class="pdeal-partner" onclick="' + open + '">' + escHtml(a.partnerName) + '</a></div>' +
      '<div class="dbox-chips"><span class="pd-type">' + escHtml(a.ptype || 'Partnership') + '</span>' + timer + (owner ? _visChip(a.hidden, a.upcoming, a.start) : '') + '</div>' +
      '<p class="dbox-deal">' + escHtml(a.deal || '') + '</p>' +
      ((a.start || a.end) ? '<div class="form-note dbox-dates">' + svgIcon('calendar', 13) + ' ' + escHtml(_dealRange(a.start, a.end)) + '</div>' : '') + '</div>';
  }).join('');
}
/* The business's own promotions (yellow notes) + the owner's "add" prompt. */
function promotionBoxes(b, owner) {
  var list = owner ? promosOf(b.id) : publicPromos(b.id);
  var html = list.map(function (p) {
    var live = promoLive(p), up = promoUpcoming(p), ended = promoExpired(p);
    var ctrls = owner ? '<div class="deal-ctrls">' +
      _timerBtn(p.timer, live, 'togglePromoTimer(\'' + p.id + '\')') +
      '<button class="deal-eye" title="Edit promotion" onclick="editPromotion(\'' + b.id + '\',\'' + p.id + '\')">' + ICON_PEN + '</button>' +
      '<button class="deal-eye" title="' + (p.hidden ? 'Show this promotion to visitors again' : 'Hide this promotion from visitors') + '" onclick="togglePromoHidden(\'' + p.id + '\')">' + (p.hidden ? ICON_EYE_OFF : ICON_EYE) + '</button>' +
      '<button class="deal-eye danger" title="Delete promotion" onclick="deletePromotion(\'' + p.id + '\')">' + ICON_TRASH + '</button></div>' : '';
    var vis = !owner ? '' : ended ? '<span class="deal-vis is-private">' + svgIcon('calendar', 13) + ' Ended, hidden from visitors</span>' : _visChip(p.hidden, up, p.starts);
    var timer = (p.timer && live) ? dealTimerHTML(p.ends, 'Time left in this promotion') : '';
    return '<div class="promo-box' + ((p.hidden || !live) ? ' is-private' : '') + '">' + ctrls +
      '<div class="dbox-title">' + ICON_TAG + ' <span class="pk-label">' + escHtml(promoKindLabel(p)) + '</span></div>' +
      '<div class="dbox-chips"><span class="perk-aud">' + (p.audience === 'everyone' ? 'Everyone' : 'Students only') + '</span>' + timer + vis + '</div>' +
      '<p class="dbox-deal">' + escHtml(p.description) + '</p>' +
      (p.redemption ? '<p class="form-note dbox-redeem"><strong>How to redeem:</strong> <span class="promo-redeem">' + escHtml(p.redemption) + '</span></p>' : '') +
      '<div class="form-note dbox-dates">' + svgIcon('calendar', 13) + ' Valid ' + escHtml(_dealRange(p.starts, p.ends)) + '</div></div>';
  }).join('');
  if (owner) {
    var n = openPromos(b.id).length;
    html += n < PROMO_LIMIT
      ? '<button class="promo-add" onclick="editPromotion(\'' + b.id + '\')">' + svgIcon('plus', 16) + ' <span>' + (n ? 'Add another promotion' : 'Add a promotion') + '</span> <span class="form-note">(' + n + ' of ' + PROMO_LIMIT + ')</span></button>'
      : '<p class="form-note promo-limit">You’re running ' + PROMO_LIMIT + ' promotions, the most at once. Delete one or let it end to add another.</p>';
  }
  return html;
}

/* ---------- Owner toggles for promotions ---------- */
function _findPromo(id) { var out = null; Object.keys(_promosByBiz).forEach(function (k) { _promosByBiz[k].forEach(function (p) { if (p.id === id) out = p; }); }); return out; }
function _patchPromo(id, patch, msg) {
  var p = _findPromo(id); if (!p) return;
  var before = {}; Object.keys(patch).forEach(function (k) { before[k] = p[k]; p[k] = patch[k]; });
  refreshDealViews();
  sbRest('business_promotions?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t save. Only the owner can change this promotion.'); toast(msg); })
    .catch(function (ex) { Object.keys(before).forEach(function (k) { p[k] = before[k]; }); refreshDealViews(); toast(ex.message); });
}
function togglePromoHidden(id) { var p = _findPromo(id); if (p) _patchPromo(id, { hidden: !p.hidden }, p.hidden ? 'Promotion is visible again.' : 'Promotion hidden from visitors.'); }
function togglePromoTimer(id) { var p = _findPromo(id); if (p) _patchPromo(id, { timer: !p.timer }, p.timer ? 'Countdown timer off.' : 'Countdown timer on.'); }
function deletePromotion(id) {
  var p = _findPromo(id); if (!p) return;
  openConfirm('Delete this promotion?', 'It will be removed from your page and the directory.', svgIcon('trash', 26), function () {
    sbRest('business_promotions?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=representation' } })
      .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t delete. Only the owner can remove this promotion.'); toast('Promotion deleted.'); return loadPromotions(); })
      .catch(function (ex) { toast(ex.message); });
  }, 'Delete');
}

/* ---------- Search / filter helpers (Browse Businesses) ---------- */
function dealSearchText(b) {
  return publicPromos(b.id).map(function (p) { return promoKindLabel(p) + ' ' + p.description; })
    .concat(publicPartnerships('business', b.id).map(function (a) { return a.partnerName + ' ' + (a.ptype || '') + ' ' + (a.deal || ''); })).join(' ');
}
function bizMatchesDealFilter(b, f) {
  if (f === 'All') return true;
  if (f === 'partner') return publicPartnerships('business', b.id).length > 0;
  if (f === 'promo') return publicPromos(b.id).length > 0;
  return publicPromos(b.id).some(function (p) { return p.kind === f; });
}

/* ---------- Repaint whatever shows deals, keeping the scroll position ---------- */
function refreshDealViews() {
  var y = window.scrollY, v = (typeof currentViewName === 'function') ? currentViewName() : '';
  if (v === 'business' && typeof currentBiz !== 'undefined' && currentBiz) renderBusinessPage(currentBiz);
  else if (v === 'club' && typeof currentClubId !== 'undefined' && currentClubId) renderClub();
  else if (v === 'shops' && typeof repaintBizCards === 'function') repaintBizCards();
  else if (v === 'main' && typeof applyFilters === 'function') applyFilters();
  if (v !== 'main' && $('clubGrid') && typeof applyFilters === 'function') applyFilters();
  if (y) window.scrollTo(0, y);
}

document.addEventListener('DOMContentLoaded', function () { loadPromotions(); });
