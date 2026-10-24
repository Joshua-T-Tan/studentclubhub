/* ============================================================
   messages.js — partnership-requests inbox + email-based contact.

   The former in-app direct-message / chat inbox was REMOVED. Student Club
   Hub is an initial connector, not a message store — it does not persist
   conversations between users. "Reach Out" now opens the visitor's own
   email client (mailto:) addressed to the listing's PUBLIC contact email;
   nothing is sent by the platform.

   What remains here:
     • contactByEmail() — the email hand-off used by the Reach Out buttons.
     • the member directory (profiles) + a single hidden "conversation"
       anchor row, kept only to satisfy the partnership agreement record.
     • the Partnership Requests view (incoming agreement forms + legacy
       link requests) and its floating button, so partnerships still work.
   Loaded after business.js.
   ============================================================ */

/* ---------- Email-based contact (replaces in-app messaging) ---------- */
var _reachCtx = null, PARTNER_TYPES = ['Discount for members', 'Sponsorship / funding', 'Event collaboration', 'Other'];
function closeReach() { if (typeof closeOverlay === 'function') closeOverlay('bizOverlay'); }
/* Reach Out popup: shows the listing's PUBLIC contact email AND a partnership
   request form. "Send Request" creates a pending request the owner/president
   approves or rejects (no chat). Buttons call contactByEmail / openReachOut. */
