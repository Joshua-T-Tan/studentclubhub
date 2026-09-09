/* ============================================================
   pages.js — header dropdown nav + mobile menu, hero carousel,
   Contact Us overlay, Our Purpose (Philosophy) page, homepage
   FAQ accordion, and Local-Business shop scaffolds.
   Loaded last; uses globals from auth.js/directory.js (showView,
   requireAuth, t, escHtml, openOverlay/closeOverlay).
   ============================================================ */

/* ---------- Brand logo (orange suspension-bridge badge) ----------
   ONE source of truth used in every location (header, Our Philosophy, How It
   Works, FAQ, reviews). For a pixel-perfect match to your artwork, drop the file
   at styles/logo.png and set LOGO_IMG_SRC below — every logo swaps at once. */
var LOGO_IMG_SRC = 'styles/logo.png';   // real artwork; set to '' to fall back to the built-in SVG
function schStar(cx, cy, k) {
  return '<g transform="translate(' + cx + ',' + cy + ') scale(' + k + ')">' +
    '<path d="M0,-10 2.9,-3.1 9.5,-3.1 4.3,1.2 5.9,7.9 0,4 -5.9,7.9 -4.3,1.2 -9.5,-3.1 -2.9,-3.1Z" fill="var(--accent)"/></g>';
}
function schLogo(px) {
  if (LOGO_IMG_SRC) return '<img class="sch-logo" src="' + LOGO_IMG_SRC + '" width="' + px + '" height="' + px + '" alt="Student Club Hub logo">';
  return '<svg class="sch-logo" viewBox="0 0 100 100" width="' + px + '" height="' + px + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Student Club Hub logo">' +
    '<circle cx="50" cy="50" r="47" fill="none" stroke="var(--accent)" stroke-width="3"/>' +
    '<circle cx="50" cy="50" r="40" fill="var(--accent)" fill-opacity="0.12"/>' +
    schStar(50, 15, 0.72) + schStar(33, 20, 0.5) + schStar(67, 20, 0.5) +
    '<rect x="13" y="70" width="74" height="5" rx="1.5" fill="var(--accent)"/>' +
    /* two towers, each with a pointed (gothic) arch — Brooklyn-Bridge silhouette */
    '<path fill-rule="evenodd" fill="var(--accent)" d="M33 72 L33 36 L43 36 L43 72 Z M35 72 L35 52 Q35 45.5 38 43.5 Q41 45.5 41 52 L41 72 Z"/>' +
    '<path fill-rule="evenodd" fill="var(--accent)" d="M57 72 L57 36 L67 36 L67 72 Z M59 72 L59 52 Q59 45.5 62 43.5 Q65 45.5 65 52 L65 72 Z"/>' +
    /* main suspension cable draped across both towers */
    '<path d="M14 69 Q26 41 38 36 Q50 52 62 36 Q74 41 86 69" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/>' +
    /* vertical suspender ropes */
    '<g stroke="var(--accent)" stroke-width="1.1" opacity="0.9">' +
    '<path d="M20 57 20 70M27 53 27 70M33 50 33 70M45 50 45 70M50 53 50 70M55 50 55 70M67 53 67 70M73 57 73 70M80 60 80 70"/></g>' +
    '</svg>';
}
/* Orange feature-card icons (replace the emoji) */
var ICON_STUDENT = '<svg viewBox="0 0 24 24" width="30" height="30" fill="var(--accent)"><path d="M12 3 1 8l11 5 9-4.1V15h2V8L12 3z"/><path d="M5 12.2V16c0 1.7 3.1 3 7 3s7-1.3 7-3v-3.8l-7 3.2-7-3.2z"/></svg>';
var ICON_BUSINESS = '<svg viewBox="0 0 24 24" width="30" height="30" fill="var(--accent)"><path d="M3 3h18l-1 5H4L3 3z"/><path d="M4.5 9.5A2.5 2.5 0 0 0 8 9a2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 4 0 2.5 2.5 0 0 0 3.5.5V21H14v-6h-4v6H4.5V9.5z"/></svg>';
var ICON_COMMUNITY = '<svg viewBox="0 0 24 24" width="30" height="30" fill="var(--accent)"><circle cx="12" cy="7" r="3"/><circle cx="5" cy="11" r="2.4"/><circle cx="19" cy="11" r="2.4"/><path d="M12 11c-3 0-5 1.8-5 4.2V18h10v-2.8c0-2.4-2-4.2-5-4.2zM5 14c-2 0-3.5 1.2-3.5 3V19H6v-2.8c0-.8.2-1.5.6-2.1A5 5 0 0 0 5 14zm14 0c-.2 0-.4 0-.6.1.4.6.6 1.3.6 2.1V19h4.5v-2c0-1.8-1.5-3-3.5-3z"/></svg>';

