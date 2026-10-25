/* ============================================================
   directory.js - club data, card rendering, zip/school/district
   search, focus filters, top-clubs spotlight, sorting, stats,
   and club creation (media, district validation, invite code).
   ============================================================ */

/* ---------- Categories (creation dropdown + card cover) ---------- */
/* Cohesive cool covers - every category is a distinct shade within the
   Deep-Space-Blue → Cerulean → Frosted-Blue family (no rainbow clash). */
var CATEGORIES = [
  { name: 'STEM & Tech',                 grad: 'linear-gradient(140deg,#0a6f96 0%,#003249 100%)', icon: svgIcon('flask', 22) },
  { name: 'Business & Entrepreneurship', grad: 'linear-gradient(140deg,#0f8ca0 0%,#0a4f66 100%)', icon: svgIcon('growth', 22) },
  { name: 'Arts, Media & Design',        grad: 'linear-gradient(140deg,#4fb3c9 0%,#007ea7 100%)', icon: svgIcon('palette', 22) },
  { name: 'Culture & Language',          grad: 'linear-gradient(140deg,#12a594 0%,#0a5f66 100%)', icon: svgIcon('globe', 22) },
  { name: 'Community Service',           grad: 'linear-gradient(140deg,#2596be 0%,#0a4f66 100%)', icon: svgIcon('heart', 22) },
  { name: 'Humanities & Debate',         grad: 'linear-gradient(140deg,#2a6f97 0%,#013a5c 100%)', icon: svgIcon('mic', 22) },
  { name: 'Health & Medicine',           grad: 'linear-gradient(140deg,#0e9aa7 0%,#036b82 100%)', icon: svgIcon('stethoscope', 22) },
  { name: 'Athletics & Recreation',      grad: 'linear-gradient(140deg,#1ba3d1 0%,#005f7d 100%)', icon: svgIcon('ball', 22) },
  { name: 'Hobbies & Niche Interests',   grad: 'linear-gradient(140deg,#5a8a99 0%,#2a4d5c 100%)', icon: svgIcon('dice', 22) }
];
function styleForCategory(cat) {
  return CATEGORIES.find(function (c) { return c.name === cat; }) ||
    { grad: 'linear-gradient(140deg,#0a6f96 0%,#003249 100%)', icon: '◎' };
}
/* Cover background: uploaded banner if present, otherwise a clean gradient block */
function coverStyle(club) {
  if (club.banner) return 'background:center/cover no-repeat url(\'' + String(club.banner).replace(/['"\\<>\s]/g, '') + '\')';
  return 'background:' + styleForCategory(club.category).grad;
}

/* ---------- Focus quick-filters (no "All" chip - click again to clear) ---------- */
var FOCUS_FILTERS = ['STEM', 'Social Impact', 'Community Service', 'Arts', 'Athletics', 'Academic Competition'];

/* ---------- Recruitment statuses (streamlined) ---------- */
/* Public / Private status badge - identical purple pill for both (no lock emoji) */
function recruitBadge(status) {
  return '<span class="badge privacy-badge">' + escHtml(status === 'Private' ? t('vis_private') : t('vis_public')) + '</span>';
}

/* ---------- Invite codes (temporary club-owner credentials) ---------- */
/* Codes live in a private server table (admins manage them on the Admin page); the browser can
   only ask "is this one valid?" — the list itself is never sent to the site. */
var _inviteCheck = { code: null, ok: false };
function checkInviteCode(code) {
  code = (code || '').trim().toUpperCase();
  if (!code) return Promise.resolve(false);
  if (_inviteCheck.code === code) return Promise.resolve(_inviteCheck.ok);
  return sbRpc('check_invite_code', { p_code: code }).then(function (ok) { _inviteCheck = { code: code, ok: !!ok }; return !!ok; }, function () { return false; });
}
function isValidInvite(code) { return _inviteCheck.code === (code || '').trim().toUpperCase() && _inviteCheck.ok; }

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
    desc: 'Turn ideas into real projects with pitch nights, mentor sessions, and a startup showcase every spring.',
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
    desc: 'Group runs, beach workouts, and charity 5Ks for every fitness level. No tryouts, just show up.',
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
  loadClubs();                // replace the local snapshot with the shared server copy (syncs across accounts)
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
/* Private clubs are unlisted: only their members see them in Browse, Top Clubs, stats, and filters
   (anyone with the direct link can still open one). */
function isListedFor(c) {
  if (!c) return false;
  if (typeof isBanned === 'function' && isBanned(c)) return false;
  if (c.recruitment !== 'Private') return true;
  return typeof isClubMember === 'function' && !!isClubMember(c);
}
function listedClubs() { return CLUBS.filter(isListedFor); }
function getClub(id) { return CLUBS.find(function (c) { return c.id === id; }) || null; }
function getClubByClubId(cid) { cid = (cid || '').toUpperCase(); return CLUBS.find(function (c) { return c.clubId === cid; }) || null; }
/* Deterministic 6-char alpha-numeric ID from a club's internal id, so seed IDs stay stable across reloads. */
function deriveClubId(seed) {
  var chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789', h = 5381;
  for (var i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  var id = ''; for (var j = 0; j < 6; j++) { id += chars.charAt(h % chars.length); h = Math.floor(h / chars.length) + (j + 1) * 7 + seed.length; }
  return id;
}
/* Local cache (best-effort) + a field-level server save. Pass the club that changed; otherwise the
   open club (currentClubId) is used. */
function saveUserClubs(club) {
  var seedIds = SEED_CLUBS.map(function (c) { return c.id; });
  var userClubs = CLUBS.filter(function (c) { return seedIds.indexOf(c.id) === -1; });
  // The local copy is only a cache (it can overflow with big media); the server copy is what counts.
  try { localStorage.setItem(LS.clubs, JSON.stringify(userClubs)); } catch (e) {}
  var c = club || (typeof currentClubId !== 'undefined' && currentClubId ? getClub(currentClubId) : null);
  if (c) sbSaveClub(c);
  return true;
}
/* ---------- Supabase club sync ----------
   _clubBase holds the server copy each club was loaded from. A save sends ONLY the top-level
   fields that differ from it (save_club merges them in on the server), so two officers editing
   different parts of a page at the same time no longer overwrite each other. Rosters and member
   counts come from club_members, so they are never written into the club blob. */
var _clubBase = {};
var CLUB_LOCAL_KEYS = ['roster', 'memberCount'];
function _rememberClubBase(d) { if (d && d.id) _clubBase[d.id] = JSON.parse(JSON.stringify(d)); }
function _clubDiff(club) {
  var base = _clubBase[club.id] || {}, patch = {}, remove = [], n = 0;
  Object.keys(club).forEach(function (k) {
    if (CLUB_LOCAL_KEYS.indexOf(k) > -1 || club[k] === undefined) return;
    if (JSON.stringify(club[k]) !== JSON.stringify(base[k])) { patch[k] = club[k]; n++; }
  });
  Object.keys(base).forEach(function (k) { if (CLUB_LOCAL_KEYS.indexOf(k) === -1 && !(k in club)) { remove.push(k); n++; } });
  return n ? { patch: patch, remove: remove } : null;
}
function _clubSaveError(ex) {
  toast(/too large|413|payload/i.test(ex.message || '') ? 'Couldn’t save — the club’s media is too large. Remove a photo or video and try again.' : 'Couldn’t save: ' + ex.message);
}
function sbSaveClub(club) {
  if (typeof sbRest !== 'function' || !club || !club.id) return Promise.resolve();
  if (!_clubBase[club.id]) {   // brand-new club → create it
    var data = JSON.parse(JSON.stringify(club)); CLUB_LOCAL_KEYS.forEach(function (k) { delete data[k]; });
    return sbRest('clubs', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ id: club.id, data: data, updated_at: new Date().toISOString() }) })
      .then(function (rows) { var d = rows && rows[0] && rows[0].data; _rememberClubBase(d || data); delete club.inviteCode; return d; })
      .catch(function (ex) { _clubSaveError(ex); throw ex; });
  }
  var diff = _clubDiff(club); if (!diff) return Promise.resolve(null);
  return sbRpc('save_club', { p_id: club.id, p_patch: diff.patch, p_remove: diff.remove })
    .then(function (d) {
      _rememberClubBase(d);
      if (d && d.verified !== club.verified) club.verified = d.verified;   // the server owns the seal
      return d;
    }).catch(function (ex) { _clubSaveError(ex); });
}
/* Fetch all clubs from the server (authoritative). */
var _clubsServerLoaded = false;
function loadClubs(cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  sbRest('clubs?select=id,data').then(function (rows) {
    rows = rows || [];
    var byId = {};
    rows.forEach(function (r) { if (r && r.data && r.id) byId[r.id] = r.data; });
    rows.forEach(function (r) { if (r && r.data && r.id) _rememberClubBase(r.data); });
    SEED_CLUBS.forEach(function (s) { if (!byId[s.id]) byId[s.id] = cloneClub(s); });   // display only; the server copy wins
    CLUBS = Object.keys(byId).map(function (k) { return byId[k]; });
    CLUBS.forEach(function (c, i) { normalizeClub(c, i); });
    _clubsServerLoaded = true;
    try { var seedIds = SEED_CLUBS.map(function (s) { return s.id; }); localStorage.setItem(LS.clubs, JSON.stringify(CLUBS.filter(function (c) { return seedIds.indexOf(c.id) === -1; }))); } catch (e) {}
    _loadAllMembers();            // every club's roster + member count from club_members (the source of truth)
    reconcileMyMemberships();     // pull my joined-club list from the server (memberships made on any device)
    buildSchoolFilter(); renderStats(); renderTopClubs();
    if (typeof applyFilters === 'function') applyFilters();
    if (typeof refreshClubModalState === 'function') refreshClubModalState();
    _openClubFromQuery();
    if (typeof cb === 'function') cb();
  }).catch(function () { _openClubFromQuery(); if (typeof cb === 'function') cb(); });
}
/* ?club=A8K9X2 deep links — run after the server list arrives (new clubs aren't in the local snapshot). */
var _deepLinkDone = false;
function _openClubFromQuery() {
  if (_deepLinkDone) return; _deepLinkDone = true;
  var dl = location.search.match(/[?&]club=([A-Za-z0-9]+)/); if (!dl) return;
  var dc = getClubByClubId(dl[1]);
  if (dc) openClub(dc.id); else toast('That club link isn’t valid anymore.');
}
/* ---------- Club members (roster) sync — Step 2 ---------- */
function _memberToRosterEntry(r) { return { name: r.name, role: r.role, memberId: r.member_id, email: r.email }; }
function _applyMembers(club, rows) {
  if (!club) return;
  club.roster = (rows || []).map(_memberToRosterEntry);
  club.memberCount = club.roster.length;
}
/* Fetch a club's members; if the table is empty for it but the blob has a roster,
   migrate that roster into the table once (so existing clubs seed their members). */
