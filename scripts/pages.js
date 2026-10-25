/* ============================================================
   pages.js - header dropdown nav + mobile menu, hero carousel,
   Contact Us overlay, Our Purpose (Philosophy) page, homepage
   FAQ accordion, and Local-Business shop scaffolds.
   Loaded last; uses globals from auth.js/directory.js (showView,
   requireAuth, t, escHtml, openOverlay/closeOverlay).
   ============================================================ */

/* ---------- Brand logo ----------
   A yellow sticky note pinned with a red push-pin (the paper / bulletin-board theme) carrying a
   "hub": one red center dot linked to three nodes — clubs and local businesses, connected.
   Bold, few shapes so it still reads at 30px. ONE source of truth for every logo spot; the same
   artwork is saved as styles/logo.svg for the browser-tab icon. */
var LOGO_SVG_INNER =
  '<g transform="rotate(-6 32 35)">' +
    '<rect x="11" y="14" width="44" height="44" rx="3" fill="#1a1a1a"/>' +                                   /* hard paper shadow */
    '<rect x="8" y="11" width="44" height="44" rx="3" fill="#ffd84d" stroke="#1a1a1a" stroke-width="3"/>' +  /* sticky note */
    '<path d="M30 37V25M30 37l-10.5 7.5M30 37l10.5 7.5" stroke="#1a1a1a" stroke-width="3.4" stroke-linecap="round"/>' +
    '<circle cx="30" cy="24.5" r="4.4" fill="#fff" stroke="#1a1a1a" stroke-width="2.8"/>' +
    '<circle cx="19" cy="45" r="4.4" fill="#fff" stroke="#1a1a1a" stroke-width="2.8"/>' +
    '<circle cx="41" cy="45" r="4.4" fill="#fff" stroke="#1a1a1a" stroke-width="2.8"/>' +
    '<circle cx="30" cy="37" r="6" fill="#d62828" stroke="#1a1a1a" stroke-width="2.8"/>' +
  '</g>' +
  '<circle cx="31" cy="9" r="5" fill="#d62828" stroke="#1a1a1a" stroke-width="2.6"/>' +                       /* push-pin */
  '<circle cx="29.4" cy="7.6" r="1.4" fill="#fff"/>';
