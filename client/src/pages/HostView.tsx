import { useState, useEffect, useRef, useCallback } from "react";
import {
  createRoom, generateUniqueCode, updateRoom, subscribeToRoom, deleteRoom,
  addPlayerManually, assignPlayerTeam, removePlayer,
} from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  defaultRoomState, generateBoard, shuffleBoard, sortedBoard, checkWinner, findWinningPath,
  loadLastRoomCode, saveLastRoomCode,
  type RoomState, type BoardCell, type ActiveQuestion, type Player,
} from "../lib/store";
import HexBoard from "../components/HexBoard";
import { showToast } from "../components/KcToast";
import { safeLoad, safeRemove, safeSave } from "../lib/localData";

// ── URL helpers ───────────────────────────────────────────────
const BASE_URL = (import.meta.env.VITE_PUBLIC_APP_URL as string) || window.location.origin;
const joinLink = (code: string) => `${BASE_URL}/join?room=${code}`;
const displayLink = (code: string) => `${BASE_URL}/participant?room=${code}`;

function copyText(text: string, label: string) {
  navigator.clipboard.writeText(text)
    .then(() => showToast.success(`تم نسخ ${label} ✓`))
    .catch(() => showToast.error("فشل النسخ"));
}

// ── Confirm modal ─────────────────────────────────────────────
function ConfirmModal({ msg, onYes, onNo }: { msg: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="modal-overlay" onClick={onNo}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: "1rem" }}>⚠️</div>
        <div style={{ fontWeight: 600, color: "#f0ede8", textAlign: "center", marginBottom: "1.5rem", lineHeight: 1.7 }}>{msg}</div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button className="btn-danger" onClick={onYes}>نعم، متأكد</button>
          <button className="btn-secondary" onClick={onNo}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ── Cell question editor ──────────────────────────────────────
