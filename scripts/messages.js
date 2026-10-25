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

var _reachCtx = null;   // PARTNER_TYPES lives in partnerships.js
function closeReach() { if (typeof closeOverlay === 'function') closeOverlay('bizOverlay'); }
function _isEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || ''); }

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
  _reachCtx = {
    targetType: targetType, id: String(id), name: obj.name, publicEmail: publicEmail, isMine: isMine, targetOpen: targetOpen,
    targetRealId: targetType === 'business' ? (obj.public_id || '') : (obj.clubId || '')
  };
  // "Send as": every club I'm President of and every business I own (except the one I'm looking at).
  _gatherMyEntities().then(function (mine) {
    _reachCtx.mine = (mine || []).filter(function (e) { return !(e.type === targetType && e.id === String(id)); });
    _renderReachOut();
  });
}
function _entLabel(e) { return e.name + ' (' + (e.type === 'club' ? 'Club' : 'Business') + ')'; }
function _renderReachOut() {
  var c = _reachCtx; if (!c) return;
  var contactBlock = '<div class="reach-contact"><div class="form-note" style="margin-bottom:6px">Contact ' + escHtml(c.name) + ' directly by email:</div>' +
    (_isEmail(c.publicEmail)
      ? '<a class="btn ghost block" href="mailto:' + escAttr(c.publicEmail) + '?subject=' + encodeURIComponent('Reaching out via Student Club Hub: ' + c.name) + '">' + svgIcon('mail', 16) + ' ' + escHtml(c.publicEmail) + '</a>'
      : '<p class="form-note">No public contact email is listed yet.</p>') + '</div>';
  var head = '<div class="reach-form"><div class="pr-section-h" style="margin-top:14px">Request a partnership</div>';
  var form;
  if (c.isMine && !(c.mine || []).length) {
    form = '<p class="form-note" style="margin-top:14px">This is your own listing. Partnership requests from others appear under your Partnership Requests.</p>';
  } else if (!c.targetOpen) {
    form = head + '<p class="form-note">' + escHtml(c.name) + ' isn’t open to partnerships right now, so it can’t receive requests. You can still email them above.</p></div>';
  } else if (!c.mine || !c.mine.length) {
    form = head + '<p class="form-note">Only a club President or a business owner can send a partnership request. Register a club or business first, then come back.</p></div>';
  } else {
    var today = _todayStr();
    var typeOpts = PARTNER_TYPES.map(function (t) { return '<option>' + escHtml(t) + '</option>'; }).join('');
    var fromOpts = c.mine.map(function (e) { return '<option value="' + e.type + ':' + escAttr(e.id) + '">' + escHtml(_entLabel(e)) + '</option>'; }).join('');
    form = head + '<div id="roErr" class="auth-error hidden"></div>' +
      '<div class="field"><label>Send as</label><select id="roFrom" class="select block-select">' + fromOpts + '</select>' +
        '<div class="form-note" style="margin-top:4px">Which of your clubs or businesses this partnership is for.</div></div>' +
      '<div class="field"><label>Partnership type</label><select id="roType" class="select block-select">' + typeOpts + '</select></div>' +
      '<div class="two-col"><div class="field"><label>Starts</label><input id="roStart" type="date" min="' + today + '" value="' + today + '"></div>' +
        '<div class="field"><label>Ends</label><input id="roEnd" type="date" min="' + today + '"></div></div>' +
      '<div class="field"><label>The deal <span class="form-note">(what each side provides)</span></label>' +
        '<textarea id="roDesc" maxlength="400" placeholder="e.g. 10% off for club members, in exchange for a shout-out at our monthly events."></textarea></div>' +
      '<button id="roSend" class="btn primary block lg" onclick="submitReachOutRequest()">Send Request</button>' +
      '<p class="form-note" style="margin-top:8px">They can approve it, suggest changes, or turn it down under their Partnership Requests. Once approved, it shows on both pages from the start date until the end date (either side can end it sooner).</p></div>';
  }
  $('bizBody').innerHTML = '<div class="modal-pad"><div class="ro-head"><h3>Reach out to ' + escHtml(c.name) + '</h3>' +
    '<button class="icon-btn" onclick="closeReach()">✕</button></div>' + contactBlock + form + '</div>';
  openOverlay('bizOverlay');
}
/* Shared checks for a set of partnership terms (new request or counter-offer). */
function _checkTerms(t, err) {
  if (!t.start || !t.end) return err('Set a start and end date for the partnership.');
  if (t.end < _todayStr()) return err('The end date can’t be in the past.');
  if (t.end < t.start) return err('The end date must be on or after the start date.');
  if (!t.deal) return err('Describe the deal: what each side provides.');
  return true;
}
function submitReachOutRequest() {
  var c = _reachCtx; if (!c) return;
  var sel = $('roFrom'); if (!sel || !sel.value) return;
  var parts = sel.value.split(':'), fromType = parts[0], fromId = parts.slice(1).join(':');
  var fromEnt = (c.mine || []).find(function (e) { return e.type === fromType && e.id === fromId; });
  var err = function (m) { var e = $('roErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } return false; };
  if (!fromEnt) return err('Pick which club or business you’re partnering as.');
  var t = { ptype: ($('roType') && $('roType').value) || PARTNER_TYPES[0], start: ($('roStart') && $('roStart').value) || '',
    end: ($('roEnd') && $('roEnd').value) || '', deal: ($('roDesc') && $('roDesc').value || '').trim() };
  if (_checkTerms(t, err) !== true) return;
  if (t.start < _todayStr()) return err('The start date can’t be in the past.');
  if (activePartnershipCount(fromType, fromId) >= PARTNER_LIMIT) return err(fromEnt.name + ' already has ' + PARTNER_LIMIT + ' active partnerships, the most at once. End one first.');
  if (activePartnershipCount(c.targetType, c.id) >= PARTNER_LIMIT) return err(c.name + ' already has ' + PARTNER_LIMIT + ' active partnerships, the most at once.');
  authBusy2('roSend', true, 'Sending…');
  // a = sender, b = recipient. Both sides share the same terms.
  var row = {
    a_type: fromType, a_id: fromId, a_name: fromEnt.name, a_real_id: fromEnt.publicId || '', a_partner_id: c.targetRealId || '',
    b_type: c.targetType, b_id: c.id, b_name: c.name, b_real_id: c.targetRealId || '', b_partner_id: fromEnt.publicId || '',
    ptype: t.ptype, a_deal: t.deal, b_deal: t.deal, a_start: t.start, b_start: t.start, a_end: t.end, b_end: t.end, status: 'pending'
  };
  var eF = encodeURIComponent(fromId), eT = encodeURIComponent(c.id);
  sbRest('partner_agreements?status=in.(pending,launched)&or=(and(a_id.eq.' + eF + ',b_id.eq.' + eT + '),and(a_id.eq.' + eT + ',b_id.eq.' + eF + '))&select=id,status,a_end,b_end')
    .then(function (dups) {
      dups = (dups || []).filter(function (d) { return d.status === 'pending' || !_agrExpired(d); });
      if (dups.length) { authBusy2('roSend', false); return err(dups[0].status === 'launched' ? 'You’re already partnered with them.' : 'There’s already an open request between you two. Find it in Partnership Requests.'); }
      return sbRest('partner_agreements', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
        .then(function () { closeReach(); toast('Partnership request sent! They can approve it or suggest changes.'); refreshUnread(); });
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
function navInbox() { if (typeof closeMobileNav === 'function') closeMobileNav(); _prTab = 'requests'; showView('inbox'); }
function renderInbox() {
  var el = $('inboxBody'); if (!el) return;
  _prFresh = {};
  if (!currentUser) {
    el.innerHTML = '<div class="page-head centered"><h1>Partnership Requests</h1><p>Sign in to see your partnership requests.</p></div>' +
      '<div class="soon-card"><div class="soon-ico">' + svgIcon('lock', 34) + '</div><h2>Sign in required</h2><div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button></div></div>';
    return;
  }
  el.innerHTML = '<div class="page-head"><h1>Partnership Requests</h1>' +
      '<p>Open a request to approve it, suggest changes, or turn it down. Changes go back and forth until one side’s version is approved. To contact a club or business, or send them a request, use the <strong>Reach Out</strong> button on their page.</p></div>' +
    '<div class="inbox-disclaimer"><strong>Important Note:</strong> Student Club Hub only helps you connect. Any partnership, sponsorship, discount, or agreement you arrange is strictly between you and the other party. We are not involved in it and take no responsibility or legal liability for it. Verify who you’re dealing with before committing to anything.</div>' +
    '<div id="prTabs" class="cat-row pr-tabs"></div>' +
    '<div id="partnerAgrs" class="partner-reqs"><p class="form-note">Loading…</p></div>';
  renderPendingAgreements();
}
function _agrDateRange(a) { var s = _agrStart(a), e = _agrEnd(a); return (s || e) ? (s ? _fmtAgrDate(s) : '') + (e ? ' – ' + _fmtAgrDate(e) : '') : ''; }
function _agrDays(a) { var s = _agrStart(a), e = _agrEnd(a); if (!s || !e) return 0; return Math.round((new Date(e + 'T00:00:00') - new Date(s + 'T00:00:00')) / 86400000) + 1; }
/* Everything is keyed to the clubs/businesses I lead RIGHT NOW. A former President loses
   access; the new one gains it. Each row gets `mySides` (which side(s) I speak for) and `myTurn`. */
var _prRows = {}, _prTab = 'requests', _prData = null;
function _myPartnershipRows() {
  return _gatherMyEntities().then(function (mine) {
    var ids = (mine || []).map(function (e) { return e.id; });
    if (!ids.length) return { requests: [], active: [], past: [], news: [], hasEntities: false, turn: 0 };
    var L = _idList(ids), own = {};
    mine.forEach(function (e) { own[e.type + ':' + e.id] = true; });
    return sbRest('partner_agreements?or=(a_id.in.' + L + ',b_id.in.' + L + ')&status=neq.draft&select=*&order=created_at.desc').then(function (rows) {
      var out = { requests: [], active: [], past: [], hasEntities: true, turn: 0 };
      (rows || []).forEach(function (a) {
        a.mySides = ['a', 'b'].filter(function (s) { return own[a[s + '_type'] + ':' + a[s + '_id']]; });
        if (!a.mySides.length) return;
        a.myTurn = a.status === 'pending' && a.mySides.indexOf(a.awaiting || 'b') > -1;
        a.newsKey = _prNewsKey(a);
        _prRows[a.id] = a;
        if (a.status === 'pending') { out.requests.push(a); if (a.myTurn) out.turn++; }
        else if (a.status === 'launched' && !_agrExpired(a)) out.active.push(a);
        else out.past.push(a);
      });
      out.requests.sort(function (x, y) { return (y.myTurn ? 1 : 0) - (x.myTurn ? 1 : 0); });   // my turn first
      out.news = (rows || []).filter(function (a) { return a.newsKey; });
      out.past.sort(function (x, y) { return String(y.decided_at || y.created_at).localeCompare(String(x.decided_at || x.created_at)); });
      return out;
    });
  });
}
function prTab(k) { _prTab = k; _paintPrList(); }
/* Ran its full term (or was retired by the expiry clean-up after its end date)? */
function _agrCompleted(a) { var end = _agrEnd(a); return a.status === 'launched' || (a.status === 'ended' && !!end && !!a.decided_at && String(a.decided_at).slice(0, 10) > end); }
/* How a past request ended, naming who did it when we know (HTML-escaped). */
function _pastLabel(a) {
  var who = a.decided_by ? escHtml(_prSideName(a, a.decided_by)) : '';
  if (a.status === 'declined') return who ? 'Turned down by ' + who : 'Turned down';
  if (a.status === 'deleted') return who ? 'Withdrawn by ' + who : 'Withdrawn';
  if (_agrCompleted(a)) return 'Completed';
  return who ? 'Ended early by ' + who : 'Ended early';
}
function _prStatusLine(a) {
  if (a.status === 'pending') {
    if (a.myTurn) return '<span class="pr-turn">Your turn: approve, suggest changes, or turn down</span>';
    var other = a.awaiting === 'a' ? a.a_name : a.b_name;
    return '<span>Waiting for ' + escHtml(other) + ' to respond</span>';
  }
  if (a.status === 'launched' && !_agrExpired(a)) return '<span>' + (_agrNotStarted(a) ? 'Approved. It goes live on the start date.' : 'Live now') + '</span>';
  return '<span>' + _pastLabel(a) + '</span>' + (a.decided_at ? ' · <span>' + escHtml(_fmtAgrDate(String(a.decided_at).slice(0, 10))) + '</span>' : '');
}
function _prCard(a) {
  var dates = _agrDateRange(a);
  return '<div class="pr-card is-click' + (a.myTurn ? ' my-turn' : '') + '" role="button" tabindex="0" onclick="openPartnerRequest(\'' + a.id + '\')" onkeydown="if(event.key===\'Enter\')openPartnerRequest(\'' + a.id + '\')">' +
    '<div class="pr-body">' + ICON_PARTNER + '<div class="pr-main"><div class="pr-names"><strong class="pr-name">' + escHtml(a.a_name) + '</strong> <span class="pr-arrow">→</span> <strong class="pr-name">' + escHtml(a.b_name) + '</strong></div>' +
      '<div class="pr-line"><span class="pd-type">' + escHtml(a.ptype || 'Partnership') + '</span><span class="pr-deal">' + escHtml(a.a_deal || '') + '</span></div>' +
      '<div class="form-note">' + (dates ? svgIcon('calendar', 13) + ' ' + escHtml(dates) + ' · ' : '') + _prStatusLine(a) + '</div></div></div>' +
    (_prFresh[a.id] ? '<span class="pr-new">New</span>' : '') + '<span class="pr-open">Open ›</span></div>';
}
function _paintPrList() {
  var el = $('partnerAgrs'), tabs = $('prTabs'), r = _prData; if (!el || !r) return;
  var T = [['requests', 'Requests', r.requests.length], ['active', 'Active', r.active.length], ['past', 'Past', r.past.length]];
  if (tabs) tabs.innerHTML = T.map(function (t) {
    return '<button class="cat-pill' + (_prTab === t[0] ? ' active' : '') + '" onclick="prTab(\'' + t[0] + '\')"><span>' + t[1] + '</span> <span class="pr-count">' + t[2] + '</span>' +
      (r[t[0]].some(function (a) { return _prFresh[a.id]; }) ? '<span class="pr-dot" title="New"></span>' : '') + '</button>';
  }).join('');
  var list = r[_prTab] || [];
  if (!r.hasEntities) { el.innerHTML = '<div class="inbox-empty">Partnerships are made between clubs and businesses. Once you’re a club President or own a business, its requests show up here.</div>'; return; }
  var empty = { requests: 'No open requests. To start one, open a club or business that’s “Open to partnerships” and tap <strong>Reach Out</strong>.',
    active: 'No active partnerships right now.', past: 'Partnerships that ended, were turned down or withdrawn show up here.' }[_prTab];
  el.innerHTML = list.length ? list.map(_prCard).join('') : '<div class="inbox-empty">' + empty + '</div>';
}
/* A short notice for each thing the other side does while you're on the site. The first load
   after signing in only sets the baseline (the badge covers what happened while you were away). */
var _prKnown = {}, _prKnownFor = null;
function _prNewsText(a) {
  var other = _prSideName(a, (a.mySides || []).indexOf('a') > -1 ? 'b' : 'a');   // plain text: toast() sets textContent
  if (a.status === 'pending') return (a.history || []).length > 1 ? other + ' suggested changes to your partnership request.' : 'New partnership request from ' + other + '.';
  if (a.status === 'launched') return other + ' approved the partnership!';
  if (a.status === 'declined') return other + ' turned down the partnership request.';
  if (a.status === 'deleted') return other + ' withdrew their partnership request.';
  if (a.status === 'ended') return other + ' ended the partnership.';
  return '';
}
function _prAnnounce(news) {
  var me = currentUser && currentUser.email; if (!me) return;
  var first = _prKnownFor !== me, fresh = [];
  if (first) { _prKnown = {}; _prKnownFor = me; }
  news.forEach(function (a) { if (!_prKnown[a.newsKey]) { _prKnown[a.newsKey] = true; if (!first) fresh.push(a); } });
  if (fresh.length === 1) toast(_prNewsText(fresh[0]), 6000);
  else if (fresh.length > 1) toast('You have ' + fresh.length + ' new partnership updates.', 6000);
}
/* The request popup that's open is out of date: redraw it so nobody acts on an old version. */
function _prRefreshOpen() {
  var ov = $('bizOverlay'), box = document.querySelector('#bizBody [data-pr-id]');
  if (!box || !ov || ov.classList.contains('hidden')) return;
  var a = _prRows[box.getAttribute('data-pr-id')]; if (!a) return;
  if (box.getAttribute('data-pr-v') !== _prVersion(a)) openPartnerRequest(a.id);
}
function _prVersion(a) { return a.status + ':' + (a.history || []).length + ':' + (a.awaiting || ''); }
function renderPendingAgreements() {
  var el = $('partnerAgrs'); if (!el || !currentUser) return;
  _myPartnershipRows().then(function (r) {
    _prAnnounce(r.news); _prRefreshOpen();
    var seen = _prSeen();
    r.news.forEach(function (a) { if (!seen[a.newsKey]) _prFresh[a.id] = true; });   // labelled "New" for the rest of this visit
    _prMarkSeen(r.news);
    _prData = r; _paintPrList();
    _unreadCount = 0; paintFabBadge();
  }).catch(function () { el.innerHTML = '<p class="form-note">Couldn’t load partnership requests. Check your connection and try again.</p>'; });
}

/* ---------- One request, opened: big text, history, and the actions for whoever's turn it is ---------- */
function _prSideName(a, s) { return s === 'a' ? a.a_name : a.b_name; }
function _prTerms(t) {
  return '<div class="prd-terms"><span class="pd-type">' + escHtml(t.ptype || 'Partnership') + '</span>' +
    '<p class="prd-deal">' + escHtml(t.deal || '') + '</p>' +
    ((t.start || t.end) ? '<div class="form-note">' + svgIcon('calendar', 13) + ' ' + escHtml((t.start ? _fmtAgrDate(t.start) : '') + (t.end ? ' – ' + _fmtAgrDate(t.end) : '')) + '</div>' : '') + '</div>';
}
function openPartnerRequest(id) {
  var a = _prRows[id]; if (!a) return;
  var cur = { ptype: a.ptype, deal: a.a_deal, start: _agrStart(a), end: _agrEnd(a) };
  var mySide = a.myTurn ? a.awaiting : a.mySides[0];
  var title = a.status === 'pending' ? 'Partnership request' : (a.status === 'launched' && !_agrExpired(a)) ? 'Active partnership' : 'Past partnership';
  var hist = (a.history || []).map(function (h, i) {
    var when = h.at ? new Date(h.at).toLocaleDateString(siteLocale(), { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    var last = i === (a.history.length - 1);
    return '<li class="prh-item' + (last ? ' is-current' : '') + '"><div class="prh-head"><strong class="pr-name">' + escHtml(_prSideName(a, h.by)) + '</strong> ' +
      '<span>' + (i === 0 ? 'sent the request' : 'suggested changes') + '</span>' + (when ? ' <span class="form-note">· ' + escHtml(when) + '</span>' : '') +
      (last && a.status === 'pending' ? ' <span class="prh-now">Current version</span>' : '') + '</div>' +
      (last ? '' : _prTerms({ ptype: h.ptype, deal: h.deal, start: h.start, end: h.end })) + '</li>';
  }).join('');
  var days = _agrDays(a);
  var actions = '';
  if (a.status === 'pending' && a.myTurn) {
    actions = '<div class="prd-actions"><button class="btn primary" onclick="approvePartnerRequest(\'' + a.id + '\',\'' + mySide + '\')">' + svgIcon('check', 16) + ' Approve</button>' +
      '<button class="btn blue" onclick="openCounterForm(\'' + a.id + '\')">' + ICON_PEN + ' Suggest changes</button>' +
      (mySide === 'a' ? '<button class="btn ghost" onclick="cancelPartnerRequest(\'' + a.id + '\')">Withdraw</button>'
                      : '<button class="btn ghost" onclick="rejectPartnerRequest(\'' + a.id + '\')">Turn down</button>') + '</div>';
  } else if (a.status === 'pending') {
    actions = '<p class="form-note">Waiting for ' + escHtml(_prSideName(a, a.awaiting)) + ' to respond.</p><div class="prd-actions">' +
      (a.mySides.indexOf('a') > -1 ? '<button class="btn ghost" onclick="cancelPartnerRequest(\'' + a.id + '\')">Withdraw request</button>'
                                    : '<button class="btn ghost" onclick="rejectPartnerRequest(\'' + a.id + '\')">Turn down</button>') + '</div>';
  } else if (a.status === 'launched' && !_agrExpired(a)) {
    actions = '<p class="form-note">You can hide it or show a countdown timer from your club or business page.</p><div class="prd-actions"><button class="btn danger" onclick="endPartnership(\'' + a.id + '\')">End partnership</button></div>';
  } else {
    actions = '<p class="prd-past">' + _pastLabel(a) + (a.decided_at ? ' · ' + escHtml(_fmtAgrDate(String(a.decided_at).slice(0, 10))) : '') + '</p>';
  }
  $('bizBody').innerHTML = '<div class="modal-pad prd" data-pr-id="' + a.id + '" data-pr-v="' + _prVersion(a) + '"><div class="ro-head"><h3>' + title + '</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<div class="prd-parties"><div><span class="form-note">From</span><strong class="pr-name">' + escHtml(a.a_name) + '</strong><span class="form-note">' + (a.a_type === 'club' ? 'Club' : 'Business') + '</span></div>' +
      '<span class="prd-puzzle">' + ICON_PARTNER + '</span>' +
      '<div><span class="form-note">To</span><strong class="pr-name">' + escHtml(a.b_name) + '</strong><span class="form-note">' + (a.b_type === 'club' ? 'Club' : 'Business') + '</span></div></div>' +
    '<div class="prd-current">' + _prTerms(cur) + (days ? '<div class="form-note">' + (days === 1 ? '1 day' : days + ' days') + '</div>' : '') + '</div>' +
    actions +
    (hist ? '<div class="pr-section-h" style="margin-top:16px">History</div><ol class="prh">' + hist + '</ol>' : '') + '</div>';
  openOverlay('bizOverlay');
}
function openCounterForm(id) {
  var a = _prRows[id]; if (!a || !a.myTurn) return;
  var today = _todayStr(), cur = a.ptype || PARTNER_TYPES[0];
  var types = PARTNER_TYPES.slice(); if (types.indexOf(cur) === -1) types.unshift(cur);
  $('bizBody').innerHTML = '<div class="modal-pad" data-pr-id="' + a.id + '" data-pr-v="' + _prVersion(a) + '"><div class="ro-head"><h3>Suggest changes</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:10px">Change anything below. ' + escHtml(_prSideName(a, a.awaiting === 'a' ? 'b' : 'a')) + ' then approves your version or suggests their own.</p>' +
    '<div id="roErr" class="auth-error hidden"></div>' +
    '<div class="field"><label>Partnership type</label><select id="coType" class="select block-select">' + types.map(function (t) { return '<option' + (t === cur ? ' selected' : '') + '>' + escHtml(t) + '</option>'; }).join('') + '</select></div>' +
    '<div class="two-col"><div class="field"><label>Starts</label><input id="coStart" type="date" value="' + escAttr(_agrStart(a) || today) + '"></div>' +
      '<div class="field"><label>Ends</label><input id="coEnd" type="date" min="' + today + '" value="' + escAttr(_agrEnd(a) || '') + '"></div></div>' +
    '<div class="field"><label>The deal <span class="form-note">(what each side provides)</span></label><textarea id="coDeal" maxlength="400">' + escHtml(a.a_deal || '') + '</textarea></div>' +
    '<button id="coSend" class="btn primary block lg" onclick="submitCounter(\'' + a.id + '\')">Send changes</button>' +
    '<button class="btn ghost block" style="margin-top:8px" onclick="openPartnerRequest(\'' + a.id + '\')">Back</button></div>';
  openOverlay('bizOverlay');
}
function submitCounter(id) {
  var a = _prRows[id]; if (!a || !a.myTurn) return;
  var err = function (m) { var e = $('roErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } return false; };
  var t = { ptype: $('coType').value, start: $('coStart').value, end: $('coEnd').value, deal: ($('coDeal').value || '').trim() };
  if (_checkTerms(t, err) !== true) return;
  if (t.ptype === a.ptype && t.deal === a.a_deal && t.start === _agrStart(a) && t.end === _agrEnd(a)) return err('Nothing changed yet. Edit the terms, or go back and approve them as they are.');
  authBusy2('coSend', true, 'Sending…');
  counterPartnerRequest(id, a.awaiting, t).catch(function (ex) { authBusy2('coSend', false); err(ex.message); });
}

/* ---------- Floating Partnerships button + badge ----------
   The badge counts things the OTHER side did that you haven't looked at yet, like unread
   messages: a new request or counter-offer waiting for you, your request approved or turned
   down, or a request to you withdrawn. Opening Partnership Requests clears it. Seen items are
   remembered per account in localStorage (sch_pr_seen:<email>), keyed by request + version,
   so a new counter-offer on the same request shows up again. */
var _unreadCount = 0, _unreadTimer = null, _unreadInited = false, _prFresh = {};
var PR_POLL_MS = 20000;
/* A key for the latest thing the other side did on this row, or '' if the last move was mine. */
function _prNewsKey(a) {
  var mine = a.mySides || [], v = a.id + ':' + a.status + ':' + (a.history || []).length;
  var recent = !a.decided_at || (Date.now() - new Date(a.decided_at).getTime()) < 30 * 86400000;
  if (a.status === 'pending') return a.myTurn ? v : '';
  if (!recent) return '';
  var by = a.decided_by || ({ launched: a.awaiting || 'b', declined: 'b', deleted: 'a' })[a.status];   // older rows: infer who acted
  if (!by || mine.indexOf(by) > -1) return '';                                                    // I did it myself
  if (a.status === 'launched' || a.status === 'declined' || a.status === 'deleted') return v;     // they approved / turned down / withdrew
  if (a.status === 'ended' && a.decided_by && !_agrCompleted(a)) return v;                        // they ended it early
  return '';
}
function _prSeenKey() { return 'sch_pr_seen:' + ((currentUser && currentUser.email) || '').toLowerCase(); }
function _prSeen() { try { return JSON.parse(localStorage.getItem(_prSeenKey())) || null; } catch (e) { return null; } }
function _prMarkSeen(news) {
  var map = {}; (news || []).forEach(function (a) { map[a.newsKey] = 1; });   // keep only what still exists
  try { localStorage.setItem(_prSeenKey(), JSON.stringify(map)); } catch (e) {}
}
function _prUnseenCount(news) {
  var seen = _prSeen();
  if (!seen) {   // first time on this browser: don't flood with old decisions, only what's waiting for you
    seen = {}; news.forEach(function (a) { if (a.status !== 'pending') seen[a.newsKey] = 1; });
    try { localStorage.setItem(_prSeenKey(), JSON.stringify(seen)); } catch (e) {}
  }
  return news.filter(function (a) { return !seen[a.newsKey]; }).length;
}
function paintFabBadge() {
  var b = $('inboxFabBadge'); if (!b) return;
  if (currentUser && _unreadCount > 0) { b.textContent = _unreadCount > 99 ? '99+' : _unreadCount; b.hidden = false; }
  else b.hidden = true;
}
function _inboxOpen() { return !!($('view-inbox') && !$('view-inbox').classList.contains('hidden')); }
function refreshUnread() {
  if (!currentUser) { _unreadCount = 0; paintFabBadge(); return; }
  if (_inboxOpen()) { renderPendingAgreements(); return; }   // looking at the list: update it in place (and keep the badge clear)
  _myPartnershipRows().then(function (r) { _prAnnounce(r.news); _unreadCount = _prUnseenCount(r.news); paintFabBadge(); }).catch(function () {});
}
function updateInboxFab(viewName) {
  var fab = $('inboxFab'); if (!fab) return;
  var view = viewName || (typeof currentViewName === 'function' ? currentViewName() : '');
  fab.hidden = !(currentUser && view !== 'inbox');
  paintFabBadge();
  if (currentUser && !_unreadInited) { _unreadInited = true; refreshUnread(); if (_unreadTimer) clearInterval(_unreadTimer); _unreadTimer = setInterval(function () { if (!document.hidden) refreshUnread(); }, PR_POLL_MS); }
  if (!currentUser) { _unreadInited = false; _unreadCount = 0; if (_unreadTimer) { clearInterval(_unreadTimer); _unreadTimer = null; } }
}
/* Coming back to the tab: check right away instead of waiting for the next poll. */
document.addEventListener('visibilitychange', function () { if (!document.hidden && currentUser) refreshUnread(); });
