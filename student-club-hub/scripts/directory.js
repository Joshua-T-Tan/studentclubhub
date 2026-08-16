/* ============================================================
   directory.js — club data, card rendering, zip/school/district
   search, focus filters, top-clubs spotlight, sorting, stats,
   and club creation (media, district validation, invite code).
   ============================================================ */

/* ---------- Categories (creation dropdown + card cover) ---------- */
var CATEGORIES = [
  { name: 'STEM & Tech',                 grad: 'linear-gradient(135deg,#6366f1,#4f46e5)', icon: '🔬' },
  { name: 'Business & Entrepreneurship', grad: 'linear-gradient(135deg,#f59e0b,#d97706)', icon: '📈' },
  { name: 'Arts, Media & Design',        grad: 'linear-gradient(135deg,#ec4899,#db2777)', icon: '🎨' },
  { name: 'Culture & Language',          grad: 'linear-gradient(135deg,#14b8a6,#0d9488)', icon: '🌐' },
  { name: 'Community Service',           grad: 'linear-gradient(135deg,#10b981,#059669)', icon: '🤝' },
  { name: 'Humanities & Debate',         grad: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', icon: '🎙️' },
  { name: 'Health & Medicine',           grad: 'linear-gradient(135deg,#ef4444,#dc2626)', icon: '⚕️' },
  { name: 'Athletics & Recreation',      grad: 'linear-gradient(135deg,#0ea5e9,#0284c7)', icon: '⚽' },
  { name: 'Hobbies & Niche Interests',   grad: 'linear-gradient(135deg,#64748b,#475569)', icon: '🎲' }
];
function styleForCategory(cat) {
  return CATEGORIES.find(function (c) { return c.name === cat; }) ||
    { grad: 'linear-gradient(135deg,#6366f1,#4f46e5)', icon: '◎' };
}
/* Cover background: uploaded banner if present, otherwise a clean gradient block */
function coverStyle(club) {
  if (club.banner) return 'background:center/cover no-repeat url(' + club.banner + ')';
  return 'background:' + styleForCategory(club.category).grad;
}

/* ---------- Focus quick-filters (no "All" chip — click again to clear) ---------- */
var FOCUS_FILTERS = ['STEM', 'Social Impact', 'Community Service', 'Arts', 'Athletics', 'Academic Competition'];

/* ---------- Recruitment statuses (streamlined) ---------- */
/* Public / Private status badge — identical purple pill for both (no lock emoji) */
function recruitBadge(status) {
  return '<span class="badge privacy-badge">' + escHtml(status === 'Private' ? t('vis_private') : t('vis_public')) + '</span>';
}

/* ---------- Invite codes (temporary club-owner credentials) ---------- */
var VALID_INVITE_CODES = ['PVPHS2026', 'WEST2026', 'DEMO2026', 'REDONDO2026', 'MIRACOSTA2026'];
function isValidInvite(code) { return VALID_INVITE_CODES.indexOf((code || '').trim().toUpperCase()) !== -1; }

/* ---------- Seed directory ---------- */
var SEED_CLUBS = [
  { id: 'c-robotics', name: 'Robotics & AI Society', category: 'STEM & Tech', focus: ['STEM', 'Academic Competition'],
    school: 'Palos Verdes Peninsula High School', district: 'Palos Verdes Peninsula Unified School District', zip: '90274',
    recruitment: 'Application Required', tags: ['robotics', 'coding', 'competition'],
    desc: 'Design, build, and program competition robots. Weekly builds, alumni-engineer mentorship, and a spring regional tournament.',
    meeting: 'Wednesdays @ 3:30 PM · Engineering Lab (Rm 214)', memberCount: 42, email: 'robotics@pvphs.edu',
    leaders: [{ name: 'Priya Nair', role: 'President', email: 'priya.n@pvphs.edu' }, { name: 'Marcus Bell', role: 'Vice President', email: 'marcus.b@pvphs.edu' }] },
  { id: 'c-debate', name: 'Debate & Model UN', category: 'Humanities & Debate', focus: ['Academic Competition', 'Social Impact'],
    school: 'Palos Verdes Peninsula High School', district: 'Palos Verdes Peninsula Unified School District', zip: '90274',
    recruitment: 'Application Required', tags: ['debate', 'public speaking', 'model un'],
    desc: 'Sharpen argumentation and research through weekly practice rounds and travel to regional tournaments.',
    meeting: 'Mondays & Thursdays @ 3:15 PM · Rm 108', memberCount: 28, email: 'debate@pvphs.edu',
    leaders: [{ name: 'Sofia Reyes', role: 'President', email: 'sofia.r@pvphs.edu' }] },
  { id: 'c-green', name: 'Green Earth Club', category: 'Community Service', focus: ['Community Service', 'Social Impact'],
    school: 'West High School', district: 'Torrance Unified School District', zip: '90503',
    recruitment: 'Open to All', tags: ['environment', 'volunteering', 'sustainability'],
    desc: 'Campus clean-ups, a native-plant garden, and community recycling drives. Everyone welcome, no experience needed.',
    meeting: 'Tuesdays @ 3:30 PM · Greenhouse', memberCount: 51, email: 'green@westhigh.edu',
    leaders: [{ name: 'Noah Ibrahim', role: 'President', email: 'noah.i@westhigh.edu' }] },
  { id: 'c-art', name: 'Visual Arts Collective', category: 'Arts, Media & Design', focus: ['Arts'],
    school: 'West High School', district: 'Torrance Unified School District', zip: '90503',
    recruitment: 'Open to All', tags: ['painting', 'design', 'photography'],
    desc: 'A studio community for painters, illustrators, and photographers. Monthly gallery shows and a shared supply library.',
    meeting: 'Fridays @ 3:00 PM · Art Studio', memberCount: 35, email: 'arts@westhigh.edu',
    leaders: [{ name: 'Dylan Cho', role: 'President', email: 'dylan.c@westhigh.edu' }, { name: 'Ava Klein', role: 'Secretary', email: 'ava.k@westhigh.edu' }] },
  { id: 'c-biz', name: 'Young Entrepreneurs', category: 'Business & Entrepreneurship', focus: ['Academic Competition', 'Social Impact'],
    school: 'Redondo Union High School', district: 'Redondo Beach Unified School District', zip: '90277',
    recruitment: 'Open to All', tags: ['business', 'startups', 'pitching'],
    desc: 'Turn ideas into real projects — pitch nights, mentor sessions, and a spring startup showcase.',
    meeting: 'Fridays @ 3:00 PM · Rm 301', memberCount: 24, email: 'ye@redondo.edu',
    leaders: [{ name: 'Daniel Ruiz', role: 'President', email: 'daniel.r@redondo.edu' }] },
  { id: 'c-med', name: 'Future Health Professionals', category: 'Health & Medicine', focus: ['STEM', 'Community Service'],
    school: 'Redondo Union High School', district: 'Redondo Beach Unified School District', zip: '90277',
    recruitment: 'Application Required', tags: ['medicine', 'biology', 'volunteering'],
    desc: 'Guest clinicians, CPR-certification workshops, and hospital volunteering for aspiring health professionals.',
    meeting: 'Wednesdays @ 3:00 PM · Bio Lab', memberCount: 33, email: 'fhp@redondo.edu',
    leaders: [{ name: 'Grace Okafor', role: 'President', email: 'grace.o@redondo.edu' }] },
  { id: 'c-code', name: 'Girls Who Code', category: 'STEM & Tech', focus: ['STEM', 'Social Impact'],
    school: 'Mira Costa High School', district: 'Manhattan Beach Unified School District', zip: '90266',
    recruitment: 'Open to All', tags: ['coding', 'web', 'community'],
    desc: 'A beginner-friendly space to learn web and app development through hands-on projects and peer mentorship.',
    meeting: 'Thursdays @ 3:30 PM · Computer Lab B', memberCount: 40, email: 'gwc@miracosta.edu',
    leaders: [{ name: 'Hannah Lee', role: 'President', email: 'hannah.l@miracosta.edu' }] },
  { id: 'c-track', name: 'Running & Fitness Club', category: 'Athletics & Recreation', focus: ['Athletics', 'Community Service'],
    school: 'Mira Costa High School', district: 'Manhattan Beach Unified School District', zip: '90266',
    recruitment: 'Open to All', tags: ['running', 'fitness', 'wellness'],
    desc: 'Group runs, beach workouts, and charity 5Ks for all fitness levels — no tryouts, just show up.',
    meeting: 'Tuesdays & Fridays @ 3:15 PM · Track', memberCount: 46, email: 'run@miracosta.edu',
    leaders: [{ name: 'Leo Park', role: 'President', email: 'leo.p@miracosta.edu' }] }
];

var CLUBS = [];

/* ---------- Init ---------- */
function initDirectory() {
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(LS.clubs)) || []; } catch (e) {}
  CLUBS = SEED_CLUBS.map(cloneClub).concat(stored.map(cloneClub));
  CLUBS.forEach(function (c, i) { normalizeClub(c, i); });

  buildFocusChips();
  buildCreateCategoryOptions();
  buildSchoolFilter();
  renderStats();
  if (typeof renderSiteReviews === 'function') renderSiteReviews();
  renderTopClubs();
  seedCreateLinks(['']);
  if ($('ccSchool') && typeof schoolOptionsHTML === 'function') $('ccSchool').innerHTML = schoolOptionsHTML('');
  if ($('ccDistrict') && typeof districtOptionsHTML === 'function') $('ccDistrict').innerHTML = districtOptionsHTML('');
  applyFilters();
  // Deep link: ?club=A8K9X2 opens that club directly
  var dl = location.search.match(/[?&]club=([A-Za-z0-9]+)/);
  if (dl) { var dc = getClubByClubId(dl[1]); if (dc) setTimeout(function () { openClub(dc.id); }, 60); }
}
function cloneClub(c) { return JSON.parse(JSON.stringify(c)); }
function normalizeClub(c, i) {
  c.banner = c.banner || '';
  c.gallery = c.gallery || [];
  c.focus = c.focus || [];
  // socials is a flexible list of URLs; migrate any legacy {platform:url} object to an array
  if (!Array.isArray(c.socials)) {
    var arr = []; var o = c.socials || {};
    Object.keys(o).forEach(function (k) { if (o[k]) arr.push(o[k]); });
    c.socials = arr;
  }
  c.chatAccess = c.chatAccess || 'all';                    // 'all' | 'officers'
  // Public / Private status (migrated from the old recruitment wording)
  if (c.recruitment === 'Application Required') c.recruitment = 'Private';
  else if (c.recruitment !== 'Private') c.recruitment = 'Public';
  c.banned_members = c.banned_members || [];               // member IDs / emails permanently blocked
  if (!c.clubId) c.clubId = deriveClubId(c.id);            // stable 6-char public Club ID
  if (c.created == null) c.created = 1000 + i;              // stable seed order (no Date in seeds)
  if (!c.roster) {                                          // roster = everyone in the club, with roles
    c.roster = (c.leaders || []).map(function (l) { return { name: l.name, role: l.role, memberId: null }; });
  }
}
function getClub(id) { return CLUBS.find(function (c) { return c.id === id; }) || null; }
function getClubByClubId(cid) { cid = (cid || '').toUpperCase(); return CLUBS.find(function (c) { return c.clubId === cid; }) || null; }
/* Deterministic 6-char alpha-numeric ID from a club's internal id, so seed IDs stay stable across reloads. */
function deriveClubId(seed) {
  var chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789', h = 5381;
  for (var i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  var id = ''; for (var j = 0; j < 6; j++) { id += chars.charAt(h % chars.length); h = Math.floor(h / chars.length) + (j + 1) * 7 + seed.length; }
  return id;
}
function saveUserClubs() {
  var seedIds = SEED_CLUBS.map(function (c) { return c.id; });
  var userClubs = CLUBS.filter(function (c) { return seedIds.indexOf(c.id) === -1; });
  localStorage.setItem(LS.clubs, JSON.stringify(userClubs));
}

/* ---------- Main-page stats ---------- */
function renderStats() {
  var row = $('statsRow'); if (!row) return;
  var students = CLUBS.reduce(function (s, c) { return s + (c.memberCount || 0); }, 0);
  var schools = new Set(CLUBS.map(function (c) { return c.school; })).size;
  row.innerHTML = stat(students.toLocaleString() + '+', 'Students connected') +
    stat(CLUBS.length + '+', 'Active clubs') + stat(schools + '+', 'Local schools');
}
function stat(n, label) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + escHtml(label) + '</div></div>'; }

