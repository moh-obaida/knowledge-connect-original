export type Language = 'ar' | 'en';
export const LANGUAGE_KEY = 'kc_language';
export const DEFAULT_LANGUAGE: Language = 'ar';

const translations = {
  ar: {
    common: {
      arabic: 'العربية', english: 'English', save: 'حفظ', cancel: 'إلغاء', close: 'إغلاق',
      yesSure: 'نعم، متأكد', areYouSure: 'هل أنت متأكد؟', notSpecified: 'غير محدد'
    },
    app: { notFound: 'الصفحة غير موجودة' },
    home: { startNow: 'ابدأ الآن', exploreTemplates: 'استكشف القوالب', hostLogin: 'دخول المضيف', hostName: 'اسم المضيف', joinStudent: 'انضمام الطالب' },
    timer: { noTimer: 'بدون مؤقت', start: 'بدء المؤقت', pause: 'إيقاف مؤقت', resume: 'استئناف', add15: '+15 ثانية', up: 'انتهى الوقت' },
    result: { draw: 'تعادل', blueWins: 'فاز الفريق الأزرق', redWins: 'فاز الفريق الأحمر', finalScore: 'النتيجة النهائية', claimedLabels: 'الحروف المحجوزة', playAgain: 'إعادة اللعب', backToTemplates: 'الرجوع للقوالب', reviewQuestions: 'مراجعة الأسئلة' },
    qtype: { fill: 'إجابة قصيرة', mcq: 'اختيار من متعدد', tf: 'صح أو خطأ', image: 'سؤال صورة', open: 'سؤال مفتوح' },
    difficulty: { easy: 'سهل', medium: 'متوسط', hard: 'صعب' },
    team: { blue: 'الفريق الأزرق', red: 'الفريق الأحمر' },
    template: { preview: 'معاينة القالب', covered: 'الحروف المغطاة', questions: 'الأسئلة', sourceBuiltIn: 'مدمج', sourceCommunity: 'مجتمعي', sourceCustom: 'مخصص', languageArabic: 'عربي', languageEnglish: 'إنجليزي' },
    toast: { copyFailed: 'فشل النسخ', linkCopied: 'تم نسخ الرابط', questionSaved: 'تم حفظ السؤال', questionRequired: 'نص السؤال مطلوب' },
  },
  en: {
    common: {
      arabic: 'Arabic', english: 'English', save: 'Save', cancel: 'Cancel', close: 'Close',
      yesSure: 'Yes, I\'m sure', areYouSure: 'Are you sure?', notSpecified: 'Not specified'
    },
    app: { notFound: 'Page not found' },
    home: { startNow: 'Start Now', exploreTemplates: 'Explore Templates', hostLogin: 'Host Login', hostName: 'Host Name', joinStudent: 'Student Join' },
    timer: { noTimer: 'No Timer', start: 'Start Timer', pause: 'Pause', resume: 'Resume', add15: '+15 Seconds', up: 'Time is Up' },
    result: { draw: 'Draw', blueWins: 'Blue Team Wins', redWins: 'Red Team Wins', finalScore: 'Final Score', claimedLabels: 'Claimed Labels', playAgain: 'Play Again', backToTemplates: 'Back to Templates', reviewQuestions: 'Review Questions' },
    qtype: { fill: 'Short Answer', mcq: 'Multiple Choice', tf: 'True / False', image: 'Image Question', open: 'Open Question' },
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    team: { blue: 'Blue Team', red: 'Red Team' },
    template: { preview: 'Template Preview', covered: 'Covered Labels', questions: 'Questions', sourceBuiltIn: 'Built-in', sourceCommunity: 'Community', sourceCustom: 'Custom', languageArabic: 'Arabic', languageEnglish: 'English' },
    toast: { copyFailed: 'Copy failed', linkCopied: 'Link copied', questionSaved: 'Question saved', questionRequired: 'Question text is required' },
  }
} as const;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getLanguage(): Language {
  const raw = typeof window !== 'undefined' ? localStorage.getItem(LANGUAGE_KEY) : null;
  return raw === 'en' || raw === 'ar' ? raw : DEFAULT_LANGUAGE;
}
export function getDirection(language = getLanguage()) { return language === 'ar' ? 'rtl' : 'ltr'; }
export function applyLanguage(language = getLanguage()) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = getDirection(language);
  }
}
export function setLanguage(language: Language) {
  if (typeof window !== 'undefined') localStorage.setItem(LANGUAGE_KEY, language);
  applyLanguage(language);
  emit();
}
export function toggleLanguage() { setLanguage(getLanguage() === 'ar' ? 'en' : 'ar'); }
export function subscribeLanguage(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

function pick(obj: any, path: string) { return path.split('.').reduce((acc, k) => acc?.[k], obj); }
export function t(key: string, language = getLanguage()): string {
  const primary = pick(translations[language], key);
  const fallback = pick(translations[language === 'ar' ? 'en' : 'ar'], key);
  const val = primary ?? fallback ?? key;
  if (val === undefined || val === null) return key;
  const s = String(val);
  return s === 'undefined' || s === 'null' || s === 'NaN' ? key : s;
}
export function getLabelForValue(group: 'qtype'|'difficulty', value: string, language = getLanguage()) { return t(`${group}.${value}`, language); }
