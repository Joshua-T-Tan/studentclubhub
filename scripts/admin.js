/* ============================================================
   admin.js — the Admin page (only for emails in the server's
   `admins` table; the database enforces it, this file just shows
   the controls). Four tabs:
     Reports       — flags on clubs, businesses and profiles
     Messages      — the Contact Us message box (not the email)
     Verification  — approve/reject Verified-seal requests, remove seals
     Invite codes  — the private club-leader codes
   A summary row on top shows what needs attention; the header's
   Admin button carries the same count. Loaded last.
   ============================================================ */
var isAdminUser = false, adminTodo = 0;
var _admTab = 'reports', _admShowAll = { reports: false, messages: false };

/* Ask the server whether the signed-in account is an admin (RLS only returns your own row). */
function refreshAdminFlag() {
  isAdminUser = false; adminTodo = 0;
  if (!currentUser || typeof sbHasSession !== 'function' || !sbHasSession(currentUser.email)) { renderAuthArea(); return; }
  sbRest('admins?select=email').then(function (rows) {
    isAdminUser = !!(rows && rows.length); renderAuthArea();
    if (isAdminUser) _admCounts().then(function (c) { adminTodo = c.reports + c.messages + c.verification; renderAuthArea(); });
  }).catch(function () {});
}
function openAdmin() { if (isAdminUser) showView('admin'); }

/* How many things are waiting (exact counts from the server, no rows downloaded). */
function _admCount(path) {
  return sbAccessToken().then(function (tok) {
    return fetch(SUPABASE_URL + '/rest/v1/' + path, { method: 'HEAD', cache: 'no-store',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + (tok || SUPABASE_KEY), Prefer: 'count=exact' } });
  }).then(function (res) { var r = res.headers.get('content-range') || ''; return parseInt(r.split('/')[1], 10) || 0; }).catch(function () { return 0; });
}
function _admCounts() {
  return Promise.all([
    _admCount('reports?status=eq.open&select=id'),
    _admCount('contact_messages?handled=is.false&select=id'),
    _admCount('verification_requests?status=eq.pending&select=id'),
    _admCount('invite_codes?active=is.true&select=code')
  ]).then(function (n) { return { reports: n[0], messages: n[1], verification: n[2], codes: n[3] }; });
}

