/* ============================================================
   profile.js - public user profiles, Saved-clubs lists, and the
   multi-tab Account Settings interface.
   ============================================================ */

var currentProfileName = null;

/* Clubs where this person holds an officer role, from the live roster (by member ID when known). */
function clubsLedBy(name, memberId) {
  if (!memberId && currentUser && name === currentUser.name) memberId = currentUser.memberId;
  return CLUBS.filter(function (c) {
    if (memberId && c.verifiedOwner === memberId) return true;
    return (c.roster || []).some(function (m) {
      var me = memberId ? m.memberId === memberId : (!m.memberId && m.name === name);
      return me && m.role && m.role !== 'Member';
    }) || (!memberId && !(c.roster || []).some(function (m) { return m.memberId; }) && (c.leaders || []).some(function (l) { return l.name === name; }));
  });
}
function userRecordByName(name) {
  try { return Object.values(loadUsers()).find(function (u) { return u.name === name; }) || null; } catch (e) { return null; }
}

/* ============================================================
   PUBLIC PROFILE
   ============================================================ */
var profileReturn = { view: 'browse', clubId: null };
function openProfile(name) {
  if (!name) return;
  var cur = (typeof currentViewName === 'function') ? currentViewName() : 'browse';
  if (cur !== 'profile') profileReturn = { view: cur, clubId: (cur === 'club' && typeof currentClubId !== 'undefined') ? currentClubId : null };
  currentProfileName = name; closeClubModal(); renderProfile(name); showView('profile');
}
/* Back from a profile → return to wherever you opened it (the club, browse, settings, …). */
function backFromProfile() {
  if (profileReturn.view === 'club' && profileReturn.clubId && typeof openClub === 'function') { openClub(profileReturn.clubId); return; }
  showView(profileReturn.view || 'browse');
}
function renderProfileIfOpen() {
  if (currentProfileName && !$('view-profile').classList.contains('hidden')) renderProfile(currentProfileName);
}
function renderProfile(name) {
  var body = $('profileBody'); if (!body) return;
  var isSelf = !!(currentUser && currentUser.name === name);
  var rec = userRecordByName(name);
  var data = isSelf ? currentUser : (rec || {});
  var info = _profileInfo[name];   // server copy (profiles table) for people who never used this browser
  var priv = isSelf ? !!currentUser.private : !!((rec && rec.private) || (info && info.private));
  var memberId = isSelf ? currentUser.memberId : (rec && rec.memberId) || (info && info.memberId) || '';
  var led = clubsLedBy(name, memberId);
  var ledLine = 'Leads ' + led.length + ' club' + (led.length === 1 ? '' : 's');

  // ----- Profile card (identity) -----
  var metaBits = [data.school, data.grad ? 'Class of ' + data.grad : ''].filter(Boolean).map(escHtml);
  var identity;
  if (priv) {
    // Private: only Name, Member ID, and number of clubs led
    identity = '<p>' + (memberId ? 'Member ' + escHtml(memberId) + ' · ' : '') + ledLine + '</p>' +
      '<p class="form-note" style="margin-top:6px">' + svgIcon('lock', 14) + ' This profile is private.</p>';
  } else {
    identity = (data.headline ? '<p style="color:var(--ink)">' + escHtml(data.headline) + '</p>' : '') +
      '<p>' + (memberId ? 'Member ' + escHtml(memberId) : '') + (metaBits.length ? ' · ' + metaBits.join(' · ') : '') + '</p>' +
      (data.bio ? '<p style="color:var(--muted);margin-top:6px">' + escHtml(data.bio) + '</p>' : '');
  }

  var html =
    '<div style="padding-top:16px"><button class="btn ghost" onclick="backFromProfile()">← Back</button></div>' +
    '<div class="profile-head">' + avatarHTML(name, 'lg') +
      '<div class="meta"><div class="name-row"><h1>' + escHtml(name) + '</h1>' +
        (isSelf ? '' : '<button class="name-ico flag" title="Report this user" onclick="openReport(\'user\',\'' + jsArg(memberId || name) + '\',\'' + jsArg(name) + '\')">' + (typeof ICON_FLAG !== 'undefined' ? ICON_FLAG : '') + '</button>') + '</div>' + identity +
        (isSelf ? '<div class="profile-edit"><button class="btn ghost sm-btn" onclick="openSettings()">Edit Profile &amp; Settings</button></div>' : '') +
      '</div></div>' +
    '<div id="profileLists"></div>';
  body.innerHTML = html;
  // Club + business lists (hidden entirely when private) — Saved Clubs never shown here
  if (!priv) _populateProfileLists(name, isSelf, rec);
  // Someone else's profile: check the server for their privacy setting / member ID, then repaint once.
  if (!isSelf && !info && typeof sbRest === 'function') {
    _resolveProfilePerson(name, null).then(function () { if (currentProfileName === name && _profileInfo[name]) renderProfile(name); });
  }
}
var _profileInfo = {};
/* Resolve the profile person's email + member ID (for looking up their shops / joined clubs). */
function _resolveProfilePerson(name, rec) {
  if (currentUser && currentUser.name === name) return Promise.resolve({ email: (currentUser.email || '').toLowerCase(), memberId: currentUser.memberId || '' });
  if (rec && (rec.email || rec.memberId)) return Promise.resolve({ email: (rec.email || '').toLowerCase(), memberId: rec.memberId || '' });
  if (_profileInfo[name]) return Promise.resolve(_profileInfo[name]);
  if (typeof sbRest !== 'function') return Promise.resolve({ email: '', memberId: '' });
  return sbRest('profiles?name=eq.' + encodeURIComponent(name) + '&select=member_id,email,private&limit=1')
    .then(function (r) {
      var p = r && r[0], out = p ? { email: (p.email || '').toLowerCase(), memberId: p.member_id || '', private: !!p.private } : { email: '', memberId: '', private: false };
      _profileInfo[name] = out; return out;
    })
    .catch(function () { return { email: '', memberId: '' }; });
}
/* Build every applicable section for a profile: clubs led, businesses led (shops
   they own), and clubs joined. Shops + another user's joined clubs load async. */
