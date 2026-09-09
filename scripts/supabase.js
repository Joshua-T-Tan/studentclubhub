/* ============================================================
   supabase.js — minimal Supabase Auth email-OTP client.
   Uses plain fetch (no SDK, no CDN). The publishable key below is
   PUBLIC by design (safe to ship in the browser). Only the email
   verification *code* travels through Supabase — account records
   still live in localStorage (see auth.js). Loaded before auth.js.
   ============================================================ */
var SUPABASE_URL = 'https://xadmwmwagxeiidmeqspa.supabase.co';
var SUPABASE_KEY = 'sb_publishable_5oun_7Qop2ddn3zSTXV0WA_8uZttuS-';

/* Ask Supabase to email a 6-digit code to `email`.
   Resolves on success; rejects with a friendly Error on failure. */
function sbSendOtp(email) {
  return sbFetch('/auth/v1/otp', { email: email, create_user: true });
}
/* Verify the code the user typed for `email`. Resolves on success. */
function sbVerifyOtp(email, token) {
  return sbFetch('/auth/v1/verify', { email: email, token: (token || '').trim(), type: 'email' });
}
function sbFetch(path, body) {
  return fetch(SUPABASE_URL + path, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function (res) {
    return res.text().then(function (text) {
      var data = {}; try { data = text ? JSON.parse(text) : {}; } catch (e) {}
      if (res.ok) return data;
      var msg = data.error_description || data.msg || data.error || data.message || ('Request failed (' + res.status + ').');
      if (res.status === 429 || /rate ?limit/i.test(msg)) msg = 'Too many attempts — please wait a minute and try again.';
      else if (res.status === 403 && /token|invalid|expired/i.test(msg)) msg = 'That code is incorrect or has expired. Request a new one.';
      var err = new Error(msg); err.status = res.status; throw err;
    });
  }, function () {
    throw new Error('Couldn’t reach the verification service. Check your connection and try again.');
  });
}
