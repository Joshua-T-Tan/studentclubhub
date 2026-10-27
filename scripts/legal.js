/* ============================================================
   legal.js — Terms of Use + Privacy Policy pages, and the one-time
   "Before you continue" agreement.
   Pages live under About Us (and in the footer). Every signed-in
   account must agree once (13+, Terms, Privacy) before using the
   site; the agreement is saved on the account (auth metadata
   terms_v / terms_at), so it's asked once per version, on any
   device. Bump LEGAL_VERSION when the documents change materially
   and everyone is asked again. Policy text is English (marked
   data-no-tr). Loaded last.
   ============================================================ */
var LEGAL_VERSION = '2026-10-26', LEGAL_UPDATED = 'October 26, 2026', LEGAL_EMAIL = 'support@studentclubhub.com';

function _legalSections(kind) {
  var mail = '<a class="link" href="mailto:' + LEGAL_EMAIL + '">' + LEGAL_EMAIL + '</a>';
  if (kind === 'privacy') return [
    ['Who we are', 'Student Club Hub (“we”, “us”) is a free directory that helps high school students find and run clubs and connects clubs with local businesses and community members. This policy explains what information we collect, how we use it, and the choices you have. Questions: ' + mail + '.'],
    ['Who can use Student Club Hub', 'You must be at least 13 years old to create an account. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has given us information, email us and we will delete it. If you are under 18, please review this policy with a parent or guardian.'],
    ['What we collect', '<ul><li><strong>Account details:</strong> your name, email address, a password (stored securely by our login provider, never readable by us) or your Google sign-in, and a member ID we assign.</li>' +
      '<li><strong>Profile details you choose to add:</strong> profile type (student, business owner or community member), school, graduation year, headline and bio.</li>' +
      '<li><strong>Things you post:</strong> clubs and businesses you register, photos and videos, chat messages, announcements, reviews and replies, promotions, partnership requests, reports, and messages you send us.</li>' +
      '<li><strong>Basic technical data:</strong> settings saved in your browser (such as language, theme and saved clubs) and the standard information any website receives when you visit (such as your browser type). We do not use advertising trackers.</li></ul>'],
    ['How we use it', 'To run the site: create and secure your account, show the clubs, businesses and profiles you and others publish, deliver features like club chat, reviews, partnerships and promotions, send sign-in codes and account emails, review reports and keep the community safe, and answer your messages. We do not sell your personal information and we do not use it for advertising.'],
    ['What other people can see', '<ul><li>Club and business pages, reviews, promotions and live partnerships are public.</li>' +
      '<li>Your name and the profile details you choose to show are public unless you make your profile private in Settings.</li>' +
      '<li>Club rosters and club chat are visible to that club’s members.</li>' +
      '<li>Your email address is never shown to other users. Clubs and businesses show only the public contact email they choose to list.</li></ul>'],
    ['Who helps us run the site', 'We use a few service providers that process data for us: Supabase (database, login and file storage), Vercel (website hosting), Google (only if you choose “Continue with Google”) and our email provider (to send sign-in codes and account emails). They may only use your information to provide their service to us. We may also share information if the law requires it, or to protect the safety of our users.'],
    ['How long we keep it', 'We keep your information while your account is open. You can delete your account at any time in Settings → Account; this removes your profile and your club memberships. Content you posted in a club may remain in that club’s history. Reports and records we need for safety or legal reasons may be kept for a limited time.'],
    ['Your choices and rights', 'You can view and edit your profile, make it private, change your language and settings, and delete your account at any time. You can also email us to ask for a copy of your information, to correct it, or to delete it. California residents have rights under California law (including the CCPA), and we honor them for everyone. We will not treat you differently for using them.'],
    ['Security', 'We use secure connections, a professional login system, and database rules that limit who can read and change each piece of information. No system is perfect, so please use a strong password, keep it private, and tell us right away if you think your account was misused.'],
    ['Changes to this policy', 'If we make important changes, we will update the date above and ask you to agree again the next time you sign in.'],
    ['Contact us', 'Email ' + mail + ' with any questions or requests about your privacy.']
  ];
  return [
    ['Welcome', 'These Terms of Use (“Terms”) are an agreement between you and Student Club Hub (“we”, “us”). By creating an account or using the site, you agree to these Terms and to our Privacy Policy. If you do not agree, please do not use Student Club Hub.'],
    ['Who can use it', 'You must be at least 13 years old. If you are under 18, you confirm that a parent or guardian has reviewed these Terms with you. Business listings must be created by someone who is allowed to represent that business.'],
    ['Your account', 'Give accurate information, keep your password private, and do not share your account or create accounts for other people without their permission. You are responsible for what happens under your account. Tell us right away at ' + LEGAL_EMAIL + ' if you think your account was misused.'],
    ['Community rules', 'Treat everyone with respect. Do not post or send anything that is:<ul><li>harassing, bullying, threatening, hateful or discriminatory;</li>' +
      '<li>sexual, violent, or otherwise inappropriate for high school students;</li>' +
      '<li>false or misleading, including fake clubs, fake businesses or pretending to be someone else;</li>' +
      '<li>spam, scams, or attempts to collect other people’s personal information;</li>' +
      '<li>illegal, or something that infringes someone else’s rights (such as photos you do not have permission to share).</li></ul>' +
      'Adults using the site must not use it to contact students for anything unrelated to a club, business partnership or community activity. Use the report flag to tell us about anything that breaks these rules.'],
    ['Clubs, businesses and invite codes', 'Club Presidents and business owners are responsible for their pages and for following their school’s rules. Invite codes are personal and work once; do not share or sell them. We may remove or change any club, business, review or other content, and may suspend or close accounts, that break these Terms or put others at risk.'],
    ['Partnerships, promotions and deals', 'Student Club Hub is a directory and introduction service only. We do not process payments. Any partnership, sponsorship, discount, promotion or other agreement is made directly between the people involved. We are not a party to it, do not guarantee it, and are not responsible for whether it is honored. Verify who you are dealing with and put important terms in writing.'],
    ['Your content', 'You keep ownership of what you post. By posting it, you give us permission to store, display and share it on Student Club Hub so the site can work (for example, showing your club page to visitors). You confirm you have the right to post it. You can remove most content at any time.'],
    ['Our content', 'The Student Club Hub name, logo and site design belong to us. Please do not copy them or use them in a way that suggests we endorse you.'],
    ['Disclaimers', 'Student Club Hub is provided “as is” and “as available.” We do our best to keep it working and safe, but we do not promise it will always be available, error-free, or that information posted by users is accurate. Clubs and businesses listed here are run by their own members and owners, not by us, and a listing is not an endorsement.'],
    ['Limitation of liability', 'To the fullest extent the law allows, Student Club Hub is not responsible for indirect or consequential losses, or for anything that happens between users, including partnerships, promotions, purchases or meetings arranged through the site.'],
    ['Ending your use', 'You can stop using Student Club Hub and delete your account at any time in Settings. We may suspend or end access for anyone who breaks these Terms.'],
    ['Changes and governing law', 'We may update these Terms. If the changes are important, we will update the date above and ask you to agree again the next time you sign in. These Terms are governed by the laws of the State of California.'],
    ['Contact us', 'Questions about these Terms? Email ' + LEGAL_EMAIL + '.']
  ];
}
function legalBodyHTML(kind) {
  return '<div data-no-tr class="legal-doc"><p class="legal-updated">Last updated: ' + LEGAL_UPDATED + '</p>' +
    _legalSections(kind).map(function (s) { return '<h3>' + s[0] + '</h3>' + (/^<ul>/.test(s[1]) ? s[1] : '<p>' + s[1] + '</p>'); }).join('') + '</div>';
}
function renderLegalPages() {
  [['terms', 'Terms of Use'], ['privacy', 'Privacy Policy']].forEach(function (k) {
    var el = $(k[0] + 'Body'); if (!el) return;
    el.innerHTML = pageBanner('About Us', k[1]) + '<div class="container narrow"><div class="prose">' +
      '<p class="legal-lang-note">This document is provided in English.</p>' + legalBodyHTML(k[0]) + '</div></div>';
  });
}
function navLegal(kind) { if (typeof closeMobileNav === 'function') closeMobileNav(); showView(kind); window.scrollTo(0, 0); }