/* ---------- Dropdown navigation ---------- */
var NAV_GROUPS = {
  students: ['browse', 'myclubs', 'saved', 'create'],
  business: ['shops'],
  purpose: ['philosophy', 'howitworks', 'faq']
};
function toggleNavMenu(event, group) {
  event.stopPropagation();
  var item = event.currentTarget.closest('.nav-item');
  var wasOpen = item.classList.contains('open');
  closeAllMenus();
  if (!wasOpen) item.classList.add('open');
}
function closeAllMenus() {
  document.querySelectorAll('.nav-item.open').forEach(function (el) { el.classList.remove('open'); });
}
function toggleMobileNav() {
  var nav = $('mainNav'); if (nav) nav.classList.toggle('open-mobile');
  if (!$('mainNav').classList.contains('open-mobile')) closeAllMenus();
}
function closeMobileNav() { var nav = $('mainNav'); if (nav) nav.classList.remove('open-mobile'); closeAllMenus(); }
/* Route helpers used by the dropdown items */
function navGo(view) { closeMobileNav(); showView(view); }
function navGoAuth(view) { closeMobileNav(); requireAuth(function () { showView(view); }); }
function navShop(kind) { closeMobileNav(); openShops(kind); }
function navFaq() { closeMobileNav(); showView('faq'); }
function navHowItWorks() { closeMobileNav(); showView('howitworks'); }
/* Highlight the dropdown trigger whose group owns the active view */
function setNavActive(view) {
  document.querySelectorAll('.nav-trigger[data-group]').forEach(function (b) {
    var g = b.getAttribute('data-group');
    b.classList.toggle('active', (NAV_GROUPS[g] || []).indexOf(view) !== -1);
  });
}

/* ============================================================
   HERO CAROUSEL — rotating highlights with indicator bar
   ============================================================ */
/* Each slide carries its own BACKGROUND IMAGE (img) + headline/subtext. Drop real
   photos in by replacing the `img` values with url("styles/heroN.jpg") etc. — the
   carousel already switches the actual background layer, not just the text.
   Defaults use the embedded hero photo (var(--hero-img)) plus two generated
   navy campus-toned backgrounds so the image visibly changes with no extra files. */
var HERO_SLIDES = [
  { img: 'var(--hero-img)', h: 'Discover Your Community.<br>Explore High School Clubs Near You.',
    p: 'Search clubs by zip code or school, save the ones you love, and get connected with their leaders — all in one place.' },
  { img: heroPattern('#0a2540', '#0083B0'), h: 'Local Perks, Real Support.<br>Businesses Backing Student Clubs.',
    p: 'Unlock exclusive neighborhood deals while local shops sponsor the next generation of student leaders.' },
  { img: heroPattern('#0b3a55', '#00B4DB'), h: 'Stronger Together.<br>Where Students &amp; Neighborhoods Connect.',
    p: 'Turn campus ambition into real community impact — students, businesses, and residents, all in one network.' }
];
/* Generate a distinct navy gradient background as a data-URI "image" (no external file). */
function heroPattern(a, b) {
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient></defs>' +
    '<rect width="1200" height="600" fill="url(#g)"/>' +
    '<g fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2">' +
    '<circle cx="980" cy="150" r="220"/><circle cx="980" cy="150" r="150"/><circle cx="200" cy="520" r="180"/></g></svg>';
  return "url('data:image/svg+xml;utf8," + encodeURIComponent(svg) + "')";
}
var heroIndex = 0, _heroTimer = null;
function renderHero() {
  var bg = $('heroBg');
  if (bg) bg.innerHTML = HERO_SLIDES.map(function (s, i) {
    return '<div class="hero-bg-layer' + (i === heroIndex ? ' active' : '') + '" style="background-image:' + s.img + '"></div>';
  }).join('');
  var wrap = $('heroCarousel');
  if (wrap) wrap.innerHTML = HERO_SLIDES.map(function (s, i) {
    return '<div class="hero-slide' + (i === heroIndex ? ' active' : '') + '"><h1>' + s.h + '</h1><p>' + s.p + '</p></div>';
  }).join('');
  var dots = $('heroDots');
  if (dots) dots.innerHTML = HERO_SLIDES.map(function (s, i) {
    return '<button class="hero-dot' + (i === heroIndex ? ' active' : '') + '" title="Slide ' + (i + 1) +
      '" onclick="heroGo(' + i + ')"><span></span></button>';
  }).join('');
}
function heroGo(i) { heroIndex = (i + HERO_SLIDES.length) % HERO_SLIDES.length; renderHero(); restartHeroAuto(); }
function restartHeroAuto() {
  if (_heroTimer) clearInterval(_heroTimer);
  _heroTimer = setInterval(function () {
    if ($('view-main') && !$('view-main').classList.contains('hidden')) { heroIndex = (heroIndex + 1) % HERO_SLIDES.length; renderHero(); }
  }, 6000);
}

