/* ============================================================
   auth.js - user state, login/signup, invite credentials,
   session persistence, plus shared app helpers used everywhere.
   ============================================================ */

/* ---------- localStorage namespace ---------- */
var LS = { users: 'sch_users', session: 'sch_session', clubs: 'sch_clubs', reviews: 'sch_reviews', siteReviews: 'sch_site_reviews', drafts: 'sch_drafts', lang: 'sch_lang', theme: 'sch_theme' };

/* ---------- Light / Dark theme ---------- */
function getTheme() { try { return localStorage.getItem(LS.theme) || 'light'; } catch (e) { return 'light'; } }
function applyTheme(mode) {
  mode = (mode === 'dark') ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', mode);
  try { localStorage.setItem(LS.theme, mode); } catch (e) {}
}
function toggleTheme() {
  var next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  if (currentUser) { currentUser.theme = next; persistUser(); }
  if (typeof renderSettings === 'function') renderSettings();
}

/* ---------- Session state ---------- */
var currentUser = null;          // { name, email, pass, memberId, favorites[], joined[], avatar }
var pendingAuthAction = null;    // callback to run right after a successful auth

/* ============================================================
   SHARED HELPERS (defined here because auth.js loads first)
   ============================================================ */
function $(id) { return document.getElementById(id); }

