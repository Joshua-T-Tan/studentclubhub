/* ============================================================
   profile.js — public user profiles, Saved-clubs lists, and the
   multi-tab Account Settings interface.
   ============================================================ */

var currentProfileName = null;

function clubsLedBy(name) {
  return CLUBS.filter(function (c) { return (c.leaders || []).some(function (l) { return l.name === name; }); });
}
function userRecordByName(name) {
  try { return Object.values(loadUsers()).find(function (u) { return u.name === name; }) || null; } catch (e) { return null; }
}

/* ============================================================
   PUBLIC PROFILE
   ============================================================ */
function openProfile(name) {
  if (!name) return;
  currentProfileName = name; closeClubModal(); renderProfile(name); showView('profile');
}
function renderProfileIfOpen() {
  if (currentProfileName && !$('view-profile').classList.contains('hidden')) renderProfile(currentProfileName);
}
function renderProfile(name) {
  var body = $('profileBody'); if (!body) return;
  var isSelf = !!(currentUser && currentUser.name === name);
  var rec = userRecordByName(name);
  var data = isSelf ? currentUser : (rec || {});
  var priv = isSelf ? !!currentUser.private : !!(rec && rec.private);
  var memberId = isSelf ? currentUser.memberId : (rec && rec.memberId) || '';
  var led = clubsLedBy(name);
  var ledLine = 'Leads ' + led.length + ' club' + (led.length === 1 ? '' : 's');

  // ----- Profile card (identity) -----
  var metaBits = [data.school, data.grad ? 'Class of ' + data.grad : ''].filter(Boolean);
  var identity;
  if (priv) {
    // Private: only Name, Member ID, and number of clubs led
    identity = '<p>' + (memberId ? 'Member ' + escHtml(memberId) + ' · ' : '') + ledLine + '</p>' +
      '<p class="form-note" style="margin-top:6px">🔒 This profile is private.</p>';
  } else {
    identity = (data.headline ? '<p style="color:var(--ink)">' + escHtml(data.headline) + '</p>' : '') +
      '<p>' + (memberId ? 'Member ' + escHtml(memberId) : '') + (metaBits.length ? ' · ' + metaBits.join(' · ') : '') + '</p>' +
      (data.bio ? '<p style="color:var(--muted);margin-top:6px">' + escHtml(data.bio) + '</p>' : '');
  }

  var html =
    '<div style="padding-top:16px"><button class="btn ghost" onclick="goHome()">← Back to directory</button></div>' +
    '<div class="profile-head">' + avatarHTML(name, 'lg') +
      '<div class="meta"><h1>' + escHtml(name) + '</h1>' + identity +
        (isSelf ? '<div class="profile-edit"><button class="btn ghost sm-btn" onclick="openSettings()">Edit Profile &amp; Settings</button></div>' : '') +
      '</div></div>';

  // ----- Club lists (hidden entirely when private) — Saved Clubs never shown here -----
  if (!priv) {
    if (isSelf) {
      var joined = currentUser.joined.map(getClub).filter(Boolean).filter(function (c) { return led.indexOf(c) === -1; });
      html += profileSection('Clubs Joined', joined, 'You haven’t joined any clubs yet.');
    }
    html += profileSection(isSelf ? 'Clubs Leading' : 'Clubs ' + name.split(' ')[0] + ' Leads', led,
      isSelf ? 'You don’t lead any clubs yet.' : 'No clubs listed.');
  }
  body.innerHTML = html;
}
function profileSection(title, clubs, emptyMsg) {
  var inner = clubs && clubs.length ? '<div class="grid">' + clubs.map(renderCard).join('') + '</div>'
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
      : '<div class="empty" style="grid-column:1/-1"><div class="big">📝</div><p>No drafts yet.</p>' +
        '<p class="form-note">Start a club and choose “Save as Draft” to keep it here.</p>' +
        '<div style="margin-top:14px"><button class="btn primary" onclick="showView(\'create\')">Start a Club</button></div></div>';
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
    if (q) { grid.innerHTML = emptyBlock('🔍', t('empty_search')); return; }
    var msg = myClubsView === 'joined' ? t('empty_joined') : t('empty_lead');
    var cta = myClubsView === 'joined'
      ? '<button class="btn primary" onclick="showView(\'browse\')">' + t('nav_browse') + '</button>'
      : '<button class="btn primary" onclick="showView(\'create\')">' + t('nav_create') + '</button>';
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">📋</div><p>' + escHtml(msg) + '</p>' +
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
  return '<article class="card draft-card"><div class="card-cover draft-cover">📝 Draft</div><div class="card-body">' +
    '<div class="card-title"><h3>' + escHtml(d.name || 'Untitled draft') + '</h3></div>' +
    '<div class="card-meta">Saved ' + escHtml(timeAgo(d.saved)) + (d.school ? ' · ' + escHtml(d.school) : '') + '</div>' +
    '<p class="card-desc">' + escHtml(d.desc || 'No description yet.') + '</p>' +
    '<div class="card-foot"><button class="btn primary" onclick="resumeDraft(\'' + d.id + '\')">' + t('draft_resume') + '</button>' +
    '<button class="btn danger" onclick="askDeleteDraft(\'' + d.id + '\')">' + t('draft_delete') + '</button></div></div></article>';
}
function askDeleteDraft(id) {
  openConfirm('Delete this draft?', 'This permanently removes the saved draft.', '🗑️', function () { deleteDraft(id); });
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
    : (q ? emptyBlock('🔍', t('empty_search'))
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
    '<div class="section-title">' + t('set_security') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('set_2fa_title') + '</div>' +
      '<div class="form-note">' + t('set_2fa_desc') + '</div></div>' +
      '<button class="switch ' + (u.twofa ? 'on' : '') + '" onclick="toggle2fa()"><span></span></button></div>' +
    '<div class="section-title">' + t('set_appearance') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('set_dark_title') + '</div>' +
      '<div class="form-note">' + t('set_dark_desc') + '</div></div>' +
      '<button class="switch ' + (getTheme() === 'dark' ? 'on' : '') + '" onclick="toggleTheme()"><span></span></button></div>' +
    '<div class="section-title">' + t('set_change_pw') + '</div>' +
    '<div class="field"><label>' + t('set_curpw') + ' *</label><input id="pwCurrent" type="password"></div>' +
    '<div class="two-col">' +
      '<div class="field"><label>' + t('set_newpw') + '</label><input id="pwNew" type="password"></div>' +
      '<div class="field"><label>' + t('set_confirmpw') + '</label><input id="pwConfirm" type="password"></div>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:6px">' +
      '<a href="#" class="link" onclick="openForgot();return false;">' + t('set_forgot') + '</a>' +
      '<button class="btn primary" onclick="doChangePassword()">' + t('set_update_pw') + '</button></div>' +
    '<div class="section-title">' + t('set_account') + '</div>' +
    '<div class="modal-actions"><button class="btn ghost" onclick="logout()">' + t('set_logout') + '</button>' +
      '<button class="btn danger" onclick="deleteAccount()">' + t('set_delete') + '</button></div>';
}
function toggle2fa() {
  currentUser.twofa = !currentUser.twofa; persistUser(); renderSettings();
  toast(currentUser.twofa ? 'Two-factor authentication enabled.' : 'Two-factor authentication disabled.');
}
function doChangePassword() {
  var cur = $('pwCurrent').value, nw = $('pwNew').value, cf = $('pwConfirm').value;
  if (!cur) return toast('Enter your current password.');
  if (cur !== currentUser.pass) return toast('Your current password is incorrect.');
  if (!nw || nw.length < 6) return toast('New password must be at least 6 characters.');
  if (nw !== cf) return toast('New passwords don’t match.');
  currentUser.pass = nw;
  var users = loadUsers(), key = currentUser.email.toLowerCase();
  if (users[key]) { users[key].pass = nw; saveUsers(users); }
  $('pwCurrent').value = ''; $('pwNew').value = ''; $('pwConfirm').value = '';
  toast('Your password has been updated.');
}
function openForgot() { $('forgotEmail').value = (currentUser && currentUser.email) || ''; openOverlay('forgotOverlay'); }
function closeForgot() { closeOverlay('forgotOverlay'); }
function submitForgot() {
  var e = ($('forgotEmail').value || '').trim();
  if (!e) return toast('Enter your email address.');
  closeForgot();
  toast('If an account exists for ' + e + ', a password reset link is on its way.');
}

/* Update the avatar in place — never re-render the whole Settings panel (keeps unsaved text). */
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
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader();
  r.onload = function (ev) {
    currentUser.avatar = ev.target.result; persistUser();
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
  persistUser(); renderAuthArea();
  if (currentUser.name !== oldName && typeof syncUserRename === 'function') syncUserRename(oldName, currentUser.name);
  if (typeof syncUserEverywhere === 'function') syncUserEverywhere();
  renderSettings(); toast('Your changes have been saved.');
}
function togglePrivacy() { currentUser.private = !currentUser.private; persistUser(); renderSettings(); toast(currentUser.private ? 'Profile is now private.' : 'Profile is now public.'); }
function toggleEmailNotif() { currentUser.emailNotif = (currentUser.emailNotif === false); persistUser(); renderSettings(); toast(currentUser.emailNotif ? 'Email notifications on.' : 'Email notifications off.'); }
function setLanguage(lang) { applyLanguage(lang); onLanguageChanged(); if (currentUser) { currentUser.lang = lang; persistUser(); } }
function deleteAccount() {
  openConfirm('Delete your account?', 'This permanently removes your account and saved data from this browser.', '⚠️', function () {
    var users = loadUsers(); delete users[currentUser.email.toLowerCase()]; saveUsers(users);
    currentUser = null; localStorage.removeItem(LS.session);
    renderAuthArea(); if (typeof refreshFavUI === 'function') refreshFavUI();
    showView('main'); toast('Your account has been deleted.');
  });
}
