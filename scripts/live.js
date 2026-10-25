/* ============================================================
   live.js — instant updates for partnerships and promotions.
   One WebSocket to Supabase Realtime (plain WebSocket, no SDK).
   The database pushes a notice whenever a partner_agreements or
   business_promotions row changes (and, for admins, reports /
   contact messages / verification requests); each browser only hears about
   rows its read policies allow (live partnerships for everyone,
   requests for the two sides). On a notice we reload the affected
   data, so a request, counter-offer, approval, withdrawal or end
   shows up on the other account within a second or two. The 20s
   poll in messages.js stays as a fallback if the socket can't
   connect. Loaded after deals.js.
   ============================================================ */
var _live = { ws: null, ref: 0, joinRef: null, hb: null, retry: 0, tok: undefined, debounce: null, tables: {} };
var LIVE_TOPIC = 'realtime:sch-deals';

function _liveSend(topic, event, payload, joinRef) {
  var ws = _live.ws; if (!ws || ws.readyState !== 1) return;
  ws.send(JSON.stringify({ topic: topic, event: event, payload: payload || {}, ref: String(++_live.ref), join_ref: joinRef || null }));
}
function _liveJoin() {
  _live.joinRef = String(++_live.ref);
  var payload = { config: { broadcast: { self: false }, presence: { key: '' },
    postgres_changes: ['partner_agreements', 'business_promotions', 'reports', 'contact_messages', 'verification_requests']
      .map(function (t) { return { event: '*', schema: 'public', table: t }; }) } };   // admin tables only reach admins (read policies)
  if (_live.tok) payload.access_token = _live.tok;   // signed in: the database applies this account's read policies
  _live.ws.send(JSON.stringify({ topic: LIVE_TOPIC, event: 'phx_join', payload: payload, ref: _live.joinRef, join_ref: _live.joinRef }));
}
function liveConnect() {
  if (!window.WebSocket || typeof SUPABASE_URL === 'undefined' || _live.ws) return;
  var tokP = (typeof sbAccessToken === 'function') ? sbAccessToken() : Promise.resolve(null);
  tokP.then(function (tok) {
    if (_live.ws) return;
    _live.tok = tok || null;
    var ws = new WebSocket(SUPABASE_URL.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(SUPABASE_KEY) + '&vsn=1.0.0');
    _live.ws = ws;
    ws.onopen = function () {
      _live.retry = 0; _liveJoin();
      clearInterval(_live.hb); _live.hb = setInterval(function () { _liveSend('phoenix', 'heartbeat', {}); }, 25000);
      if (_live.connected) _liveCatchUp();   // a REconnect: pick up anything that changed while we were away
      _live.connected = true;
    };
    ws.onmessage = function (e) {
      var m; try { m = JSON.parse(e.data); } catch (x) { return; }
      if (m.event === 'postgres_changes') _liveChanged(m.payload && m.payload.data);
    };
    ws.onclose = function () {
      clearInterval(_live.hb); if (_live.ws === ws) _live.ws = null;
      setTimeout(liveConnect, Math.min(30000, 1000 * Math.pow(2, _live.retry++)));   // back off, then reconnect
    };
    ws.onerror = function () { try { ws.close(); } catch (x) {} };
  });
}
/* Sign-in, sign-out and token renewals: hand the channel the new identity (or reconnect as a guest). */
function _liveCheckAuth() {
  if (!_live.ws || _live.ws.readyState !== 1 || typeof sbAccessToken !== 'function') return;
  sbAccessToken().then(function (tok) {
    tok = tok || null; if (tok === _live.tok) return;
    var was = _live.tok; _live.tok = tok;
    if (tok && was) _liveSend(LIVE_TOPIC, 'access_token', { access_token: tok }, _live.joinRef);   // same person, fresh token
    else { try { _live.ws.close(); } catch (x) {} }                                               // someone else now: rejoin
  });
}
/* A row changed: reload what depends on it (batched, in case several rows change at once). */
function _liveChanged(d) {
  if (d && d.table) _live.tables[d.table] = true;
  clearTimeout(_live.debounce);
  _live.debounce = setTimeout(function () {
    var t = _live.tables; _live.tables = {};
    if (t.partner_agreements) {
      if (typeof loadPartnerAgreements === 'function') loadPartnerAgreements();
      if (currentUser && typeof refreshUnread === 'function') refreshUnread();
    }
    if (t.business_promotions && typeof loadPromotions === 'function') loadPromotions();
    if ((t.reports || t.contact_messages || t.verification_requests) && typeof adminLiveChanged === 'function') adminLiveChanged();
  }, 250);
}
function _liveCatchUp() { _live.tables = { partner_agreements: true, business_promotions: true }; _liveChanged(null); }

document.addEventListener('DOMContentLoaded', function () { setTimeout(liveConnect, 500); setInterval(_liveCheckAuth, 5000); });