function _populateProfileLists(name, isSelf, rec) {
  var host = $('profileLists'); if (!host) return;
  host.innerHTML = '<p class="form-note" style="padding:14px 0">Loading…</p>';
  var first = name.split(' ')[0];
  _resolveProfilePerson(name, rec).then(function (pp) {
    if (currentProfileName !== name) return;   // profile changed while loading
    var led = clubsLedBy(name, pp.memberId);
    var bizP = pp.email
      ? sbRest('businesses?owner_email=eq.' + encodeURIComponent(pp.email) + '&select=*' + (isSelf ? '' : '&status=eq.verified')).catch(function () { return []; })
      : Promise.resolve([]);
    var memP = (!isSelf && pp.memberId)
      ? sbRest('club_members?member_id=eq.' + encodeURIComponent(pp.memberId) + '&select=club_id').catch(function () { return []; })
      : Promise.resolve(null);
    Promise.all([bizP, memP]).then(function (res) {
      if (currentProfileName !== name) return;
      var bizzes = res[0] || [], mem = res[1];
      // Cache fetched shops so their cards' "View Details" can open them.
      // Visitors don't see private listings; your own profile shows everything you own.
      if (!isSelf) bizzes = bizzes.filter(function (b) { return !b.is_private; });
      if (typeof _rememberBiz === 'function') bizzes.forEach(_rememberBiz);
      var ledIds = led.map(function (c) { return String(c.id); });
      var joined;
      if (isSelf) {
        joined = currentUser.joined.map(getClub).filter(Boolean).filter(function (c) { return ledIds.indexOf(String(c.id)) === -1; });
      } else if (mem) {
        var seen = {};
        joined = mem.map(function (r) { return getClub(r.club_id); }).filter(Boolean).filter(function (c) {
          var id = String(c.id); if (ledIds.indexOf(id) > -1 || seen[id]) return false; seen[id] = 1; return true;
        });
      } else joined = [];
      var out = '';
      if (isSelf) {
        out += profileSection('Clubs Joined', joined, 'You haven’t joined any clubs yet.');
        out += profileSection('Clubs Leading', led, 'You don’t lead any clubs yet.');
        out += profileSection('Businesses Leading', bizzes, 'You don’t own any businesses yet.', businessCard);
      } else {
        if (led.length) out += profileSection('Clubs ' + first + ' Leads', led, '');
        if (bizzes.length) out += profileSection('Businesses ' + first + ' Leads', bizzes, '', businessCard);
        if (joined.length) out += profileSection('Clubs ' + first + ' Joined', joined, '');
        if (!out) out = '<p class="form-note" style="padding:10px 0">No public clubs or businesses yet.</p>';
      }
      host.innerHTML = out;
    });
  });
}
function profileSection(title, items, emptyMsg, renderer) {
  renderer = renderer || renderCard;
  var inner = items && items.length ? '<div class="grid">' + items.map(renderer).join('') + '</div>'
    : '<p class="form-note" style="padding:6px 0 4px">' + escHtml(emptyMsg) + '</p>';
  return '<div class="page-head" style="padding:22px 0 8px"><h1 style="font-size:1.2rem">' + escHtml(title) + '</h1></div>' + inner;
}