function escHtml(s) {
  return (s || '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* Relative "time ago", falling back to an absolute date for anything older than ~a month */
function timeAgo(ts) {
  if (!ts) return '';
  var s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  if (s < 90) return '1 minute ago';
  var m = Math.floor(s / 60); if (m < 60) return m + ' minute' + (m === 1 ? '' : 's') + ' ago';
  var h = Math.floor(m / 60); if (h < 24) return h + ' hour' + (h === 1 ? '' : 's') + ' ago';
  var d = Math.floor(h / 24); if (d < 7) return d + ' day' + (d === 1 ? '' : 's') + ' ago';
  var w = Math.floor(d / 7); if (w < 5) return w + ' week' + (w === 1 ? '' : 's') + ' ago';
  try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return ''; }
}

/* ---------- i18n - translates all FIXED UI text (user-typed content stays as typed) ---------- */
var LANGS = [
  { code: 'en', label: 'English' }, { code: 'es', label: 'Español' }, { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' }, { code: 'zh-CN', label: '中文（简体）' }, { code: 'zh-TW', label: '中文（繁體）' }
];
var I18N = {
  en: { nav_main:'Main Page', nav_browse:'Browse Clubs', nav_myclubs:'My Clubs', nav_saved:'Saved Clubs', nav_create:'Register a Club',
    hero_h:'Find a club at your school.<br>Or start your own.', hero_p:'Search by zip code or school, save the clubs you like, and message the students who run them.',
    btn_browse:'Browse Clubs', btn_start:'Register a Club',
    step1_t:'Search by Zip Code', step1_p:'Enter your zip, school, or district to find clubs near you.',
    step2_t:'Explore Active Clubs', step2_p:'Browse profiles, photos, meeting times, and recruitment status.',
    step3_t:'Get Involved', step3_p:'Save clubs, join, and contact leaders to start participating.',
    reviews_h:'Loved by students & advisors', reviews_p:'What the community says about Student Club Hub.', write_review:'Write a Review',
    browse_h:'Browse Clubs', browse_p:'Discover student clubs near you — search by club name, school, district, or zip code.', search_ph:'Search by zip code, school, district, or club name...',
    top_clubs:'Top Clubs', most_popular:'Most popular right now',
    myclubs_h:'My Clubs', myclubs_p:'Clubs you lead and clubs you’ve joined.', tab_leading:'Clubs Leading', tab_joined:'Clubs Joined', tab_drafts:'Drafts',
    saved_h:'Saved Clubs', saved_p:'The clubs you’ve saved, kept on your account.',
    create_h:'Register a Club', create_p:'List your club so students can discover and join it.',
    settings_h:'Account Settings', settings_p:'Manage your profile and account.', tab_profile:'Profile', tab_account:'Account', lang_label:'Display language',
    card_save:'Save', card_saved:'Saved', card_view:'View Club',
    club_join:'+ Join Club', club_leave:'Leave Club', club_contact:'Contact Leader', tab_about:'About', tab_manage:'Manage',
    sec_about:'About', sec_details:'Details', sec_reviews:'Reviews & Ratings', sec_members:'Members & Officers', sec_gallery:'Gallery', sec_links:'Links', sec_leadership:'Leadership', sec_chat:'Chat & Announcements',
    page_settings:'Page Settings', back_to_profile:'Back to profile', mg_partner_h:'Partnerships', mg_partner_title:'Open to partnerships', mg_partner_desc:'Show a green “Open to partnerships” badge so clubs and businesses know you welcome collaborations.',
    nav_students:'Students <span class="caret">⌄</span>', nav_business:'Local Businesses <span class="caret">⌄</span>', nav_purpose:'About Us <span class="caret">⌄</span>',
    nav_browse_shops:'Browse Businesses', nav_register_shop:'Register Your Business', nav_my_shop:'My Business', nav_saved_shops:'Saved Businesses',
    nav_philosophy:'Our Philosophy', nav_howitworks:'How It Works', nav_faq:'FAQ',
    gallery_empty:'No photos or videos added yet.', gallery_view_all:'View all media',
    links_max:'You can add up to 8 links (4 per row).',
    rv_reply:'Reply', rv_reply_prompt:'Write a reply to this review:', rv_reply_done:'Reply posted.',
    rv_reply_del_h:'Delete reply?', rv_reply_del_msg:'This reply will be removed for everyone.',
    draft_resume:'Resume Editing', draft_delete:'Delete Draft' },
  es: { nav_main:'Inicio', nav_browse:'Explorar Clubes', nav_myclubs:'Mis Clubes', nav_saved:'Clubes Guardados', nav_create:'Registrar un Club',
    hero_h:'Descubre tu comunidad.<br>Explora clubes de secundaria cerca de ti.', hero_p:'Busca clubes por código postal o escuela, guarda los que te gusten y conecta con sus líderes, todo en un solo lugar.',
    btn_browse:'Explorar Clubes', btn_start:'Registrar un Club',
    step1_t:'Busca por código postal', step1_p:'Ingresa tu código postal, escuela o distrito para encontrar clubes cerca de ti.',
    step2_t:'Explora clubes activos', step2_p:'Mira perfiles, fotos, horarios de reunión y estado de reclutamiento.',
    step3_t:'Participa', step3_p:'Guarda clubes, únete y contacta a los líderes para empezar a participar.',
    reviews_h:'Con el cariño de estudiantes y asesores', reviews_p:'Lo que la comunidad dice sobre Student Club Hub.', write_review:'Escribir una reseña',
    browse_h:'Explorar Clubes', browse_p:'Busca por código postal, nombre de escuela o distrito.', search_ph:'Busca por código postal, escuela, distrito o nombre del club...',
    top_clubs:'Clubes Destacados', most_popular:'Los más populares ahora',
    myclubs_h:'Mis Clubes', myclubs_p:'Clubes que diriges y clubes a los que te has unido.', tab_leading:'Clubes que Dirijo', tab_joined:'Clubes Unidos', tab_drafts:'Borradores',
    saved_h:'Clubes Guardados', saved_p:'Los clubes que has guardado, en tu cuenta.',
    create_h:'Registrar un Club', create_p:'Publica tu club para que los estudiantes lo descubran y se unan.',
    settings_h:'Configuración de la cuenta', settings_p:'Administra tu perfil y tu cuenta.', tab_profile:'Perfil', tab_account:'Cuenta', lang_label:'Idioma de visualización',
    card_save:'Guardar', card_saved:'Guardado', card_view:'Ver Club',
    club_join:'+ Unirse al Club', club_leave:'Salir del Club', club_contact:'Contactar al Líder', tab_about:'Información', tab_manage:'Gestionar',
    sec_about:'Información', sec_details:'Detalles', sec_reviews:'Reseñas y Valoraciones', sec_members:'Miembros y Oficiales', sec_gallery:'Galería', sec_leadership:'Liderazgo', sec_chat:'Chat y Anuncios',
    draft_resume:'Continuar edición', draft_delete:'Eliminar borrador' },
  fr: { nav_main:'Accueil', nav_browse:'Explorer les clubs', nav_myclubs:'Mes clubs', nav_saved:'Clubs enregistrés', nav_create:'Inscrire un club',
    hero_h:'Découvrez votre communauté.<br>Explorez les clubs lycéens près de chez vous.', hero_p:'Recherchez des clubs par code postal ou école, enregistrez vos favoris et contactez leurs responsables, le tout au même endroit.',
    btn_browse:'Explorer les clubs', btn_start:'Inscrire un club',
    step1_t:'Rechercher par code postal', step1_p:'Saisissez votre code postal, école ou district pour trouver des clubs près de chez vous.',
    step2_t:'Découvrir les clubs actifs', step2_p:'Parcourez les profils, photos, horaires de réunion et statuts de recrutement.',
    step3_t:'Participer', step3_p:'Enregistrez des clubs, rejoignez-les et contactez les responsables pour participer.',
    reviews_h:'Apprécié par les élèves et les conseillers', reviews_p:'Ce que la communauté dit de Student Club Hub.', write_review:'Écrire un avis',
    browse_h:'Explorer les clubs', browse_p:'Recherchez par code postal, nom d’école ou district.', search_ph:'Recherchez par code postal, école, district ou nom de club...',
    top_clubs:'Clubs populaires', most_popular:'Les plus populaires en ce moment',
    myclubs_h:'Mes clubs', myclubs_p:'Les clubs que vous dirigez et ceux que vous avez rejoints.', tab_leading:'Clubs dirigés', tab_joined:'Clubs rejoints', tab_drafts:'Brouillons',
    saved_h:'Clubs enregistrés', saved_p:'Les clubs que vous avez enregistrés, conservés sur votre compte.',
    create_h:'Inscrire un club', create_p:'Référencez votre club pour que les élèves le découvrent et le rejoignent.',
    settings_h:'Paramètres du compte', settings_p:'Gérez votre profil et votre compte.', tab_profile:'Profil', tab_account:'Compte', lang_label:'Langue d’affichage',
    card_save:'Enregistrer', card_saved:'Enregistré', card_view:'Voir le club',
    club_join:'+ Rejoindre le club', club_leave:'Quitter le club', club_contact:'Contacter le responsable', tab_about:'À propos', tab_manage:'Gérer',
    sec_about:'À propos', sec_details:'Détails', sec_reviews:'Avis et évaluations', sec_members:'Membres et responsables', sec_gallery:'Galerie', sec_leadership:'Direction', sec_chat:'Discussion et annonces',
    draft_resume:'Reprendre l’édition', draft_delete:'Supprimer le brouillon' },
  ja: { nav_main:'ホーム', nav_browse:'クラブを探す', nav_myclubs:'マイクラブ', nav_saved:'保存したクラブ', nav_create:'クラブを登録',
    hero_h:'あなたのコミュニティを見つけよう。<br>近くの高校クラブを探そう。', hero_p:'郵便番号や学校でクラブを検索し、お気に入りを保存して、リーダーとつながりましょう。すべてが一か所に。',
    btn_browse:'クラブを探す', btn_start:'クラブを登録',
    step1_t:'郵便番号で検索', step1_p:'郵便番号・学校・地区を入力して、近くのクラブを見つけましょう。',
    step2_t:'活動中のクラブを見る', step2_p:'プロフィール、写真、活動時間、募集状況を確認できます。',
    step3_t:'参加しよう', step3_p:'クラブを保存し、参加して、リーダーに連絡しましょう。',
    reviews_h:'生徒と顧問に愛されています', reviews_p:'Student Club Hub についてのみんなの声。', write_review:'レビューを書く',
    browse_h:'クラブを探す', browse_p:'郵便番号、学校名、地区で検索。', search_ph:'郵便番号・学校・地区・クラブ名で検索...',
    top_clubs:'人気クラブ', most_popular:'今人気です',
    myclubs_h:'マイクラブ', myclubs_p:'あなたが運営するクラブと参加中のクラブ。', tab_leading:'運営中のクラブ', tab_joined:'参加中のクラブ', tab_drafts:'下書き',
    saved_h:'保存したクラブ', saved_p:'アカウントに保存したクラブ。',
    create_h:'クラブを登録', create_p:'クラブを掲載して、生徒に見つけてもらい参加してもらいましょう。',
    settings_h:'アカウント設定', settings_p:'プロフィールとアカウントを管理します。', tab_profile:'プロフィール', tab_account:'アカウント', lang_label:'表示言語',
    card_save:'保存', card_saved:'保存済み', card_view:'クラブを見る',
    club_join:'+ クラブに参加', club_leave:'クラブを退会', club_contact:'リーダーに連絡', tab_about:'概要', tab_manage:'管理',
    sec_about:'概要', sec_details:'詳細', sec_reviews:'レビューと評価', sec_members:'メンバーと役員', sec_gallery:'ギャラリー', sec_leadership:'リーダーシップ', sec_chat:'チャットとお知らせ',
    draft_resume:'編集を再開', draft_delete:'下書きを削除' },
  'zh-CN': { nav_main:'首页', nav_browse:'浏览社团', nav_myclubs:'我的社团', nav_saved:'已保存社团', nav_create:'注册社团',
    hero_h:'发现你的社群。<br>探索附近的高中社团。', hero_p:'按邮编或学校搜索社团，保存你喜欢的社团，并与负责人取得联系，尽在一处。',
    btn_browse:'浏览社团', btn_start:'注册社团',
    step1_t:'按邮编搜索', step1_p:'输入你的邮编、学校或学区，查找附近的社团。',
    step2_t:'探索活跃社团', step2_p:'浏览简介、照片、活动时间和招募状态。',
    step3_t:'参与其中', step3_p:'保存社团、加入并联系负责人，开始参与。',
    reviews_h:'深受学生和指导老师喜爱', reviews_p:'社区对 Student Club Hub 的评价。', write_review:'写评价',
    browse_h:'浏览社团', browse_p:'按邮编、学校名称或学区搜索。', search_ph:'按邮编、学校、学区或社团名称搜索...',
    top_clubs:'热门社团', most_popular:'当前最受欢迎',
    myclubs_h:'我的社团', myclubs_p:'你管理的社团和你加入的社团。', tab_leading:'我管理的社团', tab_joined:'我加入的社团', tab_drafts:'草稿',
    saved_h:'已保存社团', saved_p:'你保存的社团，保留在你的账户中。',
    create_h:'注册社团', create_p:'发布你的社团，让学生发现并加入。',
    settings_h:'账户设置', settings_p:'管理你的个人资料和账户。', tab_profile:'个人资料', tab_account:'账户', lang_label:'显示语言',
    card_save:'保存', card_saved:'已保存', card_view:'查看社团',
    club_join:'+ 加入社团', club_leave:'退出社团', club_contact:'联系负责人', tab_about:'简介', tab_manage:'管理',
    sec_about:'简介', sec_details:'详情', sec_reviews:'评价与评分', sec_members:'成员与干部', sec_gallery:'相册', sec_leadership:'领导层', sec_chat:'聊天与公告',
    draft_resume:'继续编辑', draft_delete:'删除草稿' },
  'zh-TW': { nav_main:'首頁', nav_browse:'瀏覽社團', nav_myclubs:'我的社團', nav_saved:'已收藏社團', nav_create:'註冊社團',
    hero_h:'發現你的社群。<br>探索附近的高中社團。', hero_p:'依郵遞區號或學校搜尋社團，收藏你喜歡的社團，並與負責人取得聯繫，盡在一處。',
    btn_browse:'瀏覽社團', btn_start:'註冊社團',
    step1_t:'依郵遞區號搜尋', step1_p:'輸入你的郵遞區號、學校或學區，尋找附近的社團。',
    step2_t:'探索活躍社團', step2_p:'瀏覽簡介、照片、聚會時間與招募狀態。',
    step3_t:'參與其中', step3_p:'收藏社團、加入並聯繫負責人，開始參與。',
    reviews_h:'深受學生與指導老師喜愛', reviews_p:'社群對 Student Club Hub 的評價。', write_review:'撰寫評價',
    browse_h:'瀏覽社團', browse_p:'依郵遞區號、學校名稱或學區搜尋。', search_ph:'依郵遞區號、學校、學區或社團名稱搜尋...',
    top_clubs:'熱門社團', most_popular:'目前最受歡迎',
    myclubs_h:'我的社團', myclubs_p:'你管理的社團與你加入的社團。', tab_leading:'我管理的社團', tab_joined:'我加入的社團', tab_drafts:'草稿',
    saved_h:'已收藏社團', saved_p:'你收藏的社團，保留在你的帳戶中。',
    create_h:'註冊社團', create_p:'發布你的社團，讓學生發現並加入。',
    settings_h:'帳戶設定', settings_p:'管理你的個人資料與帳戶。', tab_profile:'個人資料', tab_account:'帳戶', lang_label:'顯示語言',
    card_save:'收藏', card_saved:'已收藏', card_view:'查看社團',
    club_join:'+ 加入社團', club_leave:'退出社團', club_contact:'聯繫負責人', tab_about:'簡介', tab_manage:'管理',
    sec_about:'簡介', sec_details:'詳情', sec_reviews:'評價與評分', sec_members:'成員與幹部', sec_gallery:'相簿', sec_leadership:'領導層', sec_chat:'聊天與公告',
    draft_resume:'繼續編輯', draft_delete:'刪除草稿' }
};
/* Additional tokens (auth flow, create form, settings, club buttons, empty states, onboarding).
   Fully localized for the English + Chinese channels; other languages fall back to English. */
var I18N_EXTRA = {
  en: {
    au_login:'Log In', au_signup:'Sign Up', au_name:'Full name', au_email:'Email', au_password:'Password', au_confirm:'Confirm password', au_create:'Create Account',
    au_pwhint:'At least 8 characters, including a number or symbol.', au_verify_h:'Verify your email', au_verify_p:'Enter the verification code we sent to your email:',
    au_code:'Verification code', au_verify_btn:'Verify', au_resend:'Resend code', au_demo:'Demo code:', au_onboard_h:'Complete your profile', au_onboard_p:'Just a few details to personalize your experience.',
    au_hs:'High school', au_district:'School district', au_zip:'Zip code', au_lang:'Preferred language', au_finish:'Finish', au_demo_note:'This is a demo. Accounts are saved in your browser only.',
    cc_name:'Club name', cc_desc:'Description', cc_category:'Category', cc_recruit:'Recruitment status', cc_school:'School', cc_district:'School district', cc_zip:'Zip code', cc_email:'Leader contact email',
    cc_meeting:'Meeting schedule', cc_tags:'Tags', cc_banner:'Club banner image', cc_gallery:'Gallery media', cc_links:'Links', cc_invite:'Club leader invite code',
    cc_cancel:'Cancel', cc_savedraft:'Save as Draft', cc_publish:'Publish to Directory', cc_open_all:'Open to All', cc_app_required:'Application Required',
    set_privacy:'Privacy', set_private_title:'Private profile', set_2fa_title:'Enable Two-Factor Authentication (2FA)', set_2fa_desc:'Requires an email verification code every time you log in to secure your account.',
    set_lang_region:'Language & region', set_change_pw:'Change password', set_curpw:'Current password', set_newpw:'New password', set_confirmpw:'Confirm new password', set_forgot:'Forgot Password?', set_update_pw:'Update Password',
    set_email_notif_title:'Enable Email Notifications', set_email_notif_desc:'Receive club announcements, role updates, and event invites at your registered email.',
    set_logout:'Log Out', set_delete:'Delete Account', set_account:'Account', set_view_public:'View public profile', set_savechanges:'Save Changes', set_upload_photo:'Upload photo',
    set_fullname:'Full name', set_hs:'High school', set_grad:'Graduation year', set_headline:'Headline', set_bio:'Bio', set_email:'Email', set_memberid:'Member ID',
    card_save:'Save Club', save_club:'Save Club', back:'← Back',
    empty_saved:'No saved clubs yet. Browse the directory and tap Save Club on clubs you love.', empty_lead:'You don’t lead any clubs yet. Start one to manage it here.',
    empty_joined:'You haven’t joined any clubs yet.', empty_search:'No clubs match your search yet.', empty_drafts:'No drafts yet. Register a club and tap Save as Draft to keep it here.',
    roster_gated:'Join this club to view its members and leadership roster.', join_to_review:'Join this club to leave a review', roster_search_ph:'Search members by name...',
    search_saved_ph:'Search by club name, ID, or zip...', welcome_h:'Welcome to your new club!', welcome_p1:'Your unique Club ID is:',
    welcome_p2:'Share this ID or your direct link so students can quickly search for and join your club!', copy_link:'Copy Direct Link', id_copied:'Direct link copied!', continue_mgmt:'Continue to Club Management' },
  es: { card_save:'Guardar club', save_club:'Guardar club', back:'← Atrás', cc_cancel:'Cancelar', cc_savedraft:'Guardar borrador', cc_publish:'Publicar en el directorio',
    roster_gated:'Únete a este club para ver sus miembros y su directiva.', join_to_review:'Únete a este club para dejar una reseña' },
  fr: { card_save:'Enregistrer le club', save_club:'Enregistrer le club', back:'← Retour', cc_cancel:'Annuler', cc_savedraft:'Enregistrer le brouillon', cc_publish:'Publier dans l’annuaire',
    roster_gated:'Rejoignez ce club pour voir ses membres et ses responsables.', join_to_review:'Rejoignez ce club pour laisser un avis' },
  ja: { card_save:'クラブを保存', save_club:'クラブを保存', back:'← 戻る', cc_cancel:'キャンセル', cc_savedraft:'下書きを保存', cc_publish:'ディレクトリに公開',
    roster_gated:'このクラブに参加すると、メンバーと役員の名簿を表示できます。', join_to_review:'このクラブに参加するとレビューを投稿できます' },
  'zh-CN': {
    au_login:'登录', au_signup:'注册', au_name:'姓名', au_email:'邮箱', au_password:'密码', au_confirm:'确认密码', au_create:'创建账户',
    au_pwhint:'至少 8 个字符，并包含一个数字或符号。', au_verify_h:'验证你的邮箱', au_verify_p:'请输入我们发送到你邮箱的验证码：',
    au_code:'验证码', au_verify_btn:'验证', au_resend:'重新发送验证码', au_demo:'演示验证码：', au_onboard_h:'完善你的资料', au_onboard_p:'只需几项信息，即可个性化你的体验。',
    au_hs:'高中', au_district:'学区', au_zip:'邮政编码', au_lang:'首选语言', au_finish:'完成', au_demo_note:'仅为演示：账户保存在你的浏览器本地。',
    cc_name:'社团名称', cc_desc:'简介', cc_category:'类别', cc_recruit:'招募状态', cc_school:'学校', cc_district:'学区', cc_zip:'邮政编码', cc_email:'负责人联系邮箱',
    cc_meeting:'活动时间', cc_tags:'标签', cc_banner:'社团横幅图片', cc_gallery:'相册媒体', cc_links:'链接', cc_invite:'社团负责人邀请码',
    cc_cancel:'取消', cc_savedraft:'保存为草稿', cc_publish:'发布到目录', cc_open_all:'欢迎所有人', cc_app_required:'需要申请',
    set_privacy:'隐私', set_private_title:'私密资料', set_2fa_title:'启用双重验证（2FA）', set_2fa_desc:'每次登录都需要邮箱验证码，以保护你的账户安全。',
    set_lang_region:'语言和地区', set_change_pw:'修改密码', set_curpw:'当前密码', set_newpw:'新密码', set_confirmpw:'确认新密码', set_forgot:'忘记密码？', set_update_pw:'更新密码',
    set_email_notif_title:'启用邮件通知', set_email_notif_desc:'在你注册的邮箱接收社团公告、角色更新和活动邀请。',
    set_logout:'退出登录', set_delete:'删除账户', set_account:'账户', set_view_public:'查看公开资料', set_savechanges:'保存更改', set_upload_photo:'上传照片',
    set_fullname:'姓名', set_hs:'高中', set_grad:'毕业年份', set_headline:'个人标签', set_bio:'简介', set_email:'邮箱', set_memberid:'成员 ID',
    card_save:'收藏社团', save_club:'收藏社团', back:'← 返回',
    empty_saved:'还没有收藏的社团。浏览目录，点击“收藏社团”保存你喜欢的社团。', empty_lead:'你还没有管理任何社团。创建一个来在此管理。',
    empty_joined:'你还没有加入任何社团。', empty_search:'没有符合你搜索的社团。', empty_drafts:'还没有草稿。注册社团并点击“保存为草稿”将其保存在此。',
    roster_gated:'加入该社团即可查看其成员和领导名单。', join_to_review:'加入该社团即可发表评价', roster_search_ph:'按姓名搜索成员...',
    search_saved_ph:'按社团名称、ID 或邮编搜索...', welcome_h:'欢迎创建你的新社团！', welcome_p1:'你的专属社团 ID 是：',
    welcome_p2:'分享此 ID 或你的直达链接，让学生快速搜索并加入你的社团！', copy_link:'复制直达链接', continue_mgmt:'前往社团管理' },
  'zh-TW': {
    au_login:'登入', au_signup:'註冊', au_name:'姓名', au_email:'電子郵件', au_password:'密碼', au_confirm:'確認密碼', au_create:'建立帳戶',
    au_pwhint:'至少 8 個字元，並包含一個數字或符號。', au_verify_h:'驗證你的電子郵件', au_verify_p:'請輸入我們寄送到你電子郵件的驗證碼：',
    au_code:'驗證碼', au_verify_btn:'驗證', au_resend:'重新傳送驗證碼', au_demo:'示範驗證碼：', au_onboard_h:'完善你的個人資料', au_onboard_p:'只需幾項資訊，即可個人化你的體驗。',
    au_hs:'高中', au_district:'學區', au_zip:'郵遞區號', au_lang:'偏好語言', au_finish:'完成', au_demo_note:'僅為示範：帳戶儲存在你的瀏覽器本機。',
    cc_name:'社團名稱', cc_desc:'簡介', cc_category:'類別', cc_recruit:'招募狀態', cc_school:'學校', cc_district:'學區', cc_zip:'郵遞區號', cc_email:'負責人聯絡電子郵件',
    cc_meeting:'聚會時間', cc_tags:'標籤', cc_banner:'社團橫幅圖片', cc_gallery:'相簿媒體', cc_links:'連結', cc_invite:'社團負責人邀請碼',
    cc_cancel:'取消', cc_savedraft:'儲存為草稿', cc_publish:'發布到目錄', cc_open_all:'歡迎所有人', cc_app_required:'需要申請',
    set_privacy:'隱私', set_private_title:'私密個人資料', set_2fa_title:'啟用雙重驗證（2FA）', set_2fa_desc:'每次登入都需要電子郵件驗證碼，以保護你的帳戶安全。',
    set_lang_region:'語言與地區', set_change_pw:'變更密碼', set_curpw:'目前密碼', set_newpw:'新密碼', set_confirmpw:'確認新密碼', set_forgot:'忘記密碼？', set_update_pw:'更新密碼',
    set_email_notif_title:'啟用電子郵件通知', set_email_notif_desc:'在你註冊的電子郵件接收社團公告、角色更新和活動邀請。',
    set_logout:'登出', set_delete:'刪除帳戶', set_account:'帳戶', set_view_public:'查看公開個人資料', set_savechanges:'儲存變更', set_upload_photo:'上傳照片',
    set_fullname:'姓名', set_hs:'高中', set_grad:'畢業年份', set_headline:'個人標語', set_bio:'簡介', set_email:'電子郵件', set_memberid:'成員 ID',
    card_save:'收藏社團', save_club:'收藏社團', back:'← 返回',
    empty_saved:'還沒有收藏的社團。瀏覽目錄，點擊「收藏社團」儲存你喜歡的社團。', empty_lead:'你還沒有管理任何社團。建立一個以在此管理。',
    empty_joined:'你還沒有加入任何社團。', empty_search:'沒有符合你搜尋的社團。', empty_drafts:'還沒有草稿。註冊社團並點擊「儲存為草稿」將其儲存在此。',
    roster_gated:'加入該社團即可查看其成員與領導名單。', join_to_review:'加入該社團即可發表評價', roster_search_ph:'依姓名搜尋成員...',
    search_saved_ph:'依社團名稱、ID 或郵遞區號搜尋...', welcome_h:'歡迎建立你的新社團！', welcome_p1:'你的專屬社團 ID 是：',
    welcome_p2:'分享此 ID 或你的直達連結，讓學生快速搜尋並加入你的社團！', copy_link:'複製直達連結', continue_mgmt:'前往社團管理' }
};
Object.keys(I18N_EXTRA).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA[lc]; for (var k in s) d[k] = s[k]; });
var I18N_EXTRA2 = {
  en: { set_remove:'Remove', set_notifications:'Notifications', set_security:'Security',
    set_private_desc_full:'When on, others only see your name, Member ID, and number of clubs led. Your school, bio, headline, and club lists stay hidden.' },
  'zh-CN': { set_remove:'移除', set_notifications:'通知', set_security:'安全',
    set_private_desc_full:'开启后，他人只能看到你的姓名、成员 ID 和管理的社团数量；你的学校、简介、个人标签和社团列表将被隐藏。' },
  'zh-TW': { set_remove:'移除', set_notifications:'通知', set_security:'安全',
    set_private_desc_full:'開啟後，他人只能看到你的姓名、成員 ID 和管理的社團數量；你的學校、簡介、個人標語和社團列表將被隱藏。' }
};
Object.keys(I18N_EXTRA2).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA2[lc]; for (var k in s) d[k] = s[k]; });
var I18N_EXTRA3 = {
  en: {
    sec_members:'Officers & Members', share_club:'Share Club', share_direct:'Direct link', share_qr:'Club QR code',
    share_instr:'Copy this link or scan the QR code to invite friends and prospective members directly to your club.', link_copied:'Link copied!',
    role_assign_h:'Confirm Role Assignment', role_assign_confirm:'Confirm Assignment', role_appoint_pre:'Are you sure you want to appoint ', role_appoint_mid:' as ',
    mod_remove_label:'Remove', mod_ban_label:'Ban', mod_remove_h:'Remove Member?', mod_ban_h:'Ban Member?',
    mod_remove_pre:'Are you sure you want to remove ', mod_remove_post:' from the club? Note: Removed members are still eligible to rejoin the club in the future.', mod_remove_btn:'Remove Member',
    mod_ban_pre:'Are you sure you want to BAN ', mod_ban_post:'? Warning: Banned members will be permanently blocked from rejoining this club.', mod_ban_btn:'Ban Member',
    cc_school_ph:'Select your school', cc_district_auto:'Auto-filled from your school' },
  es: { share_club:'Compartir club', mod_remove_label:'Quitar', mod_ban_label:'Bloquear', role_assign_confirm:'Confirmar asignación' },
  fr: { share_club:'Partager le club', mod_remove_label:'Retirer', mod_ban_label:'Bannir', role_assign_confirm:'Confirmer l’attribution' },
  ja: { share_club:'クラブを共有', mod_remove_label:'削除', mod_ban_label:'追放', role_assign_confirm:'任命を確定' },
  'zh-CN': {
    sec_members:'干部与成员', share_club:'分享社团', share_direct:'直达链接', share_qr:'社团二维码',
    share_instr:'复制此链接或扫描二维码，直接邀请好友和有意加入的同学加入你的社团。', link_copied:'链接已复制！',
    role_assign_h:'确认角色任命', role_assign_confirm:'确认任命', role_appoint_pre:'确定要任命 ', role_appoint_mid:' 为 ',
    mod_remove_label:'移除', mod_ban_label:'封禁', mod_remove_h:'移除成员？', mod_ban_h:'封禁成员？',
    mod_remove_pre:'确定要将 ', mod_remove_post:' 从社团中移除吗？注意：被移除的成员日后仍可重新加入社团。', mod_remove_btn:'移除成员',
    mod_ban_pre:'确定要封禁 ', mod_ban_post:' 吗？警告：被封禁的成员将被永久禁止重新加入此社团。', mod_ban_btn:'封禁成员',
    cc_school_ph:'选择你的学校', cc_district_auto:'根据学校自动填充' },
  'zh-TW': {
    sec_members:'幹部與成員', share_club:'分享社團', share_direct:'直達連結', share_qr:'社團 QR code',
    share_instr:'複製此連結或掃描 QR code，直接邀請好友和有意加入的同學加入你的社團。', link_copied:'連結已複製！',
    role_assign_h:'確認角色任命', role_assign_confirm:'確認任命', role_appoint_pre:'確定要任命 ', role_appoint_mid:' 為 ',
    mod_remove_label:'移除', mod_ban_label:'封鎖', mod_remove_h:'移除成員？', mod_ban_h:'封鎖成員？',
    mod_remove_pre:'確定要將 ', mod_remove_post:' 從社團中移除嗎？注意：被移除的成員日後仍可重新加入社團。', mod_remove_btn:'移除成員',
    mod_ban_pre:'確定要封鎖 ', mod_ban_post:' 嗎？警告：被封鎖的成員將被永久禁止重新加入此社團。', mod_ban_btn:'封鎖成員',
    cc_school_ph:'選擇你的學校', cc_district_auto:'根據學校自動填入' }
};
Object.keys(I18N_EXTRA3).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA3[lc]; for (var k in s) d[k] = s[k]; });
var I18N_EXTRA4 = {
  en: { mod_banned_h:'Banned Users', mod_no_banned:'No banned users.', mod_unban_label:'Unban',
    set_appearance:'Appearance', set_dark_title:'Dark Appearance', set_dark_desc:'Switch between light and dark themes.',
    rv_edit:'Edit', rv_delete:'Delete', rv_delete_h:'Delete review?', rv_delete_msg:'This permanently removes your review.', rv_edit_h:'Edit your review', rv_save:'Save changes' },
  es: { mod_unban_label:'Desbloquear', set_dark_title:'Apariencia oscura', rv_edit:'Editar', rv_delete:'Eliminar' },
  fr: { mod_unban_label:'Débannir', set_dark_title:'Apparence sombre', rv_edit:'Modifier', rv_delete:'Supprimer' },
  ja: { mod_unban_label:'追放解除', set_dark_title:'ダークモード', rv_edit:'編集', rv_delete:'削除' },
  'zh-CN': { mod_banned_h:'被封禁用户', mod_no_banned:'没有被封禁的用户。', mod_unban_label:'解除封禁',
    set_appearance:'外观', set_dark_title:'深色外观', set_dark_desc:'在浅色和深色主题之间切换。',
    rv_edit:'编辑', rv_delete:'删除', rv_delete_h:'删除评价？', rv_delete_msg:'此操作将永久删除你的评价。', rv_edit_h:'编辑你的评价', rv_save:'保存修改' },
  'zh-TW': { mod_banned_h:'被封鎖用戶', mod_no_banned:'沒有被封鎖的用戶。', mod_unban_label:'解除封鎖',
    set_appearance:'外觀', set_dark_title:'深色外觀', set_dark_desc:'在淺色與深色主題之間切換。',
    rv_edit:'編輯', rv_delete:'刪除', rv_delete_h:'刪除評價？', rv_delete_msg:'此操作將永久刪除你的評價。', rv_edit_h:'編輯你的評價', rv_save:'儲存修改' }
};
Object.keys(I18N_EXTRA4).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA4[lc]; for (var k in s) d[k] = s[k]; });
var I18N_EXTRA5 = {
  en: { joined_label:'Joined', vis_public:'Public', vis_private:'Private', cc_visibility:'Club status',
    sort_joined:'Joined', sort_notjoined:'Not Joined', sort_public:'Public', sort_private:'Private',
    you_pres:'You: President', mg_privacy_h:'Club Privacy Status', mg_privacy_title:'Private club',
    mg_privacy_desc:'Private clubs require an application to join; public clubs are open to all.' },
  es: { joined_label:'Inscrito', vis_public:'Público', vis_private:'Privado', you_pres:'Tú: Presidente' },
  fr: { joined_label:'Membre', vis_public:'Public', vis_private:'Privé', you_pres:'Vous : Président' },
  ja: { joined_label:'参加済み', vis_public:'公開', vis_private:'非公開', you_pres:'あなた：会長' },
  'zh-CN': { joined_label:'已加入', vis_public:'公开', vis_private:'私密', cc_visibility:'社团状态',
    sort_joined:'已加入', sort_notjoined:'未加入', sort_public:'公开', sort_private:'私密',
    you_pres:'你：主席', mg_privacy_h:'社团隐私状态', mg_privacy_title:'私密社团',
    mg_privacy_desc:'私密社团需要申请才能加入；公开社团对所有人开放。' },
  'zh-TW': { joined_label:'已加入', vis_public:'公開', vis_private:'私密', cc_visibility:'社團狀態',
    sort_joined:'已加入', sort_notjoined:'未加入', sort_public:'公開', sort_private:'私密',
    you_pres:'你：主席', mg_privacy_h:'社團隱私狀態', mg_privacy_title:'私密社團',
    mg_privacy_desc:'私密社團需要申請才能加入；公開社團對所有人開放。' }
};
Object.keys(I18N_EXTRA5).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA5[lc]; for (var k in s) d[k] = s[k]; });
var I18N_EXTRA6 = {
  en: { mg_details:'Club Details', mg_title:'Club Title', mg_desc:'Description', mg_meeting:'Meeting Schedule',
    mg_tags:'Tags', mg_tags_ph:'e.g. robotics, coding, competition', mg_tags_note:'Comma-separated. These appear as #hashtags on your club page.',
    mg_media_h:'Banner, Gallery & Links', mg_banner:'Club Banner Image', mg_banner_drop:'Drag & drop or click to upload a banner', mg_remove_banner:'Remove banner',
    mg_gallery:'Add Gallery Media', mg_upload:'Upload', mg_social:'Social Media Links', mg_addlink:'+ Add Link',
    mg_chat_h:'Chat Permissions', mg_chat_allow:'Allow all members to send messages', mg_chat_note:'Announcements remain officers-only.',
    mg_members_h:'Members & Roles', mg_member_search_ph:'Search members by name or email...',
    mg_savechanges:'Save Changes', mg_danger:'Danger Zone', mg_leave:'Leave Club', mg_delete:'Delete Club' },
  es: { mg_savechanges:'Guardar cambios', mg_delete:'Eliminar club', mg_leave:'Salir del club', mg_details:'Detalles del club', mg_upload:'Subir' },
  fr: { mg_savechanges:'Enregistrer', mg_delete:'Supprimer le club', mg_leave:'Quitter le club', mg_details:'Détails du club', mg_upload:'Téléverser' },
  ja: { mg_savechanges:'変更を保存', mg_delete:'クラブを削除', mg_leave:'クラブを退会', mg_details:'クラブ詳細', mg_upload:'アップロード' },
  'zh-CN': { mg_details:'社团详情', mg_title:'社团名称', mg_desc:'简介', mg_meeting:'活动时间',
    mg_media_h:'横幅、相册与链接', mg_banner:'社团横幅图片', mg_banner_drop:'拖放或点击上传横幅', mg_remove_banner:'移除横幅',
    mg_gallery:'添加相册媒体', mg_upload:'上传', mg_social:'社交媒体链接', mg_addlink:'+ 添加链接',
    mg_chat_h:'聊天权限', mg_chat_allow:'允许所有成员发送消息', mg_chat_note:'公告仍仅限干部发布。',
    mg_members_h:'成员与角色', mg_member_search_ph:'按姓名或邮箱搜索成员...',
    mg_savechanges:'保存更改', mg_danger:'危险区域', mg_leave:'退出社团', mg_delete:'删除社团' },
  'zh-TW': { mg_details:'社團詳情', mg_title:'社團名稱', mg_desc:'簡介', mg_meeting:'聚會時間',
    mg_media_h:'橫幅、相簿與連結', mg_banner:'社團橫幅圖片', mg_banner_drop:'拖放或點擊上傳橫幅', mg_remove_banner:'移除橫幅',
    mg_gallery:'新增相簿媒體', mg_upload:'上傳', mg_social:'社群媒體連結', mg_addlink:'+ 新增連結',
    mg_chat_h:'聊天權限', mg_chat_allow:'允許所有成員發送訊息', mg_chat_note:'公告仍僅限幹部發布。',
    mg_members_h:'成員與角色', mg_member_search_ph:'依姓名或電子郵件搜尋成員...',
    mg_savechanges:'儲存變更', mg_danger:'危險區域', mg_leave:'退出社團', mg_delete:'刪除社團' }
};
Object.keys(I18N_EXTRA6).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA6[lc]; for (var k in s) d[k] = s[k]; });
var I18N_EXTRA7 = {
  en: { mg_autosaved:'Changes save automatically.', mg_saved_note:'✓ Saved', bio_chars:'characters',
    saved_p:'Your favorite clubs, saved in one place for quick access and updates.',
    myclubs_p:'Clubs you lead, clubs you’ve joined, and your pending drafts.',
    create_p:'Publish your club so students can discover and join it.' },
  'zh-CN': { mg_autosaved:'更改会自动保存。', mg_saved_note:'✓ 已保存', bio_chars:'字符',
    saved_p:'你收藏的社团，集中保存，方便快速访问和获取更新。',
    myclubs_p:'你管理的社团、你加入的社团，以及你的草稿。',
    create_p:'发布你的社团，让学生发现并加入。' },
  'zh-TW': { mg_autosaved:'變更會自動儲存。', mg_saved_note:'✓ 已儲存', bio_chars:'字元',
    saved_p:'你收藏的社團，集中保存，方便快速存取與取得更新。',
    myclubs_p:'你管理的社團、你加入的社團，以及你的草稿。',
    create_p:'發布你的社團，讓學生發現並加入。' }
};
Object.keys(I18N_EXTRA7).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA7[lc]; for (var k in s) d[k] = s[k]; });
/* Completes es / fr / ja (and the newest keys for zh) so every language covers the full key set. */
var CARET = ' <span class="caret">⌄</span>';
var I18N_EXTRA8 = {
  es: {
    au_login:'Iniciar sesión', au_signup:'Registrarse', au_name:'Nombre completo', au_email:'Correo electrónico', au_password:'Contraseña', au_confirm:'Confirmar contraseña', au_create:'Crear cuenta',
    au_pwhint:'Al menos 8 caracteres, con un número o símbolo.', au_verify_h:'Verifica tu correo', au_verify_p:'Escribe el código de verificación que enviamos a tu correo:', au_code:'Código de verificación', au_verify_btn:'Verificar', au_resend:'Reenviar código',
    au_onboard_h:'Completa tu perfil', au_onboard_p:'Solo unos datos para personalizar tu experiencia.', au_hs:'Escuela secundaria', au_district:'Distrito escolar', au_zip:'Código postal', au_lang:'Idioma preferido', au_finish:'Terminar',
    cc_name:'Nombre del club', cc_desc:'Descripción', cc_category:'Categoría', cc_school:'Escuela', cc_district:'Distrito escolar', cc_zip:'Código postal', cc_email:'Correo de contacto del líder', cc_meeting:'Horario de reuniones', cc_tags:'Etiquetas', cc_invite:'Código de invitación para líderes', cc_visibility:'Estado del club',
    continue_mgmt:'Ir a la gestión del club', copy_link:'Copiar enlace directo', id_copied:'¡Enlace directo copiado!', link_copied:'¡Enlace copiado!', links_max:'Puedes añadir hasta 8 enlaces (4 por fila).',
    empty_saved:'Aún no tienes clubes guardados. Explora el directorio y toca Guardar en los clubes que te gusten.', empty_lead:'Todavía no diriges ningún club. Crea uno para administrarlo aquí.', empty_joined:'Todavía no te has unido a ningún club.', empty_search:'Ningún club coincide con tu búsqueda.',
    gallery_empty:'Todavía no hay fotos ni videos.', gallery_view_all:'Ver todo el contenido',
    mod_remove_h:'¿Quitar miembro?', mod_remove_pre:'¿Seguro que quieres quitar a ', mod_remove_post:' del club? Nota: los miembros quitados pueden volver a unirse en el futuro.', mod_remove_btn:'Quitar miembro',
    mod_ban_h:'¿Bloquear miembro?', mod_ban_pre:'¿Seguro que quieres BLOQUEAR a ', mod_ban_post:'? Atención: los miembros bloqueados no podrán volver a unirse a este club.', mod_ban_btn:'Bloquear miembro', mod_banned_h:'Usuarios bloqueados', mod_no_banned:'No hay usuarios bloqueados.',
    nav_students:'Estudiantes' + CARET, nav_business:'Negocios locales' + CARET, nav_purpose:'Sobre nosotros' + CARET, nav_browse_shops:'Explorar negocios', nav_register_shop:'Registra tu negocio', nav_my_shop:'Mi negocio', nav_saved_shops:'Negocios guardados', nav_philosophy:'Nuestra filosofía', nav_howitworks:'Cómo funciona', nav_faq:'Preguntas frecuentes',
    roster_search_ph:'Buscar miembros por nombre...', search_saved_ph:'Buscar por nombre del club, ID o código postal...',
    rv_delete_h:'¿Eliminar reseña?', rv_delete_msg:'Esto elimina tu reseña de forma permanente.', rv_edit_h:'Editar tu reseña', rv_save:'Guardar cambios', rv_reply:'Responder', rv_reply_prompt:'Escribe una respuesta a esta reseña:', rv_reply_done:'Respuesta publicada.', rv_reply_del_h:'¿Eliminar respuesta?', rv_reply_del_msg:'Esta respuesta se eliminará para todos.',
    sec_links:'Enlaces', share_direct:'Enlace directo', share_qr:'Código QR del club', share_instr:'Copia este enlace o escanea el código QR para invitar a amigos y futuros miembros directamente a tu club.',
    set_privacy:'Privacidad', set_private_title:'Perfil privado', set_private_desc_full:'Si está activado, los demás solo ven tu nombre, tu ID de miembro y cuántos clubes diriges. Tu escuela, biografía, titular y listas de clubes quedan ocultos.',
    set_2fa_title:'Activar verificación en dos pasos (2FA)', set_2fa_desc:'Pide un código por correo cada vez que inicias sesión para proteger tu cuenta.', set_lang_region:'Idioma y región', set_change_pw:'Cambiar contraseña', set_curpw:'Contraseña actual', set_newpw:'Nueva contraseña', set_confirmpw:'Confirmar nueva contraseña', set_forgot:'¿Olvidaste tu contraseña?', set_update_pw:'Actualizar contraseña',
    set_email_notif_title:'Activar notificaciones por correo', set_email_notif_desc:'Recibe anuncios del club, cambios de rol e invitaciones a eventos en tu correo registrado.', set_logout:'Cerrar sesión', set_delete:'Eliminar cuenta', set_account:'Cuenta', set_view_public:'Ver perfil público', set_savechanges:'Guardar cambios', set_upload_photo:'Subir foto',
    set_fullname:'Nombre completo', set_hs:'Escuela secundaria', set_grad:'Año de graduación', set_headline:'Titular', set_bio:'Biografía', set_email:'Correo electrónico', set_memberid:'ID de miembro', set_remove:'Quitar', set_notifications:'Notificaciones', set_security:'Seguridad', set_appearance:'Apariencia', set_dark_desc:'Cambia entre el tema claro y el oscuro.',
    sort_joined:'Unido', sort_notjoined:'No unido', sort_public:'Público', sort_private:'Privado',
    welcome_h:'¡Bienvenido a tu nuevo club!', welcome_p1:'El ID único de tu club es:', welcome_p2:'¡Comparte este ID o tu enlace directo para que los estudiantes encuentren tu club y se unan rápido!', bio_chars:'caracteres'
  },
  fr: {
    au_login:'Se connecter', au_signup:'S’inscrire', au_name:'Nom complet', au_email:'E-mail', au_password:'Mot de passe', au_confirm:'Confirmer le mot de passe', au_create:'Créer un compte',
    au_pwhint:'Au moins 8 caractères, dont un chiffre ou un symbole.', au_verify_h:'Vérifie ton e-mail', au_verify_p:'Saisis le code de vérification envoyé à ton adresse e-mail :', au_code:'Code de vérification', au_verify_btn:'Vérifier', au_resend:'Renvoyer le code',
    au_onboard_h:'Complète ton profil', au_onboard_p:'Quelques infos pour personnaliser ton expérience.', au_hs:'Lycée', au_district:'District scolaire', au_zip:'Code postal', au_lang:'Langue préférée', au_finish:'Terminer',
    cc_name:'Nom du club', cc_desc:'Description', cc_category:'Catégorie', cc_school:'Établissement', cc_district:'District scolaire', cc_zip:'Code postal', cc_email:'E-mail de contact du responsable', cc_meeting:'Horaires des réunions', cc_tags:'Mots-clés', cc_invite:'Code d’invitation responsable', cc_visibility:'Statut du club',
    continue_mgmt:'Accéder à la gestion du club', copy_link:'Copier le lien direct', id_copied:'Lien direct copié !', link_copied:'Lien copié !', links_max:'Tu peux ajouter jusqu’à 8 liens (4 par ligne).',
    empty_saved:'Aucun club enregistré pour l’instant. Parcours l’annuaire et touche Enregistrer sur les clubs qui te plaisent.', empty_lead:'Tu ne diriges encore aucun club. Crées-en un pour le gérer ici.', empty_joined:'Tu n’as encore rejoint aucun club.', empty_search:'Aucun club ne correspond à ta recherche.',
    gallery_empty:'Aucune photo ni vidéo pour l’instant.', gallery_view_all:'Voir tous les médias',
    mod_remove_h:'Retirer ce membre ?', mod_remove_pre:'Veux-tu vraiment retirer ', mod_remove_post:' du club ? Remarque : un membre retiré peut rejoindre le club plus tard.', mod_remove_btn:'Retirer le membre',
    mod_ban_h:'Bannir ce membre ?', mod_ban_pre:'Veux-tu vraiment BANNIR ', mod_ban_post:' ? Attention : un membre banni ne pourra plus jamais rejoindre ce club.', mod_ban_btn:'Bannir le membre', mod_banned_h:'Utilisateurs bannis', mod_no_banned:'Aucun utilisateur banni.',
    nav_students:'Élèves' + CARET, nav_business:'Commerces locaux' + CARET, nav_purpose:'À propos' + CARET, nav_browse_shops:'Parcourir les commerces', nav_register_shop:'Inscrire ton commerce', nav_my_shop:'Mon commerce', nav_saved_shops:'Commerces enregistrés', nav_philosophy:'Notre philosophie', nav_howitworks:'Comment ça marche', nav_faq:'FAQ',
    roster_search_ph:'Rechercher un membre par nom...', search_saved_ph:'Rechercher par nom de club, ID ou code postal...',
    rv_delete_h:'Supprimer l’avis ?', rv_delete_msg:'Ton avis sera supprimé définitivement.', rv_edit_h:'Modifier ton avis', rv_save:'Enregistrer', rv_reply:'Répondre', rv_reply_prompt:'Écris une réponse à cet avis :', rv_reply_done:'Réponse publiée.', rv_reply_del_h:'Supprimer la réponse ?', rv_reply_del_msg:'Cette réponse sera supprimée pour tout le monde.',
    sec_links:'Liens', share_direct:'Lien direct', share_qr:'QR code du club', share_instr:'Copie ce lien ou scanne le QR code pour inviter tes amis et de futurs membres directement dans ton club.',
    set_privacy:'Confidentialité', set_private_title:'Profil privé', set_private_desc_full:'Activé, les autres ne voient que ton nom, ton ID de membre et le nombre de clubs que tu diriges. Ton établissement, ta bio, ton titre et tes listes de clubs restent masqués.',
    set_2fa_title:'Activer la double authentification (2FA)', set_2fa_desc:'Un code par e-mail est demandé à chaque connexion pour protéger ton compte.', set_lang_region:'Langue et région', set_change_pw:'Changer le mot de passe', set_curpw:'Mot de passe actuel', set_newpw:'Nouveau mot de passe', set_confirmpw:'Confirmer le nouveau mot de passe', set_forgot:'Mot de passe oublié ?', set_update_pw:'Mettre à jour',
    set_email_notif_title:'Activer les notifications par e-mail', set_email_notif_desc:'Reçois les annonces du club, les changements de rôle et les invitations à des événements sur ton e-mail.', set_logout:'Se déconnecter', set_delete:'Supprimer le compte', set_account:'Compte', set_view_public:'Voir le profil public', set_savechanges:'Enregistrer', set_upload_photo:'Importer une photo',
    set_fullname:'Nom complet', set_hs:'Lycée', set_grad:'Année de fin d’études', set_headline:'Titre', set_bio:'Bio', set_email:'E-mail', set_memberid:'ID de membre', set_remove:'Retirer', set_notifications:'Notifications', set_security:'Sécurité', set_appearance:'Apparence', set_dark_desc:'Passe du thème clair au thème sombre.',
    sort_joined:'Rejoints', sort_notjoined:'Non rejoints', sort_public:'Public', sort_private:'Privé',
    welcome_h:'Bienvenue dans ton nouveau club !', welcome_p1:'L’ID unique de ton club est :', welcome_p2:'Partage cet ID ou ton lien direct pour que les élèves trouvent et rejoignent ton club rapidement !', bio_chars:'caractères'
  },
  ja: {
    au_login:'ログイン', au_signup:'新規登録', au_name:'氏名', au_email:'メールアドレス', au_password:'パスワード', au_confirm:'パスワード（確認）', au_create:'アカウントを作成',
    au_pwhint:'8文字以上で、数字または記号を含めてください。', au_verify_h:'メールアドレスの確認', au_verify_p:'メールに送信された確認コードを入力してください：', au_code:'確認コード', au_verify_btn:'確認する', au_resend:'コードを再送信',
    au_onboard_h:'プロフィールを完成させよう', au_onboard_p:'あなたに合わせた表示にするため、いくつか教えてください。', au_hs:'高校', au_district:'学区', au_zip:'郵便番号', au_lang:'使用言語', au_finish:'完了',
    cc_name:'クラブ名', cc_desc:'説明', cc_category:'カテゴリー', cc_school:'学校', cc_district:'学区', cc_zip:'郵便番号', cc_email:'リーダーの連絡先メール', cc_meeting:'活動日時', cc_tags:'タグ', cc_invite:'リーダー招待コード', cc_visibility:'クラブの公開設定',
    continue_mgmt:'クラブ管理へ進む', copy_link:'直接リンクをコピー', id_copied:'直接リンクをコピーしました！', link_copied:'リンクをコピーしました！', links_max:'リンクは最大8件（1行に4件）まで追加できます。',
    empty_saved:'保存したクラブはまだありません。一覧から気になるクラブの「保存」をタップしましょう。', empty_lead:'まだリーダーを務めるクラブはありません。クラブを作るとここで管理できます。', empty_joined:'まだどのクラブにも参加していません。', empty_search:'検索に一致するクラブはありません。',
    gallery_empty:'写真や動画はまだありません。', gallery_view_all:'すべてのメディアを見る',
    mod_remove_h:'メンバーを外しますか？', mod_remove_pre:'', mod_remove_post:' さんをクラブから外しますか？ 外されたメンバーは後で再参加できます。', mod_remove_btn:'メンバーを外す',
    mod_ban_h:'メンバーをブロックしますか？', mod_ban_pre:'', mod_ban_post:' さんをブロックしますか？ ブロックされたメンバーはこのクラブに二度と参加できません。', mod_ban_btn:'ブロックする', mod_banned_h:'ブロック中のユーザー', mod_no_banned:'ブロック中のユーザーはいません。',
    nav_students:'学生' + CARET, nav_business:'地元のお店' + CARET, nav_purpose:'私たちについて' + CARET, nav_browse_shops:'お店を探す', nav_register_shop:'お店を登録', nav_my_shop:'マイショップ', nav_saved_shops:'保存したお店', nav_philosophy:'私たちの理念', nav_howitworks:'使い方', nav_faq:'よくある質問',
    roster_search_ph:'名前でメンバーを検索...', search_saved_ph:'クラブ名・ID・郵便番号で検索...',
    rv_delete_h:'レビューを削除しますか？', rv_delete_msg:'あなたのレビューは完全に削除されます。', rv_edit_h:'レビューを編集', rv_save:'変更を保存', rv_reply:'返信', rv_reply_prompt:'このレビューへの返信を入力してください：', rv_reply_done:'返信を投稿しました。', rv_reply_del_h:'返信を削除しますか？', rv_reply_del_msg:'この返信は全員の画面から削除されます。',
    sec_links:'リンク', share_direct:'直接リンク', share_qr:'クラブのQRコード', share_instr:'このリンクをコピーするかQRコードを読み取って、友達や入部希望者をクラブに直接招待しましょう。',
    set_privacy:'プライバシー', set_private_title:'非公開プロフィール', set_private_desc_full:'オンにすると、他の人に表示されるのは名前・メンバーID・リーダーを務めるクラブ数だけになります。学校、自己紹介、肩書き、クラブ一覧は非表示です。',
    set_2fa_title:'二段階認証（2FA）を有効にする', set_2fa_desc:'ログインのたびにメールの確認コードを求めて、アカウントを守ります。', set_lang_region:'言語と地域', set_change_pw:'パスワードを変更', set_curpw:'現在のパスワード', set_newpw:'新しいパスワード', set_confirmpw:'新しいパスワード（確認）', set_forgot:'パスワードをお忘れですか？', set_update_pw:'パスワードを更新',
    set_email_notif_title:'メール通知を有効にする', set_email_notif_desc:'クラブのお知らせ、役職の変更、イベントの招待を登録メールで受け取ります。', set_logout:'ログアウト', set_delete:'アカウントを削除', set_account:'アカウント', set_view_public:'公開プロフィールを見る', set_savechanges:'変更を保存', set_upload_photo:'写真をアップロード',
    set_fullname:'氏名', set_hs:'高校', set_grad:'卒業年', set_headline:'肩書き', set_bio:'自己紹介', set_email:'メールアドレス', set_memberid:'メンバーID', set_remove:'削除', set_notifications:'通知', set_security:'セキュリティ', set_appearance:'表示', set_dark_desc:'ライトテーマとダークテーマを切り替えます。',
    sort_joined:'参加中', sort_notjoined:'未参加', sort_public:'公開', sort_private:'非公開',
    welcome_h:'新しいクラブへようこそ！', welcome_p1:'あなたのクラブIDは：', welcome_p2:'このIDか直接リンクを共有すれば、学生がすぐにクラブを見つけて参加できます！', bio_chars:'文字'
  },
  'zh-CN': {
    nav_students:'学生' + CARET, nav_business:'本地商家' + CARET, nav_purpose:'关于我们' + CARET, nav_browse_shops:'浏览商家', nav_register_shop:'登记你的商家', nav_my_shop:'我的商家', nav_saved_shops:'已收藏的商家', nav_philosophy:'我们的理念', nav_howitworks:'使用方法', nav_faq:'常见问题',
    sec_links:'链接', gallery_empty:'还没有照片或视频。', gallery_view_all:'查看全部媒体', links_max:'最多可添加 8 个链接（每行 4 个）。', id_copied:'直达链接已复制！',
    rv_reply:'回复', rv_reply_prompt:'写下对这条评价的回复：', rv_reply_done:'回复已发布。', rv_reply_del_h:'删除回复？', rv_reply_del_msg:'这条回复将对所有人删除。'
  },
  'zh-TW': {
    nav_students:'學生' + CARET, nav_business:'在地商家' + CARET, nav_purpose:'關於我們' + CARET, nav_browse_shops:'瀏覽商家', nav_register_shop:'登記你的商家', nav_my_shop:'我的商家', nav_saved_shops:'已收藏的商家', nav_philosophy:'我們的理念', nav_howitworks:'使用方式', nav_faq:'常見問題',
    sec_links:'連結', gallery_empty:'還沒有照片或影片。', gallery_view_all:'查看全部媒體', links_max:'最多可新增 8 個連結（每列 4 個）。', id_copied:'直達連結已複製！',
    rv_reply:'回覆', rv_reply_prompt:'寫下對這則評價的回覆：', rv_reply_done:'回覆已發布。', rv_reply_del_h:'刪除回覆？', rv_reply_del_msg:'這則回覆將對所有人刪除。'
  }
};
I18N_EXTRA8.en = { coming_soon: 'Coming soon' };
I18N_EXTRA8.es.coming_soon = 'Próximamente'; I18N_EXTRA8.fr.coming_soon = 'Bientôt disponible'; I18N_EXTRA8.ja.coming_soon = '近日公開';
I18N_EXTRA8['zh-CN'].coming_soon = '即将推出'; I18N_EXTRA8['zh-TW'].coming_soon = '即將推出';
Object.keys(I18N_EXTRA8).forEach(function (lc) { var d = I18N[lc] || (I18N[lc] = {}); var s = I18N_EXTRA8[lc]; for (var k in s) d[k] = s[k]; });
var LANG = 'en';
function getLang() { try { return localStorage.getItem(LS.lang) || 'en'; } catch (e) { return 'en'; } }
/* t(key) - translated fixed-UI string for the active language (English fallback). */
function t(key) { return (I18N[LANG] && I18N[LANG][key] != null) ? I18N[LANG][key] : (I18N.en[key] != null ? I18N.en[key] : key); }
function applyLanguage(lang) {
  if (!I18N[lang]) lang = 'en';
  LANG = lang;
  try { localStorage.setItem(LS.lang, lang); } catch (e) {}
  document.querySelectorAll('[data-i18n]').forEach(function (el) { var v = t(el.getAttribute('data-i18n')); if (v != null) el.innerHTML = v; });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { var v = t(el.getAttribute('data-i18n-ph')); if (v != null) el.setAttribute('placeholder', v); });
  document.documentElement.setAttribute('lang', lang);
}
/* Re-render dynamic (JS-built) views so their strings pick up the new language too. */
function onLanguageChanged() {
  renderAuthArea();                                        // re-translate the Log Out button + chip
  if (typeof applyFilters === 'function') applyFilters();
  if (typeof renderTopClubs === 'function') renderTopClubs();
  if (typeof renderSiteReviews === 'function') renderSiteReviews();
  var v = (typeof currentViewName === 'function') ? currentViewName() : '';
  if (v === 'myclubs' && typeof renderMyClubs === 'function') renderMyClubs();
  if (v === 'saved' && typeof renderSaved === 'function') renderSaved();
  if (v === 'settings' && typeof renderSettings === 'function') renderSettings();
  if (v === 'profile' && typeof renderProfileIfOpen === 'function') renderProfileIfOpen();
  if (v === 'club' && typeof refreshClubModalState === 'function') refreshClubModalState();
  if (typeof renderHero === 'function') renderHero();
  if (typeof renderFeatureCards === 'function') renderFeatureCards();
  if (typeof renderFaq === 'function') renderFaq();
  if (typeof renderPhilosophy === 'function') renderPhilosophy();
  if (typeof renderHowItWorks === 'function') renderHowItWorks();
  if (v === 'shops' && typeof renderShops === 'function') renderShops();
}