function loadClubMembers(clubId, cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  sbRest('club_members?club_id=eq.' + encodeURIComponent(clubId) + '&select=*&order=joined_at.asc').then(function (rows) {
    var club = getClub(clubId);
    if ((!rows || !rows.length) && club && (club.roster || []).length) {
      var seedRows = club.roster.map(function (m, i) {
        return { club_id: clubId, member_id: m.memberId || ('seed-' + clubId + '-' + i), email: (m.email || '').toLowerCase() || null, name: m.name, role: m.role || 'Member' };
      });
      sbRest('club_members?on_conflict=club_id,member_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(seedRows) })
        .then(function (ins) { _applyMembers(club, ins || seedRows); if (typeof cb === 'function') cb(); })
        .catch(function () { if (typeof cb === 'function') cb(); });
      return;
    }
    if (club) _applyMembers(club, rows);
    if (typeof cb === 'function') cb();
  }).catch(function () { if (typeof cb === 'function') cb(); });
}
/* One request for all rosters, so Browse cards, counts, and "am I a member?" never come from a stale club blob. */
function _loadAllMembers() {
  if (typeof sbRest !== 'function') return;
  sbRest('club_members?select=club_id,member_id,name,role,email&order=joined_at.asc').then(function (rows) {
    var by = {}; (rows || []).forEach(function (r) { (by[r.club_id] = by[r.club_id] || []).push(r); });
    CLUBS.forEach(function (c) { if (by[c.id]) _applyMembers(c, by[c.id]); });
    renderStats(); renderTopClubs(); if (typeof applyFilters === 'function') applyFilters();
  }).catch(function () {});
}
/* Roster writes report a refusal (row-level security answers "0 rows changed", not an error). */
function _memberWrite(path, opts, failMsg) {
  if (typeof sbRest !== 'function') return Promise.resolve();
  opts.headers = { Prefer: (opts.headers && opts.headers.Prefer ? opts.headers.Prefer.replace('return=minimal', '') + ',' : '') + 'return=representation' };
  return sbRest(path, opts).then(function (rows) {
    if (Array.isArray(rows) && !rows.length) throw new Error(failMsg);
    return rows;
  }).catch(function (ex) { toast(ex.message || failMsg); });
}
function sbAddMember(clubId, m) {
  return _memberWrite('club_members?on_conflict=club_id,member_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ club_id: clubId, member_id: m.memberId, email: (m.email || '').toLowerCase() || null, name: m.name, role: m.role || 'Member' }) }, 'Couldn’t join this club.');
}
function sbSetMemberRole(clubId, memberId, role) {
  return _memberWrite('club_members?club_id=eq.' + encodeURIComponent(clubId) + '&member_id=eq.' + encodeURIComponent(memberId), { method: 'PATCH', body: JSON.stringify({ role: role }) }, 'Only the President can change roles.');
}
function sbRemoveMember(clubId, memberId) {
  return _memberWrite('club_members?club_id=eq.' + encodeURIComponent(clubId) + '&member_id=eq.' + encodeURIComponent(memberId), { method: 'DELETE' }, 'You don’t have permission to remove that member.');
}
function sbRenameMember(memberId, newName) {
  if (typeof sbRest !== 'function' || !memberId) return Promise.resolve();
  return sbRest('club_members?member_id=eq.' + encodeURIComponent(memberId), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name: newName }) }).catch(function () {});
}
/* Reconcile the signed-in user's joined list from the server (memberships made on any device). */
function reconcileMyMemberships(cb) {
  if (typeof sbRest !== 'function' || !currentUser) { if (typeof cb === 'function') cb(); return; }
  sbRest('club_members?member_id=eq.' + encodeURIComponent(currentUser.memberId) + '&select=club_id,name,role').then(function (rows) {
    rows = rows || [];
    var serverIds = rows.map(function (r) { return r.club_id; });
    // 1) Self-heal my display name across all my memberships if it drifted (fixes stale snapshots like "Tester").
    if (rows.some(function (r) { return r.name !== currentUser.name; }) && typeof sbRenameMember === 'function') {
      sbRenameMember(currentUser.memberId, currentUser.name);
    }
    // 2) The server roster is the truth: if a President removed or banned me, I'm no longer a member
    //    (re-adding local-only joins used to undo removals). Clubs I own always count.
    var ids = serverIds.slice();
    CLUBS.forEach(function (c) {
      if (c.verifiedOwner === currentUser.memberId && ids.indexOf(c.id) === -1) {
        ids.push(c.id);
        if (typeof sbAddMember === 'function') sbAddMember(c.id, { memberId: currentUser.memberId, email: currentUser.email, name: currentUser.name, role: 'President' });
      }
    });
    currentUser.joined = ids; if (typeof persistUser === 'function') persistUser();
    if (typeof applyFilters === 'function') applyFilters();
    if (typeof cb === 'function') cb();
  }).catch(function () { if (typeof cb === 'function') cb(); });
}
/* Refetch just one club from the server and merge it into CLUBS (used when opening a club). */
function refetchClub(id, cb) {
  if (typeof sbRest !== 'function') { if (typeof cb === 'function') cb(); return; }
  sbRest('clubs?id=eq.' + encodeURIComponent(id) + '&select=data').then(function (rows) {
    var d = rows && rows[0] && rows[0].data;
    if (d) { _rememberClubBase(d); normalizeClub(d, 0); var i = CLUBS.findIndex(function (c) { return c.id === id; }); if (i > -1) CLUBS[i] = d; else CLUBS.push(d); }
    if (typeof cb === 'function') cb();
  }).catch(function () { if (typeof cb === 'function') cb(); });
}

