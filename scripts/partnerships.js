/* ============================================================
   partnerships.js — partnership lifecycle + the "Partnership" tag.
   A club president or business owner sends a request from the other
   side's "Reach Out" popup (messages.js). It is one partner_agreements
   row: a = sender, b = recipient, status 'pending'. The recipient's
   CURRENT leadership approves (→ 'launched') or rejects (→ 'declined');
   the sender can cancel (→ 'deleted'); either side can end a launched
   one (→ 'ended'). Requests are addressed to the club/business itself
   (a_id / b_id), not to a person, so a presidency change hands them over.
   A launched partnership shows the tag + deal box from its start date
   through its end date, then auto-expires. Uses sbRest().
   ============================================================ */

/* _partneredWith lives in modal.js: { club:{id:[names]}, business:{id:[names]} }.
   _agreementFor holds each entity's launched-agreement info for the on-page deal box. */
var _agreementFor = { club: {}, business: {} };

/* Local calendar date as YYYY-MM-DD (for duration/expiry comparisons). */
function _todayStr() {
  var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}
/* Active THROUGH the end date; expires the day after. */
function _agrExpired(p) { var end = p && (p.a_end || p.b_end); return !!end && _todayStr() > String(end); }
/* Not live until the start date. */
function _agrNotStarted(p) { var s = p && (p.a_start || p.b_start); return !!s && String(s) > _todayStr(); }

/* ---- Load LAUNCHED agreements → the "Partnership" tag + on-page deal boxes ---- */
function loadPartnerAgreements(cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  return sbRest('partner_agreements?status=eq.launched&select=*').then(function (rows) {
    _partneredWith = { club: {}, business: {} }; _agreementFor = { club: {}, business: {} };
    var expired = [];
    (rows || []).forEach(function (p) {
      if (_agrExpired(p)) { expired.push(p.id); return; }   // duration over → tag auto-removed
      if (_agrNotStarted(p)) return;                         // approved, but not live until its start date
      if (p.a_type && p.a_id) {
        (_partneredWith[p.a_type][p.a_id] = _partneredWith[p.a_type][p.a_id] || []).push(p.b_name);
        (_agreementFor[p.a_type][p.a_id] = _agreementFor[p.a_type][p.a_id] || []).push({ id: p.id, side: 'a', partnerName: p.b_name, deal: p.a_deal, hidden: p.a_hidden, start: p.a_start, end: p.a_end });
      }
      if (p.b_type && p.b_id) {
        (_partneredWith[p.b_type][p.b_id] = _partneredWith[p.b_type][p.b_id] || []).push(p.a_name);
        (_agreementFor[p.b_type][p.b_id] = _agreementFor[p.b_type][p.b_id] || []).push({ id: p.id, side: 'b', partnerName: p.a_name, deal: p.b_deal, hidden: p.b_hidden, start: p.b_start, end: p.b_end });
      }
    });
    // Permanently retire expired partnerships server-side (self-healing; one PATCH each, only if still launched).
    expired.forEach(function (id) { sbRest('partner_agreements?id=eq.' + id + '&status=eq.launched', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) }).catch(function () {}); });
    if (typeof cb === 'function') cb();
    if (typeof currentBiz !== 'undefined' && currentBiz && $('view-business') && !$('view-business').classList.contains('hidden')) renderBusinessPage(currentBiz);
    if (typeof currentClubId !== 'undefined' && currentClubId && $('view-club') && !$('view-club').classList.contains('hidden')) renderClub();
  }).catch(function () { if (typeof cb === 'function') cb(); });
}
/* Directory cards don't carry the tag — it lives on the club/business banner. */
function partnershipBadge() { return ''; }
function _fmtAgrDate(s) { try { return new Date(s + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return s; } }

/* On-page box for each live partnership. The owner always sees the full deal with a
   show/hide eye and a status chip; visitors never see a hidden one. */
function partnershipDealBox(kind, obj, owner) {
  var list = _agreementFor[kind] && _agreementFor[kind][String(obj.id)];
  if (!list || !list.length) return '';
  return list.map(function (a) {
    if (a.hidden && !owner) return '';
    var eye = owner ? '<button class="pdeal-eye' + (a.hidden ? ' off' : '') + '" title="' + (a.hidden ? 'Show this partnership deal to visitors again' : 'Hide this partnership deal from visitors (the Partnership tag stays)') + '" onclick="togglePartnerDealHide(\'' + a.id + '\',\'' + a.side + '\')">' + (a.hidden ? ICON_EYE_OFF : ICON_EYE) + '</button>' : '';
    var chip = owner ? (a.hidden ? ' <span class="deal-vis is-private">' + ICON_EYE_OFF + ' Only visible to you</span>' : ' <span class="deal-vis is-public">' + ICON_EYE + ' Visible to everyone</span>') : '';
    var dates = (a.start || a.end) ? '<div class="form-note" style="margin-top:4px">' + svgIcon('calendar', 13) + ' ' + (a.start ? _fmtAgrDate(a.start) : '') + (a.end ? ' – ' + _fmtAgrDate(a.end) : '') + '</div>' : '';
    return '<div class="pdeal-box' + (a.hidden ? ' is-private' : '') + '">' + eye + '<div class="pdeal-tag">' + ICON_PARTNER + ' Partnership with ' + escHtml(a.partnerName) + '</div>' + chip +
      '<p>' + escHtml(a.deal || '') + '</p>' + dates + '</div>';
  }).join('');
}
function togglePartnerDealHide(agreementId, side) {
  var cur = null;
  ['club', 'business'].forEach(function (k) { Object.keys(_agreementFor[k]).forEach(function (id) { (_agreementFor[k][id] || []).forEach(function (a) { if (a.id === agreementId && a.side === side) cur = a; }); }); });
  if (!cur) return;
  var nv = !cur.hidden, patch = {}; patch[side + '_hidden'] = nv;
  sbRest('partner_agreements?id=eq.' + agreementId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) })
    .then(function () { loadPartnerAgreements(); toast(nv ? 'Partnership deal hidden from visitors.' : 'Partnership deal is now visible.'); }).catch(function (ex) { toast(ex.message); });
}

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