/* Standard log-out icon (door/box with an outward-pointing arrow) - shared by header + confirm */
var ICON_LOGOUT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>';

function toast(msg) {
  var t = $('toast'); if (!t || !msg) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(window._toastT);
  window._toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
}

var VIEWS = ['main', 'browse', 'myclubs', 'saved', 'profile', 'settings', 'club', 'create', 'philosophy', 'shops', 'faq', 'howitworks', 'business', 'inbox', 'contact', 'admin'];
function showView(name) {
  VIEWS.forEach(function (v) {
    var el = $('view-' + v); if (el) el.classList.toggle('hidden', v !== name);
  });
  if (typeof setNavActive === 'function') setNavActive(name);
  if (name === 'main') { if (typeof renderStats === 'function') renderStats(); if (typeof renderSiteReviews === 'function') renderSiteReviews(); }
  if (name === 'browse' && typeof applyFilters === 'function') { applyFilters(); if (typeof renderTopClubs === 'function') renderTopClubs(); }
  if (name === 'myclubs' && typeof renderMyClubs === 'function') renderMyClubs();
  if (name === 'saved' && typeof renderSaved === 'function') renderSaved();
  if (name === 'settings' && typeof renderSettings === 'function') renderSettings();
  if (name === 'inbox' && typeof renderInbox === 'function') renderInbox();
  if (name === 'contact' && typeof renderContactPage === 'function') renderContactPage();
  if (name === 'admin' && typeof renderAdmin === 'function') renderAdmin();
  if (typeof updateInboxFab === 'function') updateInboxFab(name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function goHome() { showView('main'); }

/* Generic overlay open/close + click-outside dismissal */
function openOverlay(id) { var el = $(id); if (el) { el.classList.remove('hidden'); document.body.style.overflow = 'hidden'; } }
function closeOverlay(id) {
  var el = $(id); if (el) el.classList.add('hidden');
  // release scroll lock only when no overlay remains open
  var anyOpen = Array.prototype.some.call(document.querySelectorAll('.overlay'), function (o) { return !o.classList.contains('hidden'); });
  if (!anyOpen) document.body.style.overflow = '';
}
// Close only when the click is on the scrim itself, not the modal card inside it.
function onOverlayClick(event, overlayId, closeFn) {
  if (event.target === $(overlayId)) (closeFn || function () { closeOverlay(overlayId); })();
}

/* Drag-and-drop for any .uploader dropzone → routes files to its hidden file input's onchange */
function wireDropzones() {
  function zone(e) { return e.target && e.target.closest ? e.target.closest('.uploader') : null; }
  document.addEventListener('dragover', function (e) { var u = zone(e); if (u) { e.preventDefault(); u.classList.add('drag'); } });
  document.addEventListener('dragleave', function (e) { var u = zone(e); if (u) u.classList.remove('drag'); });
  document.addEventListener('drop', function (e) {
    var u = zone(e); if (!u) return;
    e.preventDefault(); u.classList.remove('drag');
    var inp = u.querySelector('input[type="file"]');
    if (inp && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      try { inp.files = e.dataTransfer.files; inp.dispatchEvent(new Event('change')); } catch (err) {}
    }
  });
}

/* Avatar helpers - shared so every account sees real photos, not just initials */
function initialsOf(n) {
  return (n || '?').split(' ').filter(Boolean).map(function (w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
}
function avatarForName(name) {
  if (!name) return null;
  if (currentUser && name === currentUser.name) return currentUser.avatar || null;
  try { var u = Object.values(loadUsers()).find(function (x) { return x.name === name; }); if (u && u.avatar) return u.avatar; } catch (e) {}
  return null;
}
function avatarHTML(name, size) {
  var src = avatarForName(name);
  var inner = src ? '<img src="' + escAttr(src) + '" alt="" referrerpolicy="no-referrer">' : escHtml(initialsOf(name));
  return '<div class="avatar ' + (size || 'sm') + '">' + inner + '</div>';
}
/* Save star icon: golden outline when un-saved, solid gold when saved. */
function starSvg(saved) {
  var path = 'M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.9 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z';
  return '<svg class="star-ico" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
    '<path d="' + path + '" fill="' + (saved ? '#F59E0B' : 'none') + '" stroke="#F59E0B" stroke-width="2" stroke-linejoin="round"/></svg>';
}
/* Bookmark icon for Save actions (replaces the star on Save buttons/toggles) */
function bookmarkSvg(saved) {
  return '<svg class="bm-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
    '<path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1z" fill="' + (saved ? 'currentColor' : 'none') +
    '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
}

/* ============================================================
   USER STORE
   ============================================================ */
function loadUsers() { try { return JSON.parse(localStorage.getItem(LS.users)) || {}; } catch (e) { return {}; } }
function saveUsers(u) {
  try { localStorage.setItem(LS.users, JSON.stringify(u)); return true; }
  catch (e) { toast('This device’s storage is full (usually a large profile photo). Use a smaller photo.'); return false; }
}

/* Member IDs are 6 digits (#123456) and must be unique across ALL accounts, not just this browser,
   so each candidate is checked against the shared profiles table. */
function genMemberId() {
  var users = loadUsers(), id;
  do { id = '#' + Math.floor(100000 + Math.random() * 900000); }
  while (Object.values(users).some(function (u) { return u.memberId === id; }));
  return id;
}
function genMemberIdUnique(tries) {
  var id = genMemberId(); tries = tries || 0;
  if (typeof sbRest !== 'function' || tries > 5) return Promise.resolve(id);
  return sbRest('profiles?member_id=eq.' + encodeURIComponent(id) + '&select=member_id').then(function (rows) {
    return (rows && rows.length) ? genMemberIdUnique(tries + 1) : id;
  }).catch(function () { return id; });
}
/* 6-character alpha-numeric public Club ID, e.g. A8K9X2 - unique across all clubs. */
function genClubId() {
  var chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789', id;   // no confusing O/0/1/I
  do {
    id = ''; for (var i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  } while (typeof CLUBS !== 'undefined' && CLUBS.some(function (c) { return c.clubId === id; }));
  return id;
}

/* ============================================================
   INIT + SESSION RESTORE
   ============================================================ */
/* Session is pinned PER TAB (sessionStorage) so a refresh keeps THIS tab on its
   account even if another tab logged into a different account. localStorage holds
   the last login as the default for brand-new tabs. */
function saveSessionEmail(email) {
  try { sessionStorage.setItem(LS.session, email); } catch (e) {}
  try { localStorage.setItem(LS.session, email); } catch (e) {}
}
function readSessionEmail() {
  var e = null;
  try { e = sessionStorage.getItem(LS.session); } catch (x) {}
  if (!e) { try { e = localStorage.getItem(LS.session); } catch (x) {} }
  return e;
}
function clearSessionEmail() {
  try { sessionStorage.removeItem(LS.session); } catch (e) {}
  try { localStorage.removeItem(LS.session); } catch (e) {}
}
function initAuth() {
  var email = readSessionEmail();
  if (email) {
    var rec = loadUsers()[email.toLowerCase()];
    // A local account is only restored together with its server session; accounts from before
    // server logins existed log in once more (that one login moves them onto the server).
    if (rec && sbHasSession(email)) setSession(rec);
    else { clearSessionEmail(); if (rec) setTimeout(function () { toast('We upgraded account security. Please log in once more.'); openAuth('login'); }, 600); }
  }
  renderAuthArea();
  finishGoogleSignIn();
  // Restored session applies the account's own theme/language (in setSession);
  // a guest always gets the Light + English defaults (no global leakage).
  if (!currentUser) { applyLanguage('en'); applyTheme('light'); }
  wireDropzones();
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('lightbox').classList.contains('hidden')) return closeLightbox();
      if ($('galleryPage') && !$('galleryPage').classList.contains('hidden')) return closeGalleryPage();
      ['confirmOverlay', 'contactOverlay', 'contactUsOverlay', 'deleteAccountOverlay', 'reviewOverlay', 'transferOverlay', 'forgotOverlay', 'welcomeOverlay', 'shareOverlay', 'authOverlay', 'bizOverlay'].forEach(function (id) {
        if ($(id) && !$(id).classList.contains('hidden')) closeOverlay(id);
      });
    }
  });
}

function setSession(rec) {
  currentUser = {
    name: rec.name, email: rec.email, memberId: rec.memberId,
    favorites: (rec.favorites || []).slice(), joined: (rec.joined || []).slice(),
    avatar: rec.avatar || null,
    school: rec.school || '', grad: rec.grad || '', headline: rec.headline || '',
    bio: rec.bio || '', private: !!rec.private,
    district: rec.district || '', zip: rec.zip || '', twofa: !!rec.twofa,
    emailNotif: rec.emailNotif !== false,
    lang: prefsGet(rec, 'lang') || 'en', theme: prefsGet(rec, 'theme') || 'light'
  };
  saveSessionEmail(rec.email.toLowerCase());
  // Apply THIS account's preferences (recalculated on every account switch — no leakage)
  applyLanguage(currentUser.lang);
  applyTheme(currentUser.theme);
  // Sync this account's memberships + current name up to the server (self-heals stale names / legacy joins).
  // Register in the member directory FIRST (it links this member ID to the server account, which the
  // database needs before it accepts my writes), then sync my memberships.
  var prof = (typeof sbUpsertProfile === 'function') ? sbUpsertProfile() : Promise.resolve();
  prof.then(function () { if (typeof reconcileMyMemberships === 'function') reconcileMyMemberships(); });
}
/* Read a preference from the account record (nested user.preferences first, then flat legacy) */
function prefsGet(rec, key) { return (rec && rec.preferences && rec.preferences[key]) || (rec && rec[key]) || ''; }

/* Persist the live session (favorites/joined/avatar + profile fields) onto the account record */
function persistUser() {
  if (!currentUser) return;
  var users = loadUsers(), key = currentUser.email.toLowerCase();
  if (!users[key]) return;
  var rec = users[key];
  rec.favorites = currentUser.favorites.slice();
  rec.joined = currentUser.joined.slice();
  rec.avatar = currentUser.avatar || null;
  rec.name = currentUser.name;
  rec.school = currentUser.school || ''; rec.grad = currentUser.grad || '';
  rec.headline = currentUser.headline || ''; rec.bio = currentUser.bio || '';
  rec.private = !!currentUser.private; delete rec.pass;
  rec.district = currentUser.district || ''; rec.zip = currentUser.zip || ''; rec.twofa = !!currentUser.twofa;
  rec.emailNotif = currentUser.emailNotif !== false;
  rec.lang = currentUser.lang || 'en'; rec.theme = currentUser.theme || 'light';
  rec.preferences = { theme: rec.theme, lang: rec.lang };   // account-scoped preferences object
  saveUsers(users);
}

/* ============================================================
   AUTH MODAL - multi-step: login → (2FA) ; signup → verify → onboard
   ============================================================ */
var authStage = 'login';         // login | signup | verify | onboard
var authIntroMsg = '';
var pendingReg = null;           // {name,email,pass} held during signup until verified
var otpMode = null, otpLoginRec = null, verifyEmail = null;

/* Toggle a button into a disabled "busy" state (and back) during async auth calls */
function authBusy(id, busy, label) {
  var b = $(id); if (!b) return;
  if (busy) { if (!b.dataset.label) b.dataset.label = b.textContent; b.textContent = label || 'Please wait…'; b.disabled = true; }
  else { if (b.dataset.label) { b.textContent = b.dataset.label; delete b.dataset.label; } b.disabled = false; }
}
/* "Resend code" cooldown - disables the link for `secs` and counts down, so rapid
   taps don't trip Supabase's per-email rate limit. */
var resendTimer = null, resendUntil = 0;
function startResendCooldown(secs) {
  resendUntil = Date.now() + secs * 1000;
  if (resendTimer) clearInterval(resendTimer);
  tickResend();
  resendTimer = setInterval(tickResend, 1000);
}
function stopResendCooldown() { if (resendTimer) { clearInterval(resendTimer); resendTimer = null; } resendUntil = 0; }
function tickResend() {
  var el = $('resendLink');
  if (!el) { stopResendCooldown(); return; }        // verify screen gone → drop the timer
  var left = Math.ceil((resendUntil - Date.now()) / 1000);
  if (left > 0) { el.classList.add('disabled'); el.textContent = t('au_resend') + ' (' + left + 's)'; }
  else { stopResendCooldown(); el.classList.remove('disabled'); el.textContent = t('au_resend'); }
}
function validPassword(p) { return (p || '').length >= 8 && /[0-9\W]/.test(p); }
/* Require a real, well-formed email address (local@domain.tld) at sign-up */
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e || '').trim()); }