/* ============================================================
   FEATURE CARDS — layered polygon cards (Students / Businesses / Community)
   ============================================================ */
var FEATURE_CARDS = [
  { cls: 'fc-a', ico: ICON_STUDENT, title: 'For Students', text: 'Discover clubs near you, manage rosters and events, and showcase real leadership that stands out on college applications.' },
  { cls: 'fc-b', ico: ICON_BUSINESS, title: 'For Local Businesses', text: 'Sponsor nearby clubs and offer member-only perks — turning promotion into genuine community goodwill and foot traffic.' },
  { cls: 'fc-c', ico: ICON_COMMUNITY, title: 'For the Community', text: 'Follow student achievements in your area and unlock exclusive neighborhood deals while fueling youth projects.' }
];
function renderFeatureCards() {
  var el = $('featureCards'); if (!el) return;
  el.innerHTML = FEATURE_CARDS.map(function (c) {
    return '<div class="poly-card ' + c.cls + '"><div class="poly-back"></div>' +
      '<div class="poly-front"><div class="poly-ico">' + c.ico + '</div>' +
      '<h3>' + escHtml(c.title) + '</h3><p>' + escHtml(c.text) + '</p></div></div>';
  }).join('');
}

/* ============================================================
   CONTACT US overlay (info + email; no money/data collection)
   ============================================================ */
function openContactUs() {
  $('contactUsBody').innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<h3 style="font-size:1.2rem;font-weight:800">Contact Us</h3>' +
      '<button class="icon-btn" onclick="closeContactUs()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:16px">Questions, partnership ideas, or feedback? We’d love to hear from students, club leaders, local businesses, and residents alike.</p>' +
    '<a class="btn cta block lg" href="mailto:hello@studentclubhub.org">✉ Email hello@studentclubhub.org</a>' +
    '<p class="form-note" style="text-align:center;margin-top:12px">This is a demo MVP — the address above is a placeholder.</p>';
  openOverlay('contactUsOverlay');
}
function closeContactUs() { closeOverlay('contactUsOverlay'); }

/* ============================================================
   OUR PURPOSE / PHILOSOPHY page
   ============================================================ */
