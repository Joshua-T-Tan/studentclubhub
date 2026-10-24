/* ============================================================
   editors.js — distributed, per-section owner/leader editors.
   The banner gear opens a focused "Page settings" popup (title,
   type, publicity, open-to-partnerships, banner). Every other
   section (About, Gallery, Links, Details, Hours, Contact, Chat,
   Roster, Deal) has its own gray pencil/gear that opens a small
   modal editing just that section. Reuses the bizOverlay modal.
   Loaded after business.js / messages.js / partnerships.js.
   ============================================================ */

/* ---- shared modal shell (reuses #bizOverlay / #bizBody) ---- */
function _emOpen(title, body, saveCall, saveLabel) {
  $('bizBody').innerHTML =
    '<div class="modal-pad edit-modal"><div class="ro-head"><h3>' + escHtml(title) + '</h3>' +
      '<button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<div id="emErr" class="auth-error hidden"></div>' + body +
    (saveCall ? '<button id="emSave" class="btn primary block lg" onclick="' + saveCall + '">' + (saveLabel || 'Save changes') + '</button>' : '') +
    '</div>';
  openOverlay('bizOverlay');
}
function _emErr(m) { var e = $('emErr'); if (e) { e.textContent = m; e.classList.remove('hidden'); } }
function _emVal(id) { return ($(id) && $(id).value || '').trim(); }
function _toggleRow(id, title, note, on) {
  return '<label class="toggle-row" style="cursor:pointer;margin:6px 0"><div><div class="tr-title">' + escHtml(title) + '</div>' +
    '<div class="form-note">' + escHtml(note) + '</div></div><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + ' style="width:20px;height:20px"></label>';
}
/* Half-hour clock options ("12:00 AM" … "11:30 PM") for time-slot pickers */
function _timeSlots() {
  var out = [];
  for (var m = 0; m < 24 * 60; m += 30) {
    var h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'AM' : 'PM', h12 = (h % 12) || 12;
    out.push(h12 + ':' + (mm < 10 ? '0' + mm : mm) + ' ' + ap);
  }
  return out;
}
/* Map a stored time ("9:15 am", "09:00 AM") onto the nearest half-hour option so edits don't silently reset it. */
function _snapSlot(s) {
  var m = (typeof parseClock === 'function') ? parseClock(s) : null; if (m == null) return s;
  m = Math.round(m / 30) * 30 % (24 * 60);
  var h = Math.floor(m / 60), mm = m % 60; return ((h % 12) || 12) + ':' + (mm ? '30' : '00') + ' ' + (h < 12 ? 'AM' : 'PM');
}
function _timeOpts(sel) {
  return _timeSlots().map(function (t) { return '<option' + (t === sel ? ' selected' : '') + '>' + t + '</option>'; }).join('');
}

/* ==================================================================
   CLUB EDITORS  (localStorage → saveUserClubs + renderClub)
   ================================================================== */
function _club(id) { var c = getClub(id); return (c && canEditClub(c)) ? c : null; }
function _clubCatOpts(sel) {
  var cats = (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).map(function (x) { return typeof x === 'string' ? x : (x.name || x.label || x.id || ''); }).filter(Boolean);
  if (sel && cats.indexOf(sel) < 0) cats.unshift(sel);
  return cats.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + escHtml(x) + '</option>'; }).join('');
}
function _clubSave(id, msg) { saveUserClubs(getClub(id)); closeReach(); if (typeof applyFilters === 'function') applyFilters(); if (typeof renderTopClubs === 'function') renderTopClubs(); renderClub(); if (msg) toast(msg); }