function openAuth(stage, introMsg) {
  authStage = (stage === 'signup') ? 'signup' : 'login';
  authIntroMsg = introMsg || '';
  pendingReg = null; otpMode = null; otpLoginRec = null; verifyEmail = null; stopResendCooldown();
  renderAuth(); openOverlay('authOverlay');
}
function closeAuth() { closeOverlay('authOverlay'); }
function setAuthTab(tab) { authStage = tab; authErrMsg = ''; stopResendCooldown(); renderAuth(); }
var authErrMsg = '';
function authErr(msg) { authErrMsg = msg; var e = $('authError'); if (e) { e.textContent = msg; e.classList.remove('hidden'); } }

function renderAuth() {
  var b = $('authBody'); if (!b) return;
  var err = '<div id="authError" class="auth-error hidden"></div>';
  var intro = authIntroMsg ? '<div class="form-note" style="margin-bottom:12px">' + escHtml(authIntroMsg) + '</div>' : '';
  if (authStage === 'login') {
    b.innerHTML = authTabs() + intro + err + googleButtonHTML() +
      field('alEmail', t('au_email'), 'email', 'you@school.edu') +
      field('alPass', t('au_password'), 'password', '••••••••') +
      '<p style="margin:-6px 0 12px;text-align:right"><a href="#" class="link" onclick="openForgot();return false;">' + t('set_forgot') + '</a></p>' +
      '<button id="btnLogin" class="btn primary block lg" onclick="submitLogin()">' + t('au_login') + '</button>';
  } else if (authStage === 'signup') {
    b.innerHTML = authTabs() + intro + err + googleButtonHTML() +
      field('asName', t('au_name'), 'text', 'Jordan Lee') +
      field('asEmail', t('au_email'), 'email', 'you@school.edu') +
      field('asPass', t('au_password'), 'password', '••••••••') +
      '<p class="form-note" style="margin:-6px 0 12px">' + t('au_pwhint') + '</p>' +
      field('asConfirm', t('au_confirm'), 'password', '••••••••') +
      '<button id="btnSignup" class="btn primary block lg" onclick="submitSignup()">' + t('au_create') + '</button>';
  } else if (authStage === 'verify') {
    b.innerHTML = '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:4px">' + t('au_verify_h') + '</h3>' +
      '<p class="form-note" style="margin-bottom:14px">' + t('au_verify_p') +
        (verifyEmail ? ' <strong>' + escHtml(verifyEmail) + '</strong>' : '') + '</p>' + err +
      field('avCode', t('au_code'), 'text', 'Enter your code') +
      '<button id="btnVerify" class="btn primary block lg" onclick="submitVerify()">' + t('au_verify_btn') + '</button>' +
      '<p style="text-align:center;margin-top:10px"><a href="#" id="resendLink" class="link" onclick="resendOtp();return false;">' + t('au_resend') + '</a></p>';
  } else if (authStage === 'onboard') {
    b.innerHTML = '<h3 style="font-size:1.2rem;font-weight:800;margin-bottom:4px">' + t('au_onboard_h') + '</h3>' +
      '<p class="form-note" style="margin-bottom:14px">' + t('au_onboard_p') + '</p>' + err +
      '<div class="field"><label>' + t('au_hs') + '</label><select id="aoSchool" class="select block-select" onchange="onSchoolPick(\'aoSchool\',\'aoDistrict\')">' + schoolOptionsHTML('') + '</select></div>' +
      '<div class="field"><label>' + t('au_district') + '</label><select id="aoDistrict" class="select block-select">' + districtOptionsHTML('') + '</select></div>' +
      field('aoZip', t('au_zip'), 'text', '90274') +
      '<div class="field"><label>' + t('au_lang') + '</label><select id="aoLang" class="select block-select">' +
        LANGS.map(function (l) { return '<option value="' + l.code + '"' + (getLang() === l.code ? ' selected' : '') + '>' + l.label + '</option>'; }).join('') +
      '</select></div>' +
      '<button class="btn primary block lg" onclick="submitOnboard()">' + t('au_finish') + '</button>';
  }
  var e = $('authError'); if (e && authErrMsg && (authStage === 'login' || authStage === 'signup')) { e.textContent = authErrMsg; e.classList.remove('hidden'); }
}
/* "Continue with Google" + an "or" divider above the email form (same button for log in and sign up). */
function googleButtonHTML() {
  return '<button type="button" id="btnGoogle" class="btn google-btn block lg" onclick="startGoogleSignIn()">' + ICON_GOOGLE + '<span>Continue with Google</span></button>' +
    '<div class="auth-or"><span>or use email</span></div>';
}
function startGoogleSignIn() {
  authBusy('btnGoogle', true, 'Opening Google…');
  sbSignInWithGoogle().catch(function (e) { authBusy('btnGoogle', false); authErr(e.message); });
}
/* Back from Google: sign in, and new accounts continue to "Complete your profile". */
function finishGoogleSignIn() {
  sbFinishOAuthRedirect().then(function (s) {
    if (!s) return;
    var m = s.user.meta || {};
    return _afterServerLogin(s.user.email, m.full_name || m.name).then(function (r) {
      if (!r.avatar && m.avatar_url) { r.avatar = m.avatar_url; currentUser.avatar = m.avatar_url; persistUser(); renderAuthArea(); }
      if (r._new) { delete r._new; authStage = 'onboard'; renderAuth(); openOverlay('authOverlay'); return; }
      finishAuth('Welcome back, ' + r.name.split(' ')[0] + '!');
    });
  }).catch(function (e) { toast(e.message); });
}
function authTabs() {
  return '<div class="tab-row"><button id="tabLogin" class="' + (authStage === 'login' ? 'active' : '') + '" onclick="setAuthTab(\'login\')">' + t('au_login') + '</button>' +
    '<button id="tabSignup" class="' + (authStage === 'signup' ? 'active' : '') + '" onclick="setAuthTab(\'signup\')">' + t('au_signup') + '</button></div>';
}
function field(id, label, type, ph) {
  return '<div class="field"><label>' + escHtml(label) + '</label><input id="' + id + '" type="' + type + '" placeholder="' + escAttr(ph) + '"></div>';
}

