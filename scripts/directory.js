/* ============================================================
   directory.js — club data, card rendering, category filtering,
   search, and club creation/settings.
   ============================================================ */

/* ---------- Categories (name → cover gradient + glyph) ---------- */
var CATEGORIES = [
  { name: 'STEM & Tech',              grad: 'linear-gradient(135deg,#6366f1,#4f46e5)', icon: '🔬' },
  { name: 'Business & Entrepreneurship', grad: 'linear-gradient(135deg,#f59e0b,#d97706)', icon: '📈' },
  { name: 'Arts, Media & Design',     grad: 'linear-gradient(135deg,#ec4899,#db2777)', icon: '🎨' },
  { name: 'Culture & Language',       grad: 'linear-gradient(135deg,#14b8a6,#0d9488)', icon: '🌐' },
  { name: 'Community Service',        grad: 'linear-gradient(135deg,#10b981,#059669)', icon: '🤝' },
  { name: 'Humanities & Debate',      grad: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', icon: '🎙️' },
  { name: 'Health & Medicine',        grad: 'linear-gradient(135deg,#ef4444,#dc2626)', icon: '⚕️' },
  { name: 'Sports & Recreation',      grad: 'linear-gradient(135deg,#0ea5e9,#0284c7)', icon: '⚽' },
  { name: 'Hobbies & Niche Interests',grad: 'linear-gradient(135deg,#64748b,#475569)', icon: '🎲' }
];
function styleForCategory(cat) {
  return CATEGORIES.find(function (c) { return c.name === cat; }) ||
    { grad: 'linear-gradient(135deg,#6366f1,#4f46e5)', icon: '◎' };
}

/* ---------- Seed directory (no monetary fields anywhere) ---------- */
var SEED_CLUBS = [
  { id: 'c-robotics', name: 'Robotics & AI Society', category: 'STEM & Tech', school: 'Central High School',
    tagline: 'Build bots. Break limits.', tags: ['robotics','coding','competition'],
    desc: 'Design, build, and program competition robots. Weekly builds, mentorship from alumni engineers, and a spring regional tournament.',
    meeting: 'Wednesdays @ 3:30 PM · Engineering Lab (Rm 214)', memberCount: 42, email: 'robotics@centralhigh.edu',
    gallery: [], leaders: [{ name: 'Priya Nair', role: 'President', email: 'priya.n@centralhigh.edu' }, { name: 'Marcus Bell', role: 'Vice President', email: 'marcus.b@centralhigh.edu' }] },
  { id: 'c-debate', name: 'Debate & Model UN', category: 'Humanities & Debate', school: 'Central High School',
    tagline: 'Argue well. Think sharper.', tags: ['debate','public speaking','model un'],
    desc: 'Sharpen your argumentation and research through weekly practice rounds and travel to regional tournaments.',
    meeting: 'Mondays & Thursdays @ 3:15 PM · Rm 108', memberCount: 28, email: 'debate@centralhigh.edu',
    gallery: [], leaders: [{ name: 'Sofia Reyes', role: 'President', email: 'sofia.r@centralhigh.edu' }] },
  { id: 'c-art', name: 'Visual Arts Collective', category: 'Arts, Media & Design', school: 'Riverside Academy',
    tagline: 'Make something today.', tags: ['painting','design','photography'],
    desc: 'A studio community for painters, illustrators, and photographers. Monthly gallery shows and a shared supply library.',
    meeting: 'Fridays @ 3:00 PM · Art Studio', memberCount: 35, email: 'arts@riverside.edu',
    gallery: [], leaders: [{ name: 'Dylan Cho', role: 'President', email: 'dylan.c@riverside.edu' }, { name: 'Ava Klein', role: 'Treasurer', email: 'ava.k@riverside.edu' }] },
  { id: 'c-green', name: 'Green Earth Club', category: 'Community Service', school: 'Central High School',
    tagline: 'Local action, real impact.', tags: ['environment','volunteering','sustainability'],
    desc: 'Campus clean-ups, a native-plant garden, and community recycling drives. Everyone welcome, no experience needed.',
    meeting: 'Tuesdays @ 3:30 PM · Greenhouse', memberCount: 51, email: 'green@centralhigh.edu',
    gallery: [], leaders: [{ name: 'Noah Ibrahim', role: 'President', email: 'noah.i@centralhigh.edu' }] },
  { id: 'c-biz', name: 'Young Entrepreneurs', category: 'Business & Entrepreneurship', school: 'Riverside Academy',
    tagline: 'Ideas into ventures.', tags: ['business','startups','pitching'],
    desc: 'Turn ideas into real projects — pitch nights, mentor sessions, and a spring startup showcase.',
    meeting: 'Fridays @ 3:00 PM · Rm 301', memberCount: 24, email: 'ye@riverside.edu',
    gallery: [], leaders: [{ name: 'Daniel Ruiz', role: 'President', email: 'daniel.r@riverside.edu' }] },
  { id: 'c-med', name: 'Future Health Professionals', category: 'Health & Medicine', school: 'Northgate High',
    tagline: 'Explore medicine early.', tags: ['medicine','biology','volunteering'],
    desc: 'Guest clinicians, CPR certification workshops, and hospital volunteering opportunities for aspiring health pros.',
    meeting: 'Wednesdays @ 3:00 PM · Bio Lab', memberCount: 33, email: 'fhp@northgate.edu',
    gallery: [], leaders: [{ name: 'Grace Okafor', role: 'President', email: 'grace.o@northgate.edu' }] },
  { id: 'c-code', name: 'Girls Who Code', category: 'STEM & Tech', school: 'Northgate High',
    tagline: 'Code, create, belong.', tags: ['coding','web','community'],
    desc: 'A beginner-friendly space to learn web and app development through hands-on projects and peer mentorship.',
    meeting: 'Thursdays @ 3:30 PM · Computer Lab B', memberCount: 40, email: 'gwc@northgate.edu',
    gallery: [], leaders: [{ name: 'Hannah Lee', role: 'President', email: 'hannah.l@northgate.edu' }] },
  { id: 'c-chess', name: 'Chess Club', category: 'Hobbies & Niche Interests', school: 'Riverside Academy',
    tagline: 'Every move matters.', tags: ['chess','strategy','tournaments'],
    desc: 'Casual play and ladder tournaments for all levels. Boards and clocks provided — just show up and play.',
    meeting: 'Mondays @ 3:15 PM · Library', memberCount: 19, email: 'chess@riverside.edu',
    gallery: [], leaders: [{ name: 'Leo Park', role: 'President', email: 'leo.p@riverside.edu' }] }
];

var CLUBS = [];

/* ---------- Init ---------- */
function initDirectory() {
  var stored = [];
  try { stored = JSON.parse(localStorage.getItem(LS.clubs)) || []; } catch (e) {}
  CLUBS = SEED_CLUBS.map(cloneClub).concat(stored.map(cloneClub));

  buildCategoryPills();
  buildCreateCategoryOptions();
  buildSchoolFilter();
  applyFilters();
}
function cloneClub(c) { return JSON.parse(JSON.stringify(c)); }
function getClub(id) { return CLUBS.find(function (c) { return c.id === id; }) || null; }
function saveUserClubs() {
  var seedIds = SEED_CLUBS.map(function (c) { return c.id; });
  var userClubs = CLUBS.filter(function (c) { return seedIds.indexOf(c.id) === -1; });
  localStorage.setItem(LS.clubs, JSON.stringify(userClubs));
}

/* ---------- Filter UI builders ---------- */
var activeCategory = '';
function buildCategoryPills() {
  var row = $('catRow'); if (!row) return;
  var pills = '<button class="cat-pill active" data-cat="" onclick="setCategory(\'\')">All</button>';
  CATEGORIES.forEach(function (c) {
    pills += '<button class="cat-pill" data-cat="' + escHtml(c.name) + '" onclick="setCategory(\'' + escHtml(c.name).replace(/'/g, "\\'") + '\')">' + c.icon + ' ' + escHtml(c.name) + '</button>';
  });
  row.innerHTML = pills;
}
function setCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(function (p) { p.classList.toggle('active', p.dataset.cat === cat); });
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

/* ---------- Filtering + search ---------- */
function applyFilters() {
  var q = ($('searchInput') && $('searchInput').value || '').trim().toLowerCase();
  var school = ($('schoolFilter') && $('schoolFilter').value) || '';
  var sort = ($('sortSelect') && $('sortSelect').value) || 'name';

  var list = CLUBS.filter(function (c) {
    if (activeCategory && c.category !== activeCategory) return false;
    if (school && c.school !== school) return false;
    if (q) {
      var hay = [c.name, c.category, c.school, c.tagline, (c.tags || []).join(' ')].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });
  list.sort(function (a, b) {
    if (sort === 'members') return (b.memberCount || 0) - (a.memberCount || 0);
    return a.name.localeCompare(b.name);
  });
  renderDirectory(list);
}

function renderDirectory(list) {
  var grid = $('clubGrid'); if (!grid) return;
  if (!list.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div><p>No clubs match your search yet.</p></div>';
    return;
  }
  grid.innerHTML = list.map(renderCard).join('');
}

/* ---------- Reusable Club Card component ---------- */
function renderCard(club) {
  var st = styleForCategory(club.category);
  var fav = isFavorite(club.id);
  return (
    '<article class="card">' +
      '<div class="card-cover" style="background:' + st.grad + '">' + st.icon +
        '<button class="cover-fav ' + (fav ? 'on' : '') + '" title="Favorite" ' +
          'onclick="toggleFavorite(\'' + club.id + '\')">' + (fav ? '★' : '☆') + '</button>' +
      '</div>' +
      '<div class="card-body">' +
        '<div class="card-title" onclick="openClubModal(\'' + club.id + '\')">' +
          '<h3>' + escHtml(club.name) + '</h3>' +
        '</div>' +
        '<div class="card-meta">' + escHtml(club.category) + ' · ' + escHtml(club.school) + '</div>' +
        '<p class="card-desc">' + escHtml(club.tagline || club.desc) + '</p>' +
        '<div class="chips">' + renderBadge((club.memberCount || 0) + ' members', 'gray') + '</div>' +
        '<div class="card-foot">' +
          '<button class="fav-btn ' + (fav ? 'on' : '') + '" onclick="toggleFavorite(\'' + club.id + '\')">' +
            '<span class="star">★</span>' + (fav ? 'Favorited' : 'Favorite') + '</button>' +
          '<button class="btn primary" onclick="openClubModal(\'' + club.id + '\')">View Club</button>' +
        '</div>' +
      '</div>' +
    '</article>'
  );
}

/* ---------- Reusable Badge component ---------- */
function renderBadge(text, variant) {
  return '<span class="badge ' + (variant || '') + '">' + escHtml(text) + '</span>';
}

/* ---------- Keep favorite state in sync across the whole UI ---------- */
function refreshFavUI() {
  applyFilters();
  if (typeof renderSaved === 'function' && !$('view-saved').classList.contains('hidden')) renderSaved();
  if (typeof refreshClubModalState === 'function') refreshClubModalState();
  if (typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
}

/* ============================================================
   CREATE CLUB
   ============================================================ */
function onCreateCategoryChange() {
  var other = $('ccCategory').value === 'Other';
  $('ccOtherWrap').classList.toggle('hidden', !other);
  validateCreate();
}
function createCategoryValue() {
  var v = $('ccCategory').value;
  return v === 'Other' ? $('ccOther').value.trim() : v;
}
function validateCreate() {
  var ok = $('ccName').value.trim() && createCategoryValue() && $('ccSchool').value.trim();
  $('ccPublish').disabled = !ok;
}
function publishClub() {
  if (!currentUser) return requireAuth(publishClub);
  var name = $('ccName').value.trim();
  var cat = createCategoryValue();
  var school = $('ccSchool').value.trim();
  if (!name || !cat || !school) return;

  var tags = $('ccTags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  var club = {
    id: 'u-' + Date.now().toString(36),
    name: name, category: cat, school: school,
    tagline: $('ccTagline').value.trim(),
    desc: $('ccDesc').value.trim() || 'A new club on Student Club Hub.',
    meeting: $('ccMeeting').value.trim() || 'Schedule TBD',
    email: $('ccEmail').value.trim() || currentUser.email,
    tags: tags, memberCount: 1, gallery: [],
    leaders: [{ name: currentUser.name, role: 'President', email: $('ccEmail').value.trim() || currentUser.email }],
    creatorId: currentUser.memberId
  };
  CLUBS.push(club);
  saveUserClubs();
  // Creator auto-joins their own club.
  if (currentUser.joined.indexOf(club.id) === -1) { currentUser.joined.push(club.id); persistUser(); }

  buildSchoolFilter();
  ['ccName','ccTagline','ccDesc','ccMeeting','ccEmail','ccTags','ccSchool','ccOther'].forEach(function (id) { $(id).value = ''; });
  $('ccCategory').value = ''; $('ccOtherWrap').classList.add('hidden'); $('ccPublish').disabled = true;

  showView('home'); applyFilters();
  toast('“' + name + '” is now listed in the directory!');
  setTimeout(function () { openClubModal(club.id); }, 400);
}
