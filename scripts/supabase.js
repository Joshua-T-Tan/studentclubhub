/* ============================================================
   supabase.js - minimal Supabase Auth client (plain fetch, no SDK).
   Every account is a Supabase Auth user (email + password, email
   verified by a 6-digit code). The session's access token rides on
   every REST call (sbRest in business.js), so the database's
   row-level security knows who is acting. The publishable key below
   is PUBLIC by design. Loaded before auth.js.
   ============================================================ */
var SUPABASE_URL = 'https://xadmwmwagxeiidmeqspa.supabase.co';
var SUPABASE_KEY = 'sb_publishable_5oun_7Qop2ddn3zSTXV0WA_8uZttuS-';

/* Ask Supabase to email a 6-digit code to `email`.
   Resolves on success; rejects with a friendly Error on failure. */
function sbSendOtp(email) {
  return sbFetch('/auth/v1/otp', { email: email, create_user: true });
}
/* Verify the code the user typed for `email`. Resolves with (and stores) the new session. */
function sbVerifyOtp(email, token) {
  return sbFetch('/auth/v1/verify', { email: email, token: (token || '').trim(), type: 'email' }).then(_sbStore);
}
function sbFetch(path, body, method, token) {
  return fetch(SUPABASE_URL + path, {
    method: method || 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + (token || SUPABASE_KEY), 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  }).then(function (res) {
    return res.text().then(function (text) {
      var data = {}; try { data = text ? JSON.parse(text) : {}; } catch (e) {}
      if (res.ok) return data;
      var msg = data.error_description || data.msg || data.error || data.message || ('Request failed (' + res.status + ').');
      if (res.status === 429 || /rate ?limit/i.test(msg)) msg = 'Too many tries. Wait a minute and try again.';
      else if (res.status === 403 && /token|invalid|expired/i.test(msg)) msg = 'That code is incorrect or has expired. Request a new one.';
      else if (/invalid login credentials/i.test(msg)) msg = 'That email and password don’t match an account.';
      else if (/same.*password|password.*same|different from the old/i.test(msg)) msg = 'Pick a password that’s different from your current one.';
      var err = new Error(msg); err.status = res.status; err.code = data.error_code || data.code || ''; throw err;
    });
  }, function () {
    throw new Error('Couldn’t reach the account service. Check your connection and try again.');
  });
}

/* ---- Server session (access + refresh token), kept in localStorage ---- */
var LS_SB_SESSION = 'sch_sb_session';
var sbSession = null;
try { sbSession = JSON.parse(localStorage.getItem(LS_SB_SESSION)) || null; } catch (e) {}
function _sbStore(s) {
  if (s && s.access_token) {
    var u = s.user || {};
    sbSession = {
      access_token: s.access_token, refresh_token: s.refresh_token,
      expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)),
      user: { id: u.id, email: String(u.email || '').toLowerCase(), meta: u.user_metadata || {},
              providers: (u.app_metadata && u.app_metadata.providers) || (u.providers) || [] }
    };
  } else sbSession = null;
  try { if (sbSession) localStorage.setItem(LS_SB_SESSION, JSON.stringify(sbSession)); else localStorage.removeItem(LS_SB_SESSION); } catch (e) {}
  return sbSession;
}
/* Signed in on the server (optionally: as this email)? */
function sbHasSession(email) { return !!(sbSession && sbSession.access_token && (!email || sbSession.user.email === String(email).toLowerCase())); }
var _sbRefreshing = null;
function sbRefresh() {
  if (!sbSession || !sbSession.refresh_token) return Promise.reject(new Error('Please log in again.'));
  if (!_sbRefreshing) {
    _sbRefreshing = sbFetch('/auth/v1/token?grant_type=refresh_token', { refresh_token: sbSession.refresh_token })
      .then(function (s) { _sbRefreshing = null; return _sbStore(s); },
            function (e) { _sbRefreshing = null; if (e.status === 400 || e.status === 401) _sbStore(null); throw e; });
  }
  return _sbRefreshing;
}
/* A fresh access token (renewed a minute before it expires), or null for guests. */
function sbAccessToken() {
  if (!sbSession) return Promise.resolve(null);
  if (sbSession.expires_at - 60 > Date.now() / 1000) return Promise.resolve(sbSession.access_token);
  return sbRefresh().then(function (s) { return s && s.access_token; }, function () { return null; });
}
function sbPasswordLogin(email, password) {
  return sbFetch('/auth/v1/token?grant_type=password', { email: email, password: password }).then(_sbStore);
}
/* Change the signed-in user's password and/or metadata ({ password }, { data: { twofa: true } }). */
function sbUpdateUser(patch) {
  return sbAccessToken().then(function (tok) {
    if (!tok) throw new Error('Please log in again.');
    return sbFetch('/auth/v1/user', patch, 'PUT', tok).then(function (u) {
      if (sbSession && u && u.id) _sbStore({ access_token: sbSession.access_token, refresh_token: sbSession.refresh_token, expires_at: sbSession.expires_at, user: u });
      return u;
    });
  });
}
function sbSignOut() {
  var tok = sbSession && sbSession.access_token; _sbStore(null);
  if (tok) sbFetch('/auth/v1/logout', {}, 'POST', tok).catch(function () {});
}