/* Banner gear → page settings popup */
var _emClubBanner;
function editClubBanner(id) {
  var c = _club(id); if (!c) return;
  _emClubBanner = undefined;
  var body =
    '<div class="field"><label>Club name</label><input id="emTitle" type="text" value="' + escAttr(c.name) + '"></div>' +
    '<div class="field"><label>Club type</label><select id="emCat" class="select block-select">' + _clubCatOpts(c.category) + '</select></div>' +
    '<div class="field"><label>Banner image</label><div id="emBannerPrev"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" hidden onchange="emClubBannerUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Upload banner image</label></div>' +
    _toggleRow('emPrivate', 'Private club', 'Hidden from public Browse unless someone has your link.', c.recruitment === 'Private') +
    _toggleRow('emPartner', 'Open to partnerships', 'Shows an “Open to partnerships” badge on your banner.', !!c.partnershipOpen) +
    (ownerOf(c) ? _verifyRowHTML(c.verified, 'verifyClub(\'' + id + '\')', 'club') +
      '<div class="danger-zone"><div class="tr-title">President only</div>' +
        '<button type="button" class="btn ghost" onclick="closeReach();leaveClubFlow(\'' + id + '\')">Hand off presidency &amp; leave</button>' +
        '<button type="button" class="btn danger" onclick="closeReach();deleteClub(\'' + id + '\')">Delete club</button></div>' : '');
  _emOpen('Page settings', body, 'saveClubBanner(\'' + id + '\')');
  emPaintClubBanner(id);
}
/* Shared Verify row for the page-settings popup (clubs + businesses). */
function _verifyRowHTML(isVerified, onclick, kind) {
  if (isVerified) return '<div class="verify-row done">' + verifiedSeal(18, '#e6b422', '#ffffff') +
    '<span>This ' + kind + ' is verified.</span></div>';
  return '<div class="verify-row"><div><div class="tr-title">Verify this ' + kind + '</div>' +
    '<div class="form-note">Adds a gold Verified seal to your page and card. One-time — it can’t be undone.</div></div>' +
    '<button type="button" class="btn ghost sm-btn" onclick="' + onclick + '">Verify</button></div>';
}
function verifyClub(id) {
  var c = _club(id); if (!c || !ownerOf(c) || c.verified) return;
  openConfirm('Verify this club?', 'This adds a gold Verified seal to your club’s page and card. It’s one-time and can’t be undone.', verifiedSeal(22, '#e6b422', '#ffffff'), function () {
    if ($('emTitle')) _applyClubBannerForm(c);   // keep any unsaved Page settings edits
    c.verified = true; _clubSave(id, 'Club verified.');
  }, 'Verify');
}
function emPaintClubBanner(id) {
  var c = getClub(id); var el = $('emBannerPrev'); if (!el) return;
  var src = (_emClubBanner !== undefined) ? _emClubBanner : (c && c.banner);
  el.innerHTML = src
    ? '<div class="eb-banner" style="background-image:url(' + escAttr(src) + ')"><button class="mini-x" onclick="emClubBannerRemove(\'' + id + '\')">✕</button></div>'
    : '<p class="form-note">No banner yet — a gradient block is used.</p>';
}
function emClubBannerUpload(id, e) {
  var f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (typeof validateMediaFile === 'function' && !validateMediaFile(f)) return;
  var r = new FileReader(); r.onload = function (ev) { _emClubBanner = ev.target.result; emPaintClubBanner(id); }; r.readAsDataURL(f);
}
function emClubBannerRemove(id) { _emClubBanner = ''; emPaintClubBanner(id); }
function _applyClubBannerForm(c) {
  var name = _emVal('emTitle'); if (name) c.name = name;
  if ($('emCat')) c.category = $('emCat').value;
  c.recruitment = ($('emPrivate') && $('emPrivate').checked) ? 'Private' : 'Public';
  c.partnershipOpen = !!($('emPartner') && $('emPartner').checked);
  if (_emClubBanner !== undefined) c.banner = _emClubBanner;
}
function saveClubBanner(id) {
  var c = _club(id); if (!c) return;
  if (!_emVal('emTitle')) return _emErr('Club name can’t be empty.');
  _applyClubBannerForm(c);
  _clubSave(id, 'Page settings saved.');
}

/* About */
function editClubAbout(id) {
  var c = _club(id); if (!c) return;
  _emOpen('Edit About', '<div class="field"><label>About your club</label><textarea id="emAbout" style="min-height:130px">' + escHtml(c.desc || '') + '</textarea></div>', 'saveClubAbout(\'' + id + '\')');
}
function saveClubAbout(id) { var c = _club(id); if (!c) return; c.desc = _emVal('emAbout'); _clubSave(id, 'About updated.'); }

/* Details — multiple meeting times (day + clock dial + place, add/delete) + school, district, zip, email, tags */
function _meetRow(m) {
  m = m || {};
  var days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
  var dayOpts = '<option value="">Day</option>' + days.map(function (d) { return '<option' + (m.day === d ? ' selected' : '') + '>' + d + '</option>'; }).join('');
  return '<div class="meet-row"><select class="mt-day select">' + dayOpts + '</select>' +
    '<input class="mt-time" type="time" value="' + escAttr(m.time || '') + '">' +
    '<input class="mt-place" type="text" placeholder="Place (e.g. Room 214)" value="' + escAttr(m.place || '') + '">' +
    '<button type="button" class="mini-x" title="Remove" onclick="this.closest(\'.meet-row\').remove()">✕</button></div>';
}
function emAddMeet() { var w = $('emMeets'); if (w) w.insertAdjacentHTML('beforeend', _meetRow({})); }
/* Turn an old free-text meeting ("Mondays & Thursdays @ 3:15 PM · Rm 108") into editor rows, so opening
   the editor never wipes it. Anything we can't parse stays in the Place box. */
