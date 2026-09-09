/* ============================================================
   partnerships.js — Partnership lifecycle (Phase C).
   Inside a BUSINESS conversation, either party can propose a
   partnership (club + duration + terms). The other accepts/denies;
   automated system messages post to the thread. On accept, an
   "Active Sponsorship" badge shows on both the business and club
   cards. Uses sbRest() from business.js. Loaded after messages.js.
   ============================================================ */

var _partnerByBiz = {}, _partnerByClub = {}, _partnersLoaded = false;
var DURATION_OPTS = [
  { v: '1 month', m: 1 }, { v: '3 months', m: 3 }, { v: '6 months', m: 6 },
  { v: '1 semester', m: 5 }, { v: '1 school year', m: 10 }
];
function endsAtFrom(months) { var d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); }
function fmtDate(s) { try { return new Date(s + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return s; } }

/* Load active partnerships → maps keyed by business_id / club_id, then repaint visible cards */
function loadActivePartnerships(cb) {
  return sbRest('partnerships?status=eq.active&select=*').then(function (rows) {
    _partnerByBiz = {}; _partnerByClub = {};
    (rows || []).forEach(function (p) { if (p.business_id) _partnerByBiz[p.business_id] = p; if (p.club_id) _partnerByClub[p.club_id] = p; });
    _partnersLoaded = true;
    if (typeof cb === 'function') cb();
    // repaint any visible cards so badges appear
    if (typeof applyFilters === 'function' && !$('view-browse').classList.contains('hidden')) { applyFilters(); renderTopClubs(); }
    if (typeof renderShops === 'function' && !$('view-shops').classList.contains('hidden')) renderShops();
  }).catch(function () {});
}
function partnershipBadge(kind, id) {
  var p = kind === 'business' ? _partnerByBiz[id] : _partnerByClub[id];
  if (!p) return '';
  var partner = kind === 'business' ? (p.club_name || 'a club') : (p.business_name || 'a business');
  var ends = p.ends_at ? ' · until ' + fmtDate(p.ends_at) : '';
  return '<div class="sponsor-badge">🤝 Active Sponsorship<span>' + escHtml(partner) + ends + '</span></div>';
}

/* ---------- Automated thread message ---------- */
function postSystemMsg(convId, text) {
  return sbRest('messages', { method: 'POST', headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ conversation_id: convId, sender_email: 'system', sender_name: 'Student Club Hub', sender_side: 'system', text: text }) });
}

/* ---------- Thread banner ---------- */
function renderThreadPartnership(conv) {
  var el = $('threadPartner'); if (!el) return;
  if (!conv || conv.target_type !== 'business') { el.innerHTML = ''; return; }
  sbRest('partnerships?conversation_id=eq.' + conv.id + '&order=created_at.desc&limit=1').then(function (rows) {
    var p = rows && rows[0]; var me = currentUser ? currentUser.email.toLowerCase() : '';
    if (!p || p.status === 'declined' || p.status === 'ended') {
      el.innerHTML = '<button class="btn blue block" onclick="openProposePartnership(\'' + conv.id + '\')">🤝 Propose a partnership</button>' +
        (p && p.status === 'declined' ? '<p class="form-note" style="text-align:center;margin-top:6px">A previous proposal was declined.</p>' : '') +
        (p && p.status === 'ended' ? '<p class="form-note" style="text-align:center;margin-top:6px">A previous partnership has ended.</p>' : '');
      return;
    }
    if (p.status === 'pending') {
      var iAmProposer = (p.proposer_email || '').toLowerCase() === me;
      el.innerHTML = '<div class="pship-card pending"><div class="pship-h">📋 Partnership proposed' + (iAmProposer ? ' by you' : ' by ' + escHtml(p.proposer_name)) + '</div>' +
        '<div class="pship-body"><strong>' + escHtml(p.club_name) + '</strong> × <strong>' + escHtml(p.business_name) + '</strong>' +
        '<div class="pship-meta">Duration: ' + escHtml(p.duration_text || '—') + (p.ends_at ? ' · until ' + fmtDate(p.ends_at) : '') + '</div>' +
        '<p class="pship-terms">' + escHtml(p.terms || '') + '</p></div>' +
        (iAmProposer
          ? '<p class="form-note">Waiting for the other side to accept or decline.</p>'
          : '<div class="pship-actions"><button class="btn primary" onclick="acceptPartnership(\'' + p.id + '\',\'' + conv.id + '\')">Accept</button>' +
            '<button class="btn danger" onclick="declinePartnership(\'' + p.id + '\',\'' + conv.id + '\')">Decline</button></div>') +
        '</div>';
      return;
    }
    // active
    el.innerHTML = '<div class="pship-card active"><div class="pship-h">🤝 Active Partnership</div>' +
      '<div class="pship-body"><strong>' + escHtml(p.club_name) + '</strong> × <strong>' + escHtml(p.business_name) + '</strong>' +
      '<div class="pship-meta">' + escHtml(p.duration_text || '') + (p.ends_at ? ' · until ' + fmtDate(p.ends_at) : '') + '</div>' +
      '<p class="pship-terms">' + escHtml(p.terms || '') + '</p></div>' +
      '<div class="pship-actions"><button class="btn ghost" onclick="endPartnership(\'' + p.id + '\',\'' + conv.id + '\')">End partnership</button></div></div>';
  });
}

