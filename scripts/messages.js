/* ============================================================
   messages.js — Inbox + threaded messaging (Phase B).
   Conversations between a reaching-out user and a target
   (business or club). Uses sbRest() from business.js.
   MVP privacy: threads are filtered CLIENT-SIDE by the signed-in
   user's email. Hardening (server-side, via Supabase Auth) is
   noted in the migration. Loaded after business.js.
   ============================================================ */

var _reachTarget = null, _inboxConvs = [], _inboxOpenId = null;

/* Normalize a business row or club object into a messaging target */
function reachTargetOf(targetType, obj) {
  if (targetType === 'business') {
    return { type: 'business', id: String(obj.id), name: obj.name,
      owner_email: (obj.owner_email || obj.contact_email || '').toLowerCase(),
      gate: obj.gate_messages !== false };
  }
  var pres = (obj.leaders || []).find(function (l) { return l.role === 'President'; }) || (obj.leaders || [])[0];
  var ownerEmail = (typeof ownerOf === 'function' && ownerOf(obj) && currentUser) ? currentUser.email : ((pres && pres.email) || obj.email || '');
  return { type: 'club', id: String(obj.id), name: obj.name, owner_email: (ownerEmail || '').toLowerCase(), gate: true };
}
function _roClubOpts() {
  return (typeof CLUBS !== 'undefined' ? CLUBS.slice().sort(function (a, c) { return a.name.localeCompare(c.name); })
    .map(function (c) { return '<option>' + escHtml(c.name) + '</option>'; }).join('') : '');
}

function openReachOut(targetType, id) {
  if (!currentUser) { toast('Please log in to send a message.'); if (typeof openAuth === 'function') openAuth('login'); return; }
  var obj = targetType === 'business'
    ? ((typeof currentBiz !== 'undefined' && currentBiz && currentBiz.id === id) ? currentBiz : (typeof _bizCache !== 'undefined' && _bizCache || []).find(function (x) { return x.id === id; }))
    : (typeof getClub === 'function' ? getClub(id) : null);
  if (!obj) { toast('Couldn’t find that listing.'); return; }
  var tg = reachTargetOf(targetType, obj);
  if (tg.owner_email && currentUser.email && tg.owner_email === currentUser.email.toLowerCase()) {
    toast('That’s your own listing — see your Inbox for messages.'); navInbox(); return;
  }
  _reachTarget = tg;
  var body = '<div class="modal-pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
    '<h3 style="font-size:1.15rem;font-weight:800">Message ' + escHtml(tg.name) + '</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<div id="roErr" class="auth-error hidden"></div>';
  if (tg.gate) {
    body += '<p class="form-note" style="margin-bottom:12px">Introduce yourself about a partnership, discount, or event.</p>' +
      '<div class="field"><label>I’m reaching out as</label><select id="roRole" class="select block-select" onchange="roRoleChange()">' +
        '<option value="student">A student</option><option value="business">A business owner</option><option value="member">A community member</option></select></div>' +
      '<div id="roCond"></div>';
  } else {
    body += '<p class="form-note" style="margin-bottom:12px">Send a direct message — they’ll see it in their Inbox.</p>';
  }
  body += '<div class="field"><label>Message</label><textarea id="roMsg" placeholder="Hi! Our club would love to..."></textarea></div>' +
    '<button id="roSend" class="btn primary block lg" onclick="submitReachOut()">Send message</button></div>';
  $('bizBody').innerHTML = body;
  if (tg.gate) roRoleChange();
  openOverlay('bizOverlay');
}
function roRoleChange() {
  var kind = ($('roRole') && $('roRole').value) || 'student', w = $('roCond'); if (!w) return;
  if (kind === 'student') w.innerHTML = '<div class="field"><label>Club (optional)</label><select id="roExtra" class="select block-select"><option value="">— None —</option>' + _roClubOpts() + '</select></div>';
  else if (kind === 'business') w.innerHTML = '<div class="field"><label>Your business</label><input id="roExtra" type="text" placeholder="Business name"></div>';
  else w.innerHTML = '';
}
function closeReach() { closeOverlay('bizOverlay'); }
function submitReachOut() {
  var tg = _reachTarget; if (!tg) return;
  var msg = ($('roMsg').value || '').trim();
  var e = $('roErr'); var err = function (m) { e.textContent = m; e.classList.remove('hidden'); };
  if (!msg) return err('Write a short message.');
  var role = ($('roRole') && $('roRole').value) || 'student';
  var clubName = ($('roExtra') && $('roExtra').value) || null;
  authBusy2('roSend', true, 'Sending…');
  sbSendConversationMessage(tg, { role: role, club_name: clubName, text: msg })
    .then(function () { closeReach(); toast('Message sent! Continue in your Inbox.'); })
    .catch(function (ex) { authBusy2('roSend', false); err(ex.message); });
}

