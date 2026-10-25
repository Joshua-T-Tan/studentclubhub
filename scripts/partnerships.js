/* ============================================================
   partnerships.js — partnership lifecycle.
   A club President or business owner sends a request from the other
   side's "Reach Out" popup (messages.js), choosing which of their own
   clubs/businesses it comes from. It is one partner_agreements row:
   a = sender, b = recipient, status 'pending', awaiting = 'b'.

   While pending, the side whose turn it is (`awaiting`) can approve
   (→ 'launched'), suggest changes (a counter-offer: the terms are
   updated, logged in `history`, and the turn passes to the other
   side), or turn it down. This repeats until one side's version is
   approved. Either side can withdraw a pending request or end a live
   partnership. The database trigger (trg_partner_guard) enforces the
   turns, the 3-active limit per club/business, and that each side
   only changes its own visibility + countdown timer.
   Requests are addressed to the club/business (a_id / b_id), not a
   person, so a leadership change hands them over. Uses sbRest().
   ============================================================ */

/* _agreementFor: each club/business's launched partnerships (live + scheduled) for its page, card and banner. */
var _agreementFor = { club: {}, business: {} };
var PARTNER_TYPES = ['Discount for members', 'Sponsorship / funding', 'Event collaboration', 'Other'];

/* Local calendar date as YYYY-MM-DD (for duration/expiry comparisons). */
function _todayStr() {
  var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}
function _agrEnd(p) { return p && (p.a_end || p.b_end); }
function _agrStart(p) { return p && (p.a_start || p.b_start); }
/* Active THROUGH the end date; expires the day after. */
function _agrExpired(p) { var end = _agrEnd(p); return !!end && _todayStr() > String(end); }
/* Not live until the start date. */
function _agrNotStarted(p) { var s = _agrStart(p); return !!s && String(s) > _todayStr(); }
function _fmtAgrDate(s) { try { return new Date(s + 'T00:00:00').toLocaleDateString(siteLocale(), { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return s; } }

/* ---- Load LAUNCHED agreements → deal boxes, squares and banner chips ---- */
function _agrSideEntry(p, side) {
  var o = side === 'a' ? 'b' : 'a';
  return { id: p.id, side: side, partnerName: p[o + '_name'], partnerType: p[o + '_type'], partnerId: p[o + '_id'],
    ptype: p.ptype || '', deal: p[side + '_deal'], hidden: !!p[side + '_hidden'], timer: !!p[side + '_timer'],
    start: p[side + '_start'], end: p[side + '_end'], upcoming: _agrNotStarted(p) };
}
function loadPartnerAgreements(cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  return sbRest('partner_agreements?status=eq.launched&select=*&order=launched_at.asc').then(function (rows) {
    _agreementFor = { club: {}, business: {} };
    var expired = [];
    (rows || []).forEach(function (p) {
      if (_agrExpired(p)) { expired.push(p.id); return; }   // duration over → removed everywhere
      ['a', 'b'].forEach(function (side) {
        var t = p[side + '_type'], id = p[side + '_id'];
        if (t && id && _agreementFor[t]) (_agreementFor[t][id] = _agreementFor[t][id] || []).push(_agrSideEntry(p, side));
      });
    });
    // Retire expired partnerships server-side (self-healing; only a party's own browser is allowed to).
    expired.forEach(function (id) { sbRest('partner_agreements?id=eq.' + id + '&status=eq.launched', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) }).catch(function () {}); });
    if (typeof cb === 'function') cb();
    if (typeof refreshDealViews === 'function') refreshDealViews();
  }).catch(function () { if (typeof cb === 'function') cb(); });
}
/* How many live-or-scheduled partnerships a club/business has (the limit is 3). */
function activePartnershipCount(type, id) { return ((_agreementFor[type] && _agreementFor[type][String(id)]) || []).length; }

