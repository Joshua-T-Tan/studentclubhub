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
      user: { id: u.id, email: String(u.email || '').toLowerCase(), meta: u.user_metadata || {} }
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
      if (sbSession && u && u.id) { sbSession.user.meta = u.user_metadata || {}; _sbStore({ access_token: sbSession.access_token, refresh_token: sbSession.refresh_token, expires_at: sbSession.expires_at, user: { id: u.id, email: u.email, user_metadata: u.user_metadata } }); }
      return u;
    });
  });
}
function sbSignOut() {
  var tok = sbSession && sbSession.access_token; _sbStore(null);
  if (tok) sbFetch('/auth/v1/logout', {}, 'POST', tok).catch(function () {});
}
