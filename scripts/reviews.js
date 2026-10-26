/* ============================================================
   reviews.js — club reviews (members only, one each, club_reviews
   table) and the homepage website reviews (static seeds + the shared
   site_reviews table), plus the shared review composer overlay.
   Split out of modal.js; loaded right after it.
   ============================================================ */
var SEED_SITE_REVIEWS = [
  { name: 'Maya T.', role: 'Junior · West High School', rating: 5, text: 'I found three clubs in my zip code the same afternoon and joined robotics that week. So much easier than asking around.' },
  { name: 'Mr. Alvarez', role: 'Advisor · Palos Verdes Peninsula HS', rating: 5, text: 'Our sign-ups doubled once we listed here. Students can see exactly when and where we meet.' },
  { name: 'Devin R.', role: 'Sophomore · Mira Costa HS', rating: 5, text: 'Saving clubs is clutch. I bookmarked a bunch and messaged the leaders when I was ready.' }
];
function loadReviews() { try { return JSON.parse(localStorage.getItem(LS.reviews)) || null; } catch (e) { return null; } }
function saveReviews(r) { localStorage.setItem(LS.reviews, JSON.stringify(r)); }
/* Website reviews: the three seeds are static; everything members write lives in the shared
   site_reviews table (one per member), so everyone sees the same list on every device. */
