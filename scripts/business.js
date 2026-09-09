/* ============================================================
   business.js — Local Businesses directory (MP31).
   Reads VERIFIED partners from Supabase (public), lets anyone
   submit a listing as 'pending', and mirrors the Saved-Clubs UX
   for Saved Businesses (localStorage). Uses SUPABASE_URL / KEY
   from supabase.js. Loaded last (after pages.js).

   Verification: submissions land as 'pending' and stay hidden
   until an admin flips status → 'verified' in the Supabase
   dashboard. In-app club-officer co-verification + a "My Business"
   editor are Phase 2 (they need a real backend identity, since
   accounts currently live in localStorage).
   ============================================================ */

var BIZ_CATEGORIES = ['Food & Dining', 'Apparel & Merch', 'Event Spaces', 'Tutoring & Test Prep', 'Printing & Supplies', 'Entertainment'];
var BIZ_CAT_META = {
  'Food & Dining':        { icon: '🍔', grad: 'linear-gradient(140deg,#0f8ca0,#0a4f66)' },
  'Apparel & Merch':      { icon: '👕', grad: 'linear-gradient(140deg,#2596be,#0a4f66)' },
  'Event Spaces':         { icon: '🎪', grad: 'linear-gradient(140deg,#2a6f97,#013a5c)' },
  'Tutoring & Test Prep': { icon: '📚', grad: 'linear-gradient(140deg,#12a594,#0a5f66)' },
  'Printing & Supplies':  { icon: '🖨️', grad: 'linear-gradient(140deg,#4fb3c9,#007ea7)' },
  'Entertainment':        { icon: '🎳', grad: 'linear-gradient(140deg,#1ba3d1,#005f7d)' }
};
var PERK_TYPES = { discount: 'Student Discount', addon: 'Free Add-On', sponsorship: 'Club Sponsorship' };
var PERK_FILTER_LABELS = { discount: 'Student discounts (% off)', addon: 'Free add-ons & freebies', sponsorship: 'Club sponsorships & grants' };
function bizCatMeta(c) { return BIZ_CAT_META[c] || { icon: '🏪', grad: 'linear-gradient(140deg,#0a6f96,#003249)' }; }

var _bizCache = null, _bizError = null;
var bizState = { cat: 'All', perk: 'All', sort: 'az', q: '' };

/* ---------- Supabase REST (PostgREST) ---------- */
function sbRest(path, opts) {
  opts = opts || {};
  var headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
  return fetch(SUPABASE_URL + '/rest/v1/' + path, { method: opts.method || 'GET', headers: headers, body: opts.body })
    .then(function (res) {
      return res.text().then(function (txt) {
        var d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (res.ok) return d;
        var msg = (d && (d.message || d.hint || d.details || d.error)) || ('Request failed (' + res.status + ').');
        var err = new Error(msg); err.status = res.status; throw err;
      });
    }, function () { throw new Error('Couldn’t reach the businesses service — check your connection and try again.'); });
}
function sbFetchBusinesses() { return sbRest('businesses?status=eq.verified&select=*&order=created_at.desc'); }
function sbRegisterBusiness(data) { return sbRest('businesses', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(data) }); }

/* ---------- Saved Businesses (localStorage, mirrors Saved Clubs) ---------- */
function loadSavedBiz() { try { return JSON.parse(localStorage.getItem('sch_saved_biz')) || []; } catch (e) { return []; } }
function saveSavedBiz(a) { try { localStorage.setItem('sch_saved_biz', JSON.stringify(a)); } catch (e) {} }
function isBizSaved(id) { return loadSavedBiz().indexOf(id) !== -1; }
function toggleBizSave(id) {
  var a = loadSavedBiz(), i = a.indexOf(id);
  if (i > -1) a.splice(i, 1); else a.push(id);
  saveSavedBiz(a); toast(i > -1 ? 'Removed from Saved Businesses.' : 'Saved to your businesses!');
  renderShops();
}

/* ============================================================
   Entry point — pages.js renderShops() delegates here.
   ============================================================ */