function contactByEmail(targetType, id) { return openReachOut(targetType, id); }
function openReachOut(targetType, id) {
  if (!currentUser) { toast('Please log in first.'); if (typeof openAuth === 'function') openAuth('login'); return; }
  var obj = targetType === 'business'
    ? ((typeof currentBiz !== 'undefined' && currentBiz && currentBiz.id === id) ? currentBiz : (typeof _bizCache !== 'undefined' && _bizCache || []).find(function (x) { return x.id === id; }))
    : (typeof getClub === 'function' ? getClub(id) : null);
  if (!obj) { toast('Couldn’t find that listing.'); return; }
  var publicEmail = (targetType === 'business' ? (obj.contact_email || obj.owner_email || '') : (obj.email || '')).trim();
  var isMine = targetType === 'business'
    ? (typeof isBizOwner === 'function' && isBizOwner(obj))
    : (typeof ownerOf === 'function' && ownerOf(obj));
  // Route a request to whoever CURRENTLY leads the target (president may have changed).
  var recip = (targetType === 'club' && typeof _resolveClubOwner === 'function')
    ? _resolveClubOwner(obj)
    : Promise.resolve({ email: publicEmail, name: obj.owner_name || obj.name, memberId: obj.public_id || '' });
  recip.then(function (r) {
    _reachCtx = {
      targetType: targetType, id: String(id), name: obj.name, publicEmail: publicEmail, isMine: isMine,
      recipientEmail: ((r && r.email) || publicEmail || '').toLowerCase(),
      targetRealId: targetType === 'business' ? (obj.public_id || '') : (obj.clubId || '')
    };
    var gather = (!isMine && typeof _gatherMyEntities === 'function') ? _gatherMyEntities() : Promise.resolve([]);
    gather.then(function (mine) {
      _reachCtx.mine = (mine || []).filter(function (e) { return !(e.type === targetType && e.id === String(id)); });
      _renderReachOut();
    });
  });
}
function _renderReachOut() {
  var c = _reachCtx; if (!c) return;
  var emailOK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.publicEmail || '');
  var contactBlock = '<div class="reach-contact"><div class="form-note" style="margin-bottom:6px">Contact ' + escHtml(c.name) + ' directly by email:</div>' +
    (emailOK
      ? '<a class="btn ghost block" href="mailto:' + escAttr(c.publicEmail) + '?subject=' + encodeURIComponent('Reaching out via Student Club Hub — ' + c.name) + '">✉ ' + escHtml(c.publicEmail) + '</a>'
      : '<p class="form-note">No public contact email is listed yet.</p>') + '</div>';
  var form;
  if (c.isMine) {
    form = '<p class="form-note" style="margin-top:14px">This is your own listing — partnership requests from others appear under your Partnership Requests.</p>';
  } else if (!c.mine || !c.mine.length) {
    form = '<div class="reach-form"><div class="pr-section-h" style="margin-top:14px">Request a partnership</div>' +
      '<p class="form-note">You need to lead a club or own a business to send a partnership request. Register one first, then come back.</p></div>';
  } else {
    var picker = c.mine.length > 1
      ? '<div class="field"><label>Partner as</label><select id="roFrom" class="select block-select">' + c.mine.map(function (e) { return '<option value="' + e.type + ':' + escAttr(e.id) + '">' + escHtml(e.name) + ' (' + e.type + ')</option>'; }).join('') + '</select></div>'
      : '<input type="hidden" id="roFrom" value="' + c.mine[0].type + ':' + escAttr(c.mine[0].id) + '">';
    var today = (typeof _todayStr === 'function') ? _todayStr() : '';
    var typeOpts = PARTNER_TYPES.map(function (t) { return '<option>' + escHtml(t) + '</option>'; }).join('');
    form = '<div class="reach-form"><div class="pr-section-h" style="margin-top:14px">Request a partnership</div>' +
      '<div id="roErr" class="auth-error hidden"></div>' + picker +
      '<div class="field"><label>Partnership type</label><select id="roType" class="select block-select">' + typeOpts + '</select></div>' +
      '<div class="two-col"><div class="field"><label>Starts</label><input id="roStart" type="date" min="' + today + '" value="' + today + '"></div>' +
        '<div class="field"><label>Ends</label><input id="roEnd" type="date" min="' + today + '"></div></div>' +
      '<div class="field"><label>How it works <span class="form-note">(the deal / discount / what each side provides)</span></label>' +
        '<textarea id="roDesc" maxlength="400" placeholder="e.g. 10% off for verified club members, in exchange for a shout-out at our monthly events."></textarea></div>' +
      '<button id="roSend" class="btn primary block lg" onclick="submitReachOutRequest()">Send Request</button>' +
      '<p class="form-note" style="margin-top:8px">They approve or reject it from their Partnership Requests. Once approved, a “Partnership” tag shows on both pages until the end date (either side can end it sooner).</p></div>';
  }
  $('bizBody').innerHTML = '<div class="modal-pad"><div class="ro-head"><h3>Reach out to ' + escHtml(c.name) + '</h3>' +
    '<button class="icon-btn" onclick="closeReach()">✕</button></div>' + contactBlock + form + '</div>';
  openOverlay('bizOverlay');
}
function submitReachOutRequest() {
  var c = _reachCtx; if (!c) return;
  var sel = $('roFrom'); if (!sel || !sel.value) return;
  var parts = sel.value.split(':'), fromType = parts[0], fromId = parts.slice(1).join(':');
  var fromEnt = (c.mine || []).find(function (e) { return e.type === fromType && e.id === fromId; }) || c.mine[0];
  var ptype = ($('roType') && $('roType').value) || PARTNER_TYPES[0];
  var start = ($('roStart') && $('roStart').value) || '', end = ($('roEnd') && $('roEnd').value) || '';
  var desc = ($('roDesc') && $('roDesc').value || '').trim();
  var err = function (m) { var e = $('roErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } };
  if (!start || !end) return err('Set a start and end date for the partnership.');
  if (end < start) return err('The end date must be on or after the start date.');
  if (!desc) return err('Briefly describe how the partnership works.');
  var dealText = ptype + ' — ' + desc;
  if (typeof authBusy2 === 'function') authBusy2('roSend', true, 'Sending…');
  // Reuse partner_agreements: a = sender (me, pre-filled/confirmed), b = recipient.
  // status 'pending' until the recipient approves; a_* mirrored to b_* so the
  // launched badge + deal box render correctly on approval.
  var row = {
    a_type: fromType, a_id: fromId, a_name: fromEnt.name, a_owner_email: currentUser.email.toLowerCase(),
    a_real_id: fromEnt.publicId || '', a_partner_id: c.targetRealId || '', a_start: start, a_end: end, a_deal: dealText, a_agreed: true, a_confirmed: true,
    b_type: c.targetType, b_id: c.id, b_name: c.name, b_owner_email: (c.recipientEmail || '').toLowerCase(),
    b_real_id: c.targetRealId || '', b_partner_id: fromEnt.publicId || '', b_start: start, b_end: end, b_deal: dealText,
    status: 'pending'
  };
  var eF = encodeURIComponent(fromId), eT = encodeURIComponent(c.id);
  sbRest('partner_agreements?status=in.(pending,launched)&or=(and(a_id.eq.' + eF + ',b_id.eq.' + eT + '),and(a_id.eq.' + eT + ',b_id.eq.' + eF + '))&select=id,status')
    .then(function (dups) {
      if (dups && dups.length) { if (typeof authBusy2 === 'function') authBusy2('roSend', false); toast(dups[0].status === 'launched' ? 'You’re already partnered with them.' : 'You already have a pending request with them.'); closeReach(); return; }
      return sbRest('partner_agreements', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
        .then(function () { closeReach(); toast('Partnership request sent! They’ll approve or reject it.'); if (typeof refreshUnread === 'function') refreshUnread(); });
    }).catch(function (ex) { if (typeof authBusy2 === 'function') authBusy2('roSend', false); err((ex && ex.message) || 'Could not send the request.'); });
}
/* Back-compat: older buttons may still call reachOutInbox(). */
function reachOutInbox(targetType, id) { return openReachOut(targetType, id); }

/* ============================================================
   MEMBER DIRECTORY + hidden partnership anchor
   (no chat UI — these only back the partnership agreement record)
   ============================================================ */
/* Canonical, order-independent key for a pair of people (their two emails). */
function _peerKey(a, b) { a = (a || '').toLowerCase(); b = (b || '').toLowerCase(); return a < b ? a + '|' + b : b + '|' + a; }

/* Member directory (profiles table): self-register on login; resolve by ID/email. */
function sbUpsertProfile() {
  if (!currentUser || typeof sbRest !== 'function' || !currentUser.memberId) return Promise.resolve();
  return sbRest('profiles?on_conflict=member_id', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ member_id: currentUser.memberId, email: currentUser.email.toLowerCase(), name: currentUser.name, updated_at: new Date().toISOString() })
  }).catch(function () {});
}
function sbFindProfileByEmail(email) {
  if (typeof sbRest !== 'function' || !email) return Promise.resolve(null);
  return sbRest('profiles?email=eq.' + encodeURIComponent(email.toLowerCase()) + '&select=member_id,email,name')
    .then(function (r) { return (r && r[0]) || null; }).catch(function () { return null; });
}
function sbFindProfileById(memberId) {
  var id = (memberId || '').trim(); if (!id) return Promise.resolve(null);
  if (id[0] !== '#') id = '#' + id;
  return sbRest('profiles?member_id=eq.' + encodeURIComponent(id) + '&select=member_id,email,name')
    .then(function (r) { return (r && r[0]) || null; }).catch(function () { return null; });
}
function _resolvePeer(tg) {
  var email = (tg.peerEmail || tg.owner_email || '').toLowerCase();
  var name = tg.peerName || '', pid = tg.peerPublicId || '';
  if (email && (!name || !pid)) {
    return sbFindProfileByEmail(email).then(function (p) {
      if (p) { name = name || p.name || ''; pid = pid || p.member_id || ''; }
      return { email: email, name: name, publicId: pid };
    });
  }
  return Promise.resolve({ email: email, name: name, publicId: pid });
}
/* Find or create the single anchor row for a partnership (one per pair of
   people). It carries NO messages — it exists only so an agreement has a
   conversation_id. Never clobbers a row the other person created. */
