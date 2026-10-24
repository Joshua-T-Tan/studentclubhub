/* ============================================================
   business.js - Local Businesses directory (MP31).
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
  'Food & Dining':        { icon: svgIcon('utensils', 22), grad: 'linear-gradient(140deg,#0f8ca0,#0a4f66)' },
  'Apparel & Merch':      { icon: svgIcon('shirt', 22), grad: 'linear-gradient(140deg,#2596be,#0a4f66)' },
  'Event Spaces':         { icon: svgIcon('ticket', 22), grad: 'linear-gradient(140deg,#2a6f97,#013a5c)' },
  'Tutoring & Test Prep': { icon: svgIcon('book', 22), grad: 'linear-gradient(140deg,#12a594,#0a5f66)' },
  'Printing & Supplies':  { icon: svgIcon('printer', 22), grad: 'linear-gradient(140deg,#4fb3c9,#007ea7)' },
  'Entertainment':        { icon: svgIcon('music', 22), grad: 'linear-gradient(140deg,#1ba3d1,#005f7d)' }
};
var PERK_TYPES = { discount: 'Student Discount', addon: 'Free Add-On', sponsorship: 'Club Sponsorship' };
var PERK_FILTER_LABELS = { discount: 'Student discounts (% off)', addon: 'Free add-ons & freebies', sponsorship: 'Club sponsorships & grants' };
function bizCatMeta(c) { return BIZ_CAT_META[c] || { icon: svgIcon('store', 22), grad: 'linear-gradient(140deg,#0a6f96,#003249)' }; }

var _bizCache = null, _bizError = null;
var bizState = { cat: 'All', perk: 'All', sort: 'az', q: '' };

/* ---------- Supabase REST (PostgREST) ---------- */
function sbRest(path, opts) {
  opts = opts || {};
  var headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
  // Always bypass the browser HTTP cache — otherwise GETs (club rosters, chat, polls) can return stale data and break live sync.
  return fetch(SUPABASE_URL + '/rest/v1/' + path, { method: opts.method || 'GET', headers: headers, body: opts.body, cache: 'no-store' })
    .then(function (res) {
      return res.text().then(function (txt) {
        var d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
        if (res.ok) return d;
        var msg = (d && (d.message || d.hint || d.details || d.error)) || ('Request failed (' + res.status + ').');
        var err = new Error(msg); err.status = res.status; throw err;
      });
    }, function () { throw new Error('Couldn’t load businesses. Check your connection and try again.'); });
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
   Entry point - pages.js renderShops() delegates here.
   ============================================================ */
function renderBusinesses(kind) {
  var el = $('shopsBody'); if (!el) return;
  if (kind === 'register') return renderBusinessRegister(el);
  if (kind === 'my') return renderMyBusiness(el);
  var savedOnly = (kind === 'saved');
  var crumb = savedOnly ? 'Saved Businesses' : 'Browse Local Businesses';
  var sub = savedOnly ? 'The local partners you’ve saved for quick access.'
    : 'Discover local business discounts, sponsorships, and student perks from shops near you.';
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
  var sortOpts = [
    ['az', 'Alphabetical (A → Z)'], ['za', 'Reverse Alphabetical (Z → A)'],
    ['new', 'Latest'], ['old', 'Oldest'],
    ['partners', 'Open to partnerships'], ['rating', 'Highest rated']
  ].map(function (o) {
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
    list = list.filter(function (b) { return !b.is_private; });   // private listings never show in public Browse
    if (bizState.cat !== 'All') list = list.filter(function (b) { return b.category === bizState.cat; });
    if (bizState.perk !== 'All') list = list.filter(function (b) { return b.perk_type === bizState.perk; });
    var q = bizState.q.trim().toLowerCase();
    if (q) list = list.filter(function (b) {
      return (b.name + ' ' + b.city + ' ' + b.zip + ' ' + b.perk_description + ' ' + b.category).toLowerCase().indexOf(q) !== -1;
    });
    var s = bizState.sort, az = function (a, b) { return (a.name || '').localeCompare(b.name || ''); };
    list.sort(function (a, b) {
      if (s === 'za') return (b.name || '').localeCompare(a.name || '');
      if (s === 'new') return (b.created_at || '').localeCompare(a.created_at || '');
      if (s === 'old') return (a.created_at || '').localeCompare(b.created_at || '');
      if (s === 'partners') return (b.partnership_open ? 1 : 0) - (a.partnership_open ? 1 : 0) || az(a, b);
      if (s === 'rating') return (b.rating || 0) - (a.rating || 0) || az(a, b);
      return az(a, b);
    });
  }
  if (!list.length) {
    g.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">' + svgIcon('store', 40) + '</div><p>' +
      (savedOnly ? 'No saved businesses yet. Tap ☆ Save on any shop and it’ll show up here.'
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
      '<button class="card-share" title="Share" onclick="event.stopPropagation(); shareBusiness(\'' + b.id + '\')">' + (typeof ICON_SHARE !== 'undefined' ? ICON_SHARE : '') + '</button>' +
      '<button class="card-flag" title="Report this business" onclick="event.stopPropagation(); openReport(\'business\',\'' + b.id + '\',\'' + escAttr(b.name) + '\')">' + (typeof ICON_FLAG !== 'undefined' ? ICON_FLAG : '') + '</button>' +
      '<span class="cover-cat">' + escHtml(b.category) + '</span></div>' +
    '<div class="card-body">' +
      '<div class="card-title" onclick="openBusiness(\'' + b.id + '\')"><h3>' + escHtml(b.name) + '</h3>' +
        (b.verified ? '<span class="name-verified-ico" title="Verified">' + verifiedSeal(17, '#e6b422', '#ffffff') + '</span>' : '') +
        (b.partnership_open ? '<span class="name-openp-ico" title="Open to partnerships">' + ICON_PARTNER + '</span>' : '') +
      '</div>' +
      '<div class="card-meta">' + svgIcon('pin', 14) + ' ' + escHtml(b.city) + ', CA ' + escHtml(b.zip) + '</div>' +
      (b.public_id ? '<div class="card-idline"><span class="club-id-chip">#' + escHtml(b.public_id) + '</span></div>' : '') +
      ((b.perk_description && b.perk_description.trim())
        ? '<div class="perk-box perk-2row"><span class="perk-tag">' + escHtml(PERK_TYPES[b.perk_type] || 'Perk') + '</span><p>' + escHtml(b.perk_description) + '</p></div>'
        : '<div class="perk-box perk-2row perk-empty"><p class="form-note">Perks coming soon — tap to view.</p></div>') +
      '<div class="card-foot">' +
        '<button class="fav-btn ' + (saved ? 'on' : '') + '" onclick="toggleBizSave(\'' + b.id + '\')">' + bookmarkSvg(saved) + (saved ? 'Saved' : 'Save Business') + '</button>' +
        '<button class="btn primary" onclick="openBusiness(\'' + b.id + '\')">View Details</button>' +
      '</div></div></article>';
}

/* ============================================================
   BUSINESS PROFILE - full-width, Yelp-style page
   ============================================================ */
var currentBiz = null, _bizReviews = [], _bizSlide = 0, _bizSlideTimer = null;

function openBusiness(id) {
  showView('business');
  _bizSlide = 0; if (_bizSlideTimer) { clearInterval(_bizSlideTimer); _bizSlideTimer = null; }   // fresh slideshow per business
  if (typeof loadPartnerAgreements === 'function') loadPartnerAgreements();   // fresh "Partnered with" + deal box
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
  var g = (b.photos || []).filter(Boolean);
  if (!g.length && b.banner) g = [b.banner];
  if (g.length) return g.map(function (u) { return { img: u }; });
  return [{ paper: true }];   // nothing uploaded → a blank sheet of paper with school doodles
}
function _fmtPerkDate(s) { try { return new Date(s + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return s; } }
function renderBusinessPage(b) {
  var slides = bizSlides(b), saved = isBizSaved(b.id), owner = isBizOwner(b);
  var cuisines = (b.cuisines || []).length ? (b.cuisines || []).join('  •  ') : b.category;
  var ratingLine = (b.review_count > 0)
    ? starRow(b.rating || 0, 'sm') + '<strong>' + Number(b.rating || 0).toFixed(1) + '</strong>' +
      '<span class="biz-rev-count">(' + b.review_count + ' review' + (b.review_count === 1 ? '' : 's') + ')</span>'
    : '';
  var hero =
    '<div class="biz-slideshow' + (slides[0] && slides[0].paper ? ' is-paper' : '') + '" id="bizSlideshow">' +
      slides.map(function (s, i) {
        if (s.paper) return '<div class="biz-slide active paper-slide">' + doodleLayer('banner') + '</div>';
        return '<div class="biz-slide' + (i === 0 ? ' active' : '') + '" style="' +
          (s.img ? 'background-image:url(' + escAttr(s.img) + ')' : 'background:' + s.grad) + '">' +
          (s.img ? '' : '<span class="biz-slide-ico">' + s.icon + '</span><span class="biz-slide-txt">' + escHtml(s.txt || '') + '</span>') + '</div>';
      }).join('') +
      '<div class="biz-slide-scrim"></div>' +
      '<button class="banner-back" onclick="backFromBusiness()">‹ Back</button>' +
      (owner ? '<button class="banner-gear" title="Page settings" onclick="editBizBanner(\'' + b.id + '\')">' + ICON_GEAR + '</button>' : '') +
      '<div class="banner-tr">' +
        '<button class="banner-ico ' + (saved ? 'on' : '') + '" title="' + (saved ? 'Saved' : 'Save') + '" onclick="toggleBizSave(\'' + b.id + '\')">' + bookmarkSvg(saved) + '</button>' +
      '</div>' +
      (slides.length > 1 ? '<button class="lb-btn biz-sl-prev" onclick="bizSlideStep(-1)">‹</button><button class="lb-btn biz-sl-next" onclick="bizSlideStep(1)">›</button>' : '') +
      '<div class="biz-hero-info container">' +
        '<div class="name-row"><h1>' + escHtml(b.name) + '</h1>' +
          '<button class="name-ico share" title="Share" onclick="shareBusiness(\'' + b.id + '\')">' + ICON_SHARE + '</button>' +
          (owner ? '' : '<button class="name-ico flag" title="Report this business" onclick="openReport(\'business\',\'' + b.id + '\',\'' + escAttr(b.name) + '\')">' + (typeof ICON_FLAG !== 'undefined' ? ICON_FLAG : '') + '</button>') + '</div>' +
        (ratingLine ? '<div class="biz-rating">' + ratingLine + '</div>' : '') +
        '<div class="biz-tagline">' +
          '<span class="biz-cuisines">' + escHtml(cuisines) + '</span>' +
          (b.verified ? '<span class="biz-verified" tabindex="0">' + verifiedSeal(18, '#ffffff', '#b8860b') + '<span class="bv-label">Verified</span></span>' : '') +
          (b.partnership_open ? '<span class="open-partner-chip">' + ICON_PARTNER + ' Open to partnerships</span>' : '') +
          (b.public_id ? '<span class="biz-idchip">#' + escHtml(b.public_id) + '</span>' : '') +
          partneredWithBadge('business', b.id) +
        '</div>' +
      '</div>' +
    '</div>';

  var actions = '';   // top reach/share/save action bar removed — those live on the banner / sidebar now

  var perk;
  var hasPerk = !!(b.perk_description && b.perk_description.trim());
  var dealPen = owner ? '<button class="deal-eye" title="Edit deal" onclick="editBizPerk(\'' + b.id + '\')">' + ICON_PEN + '</button>' : '';
  if (!hasPerk) {
    // No perk set yet (charter-first) — owner gets an actionable prompt; visitors see nothing.
    perk = owner
      ? '<div class="perk-box big deal-hidden" style="cursor:pointer" onclick="editBizPerk(\'' + b.id + '\')">' + ICON_PEN + '<span class="form-note">No deal yet — tap to add one so people can see your offer.</span></div>'
      : '';
  } else if (b.deal_hidden) {
    // Hidden: visitors see nothing; the owner sees just a slashed eye to bring it back.
    perk = owner
      ? '<div class="perk-box big deal-hidden"><button class="deal-eye" title="Your deal is hidden from visitors — click to show it again" onclick="toggleDealHidden(\'' + b.id + '\')">' + ICON_EYE_OFF + '</button>' +
          '<span class="form-note">This deal is hidden from visitors. Only you can see this.</span></div>'
      : '';
  } else {
    var audLabel = (b.perk_audience === 'everyone') ? 'Everyone' : 'Students';
    var dl = [];
    if (b.perk_start) dl.push('from ' + _fmtPerkDate(b.perk_start));
    if (b.perk_end) dl.push('through ' + _fmtPerkDate(b.perk_end));
    var dateLine = dl.length ? '<p class="form-note" style="margin-top:4px">' + svgIcon('calendar', 14) + ' Valid ' + dl.join(' ') + '</p>' : '';
    perk = '<div class="perk-box big">' +
      (owner ? '<div class="deal-ctrls">' + dealPen +
        '<button class="deal-eye" title="Hide this deal from visitors" onclick="toggleDealHidden(\'' + b.id + '\')">' + ICON_EYE + '</button>' +
        '<button class="deal-eye danger" title="Delete deal" onclick="deleteBizPerk(\'' + b.id + '\')">' + ICON_TRASH + '</button></div>' : '') +
      '<span class="perk-tag">' + escHtml(PERK_TYPES[b.perk_type] || 'Perk') + '</span> <span class="perk-aud">' + escHtml(audLabel) + '</span>' +
      '<p style="margin-top:6px"><strong>' + escHtml(b.perk_description) + '</strong></p>' +
      (b.redemption_instructions ? '<p class="form-note" style="margin-top:6px">How to redeem: ' + escHtml(b.redemption_instructions) + '</p>' : '') +
      dateLine + '</div>';
  }

  // Combined media (uploaded slideshow photos + gallery) for the Photos & Videos section
  _bizGalleryMedia = (b.photos || []).concat(b.gallery || []);
  var media = _bizGalleryMedia;
  var galTitle = '<div class="section-title has-edit" id="bizPhotos"><span>Photos &amp; Videos</span>' +
    (owner ? '<button class="sec-edit" title="Edit gallery" onclick="editBizGallery(\'' + b.id + '\')">' + ICON_PEN + '</button>' : '') + '</div>';
  var galleryBlock = media.length ? (
    galTitle +
    '<div class="biz-photostrip">' + media.slice(0, 8).map(function (src, i) {
      var vid = isVideoSrc(src), more = (i === 7 && media.length > 8);
      var bg = vid ? 'background:#0a222d' : 'background-image:url(' + escAttr(src) + ')';
      var click = more ? 'openBizGalleryPage(\'' + b.id + '\')' : 'openBizLightbox(_bizGalleryMedia,' + i + ')';
      return '<div class="biz-photo' + (more ? ' more' : '') + '" onclick="' + click + '" style="' + bg + '">' +
        (vid ? '<span>▶</span>' : '') + (more ? '<div class="more-overlay">+' + (media.length - 8) + '</div>' : '') + '</div>';
    }).join('') + '</div>' +
    (media.length > 8 ? '<button class="btn ghost" style="margin-top:10px" onclick="openBizGalleryPage(\'' + b.id + '\')">View all ' + media.length + ' photos &amp; videos →</button>' : '')
  ) : (owner ? galTitle + '<p class="form-note">No photos yet — add some with the pencil.</p>' : '');
  var aboutBlock = (b.about || owner)
    ? '<div class="section-title has-edit"><span>About the Business</span>' + (owner ? '<button class="sec-edit" title="Edit about" onclick="editBizAbout(\'' + b.id + '\')">' + ICON_PEN + '</button>' : '') + '</div>' +
      '<p class="biz-about' + (b.about ? '' : ' placeholder') + '">' + escHtml(b.about || 'Tell everyone about your business — tap the pencil to add a description.') + '</p>'
    : '';
  var main = '<div class="biz-main">' +
    perk +
    (typeof partnershipDealBox === 'function' ? partnershipDealBox('business', b, owner) : '') +
    aboutBlock +
    galleryBlock +
    bizLinksHTML(b) +
  '</div>';

  // Reviews are a full-width band at the VERY bottom, below both columns.
  var revEnabled = b.reviews_enabled !== false;
  var revToggle = owner && typeof _reviewToggleHTML === 'function' ? _reviewToggleHTML('business', b.id, revEnabled) : '';
  var reviews = '<div class="biz-reviews-full">' + revToggle +
    (revEnabled
      ? ('<div class="reviews-head"><div><div class="section-title" style="margin:0">Ratings & Reviews</div>' +
          (b.review_count > 0 ? '<div class="rating-line">' + starRow(b.rating || 0) + '<strong>' + Number(b.rating || 0).toFixed(1) + '</strong><span class="form-note">· ' + b.review_count + ' review' + (b.review_count === 1 ? '' : 's') + '</span></div>' : '<div class="form-note">No reviews yet.</div>') +
          '</div><button class="btn primary" onclick="openBizReview(\'' + b.id + '\')">Write a Review</button></div>' +
        '<div id="bizReviews"><p class="form-note">Loading reviews…</p></div>')
      : ('<div class="reviews-head"><div class="section-title" style="margin:0">Ratings & Reviews</div></div>' +
         '<p class="form-note" style="padding:10px 0">Reviews are turned off' + (owner ? ' — turn them back on above.' : ' for this business.') + '</p>')) +
    '</div>';

  var side = '<aside class="biz-side">' +
    hoursCard(b) +
    '<div class="sidebar-card"><div class="section-title has-edit" style="margin-top:0"><span>Contact & Location</span>' +
      (owner ? '<button class="sec-edit" title="Edit contact" onclick="editBizContact(\'' + b.id + '\')">' + ICON_PEN + '</button>' : '') + '</div>' +
      infoLine('Address', (b.address ? b.address + ', ' : '') + b.city + ', CA ' + b.zip) +
      (b.phone ? infoLine('Phone', b.phone) : '') +
      infoLine('Business Email', b.contact_email || '—') +
      (b.website ? '<div class="info-line"><span class="k">Website</span><a class="link" href="' + escAttr(b.website) + '" target="_blank" rel="noopener">' + escHtml((b.website || '').replace(/^https?:\/\//, '')) + '</a></div>' : '') +
      '<a class="btn ghost block" style="margin-top:10px" href="https://maps.google.com/?q=' + encodeURIComponent((b.address || '') + ' ' + b.city + ' ' + b.zip) + '" target="_blank" rel="noopener">' + svgIcon('directions', 16) + ' Get Directions</a>' +
      (b.phone ? '<a class="btn ghost block" style="margin-top:8px" href="tel:' + escAttr((b.phone || '').replace(/[^0-9+]/g, '')) + '">' + svgIcon('phone', 16) + ' Call</a>' : '') +
    '</div>' +
    '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Partner with this business</div>' +
      '<p class="form-note" style="margin-bottom:10px">Club officers can reach out about sponsorships, discounts or events. You’ll see their email and can send a partnership request.</p>' +
      '<button class="btn blue block" onclick="contactByEmail(\'business\',\'' + b.id + '\')">' + ICON_PARTNER + ' Reach Out by Email</button></div>' +
  '</aside>';

  $('businessBody').innerHTML = hero +
    '<div class="biz-wrap">' +
      actions + '<div class="biz-grid">' + main + side + '</div>' + reviews + '</div>';
  _syncBizSlides(slides.length);
  window.scrollTo({ top: 0 });
}
/* Preserve slide position + running timer across re-renders (e.g. when
   loadPartnerAgreements re-renders the page) instead of snapping back to slide 0. */
function _syncBizSlides(n) {
  var s = document.querySelectorAll('#bizSlideshow .biz-slide'); if (!s.length) return;
  if (_bizSlide >= s.length) _bizSlide = 0;
  for (var i = 0; i < s.length; i++) s[i].classList.toggle('active', i === _bizSlide);
  if (n > 1) { if (!_bizSlideTimer) startBizSlideshow(n); }
  else if (_bizSlideTimer) { clearInterval(_bizSlideTimer); _bizSlideTimer = null; }
}
/* Public links block for a business (mirrors the club "Links" section). */
function bizLinksHTML(b) {
  var owner = isBizOwner(b);
  var links = (b.links || []).filter(function (u) { return typeof isValidLink === 'function' ? isValidLink(u) : !!u; }).slice(0, 10);
  if (!links.length && !owner) return '';
  var pills = links.map(function (u) {
    var url = (typeof normalizeUrl === 'function') ? normalizeUrl(u) : u;
    var label = (typeof hostLabel === 'function') ? hostLabel(u) : u;
    return '<a class="social-pill" href="' + escAttr(url) + '" target="_blank" rel="noopener" title="' + escAttr(url) + '">' +
      '<span class="sp-ico">' + svgIcon('link', 16) + '</span><span class="sp-label">' + escHtml(label) + '</span></a>';
  }).join('');
  var pen = owner ? '<button class="sec-edit" title="Edit links" onclick="editBizLinks(\'' + b.id + '\')">' + ICON_PEN + '</button>' : '';
  return '<div class="section-title has-edit"><span>Links</span>' + pen + '</div>' +
    (links.length ? '<div class="socials socials-grid">' + pills + '</div>' : '<p class="form-note">No links yet — add some with the pencil.</p>');
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
    return '<div class="hours-row' + (d === todayKey ? ' today' : '') + '"><span>' + d + '</span><span>' + escHtml(h[d] || 'Closed') + '</span></div>';
  }).join('');
  var owner = isBizOwner(b);
  var pen = owner ? '<button class="sec-edit" title="Edit hours" onclick="editBizHours(\'' + b.id + '\')">' + ICON_PEN + '</button>' : '';
  return '<div class="sidebar-card"><div class="section-title has-edit" style="margin-top:0"><span>Hours ' + statusHtml + '</span>' + pen + '</div>' + rows + '</div>';
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
  var b = (typeof currentBiz !== 'undefined' && currentBiz && currentBiz.id === id) ? currentBiz : ((_bizCache || []).find(function (x) { return x.id === id; }) || _bizOwned[id]);
  var name = (b && b.name) || 'this business';
  var link = location.origin + location.pathname + '#biz=' + id;
  var qr = (typeof qrSvg === 'function') ? qrSvg(link, 190) : '';
  $('shareBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><h3 style="font-size:1.15rem;font-weight:800">Share ' + escHtml(name) + '</h3><button class="icon-btn" onclick="closeShare()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:14px">Copy the link, or send it straight to Instagram, Messages, and more.</p>' +
    '<div class="field"><label>Direct link</label><div class="share-link-row"><input id="shareLinkInput" type="text" readonly value="' + escAttr(link) + '">' +
      '<button class="btn primary sm-btn" onclick="copyShareLink()">' + t('copy_link') + '</button></div></div>' +
    '<button class="btn blue block" style="margin-bottom:14px" onclick="nativeShare(\'' + escAttr(link) + '\',\'' + escAttr(name) + '\')">↗ Share via…</button>' +
    '<div class="qr-wrap"><div class="qr-box">' + (qr || '<p class="form-note">Link is too long for a QR code — use the link above.</p>') + '</div>' +
      '<p class="form-note" style="text-align:center;margin-top:6px">Scan to open</p></div>';
  openOverlay('shareOverlay');
}
/* Deal visibility toggle (owner only). Hidden = visitors don't see the offer;
   the "Partnered with" banner up top is unaffected. */
function toggleDealHidden(id) {
  var b = currentBiz || _bizOwned[id] || (_bizCache || []).find(function (x) { return x.id === id; });
  if (!b || !isBizOwner(b)) return;
  var nv = !b.deal_hidden; b.deal_hidden = nv;
  if (b === currentBiz) renderBusinessPage(b);
  sbUpdateBusiness(id, { deal_hidden: nv })
    .then(function () { _bizCache = null; toast(nv ? 'Deal hidden from visitors.' : 'Deal is visible again.'); })
    .catch(function (ex) { b.deal_hidden = !nv; if (b === currentBiz) renderBusinessPage(b); toast(ex.message); });
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
  if (!_bizReviews.length) { el.innerHTML = '<p class="form-note" style="padding:8px 0">No reviews yet. Be the first!</p>'; return; }
  var owner = (typeof currentBiz !== 'undefined' && currentBiz && isBizOwner(currentBiz));
  var bizName = (currentBiz && currentBiz.name) || 'Owner';
  el.innerHTML = _bizReviews.map(function (r) {
    var reply = r.owner_reply
      ? '<div class="review-reply"><div class="rr-top">' + avatarHTML(bizName, 'sm') + '<span class="rr-name">' + escHtml(bizName) + '</span><span class="badge">Owner</span>' +
          (r.owner_reply_at ? '<span class="review-time">' + escHtml(timeAgo(new Date(r.owner_reply_at).getTime())) + '</span>' : '') +
          (owner ? '<button class="rr-del" onclick="deleteBizReply(\'' + r.id + '\')">Delete</button>' : '') +
          '</div><p class="rr-text">' + escHtml(r.owner_reply) + '</p></div>'
      : '';
    var replyBtn = (owner && !r.owner_reply) ? '<button class="review-reply-btn" onclick="openBizReply(\'' + r.id + '\')">↩ Reply</button>' :
      (owner && r.owner_reply ? '<button class="review-reply-btn" onclick="openBizReply(\'' + r.id + '\')">' + svgIcon('pen', 14) + ' Edit reply</button>' : '');
    return '<div class="review"><div class="review-top">' + avatarHTML(r.author, 'sm') +
      '<div class="review-who"><div class="n">' + escHtml(r.author) + '</div>' + starRow(r.rating, 'sm') + '</div>' +
      (r.created_at ? '<span class="review-time">' + escHtml(timeAgo(new Date(r.created_at).getTime())) + '</span>' : '') + '</div>' +
      '<p class="review-text">' + escHtml(r.text) + '</p>' + reply + replyBtn + '</div>';
  }).join('');
}
/* Owner reply to a business review */
function openBizReply(reviewId) {
  var r = (_bizReviews || []).find(function (x) { return x.id === reviewId; }); if (!r) return;
  $('bizBody').innerHTML = '<div class="modal-pad edit-modal"><div class="ro-head"><h3>Reply to review</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<div id="emErr" class="auth-error hidden"></div>' +
    '<div class="review" style="margin-bottom:12px"><div class="review-top">' + avatarHTML(r.author, 'sm') + '<div class="review-who"><div class="n">' + escHtml(r.author) + '</div>' + starRow(r.rating, 'sm') + '</div></div><p class="review-text">' + escHtml(r.text) + '</p></div>' +
    '<div class="field"><label>Your public reply</label><textarea id="bizReplyText" style="min-height:110px" placeholder="Thanks for the feedback!">' + escHtml(r.owner_reply || '') + '</textarea></div>' +
    '<button id="emSave" class="btn primary block lg" onclick="submitBizReply(\'' + reviewId + '\')">Post reply</button></div>';
  openOverlay('bizOverlay');
}
function submitBizReply(reviewId) {
  var text = ($('bizReplyText') && $('bizReplyText').value || '').trim();
  if (!text) { var e = $('emErr'); if (e) { e.textContent = 'Write a reply first.'; e.classList.remove('hidden'); } return; }
  authBusy2('emSave', true, 'Posting…');
  sbRest('biz_reviews?id=eq.' + reviewId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ owner_reply: text, owner_reply_at: new Date().toISOString() }) })
    .then(function () { closeReach(); toast('Reply posted.'); loadBizReviews(currentBiz.id); }).catch(function (ex) { authBusy2('emSave', false); var e = $('emErr'); if (e) { e.textContent = ex.message; e.classList.remove('hidden'); } });
}
function deleteBizReply(reviewId) {
  openConfirm('Delete your reply?', 'Your public reply will be removed from this review.', svgIcon('trash', 26), function () {
    sbRest('biz_reviews?id=eq.' + reviewId, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ owner_reply: null, owner_reply_at: null }) })
      .then(function () { toast('Reply removed.'); loadBizReviews(currentBiz.id); }).catch(function (ex) { toast(ex.message); });
  });
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
  if (kind === 'student') w.innerHTML = '<div class="field"><label>Club (optional)</label><select id="bcExtra" class="select block-select"><option value="">None</option>' + _bcClubOpts + '</select></div>';
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
  el.innerHTML =
    '<div class="page-head centered"><span class="hero-kicker">Local Businesses</span><h1>Register Your Business</h1>' +
      '<p>Charter the basics now — then add your student perk, hours, photos, and links from your page settings. Submissions are reviewed before going live.</p></div>' +
    '<div class="form-card" style="margin:0 auto 40px" id="bizForm">' +
      '<div id="bizFormErr" class="auth-error hidden"></div>' +
      field2('bizName', 'Business name *', 'text', 'e.g. Boba Time') +
      '<div class="field"><label>Category / type *</label><select id="bizCat" class="select block-select">' + catOpts + '</select></div>' +
      field2('bizAddr', 'Street address', 'text', '123 Main St') +
      '<div class="two-col">' + field2('bizCity', 'City *', 'text', 'Palos Verdes') + field2('bizZip', 'Zip code *', 'text', '90274') + '</div>' +
      '<div class="two-col">' + field2('bizPhone', 'Phone number *', 'tel', '(310) 555-0123') + field2('bizEmail', 'Business contact email *', 'email', 'owner@business.com') + '</div>' +
      '<p class="form-note" style="margin:2px 0 14px">Everything else — your student perk, hours, photos, links, and partnership settings — you add afterward using the gear and pencil icons on your business page.</p>' +
      '<button id="bizSubmit" class="btn primary block lg" onclick="submitBusiness()">Submit for review</button>' +
    '</div>';
}
function field2(id, label, type, ph) {
  return '<div class="field"><label>' + escHtml(label) + '</label><input id="' + id + '" type="' + type + '" placeholder="' + escAttr(ph) + '"></div>';
}
function bizErr(msg) { var e = $('bizFormErr'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } }
function submitBusiness() {
  var g = function (id) { return ($(id) && $(id).value || '').trim(); };
  var name = g('bizName'), cat = g('bizCat'), city = g('bizCity'), zip = g('bizZip'), email = g('bizEmail'), phone = g('bizPhone');
  if (!name) return bizErr('Please enter your business name.');
  if (!cat) return bizErr('Please choose a category.');
  if (!city || !zip) return bizErr('City and zip code are required.');
  if (!phone) return bizErr('A phone number is required.');
  if (!(typeof isValidEmail === 'function' ? isValidEmail(email) : /@/.test(email))) return bizErr('Enter a valid contact email.');
  var payload = {
    name: name, category: cat, address: g('bizAddr'), city: city, zip: zip, phone: phone,
    perk_type: 'discount', perk_description: '', redemption_instructions: '',
    contact_email: email,
    owner_email: (currentUser ? currentUser.email : email),
    // TEMP: auto-approve so you can test the full flow now. Restore 'pending' when
    // club-officer/admin verification is wired up.
    status: 'verified'
  };
  authBusy2('bizSubmit', true, 'Submitting…');
  sbRegisterBusiness(payload).then(function () {
    _bizCache = null;   // force a refetch so the new listing shows immediately
    $('shopsBody').innerHTML =
      '<div class="soon-card" style="margin-top:40px"><div class="soon-ico">' + svgIcon('check', 34) + '</div>' +
        '<h2>Your business is live!</h2>' +
        '<p><strong>' + escHtml(name) + '</strong> is now in the directory. (For now, new listings go live right away. Owner sign-in and verification are coming later.)</p>' +
        '<div class="soon-actions"><button class="btn primary" onclick="navShop(\'browse\')">See it in Browse Businesses</button>' +
          '<button class="btn blue" onclick="navShop(\'register\')">Register Another</button></div></div>';
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
  }).then(function (res) { if (!res.ok) return res.text().then(function () { throw new Error('Upload failed. Try a smaller file.'); }); return SUPABASE_URL + '/storage/v1/object/public/business-media/' + path; });
}
/* Editor media working state + handlers */
var _ebBanner = '', _ebPhotos = [], _ebGallery = [], _ebLinks = [];
/* Links editor (repeatable rows) */
function ebPaintLinks() {
  var el = $('ebLinks'); if (!el) return;
  var rows = (_ebLinks.length ? _ebLinks : ['']).map(function (u, i) {
    return '<div class="link-row"><input type="text" class="eb-link" placeholder="https://instagram.com/yourshop" value="' + escAttr(u) + '" oninput="ebSyncLinks()">' +
      '<button type="button" class="mini-x" title="Remove" onclick="ebRemoveLink(' + i + ')">✕</button></div>';
  }).join('');
  el.innerHTML = rows;
}
function ebSyncLinks() {
  _ebLinks = Array.prototype.map.call(document.querySelectorAll('#ebLinks .eb-link'), function (el) { return el.value.trim(); });
}
function ebAddLink() { ebSyncLinks(); _ebLinks.push(''); ebPaintLinks(); var ins = document.querySelectorAll('#ebLinks .eb-link'); if (ins.length) ins[ins.length - 1].focus(); }
function ebRemoveLink(i) { ebSyncLinks(); _ebLinks.splice(i, 1); ebPaintLinks(); }
function ebPaintMedia() {
  var bp = $('ebBannerPrev'); if (bp) bp.innerHTML = _ebBanner
    ? '<div class="eb-banner" style="background-image:url(' + escAttr(_ebBanner) + ')"><button class="mini-x" onclick="ebRemoveBanner()">✕</button></div>'
    : '<p class="form-note">No banner yet. Your card uses a plain color block for now.</p>';
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
      '<div class="soon-card"><div class="soon-ico">' + svgIcon('lock', 34) + '</div><h2>Sign in required</h2>' +
      '<p>Log in with the email you used to list your business, then you can edit your storefront here.</p>' +
      '<div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button>' +
        '<button class="btn blue" onclick="navShop(\'register\')">Register a Business</button></div></div>';
    return;
  }
  el.innerHTML = '<div class="page-head centered"><h1>My Business</h1><p>Edit your storefront, perks, hours, and partnership settings.</p></div>' +
    '<div id="myBizList" class="grid"><p class="form-note" style="grid-column:1/-1;text-align:center;padding:40px">Loading your listings…</p></div>';
  sbRest('businesses?owner_email=eq.' + encodeURIComponent(currentUser.email.toLowerCase()) + '&select=*&order=created_at.desc')
    .then(function (rows) {
      var g = $('myBizList'); if (!g) return;
      if (!rows || !rows.length) {
        g.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">' + svgIcon('store', 40) + '</div>' +
          '<p>You haven’t listed a business yet. Once you do, you can manage it here.</p>' +
          '<button class="btn primary" style="margin-top:12px" onclick="navShop(\'register\')">Register Your Business</button></div>';
        return;
      }
      rows.forEach(function (r) { _bizOwned[r.id] = r; });
      // Identical card to Browse Businesses — owners edit from the profile's gear/pencils.
      g.innerHTML = rows.map(businessCard).join('');
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
    el.innerHTML = '<div class="soon-card" style="margin-top:40px"><div class="soon-ico">' + svgIcon('lock', 34) + '</div><h2>Not your listing</h2>' +
      '<p>You can only edit a business you listed. Sign in with the contact email you used.</p>' +
      '<div class="soon-actions"><button class="btn primary" onclick="navShop(\'browse\')">Browse Businesses</button></div></div>';
    return;
  }
  _ebBanner = b.banner || ''; _ebPhotos = (b.photos || []).slice(); _ebGallery = (b.gallery || []).slice(); _ebLinks = (b.links || []).slice();
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
    '<div class="field"><label>Links <span class="form-note">(social profiles, website, menu — shown beneath your gallery)</span></label>' +
      '<div id="ebLinks"></div><button class="btn ghost sm-btn" type="button" onclick="ebAddLink()">+ Add Link</button></div>' +
    '<div class="field"><label>Hours</label><div class="hours-editor">' + hoursRows + '</div></div>' +
    '<label class="toggle-row" style="cursor:pointer;margin:6px 0 10px"><div><div class="tr-title">Open to club partnerships</div><div class="form-note">Shows a green “Open to partnerships” badge on your listing.</div></div><input type="checkbox" id="ebPartner"' + (b.partnership_open ? ' checked' : '') + ' style="width:20px;height:20px"></label>' +
    '<label class="toggle-row" style="cursor:pointer;margin:6px 0 10px"><div><div class="tr-title">Private listing</div><div class="form-note">On: hidden from the public Browse directory (only you can see it via your direct link).</div></div><input type="checkbox" id="ebPrivate"' + (b.is_private ? ' checked' : '') + ' style="width:20px;height:20px"></label>' +
    '<label class="toggle-row" style="cursor:pointer;margin-bottom:14px"><div><div class="tr-title">' + svgIcon('shield', 15) + ' Require the “Reach Out” form</div><div class="form-note">On: people send via a short form. (Direct-message mode arrives with the Inbox.)</div></div><input type="checkbox" id="ebGate"' + (b.gate_messages !== false ? ' checked' : '') + ' style="width:20px;height:20px"></label>' +
    '<div class="modal-actions"><button class="btn ghost" onclick="navShop(\'my\')">Cancel</button>' +
    '<button id="ebSave" class="btn primary" onclick="submitBizEdit(\'' + b.id + '\')">Save changes</button></div></div>' +
    '<div class="form-card" style="margin:0 auto 40px" id="ebMedia">' +
      '<div class="section-title" style="margin-top:0">Card banner <span class="form-note">(the image on your Browse thumbnail)</span></div>' +
      '<div id="ebBannerPrev"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" hidden onchange="ebUploadBanner(event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Upload banner image</label>' +
      '<div class="section-title">Slideshow images <span class="form-note">(top of your profile, up to 10)</span></div>' +
      '<div id="ebPhotosPrev" class="biz-photostrip"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" multiple hidden onchange="ebUploadPhotos(event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Add slideshow images</label>' +
      '<div class="section-title">Gallery <span class="form-note">(photos &amp; videos)</span></div>' +
      '<div id="ebGalleryPrev" class="biz-photostrip"></div>' +
      '<label class="uploader"><input type="file" accept="image/*,video/mp4,video/webm" multiple hidden onchange="ebUploadGallery(event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Add gallery photos &amp; videos</label>' +
      '<p class="form-note" style="margin-top:10px">Changes to media save when you press <strong>Save changes</strong> above.</p>' +
    '</div>';
  ebPaintMedia(); ebPaintLinks();
}
function field2v(id, label, val) {
  return '<div class="field"><label>' + escHtml(label) + '</label><input id="' + id + '" type="text" value="' + escAttr(val || '') + '"></div>';
}
function submitBizEdit(id) {
  var g = function (x) { return ($(x) && $(x).value || '').trim(); };
  var e = $('ebErr'); var err = function (m) { e.textContent = m; e.classList.remove('hidden'); };
  if (!g('ebName')) return err('Business name is required.');
  if (typeof ebSyncLinks === 'function') ebSyncLinks();
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hours = {};
  days.forEach(function (d) { var v = g('eh_' + d); if (v) hours[d] = v; });
  var patch = {
    name: g('ebName'), category: g('ebCat'), about: g('ebAbout'),
    perk_type: g('ebPerkType'), perk_description: g('ebPerk'), redemption_instructions: g('ebRedeem'),
    phone: g('ebPhone'), website: g('ebWebsite'), address: g('ebAddr'), city: g('ebCity'), zip: g('ebZip'),
    cuisines: g('ebCuisines') ? g('ebCuisines').split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [],
    links: _ebLinks.filter(Boolean).slice(0, 10),
    hours: hours,
    banner: _ebBanner || null, photos: _ebPhotos, gallery: _ebGallery,
    partnership_open: !!($('ebPartner') && $('ebPartner').checked),
    is_private: !!($('ebPrivate') && $('ebPrivate').checked),
    gate_messages: !!($('ebGate') && $('ebGate').checked)
  };
  authBusy2('ebSave', true, 'Saving…');
  sbUpdateBusiness(id, patch).then(function (rows) {
    var updated = (rows && rows[0]) || null;
    if (updated) _bizOwned[id] = updated;
    _bizCache = null;
    if (typeof refreshCanPartner === 'function') refreshCanPartner();
    toast('Saved! Your listing is updated.');
    openBusiness(id);
  }).catch(function (ex) { authBusy2('ebSave', false); err(ex.message); });
}

