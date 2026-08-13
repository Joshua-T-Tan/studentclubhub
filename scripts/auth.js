/* ============================================================
   auth.js — user state, login/signup, invite credentials,
   session persistence, plus shared app helpers used everywhere.
   ============================================================ */

/* ---------- localStorage namespace ---------- */
var LS = { users: 'sch_users', session: 'sch_session', clubs: 'sch_clubs' };

/* ---------- Session state ---------- */
var currentUser = null;          // { name, email, pass, memberId, favorites[], joined[], avatar }
var pendingAuthAction = null;    // callback to run right after a successful auth

/* ============================================================
   SHARED HELPERS (defined here because auth.js loads first)
   ============================================================ */
function $(id) { return document.getElementById(id); }

function escHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toast(msg) {
  var t = $('toast'); if (!t || !msg) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
}

var VIEWS = ['home', 'saved', 'profile', 'create'];
function showView(name) {
  VIEWS.forEach(function (v) {
    var el = $('view-' + v); if (el) el.classList.toggle('hidden', v !== name);
  });
  document.querySelectorAll('.nav-link').forEach(function (b) {
    b.classList.toggle('active', b.dataset.nav === name);
  });
  if (name === 'saved') { if (typeof renderSaved === 'function') renderSaved(); }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goHome() { closeClubModal(); showView('home'); }

/* Generic overlay open/close + click-outside dismissal */
function openOverlay(id) { var el = $(id); if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } }
function closeOverlay(id) {
  var el = $(id); if (el) el.classList.add('hidden');
  // release scroll lock only when no overlay remains open
  var anyOpen = Array.prototype.some.call(document.querySelectorAll('.overlay'), function (o) { return !o.classList.contains('hidden'); });
  if (!anyOpen) document.body.style.overflow = '';
}
// Close only when the click is on the scrim itself, not the modal card inside it.
function onOverlayClick(event, overlayId, closeFn) {
  if (event.target === $(overlayId)) (closeFn || function () { closeOverlay(overlayId); })();
}

/* Avatar helpers — shared so every account sees real photos, not just initials */
function initialsOf(n) {
  return (n || '?').split(' ').filter(Boolean).map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
}
function avatarForName(name) {
  if (!name) return null;
  if (currentUser && name === currentUser.name) return currentUser.avatar || null;
  try { var u = Object.values(loadUsers()).find(function (x) { return x.name === name; }); if (u && u.avatar) return u.avatar; } catch (e) {}
  return null;
}
function avatarHTML(name, size) {
  var src = avatarForName(name);
  var inner = src ? '<img src="' + src + '" alt="">' : escHtml(initialsOf(name));
  return '<div class="avatar ' + (size || 'sm') + '">' + inner + '</div>';
}

/* ============================================================
   USER STORE
   ============================================================ */
function loadUsers() { try { return JSON.parse(localStorage.getItem(LS.users)) || {}; } catch (e) { return {}; } }
function saveUsers(u) { localStorage.setItem(LS.users, JSON.stringify(u)); }

function genMemberId() {
  var users = loadUsers(), id;
  do { id = '#' + Math.floor(1000 + Math.random() * 9000); }
  while (Object.values(users).some(function (u) { return u.memberId === id; }));
  return id;
}

/* ============================================================
   INIT + SESSION RESTORE
   ============================================================ */
function initAuth() {
  var email = localStorage.getItem(LS.session);
  if (email) {
    var rec = loadUsers()[email.toLowerCase()];
    if (rec) setSession(rec);
  }
  renderAuthArea();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('lightbox').classList.contains('hidden')) return closeLightbox();
      ['confirmOverlay', 'contactOverlay', 'authOverlay', 'clubOverlay'].forEach(function (id) {
        if (!$(id).classList.contains('hidden')) closeOverlay(id);
      });
    }
  });
}

function setSession(rec) {
  currentUser = {
    name: rec.name, email: rec.email, pass: rec.pass, memberId: rec.memberId,
    favorites: (rec.favorites || []).slice(), joined: (rec.joined || []).slice(),
    avatar: rec.avatar || null
  };
  localStorage.setItem(LS.session, rec.email.toLowerCase());
}

/* Persist the live session's favorites/joined/avatar back onto the account record */
function persistUser() {
  if (!currentUser) return;
  var users = loadUsers(), key = currentUser.email.toLowerCase();
  if (!users[key]) return;
  users[key].favorites = currentUser.favorites.slice();
  users[key].joined = currentUser.joined.slice();
  users[key].avatar = currentUser.avatar || null;
  users[key].name = currentUser.name;
  saveUsers(users);
}

/* ============================================================
   AUTH MODAL
   ============================================================ */