function _legacyMeetRows(c) {
  var pairs = (typeof clubMeetingPairs === 'function') ? clubMeetingPairs(c) : [];
  if (!pairs.length || /^(schedule )?tbd$/i.test((c.meeting || '').trim())) return [{}];
  return pairs.map(function (p) {
    var dm = (p.time || '').match(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat)[a-z]*/i), tm = (p.time || '').match(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    var days = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
    var day = dm ? days.find(function (d) { return d.slice(0, 3).toLowerCase() === dm[1].toLowerCase(); }) : '';
    var clean = dm && tm && /^[A-Za-z]+\s*@?\s*\d{1,2}:\d{2}\s*(AM|PM)$/i.test((p.time || '').trim());
    if (!clean) return { day: '', time: '', place: [p.time, p.place].filter(Boolean).join(' · ') };   // keep the original wording as-is
    return { day: day || '', time: _to24(tm[0].toUpperCase().replace(/\s+/, ' ')), place: p.place };
  });
}
function editClubDetails(id) {
  var c = _club(id); if (!c) return;
  var meetings = (c.meetings && c.meetings.length) ? c.meetings
    : ((c.meetDay || c.meetTime || c.meetLoc) ? [{ day: c.meetDay || '', time: _to24(c.meetTime), place: c.meetLoc || '' }] : _legacyMeetRows(c));
  var body =
    '<div class="field"><label>Meeting times</label><div id="emMeets">' + meetings.map(_meetRow).join('') + '</div>' +
      '<button class="btn ghost sm-btn" type="button" onclick="emAddMeet()" style="margin-top:4px">+ Add meeting time</button></div>' +
    '<div class="two-col"><div class="field"><label>School</label><input id="emSchool" type="text" value="' + escAttr(c.school || '') + '"></div>' +
      '<div class="field"><label>Zip code</label><input id="emZip" type="text" maxlength="5" value="' + escAttr(c.zip || '') + '"></div></div>' +
    '<div class="field"><label>School district</label><input id="emDistrict" type="text" value="' + escAttr(c.district || '') + '"></div>' +
    '<div class="field"><label>Leader contact email</label><input id="emEmail" type="email" value="' + escAttr(c.email || '') + '"></div>' +
    '<div class="field"><label>Tags <span class="form-note">(comma-separated)</span></label><input id="emTags" type="text" value="' + escAttr((c.tags || []).join(', ')) + '" placeholder="robotics, coding, competition"></div>';
  _emOpen('Edit Details', body, 'saveClubDetails(\'' + id + '\')');
}
function saveClubDetails(id) {
  var c = _club(id); if (!c) return;
  var email0 = _emVal('emEmail'), zip0 = _emVal('emZip');
  if (email0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email0)) return _emErr('Enter a valid leader contact email (name@example.com).');
  if (zip0 && !/^\d{5}$/.test(zip0)) return _emErr('Enter a 5-digit zip code.');
  var meets = Array.prototype.map.call(document.querySelectorAll('#emMeets .meet-row'), function (row) {
    return { day: row.querySelector('.mt-day').value, time: row.querySelector('.mt-time').value, place: row.querySelector('.mt-place').value.trim() };
  }).filter(function (m) { return m.day || m.time || m.place; });
  c.meetings = meets;
  c.meeting = meets.length ? meets.map(function (m) {
    var parts = []; if (m.day) parts.push(m.day); if (m.time) parts.push(_to12(m.time));
    var s = parts.join(' '); if (m.place) s += (s ? ' · ' : '') + m.place; return s;
  }).join(', ') : 'Schedule TBD';
  c.meetDay = null; c.meetTime = null; c.meetLoc = null;   // migrated to meetings[]
  if (_emVal('emSchool')) c.school = _emVal('emSchool');
  if (_emVal('emDistrict')) c.district = _emVal('emDistrict');
  c.zip = _emVal('emZip');
  var email = _emVal('emEmail');
  if (email) { c.email = email; var pres = (c.leaders || []).find(function (l) { return l.role === 'President'; }); if (pres) pres.email = email; }
  c.tags = _emVal('emTags').split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12);
  _clubSave(id, 'Details updated.');
}

/* Links */
function editClubLinks(id) {
  var c = _club(id); if (!c) return;
  var rows = ((c.socials && c.socials.length) ? c.socials : ['']).map(_emLinkRow).join('');
  _emOpen('Edit Links', '<div id="emLinks">' + rows + '</div><button class="btn ghost sm-btn" type="button" onclick="emAddLink()">+ Add Link</button>', 'saveClubLinks(\'' + id + '\')');
}
function _emLinkRow(u) { return '<div class="link-row"><input type="text" class="em-link" placeholder="https://instagram.com/yourclub" value="' + escAttr(u || '') + '"><button type="button" class="mini-x" onclick="this.parentElement.remove()">✕</button></div>'; }
function emAddLink() { var w = $('emLinks'); if (w) { w.insertAdjacentHTML('beforeend', _emLinkRow('')); var ins = w.querySelectorAll('.em-link'); if (ins.length) ins[ins.length - 1].focus(); } }
function _emCollectLinks() { return Array.prototype.map.call(document.querySelectorAll('#emLinks .em-link'), function (el) { return el.value.trim(); }).filter(function (u) { return typeof isValidLink === 'function' ? isValidLink(u) : !!u; }).slice(0, 10); }
function saveClubLinks(id) { var c = _club(id); if (!c) return; c.socials = _emCollectLinks(); _clubSave(id, 'Links updated.'); }

