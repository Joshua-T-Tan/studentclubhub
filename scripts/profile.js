/* ============================================================
   profile.js — public user profiles and favorite-clubs (Saved)
   management.
   ============================================================ */

var currentProfileName = null;

/* Clubs a person leads (matched by display name across all club leader lists) */
function clubsLedBy(name) {
  return CLUBS.filter(function (c) {
    return (c.leaders || []).some(function (l) { return l.name === name; });
  });
}

/* ============================================================
   PUBLIC PROFILE
   ============================================================ */
function openProfile(name) {
  if (!name) return;
  currentProfileName = name;
  closeClubModal();
  renderProfile(name);
  showView('profile');
}
function renderProfileIfOpen() {
  if (currentProfileName && !$('view-profile').classList.contains('hidden')) renderProfile(currentProfileName);
}

function renderProfile(name) {
  var body = $('profileBody'); if (!body) return;
  var isSelf = !!(currentUser && currentUser.name === name);
  var rec = null;
  try { rec = Object.values(loadUsers()).find(function (u) { return u.name === name; }) || null; } catch (e) {}
  var memberId = isSelf ? currentUser.memberId : (rec && rec.memberId) || '';

  var led = clubsLedBy(name);

  // Sections that only make sense for the signed-in user viewing themselves
  var joined = [], favorites = [];
  if (isSelf) {
    joined = currentUser.joined.map(getClub).filter(Boolean).filter(function (c) { return led.indexOf(c) === -1; });
    favorites = currentUser.favorites.map(getClub).filter(Boolean);
  }

  var html =
    '<div style="padding-top:16px"><button class="btn ghost" onclick="goHome()">← Back to directory</button></div>' +
    '<div class="profile-head">' +
      avatarHTML(name, 'lg') +
      '<div class="meta">' +
        '<h1>' + escHtml(name) + '</h1>' +
        '<p>' + (memberId ? 'Member ' + escHtml(memberId) + ' · ' : '') +
          (led.length ? led.length + ' club' + (led.length === 1 ? '' : 's') + ' led' : 'Student Club Hub member') + '</p>' +
      '</div>' +
    '</div>';

  if (isSelf) {
    html += profileSection('★ Favorite Clubs', favorites,
      'You haven’t favorited any clubs yet — tap the ★ on any club to save it here.');
    html += profileSection('Clubs You’ve Joined', joined, 'You haven’t joined any clubs yet.');
  }
  html += profileSection(isSelf ? 'Clubs You Lead' : 'Clubs ' + name.split(' ')[0] + ' Leads', led,
    isSelf ? 'You don’t lead any clubs yet.' : 'No clubs listed.');

  body.innerHTML = html;
}

function profileSection(title, clubs, emptyMsg) {
  var inner = clubs && clubs.length
    ? '<div class="grid">' + clubs.map(renderCard).join('') + '</div>'
    : '<p class="form-note" style="padding:6px 0 4px">' + escHtml(emptyMsg) + '</p>';
  return '<div class="page-head" style="padding:22px 0 8px"><h1 style="font-size:1.2rem">' + escHtml(title) + '</h1></div>' + inner;
}

/* ============================================================
   SAVED (favorites) PAGE
   ============================================================ */
function renderSaved() {
  var grid = $('savedGrid'); if (!grid) return;
  if (!currentUser) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">★</div>' +
      '<p>Log in to save your favorite clubs.</p>' +
      '<div style="margin-top:14px"><button class="btn primary" onclick="openAuth(\'login\')">Log In</button></div></div>';
    return;
  }
  var favs = currentUser.favorites.map(getClub).filter(Boolean);
  if (!favs.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">☆</div>' +
      '<p>No favorites yet. Browse the directory and tap the ★ on clubs you love.</p>' +
      '<div style="margin-top:14px"><button class="btn primary" onclick="showView(\'home\')">Browse Clubs</button></div></div>';
    return;
  }
  grid.innerHTML = favs.map(renderCard).join('');
}
