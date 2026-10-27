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
/* Deals (partnerships + promotions) are drawn by deals.js: dealSquares, cardDealBox, dealBannerChips, partnershipDealBox, promotionBoxes. */
var DEAL_FILTERS = [['All', 'All deals'], ['partner', 'Has a partnership'], ['promo', 'Any promotion'], ['discount', 'Discounts'],
  ['bogo', 'Buy one, get one'], ['coupon', 'Coupons / promo codes'], ['freebie', 'Free items & add-ons'], ['bundle', 'Bundle deals']];
function bizCatMeta(c) { return BIZ_CAT_META[c] || { icon: svgIcon('store', 22), grad: 'linear-gradient(140deg,#0a6f96,#003249)' }; }

var _bizCache = null, _bizError = null;
var bizState = { cat: 'All', perk: 'All', sort: 'az', q: '' };

/* ---------- Supabase REST (PostgREST) ---------- */
/* Sends the signed-in user's access token (so row-level security knows who is acting);
   guests use the public key. An expired token is refreshed once and the call retried. */
function sbRest(path, opts) {
  opts = opts || {};
  var once = function (tok) {
    var headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + (tok || SUPABASE_KEY), 'Content-Type': 'application/json' };
    if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
    // Always bypass the browser HTTP cache — otherwise GETs (club rosters, chat, polls) can return stale data and break live sync.
    return fetch(SUPABASE_URL + '/rest/v1/' + path, { method: opts.method || 'GET', headers: headers, body: opts.body, cache: 'no-store' })
      .then(function (res) {
        return res.text().then(function (txt) {
          var d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
          if (res.ok) return d;
          var msg = (d && (d.message || d.hint || d.details || d.error)) || ('Request failed (' + res.status + ').');
          if (/row-level security|permission denied/i.test(msg)) msg = 'You don’t have permission to do that. If you’re signed in, try logging out and back in.';
          else if (/JWT expired/i.test(msg)) msg = 'Your session expired. Please log in again.';
          var err = new Error(msg); err.status = res.status; err.code = d && d.code; throw err;
        });
      }, function () { throw new Error('Couldn’t reach the server. Check your connection and try again.'); });
  };
  var tokP = (typeof sbAccessToken === 'function') ? sbAccessToken() : Promise.resolve(null);
  return tokP.then(function (tok) {
    return once(tok).catch(function (err) {
      if (err.status === 401 && tok && typeof sbRefresh === 'function') return sbRefresh().then(function (s) { return once(s && s.access_token); });
      throw err;
    });
  });
}
/* Call a database function (POST /rest/v1/rpc/<name>). */
function sbRpc(name, args) { return sbRest('rpc/' + name, { method: 'POST', body: JSON.stringify(args || {}) }); }
/* Every public business column. owner_email is private: "do I own this?" comes from my_business_ids(). */
var BIZ_SELECT = 'id,name,category,address,city,zip,perk_type,perk_description,redemption_instructions,contact_email,status,created_at,about,phone,website,cuisines,hours,photos,rating,review_count,partnership_open,banner,gallery,links,public_id,deal_hidden,is_private,perk_audience,perk_start,perk_end,verified,reviews_enabled,is_sample';
function sbFetchBusinesses() { return sbRest('businesses?status=eq.verified&select=' + BIZ_SELECT + '&order=created_at.desc'); }
/* Which businesses the signed-in account owns (asked of the server, so nobody's email is ever sent to the browser). */
var _myBizIds = [];
function refreshMyBizIds() {
  if (!currentUser || typeof sbHasSession !== 'function' || !sbHasSession(currentUser.email)) { _myBizIds = []; return Promise.resolve(_myBizIds); }
  return sbRpc('my_business_ids').then(function (ids) {
    var before = _myBizIds.join(); _myBizIds = (ids || []).map(String);
    if (before !== _myBizIds.join()) {   // ownership just loaded/changed: refresh what's on screen
      if (typeof loadPromotions === 'function') loadPromotions();   // owners can also see their own hidden promotions
      if (typeof currentBiz !== 'undefined' && currentBiz && $('view-business') && !$('view-business').classList.contains('hidden')) renderBusinessPage(currentBiz);
      if ($('view-shops') && !$('view-shops').classList.contains('hidden') && typeof renderShops === 'function') renderShops();
    }
    return _myBizIds;
  }).catch(function () { return _myBizIds; });
}
function sbRegisterBusiness(data) { return sbRest('businesses', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(data) }); }

