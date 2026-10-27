/* ============================================================
   admin.js — the Admin page (only for emails in the server's
   `admins` table; the database enforces it, this file just shows
   the controls). Four tabs:
     Reports       — flags on clubs, businesses and people, with the
                     IDs + emails of both the reporter and the reported
                     (from the admin-only admin_reports() function)
     Messages      — the Contact Us message box (not the email)
     Verification  — approve/reject Verified-seal requests, remove seals
     Invite codes  — the private club-leader codes. Each works ONCE; the
                     row then shows which club used it. Codes can be
                     turned off (unused only) or deleted.
   The header's Admin button shows how many NEW things came in since you
   last opened this page (like unread messages); the tiles show what's
   still waiting. Everything updates live (live.js). Loaded last.
   ============================================================ */
var isAdminUser = false, adminTodo = 0;
var _admTab = 'reports', _admShowAll = { reports: false, messages: false }, _admPrevSeen = null;
var KIND_LABEL = { club: 'Club', business: 'Business', user: 'User' };

/* Ask the server whether the signed-in account is an admin (RLS only returns your own row). */
function refreshAdminFlag() {
  isAdminUser = false; adminTodo = 0;
  if (!currentUser || typeof sbHasSession !== 'function' || !sbHasSession(currentUser.email)) { renderAuthArea(); return; }
  sbRest('admins?select=email').then(function (rows) {
    isAdminUser = !!(rows && rows.length); renderAuthArea();
    if (isAdminUser) refreshAdminBadge();
  }).catch(function () {});
}
function openAdmin() {
  if (!isAdminUser) return;
  _admPrevSeen = _admSeenAt();   // what was new before this visit gets a "New" tag
  _admMarkSeen(); adminTodo = 0; renderAuthArea();
  showView('admin');
}

/* ---------- "New since you last looked" (per admin, per browser) ---------- */
function _admSeenKey() { return 'sch_admin_seen:' + ((currentUser && currentUser.email) || '').toLowerCase(); }
function _admSeenAt() { try { return localStorage.getItem(_admSeenKey()) || ''; } catch (e) { return ''; } }
function _admMarkSeen() { try { localStorage.setItem(_admSeenKey(), new Date().toISOString()); } catch (e) {} }
function _admIsNew(createdAt) { return !!(_admPrevSeen !== null && createdAt && (!_admPrevSeen || createdAt > _admPrevSeen)); }
function _admNewTag(createdAt) { return _admIsNew(createdAt) ? '<span class="adm-new">New</span>' : ''; }
/* Header badge: things that arrived since you last opened Admin (cleared while you're on the page). */
function refreshAdminBadge() {
  if (!isAdminUser) return;
  if ((typeof currentViewName === 'function') && currentViewName() === 'admin') { _admMarkSeen(); adminTodo = 0; renderAuthArea(); return; }
  var since = _admSeenAt(), f = since ? '&created_at=gt.' + encodeURIComponent(since) : '';
  Promise.all([
    _admCount('reports?status=eq.open&select=id' + f),
    _admCount('contact_messages?handled=is.false&select=id' + f),
    _admCount('verification_requests?status=eq.pending&select=id' + f)
  ]).then(function (n) { adminTodo = n[0] + n[1] + n[2]; renderAuthArea(); });
}

/* How many rows match (exact counts from the server, no rows downloaded). */
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
    _admCount('invite_codes?active=is.true&used_at=is.null&select=code')
  ]).then(function (n) { return { reports: n[0], messages: n[1], verification: n[2], codes: n[3] }; });
}