function submitLogin() {
  authErrMsg = '';
  var email = ($('alEmail').value || '').trim().toLowerCase(), pass = $('alPass').value;
  if (!email || !pass) return authErr('Email and password are required.');
  authBusy('btnLogin', true, 'Logging in…');
  sbPasswordLogin(email, pass).then(function (s) {
    var rec = loadUsers()[email];
    if ((s.user.meta && s.user.meta.twofa) || (rec && rec.twofa)) {   // 2FA: also prove the inbox with a code
      sbSignOut(); otpMode = 'login2fa'; verifyEmail = email;
      return sbSendOtp(email).then(function () { authStage = 'verify'; renderAuth(); startResendCooldown(60); });
    }
    return _afterServerLogin(email).then(function (r) { finishAuth('Welcome back, ' + r.name.split(' ')[0] + '!'); });
  }).catch(function (e) {
    var rec = loadUsers()[email];
    // Accounts made before server logins existed have their password only in this browser:
    // confirm the email once with a code, then that password is saved on the server.
    if (rec && rec.pass && rec.pass === pass && e.status === 400) {
      otpMode = 'upgrade'; verifyEmail = email; pendingReg = { email: email, pass: pass };
      return sbSendOtp(email).then(function () {
        authIntroMsg = 'One-time security upgrade: we emailed you a code to confirm it’s you.';
        authStage = 'verify'; renderAuth(); startResendCooldown(60);
      }).catch(function (e2) { authBusy('btnLogin', false); authErr(e2.message); });
    }
    authBusy('btnLogin', false);
    authErr(e.status === 400 ? 'That email and password don’t match an account. (New device? Use “Forgot Password?” once to set your password.)' : e.message);
  });
}
function submitSignup() {
  authErrMsg = '';
  var name = ($('asName').value || '').trim(), email = ($('asEmail').value || '').trim().toLowerCase();
  var pass = $('asPass').value, confirm = $('asConfirm').value;
  if (!name) return authErr('Please enter your name.');
  if (!email) return authErr('Please enter your email.');
  if (!isValidEmail(email)) return authErr('Please enter a valid email address (e.g. you@school.edu).');
  if (!validPassword(pass)) return authErr('Password must be at least 8 characters and include a number or symbol.');
  if (pass !== confirm) return authErr('Passwords don’t match.');
  pendingReg = { name: name, email: email, pass: pass };
  otpMode = 'signup'; verifyEmail = email;
  authBusy('btnSignup', true, 'Sending code…');
  sbSendOtp(email).then(function () {
    authStage = 'verify'; renderAuth(); startResendCooldown(60);
  }).catch(function (e2) { authBusy('btnSignup', false); authErr(e2.message); });
}
function resendOtp() {
  if (!verifyEmail) return;
  if (Date.now() < resendUntil) return;                 // still cooling down - ignore taps
  var el = $('resendLink'); if (el) { el.classList.add('disabled'); el.textContent = t('au_resend') + '…'; }
  sbSendOtp(verifyEmail)
    .then(function () { toast('A new code has been sent to ' + verifyEmail + '.'); startResendCooldown(60); })
    .catch(function (e2) { authErr(e2.message); stopResendCooldown(); var el2 = $('resendLink'); if (el2) { el2.classList.remove('disabled'); el2.textContent = t('au_resend'); } });
}
function submitVerify() {
  authErrMsg = '';
  var code = ($('avCode').value || '').trim();
  if (!code) return authErr('Enter the code from your email.');
  authBusy('btnVerify', true, 'Verifying…');
  sbVerifyOtp(verifyEmail, code).then(function () {
    if (otpMode === 'login2fa') return _afterServerLogin(verifyEmail).then(function (r) { finishAuth('Welcome back, ' + r.name.split(' ')[0] + '!'); });
    if (otpMode === 'upgrade') {
      return sbUpdateUser({ password: pendingReg.pass, data: { has_password: true } }).catch(function () {}).then(function () { return _afterServerLogin(verifyEmail); })
        .then(function (r) { pendingReg = null; finishAuth('You’re all set, ' + r.name.split(' ')[0] + '. Your account is now secured on the server.'); });
    }
    // sign-up: save the password on the server, then reuse this email's member ID if it already had one
    return sbUpdateUser({ password: pendingReg.pass, data: { has_password: true } }).catch(function () {}).then(function () {
      return _afterServerLogin(pendingReg.email, pendingReg.name);
    }).then(function (r) {
      var fresh = r._new; delete r._new; pendingReg = null;
      if (!fresh) return finishAuth('Welcome back, ' + r.name.split(' ')[0] + '! That email already had an account, so you’re signed in to it.');
      authStage = 'onboard'; renderAuth();
    });
  }).catch(function (e2) {
    authBusy('btnVerify', false);
    authErr(e2.message || 'That code is incorrect or has expired.');
  });
}
/* After a server login: the server profile (by user id, then email) is who you are, so the
   same person always gets the same Member ID on every device. Builds/refreshes the local record. */