/* ---------- page shell ---------- */
var ADMIN_TABS = [
  { k: 'reports', label: 'Reports', ico: 'flag', note: 'open' },
  { k: 'messages', label: 'Messages', ico: 'mail', note: 'unread' },
  { k: 'verification', label: 'Verification', ico: 'check', note: 'pending' },
  { k: 'codes', label: 'Invite codes', ico: 'lock', note: 'active' }
];
function renderAdmin() {
  var el = $('adminBody'); if (!el) return;
  if (!isAdminUser) { el.innerHTML = '<div class="page-head centered"><h1>Admin</h1><p>This page is for Student Club Hub admins.</p></div>'; return; }
  el.innerHTML = '<div class="page-head centered"><h1>Admin</h1><p>Reports, messages, verification and invite codes, all in one place.</p></div>' +
    '<div class="adm-tiles" id="admTiles">' + ADMIN_TABS.map(function (t) {
      return '<button class="adm-tile' + (t.k === _admTab ? ' active' : '') + '" onclick="adminTab(\'' + t.k + '\')">' +
        '<span class="adm-tile-ico">' + svgIcon(t.ico, 18) + '</span><span class="adm-tile-n" id="admN_' + t.k + '">–</span>' +
        '<span class="adm-tile-l">' + t.label + '<small>' + t.note + '</small></span></button>';
    }).join('') + '</div>' +
    '<div class="adm-toolbar"><h2 id="admTitle"></h2><span id="admFilter"></span>' +
      '<button class="btn ghost sm-btn" onclick="adminRefresh()">' + svgIcon('refresh', 14) + ' Refresh</button></div>' +
    '<div id="admList" class="adm-list"><p class="form-note">Loading…</p></div>';
  adminRefresh();
}
function adminTab(k) { _admTab = k; renderAdmin(); }
function adminRefresh() {
  _admCounts().then(function (c) {
    ADMIN_TABS.forEach(function (t) { var n = $('admN_' + t.k); if (n) n.textContent = c[t.k]; });
    adminTodo = c.reports + c.messages + c.verification; renderAuthArea();
  });
  var title = $('admTitle'); if (title) title.textContent = (ADMIN_TABS.find(function (t) { return t.k === _admTab; }) || {}).label || '';
  var f = $('admFilter');
  if (f) f.innerHTML = (_admTab === 'reports' || _admTab === 'messages')
    ? '<label class="adm-filter"><input type="checkbox"' + (_admShowAll[_admTab] ? ' checked' : '') + ' onchange="_admShowAll[\'' + _admTab + '\']=this.checked;adminRefresh()"> Show ' + (_admTab === 'reports' ? 'resolved too' : 'handled too') + '</label>' : '';
  ({ reports: _admPaintReports, messages: _admPaintMessages, verification: _admPaintVerification, codes: _admPaintCodes })[_admTab]();
}
function _admList(html) { var h = $('admList'); if (h) h.innerHTML = html; }
function _admEmpty(text) { return '<div class="adm-empty">' + svgIcon('check', 26) + '<p>' + text + '</p></div>'; }
function _admFail(ex) { _admList('<p class="form-note">' + escHtml(ex.message) + '</p>'); }
function _admWhen(s) {
  if (!s) return '';
  var d = new Date(s); return escHtml(d.toLocaleDateString(siteLocale(), { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString(siteLocale(), { hour: 'numeric', minute: '2-digit' }));
}
function _admDate(s) { return s ? escHtml(_fmtAgrDate(String(s).slice(0, 10))) : ''; }
/* A link to the club / business / profile something is about (or a note if it no longer exists). */
function _admTargetLink(kind, id, name) {
  if (kind === 'club') return getClub(id) ? '<a href="#" class="link" onclick="openClub(\'' + jsArg(id) + '\');return false;">' + escHtml(name || 'club') + '</a>' : escHtml(name || 'club') + ' <span class="form-note">(deleted)</span>';
  if (kind === 'business') return '<a href="#" class="link" onclick="openBusiness(\'' + jsArg(id) + '\');return false;">' + escHtml(name || 'business') + '</a>';
  return '<a href="#" class="link" onclick="openProfile(\'' + jsArg(name || id) + '\');return false;">' + escHtml(name || id) + '</a>';
}
function _admPerson(name, email, memberId) {
  return escHtml(name || 'Unknown') + (memberId ? ' <span class="form-note">' + escHtml(memberId) + '</span>' : '') +
    (email ? ' · <a class="link" href="mailto:' + escAttr(email) + '">' + escHtml(email) + '</a>' : '');
}
function _admSet(table, id, patch, msg) {
  return sbRest(table + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t update it. Are you still signed in as an admin?'); toast(msg); adminRefresh(); })
    .catch(function (ex) { toast(ex.message); });
}
function _admDelete(table, id, what) {
  openConfirm('Delete this ' + what + '?', 'It will be removed permanently.', svgIcon('trash', 26), function () {
    sbRest(table + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=representation' } })
      .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t delete it.'); toast('Deleted.'); adminRefresh(); })
      .catch(function (ex) { toast(ex.message); });
  }, 'Delete');
}

/* ---------- Reports ---------- */
var REPORT_STATUS = { open: 'Open', resolved: 'Resolved', dismissed: 'Dismissed' };
function _admPaintReports() {
  sbRest('reports?select=*&order=created_at.desc' + (_admShowAll.reports ? '' : '&status=eq.open')).then(function (rows) {
    if (_admTab !== 'reports') return;
    if (!rows || !rows.length) return _admList(_admEmpty(_admShowAll.reports ? 'No reports yet.' : 'No open reports. Nice.'));
    _admList(rows.map(function (r) {
      var st = r.status || 'open', id = jsArg(r.id);
      return '<article class="adm-card' + (st === 'open' ? ' is-open' : '') + '">' +
        '<div class="adm-card-top"><span class="badge">' + escHtml(r.target_type || '') + '</span> <strong>' + _admTargetLink(r.target_type, r.target_id, r.target_name) + '</strong>' +
          '<span class="adm-pill st-' + escAttr(st) + '">' + escHtml(REPORT_STATUS[st] || st) + '</span></div>' +
        '<div class="adm-reason">' + svgIcon('flag', 14) + ' ' + escHtml(r.reason || 'No reason given') + '</div>' +
        (r.details ? '<p class="adm-text">' + escHtml(r.details) + '</p>' : '') +
        '<div class="adm-meta">Reported by ' + _admPerson(r.reporter_name, r.reporter_email, r.reporter_id) + ' · ' + _admWhen(r.created_at) + '</div>' +
        '<div class="adm-actions">' + (st === 'open'
          ? '<button class="btn primary sm-btn" onclick="_admSet(\'reports\',\'' + id + '\',{status:\'resolved\'},\'Marked resolved.\')">Mark resolved</button>' +
            '<button class="btn ghost sm-btn" onclick="_admSet(\'reports\',\'' + id + '\',{status:\'dismissed\'},\'Dismissed.\')">Dismiss</button>'
          : '<button class="btn ghost sm-btn" onclick="_admSet(\'reports\',\'' + id + '\',{status:\'open\'},\'Reopened.\')">Reopen</button>') +
          '<button class="btn ghost sm-btn adm-del" onclick="_admDelete(\'reports\',\'' + id + '\',\'report\')">' + svgIcon('trash', 14) + '</button></div>' +
      '</article>';
    }).join(''));
  }).catch(_admFail);
}

/* ---------- Messages (Contact Us box) ---------- */
var MESSAGE_SOURCE = { contact_us: 'Contact Us popup', about_us: 'Contact page' };
function _admPaintMessages() {
  sbRest('contact_messages?select=*&order=created_at.desc' + (_admShowAll.messages ? '' : '&handled=is.false')).then(function (rows) {
    if (_admTab !== 'messages') return;
    if (!rows || !rows.length) return _admList(_admEmpty(_admShowAll.messages ? 'No messages yet.' : 'No unread messages.'));
    _admList(rows.map(function (m) {
      var id = jsArg(m.id), subj = encodeURIComponent('Re: your message to Student Club Hub');
      return '<article class="adm-card' + (m.handled ? '' : ' is-open') + '">' +
        '<div class="adm-card-top"><strong>' + _admPerson(m.sender_name, null, m.member_id) + '</strong>' +
          '<span class="adm-pill ' + (m.handled ? 'st-resolved">Handled' : 'st-open">New') + '</span></div>' +
        '<p class="adm-text">' + escHtml(m.message || '') + '</p>' +
        '<div class="adm-meta">' + escHtml(MESSAGE_SOURCE[m.source] || m.source || '') + ' · ' + _admWhen(m.created_at) + '</div>' +
        '<div class="adm-actions">' +
          (m.sender_email ? '<a class="btn ghost sm-btn" href="mailto:' + escAttr(m.sender_email) + '?subject=' + subj + '">' + svgIcon('mail', 14) + ' Reply to ' + escHtml(m.sender_email) + '</a>' : '') +
          '<button class="btn ' + (m.handled ? 'ghost' : 'primary') + ' sm-btn" onclick="_admSet(\'contact_messages\',\'' + id + '\',{handled:' + (!m.handled) + '},\'' + (m.handled ? 'Marked as new.' : 'Marked handled.') + '\')">' + (m.handled ? 'Mark as new' : 'Mark handled') + '</button>' +
          '<button class="btn ghost sm-btn adm-del" onclick="_admDelete(\'contact_messages\',\'' + id + '\',\'message\')">' + svgIcon('trash', 14) + '</button></div>' +
      '</article>';
    }).join(''));
  }).catch(_admFail);
}

/* ---------- Verification ---------- */
function _admPaintVerification() {
  var clubs = CLUBS.filter(function (c) { return c.verified; }).map(function (c) { return { kind: 'club', id: c.id, name: c.name }; });
  Promise.all([
    sbRest('verification_requests?status=eq.pending&select=*&order=created_at.asc'),
    sbRest('businesses?verified=is.true&select=id,name').catch(function () { return []; })
  ]).then(function (res) {
    if (_admTab !== 'verification') return;
    var reqs = res[0] || [], seals = clubs.concat((res[1] || []).map(function (b) { return { kind: 'business', id: b.id, name: b.name }; }));
    var pending = reqs.length ? reqs.map(function (r) {
      return '<article class="adm-card is-open"><div class="adm-card-top"><span class="badge">' + escHtml(r.kind) + '</span> <strong>' + _admTargetLink(r.kind, r.entity_id, r.entity_name) + '</strong>' +
          '<span class="adm-pill st-open">Pending</span></div>' +
        '<p class="adm-text">' + escHtml(r.note || '') + '</p>' +
        '<div class="adm-meta">Requested by ' + _admPerson('', r.requester_email, r.requester_id) + ' · ' + _admWhen(r.created_at) + '</div>' +
        '<div class="adm-actions"><button class="btn primary sm-btn" onclick="adminDecide(\'' + r.id + '\',true)">Approve</button>' +
          '<button class="btn ghost sm-btn" onclick="adminDecide(\'' + r.id + '\',false)">Reject</button></div></article>';
    }).join('') : _admEmpty('No pending verification requests.');
    var list = seals.length ? seals.map(function (x) {
      return '<div class="adm-row"><span class="badge">' + x.kind + '</span> ' + _admTargetLink(x.kind, x.id, x.name) +
        '<button class="btn ghost sm-btn" onclick="adminRemoveSeal(\'' + x.kind + '\',\'' + jsArg(x.id) + '\')">Remove seal</button></div>';
    }).join('') : '<p class="form-note">Nothing is verified yet.</p>';
    _admList(pending + '<h3 class="adm-sub">Currently verified</h3><div class="adm-rows">' + list + '</div>');
  }).catch(_admFail);
}
function adminDecide(reqId, approve) {
  sbRpc('admin_decide_verification', { p_req: reqId, p_approve: approve }).then(function () {
    toast(approve ? 'Approved. The gold seal is on.' : 'Request rejected.');
    _bizCache = null;
    if (typeof loadClubs === 'function') loadClubs(adminRefresh); else adminRefresh();
  }).catch(function (ex) { toast(ex.message); });
}
function adminRemoveSeal(kind, id) {
  openConfirm('Remove the Verified seal?', 'The gold seal disappears from this page and its card. The owner can request it again.', svgIcon('warning', 26), function () {
    sbRpc('admin_set_verified', { p_kind: kind, p_id: id, p_on: false }).then(function () {
      toast('Seal removed.'); _bizCache = null;
      if (typeof loadClubs === 'function') loadClubs(adminRefresh); else adminRefresh();
    }).catch(function (ex) { toast(ex.message); });
  }, 'Remove');
}

/* ---------- Invite codes ---------- */
function _admPaintCodes() {
  sbRest('invite_codes?select=*&order=active.desc,created_at.desc').then(function (rows) {
    if (_admTab !== 'codes') return;
    var add = '<div class="adm-newcode"><input id="admNewCode" type="text" maxlength="80" placeholder="Note for the new code (e.g. which school or club it’s for)">' +
      '<button class="btn primary sm-btn" onclick="adminAddCode()">' + svgIcon('plus', 14) + ' New code</button></div>' +
      '<p class="form-note" style="margin:-4px 0 14px">Give an active code to a club’s leader so they can publish their club. Only admins can see this list.</p>';
    _admList(add + ((rows || []).map(function (c) {
      return '<div class="adm-row' + (c.active ? '' : ' is-off') + '"><code class="adm-code">' + escHtml(c.code) + '</code>' +
        '<span class="adm-pill ' + (c.active ? 'st-resolved">Active' : 'st-dismissed">Off') + '</span>' +
        '<span class="adm-row-note">' + escHtml(c.note || '') + '</span>' +
        (c.active ? '<button class="btn ghost sm-btn" onclick="adminCopyCode(\'' + jsArg(c.code) + '\')">' + svgIcon('copy', 14) + ' Copy</button>' : '') +
        '<button class="btn ghost sm-btn" onclick="adminToggleCode(\'' + jsArg(c.code) + '\',' + (!c.active) + ')">' + (c.active ? 'Turn off' : 'Turn on') + '</button></div>';
    }).join('') || '<p class="form-note">No codes yet.</p>'));
  }).catch(_admFail);
}
function adminAddCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = 'SCH-';
  var rnd = new Uint32Array(6); crypto.getRandomValues(rnd);
  for (var i = 0; i < 6; i++) code += chars.charAt(rnd[i] % chars.length);
  var note = ($('admNewCode') && $('admNewCode').value || '').trim();
  sbRest('invite_codes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ code: code, active: true, note: note || null }) })
    .then(function () { toast('New code: ' + code); adminRefresh(); })
    .catch(function (ex) { toast(ex.message); });
}
function adminCopyCode(code) {
  try { navigator.clipboard.writeText(code).then(function () { toast('Copied ' + code); }, function () { toast(code); }); } catch (e) { toast(code); }
}
function adminToggleCode(code, on) {
  sbRest('invite_codes?code=eq.' + encodeURIComponent(code), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ active: on }) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t update the code.'); _inviteCheck = { code: null, ok: false }; toast(on ? 'Code turned on.' : 'Code turned off.'); adminRefresh(); })
    .catch(function (ex) { toast(ex.message); });
}
document.addEventListener('DOMContentLoaded', function () { setTimeout(refreshAdminFlag, 0); });
