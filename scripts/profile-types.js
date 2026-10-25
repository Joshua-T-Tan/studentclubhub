/* ============================================================
   profile-types.js — "Who you are" on your public profile.
   Every member picks ONE public profile type at a time — Student,
   Business owner, or Community member — in Settings → Profile.
   Each type keeps its own saved headline, bio and two details
   (Student: high school + graduation year; Business owner:
   business name + role; Community member: area + involvement),
   so switching back and forth never loses what you saved.
   This is only what the public sees about you: it doesn't change
   club roles or business ownership.
   Storage: all versions live on the account record + privately in
   the auth user's metadata (synced across devices); only the
   displayed version goes to the public `profiles` table.
   Loaded after profile.js.
   ============================================================ */
var PROFILE_TYPES = {
  student: { icon: 'book', fields: [
    { k: 'school', label: 'pt_school', kind: 'school' },
    { k: 'grad', label: 'pt_grad', kind: 'year', ph: '2027' }] },
  business: { icon: 'store', fields: [
    { k: 'bizName', label: 'pt_biz_name', ph: 'pt_biz_name_ph' },
    { k: 'bizRole', label: 'pt_biz_role', ph: 'pt_biz_role_ph' }] },
  community: { icon: 'heart', fields: [
    { k: 'area', label: 'pt_area', ph: 'pt_area_ph' },
    { k: 'involvement', label: 'pt_involve', ph: 'pt_involve_ph' }] }
};
var PROFILE_TYPE_ORDER = ['student', 'business', 'community'];