/* ---------- Top Clubs spotlight (most members) ---------- */
function renderTopClubs() {
  var row = $('topClubs'); if (!row) return;
  // Use the SAME card component as the directory so banner height, padding, and text sizing match.
  var top = CLUBS.slice().sort(function (a, b) { return (b.memberCount || 0) - (a.memberCount || 0); }).slice(0, 3);
  row.innerHTML = top.map(renderCard).join('');
}

/* ---------- Filter UI builders ---------- */
var activeFocus = '';
function buildFocusChips() {
  var row = $('focusRow'); if (!row) return;
  row.innerHTML = FOCUS_FILTERS.map(function (f) {
    return '<button class="cat-pill" data-focus="' + escHtml(f) + '" onclick="setFocus(\'' + escHtml(f).replace(/'/g, "\\'") + '\')">' + escHtml(f) + '</button>';
  }).join('');
}
/* Clicking an active chip again clears the filter */
function setFocus(f) {
  activeFocus = (activeFocus === f) ? '' : f;
  document.querySelectorAll('#focusRow .cat-pill').forEach(function (p) { p.classList.toggle('active', p.dataset.focus === activeFocus); });
  applyFilters();
}
function buildSchoolFilter() {
  var sel = $('schoolFilter'); if (!sel) return;
  var schools = Array.from(new Set(CLUBS.map(function (c) { return c.school; }).filter(Boolean))).sort();
  sel.innerHTML = '<option value="">All schools</option>' +
    schools.map(function (s) { return '<option>' + escHtml(s) + '</option>'; }).join('');
}
function buildCreateCategoryOptions() {
  var sel = $('ccCategory'); if (!sel) return;
  sel.innerHTML = '<option value="">— Select —</option>' +
    CATEGORIES.map(function (c) { return '<option>' + escHtml(c.name) + '</option>'; }).join('') +
    '<option value="Other">Other (type your own)</option>';
}

/* District-based recommendation weight: same district > same zip > nearby zip (first 3 digits). */
function recoScore(c) {
  if (!currentUser) return 0;
  var s = 0;
  if (currentUser.district && c.district && c.district.toLowerCase() === currentUser.district.toLowerCase()) s += 3;
  if (currentUser.zip && c.zip) {
    if (c.zip === currentUser.zip) s += 2;
    else if (currentUser.zip.slice(0, 3) === c.zip.slice(0, 3)) s += 1;
  }
  return s;
}
/* ---------- Filtering + zip/school/district search + sorting ---------- */
function applyFilters() {
  var q = ($('searchInput') && $('searchInput').value || '').trim().toLowerCase();
  var school = ($('schoolFilter') && $('schoolFilter').value) || '';
  var sort = ($('sortSelect') && $('sortSelect').value) || 'az';

  var list = CLUBS.filter(function (c) {
    if (typeof isBanned === 'function' && isBanned(c)) return false;   // banned users never see the club
    if (activeFocus && (c.focus || []).indexOf(activeFocus) === -1) return false;
    if (school && c.school !== school) return false;
    if (sort === 'public' && c.recruitment !== 'Public') return false;   // Public/Private are filters
    if (sort === 'private' && c.recruitment !== 'Private') return false;
    if (q) {
      var hay = [c.name, c.clubId, c.category, c.school, c.district, c.zip, (c.tags || []).join(' '), (c.focus || []).join(' ')]
        .join(' ').toLowerCase();
      if (hay.indexOf(q.replace(/^#/, '')) === -1) return false;
    }
    return true;
  });
  var mine = function (c) { return typeof isClubMember === 'function' && isClubMember(c) ? 1 : 0; };
  list.sort(function (a, b) {
    if (sort === 'members') return (b.memberCount || 0) - (a.memberCount || 0);
    if (sort === 'least') return (a.memberCount || 0) - (b.memberCount || 0);
    if (sort === 'latest') return (b.created || 0) - (a.created || 0);
    if (sort === 'oldest') return (a.created || 0) - (b.created || 0);
    if (sort === 'za') return b.name.localeCompare(a.name);
    if (sort === 'joined') { var jd = mine(b) - mine(a); if (jd !== 0) return jd; }       // enrolled first
    if (sort === 'notjoined') { var nd = mine(a) - mine(b); if (nd !== 0) return nd; }     // unjoined first
    var byName = a.name.localeCompare(b.name);
    // Default (A→Z) additionally floats the viewer's district/zip clubs to the top (recommendations)
    if (sort === 'az' && currentUser && !q && !activeFocus) {
      var ra = recoScore(a), rb = recoScore(b);
      if (ra !== rb) return rb - ra;
    }
    return byName;
  });

  var meta = $('resultMeta');
  if (meta) meta.textContent = list.length + ' club' + (list.length === 1 ? '' : 's') +
    (q ? ' matching “' + q + '”' : '') + (activeFocus ? ' · ' + activeFocus : '');
  renderDirectory(list);
}

function renderDirectory(list) {
  var grid = $('clubGrid'); if (!grid) return;
  grid.innerHTML = list.length ? list.map(renderCard).join('')
    : '<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div><p>No clubs match your search yet.</p>' +
      '<p class="form-note">Try a different zip code, school, or focus area.</p></div>';
}

/* ---------- Reusable Club Card (no corner star, no rating chip) ---------- */
function renderCard(club) {
  var saved = isFavorite(club.id);
  // Save is available on every card regardless of join/ownership (syncs with the banner star).
  var foot = '<button class="fav-btn ' + (saved ? 'on' : '') + '" onclick="toggleFavorite(\'' + club.id + '\')">' +
        starSvg(saved) + (saved ? t('card_saved') : t('save_club')) + '</button>' +
      '<button class="btn primary" onclick="openClub(\'' + club.id + '\')">' + t('card_view') + '</button>';
  return (
    '<article class="card">' +
      '<div class="card-cover" style="' + coverStyle(club) + '" onclick="openClub(\'' + club.id + '\')"></div>' +
      '<div class="card-body">' +
        '<div class="card-title" onclick="openClub(\'' + club.id + '\')"><h3>' + escHtml(club.name) + '</h3>' +
          (club.clubId ? '<span class="club-id-chip">#' + escHtml(club.clubId) + '</span>' : '') +
          (typeof isClubMember === 'function' && isClubMember(club) ? '<span class="joined-chip">✓ ' + t('joined_label') + '</span>' : '') + '</div>' +
        '<div class="card-meta">' + escHtml(club.school) + (club.zip ? ' · ' + escHtml(club.zip) : '') + '</div>' +
        '<p class="card-desc">' + escHtml(club.desc) + '</p>' +
        '<div class="chips">' + recruitBadge(club.recruitment) + renderBadge((club.memberCount || 0) + ' members', 'gray') + '</div>' +
        '<div class="card-foot">' + foot + '</div>' +
      '</div>' +
    '</article>'
  );
}
function renderBadge(text, variant) { return '<span class="badge ' + (variant || '') + '">' + escHtml(text) + '</span>'; }

/* ---------- Keep saved/review state in sync across the UI ---------- */
function refreshFavUI() {
  applyFilters(); renderTopClubs();
  if (typeof renderSaved === 'function' && !$('view-saved').classList.contains('hidden')) renderSaved();
  if (typeof refreshClubModalState === 'function') refreshClubModalState();
  if (typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
}

/* ============================================================
   START A CLUB — media, district validation, invite code
   ============================================================ */
var wizardBanner = '', wizardGallery = [];
function onCreateCategoryChange() {
  $('ccOtherWrap').classList.toggle('hidden', $('ccCategory').value !== 'Other');
  validateCreate();
}
function createCategoryValue() {
  var v = $('ccCategory').value;
  return v === 'Other' ? $('ccOther').value.trim() : v;
}
function onBannerUpload(e) {
  var f = e.target.files[0]; if (!f) return;
  var r = new FileReader(); r.onload = function (ev) { wizardBanner = ev.target.result; paintBannerPreview(); }; r.readAsDataURL(f);
}
function paintBannerPreview() {
  var el = $('ccBannerPreview');
  el.innerHTML = wizardBanner
    ? '<img src="' + wizardBanner + '" alt="banner preview"><button class="mini-x" title="Remove banner" onclick="clearBanner()">✕</button>'
    : 'No banner — a clean gradient block will be used.';
  el.classList.toggle('has-img', !!wizardBanner);
}
function clearBanner() { wizardBanner = ''; paintBannerPreview(); }
function onGalleryUpload(e) {
  Array.prototype.forEach.call(e.target.files, function (f) {
    var r = new FileReader(); r.onload = function (ev) { wizardGallery.push(ev.target.result); paintGalleryPreview(); }; r.readAsDataURL(f);
  });
  e.target.value = '';
}
function paintGalleryPreview() {
  $('ccGalleryPreview').innerHTML = wizardGallery.map(function (src, i) {
    var media = /^data:video|\.(mp4|webm|mov)$/i.test(src) ? '<video src="' + src + '" muted></video>' : '<img src="' + src + '" alt="">';
    return '<div class="thumb">' + media + '<button class="mini-x" onclick="removeGalleryItem(' + i + ')">✕</button></div>';
  }).join('');
}
function removeGalleryItem(i) { wizardGallery.splice(i, 1); paintGalleryPreview(); }

function validateCreate() {
  var invite = $('ccInvite').value.trim(), msg = $('ccInviteMsg');
  if (invite) {
    var ok = isValidInvite(invite);
    msg.className = 'form-note ' + (ok ? 'ok' : 'bad');
    msg.innerHTML = ok ? '✓ Verified — you can author this listing.' : '✗ That invite code isn’t recognized.';
  } else {
    msg.className = 'form-note';
    msg.innerHTML = 'Enter your school-issued invite code to verify you can author this listing. <em>Demo codes: PVPHS2026, WEST2026, DEMO2026.</em>';
  }
  var ready = $('ccName').value.trim() && createCategoryValue() && $('ccSchool').value.trim() &&
    $('ccDistrict').value.trim() && $('ccZip').value.trim() && $('ccEmail').value.trim() && isValidInvite(invite);
  $('ccPublish').disabled = !ready;
}
/* When a school is picked, auto-fill its district (unless "Other"). */
function onSchoolPick(schoolId, districtId) {
  var v = $(schoolId).value;
  if (v && v !== 'Other' && typeof districtForSchool === 'function') {
    var d = districtForSchool(v); if (d) $(districtId).value = d;
  }
}
function publishClub() {
  if (!currentUser) { pendingAuthAction = publishClub; return openAuth('login'); }
  var name = $('ccName').value.trim(), cat = createCategoryValue(),
      school = $('ccSchool').value.trim(), district = $('ccDistrict').value.trim();
  if (!isValidInvite($('ccInvite').value)) return toast('Enter a valid club leader invite code to publish.');
  if (!name || !cat || !school || !district) return toast('Please complete all required fields, including school district.');
  if (!$('ccZip').value.trim() || !$('ccEmail').value.trim()) return toast('Zip code and leader contact email are required.');

  var tags = $('ccTags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  var club = {
    id: 'u-' + Date.now().toString(36), clubId: genClubId(), created: Date.now(),
    name: name, category: cat, focus: [],
    school: school, district: district, zip: $('ccZip').value.trim(),
    recruitment: $('ccRecruit').value,
    desc: $('ccDesc').value.trim() || 'A new club on Student Club Hub.',
    meeting: $('ccMeeting').value.trim() || 'Schedule TBD',
    email: $('ccEmail').value.trim() || currentUser.email,
    tags: tags, memberCount: 1, banner: wizardBanner, gallery: wizardGallery.slice(),
    socials: collectCreateLinks(), chatAccess: 'all',
    leaders: [{ name: currentUser.name, role: 'President', email: $('ccEmail').value.trim() || currentUser.email }],
    roster: [{ name: currentUser.name, role: 'President', memberId: currentUser.memberId }],
    verifiedOwner: currentUser.memberId, inviteCode: $('ccInvite').value.trim().toUpperCase()
  };
  CLUBS.push(club);
  saveUserClubs();
  if (currentUser.joined.indexOf(club.id) === -1) { currentUser.joined.push(club.id); persistUser(); }
  if (editingDraftId) { deleteDraft(editingDraftId, true); editingDraftId = null; }

  buildSchoolFilter(); renderStats(); renderTopClubs();
  resetCreateForm();
  showView('browse'); applyFilters();
  openWelcome(club);                                  // Club-ID welcome / onboarding modal
}

/* ---------- Post-publish welcome modal (Club ID + direct link) ---------- */
var welcomeClub = null;
function clubDirectLink(club) { return location.origin + location.pathname + '?club=' + club.clubId; }
function openWelcome(club) {
  welcomeClub = club;
  $('welcomeTitle').textContent = t('welcome_h');
  $('welcomeMsg').textContent = t('welcome_p1');
  $('welcomeClubId').textContent = '#' + club.clubId;
  $('welcomeShare').textContent = t('welcome_p2');
  $('welcomeCopyBtn').textContent = t('copy_link');
  $('welcomeContinueBtn').textContent = t('continue_mgmt');
  openOverlay('welcomeOverlay');
}
function closeWelcome() { closeOverlay('welcomeOverlay'); }
function copyClubLink() {
  if (!welcomeClub) return;
  var link = clubDirectLink(welcomeClub);
  try {
    if (navigator.clipboard) navigator.clipboard.writeText(link);
    else { var ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
    toast(t('id_copied') || 'Direct link copied!');
  } catch (e) { toast(link); }
}
function continueFromWelcome() { var c = welcomeClub; closeWelcome(); if (c) openClub(c.id); }

/* ---------- Create-form social links ---------- */
function addCreateLinkRow(url) { var w = $('ccLinks'); if (w) w.insertAdjacentHTML('beforeend', linkInputRow(url || '')); }
function seedCreateLinks(list) {
  var w = $('ccLinks'); if (!w) return;
  var arr = (list && list.length) ? list : [''];
  w.innerHTML = arr.map(function (u) { return linkInputRow(u); }).join('');
}
function collectCreateLinks() {
  return Array.prototype.map.call(document.querySelectorAll('#ccLinks .mg-link'), function (el) { return el.value.trim(); }).filter(Boolean);
}
function resetCreateForm() {
  ['ccName','ccDesc','ccMeeting','ccEmail','ccTags','ccSchool','ccDistrict','ccZip','ccOther','ccInvite'].forEach(function (id) { $(id).value = ''; });
  $('ccCategory').value = ''; $('ccOtherWrap').classList.add('hidden'); $('ccPublish').disabled = true;
  wizardBanner = ''; wizardGallery = []; paintBannerPreview(); paintGalleryPreview();
  seedCreateLinks(['']); editingDraftId = null; validateCreate();
}

/* ============================================================
   DRAFTS — save an in-progress club without publishing
   ============================================================ */
var editingDraftId = null;
function loadDrafts() {
  if (!currentUser) return [];
  try { return (JSON.parse(localStorage.getItem(LS.drafts)) || {})[currentUser.email.toLowerCase()] || []; } catch (e) { return []; }
}
function saveDrafts(list) {
  if (!currentUser) return;
  var all = {}; try { all = JSON.parse(localStorage.getItem(LS.drafts)) || {}; } catch (e) {}
  all[currentUser.email.toLowerCase()] = list;
  localStorage.setItem(LS.drafts, JSON.stringify(all));
}
function saveDraft() {
  if (!currentUser) { pendingAuthAction = saveDraft; return openAuth('login'); }
  var draft = {
    id: editingDraftId || 'd-' + Date.now().toString(36),
    name: $('ccName').value.trim(), category: $('ccCategory').value, other: $('ccOther').value.trim(),
    recruitment: $('ccRecruit').value, school: $('ccSchool').value.trim(), district: $('ccDistrict').value.trim(),
    zip: $('ccZip').value.trim(), email: $('ccEmail').value.trim(), desc: $('ccDesc').value.trim(),
    meeting: $('ccMeeting').value.trim(), tags: $('ccTags').value.trim(), invite: $('ccInvite').value.trim(),
    banner: wizardBanner, gallery: wizardGallery.slice(), links: collectCreateLinks(), saved: Date.now()
  };
  var list = loadDrafts();
  var i = list.findIndex(function (d) { return d.id === draft.id; });
  if (i > -1) list[i] = draft; else list.push(draft);
  saveDrafts(list);
  resetCreateForm();
  toast('Draft saved — find it under My Clubs → Drafts.');
  showView('myclubs'); myClubsTab('drafts');
}
function resumeDraft(id) {
  var d = loadDrafts().find(function (x) { return x.id === id; }); if (!d) return;
  editingDraftId = d.id;
  showView('create');
  $('ccName').value = d.name || ''; $('ccCategory').value = d.category || ''; $('ccOther').value = d.other || '';
  $('ccOtherWrap').classList.toggle('hidden', d.category !== 'Other');
  $('ccRecruit').value = (d.recruitment === 'Private' || d.recruitment === 'Application Required') ? 'Private' : 'Public';
  $('ccSchool').value = d.school || ''; $('ccDistrict').value = d.district || ''; $('ccZip').value = d.zip || '';
  $('ccEmail').value = d.email || ''; $('ccDesc').value = d.desc || ''; $('ccMeeting').value = d.meeting || '';
  $('ccTags').value = d.tags || ''; $('ccInvite').value = d.invite || '';
  wizardBanner = d.banner || ''; wizardGallery = (d.gallery || []).slice();
  paintBannerPreview(); paintGalleryPreview(); seedCreateLinks(d.links || ['']); validateCreate();
}
function deleteDraft(id, silent) {
  var list = loadDrafts().filter(function (d) { return d.id !== id; });
  saveDrafts(list);
  if (!silent) { toast('Draft deleted.'); if (typeof renderMyClubs === 'function') renderMyClubs(); }
}