/* ---------- Saved Businesses (localStorage, mirrors Saved Clubs) ---------- */
/* Per account (one shared key used to leak saves between accounts on the same browser). */
function _savedBizKey() { return 'sch_saved_biz' + (currentUser && currentUser.email ? ':' + currentUser.email.toLowerCase() : ''); }
function loadSavedBiz() { try { return JSON.parse(localStorage.getItem(_savedBizKey())) || []; } catch (e) { return []; } }
function saveSavedBiz(a) { try { localStorage.setItem(_savedBizKey(), JSON.stringify(a)); } catch (e) {} }
function isBizSaved(id) { return loadSavedBiz().indexOf(id) !== -1; }
function toggleBizSave(id) {
  var a = loadSavedBiz(), i = a.indexOf(id);
  if (i > -1) a.splice(i, 1); else a.push(id);
  saveSavedBiz(a); toast(i > -1 ? 'Removed from Saved Businesses.' : 'Saved to your businesses!');
  // Repaint whatever is on screen so the bookmark state never disagrees with the toast.
  var v = (typeof currentViewName === 'function') ? currentViewName() : '';
  if (v === 'business' && currentBiz && currentBiz.id === id) renderBusinessPage(currentBiz);
  else if (v === 'profile' && typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
  else renderShops();
}

/* ============================================================
   Entry point - pages.js renderShops() delegates here.
   ============================================================ */
function renderBusinesses(kind) {
  var el = $('shopsBody'); if (!el) return;
  if (kind === 'register') return renderBusinessRegister(el);
  if (kind === 'my') return renderMyBusiness(el);
  var savedOnly = (kind === 'saved');
  var crumb = savedOnly ? 'Saved Businesses' : 'Browse Businesses';
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
  var pills = ['All'].concat(BIZ_CATEGORIES, ['Other']).map(function (c) {
    return '<button class="cat-pill' + (bizState.cat === c ? ' active' : '') + '" onclick="setBizFilter(\'cat\',\'' + jsArg(c) + '\')">' + escHtml(c) + '</button>';
  }).join('');
  var perkOpts = DEAL_FILTERS.map(function (o) {
    return '<option value="' + o[0] + '"' + (bizState.perk === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  }).join('');
  var sortOpts = [
    ['az', 'Alphabetical (A → Z)'], ['za', 'Reverse Alphabetical (Z → A)'],
    ['new', 'Latest'], ['old', 'Oldest'],
    ['partners', 'Open to partnerships'], ['rating', 'Highest rated']
  ].map(function (o) {
    return '<option value="' + o[0] + '"' + (bizState.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
  }).join('');
  return '<div class="toolbar"><div class="search"><span class="ico">⌕</span>' +
      '<input type="text" placeholder="Search by business name, city, zip code, or deal..." value="' + escAttr(bizState.q) + '" oninput="setBizFilter(\'q\',this.value)"></div>' +
      '<select class="select" onchange="setBizFilter(\'perk\',this.value)">' + perkOpts + '</select>' +
      '<select class="select" onchange="setBizFilter(\'sort\',this.value)">' + sortOpts + '</select></div>' +
    '<div class="cat-row">' + pills + '</div>';
}
/* The rating a visitor can actually see (0 when the owner turned reviews off). */
function _shownRating(b) { return b.reviews_enabled === false ? 0 : (+b.rating || 0); }
function setBizFilter(k, v) { bizState[k] = v; if (k === 'q' && $('bizGrid')) paintBusinessGrid(false); else renderShops(); }
/* Deals finished loading: redraw just the cards (the search box keeps its focus). */
var _bizGridSaved = false;
function repaintBizCards() {
  if ($('bizGrid') && _bizCache) paintBusinessGrid(_bizGridSaved);
  var my = $('myBizList'); if (my && my.querySelector('.biz-card')) my.innerHTML = Object.keys(_bizOwned).map(function (k) { return _bizOwned[k]; })
    .sort(function (a, b) { return String(b.created_at || '').localeCompare(String(a.created_at || '')); }).map(businessCard).join('');
}
function paintBusinessGrid(savedOnly) {
  var g = $('bizGrid'); if (!g) return;
  _bizGridSaved = !!savedOnly;
  var list = (_bizCache || []).slice();
  if (savedOnly) { var s = loadSavedBiz(); list = list.filter(function (b) { return s.indexOf(b.id) !== -1; }); }
  else {
    list = list.filter(function (b) { return !b.is_private; });   // private listings never show in public Browse
    if (bizState.cat === 'Other') list = list.filter(function (b) { return BIZ_CATEGORIES.indexOf(b.category) === -1; });   // typed-in categories
    else if (bizState.cat !== 'All') list = list.filter(function (b) { return b.category === bizState.cat; });
    if (bizState.perk !== 'All') list = list.filter(function (b) { return bizMatchesDealFilter(b, bizState.perk); });
    var q = bizState.q.trim().toLowerCase();
    if (q) list = list.filter(function (b) {
      return (b.name + ' ' + b.city + ' ' + b.zip + ' ' + dealSearchText(b) + ' ' + b.category).toLowerCase().indexOf(q) !== -1;
    });
    var s = bizState.sort, az = function (a, b) { return (a.name || '').localeCompare(b.name || ''); };
    list.sort(function (a, b) {
      if (s === 'za') return (b.name || '').localeCompare(a.name || '');
      if (s === 'new') return (b.created_at || '').localeCompare(a.created_at || '');
      if (s === 'old') return (a.created_at || '').localeCompare(b.created_at || '');
      if (s === 'partners') return (b.partnership_open ? 1 : 0) - (a.partnership_open ? 1 : 0) || az(a, b);
      if (s === 'rating') return _shownRating(b) - _shownRating(a) || az(a, b);
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
      (b.banner ? '' : '<span class="cover-mark">' + m.icon + '</span>' + cardDoodles(b.id, 'biz')) +
      '<button class="card-share" title="Share" onclick="event.stopPropagation(); shareBusiness(\'' + b.id + '\')">' + (typeof ICON_SHARE !== 'undefined' ? ICON_SHARE : '') + '</button>' +
      (isBizOwner(b) ? '' : '<button class="card-flag" title="Report this business" onclick="event.stopPropagation(); openReport(\'business\',\'' + b.id + '\',\'' + jsArg(b.name) + '\')">' + (typeof ICON_FLAG !== 'undefined' ? ICON_FLAG : '') + '</button>') +
      '<span class="cover-cat">' + escHtml(b.category) + '</span></div>' +
    '<div class="card-body">' +
      '<div class="card-title" onclick="openBusiness(\'' + b.id + '\')"><h3>' + escHtml(b.name) + '</h3>' +
        (b.verified ? '<span class="name-verified-ico" title="Verified">' + verifiedSeal(17, '#e6b422', '#ffffff') + '</span>' : '') +
        (b.is_sample ? sampleChip() : '') +
        dealSquares('business', b) +
      '</div>' +
      '<div class="card-meta">' + svgIcon('pin', 14) + ' ' + escHtml(b.city) + ', CA ' + escHtml(b.zip) + '</div>' +
      (b.public_id ? '<div class="card-idline"><span class="club-id-chip">#' + escHtml(b.public_id) + '</span></div>' : '') +
      cardDealBox(b) +   // partnership first, else a promotion; nothing at all when neither is showing
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
  var cached = _findBizAnywhere(id);
  var msg = function (s) { $('businessBody').innerHTML = '<div class="biz-wrap"><p class="form-note" style="padding:40px;text-align:center">' + s + '</p></div>'; };
  if (cached) { currentBiz = cached; renderBusinessPage(cached); } else { currentBiz = null; msg('Loading…'); }
  loadBizReviews(id);
  // Always pull the freshest copy, so edits made on another device or account show up.
  sbRest('businesses?id=eq.' + encodeURIComponent(id) + '&select=' + BIZ_SELECT).then(function (rows) {
    var fresh = rows && rows[0];
    if (currentBiz && currentBiz.id !== id) return;                   // user moved on
    if (!fresh || (fresh.status !== 'verified' && !isBizOwner(fresh))) { if (!cached) msg('This business isn’t available.'); return; }
    _rememberBiz(fresh); currentBiz = fresh; renderBusinessPage(fresh);
  }).catch(function () { if (!cached) msg('Couldn’t load this business. Check your connection and try again.'); });
}
/* Businesses fetched outside the Browse list (profiles, My Business, deep links) live here,
   so they can be opened without corrupting the Browse cache. */
var _bizExtra = {};
function _findBizAnywhere(id) {
  if (typeof currentBiz !== 'undefined' && currentBiz && currentBiz.id === id) return currentBiz;
  return (_bizCache || []).find(function (x) { return x.id === id; }) || _bizOwned[id] || _bizExtra[id] || null;
}
function _rememberBiz(b) {
  if (!b || !b.id) return;
  if (_bizCache) { var i = _bizCache.findIndex(function (x) { return x.id === b.id; }); if (i > -1) _bizCache[i] = b; }
  if (_bizOwned[b.id]) _bizOwned[b.id] = b;
  _bizExtra[b.id] = b;
}
/* Shared links (#biz=<id>) open that business directly. */
function _openBizFromHash() { var m = (location.hash || '').match(/^#biz=([\w-]+)/); if (m) openBusiness(m[1]); }
window.addEventListener('hashchange', _openBizFromHash);
document.addEventListener('DOMContentLoaded', function () { setTimeout(_openBizFromHash, 0); });
function backFromBusiness() { if (_bizSlideTimer) clearInterval(_bizSlideTimer); openShops('browse'); }

/* Slides: real photos if present, else branded promo panels (a place to advertise) */
function bizSlides(b) {
  var g = (b.photos || []).filter(Boolean);
  if (!g.length && b.banner) g = [b.banner];
  if (g.length) return g.map(function (u) { return { img: u }; });
  return [{ paper: true }];   // nothing uploaded → a blank sheet of paper with school doodles
}
function renderBusinessPage(b) {
  var slides = bizSlides(b), saved = isBizSaved(b.id), owner = isBizOwner(b);
  var cuisines = (b.cuisines || []).length ? (b.cuisines || []).join('  •  ') : b.category;
  var ratingLine = (b.review_count > 0 && b.reviews_enabled !== false)
    ? starRow(b.rating || 0, 'sm') + '<strong>' + Number(b.rating || 0).toFixed(1) + '</strong>' +
      '<span class="biz-rev-count">(' + b.review_count + ' review' + (b.review_count === 1 ? '' : 's') + ')</span>'
    : '';
  var hero =
    '<div class="biz-slideshow' + (slides[0] && slides[0].paper ? ' is-paper' : '') + '" id="bizSlideshow">' +
      slides.map(function (s, i) {
        if (s.paper) return '<div class="biz-slide active paper-slide">' + doodleLayer('bizBanner') + '</div>';
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
          (owner ? '' : '<button class="name-ico flag" title="Report this business" onclick="openReport(\'business\',\'' + b.id + '\',\'' + jsArg(b.name) + '\')">' + (typeof ICON_FLAG !== 'undefined' ? ICON_FLAG : '') + '</button>') + '</div>' +
        (ratingLine ? '<div class="biz-rating">' + ratingLine + '</div>' : '') +
        '<div class="biz-tagline">' +
          '<span class="biz-cuisines">' + escHtml(cuisines) + '</span>' +
          (b.verified ? '<span class="biz-verified" tabindex="0">' + (slides[0] && slides[0].paper ? verifiedSeal(18, '#e6b422', '#ffffff') : verifiedSeal(18, '#ffffff', '#b8860b')) + '<span class="bv-label">Verified</span></span>' : '') +
          (b.is_sample ? sampleChip() : '') +
          (b.partnership_open ? '<span class="open-partner-chip">' + ICON_PARTNER + ' Open to partnerships</span>' : '') +
          dealBannerChips('business', b) +
          (b.public_id ? '<span class="biz-idchip">#' + escHtml(b.public_id) + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</div>';

  var actions = '';   // top reach/share/save action bar removed — those live on the banner / sidebar now

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
  var main = '<div class="biz-main">' + (b.is_sample ? sampleNoteHTML('business') : '') +
    '<div class="deal-stack">' + partnershipDealBox('business', b, owner) + promotionBoxes(b, owner) + '</div>' +
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
          (b.review_count > 0 ? '<div class="rating-line">' + starRow(b.rating || 0) + '<strong>' + Number(b.rating || 0).toFixed(1) + '</strong><span class="form-note">· ' + b.review_count + ' review' + (b.review_count === 1 ? '' : 's') + '</span></div>' : '') +
          '</div>' + (owner || b.is_sample ? '' : '<button id="bizReviewBtn" class="btn primary" onclick="openBizReview(\'' + b.id + '\')">' + (_myBizReview(b.id) ? 'Edit Your Review' : 'Write a Review') + '</button>') + '</div>' +
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
      (b.website ? '<div class="info-line"><span class="k">Website</span><a class="link" href="' + escAttr(typeof normalizeUrl === 'function' ? normalizeUrl(b.website) : b.website) + '" target="_blank" rel="noopener">' + escHtml((b.website || '').replace(/^https?:\/\//, '')) + '</a></div>' : '') +
      '<a class="btn ghost block" style="margin-top:10px" href="https://maps.google.com/?q=' + encodeURIComponent((b.address || '') + ' ' + b.city + ' ' + b.zip) + '" target="_blank" rel="noopener">' + svgIcon('directions', 16) + ' Get Directions</a>' +
      (b.phone ? '<a class="btn ghost block" style="margin-top:8px" href="tel:' + escAttr((b.phone || '').replace(/[^0-9+]/g, '')) + '">' + svgIcon('phone', 16) + ' Call</a>' : '') +
    '</div>' +
    (b.is_sample ? '' : '<div class="sidebar-card"><div class="section-title" style="margin-top:0">Partner with this business</div>' +
      '<p class="form-note" style="margin-bottom:10px">Club Presidents can reach out about sponsorships, discounts or events. You’ll see the business’s public email and can send a partnership request.</p>' +
      '<button class="btn blue block" onclick="contactByEmail(\'business\',\'' + b.id + '\')">' + ICON_PARTNER + ' Reach Out by Email</button></div>') +
  '</aside>';

  $('businessBody').innerHTML = hero +
    '<div class="biz-wrap">' +
      actions + '<div class="biz-grid">' + main + side + '</div>' + reviews + '</div>';
  _syncBizSlides(slides.length);
  if (_bizReviewsFor === b.id) paintBizReviews();
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
  var todayKey = _laNow().day;   // the business's local (Pacific) day, not the visitor's
  var h = b.hours || {};
  var owner = isBizOwner(b);
  var listed = days.some(function (d) { return h[d] && String(h[d]).trim(); });
  var status = listed ? bizOpenNow(h) : null;
  var statusHtml = status && status.open != null
    ? '<span class="biz-open ' + (status.open ? 'yes' : 'no') + '">' + (status.open ? 'Open now' : 'Closed now') + '</span>' : '';
  var rows = listed
    ? days.map(function (d) { return '<div class="hours-row' + (d === todayKey ? ' today' : '') + '"><span>' + d + '</span><span>' + escHtml(h[d] || 'Closed') + '</span></div>'; }).join('')
    : '<p class="form-note">' + (owner ? 'No hours yet. Add them with the pencil.' : 'Hours not listed yet.') + '</p>';
  var pen = owner ? '<button class="sec-edit" title="Edit hours" onclick="editBizHours(\'' + b.id + '\')">' + ICON_PEN + '</button>' : '';
  return '<div class="sidebar-card"><div class="section-title has-edit" style="margin-top:0"><span>Hours ' + statusHtml + '</span>' + pen + '</div>' + rows + '</div>';
}
/* Day + minutes-since-midnight in the businesses' timezone (LA County → Pacific). */
function _laNow(date) {
  var d = date || new Date();
  try {
    var g = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (x) { g[x.type] = x.value; });
    return { day: g.weekday, mins: (+g.hour % 24) * 60 + (+g.minute) };
  } catch (e) { return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()], mins: d.getHours() * 60 + d.getMinutes() }; }
}
/* null = closed that day; undefined = unreadable; else {o, c} in minutes (c <= o means it runs past midnight). */
function _hoursSpan(h, day) {
  var s = h && h[day]; if (!s || /closed/i.test(s)) return null;
  var p = String(s).split('-'); if (p.length < 2) return undefined;
  var o = parseClock(p[0]), c = parseClock(p[1]); return (o == null || c == null) ? undefined : { o: o, c: c };
}
function bizOpenNow(h, _unused, date) {
  var now = _laNow(date), days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var i = days.indexOf(now.day), today = _hoursSpan(h, now.day), yest = _hoursSpan(h, days[(i + 6) % 7]);
  if (today === undefined) return { open: null };
  var open = false;
  if (today) open = today.o === today.c ? true : (today.c > today.o ? (now.mins >= today.o && now.mins < today.c) : now.mins >= today.o);
  if (!open && yest && yest.c < yest.o && now.mins < yest.c) open = true;   // still open from last night's late shift
  return { open: open };
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
    '<button class="btn blue block" style="margin-bottom:14px" onclick="nativeShare(\'' + jsArg(link) + '\',\'' + jsArg(name) + '\')">↗ Share via…</button>' +
    '<div class="qr-wrap"><div class="qr-box">' + (qr || '<p class="form-note">Link is too long for a QR code — use the link above.</p>') + '</div>' +
      '<p class="form-note" style="text-align:center;margin-top:6px">Scan to open</p></div>';
  openOverlay('shareOverlay');
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
var _bizReviewsFor = null;
function loadBizReviews(id) {
  sbRest('biz_reviews?business_id=eq.' + encodeURIComponent(id) + '&select=*&order=created_at.desc').then(function (rows) {
    _bizReviews = rows || []; _bizReviewsFor = id; paintBizReviews();
  }).catch(function () { var el = $('bizReviews'); if (el) el.innerHTML = '<p class="form-note">Couldn’t load reviews.</p>'; });
}
function paintBizReviews() {
  var btn = $('bizReviewBtn'); if (btn && _bizReviewsFor) btn.textContent = _myBizReview(_bizReviewsFor) ? 'Edit Your Review' : 'Write a Review';
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
      (r.created_at ? '<span class="review-time">' + escHtml(timeAgo(new Date(r.created_at).getTime())) + '</span>' : '') +
      (_isMyBizReview(r) ? '' : reportUserFlag(r.author_id, r.author, 'A review on ' + bizName)) + '</div>' +
      '<p class="review-text">' + escHtml(r.text) + '</p>' +
      (_isMyBizReview(r) ? '<span class="review-ctrls"><button onclick="openBizReview(\'' + jsArg(r.business_id) + '\')">Edit</button><button onclick="deleteBizReview(\'' + r.id + '\')">Delete</button></span>' : '') +
      reply + replyBtn + '</div>';
  }).join('');
}
function _isMyBizReview(r) { return !!(currentUser && r && r.author_id && r.author_id === currentUser.memberId); }
function _myBizReview(bizId) { return (_bizReviewsFor === bizId) ? (_bizReviews || []).find(_isMyBizReview) || null : null; }
/* After any review change: reload the list AND the business row (the DB trigger recomputes rating/count). */
function _afterBizReviewChange(bizId) {
  loadBizReviews(bizId); _bizCache = null;
  sbRest('businesses?id=eq.' + encodeURIComponent(bizId) + '&select=' + BIZ_SELECT).then(function (rows) {
    if (rows && rows[0]) { _rememberBiz(rows[0]); if (currentBiz && currentBiz.id === bizId) { currentBiz = rows[0]; renderBusinessPage(rows[0]); } }
  }).catch(function () {});
}
function deleteBizReview(reviewId) {
  var r = (_bizReviews || []).find(function (x) { return x.id === reviewId; }); if (!_isMyBizReview(r)) return;
  openConfirm('Delete your review?', 'Your review and rating will be removed.', svgIcon('trash', 26), function () {
    sbRest('biz_reviews?id=eq.' + reviewId + '&author_id=eq.' + encodeURIComponent(currentUser.memberId), { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
      .then(function () { toast('Review deleted.'); _afterBizReviewChange(r.business_id); }).catch(function (ex) { toast(ex.message); });
  }, 'Delete');
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
  if (!currentUser) { toast('Please log in to write a review.'); if (typeof openAuth === 'function') openAuth('login'); return; }
  var biz = _findBizAnywhere(id);
  if (biz && isBizOwner(biz)) { toast('You can’t review your own business.'); return; }
  if (biz && biz.reviews_enabled === false) { toast('Reviews are turned off for this business.'); return; }
  var mine = _myBizReview(id);
  _bizReviewFor = id; _bizReviewRating = mine ? mine.rating : 0;
  $('bizBody').innerHTML =
    '<div class="modal-pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">' + (mine ? 'Edit Your Review' : 'Write a Review') + '</h3><button class="icon-btn" onclick="closeBiz()">✕</button></div>' +
    '<div id="bizRevErr" class="auth-error hidden"></div>' +
    '<p class="form-note" style="margin-bottom:10px">Posting as <strong>' + escHtml(currentUser.name) + '</strong></p>' +
    '<div class="field"><label>Your rating</label><div id="brStars" class="star-picker">' +
      [1, 2, 3, 4, 5].map(function (i) { return '<button type="button" data-v="' + i + '" onclick="setBizStars(' + i + ')">' + ICON_STAR + '</button>'; }).join('') + '</div></div>' +
    '<div class="field"><label>Your review</label><textarea id="brText" placeholder="What was your experience?">' + escHtml(mine ? mine.text : '') + '</textarea></div>' +
    '<button id="brSubmit" class="btn primary block lg" onclick="submitBizReview()">' + (mine ? 'Save Changes' : 'Post Review') + '</button></div>';
  openOverlay('bizOverlay');
  setBizStars(_bizReviewRating);
}
function setBizStars(v) { _bizReviewRating = v; document.querySelectorAll('#brStars button').forEach(function (b) { b.classList.toggle('on', parseInt(b.dataset.v, 10) <= v); }); }
function submitBizReview() {
  if (!currentUser) return;
  var text = ($('brText').value || '').trim(), bizId = _bizReviewFor, mine = _myBizReview(bizId);
  var e = $('bizRevErr'); var err = function (m) { e.textContent = m; e.classList.remove('hidden'); };
  if (!_bizReviewRating) return err('Pick a star rating.');
  if (!text) return err('Write a short review.');
  authBusy2('brSubmit', true, 'Posting…');
  // One review per member: editing replaces your earlier review instead of stacking another.
  var req = mine
    ? sbRest('biz_reviews?id=eq.' + mine.id + '&author_id=eq.' + encodeURIComponent(currentUser.memberId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ rating: _bizReviewRating, text: text, author: currentUser.name }) })
    : sbRest('biz_reviews', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ business_id: bizId, author: currentUser.name, author_id: currentUser.memberId, rating: _bizReviewRating, text: text }) });
  req.then(function () { closeBiz(); toast(mine ? 'Your review has been updated.' : 'Thanks! Your review has been posted.'); _afterBizReviewChange(bizId); })
    .catch(function (ex) { authBusy2('brSubmit', false); err(ex.message); });
}

function closeBiz() { closeOverlay('bizOverlay'); }
function closeBusiness() { closeOverlay('bizOverlay'); }

/* ---------- Registration form (same layout as "Register a Club") ----------
   Publishing needs a single-use invite code (the database claims it). "Save as Draft" keeps the
   form on this device (My Business → Drafts) without a code; "Cancel" goes back. */
var _bizDraftEditing = null;
function renderBusinessRegister(el) {
  // Ownership is tied to the logged-in account's email, so listing requires an account.
  if (!currentUser) {
    el.innerHTML = '<div class="page-head centered"><h1>Register a Business</h1><p>Sign in first. Your listing is managed from your account.</p></div>' +
      '<div class="soon-card"><div class="soon-ico">' + svgIcon('lock', 34) + '</div><h2>Sign in required</h2>' +
      '<p>Log in or create an account, then come back here to list your business.</p>' +
      '<div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button><button class="btn blue" onclick="openAuth(\'signup\')">Sign Up</button></div></div>';
    return;
  }
  var typed = $('bizForm') ? _bizFormData() : null;   // a re-render (e.g. language switch) keeps what was typed
  var catOpts = '<option value="">Select…</option>' + BIZ_CATEGORIES.map(function (c) { return '<option>' + escHtml(c) + '</option>'; }).join('') +
    '<option value="Other">Other (type your own)</option>';
  el.innerHTML =
    '<div class="container narrow center-page">' +
    '<div class="page-head" style="text-align:center"><h1>Register a Business</h1><p>Add promotions, hours, photos, and links to your page later.</p></div>' +
    '<div class="form-card" id="bizForm">' +
      '<div id="bizFormErr" class="auth-error hidden"></div>' +
      field2('bizName', 'Business name *', 'text', 'e.g. Boba Time') +
      '<div class="two-col"><div class="field"><label>Category / type *</label><select id="bizCat" class="select block-select" onchange="onBizCatChange()">' + catOpts + '</select>' +
        '<input id="bizCatOther" class="other-box hidden" type="text" maxlength="' + OTHER_LEN + '" placeholder="Type your own category (30 characters max)" oninput="validateBizForm()"></div>' +
        field2('bizAddr', 'Street address', 'text', '123 Main St') + '</div>' +
      '<div class="two-col">' + field2('bizCity', 'City *', 'text', 'Palos Verdes') + field2('bizZip', 'Zip code *', 'text', '90274') + '</div>' +
      '<div class="two-col">' + field2('bizPhone', 'Phone number *', 'tel', '(310) 555-0123') + field2('bizEmail', 'Business contact email *', 'email', 'owner@business.com') + '</div>' +
      '<div class="field invite-field"><label>Business invite code *</label>' +
        '<input id="bizInvite" type="text" placeholder="e.g. SCH-AB12CD" oninput="validateBizForm()">' +
        '<p id="bizInviteMsg" class="form-note">Enter the invite code you got from Student Club Hub.</p></div>' +
      '<div class="modal-actions three">' +
        '<button class="btn ghost" onclick="cancelBizForm()">Cancel</button>' +
        '<button class="btn amber" onclick="saveBizDraft()">Save as Draft</button>' +
        '<button id="bizSubmit" class="btn primary" disabled onclick="submitBusiness()">Publish to Directory</button></div>' +
    '</div></div>';
  ['bizName', 'bizCity', 'bizZip', 'bizPhone', 'bizEmail'].forEach(function (id) { var i = $(id); if (i) i.setAttribute('oninput', 'validateBizForm()'); });
  if (typed) _fillBizForm(typed); else if (_bizDraftEditing) _fillBizForm(_bizDraftEditing);
  validateBizForm();
}
function field2(id, label, type, ph) {
  return '<div class="field"><label>' + escHtml(label) + '</label><input id="' + id + '" type="' + type + '" placeholder="' + escAttr(ph) + '"></div>';
}
function bizErr(msg) { var e = $('bizFormErr'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } }
function onBizCatChange() { toggleOtherBox($('bizCat'), 'bizCatOther'); validateBizForm(); }
function bizCatValue() { return pickOrOther('bizCat', 'bizCatOther'); }
function _bizFormData() {
  var g = function (id) { return ($(id) && $(id).value || '').trim(); };
  return { name: g('bizName'), category: g('bizCat'), other: g('bizCatOther'), address: g('bizAddr'), city: g('bizCity'), zip: g('bizZip'),
    phone: g('bizPhone'), email: g('bizEmail'), invite: g('bizInvite') };
}
function _fillBizForm(d) {
  var set = function (id, v) { if ($(id)) $(id).value = v || ''; };
  set('bizName', d.name); set('bizCat', d.category); set('bizCatOther', d.other); set('bizAddr', d.address); set('bizCity', d.city);
  set('bizZip', d.zip); set('bizPhone', d.phone); set('bizEmail', d.email); set('bizInvite', d.invite);
  var o = $('bizCatOther'); if (o) o.classList.toggle('hidden', d.category !== 'Other');
}
/* Publish turns on once the required fields are filled and the server says the code is valid (and unused). */
function validateBizForm() {
  var invite = (($('bizInvite') && $('bizInvite').value) || '').trim(), msg = $('bizInviteMsg'); if (!msg) return;
  var paint = function () {
    var ok = isValidInvite(invite), d = _bizFormData();
    if (invite) { msg.className = 'form-note ' + (ok ? 'ok' : 'bad'); msg.textContent = ok ? '✓ Verified. You can publish this business.' : '✗ That invite code isn’t recognized (or it was already used).'; }
    else { msg.className = 'form-note'; msg.textContent = 'Enter the invite code you got from Student Club Hub.'; }
    $('bizSubmit').disabled = !(d.name && bizCatValue() && d.city && d.zip && d.phone && d.email && ok);
  };
  paint();
  clearTimeout(validateBizForm._t);
  if (invite && _inviteCheck.code !== invite.toUpperCase()) validateBizForm._t = setTimeout(function () {
    checkInviteCode(invite).then(function () { if ($('bizInvite') && $('bizInvite').value.trim() === invite) paint(); });
  }, 350);
}
function cancelBizForm() { _bizDraftEditing = null; navShop(_bizDrafts().length ? 'my' : 'browse'); }
function submitBusiness() {
  if (!currentUser) return bizErr('Please log in first.');
  var d = _bizFormData(), cat = bizCatValue(), email = d.email.toLowerCase();
  if (!d.name) return bizErr('Please enter your business name.');
  if (!cat) return bizErr(d.category === 'Other' ? 'Type your business category.' : 'Please choose a category.');
  if (!d.city || !d.zip) return bizErr('City and zip code are required.');
  if (!/^\d{5}$/.test(d.zip)) return bizErr('Enter a 5-digit zip code.');
  if (!d.phone) return bizErr('A phone number is required.');
  if (!(typeof isValidEmail === 'function' ? isValidEmail(email) : /@/.test(email))) return bizErr('Enter a valid contact email.');
  if (!isValidInvite(d.invite)) return bizErr('Enter a valid business invite code to publish.');
  var payload = {
    name: d.name, category: cat, address: d.address, city: d.city, zip: d.zip, phone: d.phone,
    perk_type: 'discount', perk_description: '', redemption_instructions: '',   // old columns (no longer shown)
    contact_email: email, owner_email: currentUser.email.toLowerCase(),
    invite_code: d.invite.toUpperCase(),   // the database claims this single-use code
    status: 'verified'
  };
  authBusy2('bizSubmit', true, 'Publishing…');
  sbRegisterBusiness(payload).then(function () {
    _bizCache = null; _inviteCheck = { code: null, ok: false };
    if (_bizDraftEditing) { _removeBizDraft(_bizDraftEditing.id); _bizDraftEditing = null; }
    // refreshMyBizIds repaints the open section when ownership changes, so show the success card after it
    return refreshMyBizIds().then(function () {
    $('shopsBody').innerHTML =
      '<div class="soon-card" style="margin-top:40px"><div class="soon-ico">' + svgIcon('check', 34) + '</div>' +
        '<h2>Your business is live!</h2>' +
        '<p><strong>' + escHtml(d.name) + '</strong> is now in the directory. Open it from My Business to add a promotion, hours, and photos.</p>' +
        '<div class="soon-actions"><button class="btn primary" onclick="navShop(\'my\')">Go to My Business</button>' +
          '<button class="btn blue" onclick="navShop(\'register\')">Register Another</button></div></div>';
    });
  }).catch(function (e) { authBusy2('bizSubmit', false); bizErr(/invite code/i.test(e.message) ? 'That invite code isn’t valid (or it was already used).' : e.message); });
}

/* ---------- Business drafts (kept on this device, per account; like club drafts) ---------- */
function _bizDraftKey() { return 'sch_biz_drafts:' + ((currentUser && currentUser.email) || '').toLowerCase(); }
function _bizDrafts() { try { return JSON.parse(localStorage.getItem(_bizDraftKey())) || []; } catch (e) { return []; } }
function _setBizDrafts(list) { try { localStorage.setItem(_bizDraftKey(), JSON.stringify(list)); return true; } catch (e) { toast('Couldn’t save the draft on this device.'); return false; } }
function _removeBizDraft(id) { _setBizDrafts(_bizDrafts().filter(function (x) { return x.id !== id; })); }
function saveBizDraft() {
  if (!currentUser) { pendingAuthAction = saveBizDraft; return openAuth('login'); }
  var d = _bizFormData();
  if (!d.name) return bizErr('Add at least a business name before saving a draft.');
  d.id = (_bizDraftEditing && _bizDraftEditing.id) || 'bd-' + Date.now().toString(36); d.saved = Date.now();
  var list = _bizDrafts(), i = list.findIndex(function (x) { return x.id === d.id; });
  if (i > -1) list[i] = d; else list.push(d);
  if (!_setBizDrafts(list)) return;
  _bizDraftEditing = null; myBizTabView = 'drafts';
  toast('Draft saved. You’ll find it in My Business → Drafts.');
  navShop('my');
}
function resumeBizDraft(id) { var d = _bizDrafts().find(function (x) { return x.id === id; }); if (!d) return; _bizDraftEditing = d; openShops('register'); }
function askDeleteBizDraft(id) {
  openConfirm('Delete this draft?', 'This permanently removes the saved draft.', svgIcon('trash', 26), function () { _removeBizDraft(id); renderShops(); toast('Draft deleted.'); });
}
function bizDraftCard(d) {
  var cat = d.category === 'Other' ? d.other : d.category;
  return '<article class="card draft-card"><div class="card-cover draft-cover">' + svgIcon('draft', 18) + ' Draft</div><div class="card-body">' +
    '<div class="card-title"><h3>' + escHtml(d.name || 'Untitled draft') + '</h3></div>' +
    '<div class="card-meta">Saved ' + escHtml(timeAgo(d.saved)) + (d.city ? ' · ' + escHtml(d.city) : '') + '</div>' +
    '<p class="card-desc">' + escHtml(cat || 'No category yet.') + '</p>' +
    '<div class="card-foot"><button class="btn primary" onclick="resumeBizDraft(\'' + d.id + '\')">Resume</button>' +
    '<button class="btn danger" onclick="askDeleteBizDraft(\'' + d.id + '\')">Delete</button></div></div></article>';
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
  return !!(currentUser && b && b.id != null && _myBizIds.indexOf(String(b.id)) > -1);
}
/* Returns the updated row; a refusal (0 rows) becomes an error instead of a silent no-op. */
function sbUpdateBusiness(id, patch) {
  return sbRest('businesses?id=eq.' + id + '&select=' + BIZ_SELECT, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch) })
    .then(function (rows) { if (!rows || !rows.length) throw new Error('Couldn’t save — only the owner can edit this business. Try logging in again.'); return rows; });
}
var _bizOwned = {};

/* ---------- Media upload → Supabase Storage (returns public URL) ---------- */
var IMG_MAX = 6 * 1024 * 1024, VID_MAX = 50 * 1024 * 1024;
/* Uploads go to biz/<business id>/…, signed in as the owner (the storage rules only let a business's
   owner add files to its folder, and only images / videos). */
function sbUploadMedia(file, allowVideo, bizId) {
  var isVid = /^video\//i.test(file.type);
  if (isVid && !allowVideo) return Promise.reject(new Error('Only images are allowed here.'));
  if (!/^image\//i.test(file.type) && !isVid) return Promise.reject(new Error('Please choose an image' + (allowVideo ? ' or video' : '') + '.'));
  if (isVid && file.size > VID_MAX) return Promise.reject(new Error('Video too large (max 50 MB).'));
  if (!isVid && file.size > IMG_MAX) return Promise.reject(new Error('Image too large (max 6 MB).'));
  var ext = ((file.name.split('.').pop() || 'bin').toLowerCase().match(/[a-z0-9]+/) || ['bin'])[0];
  if (!bizId) return Promise.reject(new Error('Upload failed: no business selected.'));
  var path = 'biz/' + bizId + '/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  return sbAccessToken().then(function (tok) {
    if (!tok) throw new Error('Please log in again to upload.');
    return fetch(SUPABASE_URL + '/storage/v1/object/business-media/' + path, {
      method: 'POST', headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + tok, 'Content-Type': file.type || 'application/octet-stream' }, body: file
    });
  }).then(function (res) {
    if (!res.ok) return res.text().then(function (t) {
      throw new Error(/mime|type/i.test(t) ? 'That file type isn’t allowed. Use a photo (JPG, PNG, GIF, WebP) or an MP4/WebM video.'
        : /size|large/i.test(t) ? 'That file is too large.' : res.status === 403 || /security|policy/i.test(t) ? 'Only this business’s owner can upload here. Try logging in again.' : 'Upload failed. Try a smaller file.');
    });
    return SUPABASE_URL + '/storage/v1/object/public/business-media/' + path;
  });
}

var myBizTabView = 'published';
function myBizTab(t) { myBizTabView = t; renderShops(); }
function renderMyBusiness(el) {
  if (!currentUser) {
    el.innerHTML = '<div class="page-head centered"><h1>My Business</h1><p>Sign in to manage your storefront.</p></div>' +
      '<div class="soon-card"><div class="soon-ico">' + svgIcon('lock', 34) + '</div><h2>Sign in required</h2>' +
      '<p>Log in with the email you used to list your business, then you can edit your storefront here.</p>' +
      '<div class="soon-actions"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button>' +
        '<button class="btn blue" onclick="navShop(\'register\')">Register a Business</button></div></div>';
    return;
  }
  var drafts = _bizDrafts();
  el.innerHTML = '<div class="page-head centered"><h1>My Business</h1><p>Your published businesses and your saved drafts.</p></div>' +
    '<div class="settings-tabs centered-tabs">' +
      '<button class="settings-tab' + (myBizTabView === 'published' ? ' active' : '') + '" onclick="myBizTab(\'published\')">Published Businesses</button>' +
      '<button class="settings-tab' + (myBizTabView === 'drafts' ? ' active' : '') + '" onclick="myBizTab(\'drafts\')">Drafts' + (drafts.length ? ' (' + drafts.length + ')' : '') + '</button></div>' +
    '<div id="myBizList" class="grid"><p class="form-note" style="grid-column:1/-1;text-align:center;padding:40px">Loading your listings…</p></div>';
  var g = $('myBizList');
  if (myBizTabView === 'drafts') {
    g.innerHTML = drafts.length ? drafts.map(bizDraftCard).join('')
      : '<div class="empty" style="grid-column:1/-1"><div class="big">' + svgIcon('draft', 40) + '</div><p>No drafts yet.</p>' +
        '<p class="form-note">Register a business and choose “Save as Draft” to keep it here.</p>' +
        '<div style="margin-top:14px"><button class="btn primary" onclick="navShop(\'register\')">Register a Business</button></div></div>';
    return;
  }
  refreshMyBizIds().then(function (ids) {
    return ids.length ? sbRest('businesses?id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=' + BIZ_SELECT + '&order=created_at.desc') : [];
  }).then(function (rows) {
      var g = $('myBizList'); if (!g || myBizTabView !== 'published') return;
      if (!rows || !rows.length) {
        g.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">' + svgIcon('store', 40) + '</div>' +
          '<p>You haven’t published a business yet. Once you do, you can manage it here.</p>' +
          '<button class="btn primary" style="margin-top:12px" onclick="navShop(\'register\')">Register a Business</button></div>';
        return;
      }
      rows.forEach(function (r) { _bizOwned[r.id] = r; });
      // Identical card to Browse Businesses — owners edit from the profile's gear/pencils.
      g.innerHTML = rows.map(businessCard).join('');
    }).catch(function (e) { var g = $('myBizList'); if (g) g.innerHTML = '<p class="form-note" style="grid-column:1/-1;text-align:center;padding:40px">' + escHtml(e.message) + '</p>'; });
}

