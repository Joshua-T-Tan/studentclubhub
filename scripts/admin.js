/* ============================================================
   admin.js — the Admin page (only for emails in the server's
   `admins` table; the database enforces it, this file just shows
   the controls). Admins approve or reject Verified-seal requests,
   remove seals, and manage the private club-leader invite codes.
   Loaded last.
   ============================================================ */
var isAdminUser = false;
/* Ask the server whether the signed-in account is an admin (RLS only returns your own row). */
function refreshAdminFlag() {
  isAdminUser = false;
  if (!currentUser || typeof sbHasSession !== 'function' || !sbHasSession(currentUser.email)) { renderAuthArea(); return; }
  sbRest('admins?select=email').then(function (rows) {
    isAdminUser = !!(rows && rows.length); renderAuthArea();
  }).catch(function () {});
}
function openAdmin() { if (isAdminUser) showView('admin'); }

function renderAdmin() {
  var el = $('adminBody'); if (!el) return;
  if (!isAdminUser) { el.innerHTML = '<div class="page-head centered"><h1>Admin</h1><p>This page is for Student Club Hub admins.</p></div>'; return; }
  el.innerHTML = '<div class="page-head centered"><h1>Admin</h1><p>Review Verified-seal requests and manage club leader invite codes.</p></div>' +
    '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Verification requests</div><div id="admReqs"><p class="form-note">Loading…</p></div></div>' +
    '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Verified clubs &amp; businesses</div><div id="admVerified"><p class="form-note">Loading…</p></div></div>' +
    '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Club leader invite codes</div>' +
      '<p class="form-note" style="margin-bottom:10px">Give an active code to a club’s leader so they can publish it. Codes are private: only admins can see this list.</p>' +
      '<div id="admCodes"><p class="form-note">Loading…</p></div>' +
      '<div style="display:flex;gap:8px;margin-top:10px"><input id="admNewCode" type="text" placeholder="Note (e.g. which school it’s for)" style="flex:1">' +
      '<button class="btn primary sm-btn" onclick="adminAddCode()">New code</button></div></div>';
  _admPaintRequests(); _admPaintVerified(); _admPaintCodes();
}
function _admDate(s) { return s ? escHtml(_fmtAgrDate(String(s).slice(0, 10))) : ''; }
function _admEntityLink(kind, id, name) {
  return '<a href="#" class="link" onclick="' + (kind === 'club' ? 'openClub' : 'openBusiness') + '(\'' + jsArg(id) + '\');return false;">' + escHtml(name || '(unnamed)') + '</a>';
}
function _admPaintRequests() {
  sbRest('verification_requests?status=eq.pending&select=*&order=created_at.asc').then(function (rows) {
    var host = $('admReqs'); if (!host) return;
    host.innerHTML = (rows && rows.length) ? rows.map(function (r) {
      return '<div class="roster-row" style="align-items:flex-start;gap:12px"><div class="who" style="flex:1">' +
        '<div class="n">' + _admEntityLink(r.kind, r.entity_id, r.entity_name) + ' <span class="badge">' + escHtml(r.kind) + '</span></div>' +
        '<div class="form-note">From ' + escHtml(r.requester_email || r.requester_id || '') + ' · ' + _admDate(r.created_at) + '</div>' +
        '<p style="margin-top:6px;white-space:pre-wrap">' + escHtml(r.note || '') + '</p></div>' +
        '<button class="btn primary sm-btn" onclick="adminDecide(\'' + r.id + '\',true)">Approve</button>' +
        '<button class="btn ghost sm-btn" onclick="adminDecide(\'' + r.id + '\',false)">Reject</button></div>';
    }).join('') : '<p class="form-note">No pending requests.</p>';
  }).catch(function (ex) { var h = $('admReqs'); if (h) h.innerHTML = '<p class="form-note">' + escHtml(ex.message) + '</p>'; });
}
function _admPaintVerified() {
  var clubs = CLUBS.filter(function (c) { return c.verified; }).map(function (c) { return { kind: 'club', id: c.id, name: c.name }; });
  sbRest('businesses?verified=is.true&select=id,name').catch(function () { return []; }).then(function (biz) {
    var host = $('admVerified'); if (!host) return;
    var all = clubs.concat((biz || []).map(function (b) { return { kind: 'business', id: b.id, name: b.name }; }));
    host.innerHTML = all.length ? all.map(function (x) {
      return '<div class="roster-row"><div class="who" style="flex:1"><div class="n">' + _admEntityLink(x.kind, x.id, x.name) + ' <span class="badge">' + x.kind + '</span></div></div>' +
        '<button class="btn ghost sm-btn" onclick="adminRemoveSeal(\'' + x.kind + '\',\'' + jsArg(x.id) + '\')">Remove seal</button></div>';
    }).join('') : '<p class="form-note">Nothing is verified yet.</p>';
  });
}
function _admPaintCodes() {
  sbRest('invite_codes?select=*&order=created_at.desc').then(function (rows) {
    var host = $('admCodes'); if (!host) return;
    host.innerHTML = (rows || []).map(function (c) {
      return '<div class="roster-row"><div class="who" style="flex:1"><div class="n"><code>' + escHtml(c.code) + '</code> ' +
        (c.active ? '<span class="badge">Active</span>' : '<span class="badge gray">Off</span>') + '</div>' +
        (c.note ? '<div class="form-note">' + escHtml(c.note) + '</div>' : '') + '</div>' +
        '<button class="btn ghost sm-btn" onclick="adminToggleCode(\'' + jsArg(c.code) + '\',' + (!c.active) + ')">' + (c.active ? 'Turn off' : 'Turn on') + '</button></div>';
    }).join('') || '<p class="form-note">No codes yet.</p>';
  }).catch(function (ex) { var h = $('admCodes'); if (h) h.innerHTML = '<p class="form-note">' + escHtml(ex.message) + '</p>'; });
}
function adminDecide(reqId, approve) {
  sbRpc('admin_decide_verification', { p_req: reqId, p_approve: approve }).then(function () {
    toast(approve ? 'Approved — the gold seal is on.' : 'Request rejected.');
    if (typeof loadClubs === 'function') loadClubs(function () { _admPaintVerified(); });
    _bizCache = null; _admPaintRequests();
  }).catch(function (ex) { toast(ex.message); });
}
function adminRemoveSeal(kind, id) {
  openConfirm('Remove the Verified seal?', 'The gold seal disappears from this page and its card. The owner can request it again.', svgIcon('warning', 26), function () {
    sbRpc('admin_set_verified', { p_kind: kind, p_id: id, p_on: false }).then(function () {
      toast('Seal removed.'); _bizCache = null;
      if (typeof loadClubs === 'function') loadClubs(function () { _admPaintVerified(); }); else _admPaintVerified();
    }).catch(function (ex) { toast(ex.message); });
  }, 'Remove');
}
function adminAddCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', code = 'SCH-';
  var rnd = new Uint32Array(6); (window.crypto || window.msCrypto).getRandomValues(rnd);
  for (var i = 0; i < 6; i++) code += chars.charAt(rnd[i] % chars.length);
  var note = ($('admNewCode') && $('admNewCode').value || '').trim();
  sbRest('invite_codes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ code: code, active: true, note: note || null }) })
    .then(function () { if ($('admNewCode')) $('admNewCode').value = ''; toast('New code: ' + code); _admPaintCodes(); })
    .catch(function (ex) { toast(ex.message); });
}
function adminToggleCode(code, on) {
  sbRest('invite_codes?code=eq.' + encodeURIComponent(code), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ active: on }) })
    .then(function () { _inviteCheck = { code: null, ok: false }; _admPaintCodes(); }).catch(function (ex) { toast(ex.message); });
}
document.addEventListener('DOMContentLoaded', function () { setTimeout(refreshAdminFlag, 0); });