function _afterServerLogin(email, newName) {
  email = String(email).toLowerCase();
  var uid = sbSession && sbSession.user.id;
  var byUser = sbRest('profiles?user_id=eq.' + encodeURIComponent(uid) + '&select=member_id,name,private,email').catch(function () { return []; });
  return byUser.then(function (rows) {
    if (rows && rows[0]) return rows[0];
    return sbRest('profiles?email=eq.' + encodeURIComponent(email) + '&select=member_id,name,private,email').then(function (r2) { return r2 && r2[0]; }, function () { return null; });
  }).then(function (p) {
    var users = loadUsers(), rec = users[email], isNew = !p && !(rec && rec.memberId);
    var idP = p ? Promise.resolve(p.member_id) : (rec && rec.memberId ? Promise.resolve(rec.memberId) : genMemberIdUnique());
    return idP.then(function (memberId) {
      rec = rec || { favorites: [], joined: [], avatar: null, emailNotif: true, twofa: false };
      if (rec.memberId && rec.memberId !== memberId) rec.joined = [];      // a stray second ID → the server's memberships win
      rec.memberId = memberId; rec.email = email;
      rec.name = rec.name || (p && p.name) || newName || email.split('@')[0];
      if (p) rec.private = !!p.private;
      if (sbSession && sbSession.user.meta) rec.twofa = !!sbSession.user.meta.twofa || !!rec.twofa;
      delete rec.pass;                                                     // passwords live on the server now
      users[email] = rec; saveUsers(users);
      setSession(rec); renderAuthArea();
      if (typeof refreshAdminFlag === 'function') refreshAdminFlag();
      if (isNew) rec._new = true;
      return rec;
    });
  });
}
function submitOnboard() {
  currentUser.school = ($('aoSchool').value || '').trim();
  currentUser.district = ($('aoDistrict').value || '').trim();
  currentUser.zip = ($('aoZip').value || '').trim();
  var lang = $('aoLang').value; currentUser.lang = lang; applyLanguage(lang);
  persistUser();
  finishAuth('Welcome, ' + currentUser.name.split(' ')[0] + '! Your Member ID is ' + currentUser.memberId + '.');
  if (typeof onLanguageChanged === 'function') onLanguageChanged();
}