var I18N_PT = {
  en: { pt_heading: 'Show me as', pt_note: 'Pick what people see on your public profile. Each type keeps its own saved details, so you can switch anytime. This doesn’t change your club roles or business listings.',
    pt_student: 'Student', pt_business: 'Business owner', pt_community: 'Community member',
    pt_student_d: 'High school & graduation year', pt_business_d: 'Your business & role', pt_community_d: 'Your area & how you’re involved',
    pt_live: 'On your profile', pt_school: 'High school', pt_grad: 'Graduation year',
    pt_biz_name: 'Business name', pt_biz_name_ph: 'e.g. Boba Time', pt_biz_role: 'Your role', pt_biz_role_ph: 'e.g. Owner, Manager',
    pt_area: 'Neighborhood or city', pt_area_ph: 'e.g. Palos Verdes', pt_involve: 'How you’re involved', pt_involve_ph: 'e.g. Parent, Alumni, Volunteer, Teacher',
    pt_headline_ph: 'A short line about you', pt_saved_as: 'Saved. Your profile now shows you as a', pt_class_of: 'Class of', pt_at: 'at' },
  es: { pt_heading: 'Mostrarme como', pt_note: 'Elige lo que la gente ve en tu perfil público. Cada tipo guarda sus propios datos, así que puedes cambiar cuando quieras. Esto no cambia tus cargos en clubes ni tus negocios.',
    pt_student: 'Estudiante', pt_business: 'Dueño de negocio', pt_community: 'Miembro de la comunidad',
    pt_student_d: 'Escuela y año de graduación', pt_business_d: 'Tu negocio y tu cargo', pt_community_d: 'Tu zona y cómo participas',
    pt_live: 'En tu perfil', pt_school: 'Escuela secundaria', pt_grad: 'Año de graduación',
    pt_biz_name: 'Nombre del negocio', pt_biz_name_ph: 'p. ej. Boba Time', pt_biz_role: 'Tu cargo', pt_biz_role_ph: 'p. ej. Dueño, Gerente',
    pt_area: 'Barrio o ciudad', pt_area_ph: 'p. ej. Palos Verdes', pt_involve: 'Cómo participas', pt_involve_ph: 'p. ej. Padre/madre, Exalumno, Voluntario, Maestro',
    pt_headline_ph: 'Una frase corta sobre ti', pt_saved_as: 'Guardado. Tu perfil ahora te muestra como', pt_class_of: 'Promoción', pt_at: 'en' },
  fr: { pt_heading: 'M’afficher comme', pt_note: 'Choisis ce que les gens voient sur ton profil public. Chaque type garde ses propres infos, tu peux changer quand tu veux. Cela ne change ni tes rôles dans les clubs ni tes commerces.',
    pt_student: 'Élève', pt_business: 'Commerçant', pt_community: 'Membre de la communauté',
    pt_student_d: 'Lycée et année de fin d’études', pt_business_d: 'Ton commerce et ton rôle', pt_community_d: 'Ton quartier et ton implication',
    pt_live: 'Sur ton profil', pt_school: 'Lycée', pt_grad: 'Année de fin d’études',
    pt_biz_name: 'Nom du commerce', pt_biz_name_ph: 'ex. Boba Time', pt_biz_role: 'Ton rôle', pt_biz_role_ph: 'ex. Propriétaire, Gérant',
    pt_area: 'Quartier ou ville', pt_area_ph: 'ex. Palos Verdes', pt_involve: 'Ton implication', pt_involve_ph: 'ex. Parent, Ancien élève, Bénévole, Enseignant',
    pt_headline_ph: 'Une courte phrase sur toi', pt_saved_as: 'Enregistré. Ton profil t’affiche maintenant comme', pt_class_of: 'Promo', pt_at: 'chez' },
  ja: { pt_heading: '表示する立場', pt_note: '公開プロフィールに表示する立場を選びます。立場ごとに内容が保存されるので、いつでも切り替えられます。クラブの役職やお店の登録には影響しません。',
    pt_student: '学生', pt_business: 'お店のオーナー', pt_community: '地域の方',
    pt_student_d: '高校と卒業年', pt_business_d: 'お店と役職', pt_community_d: '地域と関わり方',
    pt_live: 'プロフィールに表示中', pt_school: '高校', pt_grad: '卒業年',
    pt_biz_name: 'お店の名前', pt_biz_name_ph: '例：Boba Time', pt_biz_role: '役職', pt_biz_role_ph: '例：オーナー、店長',
    pt_area: '地域・市', pt_area_ph: '例：Palos Verdes', pt_involve: '関わり方', pt_involve_ph: '例：保護者、卒業生、ボランティア、教員',
    pt_headline_ph: 'ひとことプロフィール', pt_saved_as: '保存しました。プロフィールの表示：', pt_class_of: '卒業年', pt_at: '／' },
  'zh-CN': { pt_heading: '展示身份', pt_note: '选择别人在你的公开资料中看到的身份。每种身份各自保存信息，可随时切换。这不会影响你的社团职位或商家。',
    pt_student: '学生', pt_business: '商家店主', pt_community: '社区成员',
    pt_student_d: '高中与毕业年份', pt_business_d: '你的商家与职位', pt_community_d: '所在地区与参与方式',
    pt_live: '资料中显示', pt_school: '高中', pt_grad: '毕业年份',
    pt_biz_name: '商家名称', pt_biz_name_ph: '例如 Boba Time', pt_biz_role: '你的职位', pt_biz_role_ph: '例如 店主、经理',
    pt_area: '社区或城市', pt_area_ph: '例如 Palos Verdes', pt_involve: '参与方式', pt_involve_ph: '例如 家长、校友、志愿者、老师',
    pt_headline_ph: '一句话介绍自己', pt_saved_as: '已保存。你的资料现在显示为', pt_class_of: '毕业年份', pt_at: '·' },
  'zh-TW': { pt_heading: '展示身分', pt_note: '選擇別人在你的公開資料中看到的身分。每種身分各自儲存資訊，可隨時切換。這不會影響你的社團職位或商家。',
    pt_student: '學生', pt_business: '商家店主', pt_community: '社區成員',
    pt_student_d: '高中與畢業年份', pt_business_d: '你的商家與職位', pt_community_d: '所在地區與參與方式',
    pt_live: '資料中顯示', pt_school: '高中', pt_grad: '畢業年份',
    pt_biz_name: '商家名稱', pt_biz_name_ph: '例如 Boba Time', pt_biz_role: '你的職位', pt_biz_role_ph: '例如 店主、經理',
    pt_area: '社區或城市', pt_area_ph: '例如 Palos Verdes', pt_involve: '參與方式', pt_involve_ph: '例如 家長、校友、志工、老師',
    pt_headline_ph: '一句話介紹自己', pt_saved_as: '已儲存。你的資料現在顯示為', pt_class_of: '畢業年份', pt_at: '·' }
};
Object.keys(I18N_PT).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_PT[lc]; for (var k in s) d[k] = s[k]; });