function _findOrCreateConv(tg) {
  var meEmail = currentUser.email.toLowerCase();
  return _resolvePeer(tg).then(function (peer) {
    if (!peer.email) throw new Error('That listing has no contact yet — try another way to reach them.');
    var key = _peerKey(meEmail, peer.email);
    return sbRest('conversations?peer_key=eq.' + encodeURIComponent(key) + '&select=*').then(function (rows) {
      if (rows && rows[0]) return rows[0];
      var payload = {
        target_type: tg.type || 'person', target_id: String(tg.id || peer.publicId || peer.email), target_name: tg.name || peer.name || 'Member',
        owner_email: peer.email, owner_name: peer.name || null, owner_public_id: peer.publicId || null,
        user_email: meEmail, user_name: currentUser.name, user_public_id: currentUser.memberId || null,
        user_role: tg.role || 'member', club_name: null, peer_key: key,
        last_snippet: 'Partnership', last_message_at: new Date().toISOString()
      };
      return sbRest('conversations?on_conflict=peer_key', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(payload)
      }).then(function (r) { return r && r[0]; });
    });
  });
}
/* Used by the partnership proposer to anchor an agreement to a conversation row. */
function ensureConversation(tg) {
  var t = { type: tg.type, id: tg.id, name: tg.name, owner_email: (tg.owner_email || '').toLowerCase(), peerEmail: (tg.peerEmail || tg.owner_email || '').toLowerCase(), peerName: tg.peerName || '', peerPublicId: tg.peerPublicId || '' };
  return _findOrCreateConv(t);
}

