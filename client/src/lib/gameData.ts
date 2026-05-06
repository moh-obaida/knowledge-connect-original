export type GameQuestion = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: string;
  type: "letter" | "word";
};

export type GameTemplate = {
  id: string;
  title: string;
  description: string;
  difficulty: "Beginner" | "Intermediate";
  category: "Beginner" | "Sounds" | "Shapes" | "Words" | "Revision";
  questions: GameQuestion[];
  source: "official" | "community" | "custom";
};

export const officialTemplates: GameTemplate[] = [
  {
    id: "haa-waw-yaa",
    title: "Haa, Waw, Yaa Practice",
    description: "Spot هـ و ي with letters and words.",
    difficulty: "Beginner",
    category: "Beginner",
    source: "official",
    questions: [
      { id: "q1", text: "Which letter is هـ?", options: ["هـ", "و", "ي", "ب"], correctAnswer: "هـ", type: "letter" },
      { id: "q2", text: "Which letter is و?", options: ["ن", "و", "م", "ت"], correctAnswer: "و", type: "letter" },
      { id: "q3", text: "Which letter is ي?", options: ["ي", "ر", "س", "ل"], correctAnswer: "ي", type: "letter" },
      { id: "q4", text: "Which word starts with هـ?", options: ["هلال", "ورد", "يد", "باب"], correctAnswer: "هلال", type: "word" },
      { id: "q5", text: "Which word starts with و?", options: ["ورد", "قمر", "بيت", "سمك"], correctAnswer: "ورد", type: "word" },
      { id: "q6", text: "Which word starts with ي?", options: ["يد", "قلم", "نار", "زهرة"], correctAnswer: "يد", type: "word" },
      { id: "q7", text: "Complete the word: _لال", options: ["هـ", "و", "ي", "م"], correctAnswer: "هـ", type: "letter" },
      { id: "q8", text: "Complete the word: _رد", options: ["و", "ي", "ب", "ن"], correctAnswer: "و", type: "letter" },
    ],
  },
  { id: "arabic-basics", title: "Arabic Letters Basics", description: "Identify common letters in playful rounds.", difficulty: "Beginner", category: "Beginner", source: "official", questions: [
    { id: "ab1", text: "Pick the letter أ", options: ["ب", "أ", "د", "و"], correctAnswer: "أ", type: "letter" },
    { id: "ab2", text: "Pick the letter ب", options: ["ن", "ب", "ر", "س"], correctAnswer: "ب", type: "letter" },
    { id: "ab3", text: "Pick the letter ت", options: ["ث", "ت", "ل", "ح"], correctAnswer: "ت", type: "letter" },
  ]},
  { id: "missing-letter", title: "Missing Letter Challenge", description: "Complete mini words with the right starting letter.", difficulty: "Intermediate", category: "Words", source: "official", questions: [
    { id: "ml1", text: "Complete: _اب", options: ["ب", "ك", "د", "ت"], correctAnswer: "ب", type: "letter" },
    { id: "ml2", text: "Complete: _مل", options: ["ر", "ج", "ح", "أ"], correctAnswer: "ج", type: "letter" },
    { id: "ml3", text: "Complete: _لم", options: ["ق", "ن", "م", "ز"], correctAnswer: "ق", type: "letter" },
  ]},
  { id: "starts-word", title: "What Letter Starts the Word?", description: "Find the first letter quickly.", difficulty: "Beginner", category: "Words", source: "official", questions: [
    { id: "sw1", text: "What letter starts: بيت", options: ["ي", "ب", "ت", "ر"], correctAnswer: "ب", type: "letter" },
    { id: "sw2", text: "What letter starts: ورد", options: ["و", "ر", "د", "ف"], correctAnswer: "و", type: "letter" },
    { id: "sw3", text: "What letter starts: سمك", options: ["ش", "س", "م", "ك"], correctAnswer: "س", type: "letter" },
  ]},
  { id: "sound-match", title: "Match the Sound", description: "Choose the letter that matches the sound clue.", difficulty: "Beginner", category: "Sounds", source: "official", questions: [
    { id: "sm1", text: "Pick the letter sound: /haa/", options: ["ح", "هـ", "خ", "ه"], correctAnswer: "ه", type: "letter" },
    { id: "sm2", text: "Pick the letter sound: /yaa/", options: ["ب", "ي", "ث", "و"], correctAnswer: "ي", type: "letter" },
  ]},
  { id: "shape-practice", title: "Letter Shape Practice", description: "Recognize different letter shapes.", difficulty: "Intermediate", category: "Shapes", source: "official", questions: [
    { id: "sh1", text: "Which one is a rounded shape letter?", options: ["و", "ل", "ا", "د"], correctAnswer: "و", type: "letter" },
    { id: "sh2", text: "Which letter has two dots above?", options: ["ت", "ب", "ن", "ي"], correctAnswer: "ت", type: "letter" },
  ]},
  { id: "forms", title: "Beginning, Middle, End Letter Forms", description: "Practice forms in different positions.", difficulty: "Intermediate", category: "Shapes", source: "official", questions: [
    { id: "fo1", text: "Choose beginning form of هـ", options: ["هـ", "ه", "ـه", "ـهـ"], correctAnswer: "هـ", type: "letter" },
    { id: "fo2", text: "Choose middle form of ي", options: ["ي", "ـي", "ـيـ", "يـ"], correctAnswer: "ـيـ", type: "letter" },
  ]},
  { id: "quick-revision", title: "Quick Revision Game", description: "Fast mixed review round.", difficulty: "Beginner", category: "Revision", source: "official", questions: [
    { id: "qr1", text: "Pick letter م", options: ["س", "ع", "م", "ح"], correctAnswer: "م", type: "letter" },
    { id: "qr2", text: "Word starts with ب?", options: ["باب", "نور", "يوم", "فم"], correctAnswer: "باب", type: "word" },
  ]},
];

export const communityTemplates: GameTemplate[] = [
  { id: "com-1", title: "Grade 1 Letter Warm-Up", description: "Easy opening round for first graders.", difficulty: "Beginner", category: "Beginner", source: "community", questions: officialTemplates[1].questions },
  { id: "com-2", title: "Haa vs Waw vs Yaa", description: "Fast compare game for هـ و ي.", difficulty: "Beginner", category: "Sounds", source: "community", questions: officialTemplates[0].questions.slice(0, 4) },
  { id: "com-3", title: "Find the First Letter", description: "Pick the first letter in each word.", difficulty: "Beginner", category: "Words", source: "community", questions: officialTemplates[3].questions },
  { id: "com-4", title: "Arabic Letter Shapes", description: "Identify letters by their shapes.", difficulty: "Intermediate", category: "Shapes", source: "community", questions: officialTemplates[5].questions },
  { id: "com-5", title: "Fast Letter Review", description: "Quick mixed revision set.", difficulty: "Beginner", category: "Revision", source: "community", questions: officialTemplates[7].questions },
];

export const allTemplates = [...officialTemplates, ...communityTemplates];