function CellEditor({ cell, onSave, onClose }: {
  cell: BoardCell; onSave: (u: Partial<BoardCell>) => void; onClose: () => void;
}) {
  type BankQ = { question:string; answer:string; category:string; difficulty: BoardCell["difficulty"]; points:number; hint:string; explanation:string };
  const normalized = (): BankQ[] => {
    const arr = Array.isArray((cell as any).questionBank) ? (cell as any).questionBank : [];
    const mapped = arr.filter((x:any)=>x?.question).map((x:any)=>({
      question: String(x.question||"").trim(),
      answer: String(x.answer||"").trim(),
      category: String(x.category||"غير مصنف").trim() || "غير مصنف",
      difficulty: (x.difficulty==="easy"||x.difficulty==="medium"||x.difficulty==="hard") ? x.difficulty : "medium",
      points: Number(x.points)||1,
      hint: String(x.hint||""),
      explanation: String(x.explanation||""),
    }));
    if (mapped.length) return mapped;
    if (cell.question.trim()) return [{ question:cell.question, answer:cell.answer, category:cell.category||"غير مصنف", difficulty:cell.difficulty, points:cell.points||1, hint:cell.hint||"", explanation:cell.explanation||"" }];
    return [];
  };
  const [questionBank, setQuestionBank] = useState<BankQ[]>(normalized());
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [q, setQ] = useState(cell.question);
  const [a, setA] = useState(cell.answer);
  const [cat, setCat] = useState(cell.category);
  const [diff, setDiff] = useState(cell.difficulty);
  const [pts, setPts] = useState(cell.points);
  const [hint, setHint] = useState(cell.hint);
  const [expl, setExpl] = useState(cell.explanation);

  const save = () => {
    if (!q.trim()) { showToast.error("نص السؤال مطلوب"); return; }
    if (!a.trim()) { showToast.error("الإجابة الصحيحة مطلوبة"); return; }
    const firstAnswerChar = a.trim().charAt(0);
    if (firstAnswerChar && firstAnswerChar !== cell.label) {
      showToast.warning("تنبيه: الإجابة لا تبدأ بالحرف المحدد.");
    }
    const next = [...questionBank];
    const payload = { question: q.trim(), answer: a.trim(), category: (cat.trim()||"غير مصنف"), difficulty: diff, points: Number(pts)||1, hint: hint.trim(), explanation: expl.trim() } as BankQ;
    if (editingIndex >= 0) next[editingIndex] = payload;
    else {
      if (next.length >= 50) { showToast.warning("وصلت إلى الحد الأقصى لهذا الحرف: 50 سؤالًا."); return; }
      next.push(payload);
    }
    setQuestionBank(next);
    setEditingIndex(next.length-1);
    onSave({ question: next[0].question, answer: next[0].answer, category: next[0].category, difficulty: next[0].difficulty, points: next[0].points, hint: next[0].hint, explanation: next[0].explanation, ...( { questionBank: next } as any) });
    showToast.success("تم حفظ السؤال");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box-scroll" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header-safe" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
          <div style={{ fontWeight:800, fontSize:"1.1rem", color:"#f59e0b" }}>إعداد سؤال الحرف: <span style={{ fontSize:"1.4rem" }}>{cell.label}</span></div>
          <button onClick={onClose} aria-label="إغلاق" style={{ background:"#141e2d", border:"1px solid #253347", color:"#cbd5e1", fontSize:"1.2rem", width:34, height:34, borderRadius:"9999px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, zIndex:5 }}>✕</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.85rem" }}>
          <div style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.6rem" }}>
            <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#f59e0b", marginBottom:"0.35rem" }}>بنك أسئلة الحرف</div>
            <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginBottom:"0.45rem" }}>عدد الأسئلة: {questionBank.length} / 50</div>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.3rem", maxHeight:130, overflowY:"auto" }}>
              {questionBank.map((item, i)=>(
                <div key={i} style={{ display:"flex", gap:"0.35rem", alignItems:"center" }}>
                  <button className="btn-secondary" style={{ fontSize:"0.68rem", padding:"0.2rem 0.45rem" }} onClick={()=>{ setEditingIndex(i); setQ(item.question); setA(item.answer); setCat(item.category); setDiff(item.difficulty); setPts(item.points); setHint(item.hint); setExpl(item.explanation); }}>تعديل</button>
                  <button className="btn-danger" style={{ fontSize:"0.68rem", padding:"0.2rem 0.45rem" }} onClick={()=>{ const next=questionBank.filter((_,ix)=>ix!==i); setQuestionBank(next); const first=next[0]; onSave(first?{ question:first.question, answer:first.answer, category:first.category, difficulty:first.difficulty, points:first.points, hint:first.hint, explanation:first.explanation, ...( { questionBank: next } as any)}:{ question:"", answer:"", category:"", difficulty:"easy", points:1, hint:"", explanation:"", ...( { questionBank: [] } as any)}); }}>حذف</button>
                  <div style={{ fontSize:"0.75rem", color:"#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.question}</div>
                </div>
              ))}
            </div>
            <button className="btn-gold" style={{ fontSize:"0.72rem", marginTop:"0.45rem" }} onClick={()=>{ setEditingIndex(-1); setQ(""); setA(""); setCat("غير مصنف"); setDiff("medium"); setPts(1); setHint(""); setExpl(""); }}>إضافة سؤال</button>
          </div>
          <div>
            <label style={lbl}>نص السؤال *</label>
            <textarea value={q} onChange={e=>setQ(e.target.value)} rows={3} placeholder="اكتب نص السؤال هنا..." className="kc-input" style={{ resize:"vertical" }} />
          </div>
          <div>
            <label style={lbl}>الإجابة الصحيحة *</label>
            <input value={a} onChange={e=>setA(e.target.value)} placeholder="اكتب الإجابة الصحيحة هنا..." className="kc-input" />
          </div>
          <div className="responsive-two-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
            <div>
              <label style={lbl}>التصنيف</label>
              <input value={cat} onChange={e=>setCat(e.target.value)} placeholder="اكتب التصنيف..." className="kc-input" />
            </div>
            <div>
              <label style={lbl}>مستوى الصعوبة</label>
              <select value={diff} onChange={e=>setDiff(e.target.value as BoardCell["difficulty"])} className="kc-input">
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>النقاط</label>
            <input type="number" min={1} max={100} value={pts} onChange={e=>setPts(Number(e.target.value))} className="kc-input" />
          </div>
          <div>
            <label style={lbl}>تلميح اختياري</label>
            <input value={hint} onChange={e=>setHint(e.target.value)} placeholder="اكتب تلميحًا اختياريًا..." className="kc-input" />
          </div>
          <div>
            <label style={lbl}>شرح اختياري</label>
            <textarea value={expl} onChange={e=>setExpl(e.target.value)} rows={2} placeholder="اكتب شرحًا اختياريًا..." className="kc-input" style={{ resize:"vertical" }} />
          </div>
          <div style={{ display:"flex", gap:"0.75rem", paddingTop:"0.5rem" }}>
            <button className="btn-gold" style={{ flex:1 }} onClick={save}>💾 تعديل السؤال</button>
            <button className="btn-danger" onClick={()=>onSave({ question:"", answer:"", category:"", difficulty:"easy", points:1, hint:"", explanation:"" })}>مسح</button>
            <button className="btn-secondary" onClick={onClose}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}
const lbl: React.CSSProperties = { display:"block", fontSize:"0.8rem", fontWeight:600, color:"#94a3b8", marginBottom:"0.35rem" };

type StarterTemplate = {
  id: string;
  name: string;
  categories: string[];
  level: "مبتدئ" | "سهل" | "متوسط" | "صعب" | "مفتوح";
  subject?: string;
  difficultyLabel?: "easy"|"medium"|"hard";
  estimatedMinutes?: number;
  visibility?: "local"|"public"|"private";
  favorite?: boolean;
  description: string;
  questions: string[];
  boardBanks?: Array<{ cellId:string; label:string; questionBank:any[] }>;
  createdAt?: string;
  updatedAt?: string;
  userCreated?: boolean;
};
type TemplateQuestionItem = {
  type?: "mcq"|"tf"|"fill"|"letter"|"image";
  letter?: string;
  question: string;
  answer: string;
  choices?: string[];
  imageUrl?: string;
  category?: string;
  difficulty?: BoardCell["difficulty"];
  hint?: string;
  explanation?: string;
};
const COMMUNITY_TEMPLATES_KEY = "knowledgeConnectCommunityTemplates";
const LAST_TEMPLATE_KEY = "kc_last_template";
const FAV_TEMPLATES_KEY = "kc_fav_templates";
const ARABIC_LETTERS_FULL = ["أ","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن","هـ","و","ي"];
const LETTER_WORDS: Record<string, string[]> = {
  "أ":["أمل","أدب","أفق"],"ب":["بدر","بيت","باب"],"ت":["تفاح","تعاون","تاريخ"],"ث":["ثعلب","ثقة","ثواب"],"ج":["جبل","جوال","جائزة"],"ح":["حكمة","حياة","حب"],
  "خ":["خريطة","خبر","خيار"],"د":["درس","دفتر","دور"],"ذ":["ذهب","ذوق","ذكاء"],"ر":["ربيع","رياضة","رسالة"],"ز":["زيتون","زمن","زهر"],"س":["سلام","سؤال","سماء"],
  "ش":["شمس","شجاعة","شبكة"],"ص":["صبر","صداقة","صورة"],"ض":["ضوء","ضمان","ضاد"],"ط":["طريق","طالب","طائرة"],"ظ":["ظلال","ظرف","ظبية"],"ع":["علم","عمل","عطاء"],
  "غ":["غيمة","غذاء","غاية"],"ف":["فكرة","فرح","فصل"],"ق":["قصة","قلم","قيمة"],"ك":["كتاب","كرة","كوكب"],"ل":["لغة","لطف","لوحة"],"م":["مدرسة","مكتبة","مستقبل"],
  "ن":["نخلة","نجاح","نشاط"],"هـ":["هلال","هاتف","هدوء"],"و":["وردة","وعد","وطن"],"ي":["يقين","يوم","يد"],
};
const ARABIC_LETTER_NORMALIZE: Record<string, string> = { "أ":"ا", "إ":"ا", "آ":"ا", "ٱ":"ا", "ة":"ه", "ى":"ي" };
const normalizeArabicLetter = (value?: string) => {
  const ch = (value || "").trim().charAt(0);
  return ARABIC_LETTER_NORMALIZE[ch] || ch;
};
const questionInitialLetter = (item: Partial<TemplateQuestionItem>) => {
  if (item.letter) return normalizeArabicLetter(item.letter);
  if (item.answer) return normalizeArabicLetter(item.answer);
  return "";
};
const createFullLetterTemplate = (id: string, name: string, category: string, level: "سهل" | "متوسط" | "صعب", density: 2 | 3 = 2): StarterTemplate => {
  const boardBanks = ARABIC_LETTERS_FULL.map((letter) => ({
    cellId: "",
    label: letter,
    questionBank: (LETTER_WORDS[letter] || [`كلمة ${letter}`]).slice(0, density).map((ans, idx) => ({
      letter,
      question: idx === 0
        ? `اذكر كلمة ${category === "تقنية" ? "تقنية " : ""}تبدأ بحرف ${letter}.`
        : `اذكر مثالًا آخر يبدأ بحرف ${letter}.`,
      answer: ans,
      category,
      difficulty: level === "سهل" ? "easy" : level === "صعب" ? "hard" : "medium",
      points: 1,
      hint: "",
      explanation: "",
    })),
  }));
  return { id, name, categories: [category], subject: category, level, difficultyLabel: level==="صعب"?"hard":level==="سهل"?"easy":"medium", estimatedMinutes: 12, visibility:"local", description: `قالب ${category} محلي.`, questions: boardBanks.map(b => b.questionBank[0].question), boardBanks };
};
const STARTER_TEMPLATES: StarterTemplate[] = [
  { id:"tpl-basic-letters", name:"قالب الحروف الأساسية", categories:["لغة عربية"], level:"مبتدئ", description:"لعبة بسيطة للتدرب على الحروف العربية.", questions:[], boardBanks:createFullLetterTemplate("x","x","لغة عربية","سهل",2).boardBanks },
  { id:"tpl-islamic", name:"قالب أسئلة إسلامية", categories:["تربية إسلامية"], level:"سهل", description:"أسئلة قصيرة عن القيم والأخلاق الإسلامية.", questions:[], boardBanks:createFullLetterTemplate("x","x","تربية إسلامية","سهل",2).boardBanks },
  { id:"tpl-arabic", name:"قالب اللغة العربية", categories:["لغة عربية"], level:"متوسط", description:"أسئلة عن الحروف والكلمات والمعاني.", questions:[], boardBanks:createFullLetterTemplate("x","x","لغة عربية","متوسط",3).boardBanks },
  { id:"tpl-science", name:"قالب العلوم", categories:["علوم"], level:"متوسط", description:"أسئلة مراجعة بسيطة في العلوم.", questions:[], boardBanks:createFullLetterTemplate("x","x","علوم","متوسط",2).boardBanks },
  { id:"tpl-quick", name:"قالب مراجعة سريعة", categories:["عام"], level:"سهل", description:"قالب سريع للمراجعة قبل الاختبار.", questions:[], boardBanks:createFullLetterTemplate("x","x","عام","سهل",2).boardBanks },
  { id:"tpl-empty", name:"قالب فارغ للمعلم", categories:["مخصص"], level:"مفتوح", description:"ابدأ من الصفر وأضف أسئلتك الخاصة.", questions:[], boardBanks:[] },
];
const DEMO_COMMUNITY_TEMPLATES: StarterTemplate[] = [
  { id:"comm-1", name:"تحدي الحروف الممتع", categories:["لغة عربية"], level:"سهل", description:"نسخة مجتمع محلية لتدريب القراءة السريعة.", questions:[], boardBanks:createFullLetterTemplate("x","x","لغة عربية","سهل",2).boardBanks },
  { id:"comm-2", name:"مراجعة القيم الإسلامية", categories:["تربية إسلامية"], level:"سهل", description:"بطاقات سريعة عن السلوك والقيم اليومية.", questions:[], boardBanks:createFullLetterTemplate("x","x","تربية إسلامية","سهل",2).boardBanks },
  { id:"comm-3", name:"مسابقة الكلمات السريعة", categories:["لغة عربية"], level:"متوسط", description:"تحدي كلمات ومعانٍ بزمن قصير.", questions:[], boardBanks:createFullLetterTemplate("x","x","لغة عربية","متوسط",2).boardBanks },
  { id:"comm-4", name:"تحدي العلوم الخفيف", categories:["علوم"], level:"متوسط", description:"مراجعة تمهيدية لمفاهيم العلوم الأساسية.", questions:[], boardBanks:createFullLetterTemplate("x","x","علوم","متوسط",2).boardBanks },
];

// ── Color presets ─────────────────────────────────────────────
const COLOR_PRESETS = [
  "#16a34a","#22c55e","#15803d","#166534",
  "#2563eb","#3b82f6","#1d4ed8","#1e40af",
  "#dc2626","#ef4444","#b91c1c","#7f1d1d",
  "#d97706","#f59e0b","#b45309","#92400e",
  "#7c3aed","#8b5cf6","#6d28d9","#4c1d95",
  "#0891b2","#06b6d4","#0e7490","#164e63",
  "#be185d","#ec4899","#9d174d","#831843",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"0.5rem" }}>
        {COLOR_PRESETS.map(c => (
          <div key={c} onClick={()=>onChange(c)} style={{
            width:28, height:28, borderRadius:"6px", background:c, cursor:"pointer",
            border: value===c ? "3px solid #f59e0b" : "2px solid transparent",
            transition:"transform 0.1s ease",
          }}
          onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.15)")}
          onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}
          />
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
        <input type="color" value={value} onChange={e=>onChange(e.target.value)}
          style={{ width:36, height:32, border:"none", borderRadius:"6px", cursor:"pointer", background:"none" }} />
        <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>اللون المختار</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOST VIEW
// ═══════════════════════════════════════════════════════════════
export default function HostView() {
  type LocalProfile = { hostName: string; className?: string; orgName?: string };
  type SavedGame = {
    id: string;
    title: string;
    category: string;
    questionCount: number;
    createdAt: string;
    updatedAt: string;
    source: "custom" | "template" | "imported";
    hostName?: string;
    className?: string;
    state: RoomState;
  };
  type GameResult = {
    id: string;
    gameTitle: string;
    at: string;
    hostName: string;
    className?: string;
    winner: string;
    blueTeamName: string;
    redTeamName: string;
    blueClaimed: number;
    redClaimed: number;
    totalClaimed: number;
    skippedQuestions: number;
    totalQuestionsUsed: number;
    durationSec: number;
    sourceGameId?: string;
  };
  const PROFILE_KEY = "kc_local_profile";
  const SESSION_KEY = "kc_local_session";
  const GAMES_KEY = "kc_saved_games";
  const RESULTS_KEY = "kc_results_history";
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"setup"|"game"|"settings">("setup");
  const [editingCell, setEditingCell] = useState<BoardCell | null>(null);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<(()=>void)|null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<StarterTemplate | null>(null);
  const [communityTemplates, setCommunityTemplates] = useState<StarterTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateLevel, setTemplateLevel] = useState("");
  const [templateSort, setTemplateSort] = useState<"newest"|"title"|"questions"|"difficulty">("newest");
  const [favTemplateIds, setFavTemplateIds] = useState<string[]>([]);
  const [questionSearch, setQuestionSearch] = useState("");
  const [questionCategoryFilter, setQuestionCategoryFilter] = useState("");
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState<""|"easy"|"medium"|"hard">("");
  const [bulkQuestions, setBulkQuestions] = useState("");
  const [bulkPreview, setBulkPreview] = useState<Array<{label:string; question:string; answer:string; error?:string}>>([]);
  const [appView, setAppView] = useState<"dashboard"|"host"|"templates"|"games"|"results"|"settings">("dashboard");
  const [profile, setProfile] = useState<LocalProfile>({ hostName: "", className: "", orgName: "" });
  const [isLogged, setIsLogged] = useState(false);
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [searchGame, setSearchGame] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [results, setResults] = useState<GameResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<GameResult | null>(null);
  const startedAtRef = useRef<number>(0);
  const savedResultForRoundRef = useRef<string>("");
  const [presentationMode, setPresentationMode] = useState(false);
  const [skippedCount, setSkippedCount] = useState(0);
  const [gameMode, setGameMode] = useState<"classic"|"timed"|"practice"|"challenge">("classic");
  const [currentStreak, setCurrentStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [timerCustom, setTimerCustom] = useState(45);
  const [winningPathIds, setWinningPathIds] = useState<string[]>([]);
  const [appearance, setAppearance] = useState<"dark"|"light"|"soft"|"contrast">("dark");
  const unsubRef = useRef<(()=>void)|null>(null);
  const roomRef = useRef<RoomState|null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => {
    const p = localStorage.getItem(PROFILE_KEY);
    const s = localStorage.getItem(SESSION_KEY);
    const g = localStorage.getItem(GAMES_KEY);
    if (p) setProfile(JSON.parse(p));
    if (s === "1") setIsLogged(true);
    if (g) {
      const parsed = JSON.parse(g);
      if (Array.isArray(parsed)) {
        const migrated = parsed
          .filter((item) => item && typeof item === "object")
          .map((item: any) => ({
            id: String(item.id || `g_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`),
            title: String(item.title || item.state?.gameTitle || "لعبة محفوظة"),
            category: String(item.category || "عام"),
            questionCount: Number(item.questionCount || item.state?.board?.filter?.((c:any)=>c.question?.trim?.() || c.questionBank?.length)?.length || 0),
            createdAt: String(item.createdAt || item.updatedAt || new Date().toISOString()),
            updatedAt: String(item.updatedAt || item.createdAt || new Date().toISOString()),
            source: item.source === "template" || item.source === "imported" ? item.source : "custom",
            hostName: item.hostName || "",
            className: item.className || "",
            state: item.state,
          } as SavedGame))
          .filter((item: SavedGame) => !!item.state?.board);
        setSavedGames(migrated);
      }
    }
    const ap = localStorage.getItem("kc_appearance");
    if (ap === "mid") setAppearance("soft");
    if (ap === "dark" || ap === "light" || ap === "soft" || ap === "contrast") setAppearance(ap);
    if (localStorage.getItem("kc_open_templates") === "1") {
      setAppView("templates");
      localStorage.removeItem("kc_open_templates");
    }
    const rr = localStorage.getItem(RESULTS_KEY);
    if (rr) {
      const parsed = JSON.parse(rr);
      if (Array.isArray(parsed)) setResults(parsed);
    }
    setFavTemplateIds(safeLoad<string[]>(FAV_TEMPLATES_KEY, []));
  }, []);
  const persistGames = (next: SavedGame[]) => { setSavedGames(next); localStorage.setItem(GAMES_KEY, JSON.stringify(next)); };
  const persistResults = (next: GameResult[]) => { setResults(next); localStorage.setItem(RESULTS_KEY, JSON.stringify(next)); };
  const deleteResult = (id: string) => persistResults(results.filter(r => r.id !== id));
  const toggleFavoriteTemplate = (id: string) => {
    const next = favTemplateIds.includes(id) ? favTemplateIds.filter(x => x !== id) : [...favTemplateIds, id];
    setFavTemplateIds(next);
    safeSave(FAV_TEMPLATES_KEY, next);
  };
  const appearanceBg = appearance === "light" ? "#f8fafc" : appearance === "soft" ? "#141b2d" : appearance === "contrast" ? "#000" : "#090d18";
    : appearance === "soft"
    : appearance === "contrast"
    ? `radial-gradient(circle at top, #ffffff22 0%, #000 62%)`
    try {
      const raw = localStorage.getItem(COMMUNITY_TEMPLATES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setCommunityTemplates(parsed);
    } catch {
      showToast.warning("تعذر قراءة قوالب المجتمع المحفوظة.");
    }
  }, []);

  // Load last room
  useEffect(() => {
    const last = loadLastRoomCode();
    if (last && isFirebaseConfigured()) {
      setRoomCode(last);
      const unsub = subscribeToRoom(last, s => {
        if (s) setRoom(s); else { setRoom(null); setRoomCode(""); saveLastRoomCode(""); }
      });
      unsubRef.current = unsub;
    }
    return () => { unsubRef.current?.(); };
  }, []);

  // Timer
  useEffect(() => {
    if (!room) return;
    if (room.timerRunning && room.timerValue > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(async () => {
        const cur = roomRef.current;
        if (!cur?.timerRunning) { clearInterval(timerRef.current!); return; }
        const nv = cur.timerValue - 1;
        if (nv <= 0) {
          clearInterval(timerRef.current!);
          await updateRoom(cur.roomCode, { timerValue:0, timerRunning:false, questionStatus:"time_up" });
        } else {
          await updateRoom(cur.roomCode, { timerValue:nv });
        }
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [room?.timerRunning]);
  useEffect(() => {
    if (!room?.activeQuestion) return;
    if (room.timerSetting > 0 && !room.timerRunning) {
      push({ timerValue: room.timerSetting, timerRunning: true, timerMax: room.timerSetting });
    }
  }, [room?.activeQuestion?.cellId]);

  const confirm = (msg: string, action: ()=>void) => { setConfirmMsg(msg); setConfirmAction(()=>action); };
  const push = useCallback(async (updates: Partial<RoomState>) => {
    if (!roomCode) return;
    try { await updateRoom(roomCode, updates); }
    catch (e) { console.error(e); showToast.error("فشل الاتصال بالخدمة"); }
  }, [roomCode]);

  // Create room
  const handleCreate = async () => {
    if (!isFirebaseConfigured()) { showToast.error("تعذر الاتصال بالخدمة. يرجى المحاولة لاحقًا. تحقق من إعدادات المشروع"); return; }
    setCreating(true);
    try {
      const code = await generateUniqueCode();
      await createRoom(code);
      saveLastRoomCode(code);
      setRoomCode(code);
      unsubRef.current?.();
      unsubRef.current = subscribeToRoom(code, s => { if (s) setRoom(s); });
      showToast.success(`تم إنشاء الغرفة! الرمز: ${code}`);
    } catch (e) { console.error(e); showToast.error("فشل إنشاء الغرفة"); }
    setCreating(false);
  };

  // Cell click
  const handleCellClick = (cell: BoardCell) => {
    if (!room) return;
    if (room.winnerTeam !== 0) { showToast.info("انتهت اللعبة بالفعل. اضغط إعادة اللعب للبدء من جديد."); return; }
    const getCellBank = (c: BoardCell) => Array.isArray((c as any).questionBank) && (c as any).questionBank.length
      ? (c as any).questionBank
      : (c.question ? [{ question: c.question, answer: c.answer, category: c.category, difficulty: c.difficulty, points: c.points, hint: c.hint, explanation: c.explanation }] : []);
    if (room.gameStatus === "lobby" || activeTab === "setup") {
      setEditingCell(cell);
    } else {
      const bank = getCellBank(cell);
      if (!bank.length) { showToast.warning("لا يوجد سؤال مرتبط بهذا الحرف حالياً."); return; }
      if (cell.claimedBy !== 0) { showToast.info("هذا الحرف محجوز بالفعل."); return; }
      const first = bank[0];
      const aq: ActiveQuestion = {
        cellId: cell.id, cellLabel: cell.label,
        question: first.question, answer: first.answer,
        category: first.category, difficulty: first.difficulty,
        points: first.points, hint: first.hint, explanation: first.explanation,
      };
      push({
        activeQuestion: aq, selectedCellId: cell.id,
        answerVisibleToHost: false, answerVisibleToParticipants: false,
        hintVisibleToParticipants: false, questionStatus: "active",
        timerValue: room.timerSetting, timerRunning: false,
      });
    }
  };

  const saveCellQ = async (updates: Partial<BoardCell>) => {
    if (!room || !editingCell) return;
    const nb = room.board.map(c => c.id===editingCell.id ? {...c,...updates} : c);
    await push({ board: nb });
    showToast.success("تم حفظ سؤال الحرف ✓");
    setEditingCell(null);
  };

  // Claim cell
  const claimCell = async (cellId: string) => {
    if (!room) return;
    if (!room.activeQuestion) return;
    const current = room.board.find(c => c.id === cellId);
    if (!current || current.claimedBy !== 0 || current.used) return;
    const nb = room.board.map(c => c.id===cellId ? {...c, claimedBy: room.activeTeam as 0|1|2, used:true} : c);
    const pts = room.activeQuestion?.points || 1;
    const scoreUp = room.activeTeam===1 ? { team1Score: room.team1Score+pts } : { team2Score: room.team2Score+pts };
    const winner = checkWinner(nb, room.gridSize);
    const path = winner ? findWinningPath(nb, room.gridSize, winner as 1|2) : [];
    const winMsg = winner===1 ? `فاز ${room.team1.name}!` : winner===2 ? `فاز ${room.team2.name}!` : "";
    await push({ board:nb, ...scoreUp, questionStatus:"correct", selectedCellId:"",
      winnerMessage: winMsg, winnerTeam: winner,
      gameStatus: winMsg ? "finished" : room.gameStatus });
    setWinningPathIds(path);
    if (winMsg) showToast.success(winMsg);
  };

  const [actionLock, setActionLock] = useState(false);
  const markCorrect = async () => {
    if (!room?.activeQuestion || actionLock) return;
    if (room.winnerTeam !== 0) { showToast.info("انتهت اللعبة بالفعل. اضغط إعادة اللعب للبدء من جديد."); return; }
    const nextStreak = currentStreak + 1;
    setCurrentStreak(nextStreak);
    setBestStreak(v => Math.max(v, nextStreak));
    setCorrectCount(v => v + 1);
    setFeedbackMsg(nextStreak >= 3 ? `✅ Correct! Streak x${nextStreak}` : "✅ Correct!");
    setActionLock(true);
    try { await claimCell(room.activeQuestion.cellId); } finally { setActionLock(false); }
  };
  const markWrong = async () => {
    if (!room) return;
    setWrongCount(v => v + 1);
    setCurrentStreak(0);
    setFeedbackMsg("❌ Wrong answer");
    await push({ questionStatus:"wrong" });
    if (room.stealMode==="steal") showToast.info("فرصة سرقة متاحة!");
  };
  const allowSteal = async () => {
    if (!room) return;
    const next: 1|2 = room.activeTeam===1 ? 2 : 1;
    await push({ activeTeam: next });
    showToast.info(`الدور انتقل إلى ${next===1 ? room.team1.name : room.team2.name}`);
  };
  const nextQuestion = async () => {
    if (!room) return;
    const cell = room.board.find(c=>c.id===room.activeQuestion?.cellId);
    const bank = cell ? (Array.isArray((cell as any).questionBank) && (cell as any).questionBank.length ? (cell as any).questionBank : (cell.question ? [{ question:cell.question, answer:cell.answer, category:cell.category, difficulty:cell.difficulty, points:cell.points, hint:cell.hint, explanation:cell.explanation }] : [])) : [];
    if (room.activeQuestion && bank.length > 1) {
      const idx = Math.max(0, bank.findIndex((q:any)=>q.question===room.activeQuestion?.question && q.answer===room.activeQuestion?.answer));
      const next = bank[idx+1];
      if (next) {
        await push({
          activeQuestion: { ...room.activeQuestion, question: next.question, answer: next.answer, category: next.category, difficulty: next.difficulty, points: next.points || 1, hint: next.hint || "", explanation: next.explanation || "" },
          answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false,
          questionStatus:"active", timerRunning:false, timerValue: room.timerSetting,
        });
        return;
      }
    }
    await push({ activeQuestion:null, selectedCellId:"", answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false, questionStatus:"idle", timerRunning:false });
  };
  const skipQ = async () => {
    if (!room) return;
    setSkippedCount(v => v + 1);
    setCurrentStreak(0);
    setFeedbackMsg("⏭ Question skipped");
    const cell = room.board.find(c=>c.id===room.activeQuestion?.cellId);
    const bank = cell ? (Array.isArray((cell as any).questionBank) && (cell as any).questionBank.length ? (cell as any).questionBank : (cell.question ? [{ question:cell.question, answer:cell.answer, category:cell.category, difficulty:cell.difficulty, points:cell.points, hint:cell.hint, explanation:cell.explanation }] : [])) : [];
    if (room.activeQuestion && bank.length > 1) {
      const idx = Math.max(0, bank.findIndex((q:any)=>q.question===room.activeQuestion?.question && q.answer===room.activeQuestion?.answer));
      const next = bank[idx+1];
      if (next) {
        await push({
          activeQuestion: { ...room.activeQuestion, question: next.question, answer: next.answer, category: next.category, difficulty: next.difficulty, points: next.points || 1, hint: next.hint || "", explanation: next.explanation || "" },
          answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false,
          questionStatus:"skipped", timerRunning:false, timerValue: room.timerSetting,
        });
        return;
      }
    }
    await push({ activeQuestion:null, selectedCellId:"", questionStatus:"idle", answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false, timerRunning:false, timerValue: room.timerSetting });
  };

  const startTimer = () => push({ timerRunning:true });
  const pauseTimer = () => push({ timerRunning:false });
  const resetTimer = () => { if (!room) return; push({ timerRunning:false, timerValue:room.timerSetting }); };
  useEffect(() => {
    if (!room) return;
    if (gameMode === "timed" && room.timerSetting === 0) push({ timerSetting:30, timerValue:30, timerRunning:false });
  }, [gameMode]);
  const addScore = (t: 1|2, d: number) => {
    if (!room) return;
    if (t===1) push({ team1Score: Math.max(0, room.team1Score+d) });
    else push({ team2Score: Math.max(0, room.team2Score+d) });
  };
  const declareWinner = (t: 1|2|"draw") => {
    if (!room) return;
    const msg = t==="draw" ? "🤝 تعادل!" : t===1 ? `🏆 ${room.team1.name} فاز!` : `🏆 ${room.team2.name} فاز!`;
    push({ winnerMessage:msg, winnerTeam: t==="draw" ? 0 : t, gameStatus:"finished" });
  };
  const saveResultRecord = (winnerText: string) => {
    if (!room || !winnerText) return;
    const roundKey = `${room.roomCode}-${room.roundNumber}-${winnerText}`;
    if (savedResultForRoundRef.current === roundKey) return;
    const blueClaimed = room.board.filter(c=>c.claimedBy===1).length;
    const redClaimed = room.board.filter(c=>c.claimedBy===2).length;
    const totalQuestionsUsed = room.board.filter(c=>c.used).length;
    const durationSec = startedAtRef.current ? Math.max(0, Math.floor((Date.now()-startedAtRef.current)/1000)) : 0;
    const rec: GameResult = {
      id:`r_${Date.now()}`,
      gameTitle: room.gameTitle || "لعبة",
      at: new Date().toISOString(),
      hostName: profile.hostName,
      className: profile.className || "",
      winner: winnerText,
      blueTeamName: room.team1.name,
      redTeamName: room.team2.name,
      blueClaimed,
      redClaimed,
      totalClaimed: blueClaimed + redClaimed,
      skippedQuestions: skippedCount,
      totalQuestionsUsed,
      durationSec,
    };
    persistResults([rec, ...results].slice(0, 200));
    savedResultForRoundRef.current = roundKey;
  };

  const startGame = async () => {
    if (!room) return;
    const empty = room.board.filter(c=>!(Array.isArray((c as any).questionBank) && (c as any).questionBank.length) && !c.question.trim()).length;
    if (empty === room.board.length) {
      showToast.warning("لا توجد أسئلة بعد. أضف أسئلة من صفحة الإنشاء.");
      return;
    }
    if (empty>0) {
      confirm(`بعض الحروف لا تحتوي على أسئلة (${empty} حرف). هل تريد المتابعة؟`,
        async () => { await push({ gameStatus:"active" }); startedAtRef.current = Date.now(); setActiveTab("game"); });
    } else {
      await push({ gameStatus:"active" });
      startedAtRef.current = Date.now();
      showToast.success("بدأت اللعبة! 🎮");
      setActiveTab("game");
    }
  };

  const resetGame = () => {
    if (!room) return;
    confirm("هل أنت متأكد من إعادة ضبط اللعبة؟ سيتم مسح النقاط والخلايا والسؤال الحالي.", async () => {
      const rb = room.board.map(c=>({...c, claimedBy:0 as const, used:false}));
      await push({ board:rb, team1Score:0, team2Score:0, activeQuestion:null, selectedCellId:"",
        answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false,
        timerRunning:false, timerValue:room.timerSetting, winnerMessage:"", winnerTeam:0,
        questionStatus:"idle", gameStatus:"lobby", activeTeam:1, roundNumber:1 });
      setSkippedCount(0);
      setCurrentStreak(0);
      setBestStreak(0);
      setCorrectCount(0);
      setWrongCount(0);
      setWinningPathIds([]);
      savedResultForRoundRef.current = "";
      showToast.success("تم إعادة ضبط اللعبة");
    });
  };

  const restoreOrder = async () => {
    if (!room) return;
    const restored = [...room.board].map((cell, i) => ({ ...cell, position: i }));
    await push({ board: restored });
    showToast.success("تم استعادة الترتيب الأصلي ✓");
  };

  const cancelQuestion = async () => {
    if (!room) return;
    await push({ activeQuestion: null, selectedCellId: "", answerVisibleToHost: false,
      answerVisibleToParticipants: false, hintVisibleToParticipants: false, questionStatus: "idle" });
    showToast.info("تم إلغاء السؤال الحالي");
  };

  const doShuffle = () => {
    if (!room) return;
    const hasClaimed = room.board.some(c=>c.claimedBy!==0);
    const doIt = async () => {
      const shuffled = shuffleBoard(room.board);
      await push({ board: shuffled });
      showToast.success("تم خلط الحروف ✓");
    };
    if (hasClaimed) {
      confirm("بعض الحروف محجوزة بالفعل. خلط الحروف الآن قد يربك المشاركين. هل تريد المتابعة؟", doIt);
    } else {
      doIt();
    }
  };

  const exportBoard = () => {
    if (!room) return;
    const blob = new Blob([JSON.stringify(room.board, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`wasla-board-${roomCode}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast.success("تم تصدير أسئلة اللوحة");
  };

  const importBoard = () => {
    const input = document.createElement("input"); input.type="file"; input.accept=".json";
    input.onchange = async e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text()) as BoardCell[];
        if (!Array.isArray(parsed)) throw new Error();
        await push({ board: parsed });
        showToast.success("تم استيراد أسئلة اللوحة بنجاح");
      } catch { showToast.error("ملف غير صالح. تحقق من التنسيق."); }
    };
    input.click();
  };

  const duplicateTemplate = (tpl: StarterTemplate) => {
    try {
      const copy: StarterTemplate = {
        ...tpl,
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `نسخة من ${tpl.name}`,
        userCreated: true,
        createdAt: new Date().toISOString(),
      };
      const next = [copy, ...communityTemplates].slice(0, 50);
      setCommunityTemplates(next);
      localStorage.setItem(COMMUNITY_TEMPLATES_KEY, JSON.stringify(next));
      showToast.success("تم نسخ القالب بنجاح.");
    } catch {
      showToast.error("تعذر نسخ القالب. يرجى المحاولة مرة أخرى.");
    }
  };

  const useTemplate = async (tpl: StarterTemplate) => {
    if (!room) return;
    const ok = window.confirm("سيتم استبدال مجموعة الأسئلة الحالية بهذا القالب. هل تريد المتابعة؟");
    if (!ok) return;
    try {
      let skipped = 0;
      let missingLetters = 0;
      const nextBoard = room.board.map((cell) => {
        const found = tpl.boardBanks?.find(b=>b.cellId===cell.id || b.label===cell.label);
        const sourceBank = Array.isArray(found?.questionBank) ? found!.questionBank : [];
        const filtered = sourceBank.filter((q:any) => {
          const target = normalizeArabicLetter(cell.label);
          const letterFromData = questionInitialLetter(q);
          if (!letterFromData) return false;
          const ok = letterFromData === target;
          if (!ok) skipped += 1;
          return ok;
        }).map((q:any)=>({
          question: String(q.question || "").trim(),
          answer: String(q.answer || "").trim(),
          category: String(q.category || tpl.categories[0] || "غير مصنف"),
          difficulty: (q.difficulty === "easy" || q.difficulty === "medium" || q.difficulty === "hard") ? q.difficulty : (tpl.level === "سهل" ? "easy" : tpl.level === "صعب" ? "hard" : "medium"),
          points: Number(q.points) || 1,
          hint: String(q.hint || ""),
          explanation: String(q.explanation || ""),
          letter: String(q.letter || cell.label),
        }));
        const bank = filtered.length ? filtered : [];
        // توافق خلفي للقوالب القديمة (سؤال واحد لكل خانة)
        if (!bank.length && !tpl.boardBanks?.length && Array.isArray(tpl.questions) && tpl.questions.length) {
          const legacy = tpl.questions.find((q) => normalizeArabicLetter(q) === normalizeArabicLetter(cell.label));
          if (legacy) {
            bank.push({
              question: legacy,
              answer: legacy,
              category: tpl.categories[0] || "غير مصنف",
              difficulty: (tpl.level === "سهل" ? "easy" : tpl.level === "صعب" ? "hard" : "medium"),
              points: 1,
              hint: "",
              explanation: "",
              letter: cell.label,
            } as any);
          }
        }
        if (!bank.length) missingLetters += 1;
        const first = bank[0];
        return {
          ...cell,
          question: first?.question || "",
          answer: first?.answer || "",
          category: first?.category || "",
          difficulty: (first?.difficulty || "medium") as BoardCell["difficulty"],
          hint: first?.hint || "",
          explanation: first?.explanation || "",
          ...( { questionBank: bank } as any),
        };
      });
      await push({ board: nextBoard });
      safeSave(LAST_TEMPLATE_KEY, tpl);
      if (skipped > 0) showToast.warning("تم تجاهل بعض الأسئلة لأنها لا تطابق الحروف المحددة.");
      showToast.success("تم تحميل القالب بنجاح.");
      if (missingLetters > 0) showToast.info("بعض الحروف لا تحتوي على أسئلة بعد.");
    } catch {
      showToast.error("تعذر تحميل القالب. يرجى المحاولة مرة أخرى.");
    }
  };
  const saveCurrentAsTemplate = () => {
    if (!room) return;
    if (!templateName.trim()) { showToast.warning("يرجى إدخال اسم القالب."); return; }
    const withQ = room.board.filter(c=>c.question.trim() || (Array.isArray((c as any).questionBank) && (c as any).questionBank.length));
    if (!withQ.length) { showToast.warning("أضف سؤالًا واحدًا على الأقل قبل حفظ القالب."); return; }
    const boardBanks = room.board.map(c=>{
      const bank = Array.isArray((c as any).questionBank) && (c as any).questionBank.length ? (c as any).questionBank : (c.question ? [{ question:c.question, answer:c.answer, category:c.category||"غير مصنف", difficulty:c.difficulty, points:c.points||1, hint:c.hint||"", explanation:c.explanation||"", letter:c.label }] : []);
      return { cellId:c.id, label:c.label, questionBank: bank };
    });
    const totalQuestions = boardBanks.reduce((n,b)=>n+b.questionBank.length,0);
    const cats = Array.from(new Set(boardBanks.flatMap(b=>b.questionBank.map((q:any)=>q.category||"غير مصنف"))));
    const tpl: StarterTemplate = { id:`u_${Date.now()}`, name:templateName.trim(), categories:cats as string[], level:"متوسط", description:"قالب محلي محفوظ على هذا الجهاز.", questions:boardBanks.flatMap(b=>b.questionBank.map((q:any)=>q.question)), boardBanks, createdAt:new Date().toISOString(), userCreated:true };
    const next=[tpl, ...communityTemplates];
    setCommunityTemplates(next);
    localStorage.setItem(COMMUNITY_TEMPLATES_KEY, JSON.stringify(next));
    setTemplateName("");
    showToast.success("تم حفظ القالب محلياً.");
    if (!totalQuestions) return;
  };
  const deleteTemplate = (tpl: StarterTemplate) => {
    if (!tpl.userCreated) { showToast.info("لا يمكن حذف القوالب الجاهزة."); return; }
    if (!window.confirm("هل تريد حذف هذا القالب؟")) return;
    const next = communityTemplates.filter(t=>t.id!==tpl.id);
    setCommunityTemplates(next);
    localStorage.setItem(COMMUNITY_TEMPLATES_KEY, JSON.stringify(next));
    showToast.success("تم حذف القالب.");
  };
  const exportTemplate = (tpl: StarterTemplate) => {
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`template-${tpl.name}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const exportTemplateCsv = (tpl: StarterTemplate) => {
    const rows: string[] = [];
    rows.push(["اسم القالب","رقم السؤال","الحرف","السؤال","الإجابة الصحيحة","التصنيف","المستوى"].join(","));
    (tpl.boardBanks || []).forEach((b) => {
      (b.questionBank || []).forEach((q:any, idx:number) => {
        const level = q.difficulty === "easy" ? "سهل" : q.difficulty === "hard" ? "صعب" : "متوسط";
        const esc = (v:string) => `"${String(v || "").replace(/"/g,'""')}"`;
        rows.push([esc(tpl.name), String(idx + 1), esc(b.label), esc(q.question), esc(q.answer), esc(q.category || "غير مصنف"), esc(level)].join(","));
      });
    });
    const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `template-${tpl.name}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const importTemplateCsv = () => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".csv,text/csv";
    input.onchange = async e => {
      try {
        if (!room) return;
        const ok = window.confirm("سيتم استبدال مجموعة الأسئلة الحالية بالملف المستورد. هل تريد المتابعة؟");
        if (!ok) return;
        const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
        const text = (await file.text()).replace(/^\uFEFF/, "");
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) throw new Error();
        const parse = (line:string) => (line.match(/("([^"]|"")*"|[^,]+)/g) || []).map(x => x.replace(/^"|"$/g, "").replace(/""/g, "\"").trim());
        const banks = new Map<string, any[]>();
        let skipped = 0;
        lines.slice(1).forEach((line) => {
          const cols = parse(line);
          const letter = cols[2] || "";
          const question = cols[3] || "";
          const answer = cols[4] || "";
          if (!letter || !question || !answer) { skipped += 1; return; }
          const normLetter = normalizeArabicLetter(letter);
          const normAnswer = normalizeArabicLetter(answer);
          if (normLetter !== normAnswer) skipped += 1;
          if (!banks.has(letter)) banks.set(letter, []);
          banks.get(letter)!.push({
            letter,
            question,
            answer,
            category: cols[5] || "غير مصنف",
            difficulty: cols[6] === "سهل" ? "easy" : cols[6] === "صعب" ? "hard" : "medium",
            points: 1,
            hint: "",
            explanation: "",
          });
        });
        if (!banks.size) throw new Error();
        const nextBoard = room.board.map((cell) => {
          const bank = banks.get(cell.label) || [];
          const first = bank[0];
          return { ...cell, question: first?.question || "", answer: first?.answer || "", category: first?.category || "", difficulty: (first?.difficulty || "medium") as BoardCell["difficulty"], ...( { questionBank: bank } as any) };
        });
        await push({ board: nextBoard });
        if (skipped > 0) showToast.warning("تم تجاهل بعض الصفوف بسبب عدم تطابق الحرف مع الإجابة.");
        showToast.success("تم استيراد الجدول بنجاح.");
      } catch {
        showToast.error("تعذر استيراد الجدول. تأكد من تنسيق الملف.");
      }
    };
    input.click();
  };
  const importTemplate = () => {
    const input = document.createElement("input"); input.type="file"; input.accept=".json";
    input.onchange = async e => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
        const parsed = JSON.parse(await file.text());
        if (!parsed || typeof parsed.name!=="string") throw new Error();
        const safeBanks = Array.isArray(parsed.boardBanks) ? parsed.boardBanks.map((b:any)=>({
          cellId: String(b?.cellId || ""),
          label: String(b?.label || ""),
          questionBank: Array.isArray(b?.questionBank) ? b.questionBank.filter((q:any)=>q?.question).map((q:any)=>({
            question: String(q.question || "").trim(),
            answer: String(q.answer || "").trim(),
            category: String(q.category || "غير مصنف"),
            difficulty: (q.difficulty==="easy"||q.difficulty==="medium"||q.difficulty==="hard") ? q.difficulty : "medium",
            points: Number(q.points) || 1,
            hint: String(q.hint || ""),
            explanation: String(q.explanation || ""),
            letter: String(q.letter || b?.label || ""),
          })) : [],
        })) : [];
        const tpl: StarterTemplate = { id:`u_${Date.now()}`, name:parsed.name, categories:Array.isArray(parsed.categories)?parsed.categories:["غير مصنف"], level:parsed.level==="مبتدئ"||parsed.level==="سهل"||parsed.level==="متوسط"||parsed.level==="صعب"||parsed.level==="مفتوح"?parsed.level:"متوسط", description:String(parsed.description||"قالب مستورد محليًا"), questions:Array.isArray(parsed.questions)?parsed.questions:[], boardBanks:safeBanks, createdAt:new Date().toISOString(), userCreated:true };
        const next=[tpl, ...communityTemplates];
        setCommunityTemplates(next); localStorage.setItem(COMMUNITY_TEMPLATES_KEY, JSON.stringify(next));
        showToast.success("تم استيراد القالب بنجاح.");
      } catch { showToast.error("تعذر قراءة القالب. تأكد من أن الملف صحيح."); }
    };
    input.click();
  };
  const saveCurrentGame = () => {
    if (!room) return;
    const game: SavedGame = {
      id: `g_${Date.now()}`,
      title: room.gameTitle || "لعبة جديدة",
      category: "عام",
      questionCount: room.board.filter(c => c.question.trim() || (Array.isArray((c as any).questionBank) && (c as any).questionBank.length)).length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "custom",
      hostName: profile.hostName,
      className: profile.className,
      state: room,
    };
    persistGames([game, ...savedGames]);
    showToast.success("تم حفظ اللعبة محلياً.");
  };
  const loadSavedGame = async (g: SavedGame) => {
    setRoom(g.state);
    setRoomCode(g.state.roomCode);
    setAppView("host");
    showToast.success("تم تحميل اللعبة.");
  };
  const duplicateSavedGame = (g: SavedGame) => persistGames([{ ...g, id:`g_${Date.now()}`, title:`${g.title} - نسخة`, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }, ...savedGames]);
  const deleteSavedGame = (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه اللعبة؟")) return;
    persistGames(savedGames.filter(g=>g.id!==id));
  };
  const exportSavedGame = (g: SavedGame) => {
    const blob = new Blob([JSON.stringify(g, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`saved-game-${g.title}.json`; a.click(); URL.revokeObjectURL(url);
  };
  const importSavedGame = () => {
    const input = document.createElement("input"); input.type="file"; input.accept=".json";
    input.onchange = async e => {
      try {
        const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return;
        const parsed = JSON.parse(await file.text());
        if (!parsed?.state?.board) throw new Error();
        persistGames([{
          id:`g_${Date.now()}`,
          title:String(parsed.title || parsed.state?.gameTitle || "لعبة مستوردة"),
          category:String(parsed.category || "عام"),
          questionCount:Number(parsed.questionCount || parsed.state.board.length || 0),
          createdAt:String(parsed.createdAt || new Date().toISOString()),
          updatedAt:new Date().toISOString(),
          source:"imported",
          hostName: String(parsed.hostName || profile.hostName || ""),
          className: String(parsed.className || profile.className || ""),
          state: parsed.state,
        }, ...savedGames]);
      } catch { showToast.error("تعذر قراءة اللعبة. تأكد من أن الملف صحيح."); }
    };
    input.click();
  };
  const endGameNow = async () => {
    if (!room) return;
    await push({ gameStatus:"finished", winnerMessage:"تم إنهاء اللعبة من المضيف", winnerTeam:0, timerRunning:false });
    saveResultRecord("تم إنهاء اللعبة من المضيف");
    showToast.info("تم إنهاء اللعبة.");
  };
  useEffect(() => {
    if (!room?.winnerMessage) return;
    saveResultRecord(room.winnerMessage);
  }, [room?.winnerMessage]);

  if (!isLogged) {
    return (
      <div style={{ minHeight:"100vh", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", gap:"1rem", alignItems:"start", padding:"1rem", background:"radial-gradient(circle at top,#17253a 0%,#090d18 60%)" }}>
        <div className="kc-card" style={{ minHeight:300 }}>
          <div style={{ fontSize:"2rem", fontWeight:900, color:"#f59e0b", marginBottom:"0.45rem" }}>وصلة المعرفة</div>
          <div style={{ fontSize:"2rem", fontWeight:900, color:"#f0ede8", marginBottom:"0.5rem" }}>حوّل المراجعة إلى تحدي ممتع</div>
          <div style={{ color:"#cbd5e1", fontWeight:700, marginBottom:"0.35rem" }}>منصة تحديات تعليمية تفاعلية للمضيفين والمعلمين</div>
          <div style={{ color:"#94a3b8", marginBottom:"1rem" }}>أنشئ ألعاباً تعليمية، اختر القوالب، واستضف التحديات الصفية بطريقة سهلة وممتعة.</div>
          <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.8rem" }}>
            <button className="btn-gold" onClick={()=>document.getElementById("host-name-input")?.focus()}>ابدأ الآن</button>
            <button className="btn-secondary" onClick={()=>{ const quick={ hostName:"مضيف", className:"", orgName:"" }; setProfile(quick); localStorage.setItem(PROFILE_KEY, JSON.stringify(quick)); localStorage.setItem(SESSION_KEY,"1"); setIsLogged(true); }}>جرّب قالباً جاهزاً</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"0.8rem" }}>
            {["قوالب جاهزة","لوحة تحكم للمضيف","وضع عرض للفصل","نتائج محفوظة محلياً","ألعاب قابلة للتخصيص","تحديات فرق ممتعة"].map(x=><div key={x} className="badge-chip">{x}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"0.5rem" }}>
            <div style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.5rem", fontSize:"0.78rem", color:"#94a3b8" }}>لوحة مصغرة<br/><span style={{ color:"#f0ede8" }}>◉ ◉ ◉ ◉ ◉</span></div>
            <div style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.5rem", fontSize:"0.78rem", color:"#94a3b8" }}>الفِرَق<br/><span style={{ color:"#60a5fa" }}>الأزرق</span> • <span style={{ color:"#f87171" }}>الأحمر</span></div>
            <div style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.5rem", fontSize:"0.78rem", color:"#94a3b8" }}>قالب جاهز<br/><span style={{ color:"#f0ede8" }}>قالب العلوم</span></div>
            <div style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.5rem", fontSize:"0.78rem", color:"#94a3b8" }}>نتيجة<br/><span style={{ color:"#f0ede8" }}>فاز الفريق الأزرق</span></div>
          </div>
          <div style={{ marginTop:"0.9rem", display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            {["المعلمون","المضيفون","الأهالي","قادة الأنشطة","الطلاب"].map(x=><span key={x} className="badge-chip">{x}</span>)}
          </div>
        </div>
        <div className="kc-card" style={{ maxWidth:520, width:"100%", justifySelf:"center" }}>
          <div style={{ fontSize:"1.5rem", fontWeight:900, color:"#f59e0b", marginBottom:"0.7rem" }}>دخول المضيف</div>
          <div style={{ display:"grid", gap:"0.65rem" }}>
            <input id="host-name-input" className="kc-input" placeholder="اسم المضيف" value={profile.hostName} onChange={e=>setProfile({ ...profile, hostName:e.target.value })} />
            <input className="kc-input" placeholder="اسم الصف أو الفعالية" value={profile.className || ""} onChange={e=>setProfile({ ...profile, className:e.target.value })} />
            <input className="kc-input" placeholder="اسم المدرسة أو الجهة" value={profile.orgName || ""} onChange={e=>setProfile({ ...profile, orgName:e.target.value })} />
            <button className="btn-gold" onClick={()=>{ if(!profile.hostName.trim()) return showToast.warning("يرجى إدخال اسم المضيف."); localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); localStorage.setItem(SESSION_KEY,"1"); setIsLogged(true); }}>دخول لوحة التحكم</button>
            <button className="btn-secondary" onClick={()=>{ const quick={ hostName:"مضيف", className:"", orgName:"" }; setProfile(quick); localStorage.setItem(PROFILE_KEY, JSON.stringify(quick)); localStorage.setItem(SESSION_KEY,"1"); setIsLogged(true); }}>تجربة سريعة</button>
            <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>يتم حفظ البيانات محلياً على هذا الجهاز فقط.</div>
          </div>
        </div>
      </div>
    );
  }

  if (appView !== "host") {
    const filtered = savedGames.filter(g => (!searchGame || g.title.includes(searchGame)) && (!filterCategory || g.category === filterCategory) && (!filterSource || g.source === filterSource));
    const latest = savedGames[0];
    const sourceLabel = (source: SavedGame["source"]) => source === "template" ? "قالب" : source === "imported" ? "مستورد" : "مخصص";
    const categoryOptions = Array.from(new Set(savedGames.map(g => g.category)));
    const suggestedTemplates = [...STARTER_TEMPLATES, ...DEMO_COMMUNITY_TEMPLATES, ...communityTemplates].slice(0, 4);
    const totalAnswered = results.reduce((n, r) => n + (r.totalQuestionsUsed || 0), 0);
    const totalCorrect = Math.max(0, results.reduce((n, r) => n + (r.totalQuestionsUsed || 0) - (r.skippedQuestions || 0), 0));
    const achievements = [
      results.length >= 1 ? "🏁 أول لعبة" : "",
      results.length >= 5 ? "🎮 خمس ألعاب" : "",
      totalAnswered >= 10 ? "📚 10 أسئلة" : "",
      results.some(r => r.skippedQuestions === 0 && r.totalQuestionsUsed > 0) ? "💯 جولة مثالية" : "",
      favTemplateIds.length > 0 ? "⭐ مفضلات القوالب" : "",
    ].filter(Boolean);
    return (
              <button className="btn-secondary" onClick={()=>{ setAppearance("soft"); localStorage.setItem("kc_appearance","soft"); }}>ناعم</button>
              <button className="btn-secondary" onClick={()=>{ setAppearance("contrast"); localStorage.setItem("kc_appearance","contrast"); }}>تباين عالٍ</button>
            <div className="kc-card">
              <div className="section-title">الملف والتقدم</div>
              <div className="badge-chip">ألعاب لعبت: {results.length}</div>
              <div className="badge-chip">أسئلة مجابة: {totalAnswered}</div>
              <div className="badge-chip">معدل الدقة: {totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0}%</div>
              <div className="badge-chip">مفضلات القوالب: {favTemplateIds.length}</div>
              <div style={{ fontSize:"0.75rem", color:"#94a3b8" }}>الإنجازات: {achievements.length ? achievements.join(" • ") : "ابدأ أول لعبة لفتح الإنجازات"}</div>
              <div style={{ display:"flex", gap:"0.35rem", marginTop:"0.45rem", flexWrap:"wrap" }}>
                <button className="btn-secondary" onClick={() => {
                  const last = safeLoad<StarterTemplate | null>(LAST_TEMPLATE_KEY, null);
                  if (!last) { showToast.info("لا يوجد قالب أخير"); return; }
                  setAppView("host");
                  if (!room) handleCreate();
                  setTimeout(() => useTemplate(last), 250);
                }}>تشغيل آخر قالب</button>
                <button className="btn-danger" onClick={() => confirm("هل أنت متأكد؟ سيتم حذف البيانات المحلية من هذا الجهاز.", () => {
                  [PROFILE_KEY, GAMES_KEY, RESULTS_KEY, COMMUNITY_TEMPLATES_KEY, LAST_TEMPLATE_KEY, FAV_TEMPLATES_KEY].forEach(safeRemove);
                  window.location.reload();
                })}>إعادة ضبط البيانات</button>
              </div>
            </div>
          <div style={{marginBottom:"0.8rem"}}><div style={{fontWeight:700,color:"#cbd5e1",marginBottom:"0.3rem"}}>المظهر</div><div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}><button className="btn-secondary" onClick={()=>{ setAppearance("light"); localStorage.setItem("kc_appearance","light"); }}>الوضع الفاتح</button><button className="btn-secondary" onClick={()=>{ setAppearance("soft"); localStorage.setItem("kc_appearance","soft"); }}>الوضع الناعم</button><button className="btn-secondary" onClick={()=>{ setAppearance("dark"); localStorage.setItem("kc_appearance","dark"); }}>الوضع الداكن</button><button className="btn-secondary" onClick={()=>{ setAppearance("contrast"); localStorage.setItem("kc_appearance","contrast"); }}>تباين عالٍ</button></div></div>
          <div style={{ display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem" }}>
            <div><div style={{ fontSize:"1.4rem", fontWeight:900, color:"#f59e0b" }}>وصلة المعرفة • لوحة التحكم</div><div style={{ color:"#94a3b8" }}>مرحباً، {profile.hostName}{profile.className ? ` • الصف/الفعالية: ${profile.className}` : ""}{profile.orgName ? ` • الجهة: ${profile.orgName}` : ""}</div></div>
            <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", alignItems:"center" }}>
              <button className="btn-secondary" onClick={()=>{ setAppearance("light"); localStorage.setItem("kc_appearance","light"); }}>فاتح</button>
              <button className="btn-secondary" onClick={()=>{ setAppearance("mid"); localStorage.setItem("kc_appearance","mid"); }}>متوازن</button>
              <button className="btn-secondary" onClick={()=>{ setAppearance("dark"); localStorage.setItem("kc_appearance","dark"); }}>داكن</button>
              <button className="btn-secondary" onClick={()=>setAppView("dashboard")}>الرئيسية</button>
              <button className="btn-secondary" onClick={()=>setAppView("games")}>ألعابي</button>
              <button className="btn-secondary" onClick={()=>setAppView("templates")}>القوالب</button>
              <button className="btn-secondary" onClick={()=>setAppView("results")}>النتائج</button>
              <button className="btn-secondary" onClick={()=>setAppView("settings")}>الإعدادات</button>
              <button className="btn-gold" onClick={()=>{ setAppView("host"); if(!room) handleCreate(); }}>بدء الاستضافة</button>
              <button className="btn-danger" onClick={()=>{ localStorage.removeItem(SESSION_KEY); setIsLogged(false); }}>الخروج</button>
            </div>
          </div>
        </div>
        {appView === "dashboard" && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"0.75rem" }}>
            <div className="kc-card"><div className="section-title">مرحباً بك</div><div style={{color:"#f0ede8",fontWeight:700}}>مرحباً {profile.hostName}</div>{profile.className && <div style={{color:"#94a3b8"}}>الصف/الفعالية: {profile.className}</div>}{profile.orgName && <div style={{color:"#94a3b8"}}>الجهة: {profile.orgName}</div>}<div style={{marginTop:"0.4rem",color:"#94a3b8"}}>ابدأ تحدياً جديداً أو تابع آخر لعبة محفوظة.</div></div>
            <div className="kc-card"><div className="section-title">إجراءات سريعة</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.45rem"}}>{[
              {t:"إنشاء لعبة جديدة",d:"ابدأ من الصفر وأضف أسئلتك.",a:()=>{setAppView("host"); if(!room) handleCreate();}},
              {t:"اختيار قالب",d:"استخدم قالباً جاهزاً وابدأ بسرعة.",a:()=>setAppView("templates")},
              {t:"بدء الاستضافة",d:"شغّل لعبة واستضف التحدي.",a:()=>{setAppView("host"); if(!room) handleCreate();}},
              {t:"ألعابي",d:"إدارة الألعاب المحفوظة.",a:()=>setAppView("games")},
              {t:"استيراد لعبة",d:"أضف لعبة من ملف محلي.",a:importSavedGame},
              {t:"عرض النتائج",d:"راجع نتائج التحديات السابقة.",a:()=>setAppView("results")},
            ].map(item=><button key={item.t} className="btn-secondary" style={{textAlign:"right",whiteSpace:"normal"}} onClick={item.a}><div style={{fontWeight:700}}>{item.t}</div><div style={{fontSize:"0.7rem",color:"#94a3b8"}}>{item.d}</div></button>)}</div></div>
            <div className="kc-card"><div className="section-title">إحصاءات</div><div className="badge-chip">الألعاب المحفوظة: {savedGames.length}</div><div className="badge-chip">القوالب المتاحة: {STARTER_TEMPLATES.length + DEMO_COMMUNITY_TEMPLATES.length + communityTemplates.length}</div><div className="badge-chip">النتائج المحفوظة: {results.length}</div><div className="badge-chip">آخر لعبة: {latest?.title || "لا يوجد"}</div></div>
            <div className="kc-card"><div className="section-title">ألعابي</div>{savedGames.length? <div style={{display:"grid",gap:"0.35rem"}}>{savedGames.slice(0,3).map(g=><div key={g.id} style={{background:"#141e2d",padding:"0.45rem",borderRadius:"8px"}}><div style={{color:"#f0ede8",fontWeight:700}}>{g.title}</div><div style={{fontSize:"0.72rem",color:"#94a3b8"}}>عدد الأسئلة: {g.questionCount} • {new Date(g.updatedAt).toLocaleDateString("ar")}</div><div style={{display:"flex",gap:"0.35rem",marginTop:"0.25rem"}}><button className="btn-secondary" onClick={()=>loadSavedGame(g)}>تشغيل</button><button className="btn-secondary" onClick={()=>loadSavedGame(g)}>تعديل</button></div></div>)}</div> : <div style={{color:"#94a3b8"}}>لا توجد ألعاب محفوظة بعد. أنشئ لعبة جديدة أو استخدم أحد القوالب.<div style={{marginTop:"0.35rem",display:"flex",gap:"0.35rem"}}><button className="btn-gold" onClick={()=>{setAppView("host"); if(!room) handleCreate();}}>إنشاء لعبة جديدة</button><button className="btn-secondary" onClick={()=>setAppView("templates")}>عرض القوالب</button></div></div>}<button className="btn-secondary" style={{marginTop:"0.6rem"}} onClick={()=>setAppView("games")}>عرض كل الألعاب</button></div>
            <div className="kc-card"><div className="section-title">آخر النتائج</div>{results.length ? <div style={{display:"grid",gap:"0.35rem"}}>{results.slice(0,3).map(r=><div key={r.id} style={{fontSize:"0.8rem",color:"#cbd5e1"}}>{r.gameTitle} • {r.winner} • {new Date(r.at).toLocaleDateString("ar")} • {r.blueClaimed}/{r.redClaimed}</div>)}</div> : <div style={{color:"#94a3b8"}}>لا توجد نتائج محفوظة بعد. ابدأ لعبة جديدة لحفظ أول نتيجة.</div>}<button className="btn-secondary" style={{marginTop:"0.6rem"}} onClick={()=>setAppView("results")}>عرض كل النتائج</button></div>
            <div className="kc-card"><div className="section-title">متابعة سريعة</div>{latest ? <><div style={{color:"#f0ede8", marginBottom:"0.5rem"}}>{latest.title}</div><button className="btn-gold" onClick={()=>loadSavedGame(latest)}>تشغيل آخر لعبة</button></> : <div style={{color:"#94a3b8"}}>اختر قالباً جاهزاً أو أنشئ لعبة جديدة للبدء.</div>}</div>
            <div className="kc-card" style={{ gridColumn:"1 / -1" }}><div className="section-title">قوالب مقترحة</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"0.5rem"}}>{suggestedTemplates.map(tpl=><div key={tpl.id} style={{background:"#141e2d",border:"1px solid #1a2332",borderRadius:"10px",padding:"0.65rem"}}><div style={{fontWeight:700,color:"#f0ede8"}}>{tpl.name}</div><div style={{fontSize:"0.75rem",color:"#94a3b8"}}>{tpl.categories[0] || "عام"} • {tpl.level}</div><div style={{fontSize:"0.75rem",color:"#94a3b8"}}>الأسئلة: {tpl.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || tpl.questions.length}</div><button className="btn-secondary" style={{marginTop:"0.45rem"}} onClick={()=>{setAppView("host"); if(!room) handleCreate(); setTimeout(()=>useTemplate(tpl), 250);}}>استخدم القالب</button></div>)}</div><button className="btn-secondary" style={{marginTop:"0.65rem"}} onClick={()=>setAppView("templates")}>عرض كل القوالب</button></div>
          </div>
        )}
          <div style={{marginBottom:"0.8rem"}}><div style={{fontWeight:700,color:"#cbd5e1",marginBottom:"0.3rem"}}>بيانات المضيف</div><div style={{display:"grid",gap:"0.45rem"}}><input className="kc-input" placeholder="اسم المضيف" value={profile.hostName} onChange={e=>{ const next={...profile, hostName:e.target.value}; setProfile(next); localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); }} /><input className="kc-input" placeholder="الصف/الفعالية" value={profile.className||""} onChange={e=>{ const next={...profile, className:e.target.value}; setProfile(next); localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); }} /><input className="kc-input" placeholder="الجهة/المدرسة" value={profile.orgName||""} onChange={e=>{ const next={...profile, orgName:e.target.value}; setProfile(next); localStorage.setItem(PROFILE_KEY, JSON.stringify(next)); }} /></div></div>
          <div style={{marginBottom:"0.8rem"}}><div style={{fontWeight:700,color:"#cbd5e1",marginBottom:"0.3rem"}}>إعدادات اللعبة الافتراضية</div><div style={{display:"grid",gap:"0.45rem"}}><input className="kc-input" placeholder="اسم الفريق الأزرق الافتراضي" value={room?.team1?.name || ""} onChange={e=>room && push({ team1:{...room.team1, name:e.target.value || "الفريق الأزرق"} })} /><input className="kc-input" placeholder="اسم الفريق الأحمر الافتراضي" value={room?.team2?.name || ""} onChange={e=>room && push({ team2:{...room.team2, name:e.target.value || "الفريق الأحمر"} })} /><div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}><button className="btn-secondary" onClick={()=>room && push({ timerSetting:30, timerValue:30, timerRunning:false })}>مؤقت 30ث</button><button className="btn-secondary" onClick={()=>room && push({ timerSetting:60, timerValue:60, timerRunning:false })}>مؤقت 60ث</button><button className="btn-secondary" onClick={()=>room && push({ stealMode:"steal" })}>تفعيل السرقة</button><button className="btn-secondary" onClick={()=>room && push({ answerVisibleToParticipants:false })}>إخفاء الإجابة</button></div></div></div>
          <div style={{marginBottom:"0.8rem"}}><div style={{fontWeight:700,color:"#cbd5e1",marginBottom:"0.3rem"}}>البيانات المحلية</div><div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}><button className="btn-secondary" onClick={()=>{ const payload = { profile, savedGames, results, templates: communityTemplates }; const blob = new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=url; a.download="kc-local-data.json"; a.click(); URL.revokeObjectURL(url); }}>تصدير البيانات</button><button className="btn-danger" onClick={()=>confirm("هل أنت متأكد؟ سيتم حذف البيانات المحلية من هذا الجهاز.", ()=>{ localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(GAMES_KEY); localStorage.removeItem(RESULTS_KEY); localStorage.removeItem(COMMUNITY_TEMPLATES_KEY); window.location.reload(); })}>حذف البيانات المحلية</button></div></div>
        {appView === "templates" && <div className="kc-card"><div className="section-title">قوالب الألعاب</div><div style={{color:"#94a3b8"}}>انتقل إلى وضع الاستضافة ثم افتح تبويب الإعداد لاستخدام القوالب.</div><button className="btn-gold" style={{marginTop:"0.75rem"}} onClick={()=>{ setAppView("host"); if(!room) handleCreate(); setActiveTab("setup"); }}>فتح القوالب</button></div>}
        {appView === "results" && (
          <div className="kc-card">
            <div className="section-title">سجل النتائج</div>
            <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "results-history.json";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                تصدير كل النتائج
              </button>
            </div>
            {!results.length ? (
              <div style={{ color:"#94a3b8" }}>لا توجد نتائج محفوظة بعد. ابدأ لعبة جديدة لحفظ أول نتيجة.</div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"0.5rem" }}>
                {results.map((r) => (
                  <div key={r.id} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"12px", padding:"0.75rem" }}>
                    <div style={{ fontWeight:800, color:"#f0ede8" }}>{r.gameTitle}</div>
                    <div style={{ fontSize:"0.78rem", color:"#94a3b8" }}>الفائز: {r.winner}</div>
                    <div style={{ fontSize:"0.78rem", color:"#94a3b8" }}>التاريخ: {new Date(r.at).toLocaleString("ar")}</div>
                    <div style={{ fontSize:"0.78rem", color:"#94a3b8" }}>
                      {r.blueTeamName}: {r.blueClaimed} • {r.redTeamName}: {r.redClaimed}
                    </div>
                    <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap", marginTop:"0.55rem" }}>
                      <button className="btn-secondary" onClick={() => setSelectedResult(r)}>عرض التفاصيل</button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `result-${r.id}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        تصدير النتيجة
                      </button>
                      <button
                        className="btn-danger"
                        onClick={() => {
                          if (!window.confirm("هل أنت متأكد من حذف هذه النتيجة؟")) return;
                          persistResults(results.filter((x) => x.id !== r.id));
                        }}
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {appView === "games" && <div className="kc-card"><div className="section-title">ألعابي</div><div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",marginBottom:"0.75rem"}}><input className="kc-input" style={{maxWidth:240}} placeholder="بحث عن لعبة" value={searchGame} onChange={e=>setSearchGame(e.target.value)} /><select className="kc-input" style={{maxWidth:180}} value={filterCategory} onChange={e=>setFilterCategory(e.target.value)}><option value="">كل التصنيفات</option>{categoryOptions.map(c=><option key={c} value={c}>{c}</option>)}</select><select className="kc-input" style={{maxWidth:160}} value={filterSource} onChange={e=>setFilterSource(e.target.value)}><option value="">كل الأنواع</option><option value="custom">مخصص</option><option value="template">قالب</option><option value="imported">مستورد</option></select><button className="btn-secondary" onClick={importSavedGame}>استيراد لعبة</button></div>{!filtered.length ? <div style={{color:"#94a3b8"}}>لا توجد ألعاب محفوظة بعد. أنشئ لعبة جديدة أو استخدم أحد القوالب.<div style={{marginTop:"0.6rem",display:"flex",gap:"0.4rem",flexWrap:"wrap"}}><button className="btn-gold" onClick={()=>{setAppView("host"); if(!room) handleCreate();}}>إنشاء لعبة جديدة</button><button className="btn-secondary" onClick={()=>setAppView("templates")}>عرض القوالب</button><button className="btn-secondary" onClick={importSavedGame}>استيراد لعبة</button></div></div> : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"0.5rem"}}>{filtered.map(g=><div key={g.id} style={{background:"#141e2d",border:"1px solid #1a2332",borderRadius:"12px",padding:"0.75rem"}}><div style={{fontWeight:800,color:"#f0ede8"}}>{g.title}</div><div style={{fontSize:"0.78rem",color:"#94a3b8"}}>التصنيف: {g.category} • عدد الأسئلة: {g.questionCount}</div><div style={{fontSize:"0.78rem",color:"#94a3b8"}}>آخر تعديل: {new Date(g.updatedAt).toLocaleDateString("ar")} • النوع: {sourceLabel(g.source)}</div><div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap",marginTop:"0.5rem"}}><button className="btn-gold" onClick={()=>loadSavedGame(g)}>تشغيل</button><button className="btn-secondary" onClick={()=>loadSavedGame(g)}>تعديل</button><button className="btn-secondary" onClick={()=>duplicateSavedGame(g)}>نسخ</button><button className="btn-secondary" onClick={()=>exportSavedGame(g)}>تصدير</button><button className="btn-danger" onClick={()=>deleteSavedGame(g.id)}>حذف</button></div></div>)}</div>}</div>}
      </div>
    );
  }

  // ── Firebase not configured ──
  if (!isFirebaseConfigured()) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#090d18", padding:"2rem" }}>
        <div style={{ maxWidth:480, textAlign:"center" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🔥</div>
          <div style={{ fontSize:"1.5rem", fontWeight:800, color:"#f59e0b", marginBottom:"0.75rem" }}>وصلة المعرفة</div>
          <div style={{ fontSize:"1rem", fontWeight:600, color:"#ef4444", marginBottom:"1rem" }}>تعذر الاتصال بالخدمة. يرجى المحاولة لاحقًا.</div>
          <div style={{ background:"#0f1623", border:"1.5px solid #1a2332", borderRadius:"16px", padding:"1.5rem", textAlign:"right" }}>
            <div className="section-title">إرشادات سريعة</div>
            <ol style={{ color:"#94a3b8", fontSize:"0.85rem", lineHeight:2, paddingRight:"1.25rem" }}>
              <li>تحقق من تفعيل الخدمة من خلال لوحة الإعدادات</li>
              <li>تأكد من جاهزية الخدمة للعب المباشر</li>
              <li>راجع <code style={{ color:"#f59e0b" }}>إعدادات المشروع</code> وتأكد من اكتمالها</li>
              <li>أعد المحاولة بعد التأكد من الإعدادات</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // ── No room yet ──
  if (!room) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:"linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)", padding:"2rem" }}>
        <div style={{ fontSize:"3.5rem", fontWeight:900, color:"#f59e0b", marginBottom:"0.5rem", textAlign:"center" }}>وصلة المعرفة</div>
        <div style={{ color:"#475569", marginBottom:"3rem", fontSize:"0.9rem" }}>تحدي الفرق التفاعلي للفصل الدراسي</div>
        <div style={{ background:"#0f1623", border:"1.5px solid #1a2332", borderRadius:"20px", padding:"2.5rem", maxWidth:380, width:"100%", textAlign:"center" }}>
          <div style={{ fontSize:"2.5rem", marginBottom:"1rem" }}>🎮</div>
          <div style={{ fontWeight:700, fontSize:"1.1rem", color:"#f0ede8", marginBottom:"0.5rem" }}>لوحة تحكم المضيف</div>
          <div style={{ color:"#64748b", fontSize:"0.85rem", marginBottom:"2rem" }}>ابدأ تحديًا جديدًا ثم شارك رمز الانضمام مع الفرق</div>
          <button className="btn-gold" style={{ width:"100%", padding:"0.85rem", fontSize:"1rem" }}
            onClick={handleCreate} disabled={creating}>
            {creating ? "جارٍ الإنشاء..." : "إنشاء غرفة جديدة 🚀"}
          </button>
          <div style={{ marginTop:"1.5rem", fontSize:"0.8rem", color:"#475569" }}>
            رابط الانضمام: <span style={{ color:"#f59e0b" }}>{BASE_URL}/join</span>
          </div>
        </div>
      </div>
    );
  }

  const questionRows = sortedBoard(room.board).map(cell => {
    const bank = Array.isArray((cell as any).questionBank) ? (cell as any).questionBank : [];
    const first = bank[0] || (cell.question ? { question:cell.question, answer:cell.answer, category:cell.category, difficulty:cell.difficulty } : null);
    return { cell, count: bank.length || (cell.question ? 1 : 0), first };
  });
  const categories = Array.from(new Set(questionRows.map(r => r.first?.category || "غير مصنف")));
  const filteredQuestionRows = questionRows.filter(r => {
    const txt = `${r.cell.label} ${r.first?.question || ""} ${r.first?.answer || ""}`;
    if (questionSearch && !txt.includes(questionSearch)) return false;
    if (questionCategoryFilter && (r.first?.category || "غير مصنف") !== questionCategoryFilter) return false;
    if (questionDifficultyFilter && (r.first?.difficulty || "") !== questionDifficultyFilter) return false;
    return true;
  });
  const parseBulkQuestions = () => {
    const lines = bulkQuestions.split("\n").map(l=>l.trim()).filter(Boolean);
    const parsed = lines.map(line => {
      const parts = line.split("|").map(x=>x.trim());
      if (parts.length >= 3) return { label: parts[0], question: parts[1], answer: parts[2] };
      if (parts.length === 2) return { label: "", question: parts[0], answer: parts[1] };
      return { label: "", question: "", answer: "", error: line };
    });
    setBulkPreview(parsed);
    if (parsed.some(p=>p.error || !p.question || !p.answer)) showToast.warning("بعض الأسطر غير مكتملة. تأكد من كتابة الحرف والسؤال والإجابة.");
  };
  const applyBulkQuestions = async () => {
    if (!bulkPreview.length) { showToast.warning("نفّذ المعاينة أولاً."); return; }
    const emptyCells = sortedBoard(room.board);
    let idx = 0;
    const next = room.board.map(c=>{
      const direct = bulkPreview.find(p=>p.label && normalizeArabicLetter(p.label)===normalizeArabicLetter(c.label) && p.question && p.answer);
      const item = direct || bulkPreview.filter(p=>!p.label && p.question && p.answer)[idx++];
      if (!item) return c;
      return { ...c, question:item.question, answer:item.answer, category:c.category||"غير مصنف", difficulty:c.difficulty||"medium" };
    });
    const unassigned = bulkPreview.filter(p=>!p.label && p.question && p.answer).length - idx;
    if (unassigned > 0) showToast.warning("عدد الأسئلة أكبر من عدد الخلايا المتاحة.");
    await push({ board: next as any });
    showToast.success("تمت إضافة الأسئلة.");
  };
  const filledCells = room.board.filter(c=>c.question.trim()).length;
  const claimedCells = room.board.filter(c=>c.claimedBy!==0).length;
  const usedCells = room.board.filter(c=>c.used).length;
  const totalCells = room.board.length;

  return (
    <div style={{ minHeight:"100vh", background:"#090d18" }}>
      {/* Modals */}
      {confirmMsg && confirmAction && (
        <ConfirmModal msg={confirmMsg}
          onYes={() => { confirmAction(); setConfirmMsg(""); setConfirmAction(null); }}
          onNo={() => { setConfirmMsg(""); setConfirmAction(null); }} />
      )}
      {editingCell && <CellEditor cell={editingCell} onSave={saveCellQ} onClose={()=>setEditingCell(null)} />}
      {previewTemplate && (
        <div className="modal-overlay" onClick={()=>setPreviewTemplate(null)}>
          <div className="modal-box modal-box-scroll" style={{ maxWidth: 560 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, color:"#f59e0b", marginBottom:"0.45rem" }}>معاينة</div>
            <div style={{ fontWeight:700, color:"#f0ede8", marginBottom:"0.35rem" }}>{previewTemplate.name}</div>
            <div style={{ fontSize:"0.8rem", color:"#94a3b8", marginBottom:"0.8rem" }}>
              التصنيف: {previewTemplate.categories.join("، ")} • المستوى: {previewTemplate.level} • عدد الأسئلة الإجمالي: {previewTemplate.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || previewTemplate.questions.length} • عدد الحروف: {previewTemplate.boardBanks?.filter(b=>b.questionBank?.length).length || 0}
            </div>
            {previewTemplate.boardBanks && previewTemplate.boardBanks.length > 0 && (
              <div style={{ fontSize:"0.75rem", color:"#64748b", marginBottom:"0.55rem" }}>
                {previewTemplate.boardBanks.filter(b=>b.questionBank?.length).slice(0,6).map(b=>`${b.label}: ${b.questionBank.length}`).join(" • ")}
              </div>
            )}
            <div style={{ display:"flex", flexDirection:"column", gap:"0.35rem", marginBottom:"0.8rem" }}>
              {(previewTemplate.boardBanks?.flatMap(b=>b.questionBank.map((q:any)=>q.question)) || previewTemplate.questions).slice(0,5).map((q, i)=>(
                <div key={i} style={{ fontSize:"0.86rem", color:"#f0ede8" }}>• {q}</div>
              ))}
            </div>
            <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap" }}><button className="btn-gold" onClick={()=>{ if (previewTemplate) useTemplate(previewTemplate); setPreviewTemplate(null); }}>استخدم القالب</button><button className="btn-secondary" onClick={()=>{ if (previewTemplate) duplicateTemplate(previewTemplate); setPreviewTemplate(null); }}>تعديل نسخة</button><button className="btn-secondary" onClick={()=>setPreviewTemplate(null)}>رجوع</button></div>
          </div>
        </div>
      )}
      {selectedResult && (
        <div className="modal-overlay" onClick={()=>setSelectedResult(null)}>
          <div className="modal-box modal-box-scroll" style={{ maxWidth: 560 }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:900, color:"#f59e0b", marginBottom:"0.6rem" }}>تقرير اللعبة</div>
            <div style={{ display:"grid", gap:"0.35rem", color:"#cbd5e1", fontSize:"0.9rem" }}>
              <div><strong>الفائز:</strong> {selectedResult.winner}</div>
              <div><strong>عنوان اللعبة:</strong> {selectedResult.gameTitle}</div>
              <div><strong>تاريخ اللعبة:</strong> {new Date(selectedResult.at).toLocaleString("ar")}</div>
              <div><strong>المضيف:</strong> {selectedResult.hostName || "-"}</div>
              <div><strong>الصف أو الفعالية:</strong> {selectedResult.className || "-"}</div>
              <div><strong>عدد خلايا الفريق الأزرق:</strong> {selectedResult.blueClaimed}</div>
              <div><strong>عدد خلايا الفريق الأحمر:</strong> {selectedResult.redClaimed}</div>
              <div><strong>الأسئلة المستخدمة:</strong> {selectedResult.totalQuestionsUsed}</div>
              <div><strong>الأسئلة المتخطاة:</strong> {selectedResult.skippedQuestions}</div>
              <div><strong>مدة اللعبة:</strong> {selectedResult.durationSec} ثانية</div>
            </div>
            <div style={{ display:"flex", gap:"0.45rem", marginTop:"0.8rem", flexWrap:"wrap" }}>
              <button className="btn-secondary" onClick={()=>{ const blob = new Blob([JSON.stringify(selectedResult, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `report-${selectedResult.id}.json`; a.click(); URL.revokeObjectURL(url); }}>تصدير التقرير</button>
              <button className="btn-danger" onClick={()=>{ deleteResult(selectedResult.id); setSelectedResult(null); }}>حذف النتيجة</button>
              <button className="btn-secondary" onClick={()=>{ setSelectedResult(null); setAppView("dashboard"); }}>العودة للوحة التحكم</button>
            </div>
          </div>
        </div>
      )}

      {/* Winner panel */}
      {room.winnerMessage && (
        <div style={{ position:"sticky", top:"0.75rem", zIndex:40, margin:"0.75rem" }}>
          <div className="kc-card" style={{ border:`2px solid ${room.winnerTeam===1 ? room.team1.color : room.team2.color}`, background:"linear-gradient(135deg,#0f1623,#1a2332)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.75rem", flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:"1.5rem", fontWeight:900, color: room.winnerTeam===1 ? room.team1.color : room.team2.color }}>
                  {room.winnerMessage}
                </div>
                <div style={{ fontSize:"0.85rem", color:"#94a3b8" }}>انتهت الجولة الحالية. يمكنك إعادة اللعب أو الرجوع للقوالب.</div>
              </div>
              <div style={{ display:"flex", gap:"0.6rem", flexWrap:"wrap" }}>
                <span className="badge-chip" style={{ borderColor: room.team1.color, color: room.team1.color }}>
                  {room.team1.name}: {room.board.filter(c=>c.claimedBy===1).length}
                </span>
                <span className="badge-chip" style={{ borderColor: room.team2.color, color: room.team2.color }}>
                  {room.team2.name}: {room.board.filter(c=>c.claimedBy===2).length}
                </span>
                <span className="badge-chip">Final: صحيح {correctCount} • خطأ {wrongCount} • تخطي {skippedCount}</span>
                <span className="badge-chip">Best streak: {bestStreak} • Mode: {gameMode}</span>
              </div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
                <button className="btn-gold" onClick={resetGame}>إعادة اللعب</button>
                <button className="btn-secondary" onClick={()=>setActiveTab("setup")}>الرجوع للقوالب</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:"#0f1623", borderBottom:"1.5px solid #1a2332", padding:"0.75rem 1.25rem" }}>
        <div style={{ maxWidth:1400, margin:"0 auto" }}>
          {/* Top row */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem", marginBottom:"0.5rem" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
              <div style={{ fontWeight:900, fontSize:"1.3rem", color:"#f59e0b" }}>وصلة المعرفة</div>
              <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                <span style={{ fontSize:"0.75rem", color:"#64748b" }}>رمز الغرفة:</span>
                <span style={{ fontWeight:900, fontSize:"1.2rem", color:"#f0ede8", letterSpacing:"0.15em", background:"#1a2332", padding:"0.2rem 0.75rem", borderRadius:"8px", cursor:"pointer" }}
                  onClick={()=>copyText(roomCode, "رمز الغرفة")} title="انقر للنسخ">
                  {roomCode}
                </span>
              </div>
              <span style={{ fontSize:"0.7rem", padding:"0.2rem 0.6rem", borderRadius:"9999px", fontWeight:600,
                background: room.gameStatus==="active" ? "rgba(22,163,74,0.2)" : room.gameStatus==="finished" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
                color: room.gameStatus==="active" ? "#22c55e" : room.gameStatus==="finished" ? "#ef4444" : "#f59e0b" }}>
                {room.gameStatus==="lobby" ? "انتظار" : room.gameStatus==="active" ? `جارية • الجولة ${room.roundNumber}` : "منتهية"}
              </span>
              <span style={{ fontSize:"0.7rem", padding:"0.2rem 0.5rem", borderRadius:"6px", background:"#1a2332", color:"#64748b" }}>
                🏷 مركز الاستضافة
              </span>
              <span style={{ fontSize:"0.7rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:"#1a2332", color:"#94a3b8" }}>
                المضيف: {profile.hostName}{profile.className ? ` • ${profile.className}` : ""}
              </span>
            </div>
            <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
              {room.gameStatus==="lobby" && <button className="btn-gold" style={{ fontSize:"0.8rem" }} onClick={startGame}>▶ بدء اللعبة</button>}
              <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={saveCurrentGame}>💾 حفظ اللعبة</button>
              <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>setPresentationMode(v=>!v)}>{presentationMode ? "الخروج من وضع العرض" : "وضع العرض"}</button>
              <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={endGameNow}>إنهاء اللعبة</button>
              <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>setAppView("dashboard")}>🏠 لوحة التحكم</button>
              <button className="btn-danger" style={{ fontSize:"0.8rem" }} onClick={resetGame}>↺ إعادة اللعب</button>
            </div>
          </div>
          {/* Link row */}
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>copyText(joinLink(roomCode),"رابط الانضمام")}>📋 نسخ رابط الانضمام</button>
            <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>window.open(`/join?room=${roomCode}`,"_blank")}>🔗 فتح صفحة الانضمام</button>
            <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>copyText(displayLink(roomCode),"رابط شاشة العرض")}>📺 نسخ رابط شاشة العرض</button>
            <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>window.open(`/participant?room=${roomCode}`,"_blank")}>🖥 فتح شاشة العرض</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {!presentationMode && <div style={{ background:"#0f1623", borderBottom:"1.5px solid #1a2332", padding:"0 1.25rem" }}>
        <div style={{ maxWidth:1400, margin:"0 auto", display:"flex", gap:"0.25rem", overflowX:"auto", paddingBottom:"0.4rem", paddingTop:"0.4rem" }}>
          {([
            { id:"setup", label:"إعداد أسئلة الحروف" },
            { id:"game", label:"التحكم باللعبة" },
            { id:"settings", label:"الإعدادات" },
          ] as const).map(tab=>(
            <button key={tab.id} className={`tab-btn ${activeTab===tab.id?"active":""}`} onClick={()=>setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>}

      {/* Content */}
      <div className="container" style={{ paddingTop:"1.25rem", paddingBottom:"3rem" }}>

        {/* ══ TAB: Setup ══ */}
        {activeTab==="setup" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>
            {/* Board */}
            <div className="kc-card">
              <div className="section-title">لوحة الحروف</div>
              {/* Stats */}
              <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                {[
                  { label:"الأسئلة الجاهزة", val:`${filledCells} / ${totalCells}`, color:"#22c55e" },
                  { label:"بدون أسئلة", val:`${totalCells-filledCells}`, color:"#ef4444" },
                  { label:"المستخدمة", val:`${usedCells}`, color:"#f59e0b" },
                  { label:"المحجوزة", val:`${claimedCells}`, color:"#94a3b8" },
                ].map(s=>(
                  <div key={s.label} style={{ background:"#141e2d", borderRadius:"8px", padding:"0.4rem 0.75rem", textAlign:"center" }}>
                    <div style={{ fontSize:"0.65rem", color:"#64748b" }}>{s.label}</div>
                    <div style={{ fontWeight:800, color:s.color, fontSize:"1rem" }}>{s.val}</div>
                  </div>
                ))}
              </div>
              {/* Progress bar */}
              <div style={{ height:4, background:"#1a2332", borderRadius:"2px", overflow:"hidden", marginBottom:"0.75rem" }}>
                <div style={{ height:"100%", background:"#f59e0b", width:`${(filledCells/totalCells)*100}%`, transition:"width 0.3s ease" }} />
              </div>
              <div style={{ fontSize:"0.8rem", color:"#64748b", marginBottom:"0.75rem" }}>
                اضغط على أي حرف في اللوحة لإضافة سؤال خاص به.
              </div>
              <HexBoard board={room.board} gridSize={room.gridSize} mode="setup"
                team1={room.team1} team2={room.team2} onCellClick={handleCellClick} compact />
              <div style={{ display:"flex", gap:"0.5rem", marginTop:"1rem", flexWrap:"wrap" }}>
                <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={doShuffle}>🔀 خلط الحروف</button>
                <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={restoreOrder}>↩ استعادة الترتيب الأصلي</button>
                <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={exportBoard}>📤 تصدير</button>
                <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={importBoard}>📥 استيراد</button>
              </div>
            </div>

            {/* Cell list */}
            <div className="kc-card" style={{ maxHeight:"75vh", overflowY:"auto" }}>
              <div className="section-title">قائمة الحروف والأسئلة</div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.6rem" }}>
                <input className="kc-input" style={{ maxWidth:220 }} placeholder="بحث في الأسئلة" value={questionSearch} onChange={e=>setQuestionSearch(e.target.value)} />
                <select className="kc-input" style={{ maxWidth:180 }} value={questionCategoryFilter} onChange={e=>setQuestionCategoryFilter(e.target.value)}><option value="">كل التصنيفات</option>{categories.map(c=><option key={c} value={c}>{c}</option>)}</select>
                <select className="kc-input" style={{ maxWidth:150 }} value={questionDifficultyFilter} onChange={e=>setQuestionDifficultyFilter(e.target.value as any)}><option value="">كل المستويات</option><option value="easy">سهل</option><option value="medium">متوسط</option><option value="hard">صعب</option></select>
                <div style={{ color:"#94a3b8", fontSize:"0.8rem" }}>إجمالي الأسئلة: {questionRows.reduce((n,r)=>n+r.count,0)}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
                {filteredQuestionRows.map(({cell,count,first})=>(
                  (() => { const qText = first?.question || cell.question;
                  const qCategory = first?.category || cell.category;
                  const qDifficulty = first?.difficulty || cell.difficulty;
                  return (
                  <div key={cell.id} onClick={()=>setEditingCell(cell)}
                    style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.55rem 0.75rem",
                      borderRadius:"10px", cursor:"pointer", background:"#141e2d", border:"1.5px solid #1a2332",
                      transition:"border-color 0.15s ease" }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor="#f59e0b")}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor="#1a2332")}
                  >
                    <div style={{ width:34, height:34, borderRadius:"8px", background:"#1a2332", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#f59e0b", flexShrink:0 }}>
                      {cell.label}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      {qText
                        ? <><div style={{ fontSize:"0.85rem", color:"#f0ede8", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{qText}</div>
                            <div style={{ fontSize:"0.72rem", color:"#64748b" }}>{qCategory && `${qCategory} • `}{qDifficulty==="easy"?"سهل":qDifficulty==="medium"?"متوسط":"صعب"} • عدد الأسئلة: {count}</div></>
                        : <div style={{ fontSize:"0.85rem", color:"#3d5068" }}>هذا الحرف لا يحتوي على سؤال بعد</div>}
                    </div>
                    <span style={{ fontSize:"0.75rem", color: qText ? "#22c55e" : "#ef4444" }}>{qText?"✓":"!"}</span>
                  </div>
                  ); })()
                ))}
              </div>
            </div>

            <div className="kc-card" style={{ gridColumn:"1 / -1" }}>
              <div className="section-title">إضافة أسئلة دفعة واحدة</div>
              <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginBottom:"0.5rem" }}>اكتب كل سؤال في سطر مستقل بهذا الشكل: الحرف | السؤال | الإجابة</div>
              <textarea className="kc-input" rows={5} value={bulkQuestions} onChange={e=>setBulkQuestions(e.target.value)} placeholder="أ | ما ضد الكذب؟ | الصدق
ما معنى الأمانة؟ | حفظ الحقوق" />
              <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem", flexWrap:"wrap" }}>
                <button className="btn-secondary" onClick={parseBulkQuestions}>معاينة الأسئلة</button>
                <button className="btn-gold" onClick={applyBulkQuestions}>إضافة الأسئلة</button>
                <button className="btn-danger" onClick={()=>{setBulkQuestions("");setBulkPreview([]);}}>إلغاء</button>
              </div>
              {!!bulkPreview.length && <div style={{ marginTop:"0.6rem", fontSize:"0.78rem", color:"#cbd5e1" }}>{bulkPreview.slice(0,8).map((p,i)=><div key={i}>{p.label?`[${p.label}] `:""}{p.question} ← {p.answer}{p.error?" (خطأ)":""}</div>)}</div>}
            </div>

            <div className="kc-card" style={{ gridColumn:"1 / -1" }}>
              <div className="section-title">قوالب الألعاب</div>
              <div style={{ fontSize:"0.82rem", color:"#94a3b8", marginBottom:"0.8rem" }}>
                احفظ بنك الأسئلة الحالي كقالب، أو استخدم قالبًا جاهزًا/محفوظًا.
                <div style={{ marginTop:"0.35rem" }}>يمكنك تعديل القالب في Excel ثم استيراده مرة أخرى.</div>
                <div>كل القوالب هنا محلية فقط (بدون تسجيل دخول أو مشاركة عبر الإنترنت).</div>
              </div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                <input className="kc-input" style={{ maxWidth:240 }} placeholder="اسم القالب" value={templateName} onChange={e=>setTemplateName(e.target.value)} />
                <button className="btn-gold" onClick={saveCurrentAsTemplate}>حفظ كقالب محلي</button>
                <button className="btn-secondary" onClick={importTemplate}>استيراد قالب</button>
                <button className="btn-secondary" onClick={importTemplateCsv}>استيراد من جدول (محلي)</button>
              </div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                <input className="kc-input" style={{ maxWidth:240 }} placeholder="بحث عن قالب" value={templateSearch} onChange={e=>setTemplateSearch(e.target.value)} />
                <select className="kc-input" style={{ maxWidth:180 }} value={templateCategory} onChange={e=>setTemplateCategory(e.target.value)}>
                  <option value="">كل التصنيفات</option><option value="إسلاميات">إسلاميات</option><option value="لغة عربية">لغة عربية</option><option value="رياضيات">رياضيات</option><option value="معرفة عامة">معرفة عامة</option><option value="مفردات">مفردات</option><option value="قراءة وفهم">قراءة وفهم</option><option value="تقنية">تقنية</option><option value="حياة يومية">حياة يومية</option><option value="غير مصنف">غير مصنف</option>
                </select>
                <select className="kc-input" style={{ maxWidth:160 }} value={templateLevel} onChange={e=>setTemplateLevel(e.target.value)}>
                  <option value="">كل المستويات</option><option value="سهل">سهل</option><option value="متوسط">متوسط</option><option value="صعب">صعب</option>
                </select>
                <select className="kc-input" style={{ maxWidth:170 }} value={templateSort} onChange={e=>setTemplateSort(e.target.value as any)}>
                  <option value="newest">الأحدث</option><option value="title">العنوان A-Z</option><option value="questions">عدد الأسئلة</option><option value="difficulty">الصعوبة</option>
                </select>
              </div>
              <div style={{ fontWeight:700, color:"#94a3b8", marginBottom:"0.5rem" }}>نماذج جاهزة مستوحاة من المجتمع (قوالب تجريبية محلية)</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"0.75rem" }}>
                {[...STARTER_TEMPLATES, ...DEMO_COMMUNITY_TEMPLATES, ...communityTemplates]
                .filter(tpl=>!templateSearch || tpl.name.includes(templateSearch) || (tpl.subject || "").includes(templateSearch))
                .filter(tpl=>!templateCategory || tpl.categories.includes(templateCategory))
                .filter(tpl=>!templateLevel || tpl.level===templateLevel)
                .sort((a,b)=>{
                  const aQ = a.boardBanks?.reduce((n,x)=>n+(x.questionBank?.length||0),0) || a.questions.length;
                  const bQ = b.boardBanks?.reduce((n,x)=>n+(x.questionBank?.length||0),0) || b.questions.length;
                  if (templateSort==="title") return a.name.localeCompare(b.name, "ar");
                  if (templateSort==="questions") return bQ-aQ;
                  if (templateSort==="difficulty") return String(a.level).localeCompare(String(b.level), "ar");
                  return String(b.createdAt||"").localeCompare(String(a.createdAt||""));
                })
                .map(tpl => {
                  const totalQ = tpl.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || tpl.questions.length;
                  const covered = tpl.boardBanks?.filter(b=>b.questionBank?.length).length || 0;
                  const avg = covered ? (totalQ / covered).toFixed(1) : "0";
                  return (
                  <div key={tpl.id} style={{ background:"#141e2d", border:"1.5px solid #1a2332", borderRadius:"14px", padding:"0.85rem" }}>
                    <div style={{ fontWeight:800, color:"#f0ede8", marginBottom:"0.35rem" }}>{tpl.name}</div>
                    <div style={{ fontSize:"0.75rem", color:"#cbd5e1", marginBottom:"0.35rem" }}>{tpl.description}</div>
                    <div style={{ fontSize:"0.74rem", color:"#94a3b8", lineHeight:1.8 }}>
                      <div>التصنيف: {tpl.categories.join("، ")}</div>
                      <div>المستوى: {tpl.level}</div>
                      <div>الصف/المرحلة: {tpl.level}</div>
                      <div>الوقت المتوقع: {tpl.estimatedMinutes || Math.max(8, Math.round(totalQ * 0.7))} دقيقة</div>
                      <div>الحروف المغطاة: {covered}</div>
                      <div>إجمالي الأسئلة: {totalQ}</div>
                      <div>المتوسط: {avg} أسئلة لكل حرف</div>
                      {covered < ARABIC_LETTERS_FULL.length && <div style={{ color:"#f59e0b" }}>هذا القالب لا يغطي جميع الحروف.</div>}
                      {tpl.createdAt && <div>تاريخ الحفظ: {new Date(tpl.createdAt).toLocaleDateString("ar")}</div>}
                    </div>
                    <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginTop:"0.7rem" }}>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>setPreviewTemplate(tpl)}>معاينة</button>
                      <button className="btn-gold" style={{ fontSize:"0.75rem" }} onClick={()=>useTemplate(tpl)}>استخدم القالب</button>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>toggleFavoriteTemplate(tpl.id)}>{favTemplateIds.includes(tpl.id) ? "★ مفضل" : "☆ تفضيل"}</button>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>duplicateTemplate(tpl)}>تعديل نسخة</button>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>exportTemplate(tpl)}>تصدير قالب</button>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>exportTemplateCsv(tpl)}>تصدير كجدول</button>
                      {tpl.userCreated && <button className="btn-danger" style={{ fontSize:"0.75rem" }} onClick={()=>deleteTemplate(tpl)}>حذف القالب</button>}
                    </div>
                  </div>
                );})}
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB: Game ══ */}
        {activeTab==="game" && (
          <div className="responsive-game-layout" style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:"1.25rem" }}>
            {/* Left: controls */}
            <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              <div className="kc-card">
                <div className="section-title">وضع الاستضافة</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"0.35rem", marginBottom:"0.6rem" }}>
                  {[
                    ["classic","🎯 كلاسيكي","لعبة متوازنة"],
                    ["timed","⏱ مؤقت","سريع وحماسي"],
                    ["practice","📘 تدريب","بدون ضغط تنافسي"],
                    ["challenge","🔥 تحدي","سكور وسلاسل أقوى"],
                  ].map(([id,label,desc])=>(
                    <button key={id} className="btn-secondary" onClick={()=>setGameMode(id as any)} style={{ textAlign:"right", border: gameMode===id ? "1px solid #f59e0b" : undefined }}>
                      <div style={{fontWeight:700}}>{label}</div><div style={{fontSize:"0.68rem",color:"#94a3b8"}}>{desc}</div>
                    </button>
                  ))}
                </div>
                {feedbackMsg && <div style={{ marginBottom:"0.5rem", fontSize:"0.8rem", color:"#facc15" }}>{feedbackMsg}</div>}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.45rem" }}>
                  <div className="badge-chip" style={{ borderColor:room.team1.color, color:room.team1.color }}>خلايا الفريق الأزرق: {room.board.filter(c=>c.claimedBy===1).length}</div>
                  <div className="badge-chip" style={{ borderColor:room.team2.color, color:room.team2.color }}>خلايا الفريق الأحمر: {room.board.filter(c=>c.claimedBy===2).length}</div>
                  <div className="badge-chip">الخلايا المتبقية: {room.board.filter(c=>c.claimedBy===0).length}</div>
                  <div className="badge-chip">الأسئلة المتخطاة: {skippedCount}</div>
                  <div className="badge-chip">الدور الحالي: {room.activeTeam===1 ? room.team1.name : room.team2.name}</div>
                  <div className="badge-chip">السلسلة: {currentStreak} • الأفضل: {bestStreak}</div>
                  <div className="badge-chip">صحيح: {correctCount} • خطأ: {wrongCount}</div>
                  <div className="badge-chip">النمط: {gameMode}</div>
                </div>
              </div>
              {/* Teams */}
              <div className="kc-card">
                <div className="section-title">الفرق</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"0.65rem" }}>
                  <input className="kc-input" placeholder="اسم الفريق الأزرق" value={room.team1.name} onChange={e=>push({ team1: { ...room.team1, name: e.target.value || "الفريق الأزرق" } })} />
                  <input className="kc-input" placeholder="اسم الفريق الأحمر" value={room.team2.name} onChange={e=>push({ team2: { ...room.team2, name: e.target.value || "الفريق الأحمر" } })} />
                </div>
                <div className="responsive-two-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
                  {([1,2] as const).map(t=>{
                    const team = t===1 ? room.team1 : room.team2;
                    const score = t===1 ? room.team1Score : room.team2Score;
                    const active = room.activeTeam===t;
                    return (
                      <div key={t} style={{ background: active?`${team.color}18`:"#141e2d", border:`2px solid ${active?team.color:"#1a2332"}`, borderRadius:"14px", padding:"0.85rem", textAlign:"center", transition:"all 0.2s ease" }}>
                        {active && <div style={{ fontSize:"0.65rem", color:"#64748b", marginBottom:"0.2rem" }}>🎯 الفريق النشط</div>}
                        <div style={{ fontWeight:700, color:team.color, marginBottom:"0.2rem", fontSize:"0.9rem" }}>{team.name}</div>
                        <div style={{ fontSize:"2.2rem", fontWeight:900, color:"#f0ede8" }}>{score}</div>
                        <div style={{ fontSize:"0.65rem", color:"#475569", marginBottom:"0.5rem" }}>نقطة</div>
                        <div style={{ display:"flex", gap:"0.3rem", justifyContent:"center" }}>
                          <button className="btn-secondary" style={{ padding:"0.2rem 0.5rem", fontSize:"0.75rem" }} onClick={()=>push({ activeTeam:t })}>تحديد</button>
                          <button className="btn-green" style={{ padding:"0.2rem 0.45rem", fontSize:"0.75rem" }} onClick={()=>addScore(t,1)}>+١</button>
                          <button className="btn-danger" style={{ padding:"0.2rem 0.45rem", fontSize:"0.75rem" }} onClick={()=>addScore(t,-1)}>-١</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.75rem", justifyContent:"center", flexWrap:"wrap" }}>
                  <button className="btn-gold" style={{ fontSize:"0.78rem" }} onClick={()=>declareWinner(1)}>🏆 فوز الفريق ١</button>
                  <button className="btn-gold" style={{ fontSize:"0.78rem" }} onClick={()=>declareWinner(2)}>🏆 فوز الفريق ٢</button>
                  <button className="btn-secondary" style={{ fontSize:"0.78rem" }} onClick={()=>declareWinner("draw")}>🤝 تعادل</button>
                </div>
              </div>

              {/* Timer */}
              <div className="kc-card">
                <div className="section-title">المؤقت</div>
                <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
                  <div style={{ fontSize:"3rem", fontWeight:900, fontVariantNumeric:"tabular-nums",
                    color: room.timerValue<=5?"#ef4444":room.timerValue<=10?"#f59e0b":"#f0ede8",
                    animation: room.timerValue<=5&&room.timerRunning?"timerPulse 0.5s ease-in-out infinite":"none" }}>
                    {room.timerValue}
                  </div>
                  <div style={{ fontSize:"0.8rem", color:"#64748b" }}>ثانية</div>
                  <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                    {!room.timerRunning
                      ? <button className="btn-green" style={{ fontSize:"0.8rem" }} onClick={startTimer}>▶ بدء</button>
                      : <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={pauseTimer}>⏸ إيقاف</button>}
                    <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={resetTimer}>↺ إعادة</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem", flexWrap:"wrap" }}>
                  <button className="btn-secondary" style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem" }}
                    onClick={()=>push({ timerSetting:0, timerValue:0, timerRunning:false })}>بدون مؤقت</button>
                  {[30,60].map(s=>(
                    <button key={s} className="btn-secondary" style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem" }}
                      onClick={()=>push({ timerSetting:s, timerValue:s, timerRunning:false })}>{s}ث</button>
                  ))}
                  <input className="kc-input" style={{ width:90 }} type="number" min={5} value={timerCustom} onChange={e=>setTimerCustom(Number(e.target.value)||5)} />
                  <button className="btn-secondary" style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem" }} onClick={()=>push({ timerSetting:timerCustom, timerValue:timerCustom, timerRunning:false })}>تخصيص</button>
                </div>
              </div>
              <div className="kc-card">
                <div className="section-title">إعدادات اللعبة</div>
                <label style={{ display:"flex", alignItems:"center", gap:"0.5rem", color:"#cbd5e1" }}>
                  <input type="checkbox" checked={room.stealMode==="steal"} onChange={e=>push({ stealMode: e.target.checked ? "steal" : "none" })} />
                  تفعيل فرصة السرقة
                </label>
                <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginTop:"0.35rem" }}>عند الإجابة الخاطئة: {room.stealMode==="steal" ? "فرصة للفريق الآخر" : "بدون فرصة سرقة"}</div>
              </div>

              {/* Current question */}
              <div className="kc-card">
                <div className="section-title">السؤال الحالي</div>
                {room.activeQuestion ? (
                  <>
                    <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                      <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:"rgba(245,158,11,0.15)", color:"#f59e0b", fontWeight:700 }}>
                        حرف: {room.activeQuestion.cellLabel}
                      </span>
                      {room.activeQuestion.category && (
                        <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:"#1a2332", color:"#94a3b8" }}>
                          {room.activeQuestion.category}
                        </span>
                      )}
                      <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:"#1a2332", color:"#94a3b8" }}>
                        {room.activeQuestion.points} نقطة
                      </span>
                      {/* Visibility indicators */}
                      <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px",
                        background: room.answerVisibleToParticipants?"rgba(22,163,74,0.2)":"rgba(239,68,68,0.15)",
                        color: room.answerVisibleToParticipants?"#22c55e":"#ef4444" }}>
                        {room.answerVisibleToParticipants?"الإجابة ظاهرة":"الإجابة مخفية"}
                      </span>
                    </div>
                    <div style={{ fontSize:"1rem", fontWeight:700, color:"#f0ede8", lineHeight:1.7, marginBottom:"0.75rem" }}>
                      {room.activeQuestion.question}
                    </div>
                    {/* Answer (host) */}
                    <div style={{ marginBottom:"0.75rem" }}>
                      {room.answerVisibleToHost ? (
                        <div style={{ background:"rgba(22,163,74,0.1)", border:"1.5px solid rgba(22,163,74,0.3)", borderRadius:"10px", padding:"0.65rem 0.85rem" }}>
                          <div style={{ fontSize:"0.7rem", color:"#22c55e", fontWeight:700, marginBottom:"0.2rem" }}>الإجابة (للمضيف فقط)</div>
                          <div style={{ color:"#f0ede8", fontWeight:600, fontSize:"0.95rem" }}>{room.activeQuestion.answer}</div>
                          {room.activeQuestion.hint && <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginTop:"0.3rem" }}>تلميح: {room.activeQuestion.hint}</div>}
                        </div>
                      ) : (
                        <button className="btn-secondary" style={{ width:"100%", fontSize:"0.85rem" }}
                          onClick={()=>push({ answerVisibleToHost:true })}>👁 إظهار الإجابة للمضيف فقط</button>
                      )}
                    </div>
                    {/* Participant controls */}
                    <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                      {!room.answerVisibleToParticipants
                        ? <button className="btn-gold" style={{ fontSize:"0.8rem" }} onClick={()=>push({ answerVisibleToParticipants:true, answerVisibleToHost:true, questionStatus:"answer_revealed" })}>📢 إظهار الإجابة</button>
                        : <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>push({ answerVisibleToParticipants:false })}>🔒 إخفاء الإجابة</button>}
                      {!room.hintVisibleToParticipants
                        ? <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>push({ hintVisibleToParticipants:true })}>💡 إظهار التلميح</button>
                        : <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>push({ hintVisibleToParticipants:false })}>💡 إخفاء التلميح</button>}
                    </div>
                    {/* Correct / Wrong / Steal / Skip / Next */}
                    <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                      <button className="btn-green" style={{ fontSize:"0.85rem" }} onClick={markCorrect}>✅ تحقق من الإجابة</button>
                      <button className="btn-danger" style={{ fontSize:"0.85rem" }} onClick={markWrong}>❌ إجابة خاطئة</button>
                      {room.stealMode!=="none" && <button className="btn-secondary" style={{ fontSize:"0.85rem" }} onClick={allowSteal}>🔄 فرصة سرقة</button>}
                      <button className="btn-secondary" style={{ fontSize:"0.85rem", opacity: gameMode==="challenge" ? 0.55 : 1 }} onClick={skipQ} disabled={gameMode==="challenge"}>⏭ تخطي السؤال</button>
                      <button className="btn-secondary" style={{ fontSize:"0.85rem" }} onClick={cancelQuestion}>✖ إغلاق</button>
                      <button className="btn-secondary" style={{ fontSize:"0.85rem" }} onClick={nextQuestion}>➡ السؤال التالي</button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign:"center", padding:"2rem", color:"#3d5068" }}>
                    <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>👆</div>
                    <div>اضغط على حرف في اللوحة لتحميل سؤاله</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Board */}
            <div className="kc-card">
              <div className="section-title">لوحة اللعب</div>
              <div style={{ fontSize:"0.78rem", color:"#64748b", marginBottom:"0.5rem" }}>اضغط على حرف لتحميل سؤاله</div>
              {/* Path goal legend */}
              <div style={{ display:"flex", gap:"1rem", marginBottom:"0.75rem", flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                  <div style={{ width:16, height:6, background:room.team1.color, borderRadius:"2px" }} />
                  <span style={{ fontSize:"0.72rem", color:"#94a3b8" }}>{room.team1.name}: يسار ← يمين</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                  <div style={{ width:6, height:16, background:room.team2.color, borderRadius:"2px" }} />
                  <span style={{ fontSize:"0.72rem", color:"#94a3b8" }}>{room.team2.name}: أعلى ↓ أسفل</span>
                </div>
              </div>
              <HexBoard board={room.board} gridSize={room.gridSize} mode="host-game"
                selectedCellId={room.selectedCellId} team1={room.team1} team2={room.team2}
                onCellClick={handleCellClick} winningPathIds={winningPathIds} />
              {room.activeQuestion && room.questionStatus!=="correct" && (
                <button className="btn-gold" style={{ width:"100%", marginTop:"1rem", fontSize:"0.9rem" }} onClick={markCorrect} disabled={actionLock}>
                  🎯 منح الحرف "{room.activeQuestion.cellLabel}" للفريق النشط
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══ TAB: Settings ══ */}
        {activeTab==="settings" && (
          <SettingsTab room={room} push={push} roomCode={roomCode} />
        )}
      </div>
    </div>
  );
}

// ── Settings Tab ──────────────────────────────────────────────
function SettingsTab({ room, push, roomCode }: { room: RoomState; push: (u: Partial<RoomState>)=>Promise<void>; roomCode: string }) {
  const [settingsSection, setSettingsSection] = useState<"teams"|"game"|"players"|"links"|"danger">("teams");

  return (
    <div className="responsive-settings-layout" style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:"1.25rem" }}>
      {/* Side nav */}
      <div className="kc-card" style={{ padding:"0.75rem", height:"fit-content" }}>
        {([
          { id:"teams", label:"الفرق" },
          { id:"game", label:"إعدادات اللعبة" },
          { id:"players", label:"قائمة المشاركين" },
          { id:"links", label:"الروابط" },
          { id:"danger", label:"خيارات خطيرة" },
        ] as const).map(s=>(
          <button key={s.id}
            onClick={()=>setSettingsSection(s.id)}
            style={{ width:"100%", textAlign:"right", padding:"0.55rem 0.75rem", borderRadius:"8px", border:"none",
              background: settingsSection===s.id?"#f59e0b":"transparent",
              color: settingsSection===s.id?"#090d18":"#94a3b8",
              fontWeight:600, fontSize:"0.85rem", marginBottom:"0.2rem", cursor:"pointer",
              fontFamily:"Cairo,sans-serif" }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {settingsSection==="teams" && <TeamsSettings room={room} push={push} />}
        {settingsSection==="game" && <GameSettings room={room} push={push} />}
        {settingsSection==="players" && <PlayersSettings room={room} roomCode={roomCode} push={push} />}
        {settingsSection==="links" && <LinksSettings room={room} roomCode={roomCode} />}
        {settingsSection==="danger" && <DangerSettings room={room} push={push} roomCode={roomCode} />}
      </div>
    </div>
  );
}

// ── Teams settings ────────────────────────────────────────────
function TeamsSettings({ room, push }: { room: RoomState; push: (u: Partial<RoomState>)=>Promise<void> }) {
  const [t1, setT1] = useState({ ...room.team1 });
  const [t2, setT2] = useState({ ...room.team2 });
  const members = ((room as any).teamMembers || { "1": [], "2": [] }) as Record<string, Array<{ id:string; name:string; status:"present"|"absent"|"pending"; star?:boolean }>>;
  const [newMember, setNewMember] = useState<{1:string;2:string}>({1:"",2:""});
  useEffect(()=>{ setT1({...room.team1}); setT2({...room.team2}); }, [room.team1, room.team2]);
  const updateMembers = async (teamId: 1|2, updater: (arr: any[]) => any[]) => {
    const next = { ...(room as any).teamMembers || { "1": [], "2": [] } };
    next[String(teamId)] = updater([...(next[String(teamId)] || [])]);
    await push({ ...( { teamMembers: next } as any) });
  };
  const addMember = async (teamId: 1|2) => {
    const name = newMember[teamId].trim();
    if (!name) return;
    await updateMembers(teamId, (arr) => [...arr, { id: `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name, status: "pending", star: false }]);
    setNewMember(prev => ({ ...prev, [teamId]: "" }));
  };
  const setMemberStatus = async (teamId: 1|2, memberId: string, status: "present"|"absent"|"pending") => {
    await updateMembers(teamId, (arr) => arr.map((m) => m.id === memberId ? { ...m, status } : m));
  };
  const setStar = async (teamId: 1|2, memberId: string) => {
    await updateMembers(teamId, (arr) => arr.map((m) => ({ ...m, star: m.id === memberId ? !m.star : false })));
    showToast.success("تم اختيار نجم الفريق");
  };
  const removeMember = async (teamId: 1|2, memberId: string) => updateMembers(teamId, (arr) => arr.filter((m) => m.id !== memberId));
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.25rem" }}>
      {[{ label:"الفريق الأول", t:t1, setT:setT1, key:"team1" as const },
        { label:"الفريق الثاني", t:t2, setT:setT2, key:"team2" as const }].map(({ label, t, setT, key }, idx)=>(
        <div key={key} className="kc-card">
          <div className="section-title">{label}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
            <div><label style={lbl2}>اسم الفريق</label><input value={t.name} onChange={e=>setT({...t,name:e.target.value})} className="kc-input" /></div>
            <div><label style={lbl2}>الأحرف الأولى</label><input value={t.initials} onChange={e=>setT({...t,initials:e.target.value})} maxLength={3} className="kc-input" /></div>
            <div><label style={lbl2}>لون الفريق</label><ColorPicker value={t.color} onChange={c=>setT({...t,color:c})} /></div>
            <button className="btn-gold" onClick={()=>push({ [key]:t })}>حفظ الفريق</button>
            <div style={{ marginTop:"0.5rem", borderTop:"1px solid #1a2332", paddingTop:"0.75rem" }}>
              <div style={{ fontWeight:700, color:"#f59e0b", marginBottom:"0.35rem" }}>أعضاء الفريق</div>
              <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginBottom:"0.45rem" }}>
                الحضور: {(members[String(idx+1)] || []).filter(m=>m.status==="present").length} / {(members[String(idx+1)] || []).length}
              </div>
              <div style={{ display:"flex", gap:"0.35rem", marginBottom:"0.45rem" }}>
                <input className="kc-input" placeholder="اسم العضو" value={newMember[(idx+1) as 1|2]} onChange={e=>setNewMember(prev=>({ ...prev, [idx+1]: e.target.value }))} />
                <button className="btn-secondary" onClick={()=>addMember((idx+1) as 1|2)}>إضافة عضو</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
                {(members[String(idx+1)] || []).map((m)=>(
                  <div key={m.id} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"8px", padding:"0.45rem" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", gap:"0.35rem", alignItems:"center" }}>
                      <div style={{ fontSize:"0.82rem", color:"#f0ede8", fontWeight:700 }}>{m.name} {m.star ? "⭐" : ""}</div>
                      <div style={{ fontSize:"0.72rem", color:m.status==="present"?"#22c55e":m.status==="absent"?"#ef4444":"#94a3b8" }}>{m.status==="present"?"حاضر":m.status==="absent"?"غائب":"بانتظار التأكيد"}</div>
                    </div>
                    <div style={{ display:"flex", gap:"0.3rem", marginTop:"0.35rem", flexWrap:"wrap" }}>
                      <button className="btn-secondary" style={{ fontSize:"0.7rem" }} onClick={()=>setMemberStatus((idx+1) as 1|2, m.id, "present")}>تأكيد الحضور</button>
                      <button className="btn-secondary" style={{ fontSize:"0.7rem" }} onClick={()=>setMemberStatus((idx+1) as 1|2, m.id, "absent")}>غائب</button>
                      <button className="btn-secondary" style={{ fontSize:"0.7rem" }} onClick={()=>setStar((idx+1) as 1|2, m.id)}>{m.star ? "إلغاء نجم الفريق" : "اختيار نجم الفريق"}</button>
                      <button className="btn-danger" style={{ fontSize:"0.7rem" }} onClick={()=>removeMember((idx+1) as 1|2, m.id)}>إزالة العضو</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Game settings ─────────────────────────────────────────────
function GameSettings({ room, push }: { room: RoomState; push: (u: Partial<RoomState>)=>Promise<void> }) {
  const [gs, setGs] = useState(room.gridSize);
  const [cls, setCls] = useState(room.cellLabelStyle);
  const [wm, setWm] = useState(room.winningMode);
  const [ts, setTs] = useState(room.timerSetting);
  const [sm, setSm] = useState(room.stealMode);
  const [gt, setGt] = useState(room.gameTitle);
  const [lt, setLt] = useState(room.logoText);
  return (
    <div className="kc-card">
      <div className="section-title">إعدادات اللعبة</div>
      <div className="responsive-two-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
        <div><label style={lbl2}>عنوان اللعبة</label><input value={gt} onChange={e=>setGt(e.target.value)} className="kc-input" /></div>
        <div><label style={lbl2}>شعار نصي اختياري</label><input value={lt} onChange={e=>setLt(e.target.value)} placeholder="اختياري..." className="kc-input" /></div>
        <div><label style={lbl2}>حجم اللوحة</label>
          <select value={gs} onChange={e=>setGs(Number(e.target.value) as 4|5|6)} className="kc-input">
            <option value={4}>٤ × ٤</option><option value={5}>٥ × ٥</option><option value={6}>٦ × ٦</option>
          </select></div>
        <div><label style={lbl2}>نمط الخلايا</label>
          <select value={cls} onChange={e=>setCls(e.target.value as RoomState["cellLabelStyle"])} className="kc-input">
            <option value="arabic">حروف عربية</option><option value="english">حروف إنجليزية</option><option value="numbers">أرقام</option>
          </select></div>
        <div><label style={lbl2}>نظام الفوز</label>
          <select value={wm} onChange={e=>setWm(e.target.value as RoomState["winningMode"])} className="kc-input">
            <option value="path">مسار (الفريق ١: يسار←يمين / الفريق ٢: أعلى←أسفل)</option>
            <option value="points">نقاط (الأكثر نقاطاً يفوز)</option>
            <option value="manual">يدوي (المضيف يعلن الفائز)</option>
          </select></div>
        <div><label style={lbl2}>وقت المؤقت</label>
          <select value={ts} onChange={e=>setTs(Number(e.target.value))} className="kc-input">
            <option value={0}>بدون مؤقت</option><option value={15}>١٥ ثانية</option>
            <option value={30}>٣٠ ثانية</option><option value={45}>٤٥ ثانية</option><option value={60}>٦٠ ثانية</option>
          </select></div>
        <div><label style={lbl2}>وضع السرقة</label>
          <select value={sm} onChange={e=>setSm(e.target.value as RoomState["stealMode"])} className="kc-input">
            <option value="none">بدون سرقة</option>
            <option value="steal">السرقة متاحة بعد الإجابة الخاطئة</option>
            <option value="manual">المضيف يقرر</option>
          </select></div>
      </div>
      <button className="btn-gold" style={{ marginTop:"1rem" }}
        onClick={()=>push({ gridSize:gs, cellLabelStyle:cls, winningMode:wm, timerSetting:ts, stealMode:sm, gameTitle:gt, logoText:lt })}>
        حفظ الإعدادات
      </button>
    </div>
  );
}

// ── Players settings ──────────────────────────────────────────
function PlayersSettings({ room, roomCode, push }: { room: RoomState; roomCode: string; push: (u: Partial<RoomState>)=>Promise<void> }) {
  const [name, setName] = useState("");
  const [team, setTeam] = useState<0|1|2>(0);
  const [bulk, setBulk] = useState("");
  const [bulkTeam, setBulkTeam] = useState<0|1|2>(0);
  const [adding, setAdding] = useState(false);

  const players = Object.values(room.players || {});
  const t1Players = players.filter(p=>p.team===1);
  const t2Players = players.filter(p=>p.team===2);
  const noTeam = players.filter(p=>p.team===0);

  const addOne = async () => {
    const n = name.trim();
    if (!n) { showToast.error("الرجاء إدخال اسم المشارك."); return; }
    const exists = players.some(p=>p.name===n);
    if (exists) {
      if (!window.confirm(`يوجد مشارك بهذا الاسم بالفعل. هل تريد إضافته مرة أخرى؟`)) return;
    }
    setAdding(true);
    try {
      await addPlayerManually(roomCode, n, team);
      showToast.success(`تم إضافة ${n} ✓`);
      setName("");
    } catch (e) { console.error(e); showToast.error("فشل الإضافة"); }
    setAdding(false);
  };

  const addBulk = async () => {
    const lines = bulk.split("\n").map(l=>l.trim()).filter(l=>l.length>0);
    if (!lines.length) { showToast.error("أدخل أسماء المشاركين"); return; }
    setAdding(true);
    try {
      for (const n of lines) {
        await addPlayerManually(roomCode, n, bulkTeam);
      }
      showToast.success(`تم إضافة ${lines.length} مشارك ✓`);
      setBulk("");
    } catch (e) { console.error(e); showToast.error("فشل الإضافة"); }
    setAdding(false);
  };

  const reassign = async (playerId: string, t: 0|1|2) => {
    try { await assignPlayerTeam(roomCode, playerId, t); }
    catch (e) { console.error(e); showToast.error("فشل التعديل"); }
  };

  const remove = async (playerId: string) => {
    try { await removePlayer(roomCode, playerId); }
    catch (e) { console.error(e); showToast.error("فشل الحذف"); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.25rem" }}>
      {/* Add single */}
      <div className="kc-card">
        <div className="section-title">إضافة مشارك يدويًا</div>
        <div style={{ fontSize:"0.8rem", color:"#64748b", marginBottom:"0.75rem" }}>
          إذا لم يكن لدى المشاركين أجهزة، يمكنك إضافتهم يدويًا هنا.
        </div>
        <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap" }}>
          <input value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addOne()}
            placeholder="اسم المشارك" className="kc-input" style={{ flex:1, minWidth:160 }} />
          <select value={team} onChange={e=>setTeam(Number(e.target.value) as 0|1|2)} className="kc-input" style={{ width:160 }}>
            <option value={0}>بدون فريق</option>
            <option value={1}>{room.team1.name}</option>
            <option value={2}>{room.team2.name}</option>
          </select>
          <button className="btn-gold" onClick={addOne} disabled={adding}>إضافة مشارك</button>
        </div>
        <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem", flexWrap:"wrap" }}>
          <button className="btn-secondary" style={{ fontSize:"0.78rem" }} onClick={()=>{ if(name.trim()){setTeam(1);setTimeout(addOne,50);} else showToast.error("أدخل الاسم أولاً"); }}>
            إضافة إلى {room.team1.name}
          </button>
          <button className="btn-secondary" style={{ fontSize:"0.78rem" }} onClick={()=>{ if(name.trim()){setTeam(2);setTimeout(addOne,50);} else showToast.error("أدخل الاسم أولاً"); }}>
            إضافة إلى {room.team2.name}
          </button>
        </div>
      </div>

      {/* Bulk add */}
      <div className="kc-card">
        <div className="section-title">إضافة عدة مشاركين</div>
        <textarea value={bulk} onChange={e=>setBulk(e.target.value)} rows={4}
          placeholder={"اكتب كل اسم في سطر مستقل\nمثال:\nأحمد\nسارة\nمحمد"}
          className="kc-input" style={{ resize:"vertical", marginBottom:"0.75rem" }} />
        <div style={{ display:"flex", gap:"0.75rem", flexWrap:"wrap", alignItems:"center" }}>
          <select value={bulkTeam} onChange={e=>setBulkTeam(Number(e.target.value) as 0|1|2)} className="kc-input" style={{ width:160 }}>
            <option value={0}>بدون فريق</option>
            <option value={1}>{room.team1.name}</option>
            <option value={2}>{room.team2.name}</option>
          </select>
          <button className="btn-gold" onClick={addBulk} disabled={adding}>إضافة الأسماء</button>
        </div>
      </div>

      {/* Player list */}
      <div className="kc-card">
        <div className="section-title">المشاركون ({players.length})</div>
        {players.length===0 ? (
          <div style={{ textAlign:"center", padding:"2rem", color:"#3d5068" }}>
            <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>👥</div>
            <div>لا يوجد مشاركون بعد</div>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
            {players.map(p=>(
              <div key={p.id} style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.55rem 0.75rem", background:"#141e2d", borderRadius:"10px", border:"1.5px solid #1a2332" }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background: p.team===1?room.team1.color:p.team===2?room.team2.color:"#1a2332",
                  display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, color:"#fff", fontSize:"0.8rem", flexShrink:0 }}>
                  {p.name.charAt(0)}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, color:"#f0ede8", fontSize:"0.9rem" }}>{p.name}</div>
                  <div style={{ fontSize:"0.7rem", color:"#64748b" }}>
                    {p.joinMethod==="manual" ? "أضافه المضيف" : "انضم بنفسه"} •{" "}
                    {p.team===0 ? "بدون فريق" : p.team===1 ? room.team1.name : room.team2.name}
                  </div>
                </div>
                <div style={{ display:"flex", gap:"0.3rem" }}>
                  <button onClick={()=>reassign(p.id,1)} style={{ padding:"0.2rem 0.45rem", fontSize:"0.7rem", borderRadius:"6px", background:room.team1.color+"22", color:room.team1.color, border:`1px solid ${room.team1.color}44`, cursor:"pointer" }}>
                    {room.team1.initials}
                  </button>
                  <button onClick={()=>reassign(p.id,2)} style={{ padding:"0.2rem 0.45rem", fontSize:"0.7rem", borderRadius:"6px", background:room.team2.color+"22", color:room.team2.color, border:`1px solid ${room.team2.color}44`, cursor:"pointer" }}>
                    {room.team2.initials}
                  </button>
                  <button onClick={()=>remove(p.id)} style={{ padding:"0.2rem 0.45rem", fontSize:"0.7rem", borderRadius:"6px", background:"rgba(239,68,68,0.1)", color:"#ef4444", border:"1px solid rgba(239,68,68,0.3)", cursor:"pointer" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Team summary */}
        {players.length>0 && (
          <div style={{ display:"flex", gap:"0.75rem", marginTop:"0.75rem", flexWrap:"wrap" }}>
            {[
              { label:room.team1.name, count:t1Players.length, color:room.team1.color },
              { label:room.team2.name, count:t2Players.length, color:room.team2.color },
              { label:"بدون فريق", count:noTeam.length, color:"#64748b" },
            ].map(s=>(
              <div key={s.label} style={{ background:"#141e2d", borderRadius:"8px", padding:"0.4rem 0.75rem", textAlign:"center" }}>
                <div style={{ fontSize:"0.65rem", color:"#64748b" }}>{s.label}</div>
                <div style={{ fontWeight:800, color:s.color }}>{s.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Links settings ────────────────────────────────────────────
function LinksSettings({ room, roomCode }: { room: RoomState; roomCode: string }) {
  const jl = joinLink(roomCode);
  const dl = displayLink(roomCode);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
      <div className="kc-card">
        <div className="section-title">رابط الانضمام</div>
        <div style={{ fontSize:"0.8rem", color:"#64748b", marginBottom:"0.75rem" }}>
          هذا الرابط مخصص للمشاركين لإدخال أسمائهم والانضمام إلى الغرفة.
        </div>
        <div style={{ background:"#141e2d", borderRadius:"10px", padding:"0.75rem", fontFamily:"monospace", fontSize:"0.85rem", color:"#f59e0b", wordBreak:"break-all", marginBottom:"0.75rem" }}>
          {jl}
        </div>
        <div style={{ display:"flex", gap:"0.5rem" }}>
          <button className="btn-gold" onClick={()=>copyText(jl,"رابط الانضمام")}>📋 نسخ رابط الانضمام</button>
          <button className="btn-secondary" onClick={()=>window.open(`/join?room=${roomCode}`,"_blank")}>🔗 فتح صفحة الانضمام</button>
        </div>
      </div>
      <div className="kc-card">
        <div className="section-title">رابط شاشة العرض</div>
        <div style={{ fontSize:"0.8rem", color:"#64748b", marginBottom:"0.75rem" }}>
          هذا الرابط مخصص لشاشة العرض أو البروجكتور، وليس لإدخال أسماء المشاركين.
        </div>
        <div style={{ background:"#141e2d", borderRadius:"10px", padding:"0.75rem", fontFamily:"monospace", fontSize:"0.85rem", color:"#f59e0b", wordBreak:"break-all", marginBottom:"0.75rem" }}>
          {dl}
        </div>
        <div style={{ display:"flex", gap:"0.5rem" }}>
          <button className="btn-gold" onClick={()=>copyText(dl,"رابط شاشة العرض")}>📋 نسخ رابط شاشة العرض</button>
          <button className="btn-secondary" onClick={()=>window.open(`/participant?room=${roomCode}`,"_blank")}>🖥 فتح شاشة العرض</button>
        </div>
      </div>
      <div className="kc-card">
        <div className="section-title">رمز الغرفة</div>
        <div style={{ fontSize:"3rem", fontWeight:900, color:"#f59e0b", letterSpacing:"0.2em", textAlign:"center", padding:"1rem", background:"#141e2d", borderRadius:"12px" }}>
          {roomCode}
        </div>
        <button className="btn-secondary" style={{ width:"100%", marginTop:"0.75rem" }} onClick={()=>copyText(roomCode,"رمز الغرفة")}>
          📋 نسخ رمز الغرفة
        </button>
      </div>
    </div>
  );
}

// ── Danger settings ───────────────────────────────────────────
function DangerSettings({ room, push, roomCode }: { room: RoomState; push: (u: Partial<RoomState>)=>Promise<void>; roomCode: string }) {
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<(()=>void)|null>(null);
  const confirm = (msg: string, action: ()=>void) => { setConfirmMsg(msg); setConfirmAction(()=>action); };

  return (
    <div className="kc-card">
      {confirmMsg && confirmAction && (
        <ConfirmModal msg={confirmMsg}
          onYes={()=>{ confirmAction(); setConfirmMsg(""); setConfirmAction(null); }}
          onNo={()=>{ setConfirmMsg(""); setConfirmAction(null); }} />
      )}
      <div className="section-title" style={{ color:"#ef4444", borderColor:"#ef4444" }}>خيارات خطيرة</div>
      <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
        <button className="btn-danger" onClick={()=>confirm("هل أنت متأكد من إعادة ضبط اللعبة؟ سيتم مسح النقاط والخلايا والسؤال الحالي.", async()=>{
          const rb = room.board.map(c=>({...c,claimedBy:0 as const,used:false}));
          await push({ board:rb, team1Score:0, team2Score:0, activeQuestion:null, selectedCellId:"",
            answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false,
            timerRunning:false, timerValue:room.timerSetting, winnerMessage:"", winnerTeam:0,
            questionStatus:"idle", gameStatus:"lobby", activeTeam:1, roundNumber:1 });
          showToast.success("تم إعادة ضبط اللعبة");
        })}>↺ إعادة ضبط اللعبة</button>

        <button className="btn-danger" onClick={()=>confirm("هل تريد مسح جميع الأسئلة من اللوحة؟ لا يمكن التراجع.", async()=>{
          const cb = room.board.map(c=>({...c,question:"",answer:"",category:"",difficulty:"easy" as const,points:1,hint:"",explanation:""}));
          await push({ board:cb });
          showToast.success("تم مسح جميع الأسئلة");
        })}>🗑 مسح جميع الأسئلة</button>

        <button className="btn-danger" onClick={()=>confirm("هل تريد حذف هذه الغرفة نهائياً؟ لا يمكن التراجع.", async()=>{
          await deleteRoom(roomCode);
          saveLastRoomCode("");
          window.location.reload();
        })}>🔥 حذف الغرفة نهائياً</button>
      </div>
    </div>
  );
}

const lbl2: React.CSSProperties = { display:"block", fontSize:"0.8rem", fontWeight:600, color:"#94a3b8", marginBottom:"0.35rem" };