/* Gallery (add + delete, re-renders itself) */
function editClubGallery(id) {
  var c = _club(id); if (!c) return;
  var g = (c.gallery || []);
  var cells = g.length ? g.map(function (src, i) {
    var m = isVideoSrc(src) ? '<video src="' + escAttr(src) + '#t=0.1" muted></video>' : '<img src="' + escAttr(src) + '" alt="">';
    return '<div class="thumb">' + m + '<button class="mini-x" onclick="emClubGalleryRemove(\'' + id + '\',' + i + ')">✕</button></div>';
  }).join('') : '<p class="form-note" style="grid-column:1/-1">No photos or videos yet.</p>';
  var body = '<div class="gallery" style="margin-bottom:12px">' + cells + '</div>' +
    '<label class="uploader"><input type="file" accept="image/*,video/mp4,video/webm,video/ogg" multiple hidden onchange="emClubGalleryUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Add photos &amp; videos</label>';
  _emOpen('Edit Gallery', body, '');
}
function emClubGalleryUpload(id, e) {
  var c = _club(id); if (!c) return;
  Array.prototype.forEach.call(e.target.files, function (f) {
    if (typeof validateMediaFile === 'function' && !validateMediaFile(f)) return;
    var r = new FileReader(); r.onload = function (ev) { c.gallery = c.gallery || []; c.gallery.push(ev.target.result); if (!saveUserClubs(c)) { c.gallery.pop(); toast('Storage full — remove some media.'); } renderClub(); editClubGallery(id); }; r.readAsDataURL(f);
  });
  e.target.value = '';
}
function emClubGalleryRemove(id, i) { var c = _club(id); if (!c) return; c.gallery.splice(i, 1); saveUserClubs(c); renderClub(); editClubGallery(id); }

/* Chat settings (gear): allow members + cooldown */
function editClubChat(id) {
  var c = _club(id); if (!c) return;
  var cd = c.chatCooldown || 0;
  var body =
    _toggleRow('emChatAll', 'Let all members post', 'Off: only officers (President, VP, Treasurer, Secretary) can post in the club chat.', c.chatAccess !== 'officers') +
    '<div class="field"><label>Message cooldown (anti-spam)</label><select id="emCd" class="select block-select">' +
      [0, 5, 10, 30, 60].map(function (s) { return '<option value="' + s + '"' + (s === cd ? ' selected' : '') + '>' + (s === 0 ? 'No cooldown' : s + ' seconds between messages') + '</option>'; }).join('') +
    '</select></div>';
  _emOpen('Chat settings', body, 'saveClubChat(\'' + id + '\')');
}
function saveClubChat(id) {
  var c = _club(id); if (!c) return;
  c.chatAccess = ($('emChatAll') && $('emChatAll').checked) ? 'all' : 'officers';
  c.chatCooldown = parseInt(_emVal('emCd') || '0', 10) || 0;
  _clubSave(id, 'Chat settings saved.');
}

/* Roster settings (gear): roles / remove / ban — reuses existing mod functions */
var _rosterEditId = null;
function editClubRoster(id) {
  var c = getClub(id); if (!c || !ownerOf(c)) return; _rosterEditId = id;   // roster moderation stays President-only
  var roleOpts = function (cur) { return OFFICER_ROLES.map(function (r) { return '<option' + (r === cur ? ' selected' : '') + '>' + r + '</option>'; }).join(''); };
  var rows = sortedRoster(c).map(function (m) {
    var idx = c.roster.indexOf(m), isMe = !!m.memberId && m.memberId === currentUser.memberId, lockSelf = isMe && m.role === 'President';
    var sel = lockSelf ? '<select disabled>' + roleOpts(m.role) + '</select>'
      : '<select onchange="requestRoleChange(\'' + c.id + '\',' + idx + ',this.value)">' + roleOpts(m.role) + '</select>';
    var mod = isMe ? '' : '<button class="btn ghost sm-btn" onclick="removeMember(\'' + c.id + '\',' + idx + ')">Remove</button>' +
      '<button class="btn danger sm-btn" onclick="banMember(\'' + c.id + '\',' + idx + ')">Ban</button>';
    return '<div class="roster-item"><div class="roster-row">' + avatarHTML(m.name, 'sm') +
      '<div class="who"><div class="n">' + escHtml(m.name) + '</div></div>' + sel + mod + '</div></div>';
  }).join('') || '<p class="form-note">No members yet.</p>';
  _emOpen('Members & roles', '<div class="roster">' + rows + '</div>' + (typeof bannedSectionHTML === 'function' ? bannedSectionHTML(c) : ''), '');
}
function _reopenRoster() { if (_rosterEditId && $('bizOverlay') && !$('bizOverlay').classList.contains('hidden')) editClubRoster(_rosterEditId); }