/* ============================================================
   Shared media + link validation (used by Create wizard AND Manage tab)
   ============================================================ */
var PLAYABLE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
var IMAGE_MAX_BYTES = 3 * 1024 * 1024;    // 3 MB per image
var VIDEO_MAX_BYTES = 8 * 1024 * 1024;    // 8 MB per clip (localStorage is ~5 MB total, so keep clips short)
function fmtMB(b) { return (b / (1024 * 1024)).toFixed(1) + ' MB'; }
/* Returns true if the file may be added; otherwise toasts why and returns false. */
function validateMediaFile(f) {
  if (!f) return false;
  if (/^video\//i.test(f.type)) {
    if (PLAYABLE_VIDEO_TYPES.indexOf(f.type) === -1) {
      toast('That video format won’t play in browsers. Please use MP4, WebM, or OGG (MOV/AVI aren’t supported).');
      return false;
    }
    if (f.size > VIDEO_MAX_BYTES) { toast('Video is too large (' + fmtMB(f.size) + '). The limit is ' + fmtMB(VIDEO_MAX_BYTES) + '.'); return false; }
    return true;
  }
  if (/^image\//i.test(f.type)) {
    if (f.size > IMAGE_MAX_BYTES) { toast('Image is too large (' + fmtMB(f.size) + '). The limit is ' + fmtMB(IMAGE_MAX_BYTES) + '.'); return false; }
    return true;
  }
  toast('That file type won’t work. Add an image or a video.');
  return false;
}
/* A value counts as a link only if it looks like a real URL/domain (rejects plain words). */
function isValidLink(v) {
  v = (v || '').trim(); if (!v) return false;
  return /^(https?:\/\/)?((([a-z0-9-]+\.)+[a-z]{2,})|localhost)(:\d+)?(\/[^\s]*)?$/i.test(v);
}
/* Toggle the red "invalid link" state on a single input as the user types. */
function validateLinkInput(el) {
  if (!el) return; var v = (el.value || '').trim();
  el.classList.toggle('invalid', !!v && !isValidLink(v));
}

