/* ============================================================
   partnerships.js — lightweight, mutual-confirm partnerships (Phase 4).
   Either side sends a partnership request from the other's profile;
   the other side confirms it from their Inbox. Once BOTH agree, a
   green "Partnered with [Name]" badge shows on both banners.
   No terms, no duration, no money — just a verified mutual link.
   Stored in the `partner_links` table (shared). Uses sbRest().
   ============================================================ */

/* _partneredWith lives in modal.js: { club:{id:name}, business:{id:name} }.
   _agreementFor holds each entity's launched-agreement info for the on-page deal box. */
var _myBizForPartner = null, _agreementFor = { club: {}, business: {} };

/* Local calendar date as YYYY-MM-DD (for duration/expiry comparisons). */
function _todayStr() {
  var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
}
/* A launched partnership is active THROUGH its end date, and auto-expires the
   day after. The tag/badge is removed as soon as this is seen. */
function _agrExpired(p) {
  var end = p && (p.a_end || p.b_end); if (!end) return false;
  return _todayStr() > String(end);
}

/* ---- Load LAUNCHED agreements → the "Partnered with" badge + on-page deal boxes ---- */
function loadPartnerAgreements(cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  return sbRest('partner_agreements?status=eq.launched&select=*').then(function (rows) {
    if (typeof _partneredWith === 'undefined') window._partneredWith = { club: {}, business: {} };
    _partneredWith = { club: {}, business: {} }; _agreementFor = { club: {}, business: {} };
    var expired = [];
    (rows || []).forEach(function (p) {
      if (_agrExpired(p)) { expired.push(p.id); return; }   // duration over → tag auto-removed
      if (p.a_type && p.a_id) {
        (_partneredWith[p.a_type][p.a_id] = _partneredWith[p.a_type][p.a_id] || []).push(p.b_name);
        (_agreementFor[p.a_type][p.a_id] = _agreementFor[p.a_type][p.a_id] || []).push({ id: p.id, side: 'a', partnerName: p.b_name, deal: p.a_deal, hidden: p.a_hidden, start: p.a_start, end: p.a_end });
      }
      if (p.b_type && p.b_id) {
        (_partneredWith[p.b_type][p.b_id] = _partneredWith[p.b_type][p.b_id] || []).push(p.a_name);
        (_agreementFor[p.b_type][p.b_id] = _agreementFor[p.b_type][p.b_id] || []).push({ id: p.id, side: 'b', partnerName: p.a_name, deal: p.b_deal, hidden: p.b_hidden, start: p.b_start, end: p.b_end });
      }
    });
    // Permanently retire expired partnerships server-side (self-healing; one PATCH each).
    expired.forEach(function (id) { sbRest('partner_agreements?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) }).catch(function () {}); });
    if (typeof cb === 'function') cb();
    if (typeof currentBiz !== 'undefined' && currentBiz && $('view-business') && !$('view-business').classList.contains('hidden')) renderBusinessPage(currentBiz);
    if (typeof currentClubId !== 'undefined' && currentClubId && $('view-club') && !$('view-club').classList.contains('hidden')) renderClub();
  }).catch(function () {});
}
function loadPartnerLinks(cb) { return loadPartnerAgreements(cb); }   // back-compat alias
/* Card badge stays empty — the "Partnered with" mark lives on the profile banners. */
function partnershipBadge() { return ''; }
function _fmtAgrDate(s) { try { return new Date(s + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return s; } }
/* On-page box for each LAUNCHED partnership this club/shop has. Owners get a hide-eye
   (the deal hides from visitors; the "Partnered with" badge up top still shows). */
function partnershipDealBox(kind, obj, owner) {
  var list = _agreementFor[kind] && _agreementFor[kind][String(obj.id)];
  if (!list || !list.length) return '';
  return list.map(function (a) {
    if (a.hidden && !owner) return '';
    var eye = owner ? '<button class="pdeal-eye' + (a.hidden ? ' off' : '') + '" title="' + (a.hidden ? 'Deal hidden from visitors — click to show it' : 'Hide this partnership deal from visitors (the badge stays)') + '" onclick="togglePartnerDealHide(\'' + a.id + '\',\'' + a.side + '\')">' + (a.hidden ? ICON_EYE_OFF : ICON_EYE) + '</button>' : '';
    if (a.hidden && owner) {
      return '<div class="pdeal-box hidden-deal">' + eye + '<span class="form-note">Your partnership deal with <strong>' + escHtml(a.partnerName) + '</strong> is hidden from visitors. The “Partnered with” badge still shows.</span></div>';
    }
    var dates = (a.start || a.end) ? '<div class="form-note" style="margin-top:4px">🗓 ' + (a.start ? _fmtAgrDate(a.start) : '') + (a.end ? ' – ' + _fmtAgrDate(a.end) : '') + '</div>' : '';
    return '<div class="pdeal-box">' + eye + '<div class="pdeal-tag">' + ICON_PARTNER + ' Partnership with ' + escHtml(a.partnerName) + '</div>' +
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
/* ---- Target owner email (who must confirm) ---- */
function _targetOwnerEmail(type, obj) {
  if (type === 'business') return (obj.owner_email || obj.contact_email || '').toLowerCase();
  var pres = (obj.leaders || []).find(function (l) { return l.role === 'President'; }) || (obj.leaders || [])[0];
  return ((pres && pres.email) || obj.email || '').toLowerCase();
}

/* ---- Gather the entities the current user can partner AS (clubs they lead + businesses they own) ---- */
function _gatherMyEntities() {
  var mine = [];
  if (typeof CLUBS !== 'undefined') CLUBS.forEach(function (c) { if (typeof ownerOf === 'function' && ownerOf(c)) mine.push({ type: 'club', id: String(c.id), name: c.name, open: !!c.partnershipOpen, publicId: c.clubId || '' }); });
  return sbRest('businesses?owner_email=eq.' + encodeURIComponent(currentUser.email.toLowerCase()) + '&select=id,name,partnership_open,public_id').then(function (rows) {
    (rows || []).forEach(function (b) { mine.push({ type: 'business', id: String(b.id), name: b.name, open: !!b.partnership_open, publicId: b.public_id || '' }); });
    return mine;
  }).catch(function () { return mine; });
}
function _entityOpen(type, obj) { return type === 'business' ? !!obj.partnership_open : !!obj.partnershipOpen; }
function _resolveTarget(type, id) {
  return type === 'business'
    ? ((typeof currentBiz !== 'undefined' && currentBiz && currentBiz.id === id) ? currentBiz : (typeof _bizCache !== 'undefined' && _bizCache || []).find(function (x) { return x.id === id; }))
    : (typeof getClub === 'function' ? getClub(id) : null);
}

/* ============================================================
   Stage 1 — PARTNERSHIP PROPOSAL ENTRY POINT
   Puzzle icon by the name → validate → confirm popup → bot form card in chat.
   ============================================================ */
/* The clickable puzzle icon shown by a profile name (non-owners only). */
/* Purple (active) only when BOTH sides are open — the viewer owns an open club/shop
   AND the profile being viewed is open. Otherwise gray, but still clickable so the
   click can explain which side isn't open. */
var _iCanPartner = false;
function partnerProposeIcon(type, obj) {
  var active = _entityOpen(type, obj) && _iCanPartner;
  return '<button class="name-ico partner-propose ' + (active ? 'open' : 'closed') + '" title="' + (active ? 'Propose a partnership' : 'Partnership') + '" onclick="proposePartnershipStart(\'' + type + '\',\'' + escAttr(String(obj.id)) + '\')">' + ICON_PARTNER + '</button>';
}
/* Compute whether the current user owns at least one club/shop set to Open to partnerships. */
function refreshCanPartner(cb) {
  if (!currentUser) { _setCanPartner(false); if (typeof cb === 'function') cb(); return; }
  var clubOpen = (typeof CLUBS !== 'undefined') && CLUBS.some(function (c) { return typeof ownerOf === 'function' && ownerOf(c) && c.partnershipOpen; });
  if (clubOpen) { _setCanPartner(true); if (typeof cb === 'function') cb(); return; }
  if (typeof sbRest === 'function') {
    sbRest('businesses?owner_email=eq.' + encodeURIComponent(currentUser.email.toLowerCase()) + '&select=partnership_open').then(function (rows) {
      _setCanPartner((rows || []).some(function (b) { return b.partnership_open; })); if (typeof cb === 'function') cb();
    }).catch(function () { if (typeof cb === 'function') cb(); });
  } else { _setCanPartner(clubOpen); if (typeof cb === 'function') cb(); }
}
function _setCanPartner(v) {
  var changed = _iCanPartner !== v; _iCanPartner = v;
  if (changed) {   // repaint an open profile so the puzzle color reflects the new state
    if (typeof currentBiz !== 'undefined' && currentBiz && $('view-business') && !$('view-business').classList.contains('hidden')) renderBusinessPage(currentBiz);
    if (typeof currentClubId !== 'undefined' && currentClubId && $('view-club') && !$('view-club').classList.contains('hidden')) renderClub();
  }
}
var _proposeCtx = null;
function proposePartnershipStart(type, id) {
  if (!currentUser) { toast('Please log in first.'); if (typeof openAuth === 'function') openAuth('login'); return; }
  var obj = _resolveTarget(type, id); if (!obj) { toast('Couldn’t find that listing.'); return; }
  var targetOpen = _entityOpen(type, obj);
  var toName = obj.name, toOwner = _targetOwnerEmail(type, obj);
  var toRealId = type === 'business' ? (obj.public_id || '') : (obj.clubId || '');
  _gatherMyEntities().then(function (mine) {
    mine = mine.filter(function (e) { return !(e.type === type && e.id === String(id)); });
    var openMine = mine.filter(function (e) { return e.open; });
    // Your side isn't open (or you don't lead/own anything) → tell YOU to fix yours.
    if (!openMine.length) {
      toast(mine.length
        ? '⛔ Your club or business isn’t set to “Open to partnerships.” Turn it on in your page settings first.'
        : '⛔ You need to lead a club or own a business (set to Open to partnerships) to propose one.');
      return;
    }
    // Their side isn't open → tell you THEY aren't open.
    if (!targetOpen) { toast('⛔ ' + toName + ' isn’t open to partnerships right now.'); return; }
    _proposeCtx = { type: type, id: String(id), toName: toName, toOwner: toOwner, toRealId: toRealId, openMine: openMine };
    _showProposeModal();
  });
}
function _showProposeModal() {
  var ctx = _proposeCtx; if (!ctx) return;
  var picker = ctx.openMine.length > 1
    ? '<div class="field"><label>Propose as</label><select id="prFrom" class="select block-select">' + ctx.openMine.map(function (e) { return '<option value="' + e.type + ':' + escAttr(e.id) + '">' + escHtml(e.name) + ' (' + e.type + ')</option>'; }).join('') + '</select></div>'
    : '<input type="hidden" id="prFrom" value="' + ctx.openMine[0].type + ':' + escAttr(ctx.openMine[0].id) + '">';
  $('bizBody').innerHTML = '<div class="modal-pad"><div class="ro-head"><h3>Propose a partnership</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:12px">Propose a partnership with <strong>' + escHtml(ctx.toName) + '</strong>. By hitting <strong>Continue</strong>, a partnership agreement form opens for you to fill in; the other side reviews and signs it under their <strong>Partnership Requests</strong>.</p>' +
    picker +
    '<button id="prSend" class="btn primary block lg" onclick="submitProposePartnership()">Continue</button></div>';
  openOverlay('bizOverlay');
}
function submitProposePartnership() {
  var ctx = _proposeCtx; if (!ctx) return;
  var sel = $('prFrom'); var val = sel ? sel.value : (ctx.openMine[0].type + ':' + ctx.openMine[0].id);
  var parts = val.split(':'), fromType = parts[0], fromId = parts.slice(1).join(':');
  var fromEnt = ctx.openMine.find(function (e) { return e.type === fromType && e.id === fromId; }) || ctx.openMine[0];
  authBusy2('prSend', true, 'Sending…');
  // Don't create a second agreement if one already exists between these two (either direction).
  var eF = encodeURIComponent(fromId), eT = encodeURIComponent(ctx.id);
  var dupQ = 'partner_agreements?status=in.(draft,locked,launched)&or=(and(a_id.eq.' + eF + ',b_id.eq.' + eT + '),and(a_id.eq.' + eT + ',b_id.eq.' + eF + '))&select=id,status';
  sbRest(dupQ).then(function (dups) {
    if (dups && dups.length) {
      authBusy2('prSend', false); closeReach();
      toast(dups[0].status === 'launched' ? 'You’re already partnered with them — opening the agreement.' : 'You already have a partnership form with them — opening it.');
      if (typeof openAgreementForm === 'function') openAgreementForm(dups[0].id);
      throw '__handled__';
    }
    // A hidden anchor row (no chat messages) just gives the agreement a conversation_id.
    return ensureConversation({ type: ctx.type, id: ctx.id, name: ctx.toName, owner_email: ctx.toOwner });
  }).then(function (conv) {
    if (!conv) throw new Error('Could not start the partnership.');
    var agr = {
      conversation_id: conv.id, a_type: fromType, a_id: fromId, a_name: fromEnt.name, a_owner_email: currentUser.email.toLowerCase(),
      a_real_id: fromEnt.publicId || '', a_partner_id: ctx.toRealId || '',
      b_type: ctx.type, b_id: ctx.id, b_name: ctx.toName, b_owner_email: (ctx.toOwner || '').toLowerCase(),
      b_real_id: ctx.toRealId || '', b_partner_id: fromEnt.publicId || '', status: 'draft'
    };
    return sbRest('partner_agreements', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(agr) }).then(function (rows) {
      var a = rows && rows[0]; if (!a) throw new Error('Could not create the agreement.');
      return a.id;
    });
  }).then(function (agreementId) {
    closeReach(); toast('Partnership request sent! Opening the agreement form…');
    // The other side finds it under Partnership Requests; open it now for the proposer.
    if (typeof openAgreementForm === 'function') openAgreementForm(agreementId);
  }).catch(function (ex) { if (ex === '__handled__') return; authBusy2('prSend', false); toast(ex && ex.message ? ex.message : 'Something went wrong.'); });
}
/* openAgreementForm() + the full collaborative form live in scripts/agreement.js (Stage 2). */
/* Delete the agreement (marks it deleted for BOTH parties). */
function deleteAgreement(agreementId) {
  openConfirm('Delete this partnership form?', 'It will be removed for both you and the other party. This can’t be undone.', '🗑', function () {
    sbRest('partner_agreements?id=eq.' + agreementId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'deleted' }) })
      .then(function () { toast('Form deleted.'); if (typeof renderInbox === 'function' && $('inboxBody')) renderInbox(); }).catch(function (ex) { toast(ex.message); });
  });
}

/* ---- Request flow (opened from a profile) ---- */
function openPartnerRequest(targetType, targetId) {
  if (!currentUser) { toast('Please log in first.'); if (typeof openAuth === 'function') openAuth('login'); return; }
  var obj = targetType === 'business'
    ? ((typeof currentBiz !== 'undefined' && currentBiz && currentBiz.id === targetId) ? currentBiz : (typeof _bizCache !== 'undefined' && _bizCache || []).find(function (x) { return x.id === targetId; }))
    : (typeof getClub === 'function' ? getClub(targetId) : null);
  if (!obj) { toast('Couldn’t find that listing.'); return; }
  var toName = obj.name, toOwner = _targetOwnerEmail(targetType, obj);
  _gatherMyEntities().then(function (mine) {
    // can't partner with yourself
    mine = mine.filter(function (e) { return !(e.type === targetType && e.id === String(targetId)); });
    if (!mine.length) {
      $('bizBody').innerHTML = '<div class="modal-pad"><div class="ro-head"><h3>Request a partnership</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
        '<p class="form-note">You need to lead a club or own a business to request a partnership. Charter one first, then come back.</p></div>';
      openOverlay('bizOverlay'); return;
    }
    var opts = mine.map(function (e) { return '<option value="' + e.type + ':' + escAttr(e.id) + '">' + escHtml(e.name) + ' (' + e.type + ')</option>'; }).join('');
    $('bizBody').innerHTML = '<div class="modal-pad"><div class="ro-head"><h3>Request a partnership</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
      '<p class="form-note" style="margin-bottom:12px">Send a partnership request to <strong>' + escHtml(toName) + '</strong>. They confirm it under their Partnership Requests — once they do, you’ll both show a green “Partnered with” badge. No terms or money involved.</p>' +
      '<div id="prErr" class="auth-error hidden"></div>' +
      '<div class="field"><label>Partner as</label><select id="prFrom" class="select block-select">' + opts + '</select></div>' +
      '<button id="prSend" class="btn primary block lg" onclick="submitPartnerRequest(\'' + targetType + '\',\'' + escAttr(targetId) + '\',\'' + escAttr(toName) + '\',\'' + escAttr(toOwner) + '\')">Send request</button></div>';
    openOverlay('bizOverlay');
  });
}
function submitPartnerRequest(toType, toId, toName, toOwner) {
  var sel = $('prFrom'); if (!sel || !sel.value) return;
  var parts = sel.value.split(':'), fromType = parts[0], fromId = parts.slice(1).join(':');
  var fromName = sel.options[sel.selectedIndex].text.replace(/\s+\((club|business)\)$/, '');
  var row = {
    from_type: fromType, from_id: fromId, from_name: fromName, from_owner_email: currentUser.email.toLowerCase(),
    to_type: toType, to_id: String(toId), to_name: toName, to_owner_email: (toOwner || '').toLowerCase(), status: 'pending'
  };
  authBusy2('prSend', true, 'Sending…');
  // avoid duplicate pending/active links between the same two
  sbRest('partner_links?from_id=eq.' + encodeURIComponent(fromId) + '&to_id=eq.' + encodeURIComponent(String(toId)) + '&status=in.(pending,active)&select=id').then(function (existing) {
    if (existing && existing.length) { authBusy2('prSend', false); toast('You already have a request or partnership with them.'); closeReach(); return; }
    return sbRest('partner_links', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
      .then(function () { closeReach(); toast('Partnership request sent! They’ll confirm under Partnership Requests.'); });
  }).catch(function (ex) { authBusy2('prSend', false); var e = $('prErr'); if (e) { e.textContent = ex.message; e.classList.remove('hidden'); } });
}

/* ---- Confirm side: pending requests addressed to me, shown atop the Inbox ---- */
function renderPartnerRequests() {
  var el = $('partnerReqs'); if (!el || !currentUser) return;
  sbRest('partner_links?to_owner_email=eq.' + encodeURIComponent(currentUser.email.toLowerCase()) + '&status=eq.pending&order=created_at.desc').then(function (rows) {
    if (!rows || !rows.length) { el.innerHTML = ''; if (typeof _refreshPartnerEmpty === 'function') _refreshPartnerEmpty(); return; }
    el.innerHTML = rows.map(function (p) {
      return '<div class="pr-card"><div class="pr-body">' + ICON_PARTNER + '<div><strong>' + escHtml(p.from_name) + '</strong> wants to partner with <strong>' + escHtml(p.to_name) + '</strong>.</div></div>' +
        '<div class="pr-actions"><button class="btn ghost sm-btn" onclick="declinePartnerLink(\'' + p.id + '\')">Decline</button>' +
        '<button class="btn primary sm-btn" onclick="confirmPartnerLink(\'' + p.id + '\')">Confirm</button></div></div>';
    }).join('');
    if (typeof _refreshPartnerEmpty === 'function') _refreshPartnerEmpty();
  }).catch(function () {});
}
function confirmPartnerLink(id) {
  sbRest('partner_links?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'active', confirmed_at: new Date().toISOString() }) })
    .then(function () { toast('Partnership confirmed! 🤝'); loadPartnerLinks(); renderPartnerRequests(); }).catch(function (ex) { toast(ex.message); });
}
function declinePartnerLink(id) {
  sbRest('partner_links?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'declined' }) })
    .then(function () { toast('Request declined.'); renderPartnerRequests(); }).catch(function (ex) { toast(ex.message); });
}

/* ---- Partnership REQUEST approve / reject / cancel / end (partner_agreements) ----
   A request is one row with status 'pending'. The recipient (current owner) approves
   → 'launched' (tag shows for the duration) or rejects → 'declined'. Either party can
   End a launched one → 'ended'. Auto-expiry at the end date is handled in loadPartnerAgreements. */
function _agrRefreshUI() {
  if (typeof loadPartnerAgreements === 'function') loadPartnerAgreements();
  if (typeof renderInbox === 'function' && $('inboxBody')) renderInbox();
  if (typeof refreshUnread === 'function') refreshUnread();
}
function approvePartnerRequest(id) {
  sbRest('partner_agreements?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ status: 'launched', launched_at: new Date().toISOString(), a_confirmed: true, b_confirmed: true, a_launched: true, b_launched: true }) })
    .then(function () { toast('Partnership approved! 🤝'); _agrRefreshUI(); }).catch(function (ex) { toast(ex.message); });
}
function rejectPartnerRequest(id) {
  openConfirm('Reject this partnership request?', 'The other side will see it was declined. This can’t be undone.', '🚫', function () {
    sbRest('partner_agreements?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'declined' }) })
      .then(function () { toast('Request rejected.'); _agrRefreshUI(); }).catch(function (ex) { toast(ex.message); });
  }, 'Reject');
}
function cancelPartnerRequest(id) {
  openConfirm('Cancel this request?', 'It will be withdrawn before the other side responds.', '🗑', function () {
    sbRest('partner_agreements?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'deleted' }) })
      .then(function () { toast('Request canceled.'); _agrRefreshUI(); }).catch(function (ex) { toast(ex.message); });
  }, 'Cancel request');
}
function endPartnership(id) {
  openConfirm('End this partnership?', 'The “Partnership” tag will be removed from both pages right away. This can’t be undone.', '🤝', function () {
    sbRest('partner_agreements?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) })
      .then(function () { toast('Partnership ended.'); _agrRefreshUI(); }).catch(function (ex) { toast(ex.message); });
  }, 'End partnership');
}

/* Load active partnerships once at startup so banner badges appear. */
document.addEventListener('DOMContentLoaded', function () { if (typeof sbRest === 'function') loadPartnerLinks(); });