function pageBanner(crumb, title) {
  return '<div class="page-banner"><div class="container">' +
    '<div class="pb-crumb">' + escHtml(crumb) + '</div>' +
    '<h1 class="pb-title">' + escHtml(title) + '</h1></div></div>';
}
function renderPhilosophy() {
  var el = $('philosophyBody'); if (!el) return;
  el.innerHTML =
    pageBanner('About Us', 'Our Philosophy') +
    '<div class="container narrow"><div class="prose">' +
      '<div class="prose-logo">' + schLogo(96) + '</div>' +
      '<p>At Student Club Hub, we believe a community thrives when its youth, local businesses, and residents are connected. High school is where the next generation of leaders and innovators find their voice, pouring countless hours into organizing impactful projects and campus initiatives. Yet too often, these efforts remain isolated within school walls. Whether you are a student striving to make an impact, a local business owner looking to support the next generation, or a resident eager to back youth projects while unlocking exclusive neighborhood perks, Student Club Hub is built for you.</p>' +
      '<p>We created this platform to break down institutional barriers, offering a centralized network that elevates high school extracurriculars and bridges the gap between student ambition and local community support.</p>' +
      '<h2>Why We Built Student Club Hub</h2>' +
      '<div class="rows">' +
        '<div class="prow"><div class="prow-ico">' + ICON_STUDENT + '</div><div class="prow-body"><h3>For High School Students &amp; Club Leaders</h3>' +
          '<p>Whether you are leading an established club, starting a new project from scratch, or simply searching for your passion, you need tools that match your ambition. With Student Club Hub, you can easily discover active organizations, manage team rosters, and coordinate events without the chaos of fragmented group chats. Most importantly, you gain a structured stage to showcase your real-world leadership and community impact—building verifiable experience that sets your college applications apart.</p></div></div>' +
        '<div class="prow"><div class="prow-ico">' + ICON_BUSINESS + '</div><div class="prow-body"><h3>For Local Business Owners</h3>' +
          '<p>As the backbone of our neighborhood economy, you deserve a direct, meaningful way to connect with local families and young consumers. By partnering with student clubs through sponsorships and exclusive member discounts, you turn standard promotional spending into genuine community goodwill, driving foot traffic and earning lifelong local loyalty.</p></div></div>' +
        '<div class="prow"><div class="prow-ico">' + ICON_COMMUNITY + '</div><div class="prow-body"><h3>For Residents &amp; Community Members</h3>' +
          '<p>As local supporters, you gain a transparent window into the incredible achievements of students in your area. By engaging with student projects and taking advantage of unique local business deals available through our platform, you directly fuel youth initiatives while enjoying exclusive perks across town.</p></div></div>' +
      '</div>' +
      '<h2>Our Vision</h2>' +
      '<p>We envision a fully connected regional ecosystem where student leadership receives the recognition and resources it deserves, local businesses flourish through authentic community relationships, and residents enjoy a vibrant local economy with unique everyday benefits. When you participate in Student Club Hub, you are not just using a platform—you are actively shaping an interconnected community where everyone wins.</p>' +
      '<div class="prose-cta"><button class="btn cta lg" onclick="navGoAuth(\'create\')">Register a Club</button>' +
        '<button class="btn blue lg" onclick="navShop(\'register\')">Register a Shop</button></div>' +
    '</div></div>';
}
/* How It Works — three audiences, each a 3-step walkthrough */
var HIW_GROUPS = [
  { ico: ICON_STUDENT, title: 'For High School Students &amp; Club Leaders', steps: [
    { n: '01', t: 'Discover &amp; Launch in “Browse Clubs”', d: 'Head to the Browse Clubs section in the navigation menu to explore active organizations across regional campuses by district or keyword. If you are starting a new initiative, click Register a Club to create your official directory profile in under two minutes.' },
    { n: '02', t: 'Manage Rosters &amp; Unlock Local Perks', d: 'Use your custom club dashboard to organize meeting schedules, track active member sign-ups, and connect with local sponsors. Within the Browse Shops directory, browse nearby businesses willing to provide project funding, event sponsorships, or member discounts.' },
    { n: '03', t: 'Showcase Real-World Leadership', d: 'Build a verifiable portfolio of community impact, active membership growth, and local business partnerships—giving you concrete metrics that make your college applications and resume stand out.' }
  ]},
  { ico: ICON_BUSINESS, title: 'For Local Business Owners', steps: [
    { n: '01', t: 'Create Your Listing via “Register My Shop”', d: 'Navigate to Local Businesses and select Register My Shop to build your storefront profile. Showcase your business location, website, and the specific youth initiatives or clubs you want to back.' },
    { n: '02', t: 'Post Custom Deals in “My Shop”', d: 'Access your My Shop dashboard to post exclusive discounts, promotional codes, or sponsorship offers. These perks become visible to active club members and verified community supporters browsing the platform.' },
    { n: '03', t: 'Partner Directly with Student Clubs', d: 'Form official partnerships with student organizations looking for event funding or project support. Sponsoring local clubs gives your shop direct brand visibility across campuses while actively investing in student initiatives.' }
  ]},
  { ico: ICON_COMMUNITY, title: 'For Community Members &amp; Supporters', steps: [
    { n: '01', t: 'Explore Local Campus Initiatives in “Browse Clubs”', d: 'Visit the Browse Clubs directory to see active projects, fundraisers, and campus events high school students are running in your neighborhood.' },
    { n: '02', t: 'Unlock Exclusive Perks in “Browse Shops”', d: 'Explore participating neighborhood businesses in the Browse Shops section. Access exclusive discounts and promotional codes provided by local owners who back youth programs.' },
    { n: '03', t: 'Join Clubs &amp; Fuel Local Sponsorships', d: 'Join local clubs as a community member to leverage sponsored business deals. Your active participation helps direct local business funding straight to student club projects while driving customers back to neighborhood shops.' }
  ]}
];
function renderHowItWorks() {
  var el = $('howitworksBody'); if (!el) return;
  var groups = HIW_GROUPS.map(function (g) {
    var steps = g.steps.map(function (s) {
      return '<div class="hiw-step"><div class="hiw-num">' + s.n + '</div>' +
        '<div class="hiw-step-body"><h4>' + s.t + '</h4><p>' + s.d + '</p></div></div>';
    }).join('');
    return '<div class="hiw-group"><div class="hiw-group-head"><span class="hiw-group-ico">' + g.ico + '</span>' +
      '<h2>' + g.title + '</h2></div><div class="hiw-steps">' + steps + '</div></div>';
  }).join('');
  el.innerHTML = pageBanner('About Us', 'How It Works') +
    '<div class="container narrow"><div class="prose">' +
      '<div class="prose-logo">' + schLogo(96) + '</div>' + groups +
      '<div class="prose-cta" style="justify-content:center;margin-top:36px"><button class="btn cta lg" onclick="navGoAuth(\'create\')">Register a Club</button>' +
        '<button class="btn blue lg" onclick="navShop(\'register\')">Register a Shop</button></div>' +
    '</div></div>';
}