function renderBusinesses(kind) {
  var el = $('shopsBody'); if (!el) return;
  if (kind === 'register') return renderBusinessRegister(el);
  if (kind === 'my') return renderMyBusiness(el);
  var savedOnly = (kind === 'saved');
  var crumb = savedOnly ? 'Saved Businesses' : 'Browse Local Businesses & Club Partners';
  var sub = savedOnly ? 'The local partners you’ve saved for quick access.'
    : 'Explore student discounts, local sponsorships, and exclusive club perks in your area.';
  el.innerHTML =
    '<div class="page-head centered"><h1>' + escHtml(crumb) + '</h1>' +
      '<p>' + escHtml(sub) + '</p></div>' +
    (savedOnly ? '' : businessFilterBar()) +
    '<div id="bizGrid" class="grid"></div>';
  if (_bizCache) return paintBusinessGrid(savedOnly);
  $('bizGrid').innerHTML = '<p class="form-note" style="grid-column:1/-1;text-align:center;padding:40px">Loading partners…</p>';
  sbFetchBusinesses().then(function (rows) { _bizCache = rows || []; _bizError = null; paintBusinessGrid(savedOnly); })
    .catch(function (e) { _bizError = e.message; var g = $('bizGrid'); if (g) g.innerHTML = '<p class="form-note" style="grid-column:1/-1;text-align:center;padding:40px">' + escHtml(e.message) + '</p>'; });
}
function businessFilterBar() {
  var pills = ['All'].concat(BIZ_CATEGORIES).map(function (c) {
    return '<button class="cat-pill' + (bizState.cat === c ? ' active' : '') + '" onclick="setBizFilter(\'cat\',\'' + escAttr(c) + '\')">' + escHtml(c) + '</button>';
  }).join('');
  var perkOpts = '<option value="All">All perk types</option>' + Object.keys(PERK_FILTER_LABELS).map(function (k) {
    return '<option value="' + k + '"' + (bizState.perk === k ? ' selected' : '') + '>' + PERK_FILTER_LABELS[k] + '</option>';
  }).join('');
  var sortOpts = [['az', 'Alphabetical (A → Z)'], ['new', 'Newest Partners']].map(function (o) {
    return '<option value="' + o[0] + '"' + (bizState.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  }).join('');
  return '<div class="toolbar"><div class="search"><span class="ico">⌕</span>' +
      '<input type="text" placeholder="Search by business name, city, zip code, or student discount..." value="' + escAttr(bizState.q) + '" oninput="setBizFilter(\'q\',this.value)"></div>' +
      '<select class="select" onchange="setBizFilter(\'perk\',this.value)">' + perkOpts + '</select>' +
      '<select class="select" onchange="setBizFilter(\'sort\',this.value)">' + sortOpts + '</select></div>' +
    '<div class="cat-row">' + pills + '</div>';
}
function setBizFilter(k, v) { bizState[k] = v; renderShops(); }
function paintBusinessGrid(savedOnly) {
  var g = $('bizGrid'); if (!g) return;
  var list = (_bizCache || []).slice();
  if (savedOnly) { var s = loadSavedBiz(); list = list.filter(function (b) { return s.indexOf(b.id) !== -1; }); }
  else {
    if (bizState.cat !== 'All') list = list.filter(function (b) { return b.category === bizState.cat; });
    if (bizState.perk !== 'All') list = list.filter(function (b) { return b.perk_type === bizState.perk; });
    var q = bizState.q.trim().toLowerCase();
    if (q) list = list.filter(function (b) {
      return (b.name + ' ' + b.city + ' ' + b.zip + ' ' + b.perk_description + ' ' + b.category).toLowerCase().indexOf(q) !== -1;
    });
    list.sort(bizState.sort === 'new'
      ? function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }
      : function (a, b) { return (a.name || '').localeCompare(b.name || ''); });
  }
  if (!list.length) {
    g.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">🏪</div><p>' +
      (savedOnly ? 'No saved businesses yet — tap ☆ Save on any partner to keep it here.'
                 : 'No partners match your filters yet.') + '</p></div>';
    return;
  }
  g.innerHTML = list.map(businessCard).join('');
}
function businessCard(b) {
  var m = bizCatMeta(b.category), saved = isBizSaved(b.id);
  var coverBg = b.banner ? 'background:center/cover no-repeat url(' + escAttr(b.banner) + ')' : 'background:' + m.grad;
  return '<article class="card biz-card">' +
    '<div class="card-cover" style="' + coverBg + '" onclick="openBusiness(\'' + b.id + '\')">' +
      (b.banner ? '' : '<span class="cover-mark">' + m.icon + '</span>') +
      '<span class="cover-cat">' + escHtml(b.category) + '</span>' +
      (b.partnership_open ? '<span class="partner-badge" title="Open to club partnerships"><span class="bv-ico">🤝</span><span class="bv-label">Open to partnerships</span></span>' : '') +
      '<span class="verified-badge" title="Verified Partner"><span class="bv-ico">✓</span><span class="bv-label">Verified Partner</span></span></div>' +
    '<div class="card-body">' +
      (typeof partnershipBadge === 'function' ? partnershipBadge('business', b.id) : '') +
      '<div class="card-title" onclick="openBusiness(\'' + b.id + '\')"><h3>' + escHtml(b.name) + '</h3></div>' +
      '<div class="card-meta">📍 ' + escHtml(b.city) + ', CA ' + escHtml(b.zip) + '</div>' +
      '<div class="perk-box"><span class="perk-tag">' + escHtml(PERK_TYPES[b.perk_type] || 'Perk') + '</span>' +
        '<p>' + escHtml(b.perk_description) + '</p></div>' +
      '<div class="card-foot">' +
        '<button class="fav-btn ' + (saved ? 'on' : '') + '" onclick="toggleBizSave(\'' + b.id + '\')">' + bookmarkSvg(saved) + (saved ? 'Saved' : 'Save Business') + '</button>' +
        '<button class="btn primary" onclick="openBusiness(\'' + b.id + '\')">View Details</button>' +
      '</div></div></article>';
}

/* ============================================================
   BUSINESS PROFILE — full-width, Yelp-style page
   ============================================================ */
var currentBiz = null, _bizReviews = [], _bizSlide = 0, _bizSlideTimer = null;

function openBusiness(id) {
  showView('business');
  var b = (_bizCache || []).find(function (x) { return x.id === id; });
  var go = function (biz) { currentBiz = biz; renderBusinessPage(biz); loadBizReviews(id); };
  if (b) { go(b); }
  else {
    $('businessBody').innerHTML = '<div class="biz-wrap"><p class="form-note" style="padding:40px;text-align:center">Loading…</p></div>';
    sbRest('businesses?id=eq.' + id + '&status=eq.verified&select=*').then(function (rows) {
      if (rows && rows[0]) go(rows[0]); else $('businessBody').innerHTML = '<div class="biz-wrap"><p class="form-note" style="padding:40px;text-align:center">This business isn’t available.</p></div>';
    });
  }
}
function backFromBusiness() { if (_bizSlideTimer) clearInterval(_bizSlideTimer); openShops('browse'); }

