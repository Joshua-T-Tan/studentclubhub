/* ============================================================
   modal.js — full-page Club Detail view (About / Manage tabs),
   member roster, socials, chat (edit/delete/permissions),
   owner transfer/delete flows, reviews (member-only), lightbox,
   contact, confirm dialog.
   ============================================================ */

var currentClubId = null;
var currentManageClubId = null;   // set while the Manage tab is active (for link add/remove auto-save)
var currentClubTab = 'about';
var clubReturnView = 'browse';

var ICON_MAIL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
var ICON_STAR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
var OFFICER_ROLES = ['President', 'Vice President', 'Secretary', 'Treasurer', 'Member'];
var ROLE_RANK = { 'President': 0, 'Vice President': 1, 'Secretary': 2, 'Treasurer': 3, 'Member': 4 };
var ICON_ROLE = '🔁';

/* ---------- Relationship helpers ---------- */
function ownerOf(club) { return !!(currentUser && club && club.verifiedOwner && club.verifiedOwner === currentUser.memberId); }
function isClubMember(club) { return ownerOf(club) || (currentUser && club && currentUser.joined.indexOf(club.id) !== -1); }
function myRosterEntry(club) {
  if (!currentUser || !club.roster) return null;
  return club.roster.find(function (m) { return (m.memberId && m.memberId === currentUser.memberId) || m.name === currentUser.name; }) || null;
}
function roleInClub(club) {
  if (ownerOf(club)) { var e = myRosterEntry(club); return (e && e.role) || 'President'; }
  var m = myRosterEntry(club); if (m) return m.role || 'Member';
  return isClubMember(club) ? 'Member' : null;
}
function isOfficerRole(role) { return !!role && role !== 'Member'; }
function canPostChat(club) {
  if (isBanned(club)) return false;                        // banned accounts can't dispatch messages
  if (!isClubMember(club)) return false;
  if (club.chatAccess === 'officers') return ownerOf(club) || isOfficerRole(roleInClub(club));
  return true;
}

/* ============================================================
   FULL-PAGE CLUB DETAIL
   ============================================================ */