/* ============================================================
   MY CLUBS (Clubs I Lead / Clubs I've Joined)
   ============================================================ */
var myClubsView = 'lead';
function myClubsTab(tab) {
  myClubsView = tab;
  document.querySelectorAll('#view-myclubs .settings-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.mc === tab); });
  renderMyClubs();
}
function renderMyClubs() {
  var grid = $('myClubsGrid'); if (!grid || !currentUser) return;
  if (myClubsView === 'drafts') {
    var drafts = loadDrafts();
    grid.innerHTML = drafts.length ? drafts.map(draftCard).join('')
      : '<div class="empty" style="grid-column:1/-1"><div class="big">' + svgIcon('draft', 40) + '</div><p>No drafts yet.</p>' +
        '<p class="form-note">Register a club and choose “Save as Draft” to keep it here.</p>' +
        '<div style="margin-top:14px"><button class="btn primary" onclick="showView(\'create\')">Register a Club</button></div></div>';
    return;
  }
  var q = ($('myClubsSearch') && $('myClubsSearch').value || '').trim();
  // Drop any club the user has since been banned from (revokes membership everywhere)
  var pruned = currentUser.joined.filter(function (id) { var c = getClub(id); return !(c && typeof isBanned === 'function' && isBanned(c)); });
  if (pruned.length !== currentUser.joined.length) { currentUser.joined = pruned; persistUser(); }
  var led = CLUBS.filter(function (c) { return ownerOf(c); });
  var joined = currentUser.joined.map(getClub).filter(Boolean).filter(function (c) { return !ownerOf(c) && !isBanned(c); });
  var list = (myClubsView === 'joined' ? joined : led).filter(function (c) { return clubMatchesQuery(c, q); });
  if (!list.length) {
    if (q) { grid.innerHTML = emptyBlock(svgIcon('search', 40), t('empty_search')); return; }
    var msg = myClubsView === 'joined' ? t('empty_joined') : t('empty_lead');
    var cta = myClubsView === 'joined'
      ? '<button class="btn primary" onclick="showView(\'browse\')">' + t('nav_browse') + '</button>'
      : '<button class="btn primary" onclick="showView(\'create\')">' + t('nav_create') + '</button>';
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">' + svgIcon('clipboard', 40) + '</div><p>' + escHtml(msg) + '</p>' +
      '<div style="margin-top:14px">' + cta + '</div></div>';
    return;
  }
  grid.innerHTML = list.map(renderCard).join('');
}
function clubMatchesQuery(c, q) {
  if (!q) return true;
  q = q.toLowerCase().replace(/^#/, '');
  return (c.name + ' ' + (c.clubId || '') + ' ' + (c.zip || '')).toLowerCase().indexOf(q) > -1;
}
function emptyBlock(icon, msg) {
  return '<div class="empty" style="grid-column:1/-1"><div class="big">' + icon + '</div><p>' + escHtml(msg) + '</p></div>';
}
function draftCard(d) {
  return '<article class="card draft-card"><div class="card-cover draft-cover">' + svgIcon('draft', 18) + ' Draft</div><div class="card-body">' +
    '<div class="card-title"><h3>' + escHtml(d.name || 'Untitled draft') + '</h3></div>' +
    '<div class="card-meta">Saved ' + escHtml(timeAgo(d.saved)) + (d.school ? ' · ' + escHtml(d.school) : '') + '</div>' +
    '<p class="card-desc">' + escHtml(d.desc || 'No description yet.') + '</p>' +
    '<div class="card-foot"><button class="btn primary" onclick="resumeDraft(\'' + d.id + '\')">' + t('draft_resume') + '</button>' +
    '<button class="btn danger" onclick="askDeleteDraft(\'' + d.id + '\')">' + t('draft_delete') + '</button></div></div></article>';
}
function askDeleteDraft(id) {
  openConfirm('Delete this draft?', 'This permanently removes the saved draft.', svgIcon('trash', 26), function () { deleteDraft(id); });
}

/* ============================================================
   SAVED PAGE
   ============================================================ */
function renderSaved() {
  var grid = $('savedGrid'); if (!grid) return;
  if (!currentUser) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">☆</div>' +
      '<p>Log in to save your favorite clubs.</p><div style="margin-top:14px"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button></div></div>';
    return;
  }
  var q = ($('savedSearch') && $('savedSearch').value || '').trim();
  var saved = currentUser.favorites.map(getClub).filter(Boolean).filter(function (c) { return clubMatchesQuery(c, q); });
  grid.innerHTML = saved.length ? saved.map(renderCard).join('')
    : (q ? emptyBlock(svgIcon('search', 40), t('empty_search'))
        : '<div class="empty" style="grid-column:1/-1"><div class="big">☆</div><p>' + escHtml(t('empty_saved')) + '</p>' +
          '<div style="margin-top:14px"><button class="btn primary" onclick="showView(\'browse\')">' + t('nav_browse') + '</button></div></div>');
}

/* ============================================================
   ACCOUNT SETTINGS (multi-tab)
   ============================================================ */
var settingsTabName = 'profile';
function openSettings() { if (!currentUser) return openAuth('login'); settingsTabName = 'profile'; showView('settings'); }
function settingsTab(tab) { settingsTabName = tab; renderSettings(); }

function renderSettings() {
  var body = $('settingsBody'); if (!body || !currentUser) return;
  if (settingsTabName === 'privacy') settingsTabName = 'account';   // Privacy merged into Account
  var tabbar = '<div class="settings-tabs centered-tabs">' + stab('profile', t('tab_profile')) + stab('account', t('tab_account')) + '</div>';
  var panel = settingsTabName === 'account' ? settingsAccount() : settingsProfile();

  body.innerHTML =
    '<div class="page-head centered"><h1>' + t('settings_h') + '</h1><p>' + t('settings_p') + '</p></div>' +
    tabbar + '<div class="form-card">' + panel + '</div>';
}
function stab(id, label) { return '<button class="settings-tab ' + (settingsTabName === id ? 'active' : '') + '" onclick="settingsTab(\'' + id + '\')">' + label + '</button>'; }

function settingsProfile() {
  var u = currentUser, bioLen = (u.bio || '').length;
  var countCls = bioLen >= 200 ? 'max' : (bioLen >= 160 ? 'warn' : '');
  return '<div class="avatar-edit"><span id="setAvatarWrap">' + avatarHTML(u.name, 'lg') + '</span>' +
      '<div id="setAvatarCtrls"><label class="btn ghost sm-btn">' + t('set_upload_photo') + '<input type="file" accept="image/*" hidden onchange="onSettingsAvatar(event)"></label>' +
      (u.avatar ? '<button class="btn danger sm-btn" style="margin-left:8px" onclick="removeAvatar()">' + t('set_remove') + '</button>' : '') +
      '<p class="form-note" style="margin-top:6px">' + t('set_memberid') + ': <strong>' + escHtml(u.memberId) + '</strong></p></div></div>' +
    '<div class="two-col"><div class="field"><label>' + t('set_fullname') + '</label><input id="setName" type="text" value="' + escAttr(u.name) + '"></div>' +
      '<div class="field"><label>' + t('set_hs') + '</label><select id="setSchool" class="select block-select">' +
        (typeof schoolOptionsHTML === 'function' ? schoolOptionsHTML(u.school) : '<option>' + escHtml(u.school) + '</option>') + '</select></div></div>' +
    '<div class="two-col"><div class="field"><label>' + t('set_grad') + '</label><input id="setGrad" type="number" value="' + escAttr(u.grad) + '" placeholder="2027"></div>' +
      '<div class="field"><label>' + t('set_headline') + '</label><input id="setHeadline" type="text" value="' + escAttr(u.headline) + '"></div></div>' +
    '<div class="field"><label>' + t('set_bio') + '</label><textarea id="setBio" maxlength="200" oninput="updateBioCount()">' + escHtml(u.bio) + '</textarea>' +
      '<div id="bioCount" class="char-count ' + countCls + '">' + bioLen + ' / 200 ' + t('bio_chars') + '</div></div>' +
    '<div class="modal-actions"><button class="btn ghost" onclick="openProfile(currentUser.name)">' + t('set_view_public') + '</button>' +
      '<button class="btn primary" onclick="saveSettings()">' + t('set_savechanges') + '</button></div>';
}
function updateBioCount() {
  var ta = $('setBio'), el = $('bioCount'); if (!ta || !el) return;
  var len = ta.value.length;
  el.textContent = len + ' / 200 ' + t('bio_chars');
  el.classList.toggle('warn', len >= 160 && len < 200);
  el.classList.toggle('max', len >= 200);
}
function settingsAccount() {
  var u = currentUser;
  return '<div class="field"><label>' + t('set_email') + '</label><input type="email" value="' + escAttr(u.email) + '" disabled></div>' +
    '<div class="field"><label>' + t('set_memberid') + '</label><input type="text" value="' + escAttr(u.memberId) + '" disabled></div>' +
    '<div class="section-title">' + t('set_privacy') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('set_private_title') + '</div>' +
      '<div class="form-note">' + t('set_private_desc_full') + '</div></div>' +
      '<button class="switch ' + (u.private ? 'on' : '') + '" onclick="togglePrivacy()"><span></span></button></div>' +
    '<div class="section-title">' + t('set_lang_region') + '</div>' +
    '<div class="field"><label>' + t('lang_label') + '</label>' +
      '<select class="select block-select" onchange="setLanguage(this.value)">' +
        LANGS.map(function (l) { return '<option value="' + l.code + '"' + (getLang() === l.code ? ' selected' : '') + '>' + l.label + '</option>'; }).join('') +
      '</select></div>' +
    '<div class="section-title">' + t('set_notifications') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('set_email_notif_title') + '</div>' +
      '<div class="form-note">' + t('set_email_notif_desc') + '</div></div>' +
      '<button class="switch ' + (u.emailNotif !== false ? 'on' : '') + '" onclick="toggleEmailNotif()"><span></span></button></div>' +
    (sbIsGoogleOnly() ? '' :   // Google accounts use Google's own 2-step verification
    '<div class="section-title">' + t('set_security') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('set_2fa_title') + '</div>' +
      '<div class="form-note">' + t('set_2fa_desc') + '</div></div>' +
      '<button class="switch ' + (u.twofa ? 'on' : '') + '" onclick="toggle2fa()"><span></span></button></div>') +
    '<div class="section-title">' + t('set_appearance') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('set_dark_title') + '</div>' +
      '<div class="form-note">' + t('set_dark_desc') + '</div></div>' +
      '<button class="switch ' + (getTheme() === 'dark' ? 'on' : '') + '" onclick="toggleTheme()"><span></span></button></div>' +
    (sbIsGoogleOnly()
      ? '<div class="section-title">' + t('set_change_pw') + '</div><p class="form-note" style="margin-bottom:6px">' + ICON_GOOGLE + ' You sign in with Google, so your password and 2-step verification are managed in your Google account.</p>'
      : '<div class="section-title">' + t('set_change_pw') + '</div>' +
    '<div class="field"><label>' + t('set_curpw') + ' *</label><input id="pwCurrent" type="password"></div>' +
    '<div class="two-col">' +
      '<div class="field"><label>' + t('set_newpw') + '</label><input id="pwNew" type="password"></div>' +
      '<div class="field"><label>' + t('set_confirmpw') + '</label><input id="pwConfirm" type="password"></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">' +
      '<a href="#" class="link" onclick="openForgot();return false;">' + t('set_forgot') + '</a>' +
      '<button class="btn primary" onclick="doChangePassword()">' + t('set_update_pw') + '</button></div>') +
    '<div class="section-title">' + t('set_account') + '</div>' +
    '<div class="modal-actions"><button class="btn ghost" onclick="logout()">' + t('set_logout') + '</button>' +
      '<button class="btn danger" onclick="deleteAccount()">' + t('set_delete') + '</button></div>';
}
function toggle2fa() {
  var nv = !currentUser.twofa;
  sbUpdateUser({ data: { twofa: nv } }).then(function () {
    currentUser.twofa = nv; persistUser(); renderSettings();
    toast(nv ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
  }).catch(function (ex) { toast(ex.message); });
}
function doChangePassword() {
  var cur = $('pwCurrent').value, nw = $('pwNew').value, cf = $('pwConfirm').value;
  if (!cur) return toast('Enter your current password.');
  if (!validPassword(nw)) return toast('New password must be at least 8 characters and include a number or symbol.');
  if (nw === cur) return toast('Pick a new password that’s different from your current one.');
  if (nw !== cf) return toast('New passwords don’t match.');
  // Re-check the current password with the server, then save the new one there.
  sbPasswordLogin(currentUser.email, cur).then(function () { return sbUpdateUser({ password: nw }); }).then(function () {
    $('pwCurrent').value = ''; $('pwNew').value = ''; $('pwConfirm').value = '';
    toast('Your password has been updated.');
  }).catch(function (ex) { toast(ex.status === 400 && /match/i.test(ex.message) ? 'Your current password is incorrect.' : ex.message); });
}
/* Forgot password: email a 6-digit code (same Supabase code as sign-up), then set a new password.
   Works on any device, and signs you in afterwards. */
var _fpEmail = null;
function _fpHead(sub) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="font-size:1.15rem;font-weight:800">Reset your password</h3>' +
    '<button class="icon-btn" onclick="closeForgot()">✕</button></div><p class="form-note" style="margin-bottom:14px">' + sub + '</p><div id="fpErr" class="auth-error hidden"></div>';
}
function _fpErr(m) { var e = $('fpErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } }
function openForgot() {
  if ($('authOverlay') && !$('authOverlay').classList.contains('hidden')) {
    var typed = $('alEmail') && $('alEmail').value; closeOverlay('authOverlay'); _fpEmail = typed || null;
  } else _fpEmail = (currentUser && currentUser.email) || null;
  $('forgotBody').innerHTML = _fpHead('Enter your account email and we’ll email you a 6-digit code.') +
    '<div class="field"><label>Email</label><input id="forgotEmail" type="email" placeholder="you@school.edu" value="' + escAttr(_fpEmail || '') + '"></div>' +
    '<button id="fpSend" class="btn primary block lg" onclick="submitForgot()">Email me a code</button>';
  openOverlay('forgotOverlay');
}
function closeForgot() { closeOverlay('forgotOverlay'); }
function submitForgot() {
  var e = ($('forgotEmail').value || '').trim().toLowerCase();
  if (!(typeof isValidEmail === 'function' ? isValidEmail(e) : /@/.test(e))) return _fpErr('Enter a valid email address.');
  _fpEmail = e; authBusy2('fpSend', true, 'Sending…');
  sbSendOtp(e).then(function () {
    $('forgotBody').innerHTML = _fpHead('We sent a code to <strong>' + escHtml(e) + '</strong>. Enter it and choose a new password.') +
      '<div class="field"><label>6-digit code</label><input id="fpCode" type="text" inputmode="numeric" maxlength="8" autocomplete="one-time-code"></div>' +
      '<div class="field"><label>New password</label><input id="fpNew" type="password"></div>' +
      '<p class="form-note" style="margin:-6px 0 12px">' + t('au_pwhint') + '</p>' +
      '<div class="field"><label>Confirm new password</label><input id="fpConfirm" type="password"></div>' +
      '<button id="fpReset" class="btn primary block lg" onclick="submitForgotReset()">Reset password</button>';
  }).catch(function (ex) { authBusy2('fpSend', false); _fpErr(ex.message); });
}
function submitForgotReset() {
  var code = ($('fpCode').value || '').trim(), nw = $('fpNew').value, cf = $('fpConfirm').value;
  if (!code) return _fpErr('Enter the code from your email.');
  if (!validPassword(nw)) return _fpErr('Password must be at least 8 characters and include a number or symbol.');
  if (nw !== cf) return _fpErr('Passwords don’t match.');
  authBusy2('fpReset', true, 'Checking code…');
  sbVerifyOtp(_fpEmail, code).then(function () { return sbUpdateUser({ password: nw }); })
    .then(function () { return _afterServerLogin(_fpEmail); })
    .then(function (r) { delete r._new; closeForgot(); toast('Password reset. You’re signed in.'); if (typeof refreshFavUI === 'function') refreshFavUI(); })
    .catch(function (ex) { authBusy2('fpReset', false); _fpErr(ex.message || 'That code is incorrect or has expired.'); });
}

/* Update the avatar in place - never re-render the whole Settings panel (keeps unsaved text). */
function paintSettingsAvatar() {
  var wrap = $('setAvatarWrap'); if (wrap) wrap.innerHTML = avatarHTML(currentUser.name, 'lg');
  var ctrls = $('setAvatarCtrls');
  if (ctrls) {
    var hasRemove = ctrls.querySelector('.btn.danger');
    if (currentUser.avatar && !hasRemove) ctrls.querySelector('label').insertAdjacentHTML('afterend', '<button class="btn danger sm-btn" style="margin-left:8px" onclick="removeAvatar()">' + t('set_remove') + '</button>');
    else if (!currentUser.avatar && hasRemove) hasRemove.remove();
  }
}
function onSettingsAvatar(e) {
  var f = e.target.files[0]; e.target.value = '';   // reset so picking the same file again still fires
  if (!f) return;
  if (!/^image\//i.test(f.type)) return toast('Please choose an image.');
  if (f.size > 1.5 * 1024 * 1024) return toast('That photo is too large (max 1.5 MB). Try a smaller one.');
  var r = new FileReader();
  r.onload = function (ev) {
    var prev = currentUser.avatar;
    currentUser.avatar = ev.target.result; persistUser();
    var users = loadUsers(), k = currentUser.email.toLowerCase();
    if (!users[k] || users[k].avatar !== currentUser.avatar) { currentUser.avatar = prev; persistUser(); paintSettingsAvatar(); return; }
    renderAuthArea(); paintSettingsAvatar();
    if (typeof syncUserEverywhere === 'function') syncUserEverywhere();
    toast('Profile photo updated.');
  };
  r.readAsDataURL(f);
}
function removeAvatar() {
  currentUser.avatar = null; persistUser();
  renderAuthArea(); paintSettingsAvatar();
  if (typeof syncUserEverywhere === 'function') syncUserEverywhere();
}
function saveSettings() {
  var oldName = currentUser.name;
  currentUser.name = ($('setName').value || '').trim() || currentUser.name;
  currentUser.school = ($('setSchool').value || '').trim();
  currentUser.grad = ($('setGrad').value || '').trim();
  currentUser.headline = ($('setHeadline').value || '').trim();
  currentUser.bio = ($('setBio').value || '').slice(0, 200).trim();
  if (currentUser.school && typeof districtForSchool === 'function') { var dist = districtForSchool(currentUser.school); if (dist) currentUser.district = dist; }
  persistUser(); renderAuthArea();
  if (typeof sbUpsertProfile === 'function') sbUpsertProfile();
  if (currentUser.name !== oldName && typeof syncUserRename === 'function') syncUserRename(oldName, currentUser.name);
  if (typeof syncUserEverywhere === 'function') syncUserEverywhere();
  renderSettings(); toast('Your changes have been saved.');
}
function togglePrivacy() { currentUser.private = !currentUser.private; persistUser(); if (typeof sbUpsertProfile === 'function') sbUpsertProfile(); renderSettings(); toast(currentUser.private ? 'Profile is now private.' : 'Profile is now public.'); }
function toggleEmailNotif() { currentUser.emailNotif = (currentUser.emailNotif === false); persistUser(); renderSettings(); toast(currentUser.emailNotif ? 'Email notifications on.' : 'Email notifications off.'); }
function setLanguage(lang) { applyLanguage(lang); onLanguageChanged(); if (currentUser) { currentUser.lang = lang; persistUser(); } }
/* Deleting an account requires re-entering the correct password */
function deleteAccount() { openDeleteAccount(); }
function openDeleteAccount() {
  if (!currentUser) return;
  var e = $('delAcctErr'); if (e) e.style.display = 'none';
  var p = $('delAcctPass'); if (p) p.value = '';
  // Google-only accounts have no site password: they confirm by typing their email instead.
  var g = sbIsGoogleOnly(), lbl = p && p.closest('.field') && p.closest('.field').querySelector('label');
  if (p) { p.type = g ? 'email' : 'password'; p.placeholder = g ? currentUser.email : 'Your account password'; }
  if (lbl) lbl.textContent = g ? 'Type your email to confirm' : 'Password';
  if (e) e.textContent = g ? 'That doesn’t match your email.' : 'Incorrect password. Please try again.';
  openOverlay('deleteAccountOverlay');
  setTimeout(function () { if ($('delAcctPass')) $('delAcctPass').focus(); }, 60);
}
function closeDeleteAccount() { closeOverlay('deleteAccountOverlay'); }
function confirmDeleteAccount() {
  if (!currentUser) return;
  var typed = ($('delAcctPass') && $('delAcctPass').value) || '';
  var showErr = function () { var e = $('delAcctErr'); if (e) e.style.display = ''; var p = $('delAcctPass'); if (p) { p.value = ''; p.focus(); } };
  if (!typed) return showErr();
  var me = currentUser;
  // The server checks the password, then removes the account, its profile and memberships
  // (and refuses while you still lead a club or own a business).
  var check = sbIsGoogleOnly()
    ? (typed.trim().toLowerCase() === me.email.toLowerCase() ? Promise.resolve() : Promise.reject({ status: 400 }))
    : sbPasswordLogin(me.email, typed);
  check.then(function () { return sbRpc('delete_my_account'); }, function (ex) { if (ex.status === 400) { showErr(); return 'bad'; } throw ex; })
    .then(function (res) {
      if (res === 'bad') return;
      CLUBS.forEach(function (c) { var i = (c.roster || []).findIndex(function (m) { return m.memberId === me.memberId; }); if (i > -1) { c.roster.splice(i, 1); c.memberCount = c.roster.length; } });
      var users = loadUsers(); delete users[me.email.toLowerCase()]; saveUsers(users);
      try { localStorage.removeItem('sch_saved_biz:' + me.email.toLowerCase()); } catch (e) {}
      currentUser = null; sbSignOut(); clearSessionEmail();
      applyLanguage('en'); applyTheme('light');   // guests always get the defaults
      closeDeleteAccount(); renderAuthArea(); if (typeof refreshFavUI === 'function') refreshFavUI();
      if (typeof applyFilters === 'function') applyFilters();
      showView('main'); toast('Your account has been deleted.');
    }).catch(function (ex) { closeDeleteAccount(); toast(ex.message); });
}