/* ---------- Propose ---------- */
function openProposePartnership(convId) {
  var conv = (_inboxConvs || []).find(function (c) { return c.id === convId; }); if (!conv) return;
  var clubOpts = (typeof CLUBS !== 'undefined' ? CLUBS.slice().sort(function (a, c) { return a.name.localeCompare(c.name); }).map(function (c) {
    return '<option value="' + escAttr(c.id) + '"' + (c.name === conv.club_name ? ' selected' : '') + '>' + escHtml(c.name) + '</option>'; }).join('') : '');
  var durOpts = DURATION_OPTS.map(function (d) { return '<option value="' + d.m + '">' + d.v + '</option>'; }).join('');
  $('bizBody').innerHTML =
    '<div class="modal-pad"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">' +
      '<h3 style="font-size:1.15rem;font-weight:800">Propose a partnership</h3><button class="icon-btn" onclick="closeReach()">✕</button></div>' +
    '<p class="form-note" style="margin-bottom:12px">With <strong>' + escHtml(conv.target_name) + '</strong>. Set the club, how long it runs, and exactly what the deal is.</p>' +
    '<div id="ppErr" class="auth-error hidden"></div>' +
    '<div class="field"><label>Club</label><select id="ppClub" class="select block-select">' + clubOpts + '</select></div>' +
    '<div class="field"><label>Duration</label><select id="ppDur" class="select block-select">' + durOpts + '</select></div>' +
    '<div class="field"><label>The deal (discounts, promo codes, free add-ons, sponsorship…)</label><textarea id="ppTerms" placeholder="e.g. 15% off for all club members, plus $200 sponsorship for our spring showcase."></textarea></div>' +
    '<button id="ppSend" class="btn primary block lg" onclick="submitProposal(\'' + convId + '\')">Send proposal</button></div>';
  openOverlay('bizOverlay');
}
function submitProposal(convId) {
  var conv = (_inboxConvs || []).find(function (c) { return c.id === convId; }); if (!conv) return;
  var clubSel = $('ppClub'), months = parseInt(($('ppDur') && $('ppDur').value) || '3', 10);
  var terms = ($('ppTerms').value || '').trim();
  var e = $('ppErr'); var err = function (m) { e.textContent = m; e.classList.remove('hidden'); };
  if (!clubSel || !clubSel.value) return err('Pick a club.');
  if (!terms) return err('Describe the deal.');
  var clubId = clubSel.value, clubName = clubSel.options[clubSel.selectedIndex].text;
  var durText = (DURATION_OPTS.find(function (d) { return d.m === months; }) || { v: months + ' months' }).v;
  var row = {
    conversation_id: convId, business_id: conv.target_id, business_name: conv.target_name,
    club_id: clubId, club_name: clubName, proposer_email: currentUser.email.toLowerCase(), proposer_name: currentUser.name,
    duration_text: durText, ends_at: endsAtFrom(months), terms: terms, status: 'pending'
  };
  authBusy2('ppSend', true, 'Sending…');
  sbRest('partnerships', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(row) })
    .then(function () { return postSystemMsg(convId, '📋 ' + currentUser.name + ' proposed a partnership: ' + clubName + ' × ' + conv.target_name + ' for ' + durText + '. — ' + terms); })
    .then(function () { closeReach(); toast('Proposal sent!'); if (_inboxOpenId === convId) { renderThreadPartnership(conv); loadThreadMsgs(convId); } })
    .catch(function (ex) { authBusy2('ppSend', false); err(ex.message); });
}
function acceptPartnership(id, convId) {
  var conv = (_inboxConvs || []).find(function (c) { return c.id === convId; });
  sbRest('partnerships?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ status: 'active', accepted_at: new Date().toISOString() }) })
    .then(function (rows) {
      var p = rows && rows[0];
      return postSystemMsg(convId, '🤝 Partnership accepted! ' + (p ? p.club_name + ' × ' + p.business_name : '') + ' is now active' + (p && p.ends_at ? ' until ' + fmtDate(p.ends_at) : '') + '.');
    })
    .then(function () { toast('Partnership active! 🎉'); loadActivePartnerships(); if (conv) renderThreadPartnership(conv); loadThreadMsgs(convId); })
    .catch(function (ex) { toast(ex.message); });
}
function declinePartnership(id, convId) {
  var conv = (_inboxConvs || []).find(function (c) { return c.id === convId; });
  sbRest('partnerships?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'declined' }) })
    .then(function () { return postSystemMsg(convId, '❌ The partnership proposal was declined.'); })
    .then(function () { toast('Proposal declined.'); if (conv) renderThreadPartnership(conv); loadThreadMsgs(convId); })
    .catch(function (ex) { toast(ex.message); });
}
function endPartnership(id, convId) {
  var conv = (_inboxConvs || []).find(function (c) { return c.id === convId; });
  openConfirm('End this partnership?', 'It will no longer show as active on either card.', '🤝', function () {
    sbRest('partnerships?id=eq.' + id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'ended' }) })
      .then(function () { return postSystemMsg(convId, '🔚 The partnership has been ended.'); })
      .then(function () { toast('Partnership ended.'); loadActivePartnerships(); if (conv) renderThreadPartnership(conv); loadThreadMsgs(convId); })
      .catch(function (ex) { toast(ex.message); });
  });
}

/* Load active partnerships once at startup so card badges appear */
document.addEventListener('DOMContentLoaded', function () { if (typeof sbRest === 'function') loadActivePartnerships(); });
