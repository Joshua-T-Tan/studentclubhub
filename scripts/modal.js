/* ============================================================
   modal.js - full-page Club Detail view (About / Manage tabs),
   member roster, socials, chat (edit/delete/permissions),
   owner transfer/delete flows, reviews (member-only), lightbox,
   contact, confirm dialog.
   ============================================================ */

var currentClubId = null;
var currentClubTab = 'about';
var clubReturnView = 'browse';

var ICON_MAIL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
var ICON_STAR = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>';
var OFFICER_ROLES = ['President', 'Vice President', 'Treasurer', 'Secretary', 'Member'];
var ROLE_RANK = { 'President': 0, 'Vice President': 1, 'Treasurer': 2, 'Secretary': 3, 'Member': 4 };
var ICON_ROLE = svgIcon('swap', 26);

/* ---------- Shared inline icons (hand-drawn SVG, no emoji) ---------- */
/* Partnership = a puzzle piece (pieces "fitting together"); filled, tinted white
   on the golden badge / green elsewhere via currentColor. */
var ICON_PARTNER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' +
  '<path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>';
/* Share = open box with an arrow rising out of it (iOS-style export). */
var ICON_SHARE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M12 15V3"/><path d="m8 7 4-4 4 4"/></svg>';
/* Report flag — on cards (top-right), page banners, and profiles. */
var ICON_FLAG = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>';
/* Settings gear + edit pencil — owner/leader-only controls (rendered gray). */
var ICON_GEAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">' +
  '<path fill-rule="evenodd" clip-rule="evenodd" d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>';
var ICON_PEN = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
var ICON_EYE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
var ICON_EYE_OFF = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3.5 7 10 7a9.05 9.05 0 0 0 5.39-1.61"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/><path d="M2 2l20 20"/></svg>';
var ICON_IMAGE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>';
var ICON_TRASH = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/><path d="M10 11v6M14 11v6"/></svg>';
var ICON_SMILEY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
/* Verified = a scalloped/petal seal (flower rosette) with a check.
   disc/check colors are parameterized (blue disc + white check on white surfaces;
   a light-blue disc + deep check on the gradient profile badge). */
