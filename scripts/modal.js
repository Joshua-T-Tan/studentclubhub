/* ============================================================
   modal.js — club profile modal, image/video lightbox,
   favorite/join/contact interactions, confirm dialog.
   ============================================================ */

var currentModalClubId = null;

/* ============================================================
   CLUB PROFILE MODAL
   ============================================================ */
function openClubModal(clubId) {
  var club = getClub(clubId); if (!club) return;
  currentModalClubId = clubId;
  renderClubModal(club);
  openOverlay('clubOverlay');
  $('clubOverlay').scrollTop = 0;
}
function closeClubModal() { currentModalClubId = null; closeOverlay('clubOverlay'); }

function renderClubModal(club) {
  var st = styleForCategory(club.category);
  var fav = isFavorite(club.id);
  var joined = isJoined(club.id);

  var galleryHTML = '';
  if (club.gallery && club.gallery.length) {
    galleryHTML =
      '<div class="section-title">Gallery</div><div class="gallery">' +
      club.gallery.map(function (src, i) {
        var media = isVideoSrc(src)
          ? '<video src="' + src + '" muted></video>'
          : '<img src="' + src + '" alt="">';
        return '<div class="thumb" onclick="openLightbox(\'' + club.id + '\',' + i + ')">' + media + '</div>';
      }).join('') + '</div>';
  }

  var leadersHTML = (club.leaders || []).map(function (l) {
    return '<button class="leader-row" onclick="openProfile(\'' + escAttr(l.name) + '\')">' +
      avatarHTML(l.name, 'sm') +
      '<div class="who"><div class="n">' + escHtml(l.name) + '</div><div class="r">' + escHtml(l.role) + '</div></div>' +
      '<span class="badge gray">View</span>' +
    '</button>';
  }).join('') || '<p class="form-note">Leadership to be announced.</p>';

  var tagsHTML = (club.tags || []).map(function (t) { return '<span class="tag">#' + escHtml(t) + '</span>'; }).join('');

  $('clubModal').innerHTML =
    // Floating sticky controls (close + favorite) stay pinned while content scrolls
    '<div class="modal-float">' +
      '<button class="icon-btn" title="Close" onclick="closeClubModal()">✕</button>' +
      '<button class="icon-btn float-fav ' + (fav ? 'on' : '') + '" title="Favorite" onclick="toggleFavorite(\'' + club.id + '\')">' + (fav ? '★' : '☆') + '</button>' +
    '</div>' +
    '<div class="club-hero" style="background:' + st.grad + '">' + st.icon + '</div>' +
    '<div class="club-head">' +
      '<h2>' + escHtml(club.name) + '</h2>' +
      '<div class="sub">' + escHtml(club.category) + ' · ' + escHtml(club.school) + '</div>' +
      '<div class="chips">' +
        renderBadge((club.memberCount || 0) + ' members', 'gray') +
        (joined ? renderBadge('✓ Joined', 'join') : '') +
      '</div>' +
      (club.tagline ? '<p style="color:var(--muted)">' + escHtml(club.tagline) + '</p>' : '') +
    '</div>' +
    '<div class="modal-body">' +
      '<div class="modal-actions">' +
        '<button class="btn ' + (joined ? 'ghost' : 'join') + '" onclick="toggleJoin(\'' + club.id + '\')">' +
          (joined ? '✓ Joined — Leave' : '+ Join Club') + '</button>' +
        '<button class="btn primary" onclick="openContact(\'' + club.id + '\')">✉ Contact Leader</button>' +
      '</div>' +
      '<div class="section-title">About</div>' +
      '<p style="color:var(--muted)">' + escHtml(club.desc) + '</p>' +
      '<div class="section-title">Details</div>' +
      '<div class="info-line"><span class="k">Meets</span><span>' + escHtml(club.meeting || 'TBD') + '</span></div>' +
      '<div class="info-line"><span class="k">School</span><span>' + escHtml(club.school) + '</span></div>' +
      (tagsHTML ? '<div class="chips" style="margin-top:6px">' + tagsHTML + '</div>' : '') +
      galleryHTML +
      '<div class="section-title">Leadership</div>' + leadersHTML +
    '</div>';
}

/* Re-render the open modal (keeps favorite/join state fresh after toggles) */
function refreshClubModalState() {
  if (currentModalClubId && !$('clubOverlay').classList.contains('hidden')) {
    var club = getClub(currentModalClubId);
    if (club) renderClubModal(club);
  }
}