/* Find-or-create the thread, then append the message */
function sbSendConversationMessage(tg, opts) {
  var meEmail = currentUser.email.toLowerCase();
  var conv = {
    target_type: tg.type, target_id: tg.id, target_name: tg.name, owner_email: tg.owner_email || null,
    user_email: meEmail, user_name: currentUser.name, user_role: opts.role || 'student', club_name: opts.club_name || null,
    last_snippet: opts.text.slice(0, 120), last_message_at: new Date().toISOString()
  };
  return sbRest('conversations?on_conflict=target_type,target_id,user_email', {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(conv)
  }).then(function (rows) {
    var c = rows && rows[0]; if (!c) throw new Error('Could not start the conversation.');
    var side = (conv.owner_email && conv.owner_email === meEmail) ? 'owner' : 'user';
    return sbRest('messages', { method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ conversation_id: c.id, sender_email: meEmail, sender_name: currentUser.name, sender_side: side, text: opts.text }) }).then(function () { return c; });
  });
}

/* ---------- Inbox view ---------- */
function navInbox() { if (typeof closeMobileNav === 'function') closeMobileNav(); showView('inbox'); }
function renderInbox() {
  var el = $('inboxBody'); if (!el) return;
  if (!currentUser) {
    el.innerHTML = '<div class="page-head centered"><h1>Inbox</h1><p>Sign in to see your messages.</p></div>' +
      '<div class="soon-card"><div class="soon-ico">🔒</div><h2>Sign in required</h2><div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button></div></div>';
    return;
  }
  el.innerHTML = '<div class="page-head"><h1>Inbox</h1><p>Your conversations with businesses and clubs.</p></div>' +
    '<div class="inbox-wrap"><div id="inboxList" class="inbox-list"><p class="form-note" style="padding:20px">Loading…</p></div>' +
    '<div id="inboxThread" class="inbox-thread"><div class="inbox-empty">Select a conversation to read and reply.</div></div></div>';
  var me = encodeURIComponent(currentUser.email.toLowerCase());
  sbRest('conversations?or=(user_email.eq.' + me + ',owner_email.eq.' + me + ')&order=last_message_at.desc')
    .then(function (rows) { _inboxConvs = rows || []; paintInboxList(); if (_inboxOpenId && _inboxConvs.some(function (c) { return c.id === _inboxOpenId; })) openThread(_inboxOpenId); })
    .catch(function (e) { var l = $('inboxList'); if (l) l.innerHTML = '<p class="form-note" style="padding:20px">' + escHtml(e.message) + '</p>'; });
}
function paintInboxList() {
  var el = $('inboxList'); if (!el) return;
  if (!_inboxConvs.length) { el.innerHTML = '<div class="inbox-empty" style="padding:24px">No messages yet. Reach out to a business or club to start a conversation.</div>'; return; }
  var meEmail = currentUser.email.toLowerCase();
  el.innerHTML = _inboxConvs.map(function (c) {
    var iAmOwner = (c.owner_email || '').toLowerCase() === meEmail;
    var other = iAmOwner ? (c.user_name + (c.club_name ? ' · ' + c.club_name : '')) : c.target_name;
    var tag = iAmOwner ? ('↳ your ' + c.target_type) : c.target_type;
    return '<button class="inbox-item' + (_inboxOpenId === c.id ? ' active' : '') + '" onclick="openThread(\'' + c.id + '\')">' +
      avatarHTML(other, 'sm') + '<div class="who"><div class="n">' + escHtml(other) + ' <span class="ibx-tag">' + escHtml(tag) + '</span></div>' +
      '<div class="snip">' + escHtml(c.last_snippet || '') + '</div></div></button>';
  }).join('');
}
function openThread(id) {
  _inboxOpenId = id; paintInboxList();
  var el = $('inboxThread'); if (!el) return;
  var c = _inboxConvs.find(function (x) { return x.id === id; }); if (!c) return;
  var meEmail = currentUser.email.toLowerCase(), iAmOwner = (c.owner_email || '').toLowerCase() === meEmail;
  var title = iAmOwner ? (c.user_name + (c.club_name ? ' · ' + c.club_name : '')) : c.target_name;
  el.innerHTML = '<div class="thread-head"><button class="thread-back" onclick="closeThread()">‹</button>' + escHtml(title) +
      '<span class="ibx-tag">' + escHtml(c.target_name) + '</span></div>' +
    '<div id="threadPartner" class="thread-partner"></div>' +
    '<div id="threadMsgs" class="thread-msgs"><p class="form-note" style="padding:14px">Loading…</p></div>' +
    '<div class="thread-compose"><input id="threadInput" type="text" placeholder="Write a reply..." onkeydown="if(event.key===\'Enter\')sendReply(\'' + id + '\')">' +
      '<button class="btn primary" onclick="sendReply(\'' + id + '\')">Send</button></div>';
  el.classList.add('open');
  if (typeof renderThreadPartnership === 'function') renderThreadPartnership(c);
  loadThreadMsgs(id);
}
function closeThread() { _inboxOpenId = null; var el = $('inboxThread'); if (el) { el.classList.remove('open'); el.innerHTML = '<div class="inbox-empty">Select a conversation to read and reply.</div>'; } paintInboxList(); }
function loadThreadMsgs(id) {
  sbRest('messages?conversation_id=eq.' + id + '&order=created_at.asc').then(function (rows) {
    var el = $('threadMsgs'); if (!el) return; var meEmail = currentUser.email.toLowerCase();
    el.innerHTML = (rows && rows.length) ? rows.map(function (m) {
      if (m.sender_side === 'system') return '<div class="tmsg-system">' + escHtml(m.text) + '</div>';
      var mine = (m.sender_email || '').toLowerCase() === meEmail;
      return '<div class="tmsg ' + (mine ? 'mine' : '') + '"><div class="tmsg-b"><div class="tmsg-top">' + escHtml(m.sender_name) + '</div>' +
        '<div class="tmsg-t">' + escHtml(m.text) + '</div></div></div>';
    }).join('') : '<p class="form-note" style="padding:14px">No messages yet.</p>';
    el.scrollTop = el.scrollHeight;
  });
}
function sendReply(id) {
  var input = $('threadInput'); var text = (input && input.value || '').trim(); if (!text) return;
  var c = _inboxConvs.find(function (x) { return x.id === id; }); if (!c) return;
  var meEmail = currentUser.email.toLowerCase();
  var side = (c.owner_email || '').toLowerCase() === meEmail ? 'owner' : 'user';
  input.value = '';
  sbRest('messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ conversation_id: id, sender_email: meEmail, sender_name: currentUser.name, sender_side: side, text: text }) })
    .then(function () {
      c.last_snippet = text.slice(0, 120); c.last_message_at = new Date().toISOString(); paintInboxList();
      sbRest('conversations?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ last_snippet: text.slice(0, 120), last_message_at: new Date().toISOString() }) });
      loadThreadMsgs(id);
    }).catch(function (ex) { toast(ex.message); });
}