/* ---------- Main-page stats ---------- */
function renderStats() {
  var row = $('statsRow'); if (!row) return;
  var pub = CLUBS.filter(function (c) { return c.recruitment !== 'Private'; });
  var students = pub.reduce(function (s, c) { return s + (c.memberCount || 0); }, 0);
  var schools = new Set(pub.map(function (c) { return c.school; })).size;
  row.innerHTML = stat(students.toLocaleString() + '+', 'Students connected') +
    stat(pub.length + '+', 'Active clubs') + stat(schools + '+', 'Local schools');
}
function stat(n, label) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + escHtml(label) + '</div></div>'; }

/* ---------- Top Clubs spotlight (most members) ---------- */
var _tcIndex = 0, _tcTimer = null, _tcTop = [];
function renderTopClubs() {
  var row = $('topClubs'); if (!row) return;
  _tcTop = CLUBS.filter(function (c) { return c.recruitment !== 'Private' && !(typeof isBanned === 'function' && isBanned(c)); }).sort(function (a, b) { return (b.memberCount || 0) - (a.memberCount || 0); }).slice(0, 3);
  row.className = 'tc-slideshow';
  if (!_tcTop.length) { row.innerHTML = ''; return; }
  var slides = _tcTop.map(function (c, i) {
    return '<div class="tc-slide' + (i === 0 ? ' active' : '') + '" style="' + coverStyle(c) + '">' +
      '<div class="tc-scrim"></div><div class="tc-body">' +
        '<div class="chips">' + recruitBadge(c.recruitment) + renderBadge((c.memberCount || 0) + ' members', 'gray') + '</div>' +
        '<h3>' + escHtml(c.name) + '</h3>' +
        '<div class="tc-meta">' + escHtml(c.category) + ' · ' + escHtml(c.school) + (c.zip ? ' · ' + escHtml(c.zip) : '') + '</div>' +
        '<button class="btn primary" onclick="openClub(\'' + c.id + '\')">' + t('card_view') + '</button>' +
      '</div></div>';
  }).join('');
  var dots = _tcTop.map(function (_, i) { return '<button class="tc-dot' + (i === 0 ? ' active' : '') + '" onclick="tcGo(' + i + ')" aria-label="Slide ' + (i + 1) + '"></button>'; }).join('');
  row.innerHTML = slides +
    (_tcTop.length > 1 ? '<button class="tc-arrow tc-prev" onclick="tcStep(-1)">‹</button><button class="tc-arrow tc-next" onclick="tcStep(1)">›</button>' : '') +
    '<div class="tc-dots">' + dots + '</div>';
  _tcIndex = 0; startTcAuto();
}
function tcPaint() {
  var slides = document.querySelectorAll('#topClubs .tc-slide'), dots = document.querySelectorAll('#topClubs .tc-dot');
  slides.forEach(function (s, i) { s.classList.toggle('active', i === _tcIndex); });
  dots.forEach(function (d, i) { d.classList.toggle('active', i === _tcIndex); });
}
function tcStep(d) { if (!_tcTop.length) return; _tcIndex = (_tcIndex + d + _tcTop.length) % _tcTop.length; tcPaint(); startTcAuto(); }
function tcGo(i) { _tcIndex = i; tcPaint(); startTcAuto(); }
function startTcAuto() {
  if (_tcTimer) clearInterval(_tcTimer);
  if (_tcTop.length < 2) return;
  _tcTimer = setInterval(function () {
    var v = $('view-browse'); if (!v || v.classList.contains('hidden')) return;   // only advance while visible
    _tcIndex = (_tcIndex + 1) % _tcTop.length; tcPaint();
  }, 5000);
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
  var schools = Array.from(new Set(listedClubs().map(function (c) { return c.school; }).filter(Boolean))).sort();
  var cur = sel.value;
  sel.innerHTML = '<option value="">All schools</option>' +
    schools.map(function (s) { return '<option>' + escHtml(s) + '</option>'; }).join('');
  if (cur && schools.indexOf(cur) > -1) sel.value = cur;   // rebuilding must not silently clear the user's pick
}
function buildCreateCategoryOptions() {
  var sel = $('ccCategory'); if (!sel) return;
  sel.innerHTML = '<option value="">Select…</option>' +
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
    if (!isListedFor(c)) return false;   // banned users never see the club; private clubs are members-only
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
    : '<div class="empty" style="grid-column:1/-1"><div class="big">' + svgIcon('search', 40) + '</div><p>No clubs match your search yet.</p>' +
      '<p class="form-note">Try a different zip code, school, or focus area.</p></div>';
}