/* ==================================================================
   BUSINESS EDITORS  (Supabase → sbUpdateBusiness + renderBusinessPage)
   ================================================================== */
function _biz(id) { var b = (typeof currentBiz !== 'undefined' && currentBiz && currentBiz.id === id) ? currentBiz : (_bizOwned[id] || (_bizCache || []).find(function (x) { return x.id === id; })); return (b && isBizOwner(b)) ? b : null; }
function _bizSave(id, patch, msg) {
  var b = _biz(id); if (!b) return;
  authBusy2('emSave', true, 'Saving…');
  sbUpdateBusiness(id, patch).then(function (rows) {
    var u = (rows && rows[0]) || null;
    if (u) { if (currentBiz && currentBiz.id === id) currentBiz = u; _bizOwned[id] = u; }
    else Object.keys(patch).forEach(function (k) { b[k] = patch[k]; });
    _bizCache = null; closeReach(); renderBusinessPage(currentBiz && currentBiz.id === id ? currentBiz : (u || b)); toast(msg || 'Saved.');
  }).catch(function (ex) { authBusy2('emSave', false); if ($('emErr')) _emErr(ex.message); else toast(ex.message); });
}

/* Banner gear → page settings popup (title, type, publicity, partnerships, slideshow photos) */
var _emBizPhotos = null, _emBizBanner;
function editBizBanner(id) {
  var b = _biz(id); if (!b) return;
  _emBizPhotos = (b.photos || []).slice(); _emBizBanner = undefined;
  var catOpts = BIZ_CATEGORIES.map(function (c) { return '<option' + (c === b.category ? ' selected' : '') + '>' + escHtml(c) + '</option>'; }).join('');
  var body =
    '<div class="field"><label>Business name</label><input id="emTitle" type="text" value="' + escAttr(b.name) + '"></div>' +
    '<div class="field"><label>Category / type</label><select id="emCat" class="select block-select">' + catOpts + '</select></div>' +
    '<div class="field"><label>Card banner <span class="form-note">(Browse thumbnail)</span></label><div id="emBizBannerPrev"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" hidden onchange="emBizBannerUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Upload banner</label></div>' +
    '<div class="field"><label>Slideshow photos <span class="form-note">(top of your profile — up to 10)</span></label><div id="emBizPhotos" class="biz-photostrip"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" multiple hidden onchange="emBizPhotosUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Add slideshow photos</label></div>' +
    _toggleRow('emPrivate', 'Private listing', 'Hidden from public Browse unless someone has your link.', !!b.is_private) +
    _toggleRow('emPartner', 'Open to partnerships', 'Shows an “Open to partnerships” badge on your banner.', !!b.partnership_open) +
    _verifyRowHTML(b.verified, 'verifyBusiness(\'' + id + '\')', 'business') +
    '<div class="danger-zone"><div class="tr-title">Remove listing</div>' +
      '<button type="button" class="btn danger" onclick="deleteBusiness(\'' + id + '\')">Delete business</button></div>';
  _emOpen('Page settings', body, 'saveBizBanner(\'' + id + '\')');
  emPaintBizBanner(id); emPaintBizPhotos(id);
}
function verifyBusiness(id) {
  var b = _biz(id); if (!b || !isBizOwner(b) || b.verified) return;
  openConfirm('Verify this business?', 'This adds a gold Verified seal to your business’s page and card. It’s one-time and can’t be undone.', verifiedSeal(22, '#e6b422', '#ffffff'), function () {
    // Save whatever is in the open Page settings form too, so verifying never discards edits.
    var patch = $('emTitle') ? _bizBannerPatch(id) : {}; patch.verified = true;
    _bizSave(id, patch, 'Business verified.');
  }, 'Verify');
}
/* Remove the listing for good (its reviews go with it; live partnerships end). */
function deleteBusiness(id) {
  var b = _biz(id); if (!b) return;
  closeReach();
  openConfirm('Delete “' + b.name + '”?', 'This permanently removes your business page, its deal, and its reviews. This can’t be undone.', svgIcon('warning', 26), function () {
    var q = encodeURIComponent(id);
    sbRest('partner_agreements?or=(and(a_type.eq.business,a_id.eq.' + q + '),and(b_type.eq.business,b_id.eq.' + q + '))&status=in.(pending,launched)',
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) }).catch(function () {});
    sbRest('businesses?id=eq.' + q, { method: 'DELETE', headers: { Prefer: 'return=representation' } }).then(function (rows) {
      if (!rows || !rows.length) throw new Error('Couldn’t delete this business. Try again.');
      delete _bizOwned[id]; if (typeof _bizExtra !== 'undefined') delete _bizExtra[id]; _bizCache = null; currentBiz = null;
      if (typeof loadPartnerAgreements === 'function') loadPartnerAgreements();
      toast('Business deleted.'); openShops('my');
    }).catch(function (ex) { toast(ex.message); });
  }, 'Delete');
}
function toggleBizReviews(id) {
  var b = _biz(id); if (!b || !isBizOwner(b)) return;
  var nv = !(b.reviews_enabled !== false);   // flip current enabled state
  _bizSave(id, { reviews_enabled: nv }, nv ? 'Reviews turned on.' : 'Reviews turned off.');
}
function emPaintBizBanner(id) {
  var b = _biz(id); var el = $('emBizBannerPrev'); if (!el) return;
  var src = (_emBizBanner !== undefined) ? _emBizBanner : (b && b.banner);
  el.innerHTML = src ? '<div class="eb-banner" style="background-image:url(' + escAttr(src) + ')"><button class="mini-x" onclick="emBizBannerRemove(\'' + id + '\')">✕</button></div>' : '<p class="form-note">No banner — a gradient block is used on your card.</p>';
}
function emBizBannerUpload(id, e) { var f = e.target.files[0]; e.target.value = ''; if (!f) return; toast('Uploading…'); sbUploadMedia(f, false).then(function (u) { _emBizBanner = u; emPaintBizBanner(id); }).catch(function (ex) { toast(ex.message); }); }
function emBizBannerRemove(id) { _emBizBanner = ''; emPaintBizBanner(id); }
function emPaintBizPhotos(id) {
  var el = $('emBizPhotos'); if (!el) return;
  el.innerHTML = (_emBizPhotos && _emBizPhotos.length) ? _emBizPhotos.map(function (u, i) { return '<div class="biz-photo" style="background-image:url(' + escAttr(u) + ')"><button class="mini-x" onclick="emBizPhotoRemove(\'' + id + '\',' + i + ')">✕</button></div>'; }).join('') : '<p class="form-note" style="grid-column:1/-1">No slideshow photos yet.</p>';
}
function emBizPhotosUpload(id, e) {
  var files = Array.prototype.slice.call(e.target.files); e.target.value = '';
  var room = 10 - _emBizPhotos.length;
  if (room <= 0) return toast('Up to 10 slideshow photos.');
  if (files.length > room) toast('Only the first ' + room + ' will be added (10 max).');
  files = files.slice(0, room); if (!files.length) return;
  toast('Uploading ' + files.length + (files.length === 1 ? ' photo…' : ' photos…'));
  files.reduce(function (p, f) {
    return p.then(function () { return sbUploadMedia(f, false).then(function (u) { _emBizPhotos.push(u); emPaintBizPhotos(id); }).catch(function (ex) { toast(ex.message); }); });
  }, Promise.resolve());
}
function emBizPhotoRemove(id, i) { _emBizPhotos.splice(i, 1); emPaintBizPhotos(id); }
function _bizBannerPatch(id) {
  var b = _biz(id) || {};
  var patch = { name: _emVal('emTitle') || b.name, category: $('emCat') ? $('emCat').value : b.category,
    is_private: !!($('emPrivate') && $('emPrivate').checked), partnership_open: !!($('emPartner') && $('emPartner').checked), photos: _emBizPhotos || [] };
  if (_emBizBanner !== undefined) patch.banner = _emBizBanner || null;
  return patch;
}
function saveBizBanner(id) {
  if (!_biz(id)) return;
  if (!_emVal('emTitle')) return _emErr('Business name can’t be empty.');
  _bizSave(id, _bizBannerPatch(id), 'Page settings saved.');
}