/* ---------- page shell ---------- */
var ADMIN_TABS = [
  { k: 'reports', label: 'Reports', ico: 'flag', note: 'open' },
  { k: 'messages', label: 'Messages', ico: 'mail', note: 'unread' },
  { k: 'verification', label: 'Verification', ico: 'check', note: 'pending' },
  { k: 'codes', label: 'Invite codes', ico: 'lock', note: 'unused' }
];
function renderAdmin() {
  var el = $('adminBody'); if (!el) return;
  if (!isAdminUser) { el.innerHTML = '<div class="page-head centered"><h1>Admin</h1><p>This page is for Student Club Hub admins.</p></div>'; return; }
  if (_admPrevSeen === null) { _admPrevSeen = _admSeenAt(); _admMarkSeen(); adminTodo = 0; renderAuthArea(); }
  el.innerHTML = '<div class="page-head centered"><h1>Admin</h1><p>Reports, messages, verification and invite codes, all in one place. New items appear here by themselves.</p></div>' +
    '<div class="adm-tiles" id="admTiles">' + ADMIN_TABS.map(function (t) {
      return '<button class="adm-tile' + (t.k === _admTab ? ' active' : '') + '" onclick="adminTab(\'' + t.k + '\')">' +
        '<span class="adm-tile-ico">' + svgIcon(t.ico, 18) + '</span><span class="adm-tile-n" id="admN_' + t.k + '">–</span>' +
        '<span class="adm-tile-l">' + t.label + '<small>' + t.note + '</small></span></button>';
    }).join('') + '</div>' +
    '<div class="adm-toolbar"><h2 id="admTitle"></h2><span id="admFilter"></span></div>' +
    '<div id="admList" class="adm-list"><p class="form-note">Loading…</p></div>';
  adminRefresh();
}
function adminTab(k) { _admTab = k; renderAdmin(); }
/* Reload the counts + the open tab (called after every admin action and on live updates). */
function adminRefresh() {
  _admCounts().then(function (c) { ADMIN_TABS.forEach(function (t) { var n = $('admN_' + t.k); if (n) n.textContent = c[t.k]; }); });
  if ((typeof currentViewName === 'function') && currentViewName() === 'admin') { _admMarkSeen(); adminTodo = 0; renderAuthArea(); }
  var title = $('admTitle'); if (title) title.textContent = (ADMIN_TABS.find(function (t) { return t.k === _admTab; }) || {}).label || '';
  var f = $('admFilter');
  if (f) f.innerHTML = (_admTab === 'reports' || _admTab === 'messages')
    ? '<label class="adm-filter"><input type="checkbox"' + (_admShowAll[_admTab] ? ' checked' : '') + ' onchange="_admShowAll[\'' + _admTab + '\']=this.checked;adminRefresh()"> Show ' + (_admTab === 'reports' ? 'resolved too' : 'handled too') + '</label>' : '';
  ({ reports: _admPaintReports, messages: _admPaintMessages, verification: _admPaintVerification, codes: _admPaintCodes })[_admTab]();
}
/* Live update from live.js: a report / message / request changed somewhere. */
function adminLiveChanged() {
  if (!isAdminUser) return;
  if ((typeof currentViewName === 'function') && currentViewName() === 'admin' && $('admList')) adminRefresh();
  else refreshAdminBadge();
}
function _admList(html) { var h = $('admList'); if (h) h.innerHTML = html; }
function _admEmpty(text) { return '<div class="adm-empty">' + svgIcon('check', 26) + '<p>' + text + '</p></div>'; }
function _admFail(ex) { _admList('<p class="form-note">' + escHtml(ex.message) + '</p>'); }
function _admWhen(s) {
  if (!s) return '';
  var d = new Date(s); return escHtml(d.toLocaleDateString(siteLocale(), { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' + d.toLocaleTimeString(siteLocale(), { hour: 'numeric', minute: '2-digit' }));
}
function _admDate(s) { return s ? escHtml(_fmtAgrDate(String(s).slice(0, 10))) : ''; }
function _admKind(k) { return '<span class="badge adm-kind">' + escHtml(KIND_LABEL[k] || k || '') + '</span>'; }
function _admId(id) { if (!id) return ''; id = String(id); return ' <span class="adm-id">' + escHtml(id[0] === '#' ? id : '#' + id) + '</span>'; }
/* A link to the club / business / profile something is about (or a note if it no longer exists). */
function _admTargetLink(kind, id, name) {
  if (kind === 'club') return getClub(id) ? '<a href="#" class="link" onclick="openClub(\'' + jsArg(id) + '\');return false;">' + escHtml(name || 'club') + '</a>' : escHtml(name || 'club') + ' <span class="form-note">(deleted)</span>';
  if (kind === 'business') return '<a href="#" class="link" onclick="openBusiness(\'' + jsArg(id) + '\');return false;">' + escHtml(name || 'business') + '</a>';
  return '<a href="#" class="link" onclick="openProfile(\'' + jsArg(name || id) + '\');return false;">' + escHtml(name || id) + '</a>';
}
function _admMail(email) { return email ? '<a class="link" href="mailto:' + escAttr(email) + '">' + escHtml(email) + '</a>' : '<span class="form-note">no email on file</span>'; }
function _admPerson(name, email, memberId) {
  return escHtml(name || 'Unknown') + _admId(memberId) + ' · ' + _admMail(email);
}
function _admSet(table, id, patch, msg) {
  return sbRest(table + '?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t update it. Are you still signed in as an admin?'); toast(msg); adminRefresh(); })
    .catch(function (ex) { toast(ex.message); });
}
function _admDelete(table, id, what, key) {
  openConfirm('Delete this ' + what + '?', 'It will be removed permanently.', svgIcon('trash', 26), function () {
    sbRest(table + '?' + (key || 'id') + '=eq.' + encodeURIComponent(id), { method: 'DELETE', headers: { Prefer: 'return=representation' } })
      .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t delete it.'); toast('Deleted.'); adminRefresh(); })
      .catch(function (ex) { toast(ex.message); });
  }, 'Delete');
}

/* ---------- Reports ---------- */
var REPORT_STATUS = { open: 'Open', resolved: 'Resolved', dismissed: 'Dismissed' };
/* Who/what was reported, with its ID and the email the admin can reach them at. */
function _admReported(r) {
  var who = '<strong>' + _admTargetLink(r.target_type, r.target_id, r.target_name) + '</strong>' + _admId(r.target_public_id);
  if (r.target_type === 'business') return who + '<div class="adm-meta">Owner: ' + _admMail(r.target_email) + '</div>';
  if (r.target_type === 'club') return who + '<div class="adm-meta">President: ' + _admPerson(r.target_owner_name, r.target_email, r.target_owner_id) + '</div>';
  return who + '<div class="adm-meta">Accused: ' + _admPerson(r.target_owner_name || r.target_name, r.target_email, r.target_owner_id || r.target_id) + '</div>';
}
function _admPaintReports() {
  sbRpc('admin_reports', { p_all: !!_admShowAll.reports }).then(function (rows) {
    if (_admTab !== 'reports') return;
    if (!rows || !rows.length) return _admList(_admEmpty(_admShowAll.reports ? 'No reports yet.' : 'No open reports. Nice.'));
    _admList(rows.map(function (r) {
      var st = r.status || 'open', id = jsArg(r.id);
      return '<article class="adm-card' + (st === 'open' ? ' is-open' : '') + '">' +
        '<div class="adm-card-top">' + _admKind(r.target_type) + ' <div class="adm-target">' + _admReported(r) + '</div>' + _admNewTag(r.created_at) +
          '<span class="adm-pill st-' + escAttr(st) + '">' + escHtml(REPORT_STATUS[st] || st) + '</span></div>' +
        '<div class="adm-reason">' + svgIcon('flag', 14) + ' ' + escHtml(r.reason || 'No reason given') + '</div>' +
        (r.context ? '<div class="adm-meta">' + svgIcon('pin', 13) + ' Where: <strong class="adm-ctx">' + escHtml(r.context) + '</strong></div>' : '') +
        (r.details ? '<p class="adm-text">' + escHtml(r.details) + '</p>' : '') +
        '<div class="adm-meta">Reported by ' + _admPerson(r.reporter_name, r.reporter_email, r.reporter_id) + ' · ' + _admWhen(r.created_at) + '</div>' +
        '<div class="adm-actions">' + (st === 'open'
          ? '<button class="btn primary sm-btn" onclick="_admSet(\'reports\',\'' + id + '\',{status:\'resolved\'},\'Marked resolved.\')">Mark resolved</button>' +
            '<button class="btn ghost sm-btn" onclick="_admSet(\'reports\',\'' + id + '\',{status:\'dismissed\'},\'Dismissed.\')">Dismiss</button>'
          : '<button class="btn ghost sm-btn" onclick="_admSet(\'reports\',\'' + id + '\',{status:\'open\'},\'Reopened.\')">Reopen</button>') +
          '<button class="btn ghost sm-btn adm-del" title="Delete report" onclick="_admDelete(\'reports\',\'' + id + '\',\'report\')">' + svgIcon('trash', 14) + '</button></div>' +
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
        '<div class="adm-card-top"><strong>' + escHtml(m.sender_name || 'Unknown') + _admId(m.member_id) + '</strong>' + _admNewTag(m.created_at) +
          '<span class="adm-pill ' + (m.handled ? 'st-resolved">Handled' : 'st-open">New') + '</span></div>' +
        '<p class="adm-text">' + escHtml(m.message || '') + '</p>' +
        '<div class="adm-meta">' + escHtml(MESSAGE_SOURCE[m.source] || m.source || '') + ' · ' + _admWhen(m.created_at) + '</div>' +
        '<div class="adm-actions">' +
          (m.sender_email ? '<a class="btn ghost sm-btn" href="mailto:' + escAttr(m.sender_email) + '?subject=' + subj + '">' + svgIcon('mail', 14) + ' Reply to ' + escHtml(m.sender_email) + '</a>' : '') +
          '<button class="btn ' + (m.handled ? 'ghost' : 'primary') + ' sm-btn" onclick="_admSet(\'contact_messages\',\'' + id + '\',{handled:' + (!m.handled) + '},\'' + (m.handled ? 'Marked as new.' : 'Marked handled.') + '\')">' + (m.handled ? 'Mark as new' : 'Mark handled') + '</button>' +
          '<button class="btn ghost sm-btn adm-del" title="Delete message" onclick="_admDelete(\'contact_messages\',\'' + id + '\',\'message\')">' + svgIcon('trash', 14) + '</button></div>' +
      '</article>';
    }).join(''));
  }).catch(_admFail);
}

/* ---------- Verification ---------- */
function _admPaintVerification() {
  var clubs = CLUBS.filter(function (c) { return c.verified; }).map(function (c) { return { kind: 'club', id: c.id, name: c.name, pid: c.clubId }; });
  Promise.all([
    sbRest('verification_requests?status=eq.pending&select=*&order=created_at.asc'),
    sbRest('businesses?verified=is.true&select=id,name,public_id').catch(function () { return []; })
  ]).then(function (res) {
    if (_admTab !== 'verification') return;
    var reqs = res[0] || [], seals = clubs.concat((res[1] || []).map(function (b) { return { kind: 'business', id: b.id, name: b.name, pid: b.public_id }; }));
    var pending = reqs.length ? reqs.map(function (r) {
      return '<article class="adm-card is-open"><div class="adm-card-top">' + _admKind(r.kind) + ' <strong>' + _admTargetLink(r.kind, r.entity_id, r.entity_name) + '</strong>' + _admNewTag(r.created_at) +
          '<span class="adm-pill st-open">Pending</span></div>' +
        _admVerifyDetails(r) +
        '<div class="adm-meta">Requested by ' + _admPerson('', r.requester_email, r.requester_id) + ' · ' + _admWhen(r.created_at) + '</div>' +
        '<div class="adm-actions"><button class="btn primary sm-btn" onclick="adminDecide(\'' + r.id + '\',true)">Approve</button>' +
          '<button class="btn ghost sm-btn" onclick="adminDecide(\'' + r.id + '\',false)">Reject</button></div></article>';
    }).join('') : _admEmpty('No pending verification requests.');
    var list = seals.length ? seals.map(function (x) {
      return '<div class="adm-row">' + _admKind(x.kind) + ' ' + _admTargetLink(x.kind, x.id, x.name) + _admId(x.pid) +
        '<button class="btn ghost sm-btn" onclick="adminRemoveSeal(\'' + x.kind + '\',\'' + jsArg(x.id) + '\')">Remove seal</button></div>';
    }).join('') : '<p class="form-note">Nothing is verified yet.</p>';
    _admList(pending + '<h3 class="adm-sub">Currently verified</h3><div class="adm-rows">' + list + '</div>');
  }).catch(_admFail);
}
/* The questionnaire answers (older requests only have a note). Emails / phones / links are
   clickable so the admin can check them: email the advisor, call the school or the business. */
var VF_LABELS = {
  fullName: 'Name', role: 'Role', email: 'Contact email', phone: 'Phone',
  school: 'School', schoolCity: 'School city', schoolPhone: 'School office phone', standing: 'School recognition',
  advisorName: 'Advisor', advisorEmail: 'Advisor email', link: 'Link',
  address: 'Address', city: 'City', zip: 'Zip', bizPhone: 'Business phone', website: 'Website', listing: 'Online listing'
};
function _admVfValue(k, v) {
  if (/email/i.test(k)) return '<a class="link" href="mailto:' + escAttr(v) + '">' + escHtml(v) + '</a>';
  if (/phone/i.test(k)) return '<a class="link" href="tel:' + escAttr(v.replace(/[^\d+]/g, '')) + '">' + escHtml(v) + '</a>';
  if (/^(link|website|listing)$/.test(k)) {
    var url = /^https?:\/\//i.test(v) ? v : 'https://' + v;
    return '<a class="link" href="' + escAttr(url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(v) + '</a>';
  }
  return escHtml(v);
}
function _admVerifyDetails(r) {
  var d = r.details || {}, rows = Object.keys(VF_LABELS).filter(function (k) { return d[k]; }).map(function (k) {
    return '<dt>' + VF_LABELS[k] + '</dt><dd>' + _admVfValue(k, String(d[k])) + '</dd>';
  }).join('');
  var hint = !rows ? '' : r.kind === 'club'
    ? '<p class="form-note adm-vf-hint">To confirm: email the advisor at their school address, or call the school office.</p>'
    : '<p class="form-note adm-vf-hint">To confirm: compare with the public listing (Google Maps, website) and call the business number.</p>';
  return (rows ? '<dl class="adm-vf">' + rows + '</dl>' + hint : '') +
    (r.note ? '<p class="adm-text">' + (rows ? '<span class="form-note">Anything else: </span>' : '') + escHtml(r.note) + '</p>' : '');
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

/* ---------- Invite codes ----------
   A code works once. Unused → Copy / Turn off / Delete. Used → shows the club that used it
   (and whether that club still exists) → Delete only (turning it off would change nothing:
   it can't be used again anyway, and the club it made stays). */
function _admCodeState(c) {
  if (c.used_at) return { cls: 'st-resolved', label: 'Used' };
  return c.active ? { cls: 'st-open', label: 'Unused' } : { cls: 'st-dismissed', label: 'Off' };
}
/* `live` = { id: current name } for the used clubs/businesses that still exist (asked of the server). */
function _admCodeUse(c, live) {
  if (!c.used_at) return '';
  var exists = Object.prototype.hasOwnProperty.call(live, c.used_id), name = live[c.used_id] || c.used_name || '';
  var link = c.used_kind === 'club'
    ? '<a href="#" class="link" onclick="adminOpenClub(\'' + jsArg(c.used_id) + '\');return false;">' + escHtml(name) + '</a>'
    : _admTargetLink(c.used_kind, c.used_id, name);
  return '<div class="adm-code-use"><span class="form-note">Used by</span> ' + _admKind(c.used_kind) + ' ' +
    (exists ? link : escHtml(name || 'Unknown') + ' <span class="form-note">(deleted)</span>') +
    _admId(c.used_public_id) + ' <span class="form-note">· ' + _admDate(c.used_at) + '</span></div>';
}
function _admPaintCodes() {
  var live = {};
  sbRest('invite_codes?select=*&order=created_at.desc').then(function (rows) {
    var clubIds = (rows || []).filter(function (c) { return c.used_at && c.used_kind === 'club'; }).map(function (c) { return c.used_id; });
    var bizIds = (rows || []).filter(function (c) { return c.used_at && c.used_kind === 'business'; }).map(function (c) { return c.used_id; });
    return Promise.all([
      clubIds.length ? sbRest('clubs?id=in.' + _idList(clubIds) + '&select=id,name:data->>name') : [],
      bizIds.length ? sbRest('businesses?id=in.' + _idList(bizIds) + '&select=id,name') : []
    ]).then(function (res) { res[0].concat(res[1]).forEach(function (x) { live[String(x.id)] = x.name; }); return rows; });
  }).then(function (rows) {
    if (_admTab !== 'codes') return;
    rows = (rows || []).sort(function (a, b) {   // unused first, then used, then off; newest first inside each group
      var rank = function (c) { return c.used_at ? 1 : (c.active ? 0 : 2); };
      return rank(a) - rank(b) || String(b.created_at).localeCompare(String(a.created_at));
    });
    var add = '<div class="adm-newcode"><input id="admNewCode" type="text" maxlength="80" placeholder="Note for the new code (e.g. which school or club it’s for)">' +
      '<button class="btn primary sm-btn" onclick="adminAddCode()">' + svgIcon('plus', 14) + ' New code</button></div>' +
      '<p class="form-note" style="margin:-4px 0 14px">Give an unused code to a club’s leader so they can publish their club. Each code works <strong>once</strong>: after a club is created with it, nobody can use it again. Only admins can see this list.</p>';
    _admList(add + (rows.map(function (c) {
      var st = _admCodeState(c), code = jsArg(c.code);
      return '<div class="adm-row adm-code-row' + (st.label === 'Off' ? ' is-off' : '') + '"><code class="adm-code">' + escHtml(c.code) + '</code>' +
        '<span class="adm-pill ' + st.cls + '">' + st.label + '</span>' +
        '<span class="adm-row-note">' + escHtml(c.note || '') + (c.created_at ? ' <span class="adm-made">Created ' + _admDate(c.created_at) + '</span>' : '') + '</span>' +
        (!c.used_at && c.active ? '<button class="btn ghost sm-btn" onclick="adminCopyCode(\'' + code + '\')">' + svgIcon('copy', 14) + ' Copy</button>' : '') +
        (!c.used_at ? '<button class="btn ghost sm-btn" onclick="adminToggleCode(\'' + code + '\',' + (!c.active) + ')">' + (c.active ? 'Turn off' : 'Turn on') + '</button>' : '') +
        '<button class="btn ghost sm-btn adm-del" title="Delete code" onclick="_admDelete(\'invite_codes\',\'' + code + '\',\'code\',\'code\')">' + svgIcon('trash', 14) + '</button>' +
        _admCodeUse(c, live) + '</div>';
    }).join('') || '<p class="form-note">No codes yet.</p>'));
  }).catch(_admFail);
}
/* A club made after this page loaded isn't in CLUBS yet: load the list first. */
function adminOpenClub(id) { if (getClub(id)) return openClub(id); if (typeof loadClubs === 'function') loadClubs(function () { openClub(id); }); }
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
  sbRest('invite_codes?code=eq.' + encodeURIComponent(code) + '&used_at=is.null', { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ active: on }) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t update the code (it may have just been used).'); _inviteCheck = { code: null, ok: false }; toast(on ? 'Code turned on.' : 'Code turned off.'); adminRefresh(); })
    .catch(function (ex) { toast(ex.message); });
}
document.addEventListener('DOMContentLoaded', function () {
  setTimeout(refreshAdminFlag, 0);
  setInterval(function () { if (isAdminUser && !document.hidden) refreshAdminBadge(); }, 60000);   // fallback if the live connection is down
});
