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
function _clubCats() { return (typeof CATEGORIES !== 'undefined' ? CATEGORIES : []).map(function (x) { return typeof x === 'string' ? x : (x.name || x.label || x.id || ''); }).filter(function (x) { return x && x !== 'Other'; }); }
/* Category <select> + its "Other" box (a custom category shows as Other with the text filled in). */
function _catSelectHTML(id, list, sel) {
  var custom = isCustomChoice(sel, list);
  return '<select id="' + id + '" class="select block-select" onchange="toggleOtherBox(this,\'' + id + 'Other\')">' +
    list.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + escHtml(x) + '</option>'; }).join('') +
    '<option value="Other"' + (custom || sel === 'Other' ? ' selected' : '') + '>Other (type your own)</option></select>' +
    otherBoxHTML(id + 'Other', custom || sel === 'Other', custom ? sel : '', 'Type your own category (30 characters max)');
}
function _clubSave(id, msg) { saveUserClubs(getClub(id)); closeReach(); if (typeof applyFilters === 'function') applyFilters(); if (typeof renderTopClubs === 'function') renderTopClubs(); renderClub(); if (msg) toast(msg); }

/* Banner gear → page settings popup */
var _emClubBanner;
function editClubBanner(id) {
  var c = _club(id); if (!c) return;
  _emClubBanner = undefined;
  var body =
    '<div class="field"><label>Club name</label><input id="emTitle" type="text" value="' + escAttr(c.name) + '"></div>' +
    '<div class="field"><label>Club type</label>' + _catSelectHTML('emCat', _clubCats(), c.category) + '</div>' +
    '<div class="field"><label>Banner image</label><div id="emBannerPrev"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" hidden onchange="emClubBannerUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Upload banner image</label></div>' +
    _toggleRow('emPrivate', 'Private club', 'Hidden from public Browse unless someone has your link.', c.recruitment === 'Private') +
    // Partnerships are the President's call (they send and approve them), so only they see this switch.
    (ownerOf(c) ? _toggleRow('emPartner', 'Open to partnerships', 'Shows an “Open to partnerships” badge on your banner.', !!c.partnershipOpen) : '') +
    (ownerOf(c) ? _verifyRowHTML(c.verified, 'club', id) +
      '<div class="danger-zone"><div class="tr-title">President only</div>' +
        '<button type="button" class="btn ghost" onclick="closeReach();leaveClubFlow(\'' + id + '\')">Hand off presidency &amp; leave</button>' +
        '<button type="button" class="btn danger" onclick="closeReach();deleteClub(\'' + id + '\')">Delete club</button></div>' : '');
  _emOpen('Page settings', body, 'saveClubBanner(\'' + id + '\')');
  emPaintClubBanner(id);
}
/* Verification: owners REQUEST the gold seal; an admin confirms it's the official club/business and
   approves it on the Admin page. (The database refuses any other way of setting it.) */
function _verifyRowHTML(isVerified, kind, id) {
  if (isVerified) return '<div class="verify-row done">' + verifiedSeal(18, '#e6b422', '#ffffff') +
    '<span>This ' + kind + ' is verified.</span></div>';
  setTimeout(function () { _paintVerifyRow(kind, id); }, 0);
  return '<div class="verify-row" id="verifyRow"><div class="form-note">Checking verification status…</div></div>';
}
function _paintVerifyRow(kind, id) {
  sbRest('verification_requests?kind=eq.' + kind + '&entity_id=eq.' + encodeURIComponent(id) + '&select=status,created_at&order=created_at.desc&limit=1').then(function (rows) {
    var el = $('verifyRow'); if (!el) return;
    var r = rows && rows[0];
    if (r && r.status === 'pending') {
      el.innerHTML = '<div><div class="tr-title">Verification requested</div><div class="form-note">Sent ' + escHtml(_fmtAgrDate(String(r.created_at).slice(0, 10))) +
        '. An admin will review it and add the gold seal once it’s confirmed.</div></div>';
      return;
    }
    var note = (r && r.status === 'rejected') ? 'Your last request wasn’t approved. You can send a new one with more detail.'
      : 'Ask for the gold Verified seal. An admin first checks that this is the official ' + kind + '.';
    el.innerHTML = '<div class="verify-copy"><div class="tr-title">Get verified</div><div class="form-note">' + note + '</div></div>' +
      '<button type="button" class="btn primary sm-btn" onclick="openVerifyForm(\'' + kind + '\',\'' + jsArg(id) + '\')">Request</button>';
  }).catch(function () { var el = $('verifyRow'); if (el) el.innerHTML = '<div class="form-note">Couldn’t load verification status.</div>'; });
}