/* ---- Approve / reject / cancel / end ----
   Each one only applies if the request is still in the state the user saw (status guard),
   so a stale screen can't approve a canceled request or cancel a live partnership. */
function _agrRefreshUI() {
  loadPartnerAgreements();
  if (typeof renderInbox === 'function' && $('inboxBody') && $('view-inbox') && !$('view-inbox').classList.contains('hidden')) renderInbox();
  if (typeof refreshUnread === 'function') refreshUnread();
}
function _agrTransition(id, fromStatus, patch, okMsg) {
  return sbRest('partner_agreements?id=eq.' + encodeURIComponent(id) + '&status=eq.' + fromStatus, {
    method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch)
  }).then(function (rows) {
    if (rows && rows.length) toast(okMsg);
    else toast(fromStatus === 'pending' ? 'This request is no longer pending — it was already handled.' : 'This partnership has already ended.');
    _agrRefreshUI();
  }).catch(function (ex) { toast(ex.message); });
}
function approvePartnerRequest(id) {
  sbRest('partner_agreements?id=eq.' + encodeURIComponent(id) + '&select=a_end,b_end').then(function (rows) {
    var a = rows && rows[0];
    if (a && _agrExpired(a)) { toast('This request’s end date has already passed. Ask them to send a new one.'); return; }
    _agrTransition(id, 'pending', { status: 'launched', launched_at: new Date().toISOString(), a_confirmed: true, b_confirmed: true, a_launched: true, b_launched: true }, 'Partnership approved!');
  }).catch(function (ex) { toast(ex.message); });
}
function rejectPartnerRequest(id) {
  openConfirm('Reject this partnership request?', 'It will be removed from both sides’ Partnership Requests. This can’t be undone.', svgIcon('ban', 26), function () {
    _agrTransition(id, 'pending', { status: 'declined' }, 'Request rejected.');
  }, 'Reject');
}
function cancelPartnerRequest(id) {
  openConfirm('Cancel this request?', 'It will be withdrawn before the other side responds.', svgIcon('trash', 26), function () {
    _agrTransition(id, 'pending', { status: 'deleted' }, 'Request canceled.');
  }, 'Cancel request');
}
function endPartnership(id) {
  openConfirm('End this partnership?', 'The “Partnership” tag will be removed from both pages right away. This can’t be undone.', ICON_PARTNER, function () {
    _agrTransition(id, 'launched', { status: 'ended' }, 'Partnership ended.');
  }, 'End partnership');
}

/* Load live partnerships once at startup so banner tags appear. */
document.addEventListener('DOMContentLoaded', function () { if (typeof sbRest === 'function') loadPartnerAgreements(); });
