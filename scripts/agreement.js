/* ============================================================
   agreement.js — Stage 2: the collaborative partnership agreement form.
   Two identical halves (A = proposer/top, B = target/bottom). Each party
   edits only their own half and sees the other's live (3s poll). Confirm
   (with account password) locks a side; when BOTH confirm and every check
   passes (dates identical, deal word-for-word, IDs real + cross-matched),
   both Launch to make it live. Backed by the partner_agreements table.
   ============================================================ */

var _agr = null, _agrPollTimer = null, _agrSaveTimer = null;
var AGR_CLAUSE = 'I confirm that I’m authorized to represent this club/business, that the ID and details I entered are accurate, and that I agree to honor the partnership terms, discount, or code exactly as written — for the full duration of this partnership, from the start date until the end date or until either party ends it. I understand Student Club Hub only facilitates this introduction and is not a party to, and bears no responsibility for, this agreement or how it is carried out.';

function _agrMySide(a) {
  var me = currentUser ? currentUser.email.toLowerCase() : '';
  if (a.a_owner_email && a.a_owner_email.toLowerCase() === me) return 'a';
  if (a.b_owner_email && a.b_owner_email.toLowerCase() === me) return 'b';
  return null;
}
function _up(id, patch) { return sbRest('partner_agreements?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) }); }

/* ---- Open / poll / close ---- */
function openAgreementForm(agreementId) {
  sbRest('partner_agreements?id=eq.' + agreementId + '&select=*').then(function (rows) {
    var a = rows && rows[0]; if (!a) { toast('This agreement no longer exists.'); return; }
    if (a.status === 'deleted') { toast('This agreement was deleted.'); return; }
    _agr = a; renderAgreementForm(); openOverlay('agreementOverlay'); _startAgrPoll();
  }).catch(function (ex) { toast(ex.message); });
}
function closeAgreementForm() { if (_agrPollTimer) { clearInterval(_agrPollTimer); _agrPollTimer = null; } closeOverlay('agreementOverlay'); }
function _startAgrPoll() {
  if (_agrPollTimer) clearInterval(_agrPollTimer);
  _agrPollTimer = setInterval(function () {
    var ov = $('agreementOverlay');
    if (!_agr || !ov || ov.classList.contains('hidden')) { clearInterval(_agrPollTimer); _agrPollTimer = null; return; }
    sbRest('partner_agreements?id=eq.' + _agr.id + '&select=*').then(function (rows) {
      var a = rows && rows[0];
      if (!a || a.status === 'deleted') { toast('This agreement was deleted.'); closeAgreementForm(); return; }
      _agr = a;
      var ae = document.activeElement;                      // don't yank focus while the user is typing
      if (ae && ae.closest && ae.closest('#agreementBody') && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) return;
      renderAgreementForm();
    }).catch(function () {});
  }, 3000);
}

/* ---- Field edits (debounced) ---- */
var _agrPending = {};
function agrField(side, f, value) {
  if (!_agr || _agrMySide(_agr) !== side || _agr[side + '_confirmed']) return;
  var col = side + '_' + f; _agr[col] = value;
  _agrPending[col] = (typeof value === 'string' && value === '') ? null : value;
  clearTimeout(_agrSaveTimer);
  _agrSaveTimer = setTimeout(_agrFlush, 500);
}
function _agrFlush() {
  if (!_agr) return Promise.resolve();
  var patch = _agrPending; _agrPending = {};
  if (!Object.keys(patch).length) return Promise.resolve();
  return _up(_agr.id, patch).catch(function () {});
}
function agrToggleHide(side) {
  if (!_agr || _agrMySide(_agr) !== side || _agr[side + '_confirmed']) return;
  var col = side + '_hidden', nv = !_agr[col]; _agr[col] = nv;
  var patch = {}; patch[col] = nv; _up(_agr.id, patch).then(renderAgreementForm).catch(function () {});
}

/* ---- Verification ---- */
function _norm(s) { return (s || '').trim().toUpperCase(); }
function _agrChecks(a) {
  var out = { datesMatch: false, dealMatch: false, idsReal: false, idsCross: false, ok: false, firstError: '' };
  out.datesMatch = !!(a.a_start && a.b_start && a.a_start === a.b_start && a.a_end && a.b_end && a.a_end === a.b_end);
  out.dealMatch = !!((a.a_deal || '').trim() && (a.a_deal || '').trim() === (a.b_deal || '').trim());
  out.idsReal = _norm(a.a_my_id) === _norm(a.a_real_id) && _norm(a.b_my_id) === _norm(a.b_real_id) && !!_norm(a.a_real_id) && !!_norm(a.b_real_id);
  out.idsCross = _norm(a.a_partner_id) === _norm(a.b_real_id) && _norm(a.b_partner_id) === _norm(a.a_real_id);
  out.ok = out.datesMatch && out.dealMatch && out.idsReal && out.idsCross && a.a_agreed && a.b_agreed;
  if (!out.datesMatch) out.firstError = 'The start/end dates on both sides don’t match yet.';
  else if (!out.dealMatch) out.firstError = 'The deal text isn’t identical on both sides yet.';
  else if (!out.idsReal) out.firstError = 'One side’s “Your ID” doesn’t match their real club/shop ID.';
  else if (!out.idsCross) out.firstError = 'The IDs don’t line up — each side must enter the other’s real ID as the partner.';
  return out;
}
function _agrValidateMine(a, side) {
  var p = side + '_';
  if (!a[p + 'start'] || !a[p + 'end']) return 'Set both a start and an end date.';
  if (a[p + 'end'] < a[p + 'start']) return 'The end date must be on or after the start date.';
  if (!(a[p + 'my_id'] || '').trim()) return 'Enter your club/shop ID.';
  if (_norm(a[p + 'my_id']) !== _norm(a[p + 'real_id'])) return 'That ID doesn’t match your club/shop’s real ID. Double-check and enter your own ID exactly.';
  if (!(a[p + 'partner_id'] || '').trim()) return 'Enter your partner’s ID.';
  if (!(a[p + 'deal'] || '').trim()) return 'Describe the deal / discount / code.';
  if (!a[p + 'agreed']) return 'Tick the agreement checkbox.';
  return null;
}

/* ---- Render ---- */
function renderAgreementForm() {
  var a = _agr, el = $('agreementBody'); if (!a || !el) return;
  var mySide = _agrMySide(a);
  if (a.status === 'ended') {
    el.innerHTML = _agrHeadHTML(a, 'ended') + '<div class="agr-scroll"><p class="form-note" style="text-align:center;padding:30px">This partnership has ended.</p>' +
      _agrHalfHTML(a, 'a', mySide) + '<div class="agr-vs">×</div>' + _agrHalfHTML(a, 'b', mySide) + '</div>';
    return;
  }
  var launched = a.status === 'launched';
  var checks = _agrChecks(a);
  el.innerHTML = _agrHeadHTML(a, launched ? 'launched' : '') +
    '<div class="agr-scroll">' +
      _agrHalfHTML(a, 'a', mySide) + '<div class="agr-vs">×</div>' + _agrHalfHTML(a, 'b', mySide) +
      (!launched ? (a.a_confirmed && a.b_confirmed ? _agrChecksHTML(checks) : '<p class="agr-note-mid">Each side fills their half and hits <strong>Confirm</strong> (with your password) to lock it. Once both are locked and everything matches, you both <strong>Launch</strong> to go live.</p>') : '') +
    '</div>' +
    '<div class="agr-footer" id="agrFooter">' + _agrFooterHTML(a, mySide, checks, launched) + '</div>';
}
function _agrHeadHTML(a, mode) {
  return '<div class="agr-head' + (mode ? ' ' + mode : '') + '"><button class="agr-x icon-btn" title="Close (the form stays in your chat)" onclick="closeAgreementForm()">✕</button>' +
    '<div class="agr-title"><span class="agr-doc-ico">📄</span><h2>Partnership Agreement</h2>' +
    (mode === 'launched' ? '<span class="agr-live">✓ LIVE</span>' : (mode === 'ended' ? '<span class="agr-live ended">ENDED</span>' : '')) + '</div>' +
    '<p class="form-note">' + escHtml(a.a_name) + ' &amp; ' + escHtml(a.b_name) + '</p></div>';
}
function _agrHalfHTML(a, side, mySide) {
  var p = side + '_', mine = side === mySide, confirmed = a[p + 'confirmed'], editable = mine && !confirmed && a.status !== 'launched';
  var v = function (f) { return a[p + f] || ''; };
  function fld(label, f, itype) {
    if (editable) return '<div class="field"><label>' + label + '</label><input type="' + itype + '" value="' + escAttr(v(f)) + '" oninput="agrField(\'' + side + '\',\'' + f + '\',this.value)"></div>';
    return '<div class="field"><label>' + label + '</label><div class="agr-ro">' + (escHtml(v(f)) || '<span class="agr-empty">—</span>') + '</div></div>';
  }
  var deal = editable
    ? '<div class="field"><label>The deal / discount / code <span class="form-note">(max 200 — must match the other side word-for-word)</span></label>' +
        '<textarea maxlength="200" oninput="agrField(\'' + side + '\',\'deal\',this.value);var c=this.parentNode.querySelector(\'.agr-count\');if(c)c.textContent=this.value.length+\'/200\'">' + escHtml(v('deal')) + '</textarea><div class="agr-count">' + v('deal').length + '/200</div></div>'
    : '<div class="field"><label>The deal / discount / code</label><div class="agr-ro">' + (escHtml(v('deal')) || '<span class="agr-empty">—</span>') + '</div></div>';
  var eye = '<button class="agr-eye' + (a[p + 'hidden'] ? ' off' : '') + '"' + (editable ? ' onclick="agrToggleHide(\'' + side + '\')"' : ' disabled') + '>' +
    (a[p + 'hidden'] ? ICON_EYE_OFF : ICON_EYE) + '<span>' + (a[p + 'hidden'] ? 'Deal hidden on your page — the “Partnered with” badge still shows' : 'Deal shown on your page') + '</span></button>';
  var agree = '<label class="agr-agree' + (editable ? '' : ' ro') + '"><input type="checkbox"' + (a[p + 'agreed'] ? ' checked' : '') + (editable ? ' onchange="agrField(\'' + side + '\',\'agreed\',this.checked)"' : ' disabled') + '><span>' + escHtml(AGR_CLAUSE) + '</span></label>';
  return '<div class="agr-half' + (mine ? ' mine' : '') + (confirmed ? ' confirmed' : '') + '">' +
    '<div class="agr-half-head"><strong>' + escHtml(a[p + 'name']) + '</strong><span class="agr-side-tag">' + (mine ? 'You' : 'Them') + ' · ' + escHtml(a[p + 'type']) + '</span>' + (confirmed ? '<span class="agr-lock">🔒 Confirmed</span>' : '') + '</div>' +
    '<div class="two-col">' + fld('Starts', 'start', 'date') + fld('Ends', 'end', 'date') + '</div>' +
    '<div class="two-col">' + fld('Your ID', 'my_id', 'text') + fld('Partner’s ID', 'partner_id', 'text') + '</div>' +
    deal + eye + agree + '</div>';
}
function _agrChecksHTML(c) {
  function row(ok, txt) { return '<div class="agr-check ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✕') + ' ' + txt + '</div>'; }
  return '<div class="agr-checks"><div class="agr-checks-h">System verification</div>' +
    row(c.datesMatch, 'Start &amp; end dates match') + row(c.dealMatch, 'Deal text matches word-for-word') +
    row(c.idsReal, 'Both IDs are the real club/shop IDs') + row(c.idsCross, 'Each side entered the other’s ID correctly') +
    (c.ok ? '<div class="agr-check ok">✓ All checks passed — ready to launch.</div>' : '<div class="agr-check no" style="margin-top:2px">' + escHtml(c.firstError) + '</div>') + '</div>';
}
function _agrFooterHTML(a, mySide, checks, launched) {
  if (!mySide) return '<p class="form-note" style="text-align:center">You’re viewing this agreement.</p>';
  if (launched) return '<button class="btn danger block" onclick="agrStop(\'' + a.id + '\')">Stop / end this partnership</button>';
  var confirmed = a[mySide + '_confirmed'];
  if (!confirmed) return '<button class="btn primary block lg" onclick="agrConfirm(\'' + mySide + '\')">Confirm &amp; sign my half</button>';
  var otherConfirmed = a[(mySide === 'a' ? 'b' : 'a') + '_confirmed'];
  var iLaunched = a[mySide + '_launched'];
  var status = !otherConfirmed ? '<p class="form-note" style="text-align:center;margin-bottom:8px">Your half is locked. Waiting for the other side to confirm…</p>'
    : (iLaunched ? '<p class="form-note" style="text-align:center;margin-bottom:8px">You’ve launched — waiting for the other side to launch too.</p>' : '');
  var launchBtn = '<button class="btn primary" ' + ((otherConfirmed && checks.ok && !iLaunched) ? 'onclick="agrLaunch(\'' + mySide + '\')"' : 'disabled') + '>🚀 Launch</button>';
  return status + '<div class="row"><button class="btn ghost" onclick="agrGoBack(\'' + mySide + '\')">‹ Go back (unlock &amp; edit)</button>' + launchBtn + '</div>';
}

/* ---- Confirm (password), go-back, launch, stop ---- */
function agrConfirm(side) {
  var a = _agr; if (!a || side !== _agrMySide(a)) return;
  var err = _agrValidateMine(a, side); if (err) { toast('⛔ ' + err); return; }
  var zone = $('agrFooter'); if (!zone) return;
  zone.innerHTML = '<div class="agr-pw"><p class="form-note">Type your account password to <strong>confirm and lock</strong> your half. After this you can’t edit it (you can still “Go back” before launch). You’ll then review and Launch.</p>' +
    '<div id="agrPwErr" class="auth-error hidden"></div>' +
    '<input id="agrPw" type="password" placeholder="Your account password" onkeydown="if(event.key===\'Enter\')agrConfirmSubmit(\'' + side + '\')">' +
    '<div class="row"><button class="btn ghost" onclick="renderAgreementForm()">Cancel</button><button class="btn primary" onclick="agrConfirmSubmit(\'' + side + '\')">Confirm &amp; lock</button></div></div>';
  setTimeout(function () { if ($('agrPw')) $('agrPw').focus(); }, 40);
}
function agrConfirmSubmit(side) {
  var pw = ($('agrPw') && $('agrPw').value) || '';
  if (!currentUser || pw !== currentUser.pass) { var e = $('agrPwErr'); if (e) { e.textContent = 'Incorrect password.'; e.classList.remove('hidden'); } return; }
  clearTimeout(_agrSaveTimer);
  Promise.resolve(_agrFlush()).then(function () {    // make sure every typed field is saved first
    var patch = {}; patch[side + '_confirmed'] = true;
    return _up(_agr.id, patch).then(function () { _agr[side + '_confirmed'] = true; toast('Your half is confirmed and locked.'); renderAgreementForm(); });
  }).catch(function (ex) { toast(ex.message); });
}
function agrGoBack(side) {
  var a = _agr; if (!a || side !== _agrMySide(a) || a.status === 'launched') return;
  var patch = {}; patch[side + '_confirmed'] = false; patch[side + '_launched'] = false;
  _up(a.id, patch).then(function () { _agr[side + '_confirmed'] = false; _agr[side + '_launched'] = false; renderAgreementForm(); }).catch(function (ex) { toast(ex.message); });
}
function agrLaunch(side) {
  var a = _agr; if (!a || side !== _agrMySide(a)) return;
  if (!(a.a_confirmed && a.b_confirmed)) { toast('Both sides must confirm first.'); return; }
  var checks = _agrChecks(a); if (!checks.ok) { toast('⛔ ' + checks.firstError); return; }
  var patch = {}; patch[side + '_launched'] = true;
  var bothLaunched = (side === 'a' ? true : a.a_launched) && (side === 'b' ? true : a.b_launched);
  if (bothLaunched) { patch.status = 'launched'; patch.launched_at = new Date().toISOString(); }
  _up(a.id, patch).then(function () {
    a[side + '_launched'] = true;
    if (patch.status === 'launched') { a.status = 'launched'; toast('Partnership launched! 🎉'); if (typeof loadPartnerAgreements === 'function') loadPartnerAgreements(); }
    else toast('Launched on your side — waiting for the other party.');
    renderAgreementForm();
  }).catch(function (ex) { toast(ex.message); });
}
function agrStop(id) {
  openConfirm('End this partnership?', 'It will no longer show as active on either page. This can’t be undone.', '🤝', function () {
    _up(id, { status: 'ended' }).then(function () { _agr.status = 'ended'; toast('Partnership ended.'); if (typeof loadPartnerAgreements === 'function') loadPartnerAgreements(); renderAgreementForm(); }).catch(function (ex) { toast(ex.message); });
  });
}
