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

/* ---- "Continue with Google" (OAuth with PKCE) ----
   We send the browser to Supabase, which sends it to Google; Google sends it back here with a
   one-time ?code= that only this browser can exchange (it holds the secret "verifier").
   If a Student Club Hub account already uses that Gmail address, Supabase links the two. */
var LS_PKCE = 'sch_pkce_verifier';
function _b64url(buf) {
  var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function sbSignInWithGoogle() {
  if (!window.crypto || !crypto.subtle) return Promise.reject(new Error('Google sign-in needs a secure (https) page.'));
  var rnd = new Uint8Array(48); crypto.getRandomValues(rnd);
  var verifier = _b64url(rnd);
  try { localStorage.setItem(LS_PKCE, verifier); } catch (e) {}
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)).then(function (hash) {
    var back = location.origin + location.pathname;   // land back on this page (keeps http://localhost working in dev)
    location.href = SUPABASE_URL + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(back) +
      '&code_challenge=' + _b64url(hash) + '&code_challenge_method=s256';
  });
}
/* On page load: if Google just sent us back, trade the code for a session. Resolves with the
   session, null if this wasn't a sign-in return, or rejects with a readable error. */
function sbFinishOAuthRedirect() {
  var q = new URLSearchParams(location.search);
  var code = q.get('code'), err = q.get('error_description') || q.get('error');
  if (!code && !err) return Promise.resolve(null);
  ['code', 'error', 'error_code', 'error_description', 'state'].forEach(function (k) { q.delete(k); });
  var rest = q.toString();
  history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);   // tidy the address bar
  if (err) return Promise.reject(new Error('Google sign-in didn’t finish: ' + err.replace(/\+/g, ' ')));
  var verifier = null; try { verifier = localStorage.getItem(LS_PKCE); localStorage.removeItem(LS_PKCE); } catch (e) {}
  if (!verifier) return Promise.reject(new Error('Google sign-in expired. Please try again.'));
  return sbFetch('/auth/v1/token?grant_type=pkce', { auth_code: code, code_verifier: verifier }).then(_sbStore);
}
/* Signed in only through Google (no Student Club Hub password)? */
function sbIsGoogleOnly() {
  var p = (sbSession && sbSession.user.providers) || [];
  return p.indexOf('google') > -1 && p.indexOf('email') === -1;
}