function _findAgrEntry(agreementId, side) {
  var cur = null;
  ['club', 'business'].forEach(function (k) { Object.keys(_agreementFor[k]).forEach(function (id) { (_agreementFor[k][id] || []).forEach(function (a) { if (a.id === agreementId && a.side === side) cur = a; }); }); });
  return cur;
}
/* My side's visibility / countdown timer (the trigger lets each side change only its own). */
function _patchMySide(agreementId, side, field, msgOn, msgOff) {
  var cur = _findAgrEntry(agreementId, side); if (!cur) return;
  var key = field === 'hidden' ? 'hidden' : 'timer', nv = !cur[key], patch = {};
  patch[side + '_' + field] = nv; cur[key] = nv;
  if (typeof refreshDealViews === 'function') refreshDealViews();
  sbRest('partner_agreements?id=eq.' + agreementId, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t save. Only the club’s President or the business owner can change this.'); toast(nv ? msgOn : msgOff); })
    .catch(function (ex) { cur[key] = !nv; if (typeof refreshDealViews === 'function') refreshDealViews(); toast(ex.message); });
}
function togglePartnerDealHide(agreementId, side) { _patchMySide(agreementId, side, 'hidden', 'Partnership hidden from visitors.', 'Partnership is visible again.'); }
function togglePartnerTimer(agreementId, side) { _patchMySide(agreementId, side, 'timer', 'Countdown timer on.', 'Countdown timer off.'); }

/* The clubs I currently lead (I'm the President) + businesses I own. Partnerships are
   sent, approved and managed AS one of these — never as a private person. */
function _gatherMyEntities() {
  var mine = [];
  if (!currentUser) return Promise.resolve(mine);
  if (typeof CLUBS !== 'undefined') CLUBS.forEach(function (c) { if (typeof ownerOf === 'function' && ownerOf(c)) mine.push({ type: 'club', id: String(c.id), name: c.name, open: !!c.partnershipOpen, publicId: c.clubId || '' }); });
  return refreshMyBizIds().then(function (ids) {
    return ids.length ? sbRest('businesses?id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=id,name,partnership_open,public_id') : [];
  }).then(function (rows) {
    (rows || []).forEach(function (b) { mine.push({ type: 'business', id: String(b.id), name: b.name, open: !!b.partnership_open, publicId: b.public_id || '' }); });
    return mine;
  }).catch(function () { return mine; });
}
/* PostgREST `in.(…)` list for a set of entity ids (quoted; ids are club ids or UUIDs). */
function _idList(ids) { return encodeURIComponent('(' + ids.map(function (i) { return '"' + String(i).replace(/"/g, '') + '"'; }).join(',') + ')'); }

/* ---- Approve / suggest changes / decline / withdraw / end ----
   Each one only applies if the request is still in the state the user saw (status + turn
   guard), so a stale screen can't approve an old version or a withdrawn request. */
function _agrRefreshUI() {
  loadPartnerAgreements();
  if (typeof renderInbox === 'function' && $('view-inbox') && !$('view-inbox').classList.contains('hidden')) renderPendingAgreements();
  if (typeof refreshUnread === 'function') refreshUnread();
}
function _agrPatch(id, guard, patch, okMsg, staleMsg) {
  return sbRest('partner_agreements?id=eq.' + encodeURIComponent(id) + guard, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
  }).then(function (rows) {
    var ok = !!(rows && rows.length);
    toast(ok ? okMsg : staleMsg);
    if (typeof closeReach === 'function') closeReach();
    _agrRefreshUI();
    return ok;
  });
}
var _STALE = 'This request changed in the meantime. Open it again to see the latest version.';
function approvePartnerRequest(id, mySide) {
  sbRest('partner_agreements?id=eq.' + encodeURIComponent(id) + '&select=a_end,b_end').then(function (rows) {
    var a = rows && rows[0];
    if (a && _agrExpired(a)) { toast('This request’s end date has already passed. Suggest new dates instead.'); return; }
    return _agrPatch(id, '&status=eq.pending&awaiting=eq.' + mySide, { status: 'launched' }, 'Partnership approved!', _STALE);
  }).catch(function (ex) { toast(ex.message); });
}
/* A counter-offer: new terms, and the turn passes to the other side. */
function counterPartnerRequest(id, mySide, terms) {
  var patch = { ptype: terms.ptype, a_deal: terms.deal, b_deal: terms.deal, a_start: terms.start, b_start: terms.start, a_end: terms.end, b_end: terms.end };
  return _agrPatch(id, '&status=eq.pending&awaiting=eq.' + mySide, patch, 'Changes sent. They’ll approve them or reply with their own.', _STALE);
}
function rejectPartnerRequest(id) {
  openConfirm('Turn down this request?', 'It moves to Past on both sides. This can’t be undone.', svgIcon('ban', 26), function () {
    _agrPatch(id, '&status=eq.pending', { status: 'declined' }, 'Request turned down.', _STALE).catch(function (ex) { toast(ex.message); });
  }, 'Turn down');
}
function cancelPartnerRequest(id) {
  openConfirm('Withdraw this request?', 'It moves to Past on both sides. This can’t be undone.', svgIcon('trash', 26), function () {
    _agrPatch(id, '&status=eq.pending', { status: 'deleted' }, 'Request withdrawn.', _STALE).catch(function (ex) { toast(ex.message); });
  }, 'Withdraw');
}
function endPartnership(id) {
  openConfirm('End this partnership?', 'It will be removed from both pages right away and moves to Past. This can’t be undone.', ICON_PARTNER, function () {
    _agrPatch(id, '&status=eq.launched', { status: 'ended' }, 'Partnership ended.', 'This partnership has already ended.').catch(function (ex) { toast(ex.message); });
  }, 'End partnership');
}

/* Load live partnerships once at startup so squares, chips and boxes appear. */
document.addEventListener('DOMContentLoaded', function () { if (typeof sbRest === 'function') loadPartnerAgreements(); });