/* ---------- data ---------- */
function _blankProfiles() { return { student: {}, business: {}, community: {} }; }
/* Older accounts kept one flat profile (school, grad, headline, bio): that becomes their Student version. */
function ensureProfiles(u) {
  if (!u) return u;
  if (!u.profiles || typeof u.profiles !== 'object') {
    u.profiles = _blankProfiles();
    u.profiles.student = { school: u.school || '', grad: u.grad || '', headline: u.headline || '', bio: u.bio || '' };
  }
  PROFILE_TYPE_ORDER.forEach(function (k) { u.profiles[k] = u.profiles[k] || {}; });
  if (!PROFILE_TYPES[u.profileType]) u.profileType = 'student';
  return u;
}
/* The version people see: { type, headline, bio, details{...} }. */
function publicProfileOf(u) {
  ensureProfiles(u);
  var v = u.profiles[u.profileType] || {}, details = {};
  PROFILE_TYPES[u.profileType].fields.forEach(function (f) { if (v[f.k]) details[f.k] = v[f.k]; });
  return { type: u.profileType, headline: v.headline || '', bio: v.bio || '', details: details };
}
/* "Palos Verdes Peninsula HS · Class of 2027" / "Owner at Boba Time" / "Parent · Palos Verdes". */
function profileDetailsLine(type, d) {
  d = d || {};
  if (type === 'business') return d.bizRole && d.bizName ? d.bizRole + ' ' + t('pt_at') + ' ' + d.bizName : (d.bizName || d.bizRole || '');
  if (type === 'community') return [d.involvement, d.area].filter(Boolean).join(' · ');
  return [d.school, d.grad ? t('pt_class_of') + ' ' + d.grad : ''].filter(Boolean).join(' · ');
}
function profileTypeBadge(type) {
  var pt = PROFILE_TYPES[type] || PROFILE_TYPES.student;
  return '<span class="pt-badge pt-' + (PROFILE_TYPES[type] ? type : 'student') + '">' + svgIcon(pt.icon, 13) + ' ' + escHtml(t('pt_' + (PROFILE_TYPES[type] ? type : 'student'))) + '</span>';
}