/* ---- "Continue with Google" ----
   Google sends the user straight back to OUR site with a signed ID token (so Google's screen says
   "Sign in to studentclubhub.com", not the Supabase server's address). We then hand that token to
   Supabase, which checks Google's signature and the one-time nonce before creating the session.
   A Gmail that already has an account is linked to it. */
var GOOGLE_CLIENT_ID = '826931560744-0dm75csaa0dtuv9o70176tf3m856oceo.apps.googleusercontent.com';   // public by design
var LS_GOOGLE = 'sch_google_signin';
function _rand(n) { var b = new Uint8Array(n); crypto.getRandomValues(b); return Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
function _sha256hex(s) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (h) {
    return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
  });
}
function sbSignInWithGoogle() {
  if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Google sign-in needs a secure (https) page.'));
  var nonce = _rand(32), state = _rand(16);
  // remember where the user was (e.g. a #biz= link) so they land back there
  try { localStorage.setItem(LS_GOOGLE, JSON.stringify({ nonce: nonce, state: state, back: location.hash || '' })); } catch (e) {}
  return _sha256hex(nonce).then(function (hashed) {
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(GOOGLE_CLIENT_ID) +
      '&redirect_uri=' + encodeURIComponent(location.origin + '/') + '&response_type=id_token' +
      '&scope=' + encodeURIComponent('openid email profile') + '&nonce=' + hashed + '&state=' + state + '&prompt=select_account';
  });
}
/* On page load: if Google just sent us back (#id_token=…), trade it for a session. Resolves with the
   session, null if this wasn't a sign-in return, or rejects with a readable error. */
function sbFinishOAuthRedirect() {
  var h = location.hash || '';
  if (!/[#&](id_token|error)=/.test(h)) return Promise.resolve(null);
  var q = new URLSearchParams(h.slice(1));
  var saved = null; try { saved = JSON.parse(localStorage.getItem(LS_GOOGLE)); localStorage.removeItem(LS_GOOGLE); } catch (e) {}
  history.replaceState(null, '', location.pathname + location.search + ((saved && saved.back) || ''));   // tidy the address bar
  var err = q.get('error');
  if (err) return Promise.reject(new Error(err === 'access_denied' ? 'Google sign-in was cancelled.' : 'Google sign-in didn’t finish: ' + err));
  if (!saved || !saved.nonce || q.get('state') !== saved.state) return Promise.reject(new Error('Google sign-in expired. Please try again.'));
  return sbFetch('/auth/v1/token?grant_type=id_token', { provider: 'google', id_token: q.get('id_token'), nonce: saved.nonce }).then(_sbStore);
}
/* Signed in only through Google (no Student Club Hub password)? */
function sbIsGoogleOnly() {
  var p = (sbSession && sbSession.user.providers) || [];
  return p.indexOf('google') > -1 && p.indexOf('email') === -1;
}