/* ---------- Reusable Club Card (no corner star, no rating chip) ---------- */
function renderCard(club) {
  var saved = isFavorite(club.id);
  // Save is available on every card regardless of join/ownership (syncs with the banner star).
  var foot = '<button class="fav-btn ' + (saved ? 'on' : '') + '" onclick="toggleFavorite(\'' + club.id + '\')">' +
        bookmarkSvg(saved) + (saved ? t('card_saved') : t('save_club')) + '</button>' +
      '<button class="btn primary" onclick="openClub(\'' + club.id + '\')">' + t('card_view') + '</button>';
  return (
    '<article class="card">' +
      '<div class="card-cover" style="' + coverStyle(club) + '" onclick="openClub(\'' + club.id + '\')">' +
        (club.banner ? '' : '<span class="cover-mark">' + styleForCategory(club.category).icon + '</span>' + cardDoodles(club.id)) +
        '<button class="card-share" title="' + escAttr(t('share_club')) + '" onclick="event.stopPropagation(); openShare(\'' + club.id + '\')">' + (typeof ICON_SHARE !== 'undefined' ? ICON_SHARE : '') + '</button>' +
        '<button class="card-flag" title="Report this club" onclick="event.stopPropagation(); openReport(\'club\',\'' + club.id + '\',\'' + jsArg(club.name) + '\')">' + (typeof ICON_FLAG !== 'undefined' ? ICON_FLAG : '') + '</button>' +
        '<span class="cover-cat">' + escHtml(club.category) + '</span></div>' +
      '<div class="card-body">' +
        (typeof partnershipBadge === 'function' ? partnershipBadge('club', club.id) : '') +
        '<div class="card-title" onclick="openClub(\'' + club.id + '\')"><h3>' + escHtml(club.name) + '</h3>' +
          (club.verified ? '<span class="name-verified-ico" title="Verified">' + verifiedSeal(16, '#e6b422', '#ffffff') + '</span>' : '') +
          (typeof isClubMember === 'function' && isClubMember(club) ? '<span class="joined-chip">✓ ' + t('joined_label') + '</span>' : '') + '</div>' +
        '<div class="card-meta">' + escHtml(club.school) + (club.zip ? ' · ' + escHtml(club.zip) : '') + '</div>' +
        (club.clubId ? '<div class="card-idline"><span class="club-id-chip">#' + escHtml(club.clubId) + '</span></div>' : '') +
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
   START A CLUB - media, district validation, invite code
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
  if (!validateMediaFile(f)) { e.target.value = ''; return; }
  var r = new FileReader(); r.onload = function (ev) { wizardBanner = ev.target.result; paintBannerPreview(); }; r.readAsDataURL(f);
  e.target.value = '';
}
function paintBannerPreview() {
  var el = $('ccBannerPreview'); if (!el) return;
  el.innerHTML = wizardBanner
    ? '<img src="' + wizardBanner + '" alt="banner preview"><button class="mini-x" title="Remove banner" onclick="clearBanner()">✕</button>'
    : 'No banner yet. We’ll use a plain color block for now.';
  el.classList.toggle('has-img', !!wizardBanner);
}
function clearBanner() { wizardBanner = ''; paintBannerPreview(); }
function onGalleryUpload(e) {
  Array.prototype.forEach.call(e.target.files, function (f) {
    if (!validateMediaFile(f)) return;
    var r = new FileReader(); r.onload = function (ev) { wizardGallery.push(ev.target.result); paintGalleryPreview(); }; r.readAsDataURL(f);
  });
  e.target.value = '';
}
function paintGalleryPreview() {
  var gp = $('ccGalleryPreview'); if (!gp) return;
  gp.innerHTML = wizardGallery.map(function (src, i) {
    var media = isVideoSrc(src)
      ? '<video src="' + escAttr(src) + '#t=0.1" muted playsinline preload="metadata"></video><span class="vid-badge">▶</span>'
      : '<img src="' + escAttr(src) + '" alt="">';
    return '<div class="thumb">' + media + '<button class="mini-x" onclick="removeGalleryItem(' + i + ')">✕</button></div>';
  }).join('');
}
function removeGalleryItem(i) { wizardGallery.splice(i, 1); paintGalleryPreview(); }

function validateCreate() {
  var invite = $('ccInvite').value.trim(), msg = $('ccInviteMsg');
  var paint = function () {
    var ok = isValidInvite(invite);
    if (invite) { msg.className = 'form-note ' + (ok ? 'ok' : 'bad'); msg.innerHTML = ok ? '✓ Verified. You can publish this club.' : '✗ That invite code isn’t recognized.'; }
    else { msg.className = 'form-note'; msg.innerHTML = 'Enter the club leader invite code from your school or from Student Club Hub.'; }
    var ready = $('ccName').value.trim() && createCategoryValue() && $('ccSchool').value.trim() &&
      $('ccDistrict').value.trim() && $('ccZip').value.trim() && $('ccEmail').value.trim() && ok;
    $('ccPublish').disabled = !ready;
  };
  paint();
  // ask the server (debounced) whether the typed code is valid, then repaint
  clearTimeout(validateCreate._t);
  if (invite && _inviteCheck.code !== invite.toUpperCase()) validateCreate._t = setTimeout(function () { checkInviteCode(invite).then(function () { if ($('ccInvite').value.trim() === invite) paint(); }); }, 350);
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test($('ccEmail').value.trim())) return toast('Enter a valid leader contact email (name@example.com).');
  if (!/^\d{5}$/.test($('ccZip').value.trim())) return toast('Enter a 5-digit zip code.');

  var club = {
    id: 'u-' + Date.now().toString(36), clubId: genClubId(), created: Date.now(),
    name: name, category: cat, focus: [],
    school: school, district: district, zip: $('ccZip').value.trim(),
    recruitment: $('ccRecruit').value,
    desc: $('ccDesc').value.trim() || 'A new club on Student Club Hub.',
    meeting: 'Schedule TBD',   // meeting times + tags are added later from the club page (Details pencil)
    email: $('ccEmail').value.trim() || currentUser.email,
    tags: [], memberCount: 1, banner: wizardBanner, gallery: wizardGallery.slice(),
    socials: collectCreateLinks(), chatAccess: 'all',
    leaders: [{ name: currentUser.name, role: 'President', email: $('ccEmail').value.trim() || currentUser.email }],
    roster: [{ name: currentUser.name, role: 'President', memberId: currentUser.memberId }],
    verifiedOwner: currentUser.memberId, inviteCode: $('ccInvite').value.trim().toUpperCase()
  };
  // Create it on the server first (the server checks the invite code), THEN add the President's
  // roster row — in that order, so the server already knows they lead the club.
  authBusy2('ccPublish', true, 'Publishing…');
  sbSaveClub(club).then(function () {
    CLUBS.push(club); _rememberClubBase(club);
    try { var seedIds = SEED_CLUBS.map(function (s) { return s.id; }); localStorage.setItem(LS.clubs, JSON.stringify(CLUBS.filter(function (c) { return seedIds.indexOf(c.id) === -1; }))); } catch (e) {}
    return sbAddMember(club.id, { memberId: currentUser.memberId, email: currentUser.email, name: currentUser.name, role: 'President' });
  }).then(function () {
    authBusy2('ccPublish', false);
    if (currentUser.joined.indexOf(club.id) === -1) { currentUser.joined.push(club.id); persistUser(); }
    if (editingDraftId) { deleteDraft(editingDraftId, true); editingDraftId = null; }
    buildSchoolFilter(); renderStats(); renderTopClubs();
    resetCreateForm();
    showView('browse'); applyFilters();
    openWelcome(club);                                  // Club-ID welcome / onboarding modal
  }).catch(function () { authBusy2('ccPublish', false); });   // sbSaveClub already explained the error
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
function addCreateLinkRow(url) {
  var w = $('ccLinks'); if (!w) return;
  if (w.querySelectorAll('.mg-link').length >= 8) { toast(t('links_max')); return; }
  w.insertAdjacentHTML('beforeend', linkInputRow(url || ''));
}
function seedCreateLinks(list) {
  var w = $('ccLinks'); if (!w) return;
  var arr = (list && list.length) ? list : [''];
  w.innerHTML = arr.map(function (u) { return linkInputRow(u); }).join('');
}
function collectCreateLinks() {
  return Array.prototype.map.call(document.querySelectorAll('#ccLinks .mg-link'), function (el) { return el.value.trim(); }).filter(isValidLink).slice(0, 8);
}
function resetCreateForm() {
  ['ccName','ccDesc','ccEmail','ccSchool','ccDistrict','ccZip','ccOther','ccInvite'].forEach(function (id) { $(id).value = ''; });
  $('ccCategory').value = ''; $('ccOtherWrap').classList.add('hidden'); $('ccPublish').disabled = true;
  wizardBanner = ''; wizardGallery = []; paintBannerPreview(); paintGalleryPreview();
  seedCreateLinks(['']); editingDraftId = null; validateCreate();
}

/* ============================================================
   DRAFTS - save an in-progress club without publishing
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
  try { localStorage.setItem(LS.drafts, JSON.stringify(all)); return true; }
  catch (e) { toast('This draft is too big to save on this device (usually large photos or videos). Remove some media and try again.'); return false; }
}
function saveDraft() {
  if (!currentUser) { pendingAuthAction = saveDraft; return openAuth('login'); }
  var draft = {
    id: editingDraftId || 'd-' + Date.now().toString(36),
    name: $('ccName').value.trim(), category: $('ccCategory').value, other: $('ccOther').value.trim(),
    recruitment: $('ccRecruit').value, school: $('ccSchool').value.trim(), district: $('ccDistrict').value.trim(),
    zip: $('ccZip').value.trim(), email: $('ccEmail').value.trim(), desc: $('ccDesc').value.trim(),
    invite: $('ccInvite').value.trim(),
    banner: wizardBanner, gallery: wizardGallery.slice(), links: collectCreateLinks(), saved: Date.now()
  };
  var list = loadDrafts();
  var i = list.findIndex(function (d) { return d.id === draft.id; });
  if (i > -1) list[i] = draft; else list.push(draft);
  if (!saveDrafts(list)) return;
  resetCreateForm();
  toast('Draft saved. You’ll find it in My Clubs → Drafts.');
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
  $('ccEmail').value = d.email || ''; $('ccDesc').value = d.desc || '';
  $('ccInvite').value = d.invite || '';
  wizardBanner = d.banner || ''; wizardGallery = (d.gallery || []).slice();
  paintBannerPreview(); paintGalleryPreview(); seedCreateLinks(d.links || ['']); validateCreate();
}
function deleteDraft(id, silent) {
  var list = loadDrafts().filter(function (d) { return d.id !== id; });
  saveDrafts(list);
  if (!silent) { toast('Draft deleted.'); if (typeof renderMyClubs === 'function') renderMyClubs(); }
}