/* ============================================================
   PARTNERSHIP REQUESTS VIEW  (reuses the #view-inbox shell)
   ============================================================ */
function navInbox() { if (typeof closeMobileNav === 'function') closeMobileNav(); showView('inbox'); }
function renderInbox() {
  var el = $('inboxBody'); if (!el) return;
  if (!currentUser) {
    el.innerHTML = '<div class="page-head centered"><h1>Partnership Requests</h1><p>Sign in to see your partnership requests.</p></div>' +
      '<div class="soon-card"><div class="soon-ico">🔒</div><h2>Sign in required</h2><div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button></div></div>';
    return;
  }
  el.innerHTML = '<div class="page-head"><h1>Partnership Requests</h1>' +
      '<p>Approve or reject partnership requests and manage your active partnerships here. To contact a club or business, or to send them a request, use the <strong>Reach Out</strong> button on their page.</p></div>' +
    '<div class="inbox-disclaimer"><strong>Important Note:</strong> Student Club Hub only helps you connect. Any partnership, sponsorship, discount, or agreement you arrange is strictly between you and the other party — we are not involved in it and take no responsibility or legal liability for it. Verify who you’re dealing with before committing to anything.</div>' +
    '<div id="partnerReqs" class="partner-reqs"></div>' +
    '<div id="partnerAgrs" class="partner-reqs"></div>' +
    '<div id="partnerEmpty" class="inbox-empty" style="padding:24px" hidden>No partnership requests right now. Open a club or business that’s “Open to partnerships” and tap the puzzle icon to propose one.</div>';
  if (typeof renderPartnerRequests === 'function') renderPartnerRequests();
  renderPendingAgreements();
}
/* Incoming/in-progress agreement forms + my active partnerships (with duration). */
var _agrPendingCount = 0;
function _agrDateRange(a) {
  var s = a.a_start || a.b_start, e = a.a_end || a.b_end;
  if (!s && !e) return '';
  var f = (typeof _fmtAgrDate === 'function') ? _fmtAgrDate : function (x) { return x; };
  return (s ? f(s) : '') + (e ? ' – ' + f(e) : '');
}
function renderPendingAgreements() {
  var el = $('partnerAgrs'); if (!el || !currentUser) return;
  var meL = currentUser.email.toLowerCase(), me = encodeURIComponent(meL);
  // My current entities, so requests route to whoever leads them NOW (not the
  // president who happened to hold the seat when the request was sent).
  var gather = (typeof _gatherMyEntities === 'function') ? _gatherMyEntities() : Promise.resolve([]);
  gather.then(function (mine) {
    mine = mine || [];
    var myIds = mine.map(function (e) { return e.id; });
    // ids are alphanumeric/hyphen (club ids + UUIDs) — safe unencoded; the parens
    // and commas are PostgREST `in` syntax and must NOT be percent-encoded.
    var idList = myIds.length ? '(' + myIds.join(',') + ')' : '';
    var queries = [
      // Incoming requests to entities I currently lead (OR addressed to my email).
      sbRest('partner_agreements?status=eq.pending&or=(b_owner_email.eq.' + me + (idList ? ',b_id.in.' + idList : '') + ')&select=*&order=created_at.desc').catch(function () { return []; }),
      // Requests I sent that are still waiting.
      sbRest('partner_agreements?status=eq.pending&a_owner_email=eq.' + me + '&select=*&order=created_at.desc').catch(function () { return []; }),
      // Active (launched) partnerships involving me or my entities.
      sbRest('partner_agreements?status=eq.launched&or=(a_owner_email.eq.' + me + ',b_owner_email.eq.' + me + (idList ? ',a_id.in.' + idList + ',b_id.in.' + idList : '') + ')&select=*&order=created_at.desc').catch(function () { return []; })
    ];
    Promise.all(queries).then(function (res) {
      var seen = {}, incoming = [], outgoing = [], active = [];
      (res[0] || []).forEach(function (a) { if (!seen[a.id]) { seen[a.id] = 1; incoming.push(a); } });
      (res[1] || []).forEach(function (a) { if (!seen[a.id]) { seen[a.id] = 1; outgoing.push(a); } });
      (res[2] || []).forEach(function (a) { if (!seen[a.id] && !(typeof _agrExpired === 'function' && _agrExpired(a))) { seen[a.id] = 1; active.push(a); } });
      _agrPendingCount = incoming.length;
      var html = '';
      if (incoming.length) html += '<div class="pr-section-h">Requests to approve</div>' + incoming.map(function (a) {
        var dates = _agrDateRange(a);
        return '<div class="pr-card"><div class="pr-body">' + ICON_PARTNER + '<div><strong>' + escHtml(a.a_name) + '</strong> wants to partner with <strong>' + escHtml(a.b_name) + '</strong>' +
          '<div class="form-note">' + escHtml(a.a_deal || 'Partnership') + (dates ? ' · 🗓 ' + escHtml(dates) : '') + '</div></div></div>' +
          '<div class="pr-actions"><button class="btn ghost sm-btn" onclick="rejectPartnerRequest(\'' + a.id + '\')">Reject</button>' +
          '<button class="btn primary sm-btn" onclick="approvePartnerRequest(\'' + a.id + '\')">Approve</button></div></div>';
      }).join('');
      if (outgoing.length) html += '<div class="pr-section-h">Requests you sent</div>' + outgoing.map(function (a) {
        return '<div class="pr-card"><div class="pr-body">' + ICON_PARTNER + '<div><strong>' + escHtml(a.a_name) + '</strong> × <strong>' + escHtml(a.b_name) + '</strong>' +
          '<div class="form-note">Waiting for ' + escHtml(a.b_name) + ' to approve…</div></div></div>' +
          '<div class="pr-actions"><button class="btn ghost sm-btn" onclick="cancelPartnerRequest(\'' + a.id + '\')">Cancel</button></div></div>';
      }).join('');
      if (active.length) html += '<div class="pr-section-h">Active partnerships</div>' + active.map(function (a) {
        var dates = _agrDateRange(a);
        return '<div class="pr-card"><div class="pr-body">' + ICON_PARTNER + '<div><strong>' + escHtml(a.a_name) + '</strong> × <strong>' + escHtml(a.b_name) + '</strong>' +
          (dates ? '<div class="form-note">🗓 ' + escHtml(dates) + ' · the tag auto-removes when the duration ends</div>' : '<div class="form-note">Active partnership</div>') + '</div></div>' +
          '<div class="pr-actions"><button class="btn danger sm-btn" onclick="endPartnership(\'' + a.id + '\')">End</button></div></div>';
      }).join('');
      el.innerHTML = html;
      _refreshPartnerEmpty();
    });
  });
}
/* Show the empty-state only when neither requests nor agreements rendered anything. */
function _refreshPartnerEmpty() {
  var empty = $('partnerEmpty'); if (!empty) return;
  var reqs = $('partnerReqs'), agrs = $('partnerAgrs');
  empty.hidden = !!((reqs && reqs.innerHTML.trim()) || (agrs && agrs.innerHTML.trim()));
}