/* Deal / perk */
function editBizPerk(id) {
  var b = _biz(id); if (!b) return;
  var perkOpts = Object.keys(PERK_TYPES).map(function (k) { return '<option value="' + k + '"' + (k === b.perk_type ? ' selected' : '') + '>' + PERK_TYPES[k] + '</option>'; }).join('');
  var aud = b.perk_audience || 'student';
  var body =
    '<div class="field"><label>Deal type</label><select id="emPerkType" class="select block-select">' + perkOpts + '</select></div>' +
    '<div class="field"><label>Who it’s for</label><select id="emAud" class="select block-select">' +
      '<option value="student"' + (aud === 'student' ? ' selected' : '') + '>Students only</option>' +
      '<option value="everyone"' + (aud === 'everyone' ? ' selected' : '') + '>Everyone</option></select></div>' +
    '<div class="field"><label>The deal / offer</label><textarea id="emPerk" placeholder="e.g. 15% off any drink">' + escHtml(b.perk_description || '') + '</textarea></div>' +
    '<div class="field"><label>How to redeem it</label><textarea id="emRedeem" placeholder="e.g. Show your student ID, or use code HI at checkout.">' + escHtml(b.redemption_instructions || '') + '</textarea></div>' +
    '<div class="two-col"><div class="field"><label>Starts <span class="form-note">(optional)</span></label><input id="emStart" type="date" value="' + escAttr(b.perk_start || '') + '"></div>' +
      '<div class="field"><label>Ends <span class="form-note">(optional)</span></label><input id="emEnd" type="date" value="' + escAttr(b.perk_end || '') + '"></div></div>';
  _emOpen('Edit deal', body, 'saveBizPerk(\'' + id + '\')');
}
function saveBizPerk(id) {
  if (!_emVal('emPerk')) return _emErr('Describe the deal, or use the trash icon to remove it.');
  var s = _emVal('emStart'), en = _emVal('emEnd');
  if (s && en && en < s) return _emErr('The end date can’t be before the start date.');
  _bizSave(id, {
    perk_type: _emVal('emPerkType') || 'discount', perk_audience: _emVal('emAud') || 'student',
    perk_description: _emVal('emPerk'), redemption_instructions: _emVal('emRedeem'),
    perk_start: _emVal('emStart') || null, perk_end: _emVal('emEnd') || null
  }, 'Deal updated.');
}