/* ---------- Settings → Profile ---------- */
var _ptDraft = null, _ptTab = null;   // unsaved edits per type, kept while switching tabs
function settingsProfile() {
  var u = ensureProfiles(currentUser);
  if (!_ptDraft) { _ptDraft = JSON.parse(JSON.stringify(u.profiles)); _ptTab = u.profileType; }
  return '<div class="avatar-edit"><span id="setAvatarWrap">' + avatarHTML(u.name, 'lg') + '</span>' +
      '<div id="setAvatarCtrls"><label class="btn ghost sm-btn">' + t('set_upload_photo') + '<input type="file" accept="image/*" hidden onchange="onSettingsAvatar(event)"></label>' +
      (u.avatar ? '<button class="btn danger sm-btn" style="margin-left:8px" onclick="removeAvatar()">' + t('set_remove') + '</button>' : '') +
      '<p class="form-note" style="margin-top:6px">' + t('set_memberid') + ': <strong>' + escHtml(u.memberId) + '</strong></p></div></div>' +
    '<div class="field"><label>' + t('set_fullname') + '</label><input id="setName" type="text" value="' + escAttr(u.name) + '"></div>' +
    '<div class="section-title">' + t('pt_heading') + '</div>' +
    '<p class="form-note" style="margin:-4px 0 10px">' + t('pt_note') + '</p>' +
    '<div class="pt-switch" role="tablist">' + PROFILE_TYPE_ORDER.map(function (k) {
      var on = k === _ptTab, live = k === u.profileType;
      return '<button type="button" role="tab" aria-selected="' + on + '" class="pt-option' + (on ? ' on' : '') + '" onclick="switchProfileType(\'' + k + '\')">' +
        '<span class="pt-ico">' + svgIcon(PROFILE_TYPES[k].icon, 20) + '</span>' +
        '<span class="pt-txt"><strong>' + escHtml(t('pt_' + k)) + '</strong><small>' + escHtml(t('pt_' + k + '_d')) + '</small></span>' +
        (live ? '<span class="pt-live">' + svgIcon('check', 12) + ' ' + escHtml(t('pt_live')) + '</span>' : '') + '</button>';
    }).join('') + '</div>' +
    '<div id="ptFields" class="pt-fields">' + _ptFieldsHTML(_ptTab) + '</div>' +
    '<div class="modal-actions"><button class="btn ghost" onclick="openProfile(currentUser.name)">' + t('set_view_public') + '</button>' +
      '<button class="btn primary" onclick="saveSettings()">' + t('set_savechanges') + '</button></div>';
}
function _ptFieldsHTML(type) {
  var v = _ptDraft[type] || {}, bio = v.bio || '', len = bio.length;
  var two = PROFILE_TYPES[type].fields.map(function (f) {
    var val = v[f.k] || '', input;
    if (f.kind === 'school') input = '<select id="pt_' + f.k + '" class="select block-select">' + (typeof schoolOptionsHTML === 'function' ? schoolOptionsHTML(val) : '<option>' + escHtml(val) + '</option>') + '</select>';
    else if (f.kind === 'year') input = '<input id="pt_' + f.k + '" type="number" min="1950" max="2100" value="' + escAttr(val) + '" placeholder="' + escAttr(f.ph) + '">';
    else input = '<input id="pt_' + f.k + '" type="text" maxlength="80" value="' + escAttr(val) + '" placeholder="' + escAttr(t(f.ph)) + '">';
    return '<div class="field"><label>' + escHtml(t(f.label)) + '</label>' + input + '</div>';
  }).join('');
  return '<div class="two-col">' + two + '</div>' +
    '<div class="field"><label>' + t('set_headline') + '</label><input id="setHeadline" type="text" maxlength="90" value="' + escAttr(v.headline || '') + '" placeholder="' + escAttr(t('pt_headline_ph')) + '"></div>' +
    '<div class="field"><label>' + t('set_bio') + '</label><textarea id="setBio" maxlength="200" oninput="updateBioCount()">' + escHtml(bio) + '</textarea>' +
      '<div id="bioCount" class="char-count ' + (len >= 200 ? 'max' : (len >= 160 ? 'warn' : '')) + '">' + len + ' / 200 ' + t('bio_chars') + '</div></div>';
}
/* Read what's typed in the visible version into the draft (so switching tabs keeps it). */
function _ptCapture() {
  if (!_ptDraft || !_ptTab || !$('setBio')) return;
  var v = _ptDraft[_ptTab] = _ptDraft[_ptTab] || {};
  PROFILE_TYPES[_ptTab].fields.forEach(function (f) { var el = $('pt_' + f.k); if (el) v[f.k] = (el.value || '').trim(); });
  v.headline = ($('setHeadline').value || '').trim();
  v.bio = ($('setBio').value || '').slice(0, 200).trim();
}
function switchProfileType(k) {
  if (!PROFILE_TYPES[k] || k === _ptTab) return;
  _ptCapture(); _ptTab = k;
  document.querySelectorAll('.pt-option').forEach(function (b, i) {
    var on = PROFILE_TYPE_ORDER[i] === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
  });
  var host = $('ptFields'); if (host) host.innerHTML = _ptFieldsHTML(k);
}
/* Save: every version's details are kept; the tab you're on becomes the one people see. */
function saveSettings() {
  var u = ensureProfiles(currentUser), oldName = u.name;
  _ptCapture();
  u.name = ($('setName').value || '').trim() || u.name;
  u.profiles = JSON.parse(JSON.stringify(_ptDraft));
  u.profileType = _ptTab;
  // flat fields other screens still read (district recommendations use the student school)
  var shown = publicProfileOf(u);
  u.headline = shown.headline; u.bio = shown.bio;
  u.school = u.profiles.student.school || ''; u.grad = u.profiles.student.grad || '';
  if (u.school && typeof districtForSchool === 'function') { var dist = districtForSchool(u.school); if (dist) u.district = dist; }
  persistUser(); renderAuthArea();
  if (typeof sbUpsertProfile === 'function') sbUpsertProfile();
  if (typeof sbUpdateUser === 'function' && sbHasSession(u.email)) sbUpdateUser({ data: { profiles: u.profiles, profile_type: u.profileType } }).catch(function () {});   // private copy for other devices
  if (u.name !== oldName && typeof syncUserRename === 'function') syncUserRename(oldName, u.name);
  if (typeof syncUserEverywhere === 'function') syncUserEverywhere();
  _ptDraft = null;
  renderSettings(); toast(t('pt_saved_as') + ' ' + t('pt_' + u.profileType).toLowerCase() + '.');
}
/* Leaving Settings throws away unsaved edits (the saved versions are untouched). */
function resetProfileDraft() { _ptDraft = null; _ptTab = null; }