/* ============================================================
   FAQ / HOW IT WORKS accordion (homepage)
   ============================================================ */
var FAQ_ITEMS = [
  { q: 'How do students join or start a club on Student Club Hub?',
    a: 'Browse the directory by zip code, school, or district to find active clubs, then open any club to save it, join it, or contact its leaders. To start your own, sign in and use “Register a Club” to publish a profile with your meeting details, media, and social links — it appears in the directory instantly.' },
  { q: 'How do local businesses partner with student clubs and post exclusive deals?',
    a: 'Business owners can register a shop from the Local Businesses menu to create a storefront, then offer sponsorships and member-only perks to nearby clubs. (The full shop tools are rolling out — the pages are scaffolded now and fill in with a later update.)' },
  { q: 'How do community members access local business perks?',
    a: 'Residents and members browse participating shops in the Local Businesses directory and redeem the perks and deals listed on each storefront — supporting youth projects while enjoying neighborhood benefits.' },
  { q: 'Is Student Club Hub free to use for schools and clubs?',
    a: 'Yes. Discovering, saving, joining, and running clubs is completely free for students, advisors, and schools. Student Club Hub is a directory and community network — there is no payment processing or money movement on the platform.' }
];
var faqOpen = -1;
function renderFaq() {
  var el = $('faqBody'); if (!el) return;
  el.innerHTML = pageBanner('About Us', 'FAQ') +
    '<div class="container narrow"><div class="prose-logo">' + schLogo(96) + '</div><div class="faq-list">' +
    FAQ_ITEMS.map(function (f, i) {
      return '<div class="faq-item' + (i === faqOpen ? ' open' : '') + '">' +
        '<button class="faq-q" onclick="toggleFaq(' + i + ')"><span>' + escHtml(f.q) + '</span><span class="faq-caret">⌄</span></button>' +
        '<div class="faq-a"><p>' + escHtml(f.a) + '</p></div></div>';
    }).join('') + '</div></div>';
}
function toggleFaq(i) { faqOpen = (faqOpen === i) ? -1 : i; renderFaq(); }

/* ============================================================
   LOCAL BUSINESS shop scaffolds (nav routes here for now)
   ============================================================ */
var SHOP_SECTIONS = {
  browse: { ico: '🏪', title: 'Browse Shops' },
  register: { ico: '📝', title: 'Register My Shop' },
  my: { ico: '📊', title: 'My Shop' },
  saved: { ico: '💙', title: 'Saved Shops' }
};
var currentShopKind = 'browse';
function openShops(kind) {
  currentShopKind = SHOP_SECTIONS[kind] ? kind : 'browse';
  showView('shops');
  renderShops();
}
function renderShops() {
  var el = $('shopsBody'); if (!el) return;
  // The four sections live in the "Local Businesses" dropdown, so no in-page tab strip.
  if (typeof renderBusinesses === 'function') { renderBusinesses(currentShopKind); }
  else { el.innerHTML = '<div class="page-head centered"><h1>Local Businesses</h1></div>'; }
}

/* ---------- init ---------- */
/* Fill the static logo slots (header brand + reviews header) */
function paintLogos() {
  var b = $('brandLogo'); if (b) b.innerHTML = schLogo(40);
  var rv = $('reviewsLogo'); if (rv) rv.innerHTML = schLogo(56);
}
function initPages() {
  paintLogos();
  renderHero(); restartHeroAuto(); renderFeatureCards(); renderFaq(); renderPhilosophy(); renderHowItWorks();
  // Close dropdowns when clicking outside the nav
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.nav-item')) closeAllMenus();
  });
}
document.addEventListener('DOMContentLoaded', initPages);