/* Slides: real photos if present, else branded promo panels (a place to advertise) */
function bizSlides(b) {
  var m = bizCatMeta(b.category);
  if (b.photos && b.photos.length) return b.photos.map(function (u) { return { img: u }; });
  var promos = [b.perk_description, (b.cuisines || []).join(' · ') || b.category, 'Proud Student Club Hub partner'];
  return promos.map(function (txt, i) {
    return { grad: 'linear-gradient(' + (120 + i * 30) + 'deg,' + (i % 2 ? '#005f7d,#003249' : '#0a94ba,#00617f') + ')', icon: m.icon, txt: txt };
  });
}
function renderBusinessPage(b) {
  var slides = bizSlides(b), saved = isBizSaved(b.id);
  var cuisines = (b.cuisines || []).length ? (b.cuisines || []).join('  •  ') : b.category;
  var ratingLine = (b.review_count > 0)
    ? starRow(b.rating || 0, 'sm') + '<strong>' + Number(b.rating || 0).toFixed(1) + '</strong>' +
      '<span class="biz-rev-count">(' + b.review_count + ' review' + (b.review_count === 1 ? '' : 's') + ')</span>'
    : '<span class="biz-rev-count">New partner — be the first to review</span>';
  var hero =
    '<div class="biz-slideshow" id="bizSlideshow">' +
      slides.map(function (s, i) {
        return '<div class="biz-slide' + (i === 0 ? ' active' : '') + '" style="' +
          (s.img ? 'background-image:url(' + escAttr(s.img) + ')' : 'background:' + s.grad) + '">' +
          (s.img ? '' : '<span class="biz-slide-ico">' + s.icon + '</span><span class="biz-slide-txt">' + escHtml(s.txt || '') + '</span>') + '</div>';
      }).join('') +
      '<div class="biz-slide-scrim"></div>' +
      (slides.length > 1 ? '<button class="lb-btn biz-sl-prev" onclick="bizSlideStep(-1)">‹</button><button class="lb-btn biz-sl-next" onclick="bizSlideStep(1)">›</button>' : '') +
      '<button class="biz-seeall" onclick="scrollToBizPhotos()">▦ See all ' + slides.length + ' photos</button>' +
      '<div class="biz-hero-info container">' +
        '<h1>' + escHtml(b.name) + '</h1>' +
        '<div class="biz-rating">' + ratingLine + '</div>' +
        '<div class="biz-tagline"><span class="biz-verified" tabindex="0"><span class="bv-ico">✓</span><span class="bv-label">Verified Partner</span></span>' +
          (b.partnership_open ? '<span class="biz-partner-pill">🤝 Open to partnerships</span>' : '') +
          '<span class="biz-cuisines">' + escHtml(cuisines) + '</span></div>' +
      '</div>' +
    '</div>';

  var actions = '<div class="biz-actionbar container">' +
    '<button class="btn primary" onclick="openBizReview(\'' + b.id + '\')">★ Write a Review</button>' +
    '<button class="btn ghost" onclick="shareBusiness(\'' + b.id + '\')">🔗 Share</button>' +
    '<button class="btn ghost fav-line ' + (saved ? 'on' : '') + '" onclick="toggleBizSave(\'' + b.id + '\')">' + bookmarkSvg(saved) + (saved ? 'Saved' : 'Save') + '</button>' +
    '<button class="btn blue" onclick="openReachOut(\'business\',\'' + b.id + '\')">💬 Reach Out</button>' +
    (isBizOwner(b) ? '<button class="btn primary" onclick="openBizEditor(\'' + b.id + '\')">✏️ Edit listing</button>' : '') +
  '</div>';

  var perk = '<div class="perk-box big"><span class="perk-tag">' + escHtml(PERK_TYPES[b.perk_type] || 'Perk') + '</span>' +
    '<p><strong>Student perk:</strong> ' + escHtml(b.perk_description) + '</p>' +
    '<p class="form-note" style="margin-top:6px">How to redeem: ' + escHtml(b.redemption_instructions) + '</p></div>';

  // Combined media (uploaded slideshow photos + gallery) for the Photos & Videos section
  _bizGalleryMedia = (b.photos || []).concat(b.gallery || []);
  var media = _bizGalleryMedia;
  var galleryBlock = media.length ? (
    '<div class="section-title" id="bizPhotos">Photos &amp; Videos</div>' +
    '<div class="biz-photostrip">' + media.slice(0, 8).map(function (src, i) {
      var vid = isVideoSrc(src), more = (i === 7 && media.length > 8);
      var bg = vid ? 'background:#0a222d' : 'background-image:url(' + escAttr(src) + ')';
      var click = more ? 'openBizGalleryPage(\'' + b.id + '\')' : 'openBizLightbox(_bizGalleryMedia,' + i + ')';
      return '<div class="biz-photo' + (more ? ' more' : '') + '" onclick="' + click + '" style="' + bg + '">' +
        (vid ? '<span>▶</span>' : '') + (more ? '<div class="more-overlay">+' + (media.length - 8) + '</div>' : '') + '</div>';
    }).join('') + '</div>' +
    (media.length > 8 ? '<button class="btn ghost" style="margin-top:10px" onclick="openBizGalleryPage(\'' + b.id + '\')">View all ' + media.length + ' photos &amp; videos →</button>' : '')
  ) : '';
  var main = '<div class="biz-main">' +
    perk +
    (b.about ? '<div class="section-title">About the Business</div><p class="biz-about">' + escHtml(b.about) + '</p>' : '') +
    galleryBlock +
  '</div>';

  // Reviews are a full-width band at the VERY bottom, below both columns.
  var reviews = '<div class="biz-reviews-full">' +
    '<div class="reviews-head"><div><div class="section-title" style="margin:0">Ratings & Reviews</div>' +
      (b.review_count > 0 ? '<div class="rating-line">' + starRow(b.rating || 0) + '<strong>' + Number(b.rating || 0).toFixed(1) + '</strong><span class="form-note">· ' + b.review_count + ' review' + (b.review_count === 1 ? '' : 's') + '</span></div>' : '<div class="form-note">No reviews yet.</div>') +
      '</div><button class="btn primary" onclick="openBizReview(\'' + b.id + '\')">Write a Review</button></div>' +
    '<div id="bizReviews"><p class="form-note">Loading reviews…</p></div></div>';

  var side = '<aside class="biz-side">' +
    hoursCard(b) +
    '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Contact & Location</div>' +
      infoLine('Address', (b.address ? b.address + ', ' : '') + b.city + ', CA ' + b.zip) +
      (b.phone ? infoLine('Phone', b.phone) : '') +
      (b.website ? '<div class="info-line"><span class="k">Website</span><a class="link" href="' + escAttr(b.website) + '" target="_blank" rel="noopener">' + escHtml((b.website || '').replace(/^https?:\/\//, '')) + '</a></div>' : '') +
      '<a class="btn ghost block" style="margin-top:10px" href="https://maps.google.com/?q=' + encodeURIComponent((b.address || '') + ' ' + b.city + ' ' + b.zip) + '" target="_blank" rel="noopener">🧭 Get Directions</a>' +
      (b.phone ? '<a class="btn ghost block" style="margin-top:8px" href="tel:' + escAttr((b.phone || '').replace(/[^0-9+]/g, '')) + '">📞 Call</a>' : '') +
    '</div>' +
    '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Partner with this business</div>' +
      '<p class="form-note" style="margin-bottom:10px">Club officers can reach out about sponsorships, discounts, or events — and businesses can reply.</p>' +
      '<button class="btn blue block" onclick="openReachOut(\'business\',\'' + b.id + '\')">💬 Reach Out</button></div>' +
  '</aside>';

  $('businessBody').innerHTML = hero +
    '<div class="biz-wrap"><button class="back-pill" onclick="backFromBusiness()">← Back to Businesses</button>' +
      actions + '<div class="biz-grid">' + main + side + '</div>' + reviews + '</div>';
  _bizSlide = 0; startBizSlideshow(slides.length);
  window.scrollTo({ top: 0 });
}
function hoursCard(b) {
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var jsMap = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
  var todayKey = jsMap[new Date().getDay()];
  var h = b.hours || {};
  var status = bizOpenNow(h, todayKey);
  var statusHtml = status && status.open != null
    ? '<span class="biz-open ' + (status.open ? 'yes' : 'no') + '">' + (status.open ? 'Open now' : 'Closed now') + '</span>' : '';
  var rows = days.map(function (d) {
    return '<div class="hours-row' + (d === todayKey ? ' today' : '') + '"><span>' + d + '</span><span>' + escHtml(h[d] || '—') + '</span></div>';
  }).join('');
  return '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Hours ' + statusHtml + '</div>' + rows + '</div>';
}
function bizOpenNow(h, todayKey) {
  var span = h && h[todayKey]; if (!span || /closed/i.test(span)) return { open: false };
  var p = span.split('-'); if (p.length < 2) return { open: null };
  var o = parseClock(p[0]), c = parseClock(p[1]); if (o == null || c == null) return { open: null };
  var now = new Date(), mins = now.getHours() * 60 + now.getMinutes();
  return { open: c > o ? (mins >= o && mins < c) : (mins >= o || mins < c) };
}
function parseClock(s) { var m = (s || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i); if (!m) return null; var h = (+m[1]) % 12; if (/pm/i.test(m[3])) h += 12; return h * 60 + (+m[2]); }

/* Slideshow controls */
function startBizSlideshow(n) { if (_bizSlideTimer) clearInterval(_bizSlideTimer); if (n > 1) _bizSlideTimer = setInterval(function () { bizSlideStep(1); }, 4500); }
function bizSlideStep(d) {
  var slides = document.querySelectorAll('#bizSlideshow .biz-slide'); if (!slides.length) return;
  slides[_bizSlide].classList.remove('active');
  _bizSlide = (_bizSlide + d + slides.length) % slides.length;
  slides[_bizSlide].classList.add('active');
}
function bizGoSlide(i) { var slides = document.querySelectorAll('#bizSlideshow .biz-slide'); if (!slides.length) return; slides[_bizSlide].classList.remove('active'); _bizSlide = i % slides.length; slides[_bizSlide].classList.add('active'); scrollToTopSmooth(); }
function scrollToTopSmooth() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
function scrollToBizPhotos() { var el = $('bizPhotos'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function shareBusiness(id) {
  var link = location.origin + location.pathname + '#biz=' + id;
  try { if (navigator.clipboard) navigator.clipboard.writeText(link); toast('Business link copied!'); } catch (e) { toast(link); }
}

/* Media lightbox + full "View all" gallery page (reuses the club lightbox/gallery-page shells) */
var _bizGalleryMedia = [];
function openBizLightbox(arr, i) {
  lightboxSet = (arr && arr.length ? arr : _bizGalleryMedia).slice();
  lightboxIndex = Math.max(0, Math.min(i || 0, lightboxSet.length - 1));
  renderLightbox(); $('lightbox').classList.remove('hidden'); document.body.style.overflow = 'hidden';
}
function openBizGalleryPage(id) {
  var b = currentBiz || _bizOwned[id] || (_bizCache || []).find(function (x) { return x.id === id; }); if (!b) return;
  var media = (b.photos || []).concat(b.gallery || []); _bizGalleryMedia = media; if (!media.length) return;
  var items = media.map(function (src, i) {
    var vid = isVideoSrc(src);
    return '<div class="gp-item" onclick="openBizLightbox(_bizGalleryMedia,' + i + ')">' +
      (vid ? '<video src="' + escAttr(src) + '#t=0.1" muted playsinline preload="metadata"></video><span class="vid-badge">▶</span>' : '<img src="' + escAttr(src) + '" alt="" loading="lazy">') + '</div>';
  }).join('');
  var el = $('galleryPage'); if (!el) return;
  el.innerHTML = '<div class="gp-head"><button class="back-pill" onclick="closeGalleryPage()">' + t('back') + '</button>' +
    '<h2 class="gp-title">' + escHtml(b.name) + '</h2></div><div class="gp-grid">' + items + '</div>';
  el.classList.remove('hidden'); document.body.style.overflow = 'hidden';
}

/* Reviews */
function loadBizReviews(id) {
  sbRest('biz_reviews?business_id=eq.' + id + '&select=*&order=created_at.desc').then(function (rows) {
    _bizReviews = rows || []; paintBizReviews();
  }).catch(function () { var el = $('bizReviews'); if (el) el.innerHTML = '<p class="form-note">Couldn’t load reviews.</p>'; });
}
function paintBizReviews() {
  var el = $('bizReviews'); if (!el) return;
  if (!_bizReviews.length) { el.innerHTML = '<p class="form-note" style="padding:8px 0">No reviews yet — be the first!</p>'; return; }
  el.innerHTML = _bizReviews.map(function (r) {
    return '<div class="review"><div class="review-top">' + avatarHTML(r.author, 'sm') +
      '<div class="review-who"><div class="n">' + escHtml(r.author) + '</div>' + starRow(r.rating, 'sm') + '</div>' +
      (r.created_at ? '<span class="review-time">' + escHtml(timeAgo(new Date(r.created_at).getTime())) + '</span>' : '') + '</div>' +
      '<p class="review-text">' + escHtml(r.text) + '</p></div>';
  }).join('');
}
var _bizReviewRating = 0, _bizReviewFor = null;
function openBizReview(id) {
  _bizReviewFor = id; _bizReviewRating = 0;
  $('bizBody').innerHTML =
    '<div class="modal-pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">Write a Review</h3><button class="icon-btn" onclick="closeBiz()">✕</button></div>' +
    '<div id="bizRevErr" class="auth-error hidden"></div>' +
    '<div class="field"><label>Your name</label><input id="brName" type="text" value="' + escAttr(currentUser ? currentUser.name : '') + '" placeholder="Your name"></div>' +
    '<div class="field"><label>Your rating</label><div id="brStars" class="star-picker">' +
      [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-v="' + i + '" onclick="setBizStars(' + i + ')">' + ICON_STAR + '</button>'; }).join('') + '</div></div>' +
    '<div class="field"><label>Your review</label><textarea id="brText" placeholder="What was your experience?"></textarea></div>' +
    '<button id="brSubmit" class="btn primary block lg" onclick="submitBizReview()">Post Review</button></div>';
  openOverlay('bizOverlay');
}
function setBizStars(v) { _bizReviewRating = v; document.querySelectorAll('#brStars button').forEach(function (b) { b.classList.toggle('on', parseInt(b.dataset.v, 10) <= v); }); }
function submitBizReview() {
  var name = ($('brName').value || '').trim(), text = ($('brText').value || '').trim();
  var e = $('bizRevErr'); var err = function (m) { e.textContent = m; e.classList.remove('hidden'); };
  if (!name) return err('Please enter your name.');
  if (!_bizReviewRating) return err('Pick a star rating.');
  if (!text) return err('Write a short review.');
  authBusy2('brSubmit', true, 'Posting…');
  sbRest('biz_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ business_id: _bizReviewFor, author: name, rating: _bizReviewRating, text: text }) })
    .then(function () { closeBiz(); toast('Thanks! Your review has been posted.'); loadBizReviews(_bizReviewFor); })
    .catch(function (ex) { authBusy2('brSubmit', false); err(ex.message); });
}

/* Club ↔ business connect */
var _bcClubOpts = '';
function openConnectBiz(id) {
  var b = currentBiz || (_bizCache || []).find(function (x) { return x.id === id; }); if (!b) b = { id: id, name: 'this business' };
  _bcClubOpts = (typeof CLUBS !== 'undefined' ? CLUBS.slice().sort(function (a, c) { return a.name.localeCompare(c.name); }).map(function (c) { return '<option>' + escHtml(c.name) + '</option>'; }).join('') : '');
  $('bizBody').innerHTML =
    '<div class="modal-pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">Reach out to ' + escHtml(b.name) + '</h3><button class="icon-btn" onclick="closeBiz()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:14px">Introduce yourself about a sponsorship, discount, or event. They can reply by email.</p>' +
    '<div id="bcErr" class="auth-error hidden"></div>' +
    '<div class="field"><label>Your name</label><input id="bcName" type="text" value="' + escAttr(currentUser ? currentUser.name : '') + '" placeholder="Your name"></div>' +
    '<div class="field"><label>Your email</label><input id="bcEmail" type="email" value="' + escAttr(currentUser ? currentUser.email : '') + '" placeholder="you@school.edu"></div>' +
    '<div class="field"><label>I’m reaching out as</label><select id="bcKind" class="select block-select" onchange="bcKindChange()">' +
      '<option value="student">A student</option><option value="business">A business owner</option><option value="member">A community member</option></select></div>' +
    '<div id="bcCond"></div>' +
    '<div class="field"><label>Message</label><textarea id="bcMsg" placeholder="Hi! Our club would love to partner on..."></textarea></div>' +
    '<button id="bcSubmit" class="btn primary block lg" onclick="submitConnect(\'' + b.id + '\')">Send message</button></div>';
  bcKindChange();
  openOverlay('bizOverlay');
}
/* The last field morphs with the selected role: Student→Club, Business owner→Business, Member→(nothing) */
function bcKindChange() {
  var kind = ($('bcKind') && $('bcKind').value) || 'student', w = $('bcCond'); if (!w) return;
  if (kind === 'student') w.innerHTML = '<div class="field"><label>Club (optional)</label><select id="bcExtra" class="select block-select"><option value="">— None —</option>' + _bcClubOpts + '</select></div>';
  else if (kind === 'business') w.innerHTML = '<div class="field"><label>Your business</label><input id="bcExtra" type="text" placeholder="Business name"></div>';
  else w.innerHTML = '';
}
function submitConnect(id) {
  var name = ($('bcName').value || '').trim(), email = ($('bcEmail').value || '').trim(), msg = ($('bcMsg').value || '').trim();
  var kind = ($('bcKind') && $('bcKind').value) || 'student';
  var e = $('bcErr'); var err = function (m) { e.textContent = m; e.classList.remove('hidden'); };
  if (!name) return err('Please enter your name.');
  if (!(typeof isValidEmail === 'function' ? isValidEmail(email) : /@/.test(email))) return err('Enter a valid email so they can reply.');
  if (!msg) return err('Write a short message.');
  authBusy2('bcSubmit', true, 'Sending…');
  sbRest('biz_connections', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
    business_id: id, from_name: name, from_email: email, from_kind: kind,
    club_name: ($('bcExtra') && $('bcExtra').value) || null, message: msg }) })
    .then(function () { closeBiz(); toast('Message sent! They can reply to ' + email + '.'); })
    .catch(function (ex) { authBusy2('bcSubmit', false); err(ex.message); });
}
function closeBiz() { closeOverlay('bizOverlay'); }
function closeBusiness() { closeOverlay('bizOverlay'); }

/* ---------- Registration form ---------- */
function renderBusinessRegister(el) {
  var catOpts = '<option value="">Select a category…</option>' + BIZ_CATEGORIES.map(function (c) { return '<option>' + escHtml(c) + '</option>'; }).join('');
  var perkOpts = Object.keys(PERK_TYPES).map(function (k) { return '<option value="' + k + '">' + PERK_TYPES[k] + '</option>'; }).join('');
  var clubOpts = '<option value="">None — I’m not partnered with a club yet</option>' +
    (typeof CLUBS !== 'undefined' ? CLUBS.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) {
      return '<option value="' + escAttr(c.clubId || c.id) + '">' + escHtml(c.name) + '</option>'; }).join('') : '');
  el.innerHTML =
    '<div class="page-head centered"><span class="hero-kicker">Local Businesses</span><h1>Partner / List Your Business</h1>' +
      '<p>Offer student perks and support nearby clubs. Submissions are reviewed before going live.</p></div>' +
    '<div class="form-card" style="margin:0 auto 40px" id="bizForm">' +
      '<div id="bizFormErr" class="auth-error hidden"></div>' +
      field2('bizName', 'Business name *', 'text', 'e.g. Boba Time') +
      '<div class="field"><label>Category *</label><select id="bizCat" class="select block-select">' + catOpts + '</select></div>' +
      field2('bizAddr', 'Street address', 'text', '123 Main St') +
      '<div class="two-col">' + field2('bizCity', 'City *', 'text', 'Palos Verdes') + field2('bizZip', 'Zip code *', 'text', '90274') + '</div>' +
      field2('bizEmail', 'Business contact email *', 'email', 'owner@business.com') +
      '<div class="field"><label>Perk type *</label><select id="bizPerkType" class="select block-select">' + perkOpts + '</select></div>' +
      '<div class="field"><label>Student perk description *</label><textarea id="bizPerk" placeholder="e.g. 15% off any drink with a valid student ID"></textarea></div>' +
      '<div class="field"><label>How students redeem it *</label><textarea id="bizRedeem" placeholder="e.g. Show your student ID at checkout."></textarea></div>' +
      '<div class="field"><label>Partnered club (optional)</label><select id="bizClub" class="select block-select">' + clubOpts + '</select>' +
        '<p class="form-note" style="margin-top:6px">Linking a club speeds up verification once club co-verification is live.</p></div>' +
      '<div class="field"><label>What are you here for?</label><select id="bizGoal" class="select block-select">' +
        '<option value="both">Offer a student perk AND partner with clubs</option>' +
        '<option value="advertise">Just advertise my business</option>' +
        '<option value="partner">Open to club partnerships / sponsorships</option></select></div>' +
      '<label class="toggle-row" style="cursor:pointer;margin-bottom:14px"><div><div class="tr-title">🤝 Open to club partnerships</div>' +
        '<div class="form-note">Show a badge so clubs know they can reach out about sponsorships.</div></div>' +
        '<input type="checkbox" id="bizPartnerOpen" checked style="width:20px;height:20px"></label>' +
      '<button id="bizSubmit" class="btn primary block lg" onclick="submitBusiness()">Submit for review</button>' +
    '</div>';
}
function field2(id, label, type, ph) {
  return '<div class="field"><label>' + escHtml(label) + '</label><input id="' + id + '" type="' + type + '" placeholder="' + escAttr(ph) + '"></div>';
}
function bizErr(msg) { var e = $('bizFormErr'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } }
function submitBusiness() {
  var g = function (id) { return ($(id) && $(id).value || '').trim(); };
  var name = g('bizName'), cat = g('bizCat'), city = g('bizCity'), zip = g('bizZip'), email = g('bizEmail'),
      perk = g('bizPerk'), redeem = g('bizRedeem');
  if (!name) return bizErr('Please enter your business name.');
  if (!cat) return bizErr('Please choose a category.');
  if (!city || !zip) return bizErr('City and zip code are required.');
  if (!(typeof isValidEmail === 'function' ? isValidEmail(email) : /@/.test(email))) return bizErr('Enter a valid contact email.');
  if (!perk) return bizErr('Describe the student perk you’re offering.');
  if (!redeem) return bizErr('Explain how students redeem the perk.');
  var payload = {
    name: name, category: cat, address: g('bizAddr'), city: city, zip: zip,
    perk_type: g('bizPerkType') || 'discount', perk_description: perk, redemption_instructions: redeem,
    contact_email: email, partnered_club_id: g('bizClub') || null,
    listing_goal: g('bizGoal') || 'both',
    partnership_open: !($('bizPartnerOpen') && !$('bizPartnerOpen').checked),
    owner_email: (currentUser ? currentUser.email : email),
    // TEMP: auto-approve so you can test the full flow now. Restore 'pending' when
    // club-officer/admin verification is wired up.
    status: 'verified'
  };
  authBusy2('bizSubmit', true, 'Submitting…');
  sbRegisterBusiness(payload).then(function () {
    _bizCache = null;   // force a refetch so the new listing shows immediately
    $('shopsBody').innerHTML =
      '<div class="soon-card" style="margin-top:40px"><div class="soon-ico">✅</div>' +
        '<h2>Your business is live!</h2>' +
        '<p><strong>' + escHtml(name) + '</strong> is now in the directory. (For testing, new listings publish instantly — real admin/club verification comes with owner sign-in.)</p>' +
        '<div class="soon-actions"><button class="btn primary" onclick="navShop(\'browse\')">See it in Browse Businesses</button>' +
          '<button class="btn blue" onclick="navShop(\'register\')">List Another</button></div></div>';
  }).catch(function (e) { authBusy2('bizSubmit', false); bizErr(e.message); });
}
function authBusy2(id, busy, label) {
  var b = $(id); if (!b) return;
  if (busy) { b.dataset.l = b.textContent; b.textContent = label; b.disabled = true; }
  else { if (b.dataset.l) b.textContent = b.dataset.l; b.disabled = false; }
}

/* ============================================================
   OWNER: identity (email-match MVP) + My Business dashboard + editor
   ============================================================ */
function isBizOwner(b) {
  return !!(currentUser && b && b.owner_email && currentUser.email &&
    b.owner_email.toLowerCase() === currentUser.email.toLowerCase());
}
function sbUpdateBusiness(id, patch) {
  return sbRest('businesses?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) });
}
var _bizOwned = {};

/* ---------- Media upload → Supabase Storage (returns public URL) ---------- */
var IMG_MAX = 6 * 1024 * 1024, VID_MAX = 50 * 1024 * 1024;
function sbUploadMedia(file, allowVideo) {
  var isVid = /^video\//i.test(file.type);
  if (isVid && !allowVideo) return Promise.reject(new Error('Only images are allowed here.'));
  if (!/^image\//i.test(file.type) && !isVid) return Promise.reject(new Error('Please choose an image' + (allowVideo ? ' or video' : '') + '.'));
  if (isVid && file.size > VID_MAX) return Promise.reject(new Error('Video too large (max 50 MB).'));
  if (!isVid && file.size > IMG_MAX) return Promise.reject(new Error('Image too large (max 6 MB).'));
  var ext = ((file.name.split('.').pop() || 'bin').toLowerCase().match(/[a-z0-9]+/) || ['bin'])[0];
  var path = 'biz/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  return fetch(SUPABASE_URL + '/storage/v1/object/business-media/' + path, {
    method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': file.type || 'application/octet-stream' }, body: file
  }).then(function (res) { if (!res.ok) return res.text().then(function () { throw new Error('Upload failed — try a smaller file.'); }); return SUPABASE_URL + '/storage/v1/object/public/business-media/' + path; });
}
/* Editor media working state + handlers */
var _ebBanner = '', _ebPhotos = [], _ebGallery = [];
function ebPaintMedia() {
  var bp = $('ebBannerPrev'); if (bp) bp.innerHTML = _ebBanner
    ? '<div class="eb-banner" style="background-image:url(' + escAttr(_ebBanner) + ')"><button class="mini-x" onclick="ebRemoveBanner()">✕</button></div>'
    : '<p class="form-note">No banner yet — a gradient block is used on your card.</p>';
  var pp = $('ebPhotosPrev'); if (pp) pp.innerHTML = _ebPhotos.length
    ? _ebPhotos.map(function (u, i) { return '<div class="biz-photo" style="background-image:url(' + escAttr(u) + ')"><button class="mini-x" onclick="ebRemovePhoto(' + i + ')">✕</button></div>'; }).join('')
    : '<p class="form-note" style="grid-column:1/-1">No slideshow images yet.</p>';
  var gp = $('ebGalleryPrev'); if (gp) gp.innerHTML = _ebGallery.length
    ? _ebGallery.map(function (u, i) { var vid = isVideoSrc(u); return '<div class="biz-photo" style="' + (vid ? 'background:#0a222d' : 'background-image:url(' + escAttr(u) + ')') + '">' + (vid ? '<span>▶</span>' : '') + '<button class="mini-x" onclick="ebRemoveGallery(' + i + ')">✕</button></div>'; }).join('')
    : '<p class="form-note" style="grid-column:1/-1">No gallery media yet.</p>';
}
function ebUploadBanner(e) { var f = e.target.files[0]; e.target.value = ''; if (!f) return; toast('Uploading…'); sbUploadMedia(f, false).then(function (u) { _ebBanner = u; ebPaintMedia(); toast('Banner uploaded.'); }).catch(function (ex) { toast(ex.message); }); }
function ebRemoveBanner() { _ebBanner = ''; ebPaintMedia(); }
function ebUploadPhotos(e) {
  Array.prototype.slice.call(e.target.files).forEach(function (f) {
    if (_ebPhotos.length >= 10) { toast('Up to 10 slideshow images.'); return; }
    toast('Uploading…'); sbUploadMedia(f, false).then(function (u) { if (_ebPhotos.length < 10) { _ebPhotos.push(u); ebPaintMedia(); } }).catch(function (ex) { toast(ex.message); });
  });
  e.target.value = '';
}
function ebRemovePhoto(i) { _ebPhotos.splice(i, 1); ebPaintMedia(); }
function ebUploadGallery(e) {
  Array.prototype.slice.call(e.target.files).forEach(function (f) {
    toast('Uploading…'); sbUploadMedia(f, true).then(function (u) { _ebGallery.push(u); ebPaintMedia(); }).catch(function (ex) { toast(ex.message); });
  });
  e.target.value = '';
}
function ebRemoveGallery(i) { _ebGallery.splice(i, 1); ebPaintMedia(); }

function renderMyBusiness(el) {
  if (!currentUser) {
    el.innerHTML = '<div class="page-head centered"><h1>My Business</h1><p>Sign in to manage your storefront.</p></div>' +
      '<div class="soon-card"><div class="soon-ico">🔒</div><h2>Sign in required</h2>' +
      '<p>Log in with the email you used to list your business, then you can edit your storefront here.</p>' +
      '<div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button>' +
        '<button class="btn blue" onclick="navShop(\'register\')">List a Business</button></div></div>';
    return;
  }
  el.innerHTML = '<div class="page-head centered"><h1>My Business</h1><p>Edit your storefront, perks, hours, and partnership settings.</p></div>' +
    '<div id="myBizList" class="grid"><p class="form-note" style="grid-column:1/-1;text-align:center;padding:40px">Loading your listings…</p></div>';
  sbRest('businesses?owner_email=eq.' + encodeURIComponent(currentUser.email.toLowerCase()) + '&select=*&order=created_at.desc')
    .then(function (rows) {
      var g = $('myBizList'); if (!g) return;
      if (!rows || !rows.length) {
        g.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">🏪</div>' +
          '<p>You haven’t listed a business yet — list one and it appears here to manage.</p>' +
          '<button class="btn primary" style="margin-top:12px" onclick="navShop(\'register\')">List Your Business</button></div>';
        return;
      }
      rows.forEach(function (r) { _bizOwned[r.id] = r; });
      g.innerHTML = rows.map(function (b) {
        var m = bizCatMeta(b.category);
        return '<article class="card biz-card"><div class="card-cover" style="background:' + m.grad + '">' +
          '<span class="cover-mark">' + m.icon + '</span><span class="cover-cat">' + escHtml(b.category) + '</span></div>' +
          '<div class="card-body"><div class="card-title"><h3>' + escHtml(b.name) + '</h3></div>' +
          '<div class="card-meta">📍 ' + escHtml(b.city) + ', CA ' + escHtml(b.zip) + '</div>' +
          '<div class="card-foot"><button class="btn primary" onclick="openBizEditor(\'' + b.id + '\')">✏️ Edit listing</button>' +
          '<button class="btn blue" onclick="openBusiness(\'' + b.id + '\')">View</button></div></div></article>';
      }).join('');
    }).catch(function (e) { var g = $('myBizList'); if (g) g.innerHTML = '<p class="form-note" style="grid-column:1/-1;text-align:center;padding:40px">' + escHtml(e.message) + '</p>'; });
}
function openBizEditor(id) {
  var b = _bizOwned[id] || (_bizCache || []).find(function (x) { return x.id === id; });
  showView('shops'); currentShopKind = 'my';
  if (b) return renderBizEditor(b);
  $('shopsBody').innerHTML = '<div class="form-card" style="margin:40px auto"><p class="form-note">Loading…</p></div>';
  sbRest('businesses?id=eq.' + id + '&select=*').then(function (rows) { if (rows && rows[0]) { _bizOwned[id] = rows[0]; renderBizEditor(rows[0]); } });
}
function renderBizEditor(b) {
  var el = $('shopsBody'); if (!el) return;
  if (!isBizOwner(b)) {
    el.innerHTML = '<div class="soon-card" style="margin-top:40px"><div class="soon-ico">🔒</div><h2>Not your listing</h2>' +
      '<p>You can only edit a business you listed — sign in with the contact email you used.</p>' +
      '<div class="soon-actions"><button class="btn primary" onclick="navShop(\'browse\')">Browse Businesses</button></div></div>';
    return;
  }
  _ebBanner = b.banner || ''; _ebPhotos = (b.photos || []).slice(); _ebGallery = (b.gallery || []).slice();
  var catOpts = BIZ_CATEGORIES.map(function (c) { return '<option' + (c === b.category ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('');
  var perkOpts = Object.keys(PERK_TYPES).map(function (k) { return '<option value="' + k + '"' + (k === b.perk_type ? ' selected' : '') + '>' + PERK_TYPES[k] + '</option>'; }).join('');
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], h = b.hours || {};
  var hoursRows = days.map(function (d) {
    return '<div class="hours-edit"><label>' + d + '</label><input id="eh_' + d + '" type="text" placeholder="11:00 AM - 9:00 PM  ·  or Closed" value="' + escAttr(h[d] || '') + '"></div>';
  }).join('');
  el.innerHTML =
    '<div class="page-head centered"><h1>Edit ' + escHtml(b.name) + '</h1><p>Changes go live on your listing immediately.</p></div>' +
    '<div class="form-card" style="margin:0 auto 24px" id="ebForm"><div id="ebErr" class="auth-error hidden"></div>' +
    field2v('ebName', 'Business name', b.name) +
    '<div class="field"><label>Category</label><select id="ebCat" class="select block-select">' + catOpts + '</select></div>' +
    '<div class="field"><label>About the business</label><textarea id="ebAbout" placeholder="Tell students what you offer...">' + escHtml(b.about || '') + '</textarea></div>' +
    '<div class="field"><label>Perk type</label><select id="ebPerkType" class="select block-select">' + perkOpts + '</select></div>' +
    '<div class="field"><label>Student perk</label><textarea id="ebPerk">' + escHtml(b.perk_description || '') + '</textarea></div>' +
    '<div class="field"><label>How students redeem it</label><textarea id="ebRedeem">' + escHtml(b.redemption_instructions || '') + '</textarea></div>' +
    '<div class="two-col">' + field2v('ebPhone', 'Phone', b.phone) + field2v('ebWebsite', 'Website', b.website) + '</div>' +
    field2v('ebAddr', 'Street address', b.address) +
    '<div class="two-col">' + field2v('ebCity', 'City', b.city) + field2v('ebZip', 'Zip', b.zip) + '</div>' +
    field2v('ebCuisines', 'Tags (comma-separated, e.g. Bubble Tea, Cafe)', (b.cuisines || []).join(', ')) +
    '<div class="field"><label>Hours</label><div class="hours-editor">' + hoursRows + '</div></div>' +
    '<label class="toggle-row" style="cursor:pointer;margin:6px 0 10px"><div><div class="tr-title">🤝 Open to club partnerships</div><div class="form-note">Shows the partnership badge on your listing.</div></div><input type="checkbox" id="ebPartner"' + (b.partnership_open ? ' checked' : '') + ' style="width:20px;height:20px"></label>' +
    '<label class="toggle-row" style="cursor:pointer;margin-bottom:14px"><div><div class="tr-title">🛡️ Require the “Reach Out” form</div><div class="form-note">On: people send via a short form. (Direct-message mode arrives with the Inbox.)</div></div><input type="checkbox" id="ebGate"' + (b.gate_messages !== false ? ' checked' : '') + ' style="width:20px;height:20px"></label>' +
    '<div class="modal-actions"><button class="btn ghost" onclick="navShop(\'my\')">Cancel</button>' +
    '<button id="ebSave" class="btn primary" onclick="submitBizEdit(\'' + b.id + '\')">Save changes</button></div></div>' +
    '<div class="form-card" style="margin:0 auto 40px" id="ebMedia">' +
      '<div class="section-title" style="margin-top:0">Card banner <span class="form-note">(the image on your Browse thumbnail)</span></div>' +
      '<div id="ebBannerPrev"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" hidden onchange="ebUploadBanner(event)"><span class="up-ico">⬆</span> Upload banner image</label>' +
      '<div class="section-title">Slideshow images <span class="form-note">(top of your profile — up to 10)</span></div>' +
      '<div id="ebPhotosPrev" class="biz-photostrip"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" multiple hidden onchange="ebUploadPhotos(event)"><span class="up-ico">⬆</span> Add slideshow images</label>' +
      '<div class="section-title">Gallery <span class="form-note">(photos &amp; videos)</span></div>' +
      '<div id="ebGalleryPrev" class="biz-photostrip"></div>' +
      '<label class="uploader"><input type="file" accept="image/*,video/mp4,video/webm" multiple hidden onchange="ebUploadGallery(event)"><span class="up-ico">⬆</span> Add gallery photos &amp; videos</label>' +
      '<p class="form-note" style="margin-top:10px">Changes to media save when you press <strong>Save changes</strong> above.</p>' +
    '</div>';
  ebPaintMedia();
}
function field2v(id, label, val) {
  return '<div class="field"><label>' + escHtml(label) + '</label><input id="' + id + '" type="text" value="' + escAttr(val || '') + '"></div>';
}
function submitBizEdit(id) {
  var g = function (x) { return ($(x) && $(x).value || '').trim(); };
  var e = $('ebErr'); var err = function (m) { e.textContent = m; e.classList.remove('hidden'); };
  if (!g('ebName')) return err('Business name is required.');
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hours = {};
  days.forEach(function (d) { var v = g('eh_' + d); if (v) hours[d] = v; });
  var patch = {
    name: g('ebName'), category: g('ebCat'), about: g('ebAbout'),
    perk_type: g('ebPerkType'), perk_description: g('ebPerk'), redemption_instructions: g('ebRedeem'),
    phone: g('ebPhone'), website: g('ebWebsite'), address: g('ebAddr'), city: g('ebCity'), zip: g('ebZip'),
    cuisines: g('ebCuisines') ? g('ebCuisines').split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [],
    hours: hours,
    banner: _ebBanner || null, photos: _ebPhotos, gallery: _ebGallery,
    partnership_open: !!($('ebPartner') && $('ebPartner').checked),
    gate_messages: !!($('ebGate') && $('ebGate').checked)
  };
  authBusy2('ebSave', true, 'Saving…');
  sbUpdateBusiness(id, patch).then(function (rows) {
    var updated = (rows && rows[0]) || null;
    if (updated) _bizOwned[id] = updated;
    _bizCache = null;
    toast('Saved! Your listing is updated.');
    openBusiness(id);
  }).catch(function (ex) { authBusy2('ebSave', false); err(ex.message); });
}