var authTab = 'login';
function openAuth(tab) {
  setAuthTab(tab || 'login');
  $('auName').value = ''; $('auEmail').value = ''; $('auPass').value = '';
  $('authError').classList.add('hidden');
  $('signupCredential').classList.add('hidden');
  openOverlay('authOverlay');
}
function closeAuth() { closeOverlay('authOverlay'); }
function setAuthTab(tab) {
  authTab = tab;
  $('tabLogin').classList.toggle('active', tab === 'login');
  $('tabSignup').classList.toggle('active', tab === 'signup');
  $('auName').parentElement.classList.toggle('hidden', tab === 'login');
  $('authSubmit').textContent = tab === 'login' ? 'Log In' : 'Create Account';
  $('authError').classList.add('hidden');
}
function authErr(msg) { var e = $('authError'); e.textContent = msg; e.classList.remove('hidden'); }

function submitAuth() {
  var name = $('auName').value.trim();
  var email = $('auEmail').value.trim().toLowerCase();
  var pass = $('auPass').value;
  if (!email || !pass) return authErr('Email and password are required.');
  if (authTab === 'signup') return doSignup(name, email, pass);
  return doLogin(email, pass);
}

function doLogin(email, pass) {
  var users = loadUsers(), rec = users[email];
  if (!rec || rec.pass !== pass) return authErr('That email and password don’t match an account.');
  setSession(rec);
  finishAuth('Welcome back, ' + rec.name.split(' ')[0] + '!');
}

/* Signup issues an "invite credential" — a unique Member ID used to identify the
   student across the directory (e.g. for club rosters). */
function doSignup(name, email, pass) {
  if (!name) return authErr('Please enter your name.');
  var users = loadUsers();
  if (users[email]) return authErr('An account with that email already exists — log in instead.');
  var memberId = genMemberId();
  var rec = { name: name, email: email, pass: pass, memberId: memberId, favorites: [], joined: [], avatar: null };
  users[email] = rec; saveUsers(users);
  setSession(rec);
  // Surface the issued credential to the new member before closing.
  var box = $('signupCredential');
  box.innerHTML = 'Your member credential: <span class="id">' + memberId + '</span><br>' +
    '<span class="form-note">Share this ID with club leaders so they can add you to their roster.</span>';
  box.classList.remove('hidden');
  renderAuthArea();
  toast('Account created — you’re signed in.');
  setTimeout(function () { finishAuth(''); }, 1600);
}

function finishAuth(msg) {
  renderAuthArea();
  closeAuth();
  if (msg) toast(msg);
  var act = pendingAuthAction; pendingAuthAction = null;
  if (typeof act === 'function') act();
  if (typeof refreshFavUI === 'function') refreshFavUI();
}

function logout() {
  persistUser();
  currentUser = null;
  localStorage.removeItem(LS.session);
  renderAuthArea();
  if (typeof refreshFavUI === 'function') refreshFavUI();
  showView('home');
  toast('You’ve been logged out.');
}

/* Gate an action behind login; resume it automatically after auth succeeds. */
function requireAuth(cb) {
  if (currentUser) { if (typeof cb === 'function') cb(); return true; }
  pendingAuthAction = cb || null;
  openAuth('login');
  return false;
}

/* ============================================================
   HEADER AUTH AREA
   ============================================================ */
function renderAuthArea() {
  var area = $('authArea'); if (!area) return;
  if (!currentUser) {
    area.innerHTML =
      '<button class="btn ghost" onclick="openAuth(\'login\')">Log In</button>' +
      '<button class="btn primary" onclick="openAuth(\'signup\')">Sign Up</button>';
    return;
  }
  area.innerHTML =
    '<button class="user-chip" onclick="openProfile(currentUser.name)" title="View your profile">' +
      avatarHTML(currentUser.name, 'sm') +
      '<span class="name">' + escHtml(currentUser.name.split(' ')[0]) + '</span>' +
    '</button>' +
    '<button class="icon-btn" title="Log out" onclick="logout()">⎋</button>';
}

/* ============================================================
   FAVORITES (data layer — UI lives in directory/modal/profile)
   ============================================================ */
function isFavorite(clubId) { return !!(currentUser && currentUser.favorites.indexOf(clubId) !== -1); }
function toggleFavorite(clubId) {
  if (!currentUser) { pendingAuthAction = function () { toggleFavorite(clubId); }; openAuth('login'); return; }
  var i = currentUser.favorites.indexOf(clubId);
  if (i === -1) { currentUser.favorites.push(clubId); toast('Saved to your favorites ★'); }
  else { currentUser.favorites.splice(i, 1); toast('Removed from favorites'); }
  persistUser();
  if (typeof refreshFavUI === 'function') refreshFavUI();
}
function isJoined(clubId) { return !!(currentUser && currentUser.joined.indexOf(clubId) !== -1); }
