/* ============================================================
   messages.js — "Reach Out" popup, the Partnership Requests view,
   its floating button, and the member directory (profiles).

   There is no in-app messaging: Student Club Hub is an initial
   connector, not a message store. "Reach Out" shows the listing's
   PUBLIC contact email (people talk over email) plus a partnership
   request form. Requests are addressed to the club/business itself
   (see partnerships.js), so whoever leads it NOW handles them.
   Loaded after business.js.
   ============================================================ */

var _reachCtx = null, PARTNER_TYPES = ['Discount for members', 'Sponsorship / funding', 'Event collaboration', 'Other'];
function closeReach() { if (typeof closeOverlay === 'function') closeOverlay('bizOverlay'); }
function _isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || ''); }

/* ---------- Who currently leads a club (by verifiedOwner) ---------- */
function _resolveClubOwner(club) {
  var pid = (club && club.verifiedOwner) || '';
  var pres = (club && club.roster || []).find(function (m) { return pid && m.memberId === pid; });
  var base = { memberId: pid, name: pres ? pres.name : '' };
  if (!pid) return Promise.resolve(base);
  return sbFindProfileById(pid).then(function (p) {
    if (p) base.name = base.name || p.name || '';
    return base;
  });
}

/* ---------- Reach Out: public email + partnership request form ---------- */
function contactByEmail(targetType, id) { return openReachOut(targetType, id); }
function reachOutInbox(targetType, id) { return openReachOut(targetType, id); }   // back-compat
function openReachOut(targetType, id) {
  if (!currentUser) { toast('Please log in first.'); if (typeof openAuth === 'function') openAuth('login'); return; }
  var obj = targetType === 'business'
    ? (typeof _findBizAnywhere === 'function' ? _findBizAnywhere(id) : null)
    : (typeof getClub === 'function' ? getClub(id) : null);
  if (!obj) { toast('Couldn’t find that listing.'); return; }
  // PUBLIC contact address only — never fall back to anyone's private login email.
  var publicEmail = String(targetType === 'business' ? (obj.contact_email || '') : (obj.email || '')).trim();
  var isMine = targetType === 'business' ? (typeof isBizOwner === 'function' && isBizOwner(obj)) : (typeof ownerOf === 'function' && ownerOf(obj));
  var targetOpen = targetType === 'business' ? !!obj.partnership_open : !!obj.partnershipOpen;
  // The recipient's login email is stored on the request for reference only (routing is by club/business).
  var recip = targetType === 'club' ? _resolveClubOwner(obj) : Promise.resolve({});
  recip.then(function (r) {
    _reachCtx = {
      targetType: targetType, id: String(id), name: obj.name, publicEmail: publicEmail, isMine: isMine, targetOpen: targetOpen,
      targetRealId: targetType === 'business' ? (obj.public_id || '') : (obj.clubId || '')
    };
    var gather = isMine ? Promise.resolve([]) : _gatherMyEntities();
    gather.then(function (mine) {
      _reachCtx.mine = (mine || []).filter(function (e) { return !(e.type === targetType && e.id === String(id)); });
      _renderReachOut();
    });
  });
}
function _renderReachOut() {
  var c = _reachCtx; if (!c) return;
  var contactBlock = '<div class="reach-contact"><div class="form-note" style="margin-bottom:6px">Contact ' + escHtml(c.name) + ' directly by email:</div>' +
    (_isEmail(c.publicEmail)
      ? '<a class="btn ghost block" href="mailto:' + escAttr(c.publicEmail) + '?subject=' + encodeURIComponent('Reaching out via Student Club Hub: ' + c.name) + '">' + svgIcon('mail', 16) + ' ' + escHtml(c.publicEmail) + '</a>'
      : '<p class="form-note">No public contact email is listed yet.</p>') + '</div>';
  var head = '<div class="reach-form"><div class="pr-section-h" style="margin-top:14px">Request a partnership</div>';
  var openMine = (c.mine || []).filter(function (e) { return e.open; });
  var form;
  if (c.isMine) {
    form = '<p class="form-note" style="margin-top:14px">This is your own listing. Partnership requests from others appear under your Partnership Requests.</p>';
  } else if (!c.targetOpen) {
    form = head + '<p class="form-note">' + escHtml(c.name) + ' isn’t open to partnerships right now, so it can’t receive requests. You can still email them above.</p></div>';
  } else if (!c.mine || !c.mine.length) {
    form = head + '<p class="form-note">Only a club President or a business owner can send a partnership request. Register a club or business first, then come back.</p></div>';
  } else if (!openMine.length) {
    form = head + '<p class="form-note">Turn on <strong>Open to partnerships</strong> for your club or business first (gear icon on its banner → Page settings).</p></div>';
  } else {
    var picker = openMine.length > 1
      ? '<div class="field"><label>Partner as</label><select id="roFrom" class="select block-select">' + openMine.map(function (e) { return '<option value="' + e.type + ':' + escAttr(e.id) + '">' + escHtml(e.name) + ' (' + e.type + ')</option>'; }).join('') + '</select></div>'
      : '<input type="hidden" id="roFrom" value="' + openMine[0].type + ':' + escAttr(openMine[0].id) + '">';
    var today = _todayStr();
    var typeOpts = PARTNER_TYPES.map(function (t) { return '<option>' + escHtml(t) + '</option>'; }).join('');
    form = head + '<div id="roErr" class="auth-error hidden"></div>' + picker +
      '<div class="field"><label>Partnership type</label><select id="roType" class="select block-select">' + typeOpts + '</select></div>' +
      '<div class="two-col"><div class="field"><label>Starts</label><input id="roStart" type="date" min="' + today + '" value="' + today + '"></div>' +
        '<div class="field"><label>Ends</label><input id="roEnd" type="date" min="' + today + '"></div></div>' +
      '<div class="field"><label>How it works <span class="form-note">(the deal / discount / what each side provides)</span></label>' +
        '<textarea id="roDesc" maxlength="400" placeholder="e.g. 10% off for club members, in exchange for a shout-out at our monthly events."></textarea></div>' +
      '<button id="roSend" class="btn primary block lg" onclick="submitReachOutRequest()">Send Request</button>' +
      '<p class="form-note" style="margin-top:8px">They approve or reject it under their Partnership Requests. Once approved, a “Partnership” tag shows on both pages from the start date until the end date (either side can end it sooner).</p></div>';
  }
  $('bizBody').innerHTML = '<div class="modal-pad"><div class="ro-head"><h3>Reach out to ' + escHtml(c.name) + '</h3>' +
    '<button class="icon-btn" onclick="closeReach()">✕</button></div>' + contactBlock + form + '</div>';
  openOverlay('bizOverlay');
}
function submitReachOutRequest() {
  var c = _reachCtx; if (!c) return;
  var sel = $('roFrom'); if (!sel || !sel.value) return;
  var parts = sel.value.split(':'), fromType = parts[0], fromId = parts.slice(1).join(':');
  var fromEnt = (c.mine || []).find(function (e) { return e.type === fromType && e.id === fromId; });
  var err = function (m) { var e = $('roErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } };
  if (!fromEnt) return err('Pick which club or business you’re partnering as.');
  var ptype = ($('roType') && $('roType').value) || PARTNER_TYPES[0];
  var start = ($('roStart') && $('roStart').value) || '', end = ($('roEnd') && $('roEnd').value) || '';
  var desc = ($('roDesc') && $('roDesc').value || '').trim();
  if (!start || !end) return err('Set a start and end date for the partnership.');
  if (start < _todayStr()) return err('The start date can’t be in the past.');
  if (end < start) return err('The end date must be on or after the start date.');
  if (!desc) return err('Briefly describe how the partnership works.');
  var dealText = ptype + ': ' + desc;
  authBusy2('roSend', true, 'Sending…');
  // a = sender (pre-filled/confirmed), b = recipient. Mirrored so the tag + deal box render on approval.
  var row = {
    a_type: fromType, a_id: fromId, a_name: fromEnt.name,
    a_real_id: fromEnt.publicId || '', a_partner_id: c.targetRealId || '', a_start: start, a_end: end, a_deal: dealText, a_agreed: true, a_confirmed: true,
    b_type: c.targetType, b_id: c.id, b_name: c.name,
    b_real_id: c.targetRealId || '', b_partner_id: fromEnt.publicId || '', b_start: start, b_end: end, b_deal: dealText,
    status: 'pending'
  };
  var eF = encodeURIComponent(fromId), eT = encodeURIComponent(c.id);
  sbRest('partner_agreements?status=in.(pending,launched)&or=(and(a_id.eq.' + eF + ',b_id.eq.' + eT + '),and(a_id.eq.' + eT + ',b_id.eq.' + eF + '))&select=id,status')
    .then(function (dups) {
      if (dups && dups.length) { authBusy2('roSend', false); toast(dups[0].status === 'launched' ? 'You’re already partnered with them.' : 'There’s already a pending request between you two.'); closeReach(); return; }
      return sbRest('partner_agreements', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
        .then(function () { closeReach(); toast('Partnership request sent! They’ll approve or reject it.'); refreshUnread(); });
    }).catch(function (ex) { authBusy2('roSend', false); err((ex && ex.message) || 'Could not send the request.'); });
}

/* ============================================================
   MEMBER DIRECTORY (profiles table): self-register on login;
   resolve by member ID or email. `private` mirrors the account's
   private-profile setting so other browsers can respect it.
   ============================================================ */
/* The public profiles row: name + the ONE profile version they chose to show (blank when private). */
function _publicProfileRow() {
  var pub = (typeof publicProfileOf === 'function') ? publicProfileOf(currentUser) : { type: 'student', headline: '', bio: '', details: {} }, priv = !!currentUser.private;
  return { member_id: currentUser.memberId, user_id: sbSession.user.id, email: currentUser.email.toLowerCase(), name: currentUser.name, private: priv,
    profile_type: pub.type, headline: priv ? null : (pub.headline || null), bio: priv ? null : (pub.bio || null), details: priv ? {} : pub.details,
    updated_at: new Date().toISOString() };
}
function sbUpsertProfile() {
  if (!currentUser || typeof sbRest !== 'function' || !currentUser.memberId) return Promise.resolve();
  if (typeof sbHasSession === 'function' && !sbHasSession(currentUser.email)) return Promise.resolve();
  // user_id ties this member ID to the server account — the database uses it to know who "me" is.
  var r = _publicProfileRow();   // saved by the server, which takes the email from the login itself
  return sbRpc('save_my_profile', { p_member_id: r.member_id, p_name: r.name, p_private: r.private, p_type: r.profile_type,
    p_headline: r.headline, p_bio: r.bio, p_details: r.details }).catch(function () {});
}
function sbFindProfileById(memberId) {
  var id = String(memberId || '').trim(); if (!id || typeof sbRest !== 'function') return Promise.resolve(null);
  if (id[0] !== '#') id = '#' + id;
  return sbRest('profiles?member_id=eq.' + encodeURIComponent(id) + '&select=member_id,name,private')
    .then(function (r) { return (r && r[0]) || null; }).catch(function () { return null; });
}

/* ============================================================
   PARTNERSHIP REQUESTS VIEW  (reuses the #view-inbox shell)
   ============================================================ */
function navInbox() { if (typeof closeMobileNav === 'function') closeMobileNav(); showView('inbox'); }
function renderInbox() {
  var el = $('inboxBody'); if (!el) return;
  if (!currentUser) {
    el.innerHTML = '<div class="page-head centered"><h1>Partnership Requests</h1><p>Sign in to see your partnership requests.</p></div>' +
      '<div class="soon-card"><div class="soon-ico">' + svgIcon('lock', 34) + '</div><h2>Sign in required</h2><div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button></div></div>';
    return;
  }
  el.innerHTML = '<div class="page-head"><h1>Partnership Requests</h1>' +
      '<p>Approve or reject partnership requests and manage your active partnerships. To contact a club or business, or to send them a request, use the <strong>Reach Out</strong> button on their page.</p></div>' +
    '<div class="inbox-disclaimer"><strong>Important Note:</strong> Student Club Hub only helps you connect. Any partnership, sponsorship, discount, or agreement you arrange is strictly between you and the other party. We are not involved in it and take no responsibility or legal liability for it. Verify who you’re dealing with before committing to anything.</div>' +
    '<div id="partnerAgrs" class="partner-reqs"><p class="form-note">Loading…</p></div>' +
    '<div id="partnerEmpty" class="inbox-empty" style="padding:24px" hidden>No partnership requests right now. To start one, open a club or business that’s “Open to partnerships” and tap <strong>Reach Out</strong>.</div>';
  renderPendingAgreements();
}
function _agrDateRange(a) {
  var s = a.a_start || a.b_start, e = a.a_end || a.b_end;
  if (!s && !e) return '';
  return (s ? _fmtAgrDate(s) : '') + (e ? ' – ' + _fmtAgrDate(e) : '');
}
/* Everything is keyed to the clubs/businesses I lead RIGHT NOW: requests to them,
   requests they sent, and their live partnerships. A former president loses access;
   the new one gains it. */
function _myPartnershipRows() {
  return _gatherMyEntities().then(function (mine) {
    var ids = (mine || []).map(function (e) { return e.id; });
    if (!ids.length) return { incoming: [], outgoing: [], active: [], hasEntities: false };
    var L = _idList(ids);
    return Promise.all([
      sbRest('partner_agreements?status=eq.pending&b_id=in.' + L + '&select=*&order=created_at.desc'),
      sbRest('partner_agreements?status=eq.pending&a_id=in.' + L + '&select=*&order=created_at.desc'),
      sbRest('partner_agreements?status=eq.launched&or=(a_id.in.' + L + ',b_id.in.' + L + ')&select=*&order=created_at.desc')
    ]).then(function (res) {
      return { incoming: res[0] || [], outgoing: res[1] || [], active: (res[2] || []).filter(function (a) { return !_agrExpired(a); }), hasEntities: true };
    });
  });
}
function renderPendingAgreements() {
  var el = $('partnerAgrs'); if (!el || !currentUser) return;
  _myPartnershipRows().then(function (r) {
    var html = '';
    if (r.incoming.length) html += '<div class="pr-section-h">Requests to approve</div>' + r.incoming.map(function (a) {
      var dates = _agrDateRange(a);
      return '<div class="pr-card"><div class="pr-body">' + ICON_PARTNER + '<div><strong>' + escHtml(a.a_name) + '</strong> wants to partner with <strong>' + escHtml(a.b_name) + '</strong>' +
        '<div class="form-note">' + escHtml(a.a_deal || 'Partnership') + (dates ? ' · ' + svgIcon('calendar', 13) + ' ' + escHtml(dates) : '') + '</div></div></div>' +
        '<div class="pr-actions"><button class="btn ghost sm-btn" onclick="rejectPartnerRequest(\'' + a.id + '\')">Reject</button>' +
        '<button class="btn primary sm-btn" onclick="approvePartnerRequest(\'' + a.id + '\')">Approve</button></div></div>';
    }).join('');
    if (r.outgoing.length) html += '<div class="pr-section-h">Requests you sent</div>' + r.outgoing.map(function (a) {
      return '<div class="pr-card"><div class="pr-body">' + ICON_PARTNER + '<div><strong>' + escHtml(a.a_name) + '</strong> × <strong>' + escHtml(a.b_name) + '</strong>' +
        '<div class="form-note">Waiting for ' + escHtml(a.b_name) + ' to approve…</div></div></div>' +
        '<div class="pr-actions"><button class="btn ghost sm-btn" onclick="cancelPartnerRequest(\'' + a.id + '\')">Cancel</button></div></div>';
    }).join('');
    if (r.active.length) html += '<div class="pr-section-h">Active partnerships</div>' + r.active.map(function (a) {
      var dates = _agrDateRange(a), upcoming = _agrNotStarted(a);
      return '<div class="pr-card"><div class="pr-body">' + ICON_PARTNER + '<div><strong>' + escHtml(a.a_name) + '</strong> × <strong>' + escHtml(a.b_name) + '</strong>' +
        '<div class="form-note">' + (dates ? svgIcon('calendar', 13) + ' ' + escHtml(dates) + ' · ' : '') +
          (upcoming ? 'approved — the tag appears on the start date' : 'the tag auto-removes when the duration ends') + '</div></div></div>' +
        '<div class="pr-actions"><button class="btn danger sm-btn" onclick="endPartnership(\'' + a.id + '\')">End</button></div></div>';
    }).join('');
    el.innerHTML = html;
    var empty = $('partnerEmpty'); if (empty) empty.hidden = !!html;
    _unreadCount = r.incoming.length; paintFabBadge();
  }).catch(function () { el.innerHTML = '<p class="form-note">Couldn’t load partnership requests. Check your connection and try again.</p>'; });
}

/* ---------- Floating Partnerships button + badge (= requests waiting for MY approval) ---------- */
var _unreadCount = 0, _unreadTimer = null, _unreadInited = false;
function paintFabBadge() {
  var b = $('inboxFabBadge'); if (!b) return;
  if (currentUser && _unreadCount > 0) { b.textContent = _unreadCount > 99 ? '99+' : _unreadCount; b.hidden = false; }
  else b.hidden = true;
}
function refreshUnread() {
  if (!currentUser) { _unreadCount = 0; paintFabBadge(); return; }
  _myPartnershipRows().then(function (r) { _unreadCount = r.incoming.length; paintFabBadge(); }).catch(function () {});
}
function updateInboxFab(viewName) {
  var fab = $('inboxFab'); if (!fab) return;
  var view = viewName || (typeof currentViewName === 'function' ? currentViewName() : '');
  fab.hidden = !(currentUser && view !== 'inbox');
  paintFabBadge();
  if (currentUser && !_unreadInited) { _unreadInited = true; refreshUnread(); if (_unreadTimer) clearInterval(_unreadTimer); _unreadTimer = setInterval(refreshUnread, 45000); }
  if (!currentUser) { _unreadInited = false; _unreadCount = 0; if (_unreadTimer) { clearInterval(_unreadTimer); _unreadTimer = null; } }
}