function openClub(clubId) {
  var club = getClub(clubId); if (!club) return;
  if (isBanned(club)) { toast('You have been banned from this club and can no longer view it.'); return; }
  var cur = (typeof currentViewName === 'function') ? currentViewName() : 'browse';
  if (cur !== 'club') clubReturnView = cur;
  currentClubId = clubId; currentClubTab = 'about';
  renderClub(); showView('club');
}
function openClubModal(id) { openClub(id); }             // backward-compatible alias
function closeClubModal() { backFromClub(); }
function backFromClub() { showView(clubReturnView || 'browse'); }
function switchClubTab(tab) { currentClubTab = tab; renderClub(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function refreshClubModalState() { if (currentClubId && !$('view-club').classList.contains('hidden')) renderClub(); }

function currentViewName() { return VIEWS.find(function (v) { return !$('view-' + v).classList.contains('hidden'); }) || 'main'; }

function renderClub() {
  var club = getClub(currentClubId); if (!club) return;
  var owner = ownerOf(club), member = isClubMember(club), role = roleInClub(club);
  var relBadge = owner ? renderBadge(t('you_pres'), 'join') : (member ? renderBadge('You: ' + role, 'join') : '');

  var tabs = owner
    ? '<div class="club-tabs">' + tabBtn('about', t('tab_about')) + tabBtn('manage', t('tab_manage')) + '</div>'
    : '';

  var inManage = (currentClubTab === 'manage' && owner);
  currentManageClubId = inManage ? club.id : null;
  var content = inManage ? renderManageTab(club) : renderAboutTab(club);

  $('clubBody').innerHTML =
    '<button class="back-pill" onclick="backFromClub()">' + t('back') + '</button>' +
    '<div class="club-page">' +
      '<div class="club-hero" style="' + coverStyle(club) + '">' +
        '<button class="banner-star ' + (isFavorite(club.id) ? 'on' : '') + '" title="' + escAttr(isFavorite(club.id) ? t('card_saved') : t('save_club')) + '" onclick="toggleFavorite(\'' + club.id + '\')">' + starSvg(isFavorite(club.id)) + '</button>' +
        '<button class="share-pill" title="' + escAttr(t('share_club')) + '" onclick="openShare(\'' + club.id + '\')">🔗 ' + t('share_club') + '</button>' +
      '</div>' +
      '<div class="club-head">' +
        '<h2>' + escHtml(club.name) + '</h2>' +
        '<div class="sub">' + escHtml(club.category) + ' · ' + escHtml(club.school) + (club.zip ? ' · ' + escHtml(club.zip) : '') +
          (club.clubId ? ' · <span class="club-id-chip">#' + escHtml(club.clubId) + '</span>' : '') + '</div>' +
        '<div class="chips">' + recruitBadge(club.recruitment) + renderBadge((club.memberCount || 0) + ' members', 'gray') + relBadge + '</div>' +
      '</div>' + tabs +
      '<div class="club-content">' + content + '</div>' +
    '</div>';
}
function tabBtn(id, label) { return '<button class="club-tab ' + (currentClubTab === id ? 'active' : '') + '" onclick="switchClubTab(\'' + id + '\')">' + label + '</button>'; }

/* Save Club / Saved text button — available to everyone (guest, member, owner) */
function saveClubBtn(club) {
  var saved = isFavorite(club.id);
  return '<button class="fav-btn ' + (saved ? 'on' : '') + '" onclick="toggleFavorite(\'' + club.id + '\')">' +
    starSvg(saved) + (saved ? t('card_saved') : t('save_club')) + '</button>';
}
/* ---------- ABOUT ---------- */
function renderAboutTab(club) {
  var owner = ownerOf(club), member = isClubMember(club);
  // Guests: [Join · Contact · Save] at the TOP (between header and About).
  // Members: [Leave · Contact · Save] at the BOTTOM (between roster and reviews).
  // Owners: just [Save] at the bottom (they manage via the Manage tab).
  var topActions = '', bottomActions = '';
  if (owner) {
    bottomActions = '<div class="modal-actions">' + saveClubBtn(club) + '</div>';
  } else if (member) {
    bottomActions = '<div class="modal-actions"><button class="btn ghost" onclick="toggleJoin(\'' + club.id + '\')">' + t('club_leave') + '</button>' +
      '<button class="btn primary" onclick="openContact(\'' + club.id + '\')">' + ICON_MAIL + ' ' + t('club_contact') + '</button>' +
      saveClubBtn(club) + '</div>';
  } else {
    topActions = '<div class="modal-actions"><button class="btn join" onclick="toggleJoin(\'' + club.id + '\')">' + t('club_join') + '</button>' +
      '<button class="btn primary" onclick="openContact(\'' + club.id + '\')">' + ICON_MAIL + ' ' + t('club_contact') + '</button>' +
      saveClubBtn(club) + '</div>';
  }

  var galleryHTML = '';
  if (club.gallery && club.gallery.length) {
    galleryHTML = '<div class="section-title">' + t('sec_gallery') + '</div><div class="gallery">' +
      club.gallery.map(function (src, i) {
        var media = isVideoSrc(src) ? '<video src="' + src + '" muted></video>' : '<img src="' + src + '" alt="">';
        return '<div class="thumb" onclick="openLightbox(\'' + club.id + '\',' + i + ')">' + media + '</div>';
      }).join('') + '</div>';
  }

  return topActions +
    socialsPublicHTML(club) +
    '<div class="section-title">' + t('sec_about') + '</div><p style="color:var(--muted)">' + escHtml(club.desc) + '</p>' +
    '<div class="section-title">' + t('sec_details') + '</div>' +
    infoLine('Meets', club.meeting || 'TBD') + infoLine('School', club.school) +
    (club.district ? infoLine('District', club.district) : '') + (club.zip ? infoLine('Zip', club.zip) : '') +
    ((club.tags || []).length ? '<div class="chips" style="margin-top:6px">' + club.tags.map(function (t) { return '<span class="tag">#' + escHtml(t) + '</span>'; }).join('') + '</div>' : '') +
    galleryHTML +
    chatHTML(club) +
    rosterHTML(club) +
    bottomActions +
    reviewsSectionHTML(club);
}
function infoLine(k, v) { return '<div class="info-line"><span class="k">' + escHtml(k) + '</span><span>' + escHtml(v) + '</span></div>'; }

/* ---------- Member roster (officers ranked, members alphabetical) ---------- */
function sortedRoster(club) {
  return (club.roster || []).slice().sort(function (a, b) {
    var ra = ROLE_RANK[a.role] == null ? 5 : ROLE_RANK[a.role];
    var rb = ROLE_RANK[b.role] == null ? 5 : ROLE_RANK[b.role];
    if (ra !== rb) return ra - rb;
    return (a.name || '').localeCompare(b.name || '');
  });
}
function rosterHTML(club) {
  var list = sortedRoster(club);
  if (!list.length) return '';
  var title = '<div class="section-title">' + t('sec_members') + ' (' + list.length + ')</div>';
  // Non-members can't see the roster
  if (!isClubMember(club)) {
    return title + '<p class="chat-locked form-note">🔒 ' + t('roster_gated') + '</p>';
  }
  // Members: show up to 5 by default (President, VP, Secretary, Treasurer, top alphabetical member),
  // with an inline search that reveals the full roster.
  var search = '<div class="search" style="margin-bottom:10px"><span class="ico">⌕</span>' +
    '<input id="rosterSearch" type="text" placeholder="' + escAttr(t('roster_search_ph')) + '" oninput="filterRoster()"></div>';
  var rows = list.map(function (m, i) {
    var badge = isOfficerRole(m.role) ? '<span class="badge">' + escHtml(m.role) + '</span>' : '<span class="badge gray">Member</span>';
    var q = (m.name + ' ' + (m.role || '')).toLowerCase();
    return '<button class="leader-row roster-item" data-q="' + escAttr(q) + '"' + (i >= 5 ? ' style="display:none"' : '') +
      ' onclick="openProfile(\'' + escAttr(m.name) + '\')">' + avatarHTML(m.name, 'sm') +
      '<div class="who"><div class="n">' + escHtml(m.name) + '</div></div>' + badge + '</button>';
  }).join('');
  var more = list.length > 5 ? '<p class="form-note" id="rosterMore" style="margin-top:6px">Showing 5 of ' + list.length + ' — search to find more.</p>' : '';
  return title + search + '<div id="rosterList">' + rows + '</div>' + more;
}
function filterRoster() {
  var q = ($('rosterSearch') && $('rosterSearch').value || '').trim().toLowerCase();
  var items = document.querySelectorAll('#rosterList .roster-item'), more = $('rosterMore');
  if (!q) { Array.prototype.forEach.call(items, function (el, i) { el.style.display = i < 5 ? '' : 'none'; }); if (more) more.style.display = ''; return; }
  Array.prototype.forEach.call(items, function (el) { el.style.display = el.getAttribute('data-q').indexOf(q) > -1 ? '' : 'none'; });
  if (more) more.style.display = 'none';
}

/* ---------- Social links (public) ---------- */
function socialsPublicHTML(club) {
  var links = (club.socials || []).filter(Boolean);
  var pills = links.map(function (u) {
    return '<a class="social-pill" href="' + escAttr(normalizeUrl(u)) + '" target="_blank" rel="noopener">🔗 ' + escHtml(hostLabel(u)) + '</a>';
  }).join('');
  return pills ? '<div class="socials">' + pills + '</div>' : '';
}
function normalizeUrl(u) { return /^https?:\/\//i.test(u) ? u : 'https://' + u; }
function hostLabel(u) {
  try { return normalizeUrl(u).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]; } catch (e) { return 'Link'; }
}

/* ---------- Share Club modal (direct link + QR code) ---------- */
var shareClubObj = null;
function openShare(clubId) {
  var club = getClub(clubId); if (!club) return;
  shareClubObj = club;
  var link = clubDirectLink(club);
  var qr = (typeof qrSvg === 'function') ? qrSvg(link, 190) : '';
  $('shareBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">' + t('share_club') + '</h3>' +
      '<button class="icon-btn" onclick="closeShare()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:14px">' + t('share_instr') + '</p>' +
    '<div class="field"><label>' + t('share_direct') + '</label>' +
      '<div class="share-link-row"><input id="shareLinkInput" type="text" readonly value="' + escAttr(link) + '">' +
      '<button class="btn primary sm-btn" onclick="copyShareLink()">' + t('copy_link') + '</button></div></div>' +
    '<div class="qr-wrap"><div class="qr-box">' + (qr || '<p class="form-note">Link is too long for a QR code — use the link above.</p>') + '</div>' +
      '<p class="form-note" style="text-align:center;margin-top:6px">' + t('share_qr') + '</p></div>';
  openOverlay('shareOverlay');
}
function closeShare() { closeOverlay('shareOverlay'); }
function copyShareLink() {
  if (!shareClubObj) return;
  var link = clubDirectLink(shareClubObj), input = $('shareLinkInput');
  try {
    if (navigator.clipboard) navigator.clipboard.writeText(link);
    else { input.select(); document.execCommand('copy'); }
    toast(t('link_copied') || 'Link copied!');
  } catch (e) { if (input) input.select(); }
}

/* ============================================================
   CHAT & ANNOUNCEMENTS (embedded in About)
   ============================================================ */
function loadChat() { try { return JSON.parse(localStorage.getItem('sch_chat')) || {}; } catch (e) { return {}; } }
function saveChat(c) { localStorage.setItem('sch_chat', JSON.stringify(c)); }
function chatHTML(club) {
  var all = loadChat()[club.id] || [];
  var member = isClubMember(club);
  var feed = all.length ? all.map(function (m, i) {
    if (m.system) return '<div class="chat-system">🤖 <strong>System Notification</strong>: ' + escHtml(m.text) + '</div>';
    if (m.deleted) return '<div class="chat-msg"><div class="avatar sm">·</div><div class="cm-body deleted"><em>This message was deleted</em></div></div>';
    var own = currentUser && ((m.memberId && m.memberId === currentUser.memberId) || m.who === currentUser.name);
    var ctrls = own ? '<span class="cm-ctrls"><button onclick="editChat(\'' + club.id + '\',' + i + ')">Edit</button>' +
      '<button onclick="deleteChat(\'' + club.id + '\',' + i + ')">Delete</button></span>' : '';
    return '<div class="chat-msg ' + (m.announce ? 'announce' : '') + '">' + avatarHTML(m.who, 'sm') +
      '<div class="cm-body"><div class="cm-top"><span class="cm-who">' + escHtml(m.who) + '</span>' +
      (m.announce ? '<span class="badge">📣 Announcement</span>' : '') +
      '<span class="cm-time">' + fmtTime(m.ts) + (m.edited ? ' · (edited)' : '') + '</span></div>' +
      '<div class="cm-text">' + escHtml(m.text) + '</div>' + ctrls + '</div></div>';
  }).join('') : '<p class="form-note" style="text-align:center;padding:14px">No messages yet.</p>';

  var compose;
  if (canPostChat(club)) {
    var canAnnounce = ownerOf(club) || isOfficerRole(roleInClub(club));
    compose = '<div class="chat-compose">' +
      '<input id="chatInput" type="text" placeholder="Message the club..." onkeydown="if(event.key===\'Enter\')postChat(\'' + club.id + '\')">' +
      (canAnnounce ? '<label class="chat-ann" title="Post as announcement"><input type="checkbox" id="chatAnnounce"> 📣</label>' : '') +
      '<button class="btn primary" onclick="postChat(\'' + club.id + '\')">Send</button></div>';
  } else if (member) {
    compose = '<p class="form-note chat-locked">🔒 Only officers can post in this chat.</p>';
  } else {
    compose = '<p class="form-note chat-locked">Join this club to see and post messages.</p>';
  }

  return '<div class="section-title">' + t('sec_chat') + '</div>' +
    (member ? '<div class="chat-feed">' + feed + '</div>' + compose
            : '<p class="form-note chat-locked">Join this club to view the chat.</p>');
}
function postChat(clubId) {
  var club = getClub(clubId); if (!club || !canPostChat(club)) return;
  var input = $('chatInput'); var text = (input.value || '').trim(); if (!text) return;
  var announce = (ownerOf(club) || isOfficerRole(roleInClub(club))) && $('chatAnnounce') && $('chatAnnounce').checked;
  var all = loadChat(); (all[clubId] = all[clubId] || []).push({ who: currentUser.name, memberId: currentUser.memberId, text: text, ts: Date.now(), announce: !!announce });
  saveChat(all); renderClub();
  var feed = document.querySelector('.chat-feed'); if (feed) feed.scrollTop = feed.scrollHeight;
}
function editChat(clubId, i) {
  var all = loadChat(); var m = all[clubId] && all[clubId][i]; if (!m) return;
  var own = currentUser && ((m.memberId && m.memberId === currentUser.memberId) || m.who === currentUser.name); if (!own) return;
  var next = window.prompt('Edit your message:', m.text); if (next == null) return;
  next = next.trim(); if (!next) return;
  m.text = next; m.edited = true; saveChat(all); renderClub();
}
function deleteChat(clubId, i) {
  var all = loadChat(); var m = all[clubId] && all[clubId][i]; if (!m) return;
  var own = currentUser && ((m.memberId && m.memberId === currentUser.memberId) || m.who === currentUser.name); if (!own) return;
  openConfirm('Delete message?', 'This message will be removed for everyone.', '🗑️', function () {
    m.deleted = true; m.text = ''; saveChat(all); renderClub();
  });
}
function fmtTime(ts) { try { return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch (e) { return ''; } }

/* ============================================================
   MANAGE TAB (owner)
   ============================================================ */
function emailForMember(club, m) {
  var l = (club.leaders || []).find(function (x) { return x.name === m.name; }); if (l && l.email) return l.email;
  if (m.memberId) { try { var u = Object.values(loadUsers()).find(function (x) { return x.memberId === m.memberId; }); if (u) return u.email; } catch (e) {} }
  return '';
}
function renderManageTab(club) {
  var roleOpts = function (cur) { return OFFICER_ROLES.map(function (r) { return '<option' + (r === cur ? ' selected' : '') + '>' + r + '</option>'; }).join(''); };
  var otherCount = club.roster.filter(function (x) { return x.name !== currentUser.name; }).length;
  var roster = sortedRoster(club).map(function (m) {
    var idx = club.roster.indexOf(m);
    var isMe = m.name === currentUser.name;
    var lockSelf = isMe && m.role === 'President';        // a President can't directly change their own role
    var q = (m.name + ' ' + emailForMember(club, m)).toLowerCase();
    var sel = lockSelf
      ? '<select disabled title="A club must always have a President">' + roleOpts(m.role) + '</select>'
      : '<select onchange="requestRoleChange(\'' + club.id + '\',' + idx + ',this.value)">' + roleOpts(m.role) + '</select>';
    var modActions = isMe ? '' :
      '<button class="btn ghost sm-btn" onclick="removeMember(\'' + club.id + '\',' + idx + ')">' + t('mod_remove_label') + '</button>' +
      '<button class="btn danger sm-btn" onclick="banMember(\'' + club.id + '\',' + idx + ')">' + t('mod_ban_label') + '</button>';
    var item = '<div class="roster-item" data-q="' + escAttr(q) + '"><div class="roster-row">' + avatarHTML(m.name, 'sm') +
      '<div class="who"><div class="n">' + escHtml(m.name) + (m.role === 'President' ? ' <span class="badge">President</span>' : '') + '</div></div>' +
      sel + modActions + '</div>';
    // Sole-President inline notice (the only role note we keep)
    if (lockSelf && otherCount === 0) {
      item += '<div class="role-lock">You cannot change your role because a club must have a President, and there are no other members to transfer leadership to.</div>';
    }
    return item + '</div>';
  }).join('') || '<p class="form-note">No members yet.</p>';

  var bannerBlock = (club.banner
    ? '<div class="banner-preview has-img"><img src="' + club.banner + '" alt="banner"><button class="mini-x" title="' + escAttr(t('mg_remove_banner')) + '" onclick="mgRemoveBanner(\'' + club.id + '\')">✕</button></div>'
    : '') +
    '<label class="uploader"><input type="file" accept="image/*" hidden onchange="mgBannerUpload(\'' + club.id + '\',event)"><span class="up-ico">⬆</span> ' + escHtml(t('mg_banner_drop')) + '</label>';
  var linkRows = ((club.socials && club.socials.length) ? club.socials : ['']).map(linkInputRow).join('');

  return (
    // 1) Title, Description & Details
    '<div class="section-title">' + t('mg_details') + '</div>' +
    '<div class="field"><label>' + t('mg_title') + '</label><input id="mgTitle" type="text" value="' + escAttr(club.name) + '" oninput="mgAutoSave(\'' + club.id + '\')"></div>' +
    '<div class="field"><label>' + t('mg_desc') + '</label><textarea id="mgDesc" oninput="mgAutoSave(\'' + club.id + '\')">' + escHtml(club.desc) + '</textarea></div>' +
    '<div class="field"><label>' + t('mg_meeting') + '</label><input id="mgMeeting" type="text" value="' + escAttr(club.meeting || '') + '" oninput="mgAutoSave(\'' + club.id + '\')"></div>' +
    // 2) Banners, Gallery & Social Links
    '<div class="section-title">' + t('mg_media_h') + '</div>' +
    '<div class="field"><label>' + t('mg_banner') + '</label>' + bannerBlock + '</div>' +
    '<div class="field"><label>' + t('mg_gallery') + '</label><label class="btn ghost sm-btn">' + t('mg_upload') + '<input type="file" accept="image/*,video/*" multiple hidden onchange="mgAddGallery(\'' + club.id + '\',event)"></label>' +
      '<div class="gallery" style="margin-top:10px">' + (club.gallery || []).map(function (src, i) {
        var media = isVideoSrc(src) ? '<video src="' + src + '" muted></video>' : '<img src="' + src + '" alt="">';
        return '<div class="thumb">' + media + '<button class="mini-x" onclick="mgRemoveGallery(\'' + club.id + '\',' + i + ')">✕</button></div>';
      }).join('') + '</div></div>' +
    '<div class="field"><label>' + t('mg_social') + '</label><div id="mgLinks" oninput="mgAutoSave(\'' + club.id + '\')">' + linkRows + '</div>' +
      '<button class="btn ghost sm-btn" type="button" onclick="addLinkRow()">' + t('mg_addlink') + '</button></div>' +
    // 3) Chat permissions
    '<div class="section-title">' + t('mg_chat_h') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('mg_chat_allow') + '</div><div class="form-note">' + t('mg_chat_note') + '</div></div>' +
      '<button id="mgChatSwitch" class="switch ' + (club.chatAccess !== 'officers' ? 'on' : '') + '" onclick="mgToggleChat(\'' + club.id + '\')"><span></span></button></div>' +
    // 4) Members & Roles (with search)
    '<div class="section-title">' + t('mg_members_h') + '</div>' +
    '<div class="search" style="margin-bottom:12px"><span class="ico">⌕</span><input id="mgMemberSearch" type="text" placeholder="' + escAttr(t('mg_member_search_ph')) + '" oninput="filterMembers()"></div>' +
    '<div class="roster" id="mgRoster">' + roster + '</div>' +
    // Banned Users
    bannedSectionHTML(club) +
    // Club Privacy Status toggle (below Banned Users, above Save Changes)
    '<div class="section-title">' + t('mg_privacy_h') + '</div>' +
    '<div class="toggle-row"><div><div class="tr-title">' + t('mg_privacy_title') + '</div>' +
      '<div class="form-note">' + t('mg_privacy_desc') + '</div></div>' +
      '<button id="mgPrivacySwitch" class="switch ' + (club.recruitment === 'Private' ? 'on' : '') + '" onclick="mgTogglePrivacy(\'' + club.id + '\')"><span></span></button></div>' +
    // Changes auto-save as you type/toggle — a small status line replaces the manual button.
    '<p class="form-note mg-autosave" style="text-align:center;margin-top:14px">' + t('mg_autosaved') + '</p>' +
    // Danger Zone
    '<div class="section-title">' + t('mg_danger') + '</div>' +
    '<div class="danger-zone"><button class="btn ghost" onclick="leaveClubFlow(\'' + club.id + '\')">' + t('mg_leave') + '</button>' +
      '<button class="btn danger" onclick="deleteClub(\'' + club.id + '\')">' + t('mg_delete') + '</button></div>'
  );
}
function filterMembers() {
  var q = ($('mgMemberSearch') && $('mgMemberSearch').value || '').trim().toLowerCase();
  document.querySelectorAll('#mgRoster .roster-item').forEach(function (el) {
    el.style.display = (!q || (el.getAttribute('data-q') || '').indexOf(q) !== -1) ? '' : 'none';
  });
}
function linkInputRow(url) {
  return '<div class="link-row"><input class="mg-link" type="url" placeholder="Link (Optional)" value="' + escAttr(url || '') + '">' +
    '<button class="mini-x-inline" type="button" title="Remove" onclick="this.parentElement.remove(); mgLinksChanged()">✕</button></div>';
}
function addLinkRow() { var w = $('mgLinks'); if (w) { w.insertAdjacentHTML('beforeend', linkInputRow('')); mgLinksChanged(); } }
function mgLinksChanged() { if (currentManageClubId) mgAutoSave(currentManageClubId, true); }

/* ---- Auto-save Manage inputs (debounced, no full re-render so focus/scroll are kept) ---- */
var _mgSaveTimer = null;
function mgAutoSave(clubId, immediate) {
  clearTimeout(_mgSaveTimer);
  var run = function () {
    var club = getClub(clubId); if (!club || !ownerOf(club)) return;
    if ($('mgTitle')) club.name = $('mgTitle').value.trim() || club.name;
    if ($('mgDesc')) club.desc = $('mgDesc').value.trim() || club.desc;
    if ($('mgMeeting')) club.meeting = $('mgMeeting').value.trim() || club.meeting;
    club.socials = Array.prototype.map.call(document.querySelectorAll('#mgLinks .mg-link'), function (el) { return el.value.trim(); }).filter(Boolean);
    saveUserClubs(); applyFilters(); renderTopClubs();      // refresh cards, but DON'T renderClub (keeps focus)
    var s = document.querySelector('.mg-autosave'); if (s) { s.textContent = t('mg_saved_note'); setTimeout(function () { if (document.querySelector('.mg-autosave')) document.querySelector('.mg-autosave').textContent = t('mg_autosaved'); }, 1200); }
  };
  if (immediate) run(); else _mgSaveTimer = setTimeout(run, 400);
}
/* Public/Private toggle — persists immediately (keeps scroll position) */
function mgTogglePrivacy(clubId) {
  var c = getClub(clubId); if (!c || !ownerOf(c)) return;
  c.recruitment = (c.recruitment === 'Private') ? 'Public' : 'Private';
  saveUserClubs(); applyFilters(); renderTopClubs();
  var el = $('mgPrivacySwitch'); if (el) el.classList.toggle('on', c.recruitment === 'Private');
  toast(c.recruitment === 'Private' ? 'Club is now Private.' : 'Club is now Public.');
}
/* Chat permission toggle — persists immediately without a full re-render (keeps scroll position) */
function mgToggleChat(clubId) {
  var c = getClub(clubId); if (!c || !ownerOf(c)) return;
  c.chatAccess = (c.chatAccess === 'officers') ? 'all' : 'officers';
  saveUserClubs();
  var el = $('mgChatSwitch'); if (el) el.classList.toggle('on', c.chatAccess !== 'officers');
}
function mgBannerUpload(clubId, e) {
  var club = getClub(clubId); if (!club) return;
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader(); r.onload = function (ev) { club.banner = ev.target.result; saveUserClubs(); applyFilters(); renderTopClubs(); renderClub(); }; r.readAsDataURL(f);
  e.target.value = '';
}
function mgRemoveBanner(clubId) { var c = getClub(clubId); if (c) { c.banner = ''; saveUserClubs(); applyFilters(); renderTopClubs(); renderClub(); } }
function mgAddGallery(clubId, e) {
  var club = getClub(clubId); if (!club) return;
  Array.prototype.forEach.call(e.target.files, function (f) {
    var r = new FileReader(); r.onload = function (ev) { (club.gallery = club.gallery || []).push(ev.target.result); saveUserClubs(); renderClub(); }; r.readAsDataURL(f);
  });
  e.target.value = '';
}
function mgRemoveGallery(clubId, i) { var c = getClub(clubId); if (c) { c.gallery.splice(i, 1); saveUserClubs(); renderClub(); } }

/* Role change with confirmation + President-always-exists rule + presidency swap */
function requestRoleChange(clubId, idx, newRole) {
  var club = getClub(clubId); if (!club) return;
  var m = club.roster[idx]; if (!m || m.role === newRole) return;
  var meEntry = myRosterEntry(club);
  var presName = currentUser.name;
  // Promoting someone else to President = transfer presidency (current President reverts to Member;
  // the promoted member's former role, e.g. Treasurer, opens up).
  if (newRole === 'President') {
    if (m === meEntry) { renderClub(); return; }
    openConfirm('Transfer Club Presidency?',
      'Are you sure you want to appoint ' + m.name + ' as President? Upon confirmation, ' + m.name +
      ' will become the new President, and your role will automatically revert to a regular Member. You will transfer all executive leadership privileges.',
      '👑', function () {
        if (meEntry) meEntry.role = 'Member';
        m.role = 'President'; club.verifiedOwner = m.memberId || null;
        if (!ownerOf(club)) currentClubTab = 'about';
        postSystemChat(club.id, m.name + ' has been appointed as President by ' + presName + '.');
        saveUserClubs(); renderClub(); toast(m.name + ' is now President.');
      }, 'Confirm Leadership Transfer');
    renderClub(); return;                                  // revert the <select> until confirmed
  }
  // The sitting President cannot demote themselves — a club must keep a President
  if (m === meEntry && ownerOf(club)) {
    toast('A club must always have a President. Assign another member as President to step down.');
    renderClub(); return;
  }
  openConfirm(t('role_assign_h'), t('role_appoint_pre') + m.name + t('role_appoint_mid') + newRole + '?', ICON_ROLE, function () {
    m.role = newRole; postSystemChat(club.id, m.name + ' has been appointed as ' + newRole + ' by ' + presName + '.');
    saveUserClubs(); renderClub(); toast(m.name + ' → ' + newRole);
  }, t('role_assign_confirm'));
  renderClub();
}
/* Automated bot notification posted into the club chat on leadership changes */
function postSystemChat(clubId, text) {
  var all = loadChat(); (all[clubId] = all[clubId] || []).push({ who: 'System', system: true, text: text, ts: Date.now() });
  saveChat(all);
}
function removeMember(clubId, i) {
  var c = getClub(clubId); if (!c || !c.roster[i]) return;
  var name = c.roster[i].name;
  openConfirm(t('mod_remove_h'), t('mod_remove_pre') + name + t('mod_remove_post'), '🚫', function () {
    c.roster.splice(i, 1); c.memberCount = Math.max(0, (c.memberCount || 1) - 1);
    saveUserClubs(); renderClub(); toast(name + ' removed.');
  }, t('mod_remove_btn'));
}
/* Ban: remove from roster AND record the member's id/email so they can never rejoin. */
function banMember(clubId, i) {
  var c = getClub(clubId); if (!c || !c.roster[i]) return;
  var m = c.roster[i], name = m.name;
  openConfirm(t('mod_ban_h'), t('mod_ban_pre') + name + t('mod_ban_post'), '🚫', function () {
    c.banned_members = c.banned_members || [];
    var key = (m.memberId || emailForMember(c, m) || name);
    if (c.banned_members.indexOf(key) === -1) c.banned_members.push(key);
    c.roster.splice(i, 1); c.memberCount = Math.max(0, (c.memberCount || 1) - 1);
    // Immediately revoke the banned member's membership in their own account record
    try {
      var users = loadUsers(), changed = false;
      Object.keys(users).forEach(function (em) {
        var u = users[em];
        if (u.memberId === key || em === key) {
          var j = (u.joined || []).indexOf(clubId); if (j > -1) { u.joined.splice(j, 1); changed = true; }
        }
      });
      if (changed) saveUsers(users);
    } catch (e) {}
    saveUserClubs(); renderClub(); toast(name + ' has been banned.');
  }, t('mod_ban_btn'));
}
/* Is the current user banned from this club? (checked by member ID or email) */
function isBanned(club) {
  if (!currentUser || !club.banned_members) return false;
  return club.banned_members.indexOf(currentUser.memberId) !== -1 ||
    club.banned_members.indexOf((currentUser.email || '').toLowerCase()) !== -1;
}
/* Resolve a banned key (member ID or email) to a readable "Name · id/email" label. */
function bannedLabel(key) {
  try {
    var u = Object.values(loadUsers()).find(function (x) { return x.memberId === key || (x.email || '').toLowerCase() === key; });
    if (u) return u.name + ' · ' + (u.memberId || u.email);
  } catch (e) {}
  return key;
}
/* Manage → Banned Users section (with Unban) */
function bannedSectionHTML(club) {
  var banned = club.banned_members || [];
  var rows = banned.length ? banned.map(function (key, i) {
    return '<div class="roster-row"><div class="who"><div class="n">' + escHtml(bannedLabel(key)) + '</div></div>' +
      '<button class="btn ghost sm-btn" onclick="unbanMember(\'' + club.id + '\',' + i + ')">' + t('mod_unban_label') + '</button></div>';
  }).join('') : '<p class="form-note">' + t('mod_no_banned') + '</p>';
  return '<div class="section-title">' + t('mod_banned_h') + '</div><div class="roster">' + rows + '</div>';
}
function unbanMember(clubId, i) {
  var c = getClub(clubId); if (!c || !c.banned_members || i < 0 || i >= c.banned_members.length) return;
  var key = c.banned_members[i]; c.banned_members.splice(i, 1);
  saveUserClubs(); renderClub(); toast(bannedLabel(key).split(' · ')[0] + ' has been unbanned.');
}
/* Owner leaving must first designate a new President */
function leaveClubFlow(clubId) {
  var club = getClub(clubId); if (!club) return;
  if (!ownerOf(club)) { return toggleJoin(clubId); }
  var others = sortedRoster(club).filter(function (m) { return m.name !== currentUser.name; });
  if (!others.length) { return toast('You’re the only member — use “Delete club” instead.'); }
  openTransfer(clubId);
}

/* ---------- Transfer ownership / delete ---------- */
function openTransfer(clubId) {
  var club = getClub(clubId); if (!club || !ownerOf(club)) return;
  var candidates = sortedRoster(club).filter(function (m) { return m.name !== currentUser.name; });
  if (!candidates.length) {
    $('transferBody').innerHTML = '<h3 style="font-size:1.15rem;font-weight:800;margin-bottom:8px">You’re the only member</h3>' +
      '<p class="form-note" style="margin-bottom:16px">A club must always have a President, so you can’t leave as the sole member. Use “Delete club” instead.</p>' +
      '<button class="btn primary block" onclick="closeTransfer()">Got it</button>';
    openOverlay('transferOverlay'); return;
  }
  var opts = candidates.map(function (m, i) {
    return '<label class="pick-row"><input type="radio" name="xfer" value="' + escAttr(m.name) + '"' + (i === 0 ? ' checked' : '') + '> ' +
      escHtml(m.name) + ' <span class="badge">' + escHtml(m.role) + '</span></label>';
  }).join('');
  $('transferBody').innerHTML = '<h3 style="font-size:1.15rem;font-weight:800;margin-bottom:6px">Choose a new President</h3>' +
    '<p class="form-note" style="margin-bottom:14px">Before leaving, hand leadership to another member. They become President and you’ll leave the club.</p>' +
    '<div class="pick-list">' + opts + '</div>' +
    '<div class="row" style="display:flex;gap:10px;margin-top:16px"><button class="btn ghost" style="flex:1" onclick="closeTransfer()">Cancel</button>' +
    '<button class="btn primary" style="flex:1" onclick="confirmTransfer(\'' + clubId + '\')">Continue</button></div>';
  openOverlay('transferOverlay');
}
function closeTransfer() { closeOverlay('transferOverlay'); }
function confirmTransfer(clubId) {
  var picked = document.querySelector('input[name="xfer"]:checked'); if (!picked) return;
  var name = picked.value;
  closeTransfer();
  openConfirm('Transfer to ' + name + '?', 'They become President and you’ll leave the club. This can’t be undone here.', '👑', function () {
    var club = getClub(clubId); if (!club) return;
    var newOwner = club.roster.find(function (m) { return m.name === name; }); if (!newOwner) return;
    newOwner.role = 'President'; club.verifiedOwner = newOwner.memberId || null;
    // Old owner leaves
    var meIdx = club.roster.indexOf(myRosterEntry(club)); if (meIdx > -1) club.roster.splice(meIdx, 1);
    var j = currentUser.joined.indexOf(clubId); if (j > -1) currentUser.joined.splice(j, 1);
    club.memberCount = Math.max(0, (club.memberCount || 1) - 1);
    persistUser(); saveUserClubs();
    toast('Ownership transferred to ' + name + '.');
    showView('myclubs');
  });
}
function deleteClub(clubId) {
  var club = getClub(clubId); if (!club || !ownerOf(club)) return;
  openConfirm('Delete “' + club.name + '”?', 'This permanently removes the club and its listing. This cannot be undone.', '⚠️', function () {
    var i = CLUBS.indexOf(club); if (i > -1) CLUBS.splice(i, 1);
    var j = currentUser.joined.indexOf(clubId); if (j > -1) currentUser.joined.splice(j, 1);
    persistUser(); saveUserClubs(); buildSchoolFilter(); renderStats(); renderTopClubs();
    toast('Club deleted.'); showView('myclubs');
  });
}

/* ---------- Join / leave (President must transfer first) ---------- */
function toggleJoin(clubId) {
  if (!currentUser) { pendingAuthAction = function () { toggleJoin(clubId); }; openAuth('login'); return; }
  var club = getClub(clubId); if (!club) return;
  if (ownerOf(club)) { return leaveClubFlow(clubId); }     // owners must designate a new President first
  var joined = currentUser.joined.indexOf(clubId) !== -1;
  if (!joined) {
    if (isBanned(club)) { return toast('You have been banned from this club and cannot rejoin.'); }
    currentUser.joined.push(clubId);
    // Joining a saved club removes it from Saved automatically
    var fi = currentUser.favorites.indexOf(clubId); if (fi > -1) currentUser.favorites.splice(fi, 1);
    club.roster = club.roster || [];
    if (!myRosterEntry(club)) club.roster.push({ name: currentUser.name, role: 'Member', memberId: currentUser.memberId });
    club.memberCount = (club.memberCount || 0) + 1;
    persistUser(); saveUserClubs(); afterMembershipChange();
    toast('You joined ' + club.name + '! 🎉');
  } else {
    openConfirm('Leave ' + club.name + '?', 'You’ll lose your member status and roster spot. You can rejoin anytime.', '🚪', function () {
      currentUser.joined.splice(currentUser.joined.indexOf(clubId), 1);
      var e = myRosterEntry(club); if (e) club.roster.splice(club.roster.indexOf(e), 1);
      club.memberCount = Math.max(0, (club.memberCount || 1) - 1);
      persistUser(); saveUserClubs(); afterMembershipChange();
      toast('You left ' + club.name + '.');
    });
  }
}
function afterMembershipChange() {
  refreshClubModalState(); applyFilters(); renderTopClubs();
  if (typeof renderMyClubs === 'function' && !$('view-myclubs').classList.contains('hidden')) renderMyClubs();
  if (typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
}

/* ============================================================
   GLOBAL PROFILE SYNC — propagate profile edits everywhere the
   user is rendered (rosters, chat, system notes, reviews).
   ============================================================ */
function syncUserRename(oldName, newName) {
  if (!oldName || oldName === newName) return;
  var mid = currentUser.memberId, re = new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  CLUBS.forEach(function (c) {
    (c.roster || []).forEach(function (m) { if (m.name === oldName || (m.memberId && m.memberId === mid)) m.name = newName; });
    (c.leaders || []).forEach(function (l) { if (l.name === oldName) l.name = newName; });
  });
  saveUserClubs();
  var chat = loadChat(), cchg = false;
  Object.keys(chat).forEach(function (cid) {
    chat[cid].forEach(function (m) {
      if (m.system) { var nt = m.text.replace(re, newName); if (nt !== m.text) { m.text = nt; cchg = true; } }
      else if (m.who === oldName && (!m.memberId || m.memberId === mid)) { m.who = newName; cchg = true; }
    });
  });
  if (cchg) saveChat(chat);
  var rv = loadReviews() || {}, rchg = false;
  Object.keys(rv).forEach(function (cid) { rv[cid].forEach(function (x) { if (x.name === oldName) { x.name = newName; rchg = true; } }); });
  if (rchg) saveReviews(rv);
  var sr = loadSiteReviews(); if (sr) { var schg = false; sr.forEach(function (x) { if (x.name === oldName) { x.name = newName; schg = true; } }); if (schg) saveSiteReviews(sr); }
}
/* Re-render every surface that shows the current user's avatar/name/bio/etc. */
function syncUserEverywhere() {
  applyFilters(); renderTopClubs();
  if (typeof renderSiteReviews === 'function') renderSiteReviews();
  if (!$('view-club').classList.contains('hidden') && currentClubId) renderClub();
  if (typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
  if (typeof renderMyClubs === 'function' && !$('view-myclubs').classList.contains('hidden')) renderMyClubs();
}

/* ============================================================
   REVIEWS — clubs (members only) + website reviews
   ============================================================ */
var SEED_SITE_REVIEWS = [
  { name: 'Maya T.', role: 'Junior · West High School', rating: 5, text: 'I found three clubs in my zip code the same afternoon and joined robotics that week. So much easier than asking around.' },
  { name: 'Mr. Alvarez', role: 'Advisor · Palos Verdes Peninsula HS', rating: 5, text: 'Our sign-ups doubled once we listed here. Students can see exactly when and where we meet.' },
  { name: 'Devin R.', role: 'Sophomore · Mira Costa HS', rating: 5, text: 'Saving clubs is clutch — I bookmarked a bunch and contacted the leaders when I was ready.' }
];
function loadReviews() { try { return JSON.parse(localStorage.getItem(LS.reviews)) || null; } catch (e) { return null; } }
function saveReviews(r) { localStorage.setItem(LS.reviews, JSON.stringify(r)); }
function loadSiteReviews() { try { return JSON.parse(localStorage.getItem(LS.siteReviews)) || null; } catch (e) { return null; } }
function saveSiteReviews(r) { localStorage.setItem(LS.siteReviews, JSON.stringify(r)); }
var DAY = 1000 * 60 * 60 * 24;
function seedReviewsIfEmpty() {
  if (!loadReviews()) saveReviews({
    'c-robotics': [{ name: 'Maya T.', rating: 5, text: 'Incredible mentors and hands-on builds every week.', ts: Date.now() - DAY * 16 }, { name: 'Andre P.', rating: 4, text: 'Competitive and welcoming.', ts: Date.now() - DAY * 44 }],
    'c-green': [{ name: 'Priya S.', rating: 5, text: 'Genuinely makes a difference on campus.', ts: Date.now() - DAY * 5 }]
  });
  if (!loadSiteReviews()) {
    var base = Date.now();
    saveSiteReviews(SEED_SITE_REVIEWS.map(function (r, i) {
      return { name: r.name, role: r.role, rating: r.rating, text: r.text, ts: base - DAY * (7 * (i + 1) + 2) };
    }));
  }
}
function clubReviews(clubId) { var r = loadReviews() || {}; return r[clubId] || []; }
function clubRatingSummary(clubId) {
  var l = clubReviews(clubId); if (!l.length) return { avg: 0, count: 0 };
  return { avg: l.reduce(function (s, x) { return s + (x.rating || 0); }, 0) / l.length, count: l.length };
}
function starRow(rating, size) {
  var out = ''; for (var i = 1; i <= 5; i++) out += '<span class="star ' + (i <= Math.round(rating) ? 'fill' : '') + '">' + ICON_STAR + '</span>';
  return '<span class="stars ' + (size || '') + '">' + out + '</span>';
}
function reviewsSectionHTML(club) {
  var sum = clubRatingSummary(club.id), list = clubReviews(club.id).slice().reverse();
  var member = isClubMember(club);
  var btn = member ? '<button class="btn primary" onclick="openWriteReview(\'' + club.id + '\')">' + t('write_review') + '</button>'
    : '<span class="form-note">Join this club to leave a review</span>';
  var header = '<div class="reviews-head"><div><div class="section-title" style="margin:0">' + t('sec_reviews') + '</div>' +
    (sum.count ? '<div class="rating-line">' + starRow(sum.avg) + '<strong>' + sum.avg.toFixed(1) + '</strong><span class="form-note">· ' + sum.count + ' review' + (sum.count === 1 ? '' : 's') + '</span></div>' : '<div class="form-note">No reviews yet.</div>') + '</div>' + btn + '</div>';
  var body = clubReviews(club.id).map(function (r, i) { return { i: i, r: r }; }).reverse().map(function (o) {
    var r = o.r, mine = currentUser && r.name === currentUser.name;
    var ctrls = mine ? '<span class="review-ctrls"><button onclick="openEditReview(\'' + club.id + '\',' + o.i + ')">' + t('rv_edit') + '</button>' +
      '<button onclick="deleteReview(\'' + club.id + '\',' + o.i + ')">' + t('rv_delete') + '</button></span>' : '';
    return '<div class="review"><div class="review-top">' + avatarHTML(r.name, 'sm') +
      '<div class="review-who"><div class="n">' + escHtml(r.name) + '</div>' + starRow(r.rating, 'sm') + '</div>' +
      (r.ts ? '<span class="review-time">' + escHtml(timeAgo(r.ts)) + '</span>' : '') + '</div>' +
      '<p class="review-text">' + escHtml(r.text) + '</p>' + ctrls + '</div>';
  }).join('');
  return header + body;
}
function renderSiteReviews() {
  var wrap = $('siteReviews'); if (!wrap) return;
  var store = loadSiteReviews() || SEED_SITE_REVIEWS;
  wrap.innerHTML = store.map(function (r, i) { return { i: i, r: r }; }).reverse().map(function (o) {
    var t2 = o.r, mine = currentUser && t2.name === currentUser.name;
    var ctrls = mine ? '<div class="review-ctrls" style="margin-top:8px"><button onclick="openEditReview(\'site\',' + o.i + ')">' + t('rv_edit') + '</button>' +
      '<button onclick="deleteReview(\'site\',' + o.i + ')">' + t('rv_delete') + '</button></div>' : '';
    return '<div class="tcard">' + starRow(t2.rating || 5, 'sm') + '<p class="tquote">“' + escHtml(t2.text) + '”</p>' +
      '<div class="tby">' + avatarHTML(t2.name, 'sm') + '<div class="tby-text"><div class="tn">' + escHtml(t2.name) + '</div><div class="tr">' + escHtml(t2.role || 'Student Club Hub member') + '</div>' +
      (t2.ts ? '<div class="ttime">' + escHtml(timeAgo(t2.ts)) + '</div>' : '') + '</div></div>' + ctrls + '</div>';
  }).join('');
}

var reviewTarget = null, reviewRating = 0, reviewEditIndex = null;
function reviewComposer(target, titleText, submitLabel, prefill) {
  $('reviewBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">' + escHtml(titleText) + '</h3><button class="icon-btn" onclick="closeReview()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:14px">Share your experience to help other students.</p>' +
    '<div class="field"><label>Your rating</label><div id="starPicker" class="star-picker">' +
      [1,2,3,4,5].map(function (i) { return '<button type="button" data-v="' + i + '" onclick="setReviewStars(' + i + ')">' + ICON_STAR + '</button>'; }).join('') + '</div></div>' +
    '<div class="field"><label>Your review</label><textarea id="reviewText" placeholder="What did you like? What should others know?">' + escHtml(prefill || '') + '</textarea></div>' +
    '<button class="btn primary block lg" onclick="submitReview()">' + escHtml(submitLabel) + '</button>';
  openOverlay('reviewOverlay');
}
function openWriteReview(target) {
  if (!currentUser) { pendingAuthAction = function () { openWriteReview(target); }; openAuth('login'); return; }
  if (target !== 'site') { var c = getClub(target); if (!isClubMember(c)) { return toast('Only club members can post a review — join the club first.'); } }
  reviewTarget = target; reviewRating = 0; reviewEditIndex = null;
  reviewComposer(target, target === 'site' ? 'Review Student Club Hub' : 'Review ' + getClub(target).name, 'Post Review', '');
  setReviewStars(0);
}
function openEditReview(target, i) {
  var r = (target === 'site') ? (loadSiteReviews() || [])[i] : (clubReviews(target))[i];
  if (!r || !currentUser || r.name !== currentUser.name) return;
  reviewTarget = target; reviewEditIndex = i; reviewRating = r.rating || 0;
  reviewComposer(target, t('rv_edit_h'), t('rv_save'), r.text);
  setReviewStars(reviewRating);
}
function setReviewStars(v) { reviewRating = v; document.querySelectorAll('#starPicker button').forEach(function (b) { b.classList.toggle('on', parseInt(b.dataset.v, 10) <= v); }); }
function submitReview() {
  if (!reviewRating) return toast('Pick a star rating first.');
  var text = ($('reviewText').value || '').trim(); if (!text) return toast('Add a short review.');
  if (reviewTarget === 'site') {
    var s = loadSiteReviews() || SEED_SITE_REVIEWS.slice();
    if (reviewEditIndex != null && s[reviewEditIndex]) { s[reviewEditIndex].rating = reviewRating; s[reviewEditIndex].text = text; }
    else s.push({ name: currentUser.name, role: 'Student Club Hub member', rating: reviewRating, text: text, ts: Date.now() });
    saveSiteReviews(s); closeReview(); renderSiteReviews();
  } else {
    var all = loadReviews() || {}; all[reviewTarget] = all[reviewTarget] || [];
    if (reviewEditIndex != null && all[reviewTarget][reviewEditIndex]) { all[reviewTarget][reviewEditIndex].rating = reviewRating; all[reviewTarget][reviewEditIndex].text = text; }
    else all[reviewTarget].push({ name: currentUser.name, rating: reviewRating, text: text, ts: Date.now() });
    saveReviews(all); closeReview(); refreshClubModalState();
  }
  toast(reviewEditIndex != null ? 'Your review has been updated.' : 'Thanks! Your review has been posted.');
}
function deleteReview(target, i) {
  openConfirm(t('rv_delete_h'), t('rv_delete_msg'), '🗑️', function () {
    if (target === 'site') { var s = loadSiteReviews() || []; if (s[i]) s.splice(i, 1); saveSiteReviews(s); renderSiteReviews(); }
    else { var all = loadReviews() || {}; if (all[target] && all[target][i]) all[target].splice(i, 1); saveReviews(all); refreshClubModalState(); }
    toast('Review deleted.');
  }, t('rv_delete'));
}
function closeReview() { closeOverlay('reviewOverlay'); reviewTarget = null; reviewRating = 0; reviewEditIndex = null; }

/* ============================================================
   CONTACT LEADER
   ============================================================ */
function openContact(clubId) {
  var club = getClub(clubId); if (!club) return;
  var rows = (club.leaders || []).map(function (l) {
    return '<a class="leader-row" href="mailto:' + escAttr(l.email || club.email) + '">' + avatarHTML(l.name, 'sm') +
      '<div class="who"><div class="n">' + escHtml(l.name) + '</div><div class="r">' + escHtml(l.email || club.email) + '</div></div>' +
      '<span class="badge">' + ICON_MAIL + '</span></a>';
  }).join('');
  $('contactBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">Contact ' + escHtml(club.name) + '</h3><button class="icon-btn" onclick="closeContact()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:14px">Reach out to a club leader by email.</p>' +
    (rows || '<p class="form-note">No contact listed. Try <a href="mailto:' + escAttr(club.email) + '">' + escHtml(club.email) + '</a>.</p>');
  openOverlay('contactOverlay');
}
function closeContact() { closeOverlay('contactOverlay'); }

/* ============================================================
   LIGHTBOX + CONFIRM
   ============================================================ */
var lightboxSet = [], lightboxIndex = 0;
function isVideoSrc(src) { return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src || '') || /^data:video\//i.test(src || ''); }
function openLightbox(clubId, index) {
  var club = getClub(clubId); if (!club || !club.gallery || !club.gallery.length) return;
  lightboxSet = club.gallery.slice(); lightboxIndex = Math.max(0, Math.min(index || 0, lightboxSet.length - 1));
  renderLightbox(); $('lightbox').classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function renderLightbox() {
  var src = lightboxSet[lightboxIndex];
  $('lightboxStage').innerHTML = isVideoSrc(src) ? '<video src="' + src + '" controls autoplay></video>' : '<img src="' + src + '" alt="">';
  $('lightboxCount').textContent = (lightboxIndex + 1) + ' / ' + lightboxSet.length;
  var multi = lightboxSet.length > 1;
  document.querySelector('.lb-prev').style.display = multi ? '' : 'none';
  document.querySelector('.lb-next').style.display = multi ? '' : 'none';
}
function lightboxStep(d) { if (!lightboxSet.length) return; lightboxIndex = (lightboxIndex + d + lightboxSet.length) % lightboxSet.length; renderLightbox(); }
function closeLightbox() {
  $('lightbox').classList.add('hidden'); $('lightboxStage').innerHTML = '';
  var anyOpen = Array.prototype.some.call(document.querySelectorAll('.overlay'), function (o) { return !o.classList.contains('hidden'); });
  if (!anyOpen) document.body.style.overflow = '';
}
var confirmCb = null;
function openConfirm(title, msg, icon, onOk, confirmLabel) {
  $('confirmTitle').textContent = title; $('confirmMsg').textContent = msg; $('confirmIcon').innerHTML = icon || '?';
  $('confirmOk').textContent = confirmLabel || 'Confirm';
  confirmCb = onOk || null;
  $('confirmOk').onclick = function () { var cb = confirmCb; closeConfirm(); if (typeof cb === 'function') cb(); };
  openOverlay('confirmOverlay');
}
function closeConfirm() { closeOverlay('confirmOverlay'); confirmCb = null; }

function escAttr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

seedReviewsIfEmpty();