/* About */
function editBizAbout(id) {
  var b = _biz(id); if (!b) return;
  _emOpen('Edit About', '<div class="field"><label>About the business</label><textarea id="emAbout" style="min-height:130px">' + escHtml(b.about || '') + '</textarea></div>', 'saveBizAbout(\'' + id + '\')');
}
function saveBizAbout(id) { _bizSave(id, { about: _emVal('emAbout') }, 'About updated.'); }

/* Contact & Location */
function editBizContact(id) {
  var b = _biz(id); if (!b) return;
  var body =
    '<div class="field"><label>Street address</label><input id="emAddr" type="text" value="' + escAttr(b.address || '') + '"></div>' +
    '<div class="two-col"><div class="field"><label>City</label><input id="emCity" type="text" value="' + escAttr(b.city || '') + '"></div>' +
      '<div class="field"><label>Zip</label><input id="emZip" type="text" value="' + escAttr(b.zip || '') + '"></div></div>' +
    '<div class="two-col"><div class="field"><label>Phone</label><input id="emPhone" type="tel" value="' + escAttr(b.phone || '') + '"></div>' +
      '<div class="field"><label>Website</label><input id="emWeb" type="text" value="' + escAttr(b.website || '') + '"></div></div>' +
    '<div class="field"><label>Public contact email <span class="form-note">(used for Reach Out)</span></label><input id="emCEmail" type="email" value="' + escAttr(b.contact_email || '') + '"></div>';
  _emOpen('Edit Contact & Location', body, 'saveBizContact(\'' + id + '\')');
}
function saveBizContact(id) {
  if (!_emVal('emCity') || !_emVal('emZip')) return _emErr('City and zip are required.');
  if (!_emVal('emPhone')) return _emErr('A phone number is required.');
  var web = _emVal('emWeb'), ce = _emVal('emCEmail').toLowerCase();
  if (web && !(typeof isValidLink === 'function' ? isValidLink(web) : /\./.test(web))) return _emErr('Please enter a valid website URL (e.g. example.com) or leave it blank.');
  if (!(typeof isValidEmail === 'function' ? isValidEmail(ce) : /@/.test(ce))) return _emErr('Enter a valid public contact email.');
  _bizSave(id, { address: _emVal('emAddr'), city: _emVal('emCity'), zip: _emVal('emZip'), phone: _emVal('emPhone'), website: web || null, contact_email: ce }, 'Contact updated.');
}
/* Delete the whole deal (with confirm) */
function deleteBizPerk(id) {
  var b = _biz(id); if (!b) return;
  openConfirm('Delete this deal?', 'The student perk / offer will be removed from your page.', svgIcon('trash', 26), function () {
    _bizSave(id, { perk_description: '', redemption_instructions: '', perk_start: null, perk_end: null, deal_hidden: false }, 'Deal deleted.');
  });
}