/* ---------- The one-time agreement ---------- */
var _legalGateOpen = false, _legalChecks = { age: false, terms: false, privacy: false };   // remembered while reading a document
function _legalAccepted() {
  var m = (typeof sbSession !== 'undefined' && sbSession && sbSession.user && sbSession.user.meta) || {};
  return m.terms_v === LEGAL_VERSION;
}
function checkLegalGate() {
  if (_legalGateOpen || !currentUser || typeof sbHasSession !== 'function' || !sbHasSession(currentUser.email) || _legalAccepted()) return;
  _legalGateOpen = true; _paintLegalGate();
}
function _paintLegalGate(reading) {
  var ov = $('legalOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'legalOverlay'; ov.className = 'overlay legal-overlay'; document.body.appendChild(ov); }
  if (reading) {
    ov.innerHTML = '<div class="modal legal-modal"><div class="modal-pad"><div class="ro-head"><h3>' + (reading === 'terms' ? 'Terms of Use' : 'Privacy Policy') + '</h3></div>' +
      '<div class="legal-scroll">' + legalBodyHTML(reading) + '</div>' +
      '<button class="btn primary block" style="margin-top:12px" onclick="_paintLegalGate()">Back</button></div></div>';
    return;
  }
  var keep = _legalChecks;
  ov.innerHTML = '<div class="modal legal-modal"><div class="modal-pad">' +
    '<div class="legal-logo">' + (typeof schLogo === 'function' ? schLogo(56) : '') + '</div>' +
    '<h3 class="legal-h">Before you continue</h3>' +
    '<p class="form-note" style="text-align:center;margin-bottom:14px">Student Club Hub is for people 13 and older. Please read and agree to our Terms of Use and Privacy Policy.</p>' +
    '<label class="legal-check"><input type="checkbox" id="lgAge" onchange="_legalReady()"' + (keep.age ? ' checked' : '') + '><span>I am 13 years old or older.</span></label>' +
    '<label class="legal-check"><input type="checkbox" id="lgTerms" onchange="_legalReady()"' + (keep.terms ? ' checked' : '') + '><span>I have read and agree to the Terms of Use.</span>' +
      '<button type="button" class="legal-read" onclick="event.preventDefault();_paintLegalGate(\'terms\')">Read</button></label>' +
    '<label class="legal-check"><input type="checkbox" id="lgPrivacy" onchange="_legalReady()"' + (keep.privacy ? ' checked' : '') + '><span>I have read and agree to the Privacy Policy.</span>' +
      '<button type="button" class="legal-read" onclick="event.preventDefault();_paintLegalGate(\'privacy\')">Read</button></label>' +
    '<div id="lgErr" class="auth-error hidden"></div>' +
    '<button id="lgContinue" class="btn primary block lg" disabled onclick="acceptLegal()">Continue</button>' +
    '<button class="btn ghost block" style="margin-top:8px" onclick="declineLegal()">Log out</button></div></div>';
  _legalReady();
}
function _legalReady() {
  if ($('lgAge')) _legalChecks = { age: $('lgAge').checked, terms: $('lgTerms').checked, privacy: $('lgPrivacy').checked };
  var b = $('lgContinue'); if (b) b.disabled = !(_legalChecks.age && _legalChecks.terms && _legalChecks.privacy);
}
function acceptLegal() {
  if (!($('lgAge').checked && $('lgTerms').checked && $('lgPrivacy').checked)) return;
  authBusy2('lgContinue', true, 'Saving…');
  sbUpdateUser({ data: { terms_v: LEGAL_VERSION, terms_at: new Date().toISOString() } }).then(function () {
    _closeLegalGate(); toast('Thanks! You’re all set.');
  }).catch(function (ex) {
    authBusy2('lgContinue', false);
    var e = $('lgErr'); if (e) { e.textContent = ex.message || 'Couldn’t save that. Please try again.'; e.classList.remove('hidden'); }
  });
}
function declineLegal() { _closeLegalGate(); if (typeof doLogout === 'function') doLogout(); }
function _closeLegalGate() { _legalGateOpen = false; _legalChecks = { age: false, terms: false, privacy: false }; var ov = $('legalOverlay'); if (ov) ov.remove(); }

document.addEventListener('DOMContentLoaded', function () {
  renderLegalPages();
  setTimeout(checkLegalGate, 1500);   // a returning session (after it's restored)
});