function verifiedSeal(size, disc, check) {
  size = size || 18; disc = disc || '#0a7ea4'; check = check || '#fff';
  var petals = '', n = 12, R = 8.6, cx = 12, cy = 12, pr = 3.05;
  for (var i = 0; i < n; i++) {
    var a = (i / n) * Math.PI * 2;
    petals += '<circle cx="' + (cx + R * Math.cos(a)).toFixed(2) + '" cy="' + (cy + R * Math.sin(a)).toFixed(2) + '" r="' + pr + '" fill="' + disc + '"/>';
  }
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true" class="vseal">' +
    petals + '<circle cx="12" cy="12" r="9.1" fill="' + disc + '"/>' +
    '<path d="M7.8 12.3l2.9 2.9 5.9-6.3" fill="none" stroke="' + check + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
/* Partnership tag — the puzzle icon + "Partnership", shown on a card/banner ONLY
   while an active partnership exists. It disappears (never greys out) when the
   partnership is ended or its duration lapses. Partner name(s) are in the tooltip. */
var _partneredWith = { club: {}, business: {} };
function partneredWithBadge(kind, id) {
  var names = _partneredWith[kind] && _partneredWith[kind][id];
  if (!names) return '';
  if (!Array.isArray(names)) names = [names];
  if (!names.length) return '';
  return '<span class="partnered-badge" title="Partnered with ' + escAttr(names.join(', ')) + '">' + ICON_PARTNER +
    '<span>Partnership</span></span>';
}

/* ---------- Relationship helpers ---------- */
function ownerOf(club) { return !!(currentUser && club && club.verifiedOwner && club.verifiedOwner === currentUser.memberId); }
/* 24h "15:30" ↔ 12h "3:30 PM" (for the <input type=time> meeting dial) */
function _to12(t) { if (!t) return ''; var p = String(t).split(':'); var h = +p[0], m = p[1] || '00'; var ap = h < 12 ? 'AM' : 'PM'; return ((h % 12) || 12) + ':' + m + ' ' + ap; }
function _to24(t) { if (!t) return ''; var m = String(t).match(/(\d+):(\d+)\s*(AM|PM)/i); if (!m) return ''; var h = (+m[1]) % 12; if (/pm/i.test(m[3])) h += 12; return (h < 10 ? '0' + h : h) + ':' + m[2]; }
function clubMeetingLines(club) {
  if (club.meetings && club.meetings.length) {
    return club.meetings.map(function (m) {
      var parts = []; if (m.day) parts.push(m.day); if (m.time) parts.push(_to12(m.time));
      var s = parts.join(' '); if (m.place) s += (s ? ' · ' : '') + m.place; return s;
    }).filter(Boolean);
  }
  return [club.meeting || 'TBD'];
}
/* Meeting details split into { time, place } pairs for the club page's two
   separate "Meeting Time" / "Meeting Location" lines. Falls back to splitting
   the legacy single "time · place" string on its separator. */
function clubMeetingPairs(club) {
  if (club.meetings && club.meetings.length) {
    return club.meetings.map(function (m) {
      var t = []; if (m.day) t.push(m.day); if (m.time) t.push(_to12(m.time));
      return { time: t.join(' '), place: m.place || '' };
    }).filter(function (p) { return p.time || p.place; });
  }
  var raw = (club.meeting || '').trim();
  if (!raw) return [];
  var idx = raw.indexOf('·');
  if (idx > -1) return [{ time: raw.slice(0, idx).trim(), place: raw.slice(idx + 1).trim() }];
  return [{ time: raw, place: '' }];
}
/* Officers (President, VP, Treasurer, Secretary) can edit page content; the
   President/owner alone keeps destructive powers (roster moderation, delete). */
function canEditClub(club) { return ownerOf(club) || (isClubMember(club) && isOfficerRole(roleInClub(club))); }
function isClubMember(club) { return ownerOf(club) || (currentUser && club && (currentUser.joined.indexOf(club.id) !== -1 || !!myRosterEntry(club))); }
function myRosterEntry(club) {
  if (!currentUser || !club.roster) return null;
  // Match on member ID only — two people can share a display name.
  return club.roster.find(function (m) { return m.memberId && m.memberId === currentUser.memberId; }) || null;
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
  _clubSlide = 0; if (_clubSlideTimer) { clearInterval(_clubSlideTimer); _clubSlideTimer = null; }   // fresh slideshow per club
  renderClub(); showView('club');
  if (typeof loadPartnerAgreements === 'function') loadPartnerAgreements();   // fresh "Partnered with" badge + deal box
  // Pull the freshest server copy (club fields + members) so other accounts' changes show up, then keep polling.
  _syncOpenClub(clubId);
  startClubMemberPoll(clubId);
}
function _syncOpenClub(clubId) {
  if (typeof refetchClub !== 'function') return;
  var done = function () { if (currentClubId === clubId) renderClub(); };
  refetchClub(clubId, function () {
    var afterChat = function () { if (typeof loadClubReviews === 'function') loadClubReviews(clubId, done); else done(); };
    var afterMembers = function () { if (typeof loadClubChat === 'function') loadClubChat(clubId, afterChat); else afterChat(); };
    if (typeof loadClubMembers === 'function') loadClubMembers(clubId, afterMembers); else afterMembers();
  });
}
var _clubMemberPoll = null;
function startClubMemberPoll(clubId) {
  if (_clubMemberPoll) clearInterval(_clubMemberPoll);
  _clubMemberPoll = setInterval(function () {
    var cv = $('view-club');
    if (currentClubId !== clubId || !cv || cv.classList.contains('hidden')) { clearInterval(_clubMemberPoll); _clubMemberPoll = null; return; }
    // don't re-render out from under someone typing in the club view (e.g. chat, an inline editor)
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA') && ae.closest && ae.closest('#view-club')) return;
    if (!$('bizOverlay').classList.contains('hidden')) return;   // an editor/modal is open
    _syncOpenClub(clubId);
  }, 5000);
}
function openClubModal(id) { openClub(id); }             // backward-compatible alias
function closeClubModal() { backFromClub(); }
function backFromClub() { showView(clubReturnView || 'browse'); }
function switchClubTab(tab) { currentClubTab = tab; renderClub(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function refreshClubModalState() { if (currentClubId && !$('view-club').classList.contains('hidden')) renderClub(); }

function currentViewName() { return VIEWS.find(function (v) { return !$('view-' + v).classList.contains('hidden'); }) || 'main'; }

function renderClub() {
  var club = getClub(currentClubId); if (!club) return;
  var owner = ownerOf(club), role = roleInClub(club), member = isClubMember(club);
  var relBadge = owner ? renderBadge(t('you_pres'), 'join') : (member ? renderBadge('You: ' + role, 'join') : '');
  var tabs = '';                                           // About/Manage tabs removed — editing is inline (gear/pens)
  // About = full-bleed Yelp-style slideshow hero, then wide content + full-width reviews.
  var slides = clubSlides(club);
  $('clubBody').innerHTML =
    clubHeroSlideshow(club, relBadge, slides) +
    '<div class="biz-wrap">' +
      tabs + clubActionsHTML(club) +
      '<div class="club-detail-grid">' +
        '<div class="club-main-content">' + clubLeftMainHTML(club) + '</div>' +
        '<aside class="club-side">' + clubRightColHTML(club) + '</aside>' +
      '</div>' +
      '<div class="sidebar-card club-reviews-full">' + reviewsSectionHTML(club) + '</div>' +
    '</div>';
  _syncClubSlides(slides.length);
}
/* ---- Club hero slideshow (Yelp-style, full-bleed) ---- */
var _clubSlide = 0, _clubSlideTimer = null;
/* Re-apply the current slide after a (re-)render WITHOUT resetting position or
   restarting an already-running timer — so the 5s member-poll re-render doesn't
   keep snapping the hero back to the first image. */
function _syncClubSlides(n) {
  var s = document.querySelectorAll('#clubSlideshow .biz-slide'); if (!s.length) return;
  if (_clubSlide >= s.length) _clubSlide = 0;
  for (var i = 0; i < s.length; i++) s[i].classList.toggle('active', i === _clubSlide);
  if (n > 1) { if (!_clubSlideTimer) startClubSlideshow(n); }
  else if (_clubSlideTimer) { clearInterval(_clubSlideTimer); _clubSlideTimer = null; }
}
function clubSlides(club) {
  var g = (club.gallery || []).filter(function (u) { return u && !isVideoSrc(u); });   // videos can't be a background image
  if (club.banner) g = [club.banner].concat(g);
  if (g.length) return g.map(function (u) { return { img: u }; });
  return [{ paper: true }];   // nothing uploaded → a blank sheet of paper with school doodles
}
function clubHeroSlideshow(club, relBadge, slides) {
  slides = slides || clubSlides(club);
  var saved = isFavorite(club.id);
  var bannerTR = '<div class="banner-tr">' +
    '<button class="banner-ico ' + (saved ? 'on' : '') + '" title="' + escAttr(saved ? t('card_saved') : t('save_club')) + '" onclick="toggleFavorite(\'' + club.id + '\')">' + bookmarkSvg(saved) + '</button></div>';
  var openP = club.partnershipOpen ? '<span class="open-partner-chip">' + ICON_PARTNER + ' Open to partnerships</span>' : '';
  var chips = recruitBadge(club.recruitment) + renderBadge((club.memberCount || 0) + ' members', 'gray') + (relBadge || '');
  var meta = '<span class="biz-cuisines">' + escHtml(club.category) + '  •  ' + escHtml(club.school) + (club.zip ? '  •  ' + escHtml(club.zip) : '') + '</span>' +
    openP + (club.clubId ? '<span class="biz-idchip">#' + escHtml(club.clubId) + '</span>' : '') + partneredWithBadge('club', club.id);
  var galleryN = (club.gallery || []).filter(Boolean).length;
  var paper = !!(slides[0] && slides[0].paper);
  return '<div class="biz-slideshow' + (paper ? ' is-paper' : '') + '" id="clubSlideshow">' +
    slides.map(function (s, i) {
      if (s.paper) return '<div class="biz-slide active paper-slide">' + doodleLayer('banner') + '</div>';
      return '<div class="biz-slide' + (i === 0 ? ' active' : '') + '" style="' + (s.img ? 'background-image:url(' + escAttr(s.img) + ')' : 'background:' + s.grad) + '">' +
        (s.img ? '' : '<span class="biz-slide-ico">' + s.icon + '</span><span class="biz-slide-txt">' + escHtml(s.txt || '') + '</span>') + '</div>';
    }).join('') +
    '<div class="biz-slide-scrim"></div>' +
    '<button class="banner-back" onclick="backFromClub()">‹ Back</button>' +
    (canEditClub(club) ? '<button class="banner-gear" title="Page settings" onclick="editClubBanner(\'' + club.id + '\')">' + ICON_GEAR + '</button>' : '') +
    bannerTR +
    (slides.length > 1 ? '<button class="lb-btn biz-sl-prev" onclick="clubSlideStep(-1)">‹</button><button class="lb-btn biz-sl-next" onclick="clubSlideStep(1)">›</button>' : '') +
    '<div class="biz-hero-info container"><div class="name-row"><h1>' + escHtml(club.name) + '</h1>' +
      (club.verified ? '<span class="name-verified-ico" title="Verified">' + (paper ? verifiedSeal(20, '#e6b422', '#ffffff') : verifiedSeal(20, '#ffffff', '#b8860b')) + '</span>' : '') +
      '<button class="name-ico share" title="' + escAttr(t('share_club')) + '" onclick="openShare(\'' + club.id + '\')">' + ICON_SHARE + '</button>' +
      (ownerOf(club) ? '' : '<button class="name-ico flag" title="Report this club" onclick="openReport(\'club\',\'' + club.id + '\',\'' + jsArg(club.name) + '\')">' + (typeof ICON_FLAG !== 'undefined' ? ICON_FLAG : '') + '</button>') + '</div>' +
      '<div class="biz-tagline">' + chips + '</div>' +
      '<div class="biz-tagline biz-meta-row" style="margin-top:6px">' + meta + '</div></div></div>';
}
function clubSlideStep(d) {
  var s = document.querySelectorAll('#clubSlideshow .biz-slide'); if (!s.length) return;
  s[_clubSlide].classList.remove('active'); _clubSlide = (_clubSlide + d + s.length) % s.length; s[_clubSlide].classList.add('active');
  startClubSlideshow(s.length);
}
function startClubSlideshow(n) {
  if (_clubSlideTimer) clearInterval(_clubSlideTimer);
  if (n > 1) _clubSlideTimer = setInterval(function () { if ($('view-club') && !$('view-club').classList.contains('hidden')) clubSlideStep(1); }, 5000);
}
function tabBtn(id, label) { return '<button class="club-tab ' + (currentClubTab === id ? 'active' : '') + '" onclick="switchClubTab(\'' + id + '\')">' + label + '</button>'; }
function clubHeroHTML(club) {
  var saved = isFavorite(club.id);
  return '<div class="club-hero" style="' + coverStyle(club) + '">' +
    '<button class="banner-star ' + (saved ? 'on' : '') + '" title="' + escAttr(saved ? t('card_saved') : t('save_club')) + '" onclick="toggleFavorite(\'' + club.id + '\')">' + bookmarkSvg(saved) + '</button>' +
    '<button class="share-pill" title="' + escAttr(t('share_club')) + '" onclick="openShare(\'' + club.id + '\')">' + ICON_SHARE + ' ' + t('share_club') + '</button>' +
    '</div>';
}
function clubHeadHTML(club, relBadge) {
  var tags = (club.tags || []).length ? '<div class="chips" style="margin-top:8px">' + club.tags.map(function (tg) { return '<span class="tag">#' + escHtml(tg) + '</span>'; }).join('') + '</div>' : '';
  return '<div class="club-head"><h2>' + escHtml(club.name) + '</h2>' +
    '<div class="sub">' + escHtml(club.category) + ' · ' + escHtml(club.school) + (club.zip ? ' · ' + escHtml(club.zip) : '') +
      (club.clubId ? ' · <span class="club-id-chip">#' + escHtml(club.clubId) + '</span>' : '') + '</div>' +
    '<div class="chips">' + recruitBadge(club.recruitment) + renderBadge((club.memberCount || 0) + ' members', 'gray') + relBadge + '</div>' +
    tags + '</div>';
}
/* Action buttons (Join/Leave · Contact · Save · Share) - live in the LEFT main column now */
function clubActionsHTML(club) {
  var owner = ownerOf(club), member = isClubMember(club), b = '';
  if (!owner && !member) b += '<button class="btn join" onclick="toggleJoin(\'' + club.id + '\')">' + t('club_join') + '</button>';
  if (member && !owner) b += '<button class="btn ghost" onclick="toggleJoin(\'' + club.id + '\')">' + t('club_leave') + '</button>';
  if (!owner) b += '<button class="btn primary" onclick="openContact(\'' + club.id + '\')">' + ICON_MAIL + ' ' + t('club_contact') + '</button>';
  return b ? '<div class="modal-actions wrap club-actions">' + b + '</div>' : '';
}
/* Key details block — back in the LEFT main column */
/* Section title with an optional owner-only edit control (gray pencil, or a gear).
   editCall is a JS call string; kind 'pen' (default) or 'gear'. */
function secTitle(label, editCall, kind) {
  if (!editCall) return '<div class="section-title">' + label + '</div>';
  return '<div class="section-title has-edit"><span>' + label + '</span>' +
    '<button class="sec-edit" title="Edit" onclick="' + editCall + '">' + (kind === 'gear' ? ICON_GEAR : ICON_PEN) + '</button></div>';
}
function clubDetailsHTML(club) {
  var owner = canEditClub(club);
  var pairs = clubMeetingPairs(club);
  var meetHTML = pairs.length
    ? pairs.map(function (p) { return infoLine('Meeting Time', p.time || '—') + infoLine('Meeting Location', p.place || '—'); }).join('')
    : (infoLine('Meeting Time', 'TBD') + infoLine('Meeting Location', '—'));
  return secTitle(t('sec_details'), owner ? 'editClubDetails(\'' + club.id + '\')' : '') +
    meetHTML + infoLine('School', club.school) +
    (club.district ? infoLine('District', club.district) : '') +
    infoLine('Zip', club.zip || 'Not listed') + infoLine('Club Email', club.email || 'Not listed');
}
/* LEFT main column body: About (scroll box) → gallery (fixed box) → links → details.
   Owners get a gray pencil on each section. */
function clubLeftMainHTML(club) {
  var owner = canEditClub(club);
  return (typeof partnershipDealBox === 'function' ? partnershipDealBox('club', club, owner) : '') +
    secTitle(t('sec_about'), owner ? 'editClubAbout(\'' + club.id + '\')' : '') +
    '<div class="about-box">' + escHtml(club.desc || '') + '</div>' +
    galleryBoxHTML(club) +
    linksSectionHTML(club) +
    clubDetailsHTML(club);
}
/* Links block (public) — lives BENEATH the gallery, with its own heading + owner pencil. */
function linksSectionHTML(club) {
  var owner = canEditClub(club), pills = socialsPublicHTML(club);
  if (!pills && !owner) return '';
  return secTitle(t('sec_links'), owner ? 'editClubLinks(\'' + club.id + '\')' : '') + (pills || '<p class="form-note">No links yet — add some with the pencil.</p>');
}
/* Media thumbnail markup shared by the gallery box and the full gallery page.
   Videos get a seek hint (#t=0.1) so a poster frame paints, plus a ▶ badge. */
function thumbMediaHTML(src) {
  if (isVideoSrc(src)) {
    return '<video src="' + escAttr(src) + '#t=0.1" muted playsinline preload="metadata"></video><span class="vid-badge">▶</span>';
  }
  return '<img src="' + escAttr(src) + '" alt="" loading="lazy">';
}
/* Fixed 4×2 gallery box: shows up to 8; 8th is a "+N" gateway when more exist.
   Empty state keeps the 2-row footprint so the main column never changes size. */
function galleryBoxHTML(club) {
  var owner = canEditClub(club);
  var g = (club.gallery || []).filter(Boolean);
  var title = secTitle(t('sec_gallery'), owner ? 'editClubGallery(\'' + club.id + '\')' : '');
  if (!g.length) {
    return title + '<div class="gallery gallery-fixed gallery-empty">' + t('gallery_empty') + '</div>';
  }
  var extra = g.length - 8;                        // >0 → hidden photos remain
  var cells = g.slice(0, 8).map(function (src, i) {
    if (i === 7 && extra > 0) {
      return '<div class="thumb more" title="' + escAttr(t('gallery_view_all')) + '" onclick="openGalleryPage(\'' + club.id + '\')">' +
        thumbMediaHTML(src) + '<div class="more-overlay">+' + extra + '</div></div>';
    }
    return '<div class="thumb" onclick="openLightbox(\'' + club.id + '\',' + i + ')">' + thumbMediaHTML(src) + '</div>';
  }).join('');
  return title + '<div class="gallery gallery-fixed">' + cells + '</div>';
}
/* Full vertical gallery page (all media, one column) - opened from the "+N" tile */
function openGalleryPage(clubId) {
  var club = getClub(clubId); if (!club) return;
  var g = (club.gallery || []).filter(Boolean); if (!g.length) return;
  var items = g.map(function (src, i) {
    return '<div class="gp-item" onclick="openLightbox(\'' + club.id + '\',' + i + ')">' + thumbMediaHTML(src) + '</div>';
  }).join('');
  var el = $('galleryPage'); if (!el) return;
  el.innerHTML = '<div class="gp-head"><button class="back-pill" onclick="closeGalleryPage()">' + t('back') + '</button>' +
    '<h2 class="gp-title">' + escHtml(club.name) + '</h2></div>' +
    '<div class="gp-grid">' + items + '</div>';
  el.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function closeGalleryPage() {
  var el = $('galleryPage'); if (el) el.classList.add('hidden');
  var anyOpen = Array.prototype.some.call(document.querySelectorAll('.overlay'), function (o) { return !o.classList.contains('hidden'); });
  if (!anyOpen && $('lightbox').classList.contains('hidden')) document.body.style.overflow = '';
}
/* RIGHT column: Officers & Members (top) then a large Chat & Announcements (bottom) */
function clubRightColHTML(club) {
  var reach = !ownerOf(club) ? '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Partner with this club</div>' +
    '<p class="form-note" style="margin-bottom:10px">Businesses and other clubs can reach out about sponsorships, collabs or events. You’ll see the club’s email and can send a partnership request.</p>' +
    '<button class="btn blue block" onclick="contactByEmail(\'club\',\'' + club.id + '\')">' + ICON_PARTNER + ' Reach Out by Email</button></div>' : '';
  return reach + '<div class="sidebar-card side-roster">' + rosterHTML(club) + '</div>' +
    '<div class="sidebar-card side-chat">' + chatHTML(club) + '</div>';
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
  var title = secTitle(t('sec_members') + ' (' + list.length + ')', ownerOf(club) ? 'editClubRoster(\'' + club.id + '\')' : '', 'gear');
  // Non-members can't see the roster
  if (!isClubMember(club)) {
    return title + '<p class="chat-locked form-note">' + svgIcon('lock', 14) + ' ' + t('roster_gated') + '</p>';
  }
  // Members: officers ranked (President, VP, Treasurer, Secretary) then members alphabetically.
  // The list shows ~6 rows at a time and scrolls; the search filters the whole roster.
  var search = '<div class="search" style="margin-bottom:10px"><span class="ico">⌕</span>' +
    '<input id="rosterSearch" type="text" placeholder="' + escAttr(t('roster_search_ph')) + '" oninput="filterRoster()"></div>';
  var rows = list.map(function (m) {
    var badge = isOfficerRole(m.role) ? '<span class="badge">' + escHtml(m.role) + '</span>' : '<span class="badge gray">Member</span>';
    var q = (m.name + ' ' + (m.role || '')).toLowerCase();
    return '<button class="leader-row roster-item" data-q="' + escAttr(q) + '"' +
      ' onclick="openProfile(\'' + jsArg(m.name) + '\')">' + avatarHTML(m.name, 'sm') +
      '<div class="who"><div class="n">' + escHtml(m.name) + '</div></div>' + badge + '</button>';
  }).join('');
  return title + search + '<div id="rosterList" class="roster-scroll">' + rows + '</div>';
}
function filterRoster() {
  var q = ($('rosterSearch') && $('rosterSearch').value || '').trim().toLowerCase();
  var items = document.querySelectorAll('#rosterList .roster-item');
  Array.prototype.forEach.call(items, function (el) {
    el.style.display = (!q || el.getAttribute('data-q').indexOf(q) > -1) ? '' : 'none';
  });
}

/* ---------- Social links (public) ---------- */
function socialsPublicHTML(club) {
  var links = (club.socials || []).filter(isValidLink).slice(0, 8);
  if (!links.length) return '';
  var pills = links.map(function (u) {
    return '<a class="social-pill" href="' + escAttr(normalizeUrl(u)) + '" target="_blank" rel="noopener" title="' + escAttr(normalizeUrl(u)) + '">' +
      '<span class="sp-ico">' + svgIcon('link', 16) + '</span><span class="sp-label">' + escHtml(hostLabel(u)) + '</span></a>';
  }).join('');
  return '<div class="socials socials-grid">' + pills + '</div>';
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
    '<button class="btn blue block" style="margin-bottom:14px" onclick="nativeShare(\'' + jsArg(link) + '\',\'' + jsArg(club.name) + '\')">↗ Share via…</button>' +
    '<div class="qr-wrap"><div class="qr-box">' + (qr || '<p class="form-note">This link is too long for a QR code, so use the link above instead.</p>') + '</div>' +
      '<p class="form-note" style="text-align:center;margin-top:6px">' + t('share_qr') + '</p></div>';
  openOverlay('shareOverlay');
}
/* Native OS share sheet (Instagram, Messages, …) with a clipboard fallback. */
function nativeShare(link, title) {
  if (navigator.share) { navigator.share({ title: title, url: link }).catch(function () {}); }
  else { try { navigator.clipboard.writeText(link); toast('Link copied — paste it anywhere.'); } catch (e) { toast(link); } }
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
/* Club chat is now server-backed (club_chat table) + a per-club cache. */
var _clubChat = {};
function _chatRowToMsg(r) { return { id: r.id, who: r.sender_name, memberId: r.sender_id, text: r.text, ts: r.created_at ? new Date(r.created_at).getTime() : Date.now(), edited: r.edited, deleted: r.deleted, system: r.system, announce: r.announce }; }
function loadClubChat(clubId, cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  sbRest('club_chat?club_id=eq.' + encodeURIComponent(clubId) + '&select=*&order=created_at.asc').then(function (rows) {
    _clubChat[clubId] = (rows || []).map(_chatRowToMsg);
    if (typeof cb === 'function') cb();
  }).catch(function () { if (typeof cb === 'function') cb(); });
}
function chatHTML(club) {
  var all = _clubChat[club.id] || [];
  var member = isClubMember(club);
  var feed = all.length ? all.map(function (m) {
    if (m.system) return '<div class="chat-system">' + svgIcon('bell', 14) + ' <strong>System Notification</strong>: ' + escHtml(m.text) + '</div>';
    if (m.deleted) return '<div class="chat-msg"><div class="avatar sm">·</div><div class="cm-body deleted"><em>This message was deleted</em></div></div>';
    var own = currentUser && ((m.memberId && m.memberId === currentUser.memberId) || m.who === currentUser.name);
    var ctrls = own ? '<span class="cm-ctrls"><button onclick="editChat(\'' + club.id + '\',\'' + m.id + '\')">Edit</button>' +
      '<button onclick="deleteChat(\'' + club.id + '\',\'' + m.id + '\')">Delete</button></span>' : '';
    return '<div class="chat-msg ' + (m.announce ? 'announce' : '') + '">' + avatarHTML(m.who, 'sm') +
      '<div class="cm-body"><div class="cm-top"><span class="cm-who">' + escHtml(m.who) + '</span>' +
      (m.announce ? '<span class="badge">' + svgIcon('megaphone', 13) + ' Announcement</span>' : '') +
      '<span class="cm-time">' + fmtTime(m.ts) + (m.edited ? ' · (edited)' : '') + '</span></div>' +
      '<div class="cm-text">' + escHtml(m.text) + '</div>' + ctrls + '</div></div>';
  }).join('') : '<p class="form-note" style="text-align:center;padding:14px">No messages yet.</p>';

  var compose;
  if (canPostChat(club)) {
    var canAnnounce = ownerOf(club) || isOfficerRole(roleInClub(club));
    compose = '<div class="chat-compose">' +
      '<input id="chatInput" type="text" placeholder="Message the club..." onkeydown="if(event.key===\'Enter\')postChat(\'' + club.id + '\')">' +
      (canAnnounce ? '<label class="chat-ann" title="Post as announcement"><input type="checkbox" id="chatAnnounce"> ' + svgIcon('megaphone', 15) + '</label>' : '') +
      '<button class="btn primary" onclick="postChat(\'' + club.id + '\')">Send</button></div>';
  } else if (member) {
    compose = '<p class="form-note chat-locked">' + svgIcon('lock', 14) + ' Only officers can post in this chat.</p>';
  } else {
    compose = '<p class="form-note chat-locked">Join this club to see and post messages.</p>';
  }

  return secTitle(t('sec_chat'), canEditClub(club) ? 'editClubChat(\'' + club.id + '\')' : '', 'gear') +
    (member ? '<div class="chat-feed">' + feed + '</div>' + compose
            : '<p class="form-note chat-locked">Join this club to view the chat.</p>');
}
function postChat(clubId) {
  var club = getClub(clubId); if (!club || !canPostChat(club)) return;
  var input = $('chatInput'); var text = (input.value || '').trim(); if (!text) return;
  // Owner-set anti-spam cooldown (officers/owner are exempt)
  var cd = club.chatCooldown || 0;
  if (cd > 0 && !ownerOf(club) && !isOfficerRole(roleInClub(club))) {
    var key = 'sch_chat_last', map; try { map = JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { map = {}; }
    var last = map[clubId] || 0, wait = Math.ceil((last + cd * 1000 - Date.now()) / 1000);
    if (wait > 0) { toast('Please wait ' + wait + 's before posting again.'); return; }
    map[clubId] = Date.now(); try { localStorage.setItem(key, JSON.stringify(map)); } catch (e) {}
  }
  var announce = (ownerOf(club) || isOfficerRole(roleInClub(club))) && $('chatAnnounce') && $('chatAnnounce').checked;
  if (input) input.value = '';
  var row = { club_id: clubId, sender_id: currentUser.memberId, sender_name: currentUser.name, text: text, announce: !!announce };
  // optimistic append
  var tmp = { id: 'tmp', who: currentUser.name, memberId: currentUser.memberId, text: text, ts: Date.now(), announce: !!announce };
  (_clubChat[clubId] = _clubChat[clubId] || []).push(tmp);
  renderClub(); var feed0 = document.querySelector('.chat-feed'); if (feed0) feed0.scrollTop = feed0.scrollHeight;
  sbRest('club_chat', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
    .then(function () { loadClubChat(clubId, function () { renderClub(); var f = document.querySelector('.chat-feed'); if (f) f.scrollTop = f.scrollHeight; }); })
    .catch(function (ex) {
      var list = _clubChat[clubId] || [], k = list.indexOf(tmp); if (k > -1) list.splice(k, 1);
      renderClub(); var inp = $('chatInput'); if (inp && !inp.value) inp.value = text;   // give the text back so it isn't lost
      toast('Message not sent: ' + ex.message);
    });
}
function _findChatMsg(clubId, id) { return (_clubChat[clubId] || []).find(function (m) { return m.id === id; }); }
function editChat(clubId, id) {
  var m = _findChatMsg(clubId, id); if (!m) return;
  var own = currentUser && ((m.memberId && m.memberId === currentUser.memberId) || m.who === currentUser.name); if (!own) return;
  var next = window.prompt('Edit your message:', m.text); if (next == null) return;
  next = next.trim(); if (!next) return;
  sbRest('club_chat?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ text: next, edited: true }) })
    .then(function () { loadClubChat(clubId, renderClub); }).catch(function (ex) { toast(ex.message); });
}
function deleteChat(clubId, id) {
  var m = _findChatMsg(clubId, id); if (!m) return;
  var own = currentUser && ((m.memberId && m.memberId === currentUser.memberId) || m.who === currentUser.name); if (!own) return;
  openConfirm('Delete message?', 'This message will be removed for everyone.', svgIcon('trash', 26), function () {
    sbRest('club_chat?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ deleted: true, text: '' }) })
      .then(function () { loadClubChat(clubId, renderClub); }).catch(function (ex) { toast(ex.message); });
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
function linkInputRow(url) {
  var bad = (url && !isValidLink(url)) ? ' invalid' : '';
  return '<div class="link-row"><input class="mg-link' + bad + '" type="text" placeholder="Link (https://…)" value="' + escAttr(url || '') + '" oninput="validateLinkInput(this)">' +
    '<button class="mini-x-inline" type="button" title="Remove" onclick="this.parentElement.remove()">✕</button></div>';
}
/* Roster moderation (owner, from the Members & roles editor) */
function requestRoleChange(clubId, idx, newRole) {
  var club = getClub(clubId); if (!club) return;
  var m = club.roster[idx]; if (!m || m.role === newRole) return;
  var meEntry = myRosterEntry(club);
  var presName = currentUser.name;
  // Promoting someone else to President = transfer presidency (current President reverts to Member;
  // the promoted member's former role, e.g. Treasurer, opens up).
  // A member can't change their own role from the list (keeps a President in place).
  if (m === meEntry) { renderClub(); _reopenRoster(); return; }
  // ONE simple, consistent confirm for every role change — including President.
  openConfirm('Confirm Role Assignment', 'Are you sure you want to appoint ' + m.name + ' as ' + newRole + '?', ICON_ROLE, function () {
    // Close the roster panel FIRST — before any mutation or re-render. Promoting
    // someone to President demotes YOU, so we must never leave the panel open (and
    // even if a later step errored, the panel is already gone).
    if (typeof closeReach === 'function') closeReach();
    if (newRole === 'President') {
      // Swap: they take your spot (President); you take their old role.
      var theirOldRole = m.role;
      m.role = 'President'; club.verifiedOwner = m.memberId || null;
      if (meEntry) meEntry.role = theirOldRole;
      if (!ownerOf(club)) currentClubTab = 'about';
      postSystemChat(club.id, m.name + ' is now President; ' + presName + ' is now ' + theirOldRole + '.');
      saveUserClubs(club);
      if (typeof sbSetMemberRole === 'function') { sbSetMemberRole(club.id, m.memberId, 'President'); if (meEntry && meEntry.memberId) sbSetMemberRole(club.id, meEntry.memberId, theirOldRole); }
    } else {
      m.role = newRole; postSystemChat(club.id, m.name + ' has been appointed as ' + newRole + ' by ' + presName + '.');
      saveUserClubs(club); if (typeof sbSetMemberRole === 'function') sbSetMemberRole(club.id, m.memberId, newRole);
    }
    renderClub(); toast(m.name + ' → ' + newRole);
  }, 'Confirm');
  // Until confirmed, revert the <select> to its real value (roster still open).
  renderClub(); _reopenRoster();
}
/* Automated bot notification posted into the club chat on leadership changes */
function postSystemChat(clubId, text) {
  if (typeof sbRest !== 'function') return;
  sbRest('club_chat', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ club_id: clubId, sender_name: 'System', system: true, text: text }) })
    .then(function () { if (currentClubId === clubId) loadClubChat(clubId, function () { if (currentClubId === clubId) renderClub(); }); }).catch(function () {});
}
function removeMember(clubId, i) {
  var c = getClub(clubId); if (!c || !c.roster[i]) return;
  var name = c.roster[i].name, rmId = c.roster[i].memberId;
  openConfirm(t('mod_remove_h'), t('mod_remove_pre') + name + t('mod_remove_post'), svgIcon('ban', 26), function () {
    c.roster.splice(i, 1); c.memberCount = Math.max(0, (c.memberCount || 1) - 1);
    saveUserClubs(c); if (typeof sbRemoveMember === 'function' && rmId) sbRemoveMember(clubId, rmId);
    renderClub(); _reopenRoster(); toast(name + ' removed.');
  }, t('mod_remove_btn'));
}
/* Ban: remove from roster AND record the member's id/email so they can never rejoin. */
function banMember(clubId, i) {
  var c = getClub(clubId); if (!c || !c.roster[i]) return;
  var m = c.roster[i], name = m.name;
  openConfirm(t('mod_ban_h'), t('mod_ban_pre') + name + t('mod_ban_post'), svgIcon('ban', 26), function () {
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
    saveUserClubs(c); if (typeof sbRemoveMember === 'function' && m.memberId) sbRemoveMember(clubId, m.memberId);
    renderClub(); _reopenRoster(); toast(name + ' has been banned.');
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
  saveUserClubs(c); renderClub(); if (typeof _reopenRoster === 'function') _reopenRoster(); toast(bannedLabel(key).split(' · ')[0] + ' has been unbanned.');
}
/* Owner leaving must first designate a new President */
function leaveClubFlow(clubId) {
  var club = getClub(clubId); if (!club) return;
  if (!ownerOf(club)) { return toggleJoin(clubId); }
  var others = sortedRoster(club).filter(function (m) { return m.memberId && m.memberId !== currentUser.memberId; });
  if (!others.length) { return toast('You’re the only member. Use “Delete club” instead.'); }
  openTransfer(clubId);
}

/* ---------- Transfer ownership / delete ---------- */
function openTransfer(clubId) {
  var club = getClub(clubId); if (!club || !ownerOf(club)) return;
  var candidates = sortedRoster(club).filter(function (m) { return m.memberId && m.memberId !== currentUser.memberId; });
  if (!candidates.length) {
    $('transferBody').innerHTML = '<h3 style="font-size:1.15rem;font-weight:800;margin-bottom:8px">You’re the only member</h3>' +
      '<p class="form-note" style="margin-bottom:16px">A club must always have a President, so you can’t leave as the sole member. Use “Delete club” instead.</p>' +
      '<button class="btn primary block" onclick="closeTransfer()">Got it</button>';
    openOverlay('transferOverlay'); return;
  }
  var opts = candidates.map(function (m, i) {
    return '<label class="pick-row"><input type="radio" name="xfer" value="' + escAttr(m.memberId) + '" data-name="' + escAttr(m.name) + '"' + (i === 0 ? ' checked' : '') + '> ' +
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
  var pickedId = picked.value, name = picked.getAttribute('data-name') || '';
  closeTransfer();
  openConfirm('Transfer to ' + name + '?', 'They become President and you’ll leave the club. This can’t be undone here.', svgIcon('crown', 26), function () {
    var club = getClub(clubId); if (!club) return;
    var newOwner = club.roster.find(function (m) { return m.memberId === pickedId; }); if (!newOwner) return;
    newOwner.role = 'President'; club.verifiedOwner = newOwner.memberId;
    (club.leaders || []).forEach(function (l) { if (l.role === 'President') { l.name = newOwner.name; l.email = club.email || l.email; } });
    if (typeof postSystemChat === 'function') postSystemChat(clubId, newOwner.name + ' is now President; ' + currentUser.name + ' left the club.');
    // Old owner leaves
    var meIdx = club.roster.indexOf(myRosterEntry(club)); if (meIdx > -1) club.roster.splice(meIdx, 1);
    var j = currentUser.joined.indexOf(clubId); if (j > -1) currentUser.joined.splice(j, 1);
    club.memberCount = Math.max(0, (club.memberCount || 1) - 1);
    persistUser(); saveUserClubs(club);
    if (typeof sbSetMemberRole === 'function' && newOwner.memberId) sbSetMemberRole(clubId, newOwner.memberId, 'President');
    if (typeof sbRemoveMember === 'function') sbRemoveMember(clubId, currentUser.memberId);
    toast('Ownership transferred to ' + name + '.');
    showView('myclubs');
  });
}
function deleteClub(clubId) {
  var club = getClub(clubId); if (!club || !ownerOf(club)) return;
  openConfirm('Delete “' + club.name + '”?', 'This permanently removes the club and its listing. This cannot be undone.', svgIcon('warning', 26), function () {
    var i = CLUBS.indexOf(club); if (i > -1) CLUBS.splice(i, 1);
    var j = currentUser.joined.indexOf(clubId); if (j > -1) currentUser.joined.splice(j, 1);
    persistUser(); saveUserClubs(); if (typeof sbDeleteClub === 'function') sbDeleteClub(clubId);
    if (typeof sbRest === 'function') {
      var q = encodeURIComponent(clubId), del = { method: 'DELETE', headers: { Prefer: 'return=minimal' } };
      ['club_members', 'club_chat', 'club_reviews'].forEach(function (tb) { sbRest(tb + '?club_id=eq.' + q, del).catch(function () {}); });
      sbRest('partner_agreements?or=(and(a_type.eq.club,a_id.eq.' + q + '),and(b_type.eq.club,b_id.eq.' + q + '))&status=in.(pending,launched)',
        { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) }).catch(function () {});
    }
    if (typeof applyFilters === 'function') applyFilters(); buildSchoolFilter(); renderStats(); renderTopClubs();
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
    persistUser(); saveUserClubs(club);
    if (typeof sbAddMember === 'function') sbAddMember(clubId, { memberId: currentUser.memberId, email: currentUser.email, name: currentUser.name, role: 'Member' }).then(function () { if (typeof loadClubMembers === 'function') loadClubMembers(clubId, afterMembershipChange); });
    afterMembershipChange();
    toast('You joined ' + club.name + '!');
  } else {
    openConfirm('Leave ' + club.name + '?', 'You’ll lose your member status and roster spot. You can rejoin anytime.', svgIcon('exit', 26), function () {
      currentUser.joined.splice(currentUser.joined.indexOf(clubId), 1);
      var e = myRosterEntry(club); if (e) club.roster.splice(club.roster.indexOf(e), 1);
      club.memberCount = Math.max(0, (club.memberCount || 1) - 1);
      persistUser(); saveUserClubs(club);
      if (typeof sbRemoveMember === 'function') sbRemoveMember(clubId, currentUser.memberId).then(function () { if (typeof loadClubMembers === 'function') loadClubMembers(clubId, afterMembershipChange); });
      afterMembershipChange();
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
   GLOBAL PROFILE SYNC - propagate profile edits everywhere the
   user is rendered (rosters, chat, system notes, reviews).
   ============================================================ */
function syncUserRename(oldName, newName) {
  if (!oldName || oldName === newName) return;
  var mid = currentUser.memberId, re = new RegExp(oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  CLUBS.forEach(function (c) {
    var touched = false;
    (c.roster || []).forEach(function (m) { if (m.memberId && m.memberId === mid) { m.name = newName; touched = true; } });
    if (c.verifiedOwner === mid) (c.leaders || []).forEach(function (l) { if (l.name === oldName) { l.name = newName; touched = true; } });
    if (touched) saveUserClubs(c);   // save every club that shows my name, not just the open one
  });
  if (typeof sbUpsertProfile === 'function') sbUpsertProfile();
  if (typeof sbRest === 'function' && mid) sbRest('biz_reviews?author_id=eq.' + encodeURIComponent(mid), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ author: newName }) }).catch(function () {});
  if (typeof sbRenameMember === 'function') sbRenameMember(mid, newName);   // update my name across all club rosters (server)
  // Update my chat author name across all clubs on the server
  if (typeof sbRest === 'function' && mid) sbRest('club_chat?sender_id=eq.' + encodeURIComponent(mid), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ sender_name: newName }) }).catch(function () {});
  var rv = loadReviews() || {}, rchg = false;
  Object.keys(rv).forEach(function (cid) { rv[cid].forEach(function (x) { if (x.name === oldName) { x.name = newName; rchg = true; } }); });
  if (rchg) saveReviews(rv);
  if (typeof sbRest === 'function' && mid) sbRest('club_reviews?author_id=eq.' + encodeURIComponent(mid), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ author: newName }) }).catch(function () {});
  if (typeof sbRest === 'function' && mid) sbRest('site_reviews?author_id=eq.' + encodeURIComponent(mid), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ author: newName }) }).then(fetchSiteReviews).catch(function () {});
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
  $('lightboxStage').innerHTML = isVideoSrc(src)
    ? '<video src="' + escAttr(src) + '#t=0.1" controls playsinline preload="metadata"></video>'
    : '<img src="' + escAttr(src) + '" alt="">';
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

/* HTML attribute value (value="", title="", href="", option values, style url()). Entity-encodes;
   never inserts backslashes, so names like "Joe's Club" round-trip through edit fields intact. */
function escAttr(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
/* A string ARGUMENT inside an inline handler, e.g. onclick="fn('…')": JS-escape first, then
   HTML-encode. Prevents a crafted name (x\');alert(1)//) from breaking out and running code. */
function jsArg(s) { return escAttr(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, '\\n')); }