/* ---------- Verification questionnaire ----------
   Opens over Page settings. The top switch picks Club or Business (like the profile types), then
   which of your unverified listings. Every answer gives the admin something they can check on
   their own: clubs → the faculty advisor's school email + the school office's phone;
   businesses → the publicly listed phone/address and the website or online listing.
   The database refuses a request with a missing answer (trg_verification_guard). */
var _vf = null;   // { kind, id, from: {kind,id}, clubs: [], biz: [], vals: {} }
function openVerifyForm(kind, id) {
  _vf = { kind: kind, id: id, from: { kind: kind, id: id }, clubs: [], biz: [], vals: {} };
  _vf.clubs = (typeof CLUBS !== 'undefined' ? CLUBS : []).filter(function (c) { return ownerOf(c) && !c.verified && !isSampleClub(c); });
  $('bizBody').innerHTML = '<div class="modal-pad edit-modal"><p class="form-note" style="text-align:center;padding:30px">Loading…</p></div>';
  refreshMyBizIds().then(function (ids) {
    return ids.length ? sbRest('businesses?id=in.(' + ids.map(encodeURIComponent).join(',') + ')&select=' + BIZ_SELECT) : [];
  }).then(function (rows) {
    _vf.biz = (rows || []).filter(function (b) { return !b.verified && !b.is_sample; });
  }).catch(function () {}).then(_paintVerifyForm);
}
function _vfList(kind) { return kind === 'club' ? _vf.clubs : _vf.biz; }
function _vfItem() { return _vfList(_vf.kind).find(function (x) { return String(x.id) === String(_vf.id); }); }
/* Keep what's typed when switching type/listing; a value you never typed falls back to the listing's own. */
function _vfKeep() {
  document.querySelectorAll('#vfForm [data-vf]').forEach(function (i) { _vf.vals[i.getAttribute('data-vf')] = i.type === 'checkbox' ? i.checked : i.value; });
}
function _vfIn(key, label, type, ph, preset, opts) {
  opts = opts || {};
  var v = Object.prototype.hasOwnProperty.call(_vf.vals, key) ? _vf.vals[key] : (preset || '');
  return '<div class="field' + (opts.wide ? ' vf-wide' : '') + '"><label>' + escHtml(label) + (opts.optional ? ' <span class="form-note">(optional)</span>' : ' *') + '</label>' +
    '<input data-vf="' + key + '" type="' + type + '" maxlength="' + (opts.max || 120) + '" placeholder="' + escAttr(ph || '') + '" value="' + escAttr(v) + '">' +
    (opts.hint ? '<p class="form-note">' + escHtml(opts.hint) + '</p>' : '') + '</div>';
}
function _vfSelect(key, label, options, preset) {
  var v = Object.prototype.hasOwnProperty.call(_vf.vals, key) ? _vf.vals[key] : (preset || '');
  return '<div class="field vf-wide"><label>' + escHtml(label) + ' *</label><select data-vf="' + key + '" class="select block-select">' +
    '<option value="">Select…</option>' + options.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + escHtml(o) + '</option>'; }).join('') + '</select></div>';
}
var VF_STANDING = ['Officially approved by the school', 'Waiting for school approval', 'Not affiliated with a school'];
var VF_ROLES = ['Owner', 'Co-owner', 'Manager', 'Authorized employee'];
function _paintVerifyForm() {
  if (!_vf) return;
  var item = _vfItem();
  if (!item) { var first = _vfList(_vf.kind)[0]; _vf.id = first ? String(first.id) : ''; item = first; }
  var u = currentUser || {};
  var typeCard = function (k, icon, title, sub) {
    var n = _vfList(k).length, on = _vf.kind === k;
    return '<button type="button" class="pt-option' + (on ? ' on' : '') + '"' + (n ? '' : ' disabled') + ' onclick="vfType(\'' + k + '\')">' +
      '<span class="pt-ico">' + svgIcon(icon, 20) + '</span><span class="pt-txt"><strong>' + title + '</strong><small>' +
      (n ? sub : 'You don’t have an unverified ' + k + ' to verify.') + '</small></span></button>';
  };
  var list = _vfList(_vf.kind);
  var pick = '<div class="field vf-wide"><label>Which ' + _vf.kind + '? *</label><select class="select block-select" onchange="vfPick(this.value)">' +
    list.map(function (x) { return '<option value="' + escAttr(x.id) + '"' + (String(x.id) === String(_vf.id) ? ' selected' : '') + '>' + escHtml(x.name) + '</option>'; }).join('') + '</select></div>';
  var you = '<h4 class="vf-sec">About you</h4><div class="vf-grid">' +
    _vfIn('fullName', 'Your full name', 'text', 'First and last name', u.name) +
    (_vf.kind === 'business' ? _vfSelect('role', 'Your role at the business', VF_ROLES) : '<div class="field"><label>Your role</label><input type="text" value="President" disabled></div>') +
    _vfIn('email', 'Contact email', 'email', 'you@example.com', u.email, { hint: 'We’ll only use this if we have questions about your request.' }) +
    (_vf.kind === 'business' ? _vfIn('phone', 'Your phone number', 'tel', '(310) 555-0123', '', { max: 30 }) : '') + '</div>';
  var body;
  if (!item) body = '<p class="form-note">Everything you run is already verified (or waiting for review).</p>';
  else if (_vf.kind === 'club') body = you +
    '<h4 class="vf-sec">Your school</h4><div class="vf-grid">' +
      _vfIn('school', 'School name', 'text', 'e.g. Palos Verdes High School', item.school, { wide: true }) +
      _vfIn('schoolCity', 'School city', 'text', 'e.g. Palos Verdes Estates', '') +
      _vfIn('schoolPhone', 'School main office phone', 'tel', '(310) 555-0100', '', { max: 30, hint: 'So we can confirm your advisor works there.' }) +
      _vfSelect('standing', 'Is the club recognized by your school?', VF_STANDING) + '</div>' +
    '<h4 class="vf-sec">Faculty advisor</h4><p class="form-note vf-lead">A teacher or staff member who sponsors the club. We may email them to confirm it’s real.</p><div class="vf-grid">' +
      _vfIn('advisorName', 'Advisor’s full name', 'text', 'e.g. Ms. Rivera') +
      _vfIn('advisorEmail', 'Advisor’s school email', 'email', 'name@school.org', '', { hint: 'Use their school address, not a personal one.' }) +
      _vfIn('link', 'Link showing the club', 'url', 'School website page, club Instagram…', '', { optional: true, wide: true, max: 300 }) + '</div>';
  else body = you +
    '<h4 class="vf-sec">The business</h4><p class="form-note vf-lead">We check these against public sources (like Google Maps) and may call the business to confirm.</p><div class="vf-grid">' +
      _vfIn('address', 'Street address', 'text', '123 Main St', item.address, { wide: true }) +
      _vfIn('city', 'City', 'text', 'Palos Verdes', item.city) +
      _vfIn('zip', 'Zip code', 'text', '90274', item.zip, { max: 10 }) +
      _vfIn('bizPhone', 'Business phone (as listed publicly)', 'tel', '(310) 555-0123', item.phone, { max: 30 }) +
      _vfIn('website', 'Website', 'url', 'https://…', item.website, { optional: true, max: 300 }) +
      _vfIn('listing', 'Google Maps, Yelp, or social media page', 'url', 'https://…', '', { optional: true, wide: true, max: 300 }) + '</div>';
  var attest = Object.prototype.hasOwnProperty.call(_vf.vals, 'attest') ? _vf.vals.attest : false;
  var tail = item ?
    '<h4 class="vf-sec">Anything else?</h4><div class="field"><textarea data-vf="extra" maxlength="500" placeholder="Optional: anything that helps us confirm it.">' +
      escHtml(_vf.vals.extra || '') + '</textarea></div>' +
    '<label class="vf-attest"><input type="checkbox" data-vf="attest"' + (attest ? ' checked' : '') + '><span>' +
      (_vf.kind === 'club' ? 'I’m the President of this club, the information above is true, and Student Club Hub may contact my advisor to confirm it.'
        : 'I’m allowed to represent this business, the information above is true, and Student Club Hub may contact the business to confirm it.') + ' *</span></label>' +
    '<div class="modal-actions"><button type="button" class="btn ghost" onclick="closeVerifyForm()">Cancel</button>' +
      '<button type="button" id="vfSubmit" class="btn primary" onclick="submitVerification()">Submit for review</button></div>'
    : '<div class="modal-actions"><button type="button" class="btn ghost" onclick="closeVerifyForm()">Back</button></div>';
  $('bizBody').innerHTML = '<div class="modal-pad edit-modal" id="vfForm"><div class="ro-head"><h3>Request verification</h3>' +
      '<button class="icon-btn" onclick="closeVerifyForm()">✕</button></div>' +
    '<p class="form-note vf-lead">An admin checks your answers before adding the gold Verified seal. Only admins see this form, and we use it only to confirm the listing. Fields marked * are required.</p>' +
    '<div id="emErr" class="auth-error hidden"></div>' +
    '<h4 class="vf-sec">What are you verifying?</h4>' +
    '<div class="pt-switch vf-types">' + typeCard('club', 'book', 'Student club', 'Confirmed through your school and faculty advisor') +
      typeCard('business', 'store', 'Local business', 'Confirmed through your public business info') + '</div>' +
    (list.length ? pick : '') + body + tail + '</div>';
  openOverlay('bizOverlay');
  if ($('vfForm')) $('vfForm').scrollTop = 0;
}
function vfType(k) { if (!_vf || _vf.kind === k) return; _vfKeep(); ['role', 'phone', 'school', 'address', 'city', 'zip', 'bizPhone', 'website', 'attest'].forEach(function (x) { delete _vf.vals[x]; }); _vf.kind = k; _vf.id = ''; _paintVerifyForm(); }
function vfPick(id) { _vfKeep(); ['school', 'address', 'city', 'zip', 'bizPhone', 'website'].forEach(function (x) { delete _vf.vals[x]; }); _vf.id = id; _paintVerifyForm(); }
/* Back to the Page settings you came from */
function closeVerifyForm() {
  var from = _vf && _vf.from; _vf = null;
  if (from && from.kind === 'club' && getClub(from.id)) editClubBanner(from.id);
  else if (from && from.kind === 'business' && _biz(from.id)) editBizBanner(from.id);
  else closeReach();
}
function _vfDigits(s) { return String(s || '').replace(/\D/g, '').length; }
function _vfUrlOk(s) { return !s || /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(s); }
function submitVerification() {
  if (!_vf || !currentUser) return;
  _vfKeep();
  var v = _vf.vals, kind = _vf.kind, item = _vfItem(); if (!item) return;
  var g = function (k) { return String(v[k] == null ? '' : v[k]).trim(); };
  var need = kind === 'club' ? ['fullName', 'email', 'school', 'schoolCity', 'schoolPhone', 'standing', 'advisorName', 'advisorEmail']
    : ['fullName', 'role', 'email', 'phone', 'address', 'city', 'zip', 'bizPhone'];
  document.querySelectorAll('#vfForm .vf-missing').forEach(function (x) { x.classList.remove('vf-missing'); });
  var missing = need.filter(function (k) { return !g(k); });
  missing.forEach(function (k) { var i = document.querySelector('#vfForm [data-vf="' + k + '"]'); if (i) i.classList.add('vf-missing'); });
  var err = function (m) { _emErr(m); var e = $('emErr'); if (e) e.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  if (missing.length) return err('Please answer every question marked *.');
  if (!isValidEmail(g('email'))) return err('Enter a valid contact email.');
  if (kind === 'club') {
    if (_vfDigits(g('schoolPhone')) < 10) return err('Enter the school office’s full phone number.');
    if (!isValidEmail(g('advisorEmail'))) return err('Enter a valid email for your advisor.');
    if ([g('email').toLowerCase(), currentUser.email.toLowerCase()].indexOf(g('advisorEmail').toLowerCase()) > -1) return err('Your advisor’s email must be different from your own.');
  } else {
    if (_vfDigits(g('phone')) < 10 || _vfDigits(g('bizPhone')) < 10) return err('Enter full phone numbers, including the area code.');
    if (!/^\d{5}$/.test(g('zip'))) return err('Enter a 5-digit zip code.');
    if (!_vfUrlOk(g('website')) || !_vfUrlOk(g('listing'))) return err('Check the links. They should look like https://example.com');
  }
  if (!v.attest) return err('Please check the box to confirm the information is true.');
  var keys = kind === 'club' ? need.concat(['link']) : need.concat(['website', 'listing']);
  var details = { type: kind, attest: true };
  keys.forEach(function (k) { if (g(k)) details[k] = g(k); });
  authBusy2('vfSubmit', true, 'Submitting…');
  sbRest('verification_requests', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
    kind: kind, entity_id: String(item.id), entity_name: item.name || '', requester_id: currentUser.memberId,
    requester_email: currentUser.email.toLowerCase(), note: g('extra'), details: details }) })
    .then(function () { toast('Verification requested. An admin will review it.'); _vf.from = { kind: kind, id: String(item.id) }; closeVerifyForm(); })
    .catch(function (ex) {
      authBusy2('vfSubmit', false);
      err(/duplicate|unique/i.test(ex.message) ? 'There’s already a request waiting for review for this ' + kind + '.' : ex.message);
    });
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
  if ($('emCat')) c.category = pickOrOther('emCat', 'emCatOther') || c.category;
  c.recruitment = ($('emPrivate') && $('emPrivate').checked) ? 'Private' : 'Public';
  if ($('emPartner')) c.partnershipOpen = !!$('emPartner').checked;   // officers don't see the switch: leave it as is
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
  if (email) c.email = email;
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
  var body =
    '<div class="field"><label>Business name</label><input id="emTitle" type="text" value="' + escAttr(b.name) + '"></div>' +
    '<div class="field"><label>Category / type</label>' + _catSelectHTML('emCat', BIZ_CATEGORIES, b.category) + '</div>' +
    '<div class="field"><label>Card banner <span class="form-note">(Browse thumbnail)</span></label><div id="emBizBannerPrev"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" hidden onchange="emBizBannerUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Upload banner</label></div>' +
    '<div class="field"><label>Slideshow photos <span class="form-note">(top of your profile — up to 10)</span></label><div id="emBizPhotos" class="biz-photostrip"></div>' +
      '<label class="uploader"><input type="file" accept="image/*" multiple hidden onchange="emBizPhotosUpload(\'' + id + '\',event)"><span class="up-ico">' + svgIcon('upload', 16) + '</span> Add slideshow photos</label></div>' +
    _toggleRow('emPrivate', 'Private listing', 'Hidden from public Browse unless someone has your link.', !!b.is_private) +
    _toggleRow('emPartner', 'Open to partnerships', 'Shows an “Open to partnerships” badge on your banner.', !!b.partnership_open) +
    _verifyRowHTML(b.verified, 'business', id) +
    '<div class="danger-zone"><div class="tr-title">Remove listing</div>' +
      '<button type="button" class="btn danger" onclick="deleteBusiness(\'' + id + '\')">Delete business</button></div>';
  _emOpen('Page settings', body, 'saveBizBanner(\'' + id + '\')');
  emPaintBizBanner(id); emPaintBizPhotos(id);
}
/* Remove the listing for good (its reviews go with it; live partnerships end). */
function deleteBusiness(id) {
  var b = _biz(id); if (!b) return;
  closeReach();
  openConfirm('Delete “' + b.name + '”?', 'This permanently removes your business page, its deal, and its reviews. This can’t be undone.', svgIcon('warning', 26), function () {
    var q = encodeURIComponent(id);
    sbRest('partner_agreements?or=(and(a_type.eq.business,a_id.eq.' + q + '),and(b_type.eq.business,b_id.eq.' + q + '))&status=in.(pending,launched)',
      { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) }).catch(function () {});
    sbRest('businesses?id=eq.' + q + '&select=id', { method: 'DELETE', headers: { Prefer: 'return=representation' } }).then(function (rows) {
      if (!rows || !rows.length) throw new Error('Couldn’t delete this business. Try again.');
      delete _bizOwned[id]; if (typeof _bizExtra !== 'undefined') delete _bizExtra[id]; _bizCache = null; currentBiz = null; refreshMyBizIds();
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
function emBizBannerUpload(id, e) { var f = e.target.files[0]; e.target.value = ''; if (!f) return; toast('Uploading…'); sbUploadMedia(f, false, id).then(function (u) { _emBizBanner = u; emPaintBizBanner(id); }).catch(function (ex) { toast(ex.message); }); }
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
    return p.then(function () { return sbUploadMedia(f, false, id).then(function (u) { _emBizPhotos.push(u); emPaintBizPhotos(id); }).catch(function (ex) { toast(ex.message); }); });
  }, Promise.resolve());
}
function emBizPhotoRemove(id, i) { _emBizPhotos.splice(i, 1); emPaintBizPhotos(id); }
function _bizBannerPatch(id) {
  var b = _biz(id) || {};
  var patch = { name: _emVal('emTitle') || b.name, category: ($('emCat') && pickOrOther('emCat', 'emCatOther')) || b.category,
    is_private: !!($('emPrivate') && $('emPrivate').checked), partnership_open: !!($('emPartner') && $('emPartner').checked), photos: _emBizPhotos || [] };
  if (_emBizBanner !== undefined) patch.banner = _emBizBanner || null;
  return patch;
}
function saveBizBanner(id) {
  if (!_biz(id)) return;
  if (!_emVal('emTitle')) return _emErr('Business name can’t be empty.');
  _bizSave(id, _bizBannerPatch(id), 'Page settings saved.');
}

/* Promotions (a business's own deals; up to 3 at once). Everything is required except "How to redeem". */
function editPromotion(bizId, promoId) {
  var b = _biz(bizId); if (!b) return;
  var p = promoId ? (typeof _findPromo === 'function' ? _findPromo(promoId) : null) : null;
  if (!p && openPromos(bizId).length >= PROMO_LIMIT) { toast('You’re running ' + PROMO_LIMIT + ' promotions, the most at once. Delete one or let it end first.'); return; }
  p = p || { kind: 'discount', audience: 'student', starts: _todayStr(), ends: '' };
  var kinds = PROMO_KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (k[0] === p.kind ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('');
  var body =
    '<div class="field"><label>Deal type *</label><select id="emKind" class="select block-select" onchange="var o=$(\'emKindOtherWrap\');if(o)o.hidden=this.value!==\'other\'">' + kinds + '</select></div>' +
    '<div class="field" id="emKindOtherWrap"' + (p.kind === 'other' ? '' : ' hidden') + '><label>Name the deal type *</label><input id="emKindOther" type="text" maxlength="30" placeholder="e.g. Happy hour, Loyalty card" value="' + escAttr(p.kind_other || '') + '"></div>' +
    '<div class="field"><label>Who it’s for *</label><select id="emAud" class="select block-select">' +
      '<option value="student"' + (p.audience !== 'everyone' ? ' selected' : '') + '>Students only</option>' +
      '<option value="everyone"' + (p.audience === 'everyone' ? ' selected' : '') + '>Everyone</option></select></div>' +
    '<div class="field"><label>The deal *</label><textarea id="emPromo" maxlength="400" placeholder="e.g. 15% off any drink">' + escHtml(p.description || '') + '</textarea></div>' +
    '<div class="field"><label>How to redeem it <span class="form-note">(optional)</span></label><textarea id="emRedeem" maxlength="300" placeholder="e.g. Show your student ID, or use code HI at checkout.">' + escHtml(p.redemption || '') + '</textarea></div>' +
    '<div class="two-col"><div class="field"><label>Starts *</label><input id="emStart" type="date" value="' + escAttr(p.starts || '') + '"></div>' +
      '<div class="field"><label>Ends *</label><input id="emEnd" type="date" min="' + _todayStr() + '" value="' + escAttr(p.ends || '') + '"></div></div>';
  _emOpen(promoId ? 'Edit promotion' : 'Add a promotion', body, 'savePromotion(\'' + bizId + '\',\'' + (promoId || '') + '\')', promoId ? 'Save changes' : 'Add promotion');
}
function savePromotion(bizId, promoId) {
  if (!_biz(bizId)) return;
  var kind = _emVal('emKind') || 'discount', other = _emVal('emKindOther'), desc = _emVal('emPromo'), s = _emVal('emStart'), en = _emVal('emEnd');
  if (kind === 'other' && !other) return _emErr('Name the deal type.');
  if (!desc) return _emErr('Describe the deal.');
  if (!s || !en) return _emErr('Set a start and an end date.');
  if (en < s) return _emErr('The end date can’t be before the start date.');
  if (!promoId && en < _todayStr()) return _emErr('The end date can’t be in the past.');
  var row = { kind: kind, kind_other: kind === 'other' ? other : null, audience: _emVal('emAud') === 'everyone' ? 'everyone' : 'student',
    description: desc, redemption: _emVal('emRedeem') || null, starts: s, ends: en };
  authBusy2('emSave', true, 'Saving…');
  var req = promoId
    ? sbRest('business_promotions?id=eq.' + encodeURIComponent(promoId), { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
    : (row.business_id = bizId, sbRest('business_promotions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) }));
  req.then(function (rows) {
    if (!rows || !rows.length) throw new Error('Couldn’t save. Only the owner can change this business’s promotions.');
    closeReach(); toast(promoId ? 'Promotion updated.' : 'Promotion added.'); return loadPromotions();
  }).catch(function (ex) { authBusy2('emSave', false); _emErr(ex.message); });
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
    return p.then(function () { return sbUploadMedia(f, true, id).then(function (u) { added.push(u); }).catch(function (ex) { toast(ex.message); }); });
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