/* ---------- Floating Partnerships button + pending-count badge ---------- */
var _unreadCount = 0, _unreadTimer = null, _unreadInited = false;
function paintFabBadge() {
  var b = $('inboxFabBadge'); if (!b) return;
  if (currentUser && _unreadCount > 0) { b.textContent = _unreadCount > 99 ? '99+' : _unreadCount; b.hidden = false; }
  else b.hidden = true;
}
/* Badge = pending partnership link-requests to me + agreement forms awaiting action. */
function refreshUnread() {
  if (!currentUser) { _unreadCount = 0; paintFabBadge(); return; }
  var me = encodeURIComponent(currentUser.email.toLowerCase());
  Promise.all([
    sbRest('partner_links?to_owner_email=eq.' + me + '&status=eq.pending&select=id').catch(function () { return []; }),
    // Pending partnership requests awaiting my approval.
    sbRest('partner_agreements?b_owner_email=eq.' + me + '&status=eq.pending&select=id').catch(function () { return []; })
  ]).then(function (res) { _unreadCount = (res[0] || []).length + (res[1] || []).length; paintFabBadge(); });
}
function updateInboxFab(viewName) {
  var fab = $('inboxFab'); if (!fab) return;
  var view = viewName || (typeof currentViewName === 'function' ? currentViewName() : '');
  fab.hidden = !(currentUser && view !== 'inbox');
  paintFabBadge();
  if (currentUser && !_unreadInited) { _unreadInited = true; refreshUnread(); if (_unreadTimer) clearInterval(_unreadTimer); _unreadTimer = setInterval(refreshUnread, 45000); }
  if (!currentUser) { _unreadInited = false; _unreadCount = 0; if (_unreadTimer) { clearInterval(_unreadTimer); _unreadTimer = null; } }
}

