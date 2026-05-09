export type Language = 'ar' | 'en';
export const LANGUAGE_KEY = 'kc_language';
export const DEFAULT_LANGUAGE: Language = 'ar';

const arTranslations = {
  common: { arabic: 'العربية', english: 'الإنجليزية', save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق', yesSure: 'نعم، متأكد', areYouSure: 'هل أنت متأكد؟', notSpecified: 'غير محدد' },
  app: { notFound: 'الصفحة غير موجودة' },
  home: { startNow: 'ابدأ الآن', exploreTemplates: 'استعرض القوالب', hostLogin: 'دخول المضيف', hostName: 'اسم المضيف', joinStudent: 'انضمام الطالب' },
  timer: { noTimer: 'بدون مؤقت', start: 'بدء المؤقت', pause: 'إيقاف مؤقت', resume: 'استئناف', add15: '+15 ثانية', up: 'انتهى الوقت' },
  result: { draw: 'تعادل', blueWins: 'فوز الفريق الأزرق', redWins: 'فوز الفريق الأحمر', finalScore: 'النتيجة النهائية', claimedLabels: 'الحروف المحجوزة', playAgain: 'العب مجددًا', backToTemplates: 'العودة للقوالب', reviewQuestions: 'مراجعة الأسئلة' },
  qtype: { fill: 'إجابة قصيرة', mcq: 'اختيار من متعدد', tf: 'صح / خطأ', image: 'سؤال صورة', open: 'سؤال مفتوح' },
  difficulty: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' },
  team: { blue: 'الفريق الأزرق', red: 'الفريق الأحمر' },
  template: { preview: 'معاينة القالب', covered: 'الحروف المغطاة', questions: 'الأسئلة', sourceBuiltIn: 'مدمج', sourceCommunity: 'مجتمعي', sourceCustom: 'مخصص', languageArabic: 'العربية', languageEnglish: 'الإنجليزية' },
  toast: { copyFailed: 'فشل النسخ', linkCopied: 'تم نسخ الرابط', questionSaved: 'تم حفظ السؤال', questionRequired: 'نص السؤال مطلوب' },
  hostLobby: { title: 'ردهة الانتظار', subtitle: 'شارك الرمز أو رابط الانضمام مع الطلاب ثم ابدأ عندما يجهز الجميع.', startChallenge: 'ابدأ التحدي', copyJoinLink: 'نسخ رابط الانضمام', displayMode: 'وضع العرض', backToDashboard: 'العودة للوحة التحكم', participantsJoined: 'المشاركون المنضمون', noParticipants: 'لا يوجد مشاركون بعد.', noParticipantsHint: 'شارك رمز الغرفة أو رابط الانضمام مع الطلاب.', noTeam: 'بدون فريق' },
  joinQr: { roomCode: 'رمز الغرفة', copyJoinLink: 'نسخ رابط الانضمام', openJoinPage: 'فتح صفحة الانضمام', scanToJoin: 'امسح الرمز للانضمام بسرعة', qrJoinTitle: 'رمز QR للانضمام', showOnDisplay: 'عرض على الشاشة', qrAria: 'رمز QR للانضمام إلى الغرفة' },
  liveQuestion: { selectedLabel: 'الحرف المحدد', noQuestions: 'لا توجد أسئلة لهذا الحرف', noQuestionsHint: 'أضف سؤالًا أو اختر حرفًا آخر للبدء.', addQuestion: 'إضافة سؤال', chooseAnother: 'اختر سؤالًا آخر', category: 'الفئة', difficulty: 'الصعوبة', points: 'نقطة', remainingForLabel: 'المتبقي لهذا الحرف', question: 'السؤال', answer: 'الإجابة', hint: 'تلميح', revealAnswerHost: 'إظهار الإجابة (للمضيف)', hideAnswer: 'إخفاء الإجابة', showToStudents: 'عرض للطلاب', award: 'منح النقاط', skip: 'تخطي السؤال', returnToBank: 'إرجاع إلى بنك الأسئلة' },
  resultModal: { title: 'تفاصيل النتيجة', code: 'الرمز', date: 'التاريخ', winner: 'الفائز', letters: 'الحروف', totalQuestions: 'إجمالي الأسئلة', notAvailable: 'غير متاح بعد', totalLetters: 'إجمالي الحروف', unusedLetters: 'الحروف غير المستخدمة', participants: 'المشاركون', participantList: 'قائمة المشاركين', copySummary: 'نسخ الملخص', exportResult: 'تصدير النتيجة', deleteResult: 'حذف النتيجة' },
  display: { roomNotFound: 'الغرفة غير موجودة', checkRoomCode: 'تحقق من رمز الغرفة وحاول مرة أخرى.', backToHost: 'العودة إلى لوحة المضيف', turn: 'الدور الحالي', points: 'النقاط', board: 'لوحة الحروف', timer: 'المؤقت', letter: 'الحرف', true: 'صح', false: 'خطأ', correctAnswer: 'الإجابة الصحيحة', waitingNext: 'بانتظار اختيار الحرف التالي', roomCode: 'رمز الغرفة', participants: 'المشاركون', classroomMode: 'وضع العرض الصفي', howToJoin: 'طريقة الانضمام', step1: 'افتح صفحة الانضمام أو امسح رمز QR', step2: 'أدخل رمز الغرفة', step3: 'اكتب اسمك', step4: 'انتظر بدء التحدي' },
  hostHeader: { title: 'وصلة المعرفة', dashboard: 'لوحة التحكم', welcome: 'مرحبًا،', classActivity: 'الصف/الفعالية', organization: 'المدرسة/الجهة', roomCode: 'رمز الغرفة', clickToCopy: 'انقر للنسخ', appearanceMode: 'نمط المظهر', visualTheme: 'السمة البصرية', appearanceLight: 'فاتح', appearanceBalanced: 'متوازن', appearanceDark: 'داكن', themeClassic: 'كلاسيكي', themeSchool: 'مدرسي', themeSpace: 'فضائي', themeRamadan: 'رمضان', themeScience: 'علوم', themeVivid: 'حيوي', startGame: 'بدء اللعبة', playAgain: 'العب مجددًا', logout: 'العودة للرئيسية', copyStudentJoinLink: 'نسخ رابط انضمام الطلاب', openJoinPage: 'فتح صفحة الانضمام', copyDisplayLink: 'نسخ رابط العرض', openDisplayScreen: 'فتح شاشة العرض', code: 'الرمز', joinLink: 'رابط الانضمام', displayLink: 'رابط العرض' },
  join: {
    joinChallenge: 'انضم الآن',
    subtitle: 'أدخل رمز الغرفة الستّي واسمك للمشاركة في التحدي.',
    joinRoom: 'الانضمام إلى الغرفة',
    sixDigits: '١٢٣٤٥٦',
    yourName: 'اسمك',
    enterYourName: 'اكتب اسمك كما تريد أن يظهر',
    joining: 'جاري الانضمام…',
    askHostCode: 'اطلب رمز الغرفة من المعلم أو المضيف إن لم يكن لديك.',
    howToJoin: 'كيفية الانضمام',
    step1: 'احصل على رمز الغرفة (٦ أرقام) من المعلم.',
    step2: 'أدخل الرمز في الحقل أعلاه.',
    step3: 'اكتب اسمك ثم اضغط «انضم الآن».',
    areYouHost: 'هل أنت المعلم؟',
    backDashboard: 'العودة إلى لوحة التحكم',
    enterRoomCode: 'يرجى إدخال رمز الغرفة.',
    roomCode6: 'رمز الغرفة يجب أن يكون ٦ أرقامًا.',
    enterName: 'يرجى إدخال اسمك.',
    serviceUnavailable: 'تعذر الاتصال بالخدمة. تحقق من إعداد التطبيق.',
    serviceRetry: 'الخدمة غير متاحة. حاول لاحقًا.',
    roomNotFound: 'الغرفة غير موجودة أو الرمز غير صحيح.',
    connectRoomFailed: 'تعذر الانضمام. تحقق من الرمز والاتصال.',
    joinError: 'حدث خطأ أثناء الانضمام. حاول مرة أخرى.',
  },
} as const;

const translations = { ar: arTranslations, en: arTranslations } as const;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getLanguage(): Language { return 'ar'; }
export function getDirection(_language = getLanguage()) { return 'rtl'; }
export function applyLanguage(_language = getLanguage()) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
  }
}
export function setLanguage(_language: Language) { applyLanguage('ar'); emit(); }
export function toggleLanguage() { setLanguage('ar'); }
export function subscribeLanguage(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

function pick(obj: any, path: string) { return path.split('.').reduce((acc, k) => acc?.[k], obj); }
export function t(key: string, language = getLanguage()): string {
  const val = pick(translations[language], key) ?? pick(translations.ar, key);
  return typeof val === 'string' ? val : 'النص غير متوفر';
}
export function getLabelForValue(group: 'qtype'|'difficulty', value: string, language = getLanguage()) { return t(`${group}.${value}`, language); }