function finishAuth(msg) {
  renderAuthArea();
  closeAuth();
  if (msg) toast(msg);
  var act = pendingAuthAction; pendingAuthAction = null;
  if (typeof act === 'function') act();
  if (typeof refreshFavUI === 'function') refreshFavUI();
}

/* Confirm first, then log out and land on the Main Page (never a blank view). */
function logout() {
  openConfirm('Log out?', 'Are you sure you want to log out of Student Club Hub?', ICON_LOGOUT, doLogout);
}
function doLogout() {
  persistUser();
  currentUser = null;
  if (typeof sbSignOut === 'function') sbSignOut();
  if (typeof isAdminUser !== 'undefined') isAdminUser = false;
  clearSessionEmail();
  // Reset guest UI to the Light + English defaults
  applyTheme('light'); applyLanguage('en');
  renderAuthArea();
  if (typeof onLanguageChanged === 'function') onLanguageChanged();
  if (typeof refreshFavUI === 'function') refreshFavUI();
  showView('main');
  toast('You’ve been logged out.');
}

/* Gate an action behind login; resume it automatically after auth succeeds. */
function requireAuth(cb) {
  if (currentUser) { if (typeof cb === 'function') cb(); return true; }
  pendingAuthAction = cb || null;
  openAuth('login');
  return false;
}