var _siteReviews = [];
function loadSiteReviews() { try { return JSON.parse(localStorage.getItem(LS.siteReviews)) || null; } catch (e) { return null; } }
function saveSiteReviews(r) { try { localStorage.setItem(LS.siteReviews, JSON.stringify(r)); } catch (e) {} }
function _siteSeeds() {
  var base = Date.now();
  return SEED_SITE_REVIEWS.map(function (r, i) { return { name: r.name, role: r.role, rating: r.rating, text: r.text, ts: base - DAY * (7 * (i + 1) + 2) }; });
}
function _mySiteReview() { return currentUser ? _siteReviews.find(function (r) { return r.author_id === currentUser.memberId; }) || null : null; }
function fetchSiteReviews() {
  if (typeof sbRest !== 'function') return;
  sbRest('site_reviews?select=*&order=created_at.asc').then(function (rows) {
    _siteReviews = (rows || []).map(function (r) { return { id: r.id, author_id: r.author_id, name: r.author, role: r.role, rating: r.rating, text: r.text, ts: new Date(r.created_at).getTime() }; });
    _migrateLocalSiteReview();
    renderSiteReviews();
  }).catch(function () {});
}
/* One-time: a review this account wrote back when reviews were saved only in this browser gets uploaded. */
function _migrateLocalSiteReview() {
  var local = loadSiteReviews(); if (!currentUser || !local || _mySiteReview()) return;
  var seedNames = SEED_SITE_REVIEWS.map(function (s) { return s.name; });
  var mine = local.filter(function (r) { return r.name === currentUser.name && seedNames.indexOf(r.name) === -1; }).pop();
  if (!mine) return;
  saveSiteReviews(local.filter(function (r) { return r !== mine; }));
  sbRest('site_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ author_id: currentUser.memberId, author: currentUser.name, role: mine.role || 'Student Club Hub member', rating: mine.rating || 5, text: mine.text }) })
    .then(fetchSiteReviews).catch(function () {});
}
var DAY = 1000 * 60 * 60 * 24;
function seedReviewsIfEmpty() {
  if (!loadReviews()) saveReviews({
    'c-robotics': [{ name: 'Maya T.', rating: 5, text: 'Incredible mentors and hands-on builds every week.', ts: Date.now() - DAY * 16 }, { name: 'Andre P.', rating: 4, text: 'Competitive and welcoming.', ts: Date.now() - DAY * 44 }],
    'c-green': [{ name: 'Priya S.', rating: 5, text: 'Genuinely makes a difference on campus.', ts: Date.now() - DAY * 5 }]
  });
}
document.addEventListener('DOMContentLoaded', fetchSiteReviews);   // sbRest (business.js) loads after this file
/* Club reviews are server-backed (club_reviews table) + a per-club cache. */
var _clubReviews = {};
function clubReviews(clubId) { return _clubReviews[clubId] || []; }
function _reviewRowToObj(r) { return { id: r.id, author_id: r.author_id, name: r.author, rating: r.rating, text: r.text, ts: r.created_at ? new Date(r.created_at).getTime() : Date.now(), replies: r.replies || [] }; }
function loadClubReviews(clubId, cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  sbRest('club_reviews?club_id=eq.' + encodeURIComponent(clubId) + '&select=*&order=created_at.asc').then(function (rows) {
    rows = rows || [];
    if (!rows.length) {
      var legacy = ((typeof loadReviews === 'function' && loadReviews()) || {})[clubId] || [];
      if (legacy.length) {
        var ins = legacy.map(function (x) { return { club_id: clubId, author_id: x.author_id || null, author: x.name, rating: x.rating, text: x.text, replies: x.replies || [] }; });
        sbRest('club_reviews', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(ins) })
          .then(function (insd) { _clubReviews[clubId] = (insd || []).map(_reviewRowToObj); if (typeof cb === 'function') cb(); })
          .catch(function () { if (typeof cb === 'function') cb(); });
        return;
      }
    }
    _clubReviews[clubId] = rows.map(_reviewRowToObj);
    if (typeof cb === 'function') cb();
  }).catch(function () { if (typeof cb === 'function') cb(); });
}
function _saveReviewReplies(clubId, reviewId, replies) {
  var rv = _findReview(clubId, reviewId); if (rv) rv.replies = replies;
  return sbRest('club_reviews?id=eq.' + reviewId, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ replies: replies }) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t save the reply. Only club officers can reply.'); return rows; });
}
function _findReview(clubId, id) { return (_clubReviews[clubId] || []).find(function (r) { return r.id === id; }); }
function clubRatingSummary(clubId) {
  var l = clubReviews(clubId); if (!l.length) return { avg: 0, count: 0 };
  return { avg: l.reduce(function (s, x) { return s + (x.rating || 0); }, 0) / l.length, count: l.length };
}
function starRow(rating, size) {
  var out = ''; for (var i = 1; i <= 5; i++) out += '<span class="star ' + (i <= Math.round(rating) ? 'fill' : '') + '">' + ICON_STAR + '</span>';
  return '<span class="stars ' + (size || '') + '">' + out + '</span>';
}
/* Owner toggle for the Ratings & Reviews section (shared club + business markup). */
function _reviewToggleHTML(kind, id, enabled) {
  var fn = kind === 'club' ? 'toggleClubReviews' : 'toggleBizReviews';
  return '<div class="review-toggle"><div><div class="tr-title">Ratings &amp; Reviews are ' + (enabled ? 'ON' : 'OFF') + '</div>' +
    '<div class="form-note">' + (enabled
      ? 'Visitors can rate and review. Turn this off to hide the review section from everyone.'
      : 'The review section is hidden from visitors. Turn it on to allow ratings and reviews.') + '</div></div>' +
    '<button class="btn ghost sm-btn" onclick="' + fn + '(\'' + id + '\')">Turn ' + (enabled ? 'off' : 'on') + '</button></div>';
}
function toggleClubReviews(id) {
  var c = getClub(id); if (!c || !ownerOf(c)) return;
  c.reviewsEnabled = (c.reviewsEnabled === false);   // false → on; on/undefined → off
  if (typeof saveUserClubs === 'function') saveUserClubs(c);
  renderClub();
  toast(c.reviewsEnabled ? 'Reviews turned on.' : 'Reviews turned off.');
}
function reviewsSectionHTML(club) {
  var owner = ownerOf(club);
  var enabled = club.reviewsEnabled !== false;
  var toggle = owner ? _reviewToggleHTML('club', club.id, enabled) : '';
  if (!enabled) {
    return '<div class="reviews-head"><div class="section-title" style="margin:0">' + t('sec_reviews') + '</div></div>' + toggle +
      '<p class="form-note" style="padding:10px 0">Reviews are turned off' + (owner ? ' — turn them back on above to let people rate and review your club.' : ' for this club.') + '</p>';
  }
  var sum = clubRatingSummary(club.id), list = clubReviews(club.id).slice().reverse();
  var member = isClubMember(club);
  var btn = member ? '<button class="btn primary" onclick="openWriteReview(\'' + club.id + '\')">' + t('write_review') + '</button>'
    : '<span class="form-note">Join this club to leave a review</span>';
  var header = '<div class="reviews-head"><div><div class="section-title" style="margin:0">' + t('sec_reviews') + '</div>' +
    (sum.count ? '<div class="rating-line">' + starRow(sum.avg) + '<strong>' + sum.avg.toFixed(1) + '</strong><span class="form-note">· ' + sum.count + ' review' + (sum.count === 1 ? '' : 's') + '</span></div>' : '<div class="form-note">No reviews yet.</div>') + '</div>' + btn + '</div>';
  var canReply = canReplyReview(club);
  var body = clubReviews(club.id).slice().reverse().map(function (r) {
    var mine = currentUser && (r.author_id ? r.author_id === currentUser.memberId : r.name === currentUser.name);
    var ctrls = mine ? '<span class="review-ctrls"><button onclick="openEditReview(\'' + club.id + '\',\'' + r.id + '\')">' + t('rv_edit') + '</button>' +
      '<button onclick="deleteReview(\'' + club.id + '\',\'' + r.id + '\')">' + t('rv_delete') + '</button></span>' : '';
    var replies = (r.replies || []).map(function (rep, j) {
      var canDel = currentUser && (rep.name === currentUser.name || ownerOf(club));
      return '<div class="review-reply"><div class="rr-top">' + avatarHTML(rep.name, 'sm') +
        '<span class="rr-name">' + escHtml(rep.name) + '</span><span class="badge">' + escHtml(rep.role || 'Officer') + '</span>' +
        (rep.ts ? '<span class="review-time">' + escHtml(timeAgo(rep.ts)) + '</span>' : '') +
        (canDel ? '<button class="rr-del" onclick="deleteReviewReply(\'' + club.id + '\',\'' + r.id + '\',' + j + ')">' + t('rv_delete') + '</button>' : '') +
        '</div><p class="rr-text">' + escHtml(rep.text) + '</p></div>';
    }).join('');
    var replyBtn = canReply ? '<button class="review-reply-btn" onclick="replyReview(\'' + club.id + '\',\'' + r.id + '\')">↩ ' + t('rv_reply') + '</button>' : '';
    return '<div class="review"><div class="review-top">' + avatarHTML(r.name, 'sm') +
      '<div class="review-who"><div class="n">' + escHtml(r.name) + '</div>' + starRow(r.rating, 'sm') + '</div>' +
      (r.ts ? '<span class="review-time">' + escHtml(timeAgo(r.ts)) + '</span>' : '') + (mine ? '' : reportUserFlag(r.author_id, r.name, 'A review on ' + club.name)) + '</div>' +
      '<p class="review-text">' + escHtml(r.text) + '</p>' + ctrls + replies + replyBtn + '</div>';
  }).join('');
  return toggle + header + body;
}
/* Only club leadership (owner / President / VP / Treasurer / Secretary) may reply to reviews. */
function canReplyReview(club) { return ownerOf(club) || isOfficerRole(roleInClub(club)); }
function replyReview(clubId, reviewId) {
  var club = getClub(clubId); if (!club || !canReplyReview(club)) return;
  var r = _findReview(clubId, reviewId); if (!r) return;
  askText(t('rv_reply_prompt'), '', t('rv_reply'), function (text) {
    var replies = (r.replies || []).slice();
    replies.push({ name: currentUser.name, role: roleInClub(club) || 'Officer', text: text, ts: Date.now() });
    _saveReviewReplies(clubId, reviewId, replies).then(function () { refreshClubModalState(); toast(t('rv_reply_done')); }).catch(function (ex) { toast(ex.message); });
  });
}
function deleteReviewReply(clubId, reviewId, j) {
  var club = getClub(clubId); if (!club) return;
  var r = _findReview(clubId, reviewId); if (!r || !r.replies || !r.replies[j]) return;
  var rep = r.replies[j];
  if (!currentUser || (rep.name !== currentUser.name && !ownerOf(club))) return;   // reply author or owner only
  openConfirm(t('rv_reply_del_h'), t('rv_reply_del_msg'), svgIcon('trash', 26), function () {
    var replies = r.replies.slice(); replies.splice(j, 1);
    _saveReviewReplies(clubId, reviewId, replies).then(refreshClubModalState).catch(function (ex) { toast(ex.message); });
  }, t('rv_delete'));
}
function renderSiteReviews() {
  var wrap = $('siteReviews'); if (!wrap) return;
  var store = _siteSeeds().concat(_siteReviews);
  wrap.innerHTML = store.map(function (r) { return { r: r }; }).reverse().map(function (o) {
    var t2 = o.r, mine = !!(currentUser && t2.author_id && t2.author_id === currentUser.memberId);
    var ctrls = mine ? '<div class="review-ctrls" style="margin-top:8px"><button onclick="openEditReview(\'site\',\'' + t2.id + '\')">' + t('rv_edit') + '</button>' +
      '<button onclick="deleteReview(\'site\',\'' + t2.id + '\')">' + t('rv_delete') + '</button></div>' : '';
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
  if (target !== 'site') {
    var c = getClub(target); if (!c || !isClubMember(c) || isBanned(c)) { return toast('Only members can review a club. Join it first.'); }
    var mineR = clubReviews(target).find(function (r) { return r.author_id && r.author_id === currentUser.memberId; });
    if (mineR) return openEditReview(target, mineR.id);   // one review per member — edit the one you have
  } else if (_mySiteReview()) return openEditReview('site', _mySiteReview().id);
  reviewTarget = target; reviewRating = 0; reviewEditIndex = null;
  reviewComposer(target, target === 'site' ? 'Review Student Club Hub' : 'Review ' + getClub(target).name, 'Post Review', '');
  setReviewStars(0);
}
function openEditReview(target, ref) {
  var r = (target === 'site') ? _siteReviews.find(function (x) { return x.id === ref; }) : _findReview(target, ref);
  if (!r || !currentUser) return;
  var mine = r.author_id ? r.author_id === currentUser.memberId : (target !== 'site' && r.name === currentUser.name);
  if (!mine) return;
  reviewTarget = target; reviewEditIndex = ref; reviewRating = r.rating || 0;   // reviewEditIndex holds an index (site) or review id (club)
  reviewComposer(target, t('rv_edit_h'), t('rv_save'), r.text);
  setReviewStars(reviewRating);
}
function setReviewStars(v) { reviewRating = v; document.querySelectorAll('#starPicker button').forEach(function (b) { b.classList.toggle('on', parseInt(b.dataset.v, 10) <= v); }); }
function submitReview() {
  if (!reviewRating) return toast('Pick a star rating first.');
  var text = ($('reviewText').value || '').trim(); if (!text) return toast('Add a short review.');
  if (reviewTarget === 'site') {
    var sid = reviewEditIndex, sEdit = sid != null, sRating = reviewRating, mid = encodeURIComponent(currentUser.memberId);
    var role = currentUser.school ? 'Student · ' + currentUser.school : 'Student Club Hub member';
    closeReview();
    var req = sEdit
      ? sbRest('site_reviews?id=eq.' + sid + '&author_id=eq.' + mid, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ rating: sRating, text: text, author: currentUser.name }) })
      : sbRest('site_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ author_id: currentUser.memberId, author: currentUser.name, role: role, rating: sRating, text: text }) });
    req.then(function () { fetchSiteReviews(); toast(sEdit ? 'Your review has been updated.' : 'Thanks! Your review has been posted.'); }).catch(function (ex) { toast(ex.message); });
    return;
  } else {
    var tgt = reviewTarget, ref = reviewEditIndex, isEdit = ref != null, rating = reviewRating;
    closeReview();
    var done = function () { loadClubReviews(tgt, refreshClubModalState); toast(isEdit ? 'Your review has been updated.' : 'Thanks! Your review has been posted.'); };
    if (isEdit) sbRest('club_reviews?id=eq.' + ref, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ rating: rating, text: text }) }).then(done).catch(function (ex) { toast(ex.message); });
    else sbRest('club_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ club_id: tgt, author_id: currentUser.memberId, author: currentUser.name, rating: rating, text: text, replies: [] }) }).then(done).catch(function (ex) { toast(ex.message); });
    return;
  }
  toast(reviewEditIndex != null ? 'Your review has been updated.' : 'Thanks! Your review has been posted.');
}
function deleteReview(target, ref) {
  openConfirm(t('rv_delete_h'), t('rv_delete_msg'), svgIcon('trash', 26), function () {
    if (target === 'site') sbRest('site_reviews?id=eq.' + ref + '&author_id=eq.' + encodeURIComponent(currentUser.memberId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).then(function () { fetchSiteReviews(); toast('Review deleted.'); }).catch(function (ex) { toast(ex.message); });
    else sbRest('club_reviews?id=eq.' + ref, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }).then(function () { loadClubReviews(target, refreshClubModalState); toast('Review deleted.'); }).catch(function (ex) { toast(ex.message); });
  }, t('rv_delete'));
}
function closeReview() { closeOverlay('reviewOverlay'); reviewTarget = null; reviewRating = 0; reviewEditIndex = null; }

seedReviewsIfEmpty();
