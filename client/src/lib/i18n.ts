export type Language = 'ar' | 'en';
export const LANGUAGE_KEY = 'kc_language';
export const DEFAULT_LANGUAGE: Language = 'en';

const enTranslations = {
    common: { arabic: 'Arabic', english: 'English', save: 'Save', cancel: 'Cancel', close: 'Close', yesSure: "Yes, I'm sure", areYouSure: 'Are you sure?', notSpecified: 'Not specified' },
    app: { notFound: 'Page not found' },
    home: { startNow: 'Start Now', exploreTemplates: 'Explore Templates', hostLogin: 'Host Login', hostName: 'Host Name', joinStudent: 'Student Join' },
    timer: { noTimer: 'No Timer', start: 'Start Timer', pause: 'Pause', resume: 'Resume', add15: '+15 Seconds', up: 'Time is Up' },
    result: { draw: 'Draw', blueWins: 'Blue Team Wins', redWins: 'Red Team Wins', finalScore: 'Final Score', claimedLabels: 'Claimed Labels', playAgain: 'Play Again', backToTemplates: 'Back to Templates', reviewQuestions: 'Review Questions' },
    qtype: { fill: 'Short Answer', mcq: 'Multiple Choice', tf: 'True / False', image: 'Image Question', open: 'Open Question' },
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard' },
    team: { blue: 'Blue Team', red: 'Red Team' },
    template: { preview: 'Template Preview', covered: 'Covered Labels', questions: 'Questions', sourceBuiltIn: 'Built-in', sourceCommunity: 'Community', sourceCustom: 'Custom', languageArabic: 'Arabic', languageEnglish: 'English' },
    toast: { copyFailed: 'Copy failed', linkCopied: 'Link copied', questionSaved: 'Question saved', questionRequired: 'Question text is required' },
    hostLobby: { title: 'Lobby', subtitle: 'Share the code or join link with students, then start when everyone is ready.', startChallenge: 'Start Challenge', copyJoinLink: 'Copy Join Link', displayMode: 'Display Mode', backToDashboard: 'Back to Dashboard', participantsJoined: 'Joined Participants', noParticipants: 'No participants yet.', noParticipantsHint: 'Share the room code or join link with students.', noTeam: 'No Team' },
    joinQr: { roomCode: 'Room Code', copyJoinLink: 'Copy Join Link', openJoinPage: 'Open Join Page', scanToJoin: 'Scan the code to join quickly', qrJoinTitle: 'Join QR Code', showOnDisplay: 'Show on Display', qrAria: 'QR code to join room' },
    liveQuestion: { selectedLabel: 'Selected Label', noQuestions: 'No questions for this label', noQuestionsHint: 'Add a question, or pick another label to begin.', addQuestion: 'Add Question', chooseAnother: 'Choose Another Question', category: 'Category', difficulty: 'Difficulty', points: 'points', remainingForLabel: 'Remaining for this label', question: 'Question', answer: 'Answer', hint: 'Hint', revealAnswerHost: 'Reveal Answer (Host)', hideAnswer: 'Hide Answer', showToStudents: 'Show to Students', award: 'Award', skip: 'Skip Question', returnToBank: 'Return to Bank' },
    resultModal: { title: 'Result Details', code: 'Code', date: 'Date', winner: 'Winner', letters: 'Letters', totalQuestions: 'Total Questions', notAvailable: 'Not available yet', totalLetters: 'Total Letters', unusedLetters: 'Unused Letters', participants: 'Participants', participantList: 'Participants', copySummary: 'Copy Summary', exportResult: 'Export Result', deleteResult: 'Delete Result' },
    display: { roomNotFound: 'Room not found', checkRoomCode: 'Check the room code and try again.', backToHost: 'Back to host dashboard', turn: 'Turn', points: 'Points', board: 'Game Board', timer: 'Timer', letter: 'Letter', true: 'True', false: 'False', correctAnswer: 'Correct Answer', waitingNext: 'Waiting for next letter selection', roomCode: 'Room Code', participants: 'Participants', classroomMode: 'Classroom Display Mode', howToJoin: 'How to Join?', step1: 'Open the join page or scan the QR code', step2: 'Enter room code', step3: 'Type your name', step4: 'Wait for the challenge to start' },
    hostHeader: { title: 'Knowledge Connect', dashboard: 'Dashboard', welcome: 'Welcome,', classActivity: 'Class/Activity', organization: 'Organization', roomCode: 'Room Code', clickToCopy: 'Click to copy', appearanceMode: 'Appearance Mode', visualTheme: 'Visual Theme', appearanceLight: 'Light', appearanceBalanced: 'Balanced', appearanceDark: 'Dark', themeClassic: 'Classic', themeSchool: 'School', themeSpace: 'Space', themeRamadan: 'Ramadan', themeScience: 'Science', themeVivid: 'Vivid', startGame: 'Start Game', playAgain: 'Play Again', logout: 'Logout', copyStudentJoinLink: 'Copy student join link', openJoinPage: 'Open join page', copyDisplayLink: 'Copy display link', openDisplayScreen: 'Open display screen', code: 'Code', joinLink: 'Join Link', displayLink: 'Display Link' },
  } as const;

const translations = { en: enTranslations, ar: enTranslations } as const;;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getLanguage(): Language { return 'en'; }
export function getDirection(_language = getLanguage()) { return 'ltr'; }
export function applyLanguage(language = getLanguage()) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }
}
export function setLanguage(_language: Language) { applyLanguage('en'); emit(); }
export function toggleLanguage() { setLanguage('en'); }
export function subscribeLanguage(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }

function pick(obj: any, path: string) { return path.split('.').reduce((acc, k) => acc?.[k], obj); }
export function t(key: string, language = getLanguage()): string {
  const val = pick(translations[language], key) ?? key;
  return typeof val === 'string' ? val : key;
}
export function getLabelForValue(group: 'qtype'|'difficulty', value: string, language = getLanguage()) { return t(`${group}.${value}`, language); }