/* Hours */
function editBizHours(id) {
  var b = _biz(id); if (!b) return; var h = b.hours || {};
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var rows = days.map(function (d) {
    var val = (h[d] || '').trim(), closed = !val || /closed/i.test(val);
    var p = val.split('-'), o = _snapSlot((p[0] || '').trim()), c = _snapSlot((p[1] || '').trim());
    return '<div class="hours-edit2"><span class="hd">' + d + '</span>' +
      '<label class="hcl-lbl"><input type="checkbox" class="hcl" data-d="' + d + '"' + (closed ? ' checked' : '') + ' onchange="emHoursToggle(this)"> Closed</label>' +
      '<select class="hopen" data-d="' + d + '"' + (closed ? ' disabled' : '') + '>' + _timeOpts(o || '9:00 AM') + '</select>' +
      '<span class="hto">to</span>' +
      '<select class="hclose" data-d="' + d + '"' + (closed ? ' disabled' : '') + '>' + _timeOpts(c || '5:00 PM') + '</select></div>';
  }).join('');
  _emOpen('Edit Hours', '<div class="hours-editor2">' + rows + '</div><p class="form-note" style="margin-top:8px">Times are Pacific. A closing time earlier than the opening time means you’re open past midnight.</p>', 'saveBizHours(\'' + id + '\')');
}
function emHoursToggle(cb) {
  var d = cb.getAttribute('data-d'), closed = cb.checked;
  var o = document.querySelector('.hopen[data-d="' + d + '"]'), c = document.querySelector('.hclose[data-d="' + d + '"]');
  if (o) o.disabled = closed; if (c) c.disabled = closed;
}
function saveBizHours(id) {
  var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], hours = {};
  days.forEach(function (d) {
    var cb = document.querySelector('.hcl[data-d="' + d + '"]');
    if (cb && cb.checked) { hours[d] = 'Closed'; return; }
    var o = document.querySelector('.hopen[data-d="' + d + '"]'), c = document.querySelector('.hclose[data-d="' + d + '"]');
    if (o && c) hours[d] = o.value + ' - ' + c.value;
  });
  var bad = days.filter(function (d) { return hours[d] && hours[d] !== 'Closed' && hours[d].split(' - ')[0] === hours[d].split(' - ')[1]; });
  if (bad.length) return _emErr(bad.join(', ') + ': opening and closing time are the same. Pick different times, or mark the day Closed.');
  _bizSave(id, { hours: hours }, 'Hours updated.');
}

/* Links */
function editBizLinks(id) {
  var b = _biz(id); if (!b) return;
  var rows = ((b.links && b.links.length) ? b.links : ['']).map(_emLinkRow).join('');
  _emOpen('Edit Links', '<div id="emLinks">' + rows + '</div><button class="btn ghost sm-btn" type="button" onclick="emAddLink()">+ Add Link</button>', 'saveBizLinks(\'' + id + '\')');
}
function saveBizLinks(id) { _bizSave(id, { links: _emCollectLinks() }, 'Links updated.'); }

/* Gallery (add + delete, re-renders itself) */
var _emBizGallery = null;
function editBizGallery(id) {
  var b = _biz(id); if (!b) return;
  var g = (b.gallery || []);
  var cells = g.length ? g.map(function (src, i) {
    var vid = isVideoSrc(src);
    return '<div class="biz-photo" style="' + (vid ? 'background:#0a222d' : 'background-image:url(' + escAttr(src) + ')') + '">' + (vid ? '<span>▶</span>' : '') + '<button class="mini-x" onclick="emBizGalleryRemove(\'' + id + '\',' + i + ')">✕</button></div>';
  }).join('') : '<p class="form-note" style="grid-column:1/-1">No gallery media yet.</p>';
  _emOpen('Edit Gallery', '<div class="biz-photostrip" style="margin-bottom:12px">' + cells + '</div>' +
    '<label class="uploader"><input type="file" accept="image/*,video/mp4,video/webm" multiple hidden onchange="emBizGalleryUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Add photos &amp; videos</label>', '');
}
/* Save a new gallery list, then refresh both the editor and the page behind it. */
function _bizSaveGallery(id, g) {
  var b = _biz(id); if (!b) return Promise.resolve();
  return sbUpdateBusiness(id, { gallery: g }).then(function (rows) {
    var up = (rows && rows[0]) || null;
    if (up) { if (currentBiz && currentBiz.id === id) currentBiz = up; _bizOwned[id] = up; if (typeof _rememberBiz === 'function') _rememberBiz(up); } else b.gallery = g;
    _bizCache = null; editBizGallery(id);
    if (currentBiz && currentBiz.id === id) renderBusinessPage(currentBiz);
  });
}
function emBizGalleryUpload(id, e) {
  var b = _biz(id); if (!b) return;
  var files = Array.prototype.slice.call(e.target.files); e.target.value = ''; if (!files.length) return;
  toast('Uploading ' + files.length + (files.length === 1 ? ' file…' : ' files…'));
  // Upload one at a time, then save the whole batch once — parallel saves used to overwrite each other.
  var added = [];
  files.reduce(function (p, f) {
    return p.then(function () { return sbUploadMedia(f, true).then(function (u) { added.push(u); }).catch(function (ex) { toast(ex.message); }); });
  }, Promise.resolve()).then(function () {
    var cur = _biz(id); if (!added.length || !cur) return;
    return _bizSaveGallery(id, (cur.gallery || []).concat(added)).then(function () { toast('Gallery updated.'); });
  }).catch(function (ex) { toast(ex.message); });
}
function emBizGalleryRemove(id, i) {
  var b = _biz(id); if (!b) return;
  var g = (b.gallery || []).slice(); g.splice(i, 1);
  _bizSaveGallery(id, g).catch(function (ex) { toast(ex.message); });
}