/* ---------- Join / leave ---------- */
function toggleJoin(clubId) {
  if (!currentUser) { pendingAuthAction = function () { toggleJoin(clubId); }; openAuth('login'); return; }
  var club = getClub(clubId); if (!club) return;
  var i = currentUser.joined.indexOf(clubId);
  if (i === -1) {
    currentUser.joined.push(clubId);
    club.memberCount = (club.memberCount || 0) + 1;
    persistUser(); saveUserClubs();
    afterMembershipChange();
    toast('You joined ' + club.name + '! 🎉');
  } else {
    openConfirm('Leave ' + club.name + '?', 'You can rejoin anytime.', '🚪', function () {
      currentUser.joined.splice(i, 1);
      club.memberCount = Math.max(0, (club.memberCount || 1) - 1);
      persistUser(); saveUserClubs();
      afterMembershipChange();
      toast('You left ' + club.name + '.');
    });
  }
}
function afterMembershipChange() {
  refreshClubModalState(); applyFilters();
  if (typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
}

/* ============================================================
   CONTACT LEADER MODAL
   ============================================================ */
function openContact(clubId) {
  var club = getClub(clubId); if (!club) return;
  var rows = (club.leaders || []).map(function (l) {
    return '<a class="leader-row" href="mailto:' + escAttr(l.email || club.email) + '">' +
      avatarHTML(l.name, 'sm') +
      '<div class="who"><div class="n">' + escHtml(l.name) + '</div><div class="r">' + escHtml(l.email || club.email) + '</div></div>' +
      '<span class="badge">✉</span></a>';
  }).join('');
  $('contactBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">Contact ' + escHtml(club.name) + '</h3>' +
      '<button class="icon-btn" onclick="closeContact()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:14px">Reach out to a club leader by email.</p>' +
    (rows || '<p class="form-note">No contact listed. Try <a href="mailto:' + escAttr(club.email) + '">' + escHtml(club.email) + '</a>.</p>');
  openOverlay('contactOverlay');
}
function closeContact() { closeOverlay('contactOverlay'); }

/* ============================================================
   IMAGE / VIDEO LIGHTBOX
   ============================================================ */
var lightboxSet = [], lightboxIndex = 0;
function isVideoSrc(src) { return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(src || '') || /^data:video\//i.test(src || ''); }
function openLightbox(clubId, index) {
  var club = getClub(clubId); if (!club || !club.gallery || !club.gallery.length) return;
  lightboxSet = club.gallery.slice();
  lightboxIndex = Math.max(0, Math.min(index || 0, lightboxSet.length - 1));
  renderLightbox();
  $('lightbox').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function renderLightbox() {
  var src = lightboxSet[lightboxIndex];
  $('lightboxStage').innerHTML = isVideoSrc(src)
    ? '<video src="' + src + '" controls autoplay></video>'
    : '<img src="' + src + '" alt="">';
  $('lightboxCount').textContent = (lightboxIndex + 1) + ' / ' + lightboxSet.length;
  var multi = lightboxSet.length > 1;
  document.querySelector('.lb-prev').style.display = multi ? '' : 'none';
  document.querySelector('.lb-next').style.display = multi ? '' : 'none';
}
function lightboxStep(d) {
  if (!lightboxSet.length) return;
  lightboxIndex = (lightboxIndex + d + lightboxSet.length) % lightboxSet.length;
  renderLightbox();
}
function closeLightbox() {
  $('lightbox').classList.add('hidden');
  $('lightboxStage').innerHTML = '';
  var anyOpen = Array.prototype.some.call(document.querySelectorAll('.overlay'), function (o) { return !o.classList.contains('hidden'); });
  if (!anyOpen) document.body.style.overflow = '';
}

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */
var confirmCb = null;
function openConfirm(title, msg, icon, onOk) {
  $('confirmTitle').textContent = title;
  $('confirmMsg').textContent = msg;
  $('confirmIcon').textContent = icon || '?';
  confirmCb = onOk || null;
  var ok = $('confirmOk');
  ok.onclick = function () { closeConfirm(); if (typeof confirmCb === 'function') confirmCb(); };
  openOverlay('confirmOverlay');
}
function closeConfirm() { closeOverlay('confirmOverlay'); confirmCb = null; }

/* small attribute-escaper for names passed into inline onclick handlers */
function escAttr(s) { return (s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