/* ============================================================
   HEADER AUTH AREA
   ============================================================ */
function renderAuthArea() {
  if (typeof updateInboxFab === 'function') updateInboxFab();
  var area = $('authArea'); if (!area) return;
  if (!currentUser) {
    area.innerHTML =
      '<button class="btn header-outline" onclick="openAuth(\'login\')">Log In</button>' +
      '<button class="btn header-outline" onclick="openAuth(\'signup\')">Sign Up</button>';
    return;
  }
  area.innerHTML =
    '<button class="user-chip" onclick="openSettings()" title="Account settings">' +
      avatarHTML(currentUser.name, 'sm') +
      '<span class="name">' + escHtml(currentUser.name.split(' ')[0]) + '</span>' +
    '</button>' +
    (typeof isAdminUser !== 'undefined' && isAdminUser ? '<button class="logout-btn admin-btn" title="Admin' + (adminTodo ? ': ' + adminTodo + ' waiting' : '') + '" onclick="openAdmin()">' + svgIcon('lock', 16) + '<span>Admin</span>' +
      (adminTodo ? '<b class="admin-count">' + (adminTodo > 99 ? '99+' : adminTodo) + '</b>' : '') + '</button>' : '') +
    '<button id="logoutBtn" class="logout-btn" title="' + escAttr(t('set_logout')) + '" onclick="logout()">' + ICON_LOGOUT + '<span>' + t('set_logout') + '</span></button>';
}

/* ============================================================
   FAVORITES (data layer - UI lives in directory/modal/profile)
   ============================================================ */
function isFavorite(clubId) { return !!(currentUser && currentUser.favorites.indexOf(clubId) !== -1); }
function toggleFavorite(clubId) {
  if (!currentUser) { pendingAuthAction = function () { toggleFavorite(clubId); }; openAuth('login'); return; }
  var i = currentUser.favorites.indexOf(clubId);
  if (i === -1) { currentUser.favorites.push(clubId); toast('Saved to your list ✓'); }
  else { currentUser.favorites.splice(i, 1); toast('Removed from Saved'); }
  persistUser();
  if (typeof refreshFavUI === 'function') refreshFavUI();
}
function isJoined(clubId) { return !!(currentUser && currentUser.joined.indexOf(clubId) !== -1); }