function schLogo(px) {
  return '<svg class="sch-logo" viewBox="0 0 64 64" width="' + px + '" height="' + px + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Student Club Hub logo">' +
    LOGO_SVG_INNER + '</svg>';
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
   HERO CAROUSEL - rotating highlights with indicator bar
   ============================================================ */
/* Each slide carries its own BACKGROUND IMAGE (img) + headline/subtext. Drop real
   photos in by replacing the `img` values with url("styles/heroN.jpg") etc. - the
   carousel already switches the actual background layer, not just the text.
   Defaults use the embedded hero photo (var(--hero-img)) plus two generated
   navy campus-toned backgrounds so the image visibly changes with no extra files. */
var HERO_SLIDES = [
  { img: 'var(--hero-img)', h: 'Find a club at your school.<br>Or start your own.',
    p: 'Search by zip code or school, save the clubs you like, and contact the students who run them.' },
  { img: heroPattern('#0a2540', '#0083B0'), h: 'Local shops,<br>backing local clubs.',
    p: 'Businesses near your school sponsor clubs and give members discounts. Clubs get help, and shops get regulars.' },
  { img: heroPattern('#0b3a55', '#00B4DB'), h: 'Your school and your neighborhood,<br>on the same page.',
    p: 'Students, shop owners and neighbors helping each other out, all in one place.' }
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
}
function heroGo(i) { heroIndex = (i + HERO_SLIDES.length) % HERO_SLIDES.length; renderHero(); restartHeroAuto(); }
function restartHeroAuto() {
  if (_heroTimer) clearInterval(_heroTimer);
  _heroTimer = setInterval(function () {
    if ($('view-main') && !$('view-main').classList.contains('hidden')) { heroIndex = (heroIndex + 1) % HERO_SLIDES.length; renderHero(); }
  }, 6000);
}

/* ============================================================
   FEATURE CARDS - layered polygon cards (Students / Businesses / Community)
   ============================================================ */
var FEATURE_CARDS = [
  { cls: 'fc-a', ico: ICON_STUDENT, title: 'For Students', text: 'Find clubs near you, keep track of members and meetings, and have something real to show on your college apps.' },
  { cls: 'fc-b', ico: ICON_BUSINESS, title: 'For Local Businesses', text: 'Sponsor a club or give members a discount. Local families get to know you, and they come back.' },
  { cls: 'fc-c', ico: ICON_COMMUNITY, title: 'For the Community', text: 'See what students in your area are working on, and get deals at the shops that support them.' }
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
var CONTACT_EMAIL = 'support@studentclubhub.com';   // Zoho Mail inbox
/* ---- POPUP (main-page "Contact Us" button): short + quick message box ---- */
function openContactUs() {
  var li = !!currentUser;
  $('contactUsBody').innerHTML =
    '<div class="modal-pad contact-card">' +
      '<button class="icon-btn contact-x" onclick="closeContactUs()">✕</button>' +
      '<div class="contact-ico">' + svgIcon('mail', 26) + '</div>' +
      '<h3 class="contact-h">Contact Us</h3>' +
      '<p class="contact-sub">Found a website bug, or have feedback or an idea? Send us a quick message.</p>' +
      (li
        ? '<div class="contact-form"><div id="cuErr" class="auth-error hidden"></div>' +
            '<textarea id="cuMsg" class="contact-box" placeholder="Type your message here…"></textarea>' +
            '<button id="cuSend" class="btn primary block lg" onclick="submitContactMessage()">Send message</button>' +
            '<div class="contact-divider"><span>or email us directly</span></div></div>'
        : '<div class="contact-divider"><span>email us directly</span></div>') +
      '<a class="btn ghost block" href="mailto:' + CONTACT_EMAIL + '">' + svgIcon('mail', 16) + ' ' + CONTACT_EMAIL + '</a>' +
      (li ? '' : '<p class="form-note" style="text-align:center;margin-top:10px">Log in to send a message right here.</p>') +
      '<p class="form-note" style="text-align:center;margin-top:10px">Want to report a user, club, or business, or need more help? <a class="link" href="#" onclick="closeContactUs();navContact();return false">Visit the Contact page →</a></p>' +
    '</div>';
  openOverlay('contactUsOverlay');
}
function closeContactUs() { closeOverlay('contactUsOverlay'); }
function submitContactMessage() {
  var msg = ($('cuMsg') && $('cuMsg').value || '').trim();
  var err = function (m) { var e = $('cuErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } };
  if (!msg) return err('Write a short message first.');
  if (!currentUser) return err('Please log in to send a message.');
  if (typeof authBusy2 === 'function') authBusy2('cuSend', true, 'Sending…');
  _sendContactMessage(msg, 'contact_us')
    .then(function () { closeContactUs(); toast('Thanks! Your message was sent.'); })
    .catch(function () { if (typeof authBusy2 === 'function') authBusy2('cuSend', false); err('Couldn’t send right now — please email us at ' + CONTACT_EMAIL + ' instead.'); });
}
function _sendContactMessage(msg, source) {
  return sbRest('contact_messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
    sender_email: currentUser.email.toLowerCase(), sender_name: currentUser.name, member_id: currentUser.memberId || '', message: msg, source: source || 'contact_us'
  }) });
}
/* ---- PAGE (About Us → "Contact Us"): fuller info + how to report ---- */
function navContact() { closeMobileNav(); showView('contact'); renderContactPage(); }
function renderContactPage() {
  var el = $('contactPageBody'); if (!el) return;
  var li = !!currentUser;
  var form = li
    ? '<div class="contact-form" style="max-width:620px"><div id="cpErr" class="auth-error hidden"></div>' +
        '<textarea id="cpMsg" class="contact-box" style="min-height:170px" placeholder="Tell us what happened, what you expected, or share your idea…"></textarea>' +
        '<button id="cpSend" class="btn primary lg" style="margin-top:10px" onclick="submitContactPage()">Send message</button></div>'
    : '<p class="form-note"><a class="link" href="#" onclick="openAuth(\'login\');return false">Log in</a> to send us a message here, or email us below.</p>';
  el.innerHTML = pageBanner('About Us', 'Contact Us') +
    '<div class="container narrow"><div class="prose">' +
      '<h2>Get in touch</h2>' +
      '<p>Use <strong>Contact Us</strong> for website bug reports, feedback, feature ideas, or general questions about how Student Club Hub works. Messages come straight to our team.</p>' +
      form +
      '<div class="contact-emailline">Prefer email? Reach us at <a class="link" href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>.</div>' +
      '<h2 style="margin-top:34px">Reporting a user, club, or business</h2>' +
      '<p>If someone is misusing the platform, impersonating a group, or you have a concern about a club or business, you can report them. <strong>This page isn’t where you file the report</strong> — here’s how to do it:</p>' +
      '<ul class="contact-steps">' +
        '<li><strong>Find the <span class="inline-ico">' + ICON_FLAG + '</span> flag icon.</strong> It’s on every club and business — in the top-right of their card in the directory, and up on their page banner when you open them. On a person, it’s next to their name on their public profile.</li>' +
        '<li><strong>Tap it</strong> to open the report form (titled “Report Club”, “Report Business”, or “Report User”).</li>' +
        '<li><strong>Pick a reason</strong> from the dropdown and describe what happened in the box.</li>' +
        '<li><strong>Submit.</strong> The report goes to our team to review — the other party isn’t told who reported them.</li>' +
      '</ul>' +
      '<p class="form-note">You can also just message us above if you’re not sure — but the flag is the fastest way to report a specific club, business, or person.</p>' +
      '<div class="legal-note" style="margin-top:28px"><p>Student Club Hub is a directory and introduction platform. We review reports to keep the community safe, but we’re not a party to any partnership, sponsorship, or agreement between users and aren’t responsible for how those are carried out.</p></div>' +
    '</div></div>';
}
function submitContactPage() {
  var msg = ($('cpMsg') && $('cpMsg').value || '').trim();
  var err = function (m) { var e = $('cpErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } };
  if (!msg) return err('Write a short message first.');
  if (!currentUser) return err('Please log in to send a message.');
  if (typeof authBusy2 === 'function') authBusy2('cpSend', true, 'Sending…');
  _sendContactMessage(msg, 'about_us')
    .then(function () { if ($('cpMsg')) $('cpMsg').value = ''; if (typeof authBusy2 === 'function') authBusy2('cpSend', false); toast('Thanks! Your message was sent.'); })
    .catch(function () { if (typeof authBusy2 === 'function') authBusy2('cpSend', false); err('Couldn’t send right now — please email us at ' + CONTACT_EMAIL + ' instead.'); });
}

/* ============================================================
   REPORT a club / business / user  (flag icons → this popup)
   ============================================================ */
var REPORT_REASONS = {
  club: ['Inappropriate or offensive content', 'Impersonation / fake club', 'Harassment or bullying', 'Spam or scam', 'Misleading information', 'Other'],
  business: ['Inappropriate or offensive content', 'Impersonation / fake business', 'Misleading deal or false advertising', 'Harassment or bullying', 'Spam or scam', 'Other'],
  user: ['Harassment or bullying', 'Impersonation', 'Inappropriate messages or content', 'Spam or scam', 'Other']
};
var _reportCtx = null;
function openReport(type, id, name) {
  if (!currentUser) { toast('Please log in to report.'); if (typeof openAuth === 'function') openAuth('login'); return; }
  _reportCtx = { type: type, id: String(id), name: name || '' };
  var label = type === 'business' ? 'Business' : (type === 'user' ? 'User' : 'Club');
  var reasons = (REPORT_REASONS[type] || REPORT_REASONS.club).map(function (r) { return '<option>' + escHtml(r) + '</option>'; }).join('');
  $('bizBody').innerHTML = '<div class="modal-pad"><div class="ro-head"><h3>Report ' + label + '</h3>' +
    '<button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:12px">Reporting <strong>' + escHtml(name) + '</strong>. Our team reviews every report, and the other party won’t see who reported them.</p>' +
    '<div id="rpErr" class="auth-error hidden"></div>' +
    '<div class="field"><label>Reason</label><select id="rpReason" class="select block-select">' + reasons + '</select></div>' +
    '<div class="field"><label>What happened? <span class="form-note">(optional, but it helps)</span></label>' +
      '<textarea id="rpDetails" maxlength="800" placeholder="Describe the problem…"></textarea></div>' +
    '<button id="rpSend" class="btn primary block lg" onclick="submitReport()">Submit report</button></div>';
  openOverlay('bizOverlay');
}
function submitReport() {
  var c = _reportCtx; if (!c) return;
  var reason = ($('rpReason') && $('rpReason').value) || '';
  var details = ($('rpDetails') && $('rpDetails').value || '').trim();
  var err = function (m) { var e = $('rpErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } };
  if (!reason) return err('Pick a reason for the report.');
  if (typeof authBusy2 === 'function') authBusy2('rpSend', true, 'Submitting…');
  sbRest('reports', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
    reporter_email: currentUser.email.toLowerCase(), reporter_name: currentUser.name, reporter_id: currentUser.memberId || '',
    target_type: c.type, target_id: c.id, target_name: c.name, reason: reason, details: details
  }) }).then(function () { closeReach(); toast('Report submitted. Thank you — our team will review it.'); })
    .catch(function () { if (typeof authBusy2 === 'function') authBusy2('rpSend', false); err('Couldn’t submit right now. Please try again later.'); });
}

/* ============================================================
   OUR PURPOSE / PHILOSOPHY page
   ============================================================ */
function pageBanner(crumb, title) {
  return '<div class="page-banner">' + (typeof doodleLayer === 'function' ? doodleLayer('page') : '') + '<div class="container">' +
    '<div class="pb-crumb">' + escHtml(crumb) + '</div>' +
    '<h1 class="pb-title">' + escHtml(title) + '</h1></div></div>';
}
function renderPhilosophy() {
  var el = $('philosophyBody'); if (!el) return;
  el.innerHTML =
    pageBanner('About Us', 'Our Philosophy') +
    '<div class="container narrow"><div class="prose">' +
      '<div class="prose-logo">' + schLogo(96) + '</div>' +
      '<p>Student Club Hub started with a simple idea. High school clubs do a lot of good work, and most of the neighborhood never hears about it. Students spend hours running fundraisers, building robots, cleaning up beaches and planning events, while the coffee shop down the street would happily help out if anyone asked.</p>' +
      '<p>So we built one place where clubs are easy to find, and where local businesses and neighbors can back them.</p>' +
      '<h2>Why We Built This</h2>' +
      '<div class="rows">' +
        '<div class="prow"><div class="prow-ico">' + ICON_STUDENT + '</div><div class="prow-body"><h3>For High School Students &amp; Club Leaders</h3>' +
          '<p>Whether you run a club, want to start one, or are still looking for your thing, you shouldn’t have to dig through five group chats to find out when the next meeting is. Here you can find clubs, keep your roster and events in one spot, and build a record of what you actually did. That helps a lot when college applications come around.</p></div></div>' +
        '<div class="prow"><div class="prow-ico">' + ICON_BUSINESS + '</div><div class="prow-body"><h3>For Local Business Owners</h3>' +
          '<p>Small businesses are what make a neighborhood feel like one. Sponsoring a club or offering members a discount is an easy way to meet local families, and people remember the shop that bought the robotics team pizza.</p></div></div>' +
        '<div class="prow"><div class="prow-ico">' + ICON_COMMUNITY + '</div><div class="prow-body"><h3>For Residents &amp; Community Members</h3>' +
          '<p>If you live nearby, you get to see what students in your area are up to. Use the local deals, come to an event or two, and your support goes straight to the clubs doing the work.</p></div></div>' +
      '</div>' +
      '<h2>Where We’re Headed</h2>' +
      '<p>We want every school in the area to know the businesses and people around it. Students get recognition and real help, shops get loyal customers, and neighbors get a town that feels a bit more connected. Everybody comes out ahead.</p>' +
      '<div class="prose-cta"><button class="btn cta lg" onclick="navGoAuth(\'create\')">Register a Club</button>' +
        '<button class="btn blue lg" onclick="navShop(\'register\')">Register a Business</button></div>' +
    '</div></div>';
}
/* How It Works - three audiences, each a 3-step walkthrough */
var HIW_GROUPS = [
  { ico: ICON_STUDENT, title: 'For High School Students &amp; Club Leaders', steps: [
    { n: '01', t: 'Find or start a club in “Browse Clubs”', d: 'Open Browse Clubs from the menu and search by district, school or keyword. Starting something new? Hit Register a Club and your page is up in a couple of minutes.' },
    { n: '02', t: 'Run your club and find sponsors', d: 'Your club page keeps meeting times and sign-ups in one place. In Browse Businesses you can find nearby businesses that are open to sponsoring an event, chipping in on a project, or giving your members a discount.' },
    { n: '03', t: 'Show what you’ve done', d: 'Over time your page turns into a record of your events, member growth and local partners. That’s real experience you can point to on college apps and your resume.' }
  ]},
  { ico: ICON_BUSINESS, title: 'For Local Business Owners', steps: [
    { n: '01', t: 'List your business with “Register Your Business”', d: 'Go to Local Businesses and pick Register Your Business. Add your location, your website, and the clubs or causes you’d like to support.' },
    { n: '02', t: 'Post deals in “My Business”', d: 'From My Business you can post discounts, promo codes or sponsorship offers. Club members and local supporters see them when they browse.' },
    { n: '03', t: 'Team up with a club', d: 'Partner with clubs that need help with an event or a project. Students at nearby schools see your name, and your money stays in your own community.' }
  ]},
  { ico: ICON_COMMUNITY, title: 'For Community Members &amp; Supporters', steps: [
    { n: '01', t: 'See what’s going on in “Browse Clubs”', d: 'Check out the projects, fundraisers and events high school students are running near you.' },
    { n: '02', t: 'Find deals in “Browse Businesses”', d: 'Browse the local businesses that support student clubs, and use the discounts and promo codes they offer.' },
    { n: '03', t: 'Join in', d: 'Join a club as a community member to get its sponsored deals. Shopping at those businesses keeps sponsorship money going to student projects.' }
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
      '<div class="legal-note"><h3>Important: our role &amp; your responsibility</h3>' +
        '<p>Student Club Hub is a <strong>directory and introduction platform only</strong>. We help students, clubs, local businesses, and community members discover one another and communicate. We do <strong>not</strong> broker, review, endorse, guarantee, supervise, or take part in any partnership, sponsorship, discount, promotion, payment, or other agreement made between users.</p>' +
        '<p>Any such arrangement is made <strong>solely and directly between the parties involved</strong>, at their own risk. Student Club Hub is not a party to it and, to the fullest extent permitted by law, accepts <strong>no responsibility or legal liability</strong> for the conduct of any user or for any loss, dispute, injury, or damage arising from connections made through the platform. Users are responsible for verifying whom they deal with, complying with their school’s policies and applicable laws, and putting important terms in writing before committing.</p></div>' +
      '<div class="prose-cta" style="justify-content:center;margin-top:36px"><button class="btn cta lg" onclick="navGoAuth(\'create\')">Register a Club</button>' +
        '<button class="btn blue lg" onclick="navShop(\'register\')">Register a Business</button></div>' +
    '</div></div>';
}

/* ============================================================
   FAQ / HOW IT WORKS accordion (homepage)
   ============================================================ */
var FAQ_ITEMS = [
  { q: 'How do students join or start a club on Student Club Hub?',
    a: 'Search the directory by zip code, school or district, then open a club to save it, join it or contact its leaders. To start your own, sign in and use “Register a Club.” Add your meeting details, photos and social links, and it shows up in the directory right away.' },
  { q: 'How do local businesses partner with student clubs and post exclusive deals?',
    a: 'Sign in, then register your shop from the Local Businesses menu. It goes live right away. Use the pencil icons on your page to add a student deal, hours, photos and links. To team up with a club, open a club that’s “open to partnerships” and tap Reach Out.' },
  { q: 'How do community members access local business perks?',
    a: 'Browse the shops in the Local Businesses directory and use the deals listed on each one. Every purchase helps the businesses that back student projects.' },
  { q: 'Is Student Club Hub free to use for schools and clubs?',
    a: 'Yes. It’s free for students, advisors and schools. Student Club Hub is a directory and a community network, so no payments go through the site.' },
  { q: 'Who is responsible for partnerships, sponsorships, and discounts arranged on the platform?',
    a: 'You are. Student Club Hub is solely a directory and introduction service — it helps clubs, businesses, and community members find and message one another. Any partnership, sponsorship, discount, promotion, payment, or other agreement is made directly and exclusively between the parties involved. Student Club Hub is not a party to those arrangements, does not review, endorse, guarantee, or mediate them, and accepts no responsibility or legal liability for the conduct of any user or for any loss, dispute, or damage arising from them. Always confirm who you are dealing with and put important terms in writing before you commit.' },
  { q: 'What does the gold “Verified” seal mean?',
    a: 'A club’s President or a business owner can request the seal in Page settings. Student Club Hub reviews each request and adds the gold seal once it confirms the page is the real, official one. It shows the page is legitimate, not that we endorse the club, business or any deal. Always confirm who you’re dealing with before agreeing to anything important.' },
  { q: 'How do clubs and businesses form a partnership on the platform?',
    a: 'A club President or business owner opens the other side’s page (it has to be “open to partnerships”) and taps Reach Out. They choose a partnership type, describe it, and set start and end dates. The other side approves or rejects it under Partnership Requests. Once it’s approved, a “Partnership” tag shows on both banners from the start date through the end date, and either side can end it early. Nothing about the deal itself (discounts, terms, money) is handled or guaranteed by Student Club Hub.' },
  { q: 'What’s the difference between “open to partnerships” and being “partnered”?',
    a: '“Open to partnerships” is a badge a club or business turns on to say they’re looking to collaborate — it’s a standing invitation anyone can respond to. A “Partnership” tag means two specific groups have a confirmed, approved partnership. They’re independent: you can show both at once.' },
  { q: 'What is the ID shown on a club or business page for?',
    a: 'Every club and business gets a short unique ID (for example, #HQ3YN7). It’s a quick, unambiguous way to refer to or search for a specific listing — handy when two groups share a similar name, or when a leader wants to point someone straight to their page.' },
  { q: 'How do I contact a club or business?',
    a: 'Open their page and tap “Reach Out by Email.” That opens your own email app with a message addressed to the listing’s public contact address — conversations happen over email, not on the platform. Student Club Hub is an initial connector: it does not store or relay messages between users. Never share passwords or payment details, and remember that any agreement you reach is strictly between you and the other party.' },
  { q: 'What happens when a club President makes another member President?',
    a: 'It’s a straight swap of spots. The member you promote becomes the new President, and you take over their previous role — for example, if you make your Treasurer the President, you become the Treasurer. A club always has exactly one President, so leadership transfers rather than duplicates.' },
  { q: 'Who can edit a club or business page, and what can they change?',
    a: 'Only a club’s officers (President, Vice President, Secretary, Treasurer) or a business’s owner can edit its page, and the editing controls (gray pencil and gear icons) are visible only to them. They can update the banner slideshow, title, category, hours, description, links, images, and whether the group is public or private or open to partnerships — right from the profile, without a separate dashboard.' },
  { q: 'What’s the difference between a deal/discount and a partnership?',
    a: 'They’re two separate things. A deal (or discount) is an open offer a business lists on its page, for example “15% off with code HI.” Depending on who it’s set for, anyone or any student can use it. A partnership is an approved arrangement between a specific business and a specific club, and it shows a “Partnership” tag on both pages. A business might run a public discount, partner with a particular club, or both. The deal itself says who it’s for.' },
  { q: 'Can a business hide its current deal without deleting it?',
    a: 'Yes. An owner can tap the eye icon on their deal to hide it from visitors while keeping it saved for themselves, which is useful when a promotion is paused. While it’s hidden, the owner sees an “Only visible to you” note. Hiding a deal doesn’t affect any “Partnership” tag; it only hides that offer.' }
];
var faqOpen = -1;
function renderFaq() {
  var el = $('faqBody'); if (!el) return;
  el.innerHTML = pageBanner('About Us', 'FAQ') +
    '<div class="container narrow faq-page"><div class="prose-logo">' + schLogo(96) + '</div><div class="faq-list">' +
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
  browse: { ico: svgIcon('store', 22), title: 'Browse Businesses' },
  register: { ico: svgIcon('draft', 22), title: 'Register Your Business' },
  my: { ico: svgIcon('chart', 22), title: 'My Business' },
  saved: { ico: svgIcon('heart', 22), title: 'Saved Businesses' }
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

