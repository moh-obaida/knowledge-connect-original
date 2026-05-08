import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  createRoom, generateUniqueCode, updateRoom, subscribeToRoom, deleteRoom,
  addPlayerManually, assignPlayerTeam, removePlayer,
} from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  defaultRoomState, generateBoard, shuffleBoard, sortedBoard, checkWinner,
  findWinningPath,
  loadLastRoomCode, saveLastRoomCode,
  type RoomState, type BoardCell, type ActiveQuestion, type Player,
} from "../lib/store";
import HexBoard from "../components/HexBoard";
import { showToast } from "../components/KcToast";
import { normalizeQuestion, validateQuestion } from "../lib/questionTypes";
import { checkAnswer } from "../lib/questionTypes";
import HostDashboardHeader from "../components/host/HostDashboardHeader";
import TemplatePreviewModal from "../components/host/TemplatePreviewModal";
import HostLobbyCard from "../components/host/HostLobbyCard";
import JoinQRCard from "../components/host/JoinQRCard";
import ResultPreviewModal from "../components/host/ResultPreviewModal";
import LiveQuestionModal from "../components/host/LiveQuestionModal";
import { saveGameResult, loadGameResults, deleteGameResult, exportResultsJSON, exportResultsCSV, summarizeResult, aggregateResults, type GameResult } from "../lib/gameResults";

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
type QType = "fill" | "mcq" | "tf" | "image" | "open";
const TF_OPTIONS = ["صحيح", "خطأ"] as const;
function CellEditor({ cell, onSave, onClose }: {
  cell: BoardCell; onSave: (u: Partial<BoardCell>) => void; onClose: () => void;
}) {
  type BankQ = { type: QType; question:string; answer:string; choices?: string[]; imageUrl?: string; category:string; difficulty: BoardCell["difficulty"]; points:number; hint:string; explanation:string };
  const normalized = (): BankQ[] => {
    const arr = Array.isArray((cell as any).questionBank) ? (cell as any).questionBank : [];
    const mapped = arr.filter((x:any)=>x?.question).map((x:any)=>({
      type: (x.type === "mcq" || x.type === "tf") ? x.type : "fill",
      question: String(x.question||"").trim(),
      answer: String(x.answer||"").trim(),
      choices: Array.isArray(x.choices) ? x.choices.map((c:any)=>String(c||"").trim()).filter(Boolean) : undefined,
      imageUrl: String(x.imageUrl||"").trim(),
      category: String(x.category||"غير مصنف").trim() || "غير مصنف",
      difficulty: (x.difficulty==="easy"||x.difficulty==="medium"||x.difficulty==="hard") ? x.difficulty : "medium",
      points: Number(x.points)||1,
      hint: String(x.hint||""),
      explanation: String(x.explanation||""),
    })) as BankQ[];
    if (mapped.length) return mapped;
    if (cell.question.trim()) return [{ type:"fill", question:cell.question, answer:cell.answer, category:cell.category||"غير مصنف", difficulty:cell.difficulty, points:cell.points||1, hint:cell.hint||"", explanation:cell.explanation||"" }];
    return [];
  };
  const [questionBank, setQuestionBank] = useState<BankQ[]>(normalized());
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [type, setType] = useState<QType>("fill");
  const [q, setQ] = useState(cell.question);
  const [a, setA] = useState(cell.answer);
  const [choices, setChoices] = useState<string[]>(["", "", "", ""]);
  const [cat, setCat] = useState(cell.category);
  const [imageUrl, setImageUrl] = useState("");
  const [diff, setDiff] = useState(cell.difficulty);
  const [pts, setPts] = useState(cell.points);
  const [hint, setHint] = useState(cell.hint);
  const [expl, setExpl] = useState(cell.explanation);

  const save = () => {
    if (!q.trim()) { showToast.error("نص السؤال مطلوب"); return; }
    let answerToSave = a.trim();
    let choicesToSave: string[] | undefined;
    if (type === "mcq") {
      const cleanChoices = choices.map((c) => c.trim()).filter(Boolean);
      if (cleanChoices.length < 2) { showToast.error("اختيار من متعدد يحتاج خيارَين على الأقل"); return; }
      if (!answerToSave) { showToast.error("اختر الإجابة الصحيحة من الخيارات"); return; }
      if (!cleanChoices.includes(answerToSave)) { showToast.error("الإجابة الصحيحة يجب أن تطابق أحد الخيارات"); return; }
      choicesToSave = cleanChoices;
    } else if (type === "tf") {
      if (!TF_OPTIONS.includes(answerToSave as any)) { showToast.error("اختر الإجابة: صحيح أو خطأ"); return; }
      choicesToSave = [...TF_OPTIONS];
    } else {
      if (!answerToSave) { showToast.error("الإجابة الصحيحة مطلوبة"); return; }
      const firstAnswerChar = answerToSave.charAt(0);
      if (firstAnswerChar && firstAnswerChar !== cell.label) {
        showToast.warning("تنبيه: الإجابة لا تبدأ بالحرف المحدد.");
      }
    }
    const next = [...questionBank];
    const payload: BankQ = { type, question: q.trim(), answer: answerToSave, choices: choicesToSave, imageUrl: imageUrl.trim(), category: (cat.trim()||"غير مصنف"), difficulty: diff, points: Number(pts)||1, hint: hint.trim(), explanation: expl.trim() };
    if (editingIndex >= 0) next[editingIndex] = payload;
    else {
      if (next.length >= 50) { showToast.warning("وصلت إلى الحد الأقصى لهذا الحرف: 50 سؤالًا."); return; }
      next.push(payload);
    }
    setQuestionBank(next);
    setEditingIndex(next.length-1);
    const first = next[0];
    onSave({ question: first.question, answer: first.answer, category: first.category, difficulty: first.difficulty, points: first.points, hint: first.hint, explanation: first.explanation, ...( { questionBank: next } as any) });
    showToast.success("تم حفظ السؤال");
  };

  const loadEditing = (item: BankQ, idx: number) => {
    setEditingIndex(idx);
    setType(item.type || "fill");
    setQ(item.question);
    setA(item.answer);
    const c = item.choices || [];
    if (item.type === "mcq") {
      const padded = [...c, "", "", "", ""].slice(0, 4);
      setChoices(padded);
    } else {
      setChoices(["", "", "", ""]);
    }
    setCat(item.category);
    setImageUrl(item.imageUrl || "");
    setDiff(item.difficulty);
    setPts(item.points);
    setHint(item.hint);
    setExpl(item.explanation);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.25rem" }}>
          <div style={{ fontWeight:800, fontSize:"1.1rem", color:"#f59e0b" }}>إعداد سؤال الحرف: <span style={{ fontSize:"1.4rem" }}>{cell.label}</span></div>
          <button aria-label="إغلاق نافذة السؤال" onClick={onClose} style={{ background:"none", border:"none", color:"#64748b", fontSize:"1.2rem" }}>✕</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.85rem" }}>
          <div style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.6rem" }}>
            <div style={{ fontSize:"0.8rem", fontWeight:700, color:"#f59e0b", marginBottom:"0.35rem" }}>بنك أسئلة الحرف</div>
            <div style={{ fontSize:"0.75rem", color:"#94a3b8", marginBottom:"0.45rem" }}>عدد الأسئلة: {questionBank.length} / 50</div>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.3rem", maxHeight:130, overflowY:"auto" }}>
              {questionBank.map((item, i)=>(
                <div key={i} style={{ display:"flex", gap:"0.35rem", alignItems:"center" }}>
                  <button className="btn-secondary" style={{ fontSize:"0.68rem", padding:"0.2rem 0.45rem" }} onClick={()=>loadEditing(item, i)}>تعديل</button>
                  <button className="btn-danger" style={{ fontSize:"0.68rem", padding:"0.2rem 0.45rem" }} onClick={()=>{ const next=questionBank.filter((_,ix)=>ix!==i); setQuestionBank(next); const first=next[0]; onSave(first?{ question:first.question, answer:first.answer, category:first.category, difficulty:first.difficulty, points:first.points, hint:first.hint, explanation:first.explanation, ...( { questionBank: next } as any)}:{ question:"", answer:"", category:"", difficulty:"easy", points:1, hint:"", explanation:"", ...( { questionBank: [] } as any)}); }}>حذف</button>
                  <span style={{ fontSize:"0.65rem", padding:"0.1rem 0.4rem", borderRadius:9999, background:"#0f1623", color:"#94a3b8" }}>
                    {item.type === "mcq" ? "اختيار من متعدد" : item.type === "tf" ? "صح/خطأ" : "إجابة قصيرة"}
                  </span>
                  <div style={{ fontSize:"0.75rem", color:"#cbd5e1", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.question}</div>
                </div>
              ))}
            </div>
            <button className="btn-gold" style={{ fontSize:"0.72rem", marginTop:"0.45rem" }} onClick={()=>{ setEditingIndex(-1); setType("fill"); setQ(""); setA(""); setChoices(["","","",""]); setCat("غير مصنف"); setDiff("medium"); setPts(1); setHint(""); setExpl(""); }}>إضافة سؤال لهذا الحرف</button>
          </div>
          <div>
            <label style={lbl}>نوع السؤال</label>
            <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
              {([
                { v: "fill", l: "إجابة قصيرة" },
                { v: "mcq", l: "اختيار من متعدد" },
                { v: "tf", l: "صح أو خطأ" },
              ] as const).map(opt => (
                <button key={opt.v} type="button"
                  onClick={()=>{
                    setType(opt.v);
                    if (opt.v === "tf") setA((prev) => (TF_OPTIONS.includes(prev as any) ? prev : ""));
                    if (opt.v === "mcq" && !choices.some(Boolean)) setChoices(["","","",""]);
                  }}
                  className={type === opt.v ? "btn-gold" : "btn-secondary"}
                  style={{ fontSize:"0.78rem", padding:"0.35rem 0.7rem" }}
                >{opt.l}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={lbl}>نص السؤال *</label>
            <textarea value={q} onChange={e=>setQ(e.target.value)} rows={3} placeholder="اكتب نص السؤال هنا..." className="kc-input" style={{ resize:"vertical" }} />
          </div>
          {type === "mcq" && (
            <div>
              <label style={lbl}>الخيارات *</label>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
                {choices.map((c, i) => (
                  <div key={i} style={{ display:"flex", gap:"0.4rem", alignItems:"center" }}>
                    <span style={{ fontSize:"0.72rem", color:"#94a3b8", minWidth:18 }}>{String.fromCharCode(65 + i)}.</span>
                    <input
                      value={c}
                      onChange={e => setChoices(prev => prev.map((p, ix) => ix === i ? e.target.value : p))}
                      placeholder={`الخيار ${i+1}`}
                      className="kc-input"
                    />
                    <button type="button" className={a && a === c.trim() && c.trim() !== "" ? "btn-green" : "btn-secondary"} style={{ fontSize:"0.68rem", padding:"0.25rem 0.55rem" }}
                      onClick={() => { const v = c.trim(); if (v) setA(v); }}
                      disabled={!c.trim()}
                    >
                      {a && a === c.trim() && c.trim() !== "" ? "✓ صحيحة" : "اختر صحيحة"}
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"0.4rem" }}>الإجابة الصحيحة الحالية: <strong style={{ color:"#f59e0b" }}>{a || "—"}</strong></div>
            </div>
          )}
          {type === "tf" && (
            <div>
              <label style={lbl}>الإجابة الصحيحة *</label>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                {TF_OPTIONS.map(opt => (
                  <button key={opt} type="button"
                    className={a === opt ? "btn-gold" : "btn-secondary"}
                    style={{ flex:1 }}
                    onClick={() => setA(opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>
          )}
          {type === "fill" && (
            <div>
              <label style={lbl}>الإجابة الصحيحة *</label>
              <input value={a} onChange={e=>setA(e.target.value)} placeholder="اكتب الإجابة الصحيحة هنا..." className="kc-input" />
            </div>
          )}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
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
            <button className="btn-gold" style={{ flex:1 }} onClick={save}>💾 حفظ السؤال</button>
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
  level: "سهل" | "متوسط" | "صعب";
  description?: string;
  questions: string[];
  boardBanks?: Array<{ cellId:string; label:string; questionBank:any[] }>;
  createdAt?: string;
  userCreated?: boolean;
};
type TemplateQuestionItem = {
  letter?: string;
  question: string;
  answer: string;
  category?: string;
  difficulty?: BoardCell["difficulty"];
  hint?: string;
  explanation?: string;
};
const COMMUNITY_TEMPLATES_KEY = "knowledgeConnectCommunityTemplates";
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
const normalizeTemplateQuestion = (q: any, fallbackLetter: string, fallbackCategory = "غير مصنف") => {
  const n = normalizeQuestion({ ...q, question: q?.question ?? q?.prompt, answer: q?.answer ?? q?.correctAnswer, letter: q?.letter || fallbackLetter, category: q?.category || fallbackCategory });
  return {
    type: n.type,
    question: n.prompt,
    answer: n.correctAnswer,
    choices: n.choices || [],
    category: n.category || fallbackCategory,
    difficulty: n.difficulty || "medium",
    points: Number((q as any)?.points) || 1,
    hint: String((q as any)?.hint || ""),
    explanation: n.explanation || "",
    letter: n.letter || fallbackLetter,
    imageUrl: n.imageUrl || "",
  };
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
  return { id, name, categories: [category], level, questions: boardBanks.map(b => b.questionBank[0].question), boardBanks };
};
const STARTER_TEMPLATES: StarterTemplate[] = [
  { ...createFullLetterTemplate("tpl_letters_basic", "قالب الحروف الأساسية", "حروف", "سهل", 2), description:"قالب تأسيسي لتدريب الطلاب على الحروف الأساسية." },
  { id:"tpl_islamic", name:"قالب أسئلة إسلامية", categories:["التربية الإسلامية"], level:"سهل", description:"أسئلة قصيرة ومباشرة في القيم والمفاهيم الإسلامية.", questions:["ما أول أركان الإسلام؟","كم عدد الصلوات المفروضة في اليوم؟","ما الشهر الذي يصوم فيه المسلمون؟","ما القبلة التي يتجه إليها المسلم في الصلاة؟","من هو خاتم الأنبياء؟"] },
  { id:"tpl_arabic", name:"قالب اللغة العربية", categories:["اللغة العربية"], level:"متوسط", description:"مفردات وحروف وفهم لغوي للمرحلة الأساسية.", questions:["اختر كلمة تبدأ بحرف الألف.","ما الحرف الأول في كلمة: باب؟","أي كلمة تحتوي على حرف السين؟","اختر كلمة تنتهي بحرف النون.","ما مرادف كلمة منزل؟"] },
  { id:"tpl_science", name:"قالب العلوم", categories:["العلوم"], level:"متوسط", description:"مراجعة سريعة لمفاهيم علمية عامة.", questions:["ما الكوكب الذي نعيش عليه؟","ما العضو الذي نستخدمه للرؤية؟","ما لون السماء في النهار؟","ما الحيوان الذي يعطينا الحليب؟","ما وسيلة النقل التي تطير في السماء؟"] },
  { id:"tpl_quick_review", name:"قالب مراجعة سريعة", categories:["مراجعة عامة"], level:"متوسط", description:"قالب متوازن للمراجعة قبل الاختبار.", questions:["ما أول أركان الإسلام؟","ما ناتج ٣ + ٤؟","ما الحرف الأول في كلمة: وردة؟","كم يومًا في الأسبوع؟","أكمل النمط: ٢، ٤، ٦، __"] },
  { id:"tpl_values", name:"قالب القيم والأخلاق", categories:["القيم والأخلاق"], level:"سهل", description:"قالب يركز على الأخلاق والقيم الإيجابية والسلوك المدرسي.", questions:["ما أهمية احترام المعلم؟","لماذا نحافظ على نظافة المدرسة؟","ما القيمة التي تظهر عند مساعدة الزملاء؟","ما الفرق بين الصدق والكذب؟","كيف نتعامل مع الأخطاء بأدب؟"] },
  { id:"tpl_vocab", name:"قالب المفردات", categories:["مفردات","اللغة العربية"], level:"متوسط", description:"قالب لتدريب الطلاب على المفردات والمعاني.", questions:["ما مرادف كلمة سعيد؟","ما عكس كلمة كبير؟","اختر كلمة تنتهي بتاء مربوطة.","ضع كلمة مدرسة في جملة مفيدة.","ما جمع كلمة كتاب؟"] },
  { id:"tpl_empty_teacher", name:"قالب فارغ للمعلم", categories:["غير مصنف"], level:"متوسط", description:"قالب فارغ مخصص لبناء لعبة من الصفر.", questions:[] },
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
  const [, setLocation] = useLocation();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"setup"|"game"|"settings">("setup");
  const [editingCell, setEditingCell] = useState<BoardCell | null>(null);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<(()=>void)|null>(null);
  const [answerActionBusy, setAnswerActionBusy] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<StarterTemplate | null>(null);
  const [communityTemplates, setCommunityTemplates] = useState<StarterTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [templateLevel, setTemplateLevel] = useState("");
  const [presentationMode, setPresentationMode] = useState(false);
  const [hostAnswer, setHostAnswer] = useState("");
  const [hostAnswerFeedback, setHostAnswerFeedback] = useState<string>("");
  const [appearanceMode, setAppearanceMode] = useState<"light"|"balanced"|"dark">(((localStorage.getItem("kc_appearance_mode") as any) || "dark"));
  const [visualTheme, setVisualTheme] = useState<string>(localStorage.getItem("kc_visual_theme") || "classic");
  const [hostViewMode, setHostViewMode] = useState<"dashboard"|"room">("dashboard");
  const [dashboardTab, setDashboardTab] = useState<"home"|"games"|"templates"|"results"|"settings">("home");
  const [dashboardHostName, setDashboardHostName] = useState("");
  const [dashboardClassName, setDashboardClassName] = useState("");
  const [dashboardOrgName, setDashboardOrgName] = useState("");
  const [gamesSearch, setGamesSearch] = useState("");
  const hostProfile = (() => {
    try { return JSON.parse(localStorage.getItem("kc_host_profile") || "{}"); }
    catch { return {}; }
  })() as { hostName?: string; className?: string; orgName?: string };
  useEffect(() => {
    setDashboardHostName(hostProfile.hostName || "");
    setDashboardClassName(hostProfile.className || "");
    setDashboardOrgName(hostProfile.orgName || "");
  }, [hostProfile.hostName, hostProfile.className, hostProfile.orgName]);
  const unsubRef = useRef<(()=>void)|null>(null);
  const roomRef = useRef<RoomState|null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const savedResultRef = useRef<Set<string>>(new Set());
  const [savedResults, setSavedResults] = useState<GameResult[]>(() => (typeof window !== "undefined" ? loadGameResults() : []));
  const [previewResult, setPreviewResult] = useState<GameResult | null>(null);
  const [liveCellId, setLiveCellId] = useState<string>("");
  const undoStackRef = useRef<Array<{ type: "claim"; cellId: string; team: 1 | 2; points: number; previousActiveTeam: 1 | 2 }>>([]);

  useEffect(() => { roomRef.current = room; }, [room]);
  useEffect(() => { localStorage.setItem("kc_appearance_mode", appearanceMode); }, [appearanceMode]);
  useEffect(() => { localStorage.setItem("kc_visual_theme", visualTheme); }, [visualTheme]);
  useEffect(() => {
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
        const nv = Math.max(0, cur.timerValue - 1);
        if (nv <= 0) {
          clearInterval(timerRef.current!);
          await updateRoom(cur.roomCode, { timerValue:0, timerRunning:false, questionStatus:"time_up" });
          showToast.info("انتهى الوقت");
        } else {
          await updateRoom(cur.roomCode, { timerValue:nv });
        }
      }, 1000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [room?.timerRunning, room?.roomCode]);

  const confirm = (msg: string, action: ()=>void) => { setConfirmMsg(msg); setConfirmAction(()=>action); };
  const cellHasQuestions = (cell: BoardCell) => {
    const bank = Array.isArray((cell as any).questionBank) ? (cell as any).questionBank : [];
    if (bank.some((q:any)=>String(q?.question||"").trim())) return true;
    return !!cell.question.trim();
  };

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
      setHostViewMode("room");
    } catch (e) { console.error(e); showToast.error("فشل إنشاء الغرفة"); }
    setCreating(false);
  };

  // Cell click
  const handleCellClick = (cell: BoardCell) => {
    if (!room) return;
    if (room.winnerTeam !== 0 || room.gameStatus === "finished") { showToast.info("انتهت اللعبة. ابدأ جولة جديدة."); return; }
    if (room.gameStatus === "lobby" || activeTab === "setup") {
      setEditingCell(cell);
    } else {
      if (cell.claimedBy !== 0) { showToast.info("هذا الحرف محجوز بالفعل."); return; }
      setLiveCellId(cell.id);
      if (!cellHasQuestions(cell)) {
        push({ activeQuestion: null, selectedCellId: cell.id, questionStatus: "idle" });
        return;
      }
      const bank = Array.isArray((cell as any).questionBank) && (cell as any).questionBank.length ? (cell as any).questionBank : [{ question: cell.question, answer: cell.answer, category: cell.category, difficulty: cell.difficulty, points: cell.points, hint: cell.hint, explanation: cell.explanation }];
      const first = bank[0];
      const fType = (first?.type === "mcq" || first?.type === "tf") ? first.type : "fill";
      const fChoices = fType === "mcq" && Array.isArray(first?.choices) ? first.choices.filter((c:any)=>typeof c === "string") : fType === "tf" ? ["صحيح","خطأ"] : undefined;
      const aq: ActiveQuestion = {
        cellId: cell.id, cellLabel: cell.label,
        question: first.question, answer: first.answer,
        category: first.category, difficulty: first.difficulty,
        points: first.points, hint: first.hint, explanation: first.explanation,
        type: fType,
        ...(fChoices ? { choices: fChoices } : {}),
      };
      push({
        activeQuestion: aq, selectedCellId: cell.id,
        answerVisibleToHost: false, answerVisibleToParticipants: false,
        hintVisibleToParticipants: false, questionStatus: "active",
        timerValue: room.timerSetting > 0 ? room.timerSetting : 0, timerMax: room.timerSetting > 0 ? room.timerSetting : 0, timerRunning: room.timerSetting > 0,
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
  const claimCell = async (cellId: string, forTeam?: 1 | 2) => {
    if (!room || answerActionBusy) return;
    const current = room.board.find(c => c.id===cellId);
    if (!current || current.claimedBy !== 0 || current.used || room.gameStatus === "finished") return;
    setAnswerActionBusy(true);
    const team = (forTeam || room.activeTeam) as 1 | 2;
    const nb = room.board.map(c => c.id===cellId ? {...c, claimedBy: team, used:true} : c);
    const pts = room.activeQuestion?.points || 1;
    const scoreUp = team===1 ? { team1Score: room.team1Score+pts } : { team2Score: room.team2Score+pts };
    undoStackRef.current.push({ type: "claim", cellId, team, points: pts, previousActiveTeam: room.activeTeam });
    const winner = checkWinner(nb, room.gridSize);
    const winMsg = winner===1 ? "فاز الفريق الأزرق!" : winner===2 ? "فاز الفريق الأحمر!" : "";
    await push({ board:nb, ...scoreUp, questionStatus:"correct", selectedCellId:"", activeQuestion:null,
      answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false,
      timerRunning:false, timerValue:0, timerMax:0,
      winnerMessage: winMsg, winnerTeam: winner,
      gameStatus: winMsg ? "finished" : room.gameStatus });
    if (winMsg) {
      showToast.success(winMsg);
      try {
        const finishedRoom: RoomState = { ...room, board: nb, ...scoreUp, winnerTeam: winner, winnerMessage: winMsg, gameStatus: "finished" } as RoomState;
        const dedupeKey = `${finishedRoom.roomCode}-${winner}-${finishedRoom.team1Score}-${finishedRoom.team2Score}`;
        if (!savedResultRef.current.has(dedupeKey)) {
          saveGameResult(finishedRoom);
          savedResultRef.current.add(dedupeKey);
          setSavedResults(loadGameResults());
        }
      } catch { /* ignore */ }
    }
    setAnswerActionBusy(false);
  };

  const markCorrect = () => { if (room?.activeQuestion && !answerActionBusy) claimCell(room.activeQuestion.cellId); };
  const markCorrectForTeam = (team: 1 | 2) => { if (room?.activeQuestion && !answerActionBusy) claimCell(room.activeQuestion.cellId, team); };

  const swapActiveTeam = () => {
    if (!room) return;
    const next: 1 | 2 = room.activeTeam === 1 ? 2 : 1;
    push({ activeTeam: next });
    showToast.info(`الدور انتقل إلى ${next === 1 ? room.team1.name : room.team2.name}`);
  };

  const undoLastAction = async () => {
    if (!room) return;
    const last = undoStackRef.current.pop();
    if (!last) { showToast.info("لا توجد حركة لإلغائها"); return; }
    if (last.type === "claim") {
      const nb = room.board.map(c => c.id === last.cellId ? { ...c, claimedBy: 0 as const, used: false } : c);
      const scoreFix = last.team === 1
        ? { team1Score: Math.max(0, room.team1Score - last.points) }
        : { team2Score: Math.max(0, room.team2Score - last.points) };
      await push({
        board: nb,
        ...scoreFix,
        winnerMessage: "",
        winnerTeam: 0,
        gameStatus: room.gameStatus === "finished" ? "active" : room.gameStatus,
        questionStatus: "idle",
        activeTeam: last.previousActiveTeam,
      });
      savedResultRef.current.clear();
      showToast.success("تم التراجع عن الحركة الأخيرة");
    }
  };

  const endGame = () => {
    if (!room) return;
    confirm("هل تريد إنهاء اللعبة الآن؟ سيتم حفظ النتيجة الحالية.", async () => {
      if (room.gameStatus === "finished" && room.winnerMessage) return;
      const t1 = Number.isFinite(room.team1Score) ? room.team1Score : 0;
      const t2 = Number.isFinite(room.team2Score) ? room.team2Score : 0;
      const pathWinner = checkWinner(room.board, room.gridSize);
      const winner: 0 | 1 | 2 = gameMode === "connection" ? pathWinner : (t1 > t2 ? 1 : t2 > t1 ? 2 : 0);
      const msg = winner === 1 ? `🏆 ${room.team1.name} فاز!` : winner === 2 ? `🏆 ${room.team2.name} فاز!` : "🤝 تعادل!";
      await push({ winnerMessage: msg, winnerTeam: winner, gameStatus: "finished", timerRunning:false, timerValue:0, timerMax:0, activeQuestion:null, selectedCellId:"", answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false });
      try {
        const finishedRoom: RoomState = { ...room, winnerTeam: winner, winnerMessage: msg, gameStatus: "finished" } as RoomState;
        const dedupeKey = `${finishedRoom.roomCode}-${winner}-${finishedRoom.team1Score}-${finishedRoom.team2Score}`;
        if (!savedResultRef.current.has(dedupeKey)) {
          saveGameResult(finishedRoom);
          savedResultRef.current.add(dedupeKey);
          setSavedResults(loadGameResults());
        }
      } catch { /* ignore */ }
      showToast.success("تم إنهاء اللعبة وحفظ النتيجة");
    });
  };

  const markWrong = async () => {
    if (!room) return;
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
        const nType = (next.type === "mcq" || next.type === "tf") ? next.type : "fill";
        const nChoices = nType === "mcq" && Array.isArray(next.choices) ? next.choices.filter((c:any)=>typeof c === "string") : nType === "tf" ? ["صحيح","خطأ"] : undefined;
        await push({
          activeQuestion: { ...room.activeQuestion, question: next.question, answer: next.answer, category: next.category, difficulty: next.difficulty, points: next.points || 1, hint: next.hint || "", explanation: next.explanation || "", type: nType, ...(nChoices ? { choices: nChoices } : { choices: [] }) },
          answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false,
          questionStatus:"active", timerRunning:false, timerValue: room.timerSetting,
        });
        return;
      }
    }
    await push({ activeQuestion:null, selectedCellId:"", answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false, questionStatus:"idle", timerRunning:false });
  };
  const skipQ = async () => {
    if (!room || answerActionBusy) return;
    setAnswerActionBusy(true);
    const cell = room.board.find(c=>c.id===room.activeQuestion?.cellId);
    const bank = cell ? (Array.isArray((cell as any).questionBank) && (cell as any).questionBank.length ? (cell as any).questionBank : (cell.question ? [{ question:cell.question, answer:cell.answer, category:cell.category, difficulty:cell.difficulty, points:cell.points, hint:cell.hint, explanation:cell.explanation }] : [])) : [];
    if (room.activeQuestion && bank.length > 1) {
      const idx = Math.max(0, bank.findIndex((q:any)=>q.question===room.activeQuestion?.question && q.answer===room.activeQuestion?.answer));
      const next = bank[idx+1];
      if (next) {
        const nType = (next.type === "mcq" || next.type === "tf") ? next.type : "fill";
        const nChoices = nType === "mcq" && Array.isArray(next.choices) ? next.choices.filter((c:any)=>typeof c === "string") : nType === "tf" ? ["صحيح","خطأ"] : undefined;
        await push({
          activeQuestion: { ...room.activeQuestion, question: next.question, answer: next.answer, category: next.category, difficulty: next.difficulty, points: next.points || 1, hint: next.hint || "", explanation: next.explanation || "", type: nType, ...(nChoices ? { choices: nChoices } : { choices: [] }) },
          answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false,
          questionStatus:"skipped", timerRunning:false, timerValue: room.timerSetting,
        });
        setAnswerActionBusy(false);
        return;
      }
    }
    await push({ activeQuestion:null, selectedCellId:"", questionStatus:"skipped", answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false });
    setHostAnswer("");
    setHostAnswerFeedback("تم تخطي السؤال");
    setAnswerActionBusy(false);
  };
  const verifyHostAnswer = async () => {
    if (!room?.activeQuestion) return;
    const q = normalizeQuestion({
      type: (room.activeQuestion as any).type || "fill",
      question: room.activeQuestion.question,
      answer: room.activeQuestion.answer,
      choices: (room.activeQuestion as any).choices || [],
      explanation: room.activeQuestion.explanation,
      category: room.activeQuestion.category,
      difficulty: room.activeQuestion.difficulty,
      letter: room.activeQuestion.cellLabel,
    });
    const ua = String(hostAnswer || "").trim();
    if (!ua) { showToast.warning("الإجابة الصحيحة مطلوبة."); return; }
    const r = checkAnswer(q, ua);
    setHostAnswerFeedback(r.feedback);
    if (r.isCorrect) {
      showToast.success("إجابة صحيحة!");
      markCorrect();
    } else {
      showToast.error("إجابة خاطئة");
      await markWrong();
    }
  };

  const startTimer = () => {
    if (!room) return;
    if (room.timerSetting <= 0) { showToast.info("بدون مؤقت"); return; }
    push({ timerRunning:true, timerMax: room.timerSetting });
  };
  const pauseTimer = () => push({ timerRunning:false });
  const resumeTimer = () => { if (!room || room.timerValue <= 0) return; push({ timerRunning:true }); };
  const addTimer15 = () => { if (!room) return; push({ timerValue: (room.timerValue || 0) + 15, timerMax: Math.max(room.timerMax || 0, (room.timerValue || 0) + 15) }); };
  const resetTimer = () => { if (!room) return; push({ timerRunning:false, timerValue:0, timerMax:0 }); };
  const addScore = (t: 1|2, d: number) => {
    if (!room) return;
    if (t===1) push({ team1Score: Math.max(0, room.team1Score+d) });
    else push({ team2Score: Math.max(0, room.team2Score+d) });
  };
  const declareWinner = (t: 1|2|"draw") => {
    if (!room) return;
    const msg = t==="draw" ? "🤝 تعادل!" : t===1 ? `🏆 ${room.team1.name} فاز!` : `🏆 ${room.team2.name} فاز!`;
    const winnerTeam: 0|1|2 = t==="draw" ? 0 : t;
    push({ winnerMessage:msg, winnerTeam, gameStatus:"finished", timerRunning:false, timerValue:0, timerMax:0, activeQuestion:null, selectedCellId:"", answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false });
    try {
      const finishedRoom: RoomState = { ...room, winnerTeam, winnerMessage: msg, gameStatus: "finished" } as RoomState;
      const dedupeKey = `${finishedRoom.roomCode}-${winnerTeam}-${finishedRoom.team1Score}-${finishedRoom.team2Score}`;
      if (!savedResultRef.current.has(dedupeKey)) {
        saveGameResult(finishedRoom);
        savedResultRef.current.add(dedupeKey);
        setSavedResults(loadGameResults());
      }
    } catch { /* ignore */ }
  };

  const startGame = async () => {
    if (!room) return;
    const withQuestions = room.board.filter(c=>cellHasQuestions(c)).length;
    if (withQuestions===0) { showToast.warning("لا توجد أسئلة بعد. أضف أسئلة من صفحة الإنشاء."); return; }
    const empty = room.board.filter(c=>!cellHasQuestions(c)).length;
    if (empty>0) {
      confirm(`بعض الحروف لا تحتوي على أسئلة (${empty} حرف). هل تريد المتابعة؟`,
        async () => { await push({ gameStatus:"active" }); setActiveTab("game"); });
    } else {
      await push({ gameStatus:"active" });
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
        timerRunning:false, timerValue:0, timerMax:0, winnerMessage:"", winnerTeam:0,
        questionStatus:"idle", gameStatus:"active", activeTeam:1, roundNumber:1 });
      savedResultRef.current.clear();
      showToast.success("تم إعادة ضبط اللعبة");
    });
  };

  const returnToTemplates = async () => {
    if (!room) return;
    await push({ winnerMessage: "", winnerTeam: 0, gameStatus: "lobby", activeQuestion: null, selectedCellId: "", questionStatus: "idle", timerRunning: false, timerValue: 0, timerMax: 0, answerVisibleToHost:false, answerVisibleToParticipants:false, hintVisibleToParticipants:false });
    savedResultRef.current.clear();
    setActiveTab("setup");
    setHostViewMode("dashboard");
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
      answerVisibleToParticipants: false, hintVisibleToParticipants: false, questionStatus: "idle", timerRunning:false, timerValue:0, timerMax:0 });
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
    const mode = window.prompt("اختر طريقة التحميل:\n1) استبدال بنك الأسئلة الحالي\n2) دمج مع بنك الأسئلة الحالي\n\nاكتب 1 أو 2", "1");
    if (!mode || (mode !== "1" && mode !== "2")) return;
    const shouldMerge = mode === "2";
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
        }).map((q:any)=>normalizeTemplateQuestion(q, cell.label, tpl.categories[0] || "غير مصنف"));
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
        const existing = Array.isArray((cell as any).questionBank) ? (cell as any).questionBank : [];
        const finalBank = shouldMerge ? [...existing, ...bank] : bank;
        const first = finalBank[0];
        return {
          ...cell,
          question: first?.question || "",
          answer: first?.answer || "",
          category: first?.category || "",
          difficulty: (first?.difficulty || "medium") as BoardCell["difficulty"],
          hint: first?.hint || "",
          explanation: first?.explanation || "",
          ...( { questionBank: finalBank } as any),
        };
      });
      await push({ board: nextBoard });
      if (skipped > 0) showToast.warning("تم تجاهل بعض الأسئلة لأنها لا تطابق الحروف المحددة.");
      showToast.success(shouldMerge ? "تم دمج القالب مع بنك الأسئلة الحالي." : "تم تحميل القالب وتوزيع الأسئلة على جميع الحروف.");
      if (missingLetters > 0) showToast.info("تم تحميل القالب، لكن بعض الحروف لا تحتوي على أسئلة.");
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
      const bank = (Array.isArray((c as any).questionBank) && (c as any).questionBank.length ? (c as any).questionBank : (c.question ? [{ question:c.question, answer:c.answer, category:c.category||"غير مصنف", difficulty:c.difficulty, points:c.points||1, hint:c.hint||"", explanation:c.explanation||"", letter:c.label }] : []))
        .map((q:any)=>normalizeTemplateQuestion(q, c.label, c.category || "غير مصنف"));
      const invalid = bank.map((q:any)=>validateQuestion(normalizeQuestion({ question:q.question, answer:q.answer, type:q.type, choices:q.choices, letter:q.letter, imageUrl:q.imageUrl }))).filter((x:any)=>!x.valid);
      if (invalid.length) showToast.warning("نص السؤال مطلوب.");
      return { cellId:c.id, label:c.label, questionBank: bank };
    });
    const totalQuestions = boardBanks.reduce((n,b)=>n+b.questionBank.length,0);
    const cats = Array.from(new Set(boardBanks.flatMap(b=>b.questionBank.map((q:any)=>q.category||"غير مصنف"))));
    const tpl: StarterTemplate = { id:`u_${Date.now()}`, name:templateName.trim(), categories:cats as string[], level:"متوسط", questions:boardBanks.flatMap(b=>b.questionBank.map((q:any)=>q.question)), boardBanks, createdAt:new Date().toISOString(), userCreated:true };
    const next=[tpl, ...communityTemplates];
    setCommunityTemplates(next);
    localStorage.setItem(COMMUNITY_TEMPLATES_KEY, JSON.stringify(next));
    setTemplateName("");
    showToast.success("تم حفظ القالب بنجاح.");
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
            questionBank: Array.isArray(b?.questionBank) ? b.questionBank.map((q:any)=>normalizeTemplateQuestion(q, String(b?.label || ""), "غير مصنف")).filter((q:any)=>q.question && q.answer) : [],
          })) : [];
        const tpl: StarterTemplate = { id:`u_${Date.now()}`, name:parsed.name, categories:Array.isArray(parsed.categories)?parsed.categories:["غير مصنف"], level:parsed.level==="سهل"||parsed.level==="متوسط"||parsed.level==="صعب"?parsed.level:"متوسط", questions:Array.isArray(parsed.questions)?parsed.questions:[], boardBanks:safeBanks, createdAt:new Date().toISOString(), userCreated:true };
        const next=[tpl, ...communityTemplates];
        setCommunityTemplates(next); localStorage.setItem(COMMUNITY_TEMPLATES_KEY, JSON.stringify(next));
        showToast.success("تم استيراد القالب بنجاح.");
      } catch { showToast.error("تعذر استيراد القالب. تأكد من أن الملف صحيح."); }
    };
    input.click();
  };

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
  if (hostViewMode === "dashboard") {
    const templatesCount = STARTER_TEMPLATES.length + communityTemplates.length;
    const gamesCount = communityTemplates.filter(t=>t.userCreated).length;
    const resultsAggregate = aggregateResults(savedResults);
    const dashboardFilteredTemplates = [...STARTER_TEMPLATES, ...communityTemplates]
      .filter(tpl=>!templateSearch || tpl.name.includes(templateSearch))
      .filter(tpl=>!templateCategory || tpl.categories.includes(templateCategory))
      .filter(tpl=>!templateLevel || tpl.level===templateLevel);
    const handleDeleteResult = (id: string) => {
      if (!window.confirm("هل تريد حذف هذه النتيجة؟ لا يمكن التراجع.")) return;
      deleteGameResult(id);
      setSavedResults(loadGameResults());
      setPreviewResult(null);
      showToast.success("تم حذف النتيجة.");
    };
    const handleExportResult = (r: GameResult) => {
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `wasla-result-${r.roomCode}.json`; a.click(); URL.revokeObjectURL(url);
      showToast.success("تم تصدير النتيجة.");
    };
    const handleCopySummary = (text: string) => {
      navigator.clipboard.writeText(text).then(() => showToast.success("تم نسخ الملخص ✓")).catch(() => showToast.error("فشل النسخ"));
    };
    const exportAllJSON = () => {
      const blob = new Blob([exportResultsJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "wasla-results.json"; a.click(); URL.revokeObjectURL(url);
      showToast.success("تم تصدير كل النتائج (JSON).");
    };
    const exportAllCSV = () => {
      const blob = new Blob([exportResultsCSV()], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "wasla-results.csv"; a.click(); URL.revokeObjectURL(url);
      showToast.success("تم تصدير كل النتائج (CSV).");
    };
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)", padding:"1rem" }}>
        {previewResult && (
          <ResultPreviewModal
            result={previewResult}
            onClose={() => setPreviewResult(null)}
            onCopySummary={handleCopySummary}
            onExportJSON={handleExportResult}
            onDelete={handleDeleteResult}
          />
        )}
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div className="kc-card" style={{ marginBottom:"0.8rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", gap:"0.7rem", flexWrap:"wrap", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:"1.45rem", fontWeight:900, color:"#f59e0b" }}>وصلة المعرفة - لوحة التحكم</div>
                <div style={{ color:"#94a3b8", fontSize:"0.84rem" }}>مرحباً {hostProfile.hostName || "بك"} {hostProfile.className && `• ${hostProfile.className}`} {hostProfile.orgName && `• ${hostProfile.orgName}`}</div>
              </div>
              <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap" }}>
                <button className="btn-gold" onClick={()=>room ? setHostViewMode("room") : handleCreate()}>{room ? "بدء الاستضافة" : (creating ? "جارٍ الإنشاء..." : "إنشاء لعبة جديدة")}</button>
                <button className="btn-secondary" onClick={()=>{ localStorage.removeItem("kc_host_profile"); setLocation("/"); }}>الخروج</button>
              </div>
            </div>
            <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginTop:"0.7rem" }}>
              {[{id:"home",l:"الرئيسية"},{id:"games",l:"ألعابي"},{id:"templates",l:"القوالب"},{id:"results",l:"النتائج"},{id:"settings",l:"الإعدادات"}].map((t:any)=>(
                <button key={t.id} className="btn-secondary" style={{ background:dashboardTab===t.id?"#f59e0b":"#1a2332", color:dashboardTab===t.id?"#090d18":"#cbd5e1" }} onClick={()=>setDashboardTab(t.id)}>{t.l}</button>
              ))}
            </div>
          </div>
          {dashboardTab==="home" && <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"0.8rem" }}>
            <div className="kc-card" style={{ gridColumn:"1 / -1", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"0.7rem" }}>
              <div>
                <div style={{ fontSize:"1.1rem", fontWeight:800, color:"#f0ede8" }}>مرحباً {hostProfile.hostName || "بك"} 👋</div>
                <div style={{ fontSize:"0.85rem", color:"#94a3b8", marginTop:"0.2rem" }}>ابدأ تحدياً جديداً، استخدم قالباً جاهزاً، أو تابع آخر لعبة محفوظة.</div>
              </div>
              <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                <button className="btn-gold" onClick={()=>room ? setHostViewMode("room") : handleCreate()}>{room ? "بدء الاستضافة" : (creating ? "جارٍ..." : "إنشاء لعبة جديدة")}</button>
                <button className="btn-secondary" onClick={()=>setDashboardTab("templates")}>عرض القوالب</button>
              </div>
            </div>
            <div className="kc-card"><div className="section-title">إجراءات سريعة</div><div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap" }}><button className="btn-gold" onClick={()=>room ? setHostViewMode("room") : handleCreate()}>إنشاء لعبة جديدة</button><button className="btn-secondary" onClick={()=>setDashboardTab("templates")}>عرض القوالب</button><button className="btn-secondary" onClick={()=>setDashboardTab("results")}>عرض النتائج</button><button className="btn-secondary" onClick={importBoard}>استيراد لعبة</button></div></div>
            <div className="kc-card"><div className="section-title">إحصاءات</div><div style={{ display:"grid", gap:"0.4rem" }}>{[{k:"القوالب المتاحة",v:templatesCount},{k:"الألعاب المحفوظة",v:gamesCount},{k:"النتائج المحفوظة",v:savedResults.length},{k:"آخر لعبة",v:resultsAggregate.lastGameTitle}].map(s=><div key={s.k} style={{ display:"flex", justifyContent:"space-between", color:"#cbd5e1" }}><span>{s.k}</span><strong>{s.v}</strong></div>)}</div></div>
            <div className="kc-card"><div className="section-title">ملخص المعلم</div><div style={{ display:"grid", gap:"0.4rem", color:"#cbd5e1", fontSize:"0.86rem" }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>إجمالي الألعاب</span><strong>{resultsAggregate.totalGames}</strong></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>إجمالي المشاركين</span><strong>{resultsAggregate.totalParticipants}</strong></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>أكثر فريق فوزاً</span><strong>{resultsAggregate.mostWinningTeamName}</strong></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>متوسط الأسئلة</span><strong>{resultsAggregate.avgQuestions}</strong></div>
              <div style={{ display:"flex", justifyContent:"space-between" }}><span>آخر لعبة</span><strong>{resultsAggregate.lastGameDate}</strong></div>
            </div></div>
            <div className="kc-card" style={{ gridColumn:"1 / -1" }}>
              <div className="section-title">قوالب مميزة</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:"0.6rem" }}>
                {STARTER_TEMPLATES.slice(0,6).map(tpl=>{
                  const count = tpl.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || tpl.questions.length;
                  return <div key={tpl.id} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"12px", padding:"0.7rem" }}>
                    <div style={{ fontWeight:700, color:"#f0ede8" }}>{tpl.name}</div>
                    <div style={{ fontSize:"0.74rem", color:"#94a3b8", marginTop:"0.2rem" }}>{tpl.description || "قالب تعليمي سريع"}</div>
                    <div style={{ fontSize:"0.74rem", color:"#94a3b8", marginTop:"0.25rem" }}>التصنيف: {tpl.categories.join("، ")} • المستوى: {tpl.level} • الأسئلة: {count}</div>
                    <div style={{ display:"flex", gap:"0.35rem", marginTop:"0.5rem", flexWrap:"wrap" }}>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>setPreviewTemplate(tpl)}>معاينة</button>
                      <button className="btn-gold" style={{ fontSize:"0.75rem" }} onClick={async()=>{ if(!room) await handleCreate(); setHostViewMode("room"); setTimeout(()=>useTemplate(tpl),200); }}>استخدام القالب</button>
                    </div>
                  </div>;
                })}
              </div>
            </div>
            <div className="kc-card" style={{ gridColumn:"1 / -1" }}>
              <div className="section-title">آخر النشاط</div>
              {savedResults.length === 0 ? (
                <div style={{ background:"#141e2d", border:"1px dashed #1a2332", borderRadius:10, padding:"1rem", textAlign:"center", color:"#94a3b8", fontSize:"0.86rem" }}>
                  <div style={{ fontSize:"1.6rem", marginBottom:"0.3rem" }}>🎯</div>
                  <div>لا توجد أنشطة حديثة بعد.</div>
                  <div style={{ fontSize:"0.78rem", color:"#64748b", marginTop:"0.25rem" }}>ابدأ بإنشاء لعبة جديدة أو استخدم أحد القوالب الجاهزة.</div>
                  <div style={{ display:"flex", gap:"0.4rem", justifyContent:"center", flexWrap:"wrap", marginTop:"0.6rem" }}>
                    <button className="btn-gold" style={{ fontSize:"0.78rem" }} onClick={()=>room ? setHostViewMode("room") : handleCreate()}>إنشاء لعبة جديدة</button>
                    <button className="btn-secondary" style={{ fontSize:"0.78rem" }} onClick={()=>setDashboardTab("templates")}>عرض القوالب</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"0.6rem" }}>
                  {savedResults.slice(0,4).map(r => (
                    <div key={r.id} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:12, padding:"0.7rem" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.4rem" }}>
                        <div style={{ fontWeight:700, color:"#f0ede8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.gameTitle}</div>
                        <span className="badge-chip" style={{ fontSize:"0.7rem", color: r.winnerTeam === 1 ? r.team1.color : r.winnerTeam === 2 ? r.team2.color : "#94a3b8" }}>{r.winnerName}</span>
                      </div>
                      <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"0.25rem" }}>
                        {new Date(r.finishedAt).toLocaleDateString("ar")} • {r.team1.score} - {r.team2.score} • مشاركون: {r.participants}
                      </div>
                      <button className="btn-secondary" style={{ fontSize:"0.74rem", marginTop:"0.5rem" }} onClick={() => setPreviewResult(r)}>عرض التفاصيل</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>}
          {dashboardTab==="templates" && <div className="kc-card"><div className="section-title">القوالب</div>
            <div style={{ fontSize:"0.82rem", color:"#94a3b8", marginBottom:"0.7rem" }}>
              قوالب مقترحة وقوالب محلية جاهزة <span style={{ color:"#64748b" }}>(تجربة محلية، بدون نشر عبر الإنترنت)</span>
            </div>
            <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap", marginBottom:"0.7rem" }}>
              <input className="kc-input" style={{ maxWidth:240 }} placeholder="ابحث عن قالب..." value={templateSearch} onChange={e=>setTemplateSearch(e.target.value)} />
              <select className="kc-input" style={{ maxWidth:180 }} value={templateCategory} onChange={e=>setTemplateCategory(e.target.value)}><option value="">كل التصنيفات</option><option value="اللغة العربية">اللغة العربية</option><option value="التربية الإسلامية">التربية الإسلامية</option><option value="العلوم">العلوم</option><option value="القيم والأخلاق">القيم والأخلاق</option><option value="مفردات">مفردات</option><option value="حروف">حروف</option><option value="مراجعة عامة">مراجعة عامة</option><option value="غير مصنف">غير مصنف</option></select>
              <select className="kc-input" style={{ maxWidth:150 }} value={templateLevel} onChange={e=>setTemplateLevel(e.target.value)}><option value="">كل المستويات</option><option value="سهل">سهل</option><option value="متوسط">متوسط</option><option value="صعب">صعب</option></select>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"0.6rem" }}>
              {dashboardFilteredTemplates.map(tpl=>{ const count = tpl.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || tpl.questions.length; return <div key={tpl.id} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.65rem" }}><div style={{ fontWeight:700, color:"#f0ede8" }}>{tpl.name}</div><div style={{ fontSize:"0.74rem", color:"#94a3b8" }}>{tpl.description || "قالب تعليمي سريع"}</div><div style={{ fontSize:"0.74rem", color:"#94a3b8" }}>التصنيف: {tpl.categories.join("، ")} • المستوى: {tpl.level} • الأسئلة: {count}</div><div style={{ display:"flex", gap:"0.35rem", marginTop:"0.45rem", flexWrap:"wrap" }}><button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>setPreviewTemplate(tpl)}>معاينة</button><button className="btn-gold" style={{ fontSize:"0.75rem" }} onClick={async()=>{ if(!room) await handleCreate(); setHostViewMode("room"); setTimeout(()=>useTemplate(tpl),200); }}>استخدام القالب</button></div></div>; })}
            </div>
          </div>}
          {dashboardTab==="games" && <div className="kc-card"><div className="section-title">ألعابي</div><div style={{ color:"#94a3b8", marginBottom:"0.45rem", fontSize:"0.84rem" }}>إدارة ألعابك المحفوظة محلياً.</div><input className="kc-input" placeholder="ابحث عن لعبة..." value={gamesSearch} onChange={e=>setGamesSearch(e.target.value)} /><div style={{ marginTop:"0.7rem", background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.8rem" }}><div style={{ color:"#94a3b8" }}>لا توجد ألعاب محفوظة بعد. أنشئ لعبة جديدة أو استخدم أحد القوالب الجاهزة.</div><div style={{ display:"flex", gap:"0.4rem", marginTop:"0.55rem", flexWrap:"wrap" }}><button className="btn-gold" onClick={()=>room ? setHostViewMode("room") : handleCreate()}>إنشاء لعبة جديدة</button><button className="btn-secondary" onClick={()=>setDashboardTab("templates")}>عرض القوالب</button><button className="btn-secondary" onClick={importBoard}>استيراد لعبة</button></div></div></div>}
          {dashboardTab==="results" && <div className="kc-card"><div className="section-title">النتائج</div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"0.5rem", marginBottom:"0.6rem" }}>
              <div style={{ color:"#94a3b8", fontSize:"0.84rem" }}>سجل النتائج المحلية للتحديات. <span style={{ color:"#64748b" }}>(تُحفظ على هذا الجهاز فقط)</span></div>
              <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}>
                <button className="btn-secondary" disabled={!savedResults.length} onClick={exportAllJSON}>تصدير JSON</button>
                <button className="btn-secondary" disabled={!savedResults.length} onClick={exportAllCSV}>تصدير CSV</button>
              </div>
            </div>
            {savedResults.length === 0 ? (
              <div style={{ background:"#141e2d", border:"1px dashed #1a2332", borderRadius:"12px", padding:"1.2rem", textAlign:"center", color:"#94a3b8", fontSize:"0.88rem" }}>
                <div style={{ fontSize:"1.8rem", marginBottom:"0.4rem" }}>📋</div>
                <div style={{ color:"#cbd5e1", fontWeight:700, marginBottom:"0.2rem" }}>لا توجد نتائج محفوظة بعد.</div>
                <div style={{ fontSize:"0.82rem", color:"#64748b", marginBottom:"0.7rem" }}>ابدأ لعبة جديدة لحفظ أول نتيجة.</div>
                <div style={{ display:"flex", gap:"0.4rem", justifyContent:"center", flexWrap:"wrap" }}>
                  <button className="btn-gold" onClick={()=>room ? setHostViewMode("room") : handleCreate()}>إنشاء لعبة جديدة</button>
                  <button className="btn-secondary" onClick={()=>setDashboardTab("templates")}>عرض القوالب</button>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"0.6rem" }}>
                {savedResults.map(r => (
                  <div key={r.id} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:12, padding:"0.75rem" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.4rem", marginBottom:"0.3rem" }}>
                      <div style={{ fontWeight:700, color:"#f0ede8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.gameTitle}</div>
                      <span className="badge-chip" style={{ fontSize:"0.7rem", color: r.winnerTeam === 1 ? r.team1.color : r.winnerTeam === 2 ? r.team2.color : "#94a3b8" }}>🏆 {r.winnerName}</span>
                    </div>
                    <div style={{ fontSize:"0.74rem", color:"#94a3b8" }}>
                      {new Date(r.finishedAt).toLocaleString("ar")}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.35rem", marginTop:"0.45rem" }}>
                      <div style={{ background:"#0f1623", borderRadius:8, padding:"0.4rem", textAlign:"center", border:`1px solid ${r.team1.color}33` }}>
                        <div style={{ fontSize:"0.7rem", color:r.team1.color, fontWeight:700 }}>{r.team1.name}</div>
                        <div style={{ fontWeight:800, color:"#f0ede8" }}>{r.team1.score}</div>
                      </div>
                      <div style={{ background:"#0f1623", borderRadius:8, padding:"0.4rem", textAlign:"center", border:`1px solid ${r.team2.color}33` }}>
                        <div style={{ fontSize:"0.7rem", color:r.team2.color, fontWeight:700 }}>{r.team2.name}</div>
                        <div style={{ fontWeight:800, color:"#f0ede8" }}>{r.team2.score}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:"0.72rem", color:"#94a3b8", marginTop:"0.4rem" }}>
                      مشاركون: {r.participants} • أسئلة: {r.totalQuestions || "غير متوفر"}
                    </div>
                    <div style={{ display:"flex", gap:"0.3rem", flexWrap:"wrap", marginTop:"0.5rem" }}>
                      <button className="btn-gold" style={{ fontSize:"0.72rem" }} onClick={() => setPreviewResult(r)}>عرض التفاصيل</button>
                      <button className="btn-secondary" style={{ fontSize:"0.72rem" }} onClick={() => handleCopySummary(summarizeResult(r))}>نسخ الملخص</button>
                      <button className="btn-secondary" style={{ fontSize:"0.72rem" }} onClick={() => handleExportResult(r)}>تصدير</button>
                      <button className="btn-danger" style={{ fontSize:"0.72rem" }} onClick={() => handleDeleteResult(r.id)}>حذف</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>}
          {dashboardTab==="settings" && <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"0.7rem" }}>
            <div className="kc-card"><div className="section-title">بيانات المضيف</div><label style={lbl}>اسم المضيف</label><input className="kc-input" value={dashboardHostName} onChange={e=>setDashboardHostName(e.target.value)} /><label style={lbl}>اسم الصف أو الفعالية</label><input className="kc-input" value={dashboardClassName} onChange={e=>setDashboardClassName(e.target.value)} /><label style={lbl}>اسم المدرسة أو الجهة</label><input className="kc-input" value={dashboardOrgName} onChange={e=>setDashboardOrgName(e.target.value)} /><button className="btn-gold" onClick={()=>{ localStorage.setItem("kc_host_profile", JSON.stringify({ hostName:dashboardHostName.trim(), className:dashboardClassName.trim(), orgName:dashboardOrgName.trim() })); showToast.success("تم حفظ الإعدادات."); }}>حفظ البيانات</button></div>
            <div className="kc-card"><div className="section-title">إعدادات اللعبة الافتراضية</div><div style={{ color:"#94a3b8", fontSize:"0.82rem", marginBottom:"0.4rem" }}>اسم الفريق الأزرق: {room?.team1.name || "الفريق الأزرق"}</div><div style={{ color:"#94a3b8", fontSize:"0.82rem", marginBottom:"0.4rem" }}>اسم الفريق الأحمر: {room?.team2.name || "الفريق الأحمر"}</div><div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}><button className="btn-secondary">مؤقت 30ث</button><button className="btn-secondary">مؤقت 60ث</button><button className="btn-secondary">تفعيل السرقة</button><button className="btn-secondary">إخفاء الإجابة</button></div></div>
            <div className="kc-card"><div className="section-title">البيانات المحلية</div><div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}><button className="btn-secondary" onClick={()=>{ const blob = new Blob([JSON.stringify({ communityTemplates, hostProfile: { hostName:dashboardHostName, className:dashboardClassName, orgName:dashboardOrgName } }, null, 2)], { type:"application/json" }); const url = URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="knowledge-connect-local-data.json"; a.click(); URL.revokeObjectURL(url); }}>تصدير البيانات</button><button className="btn-danger" onClick={()=>confirm("هل أنت متأكد من حذف البيانات المحلية؟", ()=>{ localStorage.removeItem(COMMUNITY_TEMPLATES_KEY); showToast.success("تم حذف البيانات المحلية."); setCommunityTemplates([]); })}>حذف البيانات المحلية</button></div></div>
          </div>}
        </div>
      </div>
    );
  }
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

  const filledCells = room.board.filter(c=>c.question.trim()).length;
  const claimedCells = room.board.filter(c=>c.claimedBy!==0).length;
  const blueFinalScore = Number.isFinite(room.team1Score) ? room.team1Score : 0;
  const redFinalScore = Number.isFinite(room.team2Score) ? room.team2Score : 0;
  const usedCells = room.board.filter(c=>c.used).length;
  const totalCells = room.board.length;
  const winningPathIds = room.winnerTeam ? findWinningPath(room.board, room.gridSize, room.winnerTeam as 1|2) : [];
  const gameMode = room.gameMode || "classic";

  const applyPowerUp = async (kind: "double_points"|"extra_time"|"switch_question") => {
    if (!room) return;
    if (kind === "double_points" && room.activeQuestion) {
      await push({ activePowerUp: "double_points", activeQuestion: { ...room.activeQuestion, points: Math.max(1, (room.activeQuestion.points || 1) * 2) } });
      showToast.success("تم تفعيل مضاعفة النقاط للسؤال الحالي");
      return;
    }
    if (kind === "extra_time") {
      await push({ activePowerUp: "extra_time", timerValue: (room.timerValue || 0) + 15, timerSetting: (room.timerSetting || 0) + 15 });
      showToast.success("تمت إضافة 15 ثانية");
      return;
    }
    if (kind === "switch_question") {
      await push({ activePowerUp: "switch_question" });
      await skipQ();
      showToast.success("تم تفعيل تبديل السؤال");
    }
  };

  const filteredTemplates = [...STARTER_TEMPLATES, ...communityTemplates]
    .filter(tpl=>!templateSearch || tpl.name.includes(templateSearch))
    .filter(tpl=>!templateCategory || tpl.categories.includes(templateCategory))
    .filter(tpl=>!templateLevel || tpl.level===templateLevel);

  return (
    <div style={{ minHeight:"100vh", background: appearanceMode==="light" ? "#f8fafc" : appearanceMode==="balanced" ? "#e2e8f0" : "#090d18" }}>
      {/* Modals */}
      {confirmMsg && confirmAction && (
        <ConfirmModal msg={confirmMsg}
          onYes={() => { confirmAction(); setConfirmMsg(""); setConfirmAction(null); }}
          onNo={() => { setConfirmMsg(""); setConfirmAction(null); }} />
      )}
      {editingCell && <CellEditor cell={editingCell} onSave={saveCellQ} onClose={()=>setEditingCell(null)} />}
      {previewTemplate && (
        <TemplatePreviewModal previewTemplate={previewTemplate as any} onClose={()=>setPreviewTemplate(null)} />
      )}
      {liveCellId && room && (() => {
        const liveCell = room.board.find(c => c.id === liveCellId);
        if (!liveCell) return null;
        return (
          <LiveQuestionModal
            room={room}
            cell={liveCell}
            activeQuestion={room.activeQuestion}
            onClose={() => setLiveCellId("")}
            onShowAnswer={() => push({ answerVisibleToHost: true })}
            onAwardTeam={(team) => { markCorrectForTeam(team); setLiveCellId(""); }}
            onSkip={() => { skipQ(); setLiveCellId(""); }}
            onReturnToBank={() => { cancelQuestion(); setLiveCellId(""); }}
            onRevealToParticipants={() => push({ answerVisibleToParticipants: !room.answerVisibleToParticipants, answerVisibleToHost: true, questionStatus: room.answerVisibleToParticipants ? room.questionStatus : "answer_revealed" })}
            onAddQuestion={() => { setLiveCellId(""); setEditingCell(liveCell); }}
          />
        );
      })()}

      {/* Winner overlay */}
      {room.winnerMessage && (
        <div className="winner-overlay">
          <div className="winner-card" style={{ borderColor: room.winnerTeam===1 ? room.team1.color : room.winnerTeam===2 ? room.team2.color : "#f59e0b", maxWidth: 520 }}>
            <div style={{ fontSize:"4rem", marginBottom:"0.5rem" }}>🏆</div>
            <div style={{ fontSize:"2rem", fontWeight:900, color: room.winnerTeam===1 ? room.team1.color : room.winnerTeam===2 ? room.team2.color : "#f59e0b", marginBottom:"0.8rem" }}>
              {room.winnerMessage}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.6rem", width:"100%", marginBottom:"1rem" }}>
              <div style={{ background:"#10233f", border:"1px solid #1e3a8a", borderRadius:"10px", padding:"0.6rem" }}>
                <div style={{ color:"#93c5fd", fontSize:"0.82rem" }}>الفريق الأزرق</div>
                <div style={{ color:"#dbeafe", fontWeight:800, fontSize:"1.3rem" }}>{blueFinalScore}</div>
              </div>
              <div style={{ background:"#3f1018", border:"1px solid #991b1b", borderRadius:"10px", padding:"0.6rem" }}>
                <div style={{ color:"#fda4af", fontSize:"0.82rem" }}>الفريق الأحمر</div>
                <div style={{ color:"#ffe4e6", fontWeight:800, fontSize:"1.3rem" }}>{redFinalScore}</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", justifyContent:"center" }}>
              <button className="btn-gold" onClick={resetGame}>إعادة اللعب</button>
              <button className="btn-secondary" onClick={returnToTemplates}>الرجوع للقوالب</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <HostDashboardHeader
        room={room}
        roomCode={roomCode}
        hostProfile={hostProfile}
        appearanceMode={appearanceMode}
        setAppearanceMode={setAppearanceMode}
        visualTheme={visualTheme}
        setVisualTheme={setVisualTheme}
        startGame={startGame}
        resetGame={resetGame}
        onLogout={()=>{ localStorage.removeItem("kc_host_profile"); setLocation("/"); }}
        copyText={copyText}
        joinLink={joinLink(roomCode)}
        displayLink={displayLink(roomCode)}
      />

      {/* Tabs */}
      <div style={{ background:"#0f1623", borderBottom:"1.5px solid #1a2332", padding:"0 1.25rem" }}>
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
          <button className="btn-secondary" style={{ marginInlineStart:"auto", whiteSpace:"nowrap" }} onClick={()=>setHostViewMode("dashboard")}>العودة إلى لوحة التحكم</button>
        </div>
      </div>

      {/* Content */}
      <div className="container" style={{ paddingTop:"1.25rem", paddingBottom:"3rem" }}>

        {/* ══ Host Lobby (visible while game has not started) ══ */}
        {room.gameStatus === "lobby" && (
          <HostLobbyCard
            room={room}
            roomCode={roomCode}
            joinLink={joinLink(roomCode)}
            onCopy={copyText}
            onStartGame={startGame}
            onBackToDashboard={() => setHostViewMode("dashboard")}
          />
        )}

        {/* ══ TAB: Setup ══ */}
        {activeTab==="setup" && (
          <div style={{ display:"grid", gap:"1.1rem" }}>
            <div className="kc-card" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:"0.75rem" }}>
              <div>
                <div style={{ fontWeight:800, color:"#f0ede8" }}>مرحباً {hostProfile.hostName || "بك"} 👋</div>
                <div style={{ fontSize:"0.84rem", color:"#94a3b8", marginTop:"0.25rem" }}>أنشئ تحدياً جديداً، استخدم قالباً جاهزاً، أو تابع آخر لعبة محفوظة.</div>
              </div>
              {[
                { label:"عدد الألعاب المحفوظة", val:String(communityTemplates.filter(t=>t.userCreated).length) },
                { label:"عدد القوالب المتاحة", val:String(STARTER_TEMPLATES.length + communityTemplates.length) },
                { label:"عدد النتائج المحفوظة", val:"0" },
                { label:"آخر لعبة", val:room.gameTitle || "—" },
              ].map((s)=>(
                <div key={s.label} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.55rem 0.7rem" }}>
                  <div style={{ fontSize:"0.74rem", color:"#94a3b8" }}>{s.label}</div>
                  <div style={{ fontSize:"0.92rem", fontWeight:800, color:"#f0ede8", marginTop:"0.15rem" }}>{s.val}</div>
                </div>
              ))}
              <div style={{ display:"flex", gap:"0.45rem", flexWrap:"wrap", alignItems:"center" }}>
                <button className="btn-gold" style={{ fontSize:"0.8rem" }} onClick={handleCreate}>إنشاء لعبة جديدة</button>
                <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>setActiveTab("game")}>بدء الاستضافة</button>
                <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>setTemplateSearch("")}>استكشاف القوالب</button>
                <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={importBoard}>استيراد لعبة</button>
              </div>
            </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))", gap:"1.25rem" }}>
            {/* Template / question-bank health */}
            <div className="kc-card" style={{ gridColumn: "1 / -1" }}>
              <div className="section-title">صحة بنك الأسئلة</div>
              {(() => {
                const cells = room.board;
                const completedCells = cells.filter(c => cellHasQuestions(c)).length;
                const emptyCells = cells.length - completedCells;
                const totalQs = cells.reduce((n, c) => {
                  const bank = (c as any).questionBank;
                  if (Array.isArray(bank) && bank.length) return n + bank.filter((q:any) => String(q?.question||"").trim()).length;
                  return n + (c.question.trim() ? 1 : 0);
                }, 0);
                const avg = completedCells > 0 ? (totalQs / completedCells).toFixed(1) : "0";
                const ready = emptyCells === 0 && totalQs > 0;
                const warn = emptyCells > Math.max(2, Math.floor(cells.length * 0.3));
                const goToFirstEmpty = () => {
                  const firstEmpty = sortedBoard(cells).find(c => !cellHasQuestions(c));
                  if (firstEmpty) setEditingCell(firstEmpty);
                };
                const distributeQuestions = () => {
                  const allBank: any[] = [];
                  cells.forEach(c => {
                    const b = (c as any).questionBank;
                    if (Array.isArray(b) && b.length) allBank.push(...b.filter((q:any) => String(q?.question||"").trim()));
                    else if (c.question.trim()) allBank.push({ question:c.question, answer:c.answer, category:c.category, difficulty:c.difficulty, points:c.points, hint:c.hint, explanation:c.explanation, letter:c.label });
                  });
                  if (!allBank.length) { showToast.warning("لا توجد أسئلة لتوزيعها."); return; }
                  // Group by first letter of answer (or letter field), then distribute round-robin into matching cells.
                  const byLetter = new Map<string, any[]>();
                  allBank.forEach(q => {
                    const letter = String(q.letter || q.answer || "").trim().charAt(0);
                    const norm = ARABIC_LETTER_NORMALIZE[letter] || letter;
                    if (!byLetter.has(norm)) byLetter.set(norm, []);
                    byLetter.get(norm)!.push(q);
                  });
                  const nextBoard = cells.map(c => {
                    const norm = ARABIC_LETTER_NORMALIZE[c.label] || c.label;
                    const matched = byLetter.get(norm) || [];
                    if (matched.length === 0) return c;
                    const first = matched[0];
                    return {
                      ...c,
                      question: first.question || "",
                      answer: first.answer || "",
                      category: first.category || c.category,
                      difficulty: (first.difficulty || c.difficulty) as BoardCell["difficulty"],
                      points: Number(first.points) || c.points || 1,
                      hint: first.hint || "",
                      explanation: first.explanation || "",
                      ...( { questionBank: matched } as any ),
                    };
                  });
                  push({ board: nextBoard });
                  showToast.success("تم توزيع الأسئلة على الحروف المطابقة.");
                };
                const repairTemplate = () => {
                  // Repair: drop banks with empty questions; coerce defaults.
                  const nextBoard = cells.map(c => {
                    const bank = (c as any).questionBank;
                    if (!Array.isArray(bank)) return c;
                    const cleaned = bank.filter((q:any) => String(q?.question||"").trim() && String(q?.answer||"").trim());
                    return { ...c, ...( { questionBank: cleaned } as any ) };
                  });
                  push({ board: nextBoard });
                  showToast.success("تم تنظيف القالب وإزالة الأسئلة الفارغة.");
                };
                return (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem", marginBottom: "0.7rem" }}>
                      <div style={{ background: "#141e2d", borderRadius: 10, padding: "0.55rem 0.7rem", border: "1px solid #1a2332" }}>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>الحروف المكتملة</div>
                        <div style={{ fontWeight: 800, color: "#22c55e" }}>{completedCells} / {cells.length}</div>
                      </div>
                      <div style={{ background: "#141e2d", borderRadius: 10, padding: "0.55rem 0.7rem", border: "1px solid #1a2332" }}>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>حروف بدون أسئلة</div>
                        <div style={{ fontWeight: 800, color: emptyCells > 0 ? "#ef4444" : "#22c55e" }}>{emptyCells}</div>
                      </div>
                      <div style={{ background: "#141e2d", borderRadius: 10, padding: "0.55rem 0.7rem", border: "1px solid #1a2332" }}>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>إجمالي الأسئلة</div>
                        <div style={{ fontWeight: 800, color: "#f0ede8" }}>{totalQs}</div>
                      </div>
                      <div style={{ background: "#141e2d", borderRadius: 10, padding: "0.55rem 0.7rem", border: "1px solid #1a2332" }}>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>متوسط لكل حرف</div>
                        <div style={{ fontWeight: 800, color: "#f0ede8" }}>{avg}</div>
                      </div>
                      <div style={{ background: ready ? "rgba(34,197,94,0.12)" : "#141e2d", borderRadius: 10, padding: "0.55rem 0.7rem", border: `1px solid ${ready ? "rgba(34,197,94,0.4)" : "#1a2332"}` }}>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>هل القالب جاهز؟</div>
                        <div style={{ fontWeight: 800, color: ready ? "#22c55e" : "#f59e0b" }}>{ready ? "جاهز للعب ✅" : "بحاجة لإكمال"}</div>
                      </div>
                    </div>
                    {warn && (
                      <div style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.35)", color: "#fcd34d", borderRadius: 10, padding: "0.55rem 0.75rem", fontSize: "0.85rem", marginBottom: "0.6rem" }}>
                        ⚠ يوجد {emptyCells} حروف بدون أسئلة. أكملها قبل بدء التحدي لتجربة أفضل.
                      </div>
                    )}
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <button className="btn-gold" style={{ fontSize: "0.78rem" }} onClick={goToFirstEmpty} disabled={emptyCells === 0}>إضافة الأسئلة الناقصة</button>
                      <button className="btn-secondary" style={{ fontSize: "0.78rem" }} onClick={repairTemplate}>إصلاح القالب</button>
                      <button className="btn-secondary" style={{ fontSize: "0.78rem" }} onClick={distributeQuestions}>توزيع الأسئلة على الحروف</button>
                    </div>
                  </>
                );
              })()}
            </div>

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
              <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
                {sortedBoard(room.board).map(cell=>(
                  (() => { const count = Array.isArray((cell as any).questionBank) ? (cell as any).questionBank.length : (cell.question ? 1 : 0);
                  const firstQ = Array.isArray((cell as any).questionBank) && (cell as any).questionBank.length ? (cell as any).questionBank[0] : null;
                  const qText = firstQ?.question || cell.question;
                  const qCategory = firstQ?.category || cell.category;
                  const qDifficulty = firstQ?.difficulty || cell.difficulty;
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
              <div className="section-title">قوالب الألعاب</div>
              <div style={{ fontSize:"0.82rem", color:"#94a3b8", marginBottom:"0.8rem" }}>
                قوالب تجريبية محلية للاستخدام السريع داخل وصلة المعرفة.
                <div style={{ marginTop:"0.35rem" }}>نماذج جاهزة مستوحاة من المجتمع — بدون أي نشر أو مشاركة عبر الإنترنت.</div>
              </div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                <input className="kc-input" style={{ maxWidth:240 }} placeholder="اسم القالب" value={templateName} onChange={e=>setTemplateName(e.target.value)} />
                <button className="btn-gold" onClick={saveCurrentAsTemplate}>حفظ كقالب</button>
                <button className="btn-secondary" onClick={importTemplate}>استيراد قالب</button>
                <button className="btn-secondary" onClick={importTemplateCsv}>استيراد من جدول</button>
              </div>
              <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                <input className="kc-input" style={{ maxWidth:240 }} placeholder="بحث عن قالب" value={templateSearch} onChange={e=>setTemplateSearch(e.target.value)} />
                <select className="kc-input" style={{ maxWidth:180 }} value={templateCategory} onChange={e=>setTemplateCategory(e.target.value)}>
                  <option value="">كل التصنيفات</option><option value="اللغة العربية">اللغة العربية</option><option value="التربية الإسلامية">التربية الإسلامية</option><option value="العلوم">العلوم</option><option value="القيم والأخلاق">القيم والأخلاق</option><option value="مفردات">مفردات</option><option value="حروف">حروف</option><option value="مراجعة عامة">مراجعة عامة</option><option value="غير مصنف">غير مصنف</option>
                </select>
                <select className="kc-input" style={{ maxWidth:160 }} value={templateLevel} onChange={e=>setTemplateLevel(e.target.value)}>
                  <option value="">كل المستويات</option><option value="سهل">سهل</option><option value="متوسط">متوسط</option><option value="صعب">صعب</option>
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"0.75rem" }}>
                {filteredTemplates.map(tpl => {
                  const totalQ = tpl.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || tpl.questions.length;
                  const covered = tpl.boardBanks?.filter(b=>b.questionBank?.length).length || 0;
                  const avg = covered ? (totalQ / covered).toFixed(1) : "0";
                  return (
                  <div key={tpl.id} style={{ background:"#141e2d", border:"1.5px solid #1a2332", borderRadius:"14px", padding:"0.85rem" }}>
                    <div style={{ fontWeight:800, color:"#f0ede8", marginBottom:"0.35rem" }}>{tpl.name}</div>
                    {tpl.description && <div style={{ fontSize:"0.74rem", color:"#cbd5e1", marginBottom:"0.35rem" }}>{tpl.description}</div>}
                    <div style={{ fontSize:"0.74rem", color:"#94a3b8", lineHeight:1.8 }}>
                      <div>التصنيف: {tpl.categories.join("، ")}</div>
                      <div>المستوى: {tpl.level}</div>
                      <div>الحروف المغطاة: {covered}</div>
                      <div>إجمالي الأسئلة: {totalQ}</div>
                      <div>المتوسط: {avg} أسئلة لكل حرف</div>
                      {covered < ARABIC_LETTERS_FULL.length && <div style={{ color:"#f59e0b" }}>هذا القالب لا يغطي جميع الحروف.</div>}
                      {tpl.createdAt && <div>تاريخ الحفظ: {new Date(tpl.createdAt).toLocaleDateString("ar")}</div>}
                      {tpl.userCreated && <div style={{ color:"#f59e0b" }}>قالب مجتمعي محلي (تجريبي)</div>}
                    </div>
                    <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginTop:"0.7rem" }}>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>setPreviewTemplate(tpl)}>معاينة</button>
                      <button className="btn-gold" style={{ fontSize:"0.75rem" }} onClick={()=>useTemplate(tpl)}>استخدم القالب</button>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>duplicateTemplate(tpl)}>تعديل نسخة</button>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>exportTemplate(tpl)}>تصدير القالب</button>
                      <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>exportTemplateCsv(tpl)}>تصدير كجدول</button>
                      {tpl.userCreated && <button className="btn-danger" style={{ fontSize:"0.75rem" }} onClick={()=>deleteTemplate(tpl)}>حذف القالب</button>}
                    </div>
                  </div>
                );})}
                {filteredTemplates.length===0 && (
                  <div style={{ gridColumn:"1 / -1", color:"#94a3b8", fontSize:"0.84rem" }}>لا توجد قوالب بعد.</div>
                )}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ══ TAB: Game ══ */}
        {activeTab==="game" && (
          <>
          <div className="kc-card" style={{ marginBottom: "0.85rem", display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginInlineEnd: "0.5rem" }}>التحكم أثناء اللعب:</div>
            <button className="btn-secondary" style={{ fontSize: "0.78rem" }} onClick={swapActiveTeam}>🔄 تبديل الفريق النشط</button>
            <button className="btn-secondary" style={{ fontSize: "0.78rem" }} onClick={undoLastAction}>↶ إلغاء آخر حركة</button>
            <button className="btn-secondary" style={{ fontSize: "0.78rem" }} onClick={() => { exportBoard(); showToast.info("تم حفظ نسخة محلية من اللوحة بصيغة JSON."); }}>💾 حفظ اللعبة</button>
            <button className="btn-danger" style={{ fontSize: "0.78rem", marginInlineStart: "auto" }} onClick={endGame}>🏁 إنهاء اللعبة</button>
          </div>
          <div className="kc-card" style={{ marginBottom:"0.85rem" }}>
            <div className="section-title">إعداد اللعبة</div>
            <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginBottom:"0.45rem" }}>وضع اللعبة والتعزيزات</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"0.5rem", marginBottom:"0.55rem" }}>
              <select className="kc-input" value={gameMode} onChange={e=>push({ gameMode: e.target.value as any })}>
                <option value="classic">التحدي الكلاسيكي</option><option value="speed">وضع السرعة</option><option value="points">وضع النقاط</option><option value="connection">وضع الوصلة</option><option value="teacher">وضع المعلم</option><option value="training">وضع التدريب</option>
              </select>
              <button className="btn-secondary" onClick={()=>applyPowerUp("double_points")}>مضاعفة النقاط</button>
              <button className="btn-secondary" onClick={()=>applyPowerUp("extra_time")}>وقت إضافي</button>
              <button className="btn-secondary" onClick={()=>applyPowerUp("switch_question")}>تبديل السؤال</button>
            </div>
            <div style={{ fontSize:"0.78rem", color:"#94a3b8" }}>تعزيزات متاحة للعرض حالياً: سرقة سؤال • حذف خيارين • حماية الحرف (سيتم تفعيل منطقها لاحقاً).</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns: presentationMode ? "1fr" : "1fr 1.4fr", gap:"1.25rem" }}>
            {/* Left: controls */}
            {!presentationMode && <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
              {/* Teams */}
              <div className="kc-card">
                <div className="section-title">النقاط والمؤقت</div>
                <div style={{ fontSize:"0.78rem", color:"#94a3b8", marginBottom:"0.45rem" }}>الفرق</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
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
                      ? <button className="btn-green" style={{ fontSize:"0.8rem" }} onClick={room.timerValue > 0 ? resumeTimer : startTimer}>{room.timerValue > 0 ? "استئناف" : "بدء المؤقت"}</button>
                      : <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={pauseTimer}>إيقاف مؤقت</button>}
                    <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={addTimer15}>+15 ثانية</button>
                    <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={resetTimer}>إعادة</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"0.4rem", marginTop:"0.5rem", flexWrap:"wrap" }}>
                  {[15,30,45,60,90,120].map(s=>(
                    <button key={s} className="btn-secondary" style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem" }}
                      onClick={()=>push({ timerSetting:s, timerValue:0, timerMax:s, timerRunning:false })}>{s}ث</button>
                  ))}
                  <span style={{ fontSize:"0.75rem", color:"#94a3b8", alignSelf:"center" }}>{room.timerSetting <= 0 ? "بدون مؤقت" : ""}</span>
                </div>
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
                    <div style={{ fontSize:"1rem", fontWeight:700, color:"#f0ede8", lineHeight:1.7, marginBottom:"0.5rem" }}>
                      {room.activeQuestion.question}
                    </div>
                    {/* Type-specific quick options */}
                    {(room.activeQuestion.type === "mcq" && Array.isArray(room.activeQuestion.choices) && room.activeQuestion.choices.length > 0) && (
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:"0.4rem", marginBottom:"0.6rem" }}>
                        {room.activeQuestion.choices.map((c, i) => (
                          <div key={i} style={{ background: c === room.activeQuestion?.answer ? "rgba(34,197,94,0.12)" : "#141e2d", border: `1.5px solid ${c === room.activeQuestion?.answer ? "rgba(34,197,94,0.4)" : "#1a2332"}`, borderRadius:10, padding:"0.45rem 0.6rem", fontSize:"0.85rem", color: c === room.activeQuestion?.answer ? "#22c55e" : "#cbd5e1", fontWeight:600, display:"flex", alignItems:"center", gap:"0.4rem" }}>
                            <span style={{ fontSize:"0.7rem", color:"#94a3b8", fontWeight:700 }}>{String.fromCharCode(65 + i)}.</span>
                            <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis" }}>{c}</span>
                            {c === room.activeQuestion?.answer && room.answerVisibleToHost && <span style={{ fontSize:"0.7rem" }}>✓</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {room.activeQuestion.type === "tf" && (
                      <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.6rem" }}>
                        {["صحيح","خطأ"].map((c) => (
                          <div key={c} style={{ flex:1, textAlign:"center", padding:"0.5rem", borderRadius:10, background: c === room.activeQuestion?.answer ? "rgba(34,197,94,0.12)" : "#141e2d", border:`1.5px solid ${c === room.activeQuestion?.answer ? "rgba(34,197,94,0.4)" : "#1a2332"}`, color: c === room.activeQuestion?.answer ? "#22c55e" : "#cbd5e1", fontWeight:700 }}>
                            {c}{c === room.activeQuestion?.answer && room.answerVisibleToHost ? " ✓" : ""}
                          </div>
                        ))}
                      </div>
                    )}
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
                        ? <button className="btn-gold" style={{ fontSize:"0.8rem" }} onClick={()=>push({ answerVisibleToParticipants:true, answerVisibleToHost:true, questionStatus:"answer_revealed" })}>📢 إظهار الإجابة للمشاركين</button>
                        : <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>push({ answerVisibleToParticipants:false })}>🔒 إخفاء الإجابة</button>}
                      {!room.hintVisibleToParticipants
                        ? <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>push({ hintVisibleToParticipants:true })}>💡 إظهار التلميح</button>
                        : <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>push({ hintVisibleToParticipants:false })}>💡 إخفاء التلميح</button>}
                    </div>
                    {/* Correct / Wrong / Steal / Skip / Next */}
                    <div style={{ marginBottom:"0.65rem" }}>
                      <input className="kc-input" placeholder="اكتب إجابة الفريق هنا" value={hostAnswer} onChange={e=>setHostAnswer(e.target.value)} />
                      <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginTop:"0.45rem" }}>
                        <button className="btn-gold" style={{ fontSize:"0.82rem" }} onClick={verifyHostAnswer}>تحقق من الإجابة</button>
                        {hostAnswerFeedback && <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{hostAnswerFeedback}</span>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                      <button className="btn-green" style={{ fontSize:"0.85rem" }} onClick={markCorrect}>✅ إجابة صحيحة</button>
                      <button className="btn-danger" style={{ fontSize:"0.85rem" }} onClick={markWrong}>❌ إجابة خاطئة</button>
                      {room.stealMode!=="none" && <button className="btn-secondary" style={{ fontSize:"0.85rem" }} onClick={allowSteal}>🔄 فرصة سرقة</button>}
                      <button className="btn-secondary" style={{ fontSize:"0.85rem" }} onClick={skipQ}>⏭ تخطي</button>
                      <button className="btn-secondary" style={{ fontSize:"0.85rem" }} onClick={cancelQuestion}>❌ إلغاء السؤال الحالي</button>
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
            </div>}

            {/* Right: Board */}
            <div className="kc-card">
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"0.5rem", flexWrap:"wrap" }}>
                <div>
                  <div className="section-title">لوحة الحروف</div>
                  <div style={{ fontSize:"0.76rem", color:"#94a3b8" }}>{presentationMode ? "وضع العرض" : "وضع الاستضافة"}</div>
                </div>
                <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                  <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>setPresentationMode(v=>!v)}>{presentationMode ? "الخروج من وضع العرض" : "وضع العرض"}</button>
                  <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={()=>window.open(`/display?room=${roomCode}`,"_blank","noopener")}>📺 شاشة العرض الكاملة</button>
                </div>
              </div>
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
                onCellClick={handleCellClick} winnerTeam={room.winnerTeam} winningPathIds={winningPathIds} />
              {room.activeQuestion && room.questionStatus!=="correct" && (
                <button className="btn-gold" style={{ width:"100%", marginTop:"1rem", fontSize:"0.9rem" }} onClick={markCorrect}>
                  🎯 منح الحرف "{room.activeQuestion.cellLabel}" للفريق النشط
                </button>
              )}
            </div>
          </div>
          </>
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
    <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:"1.25rem" }}>
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
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem" }}>
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

  const randomizeTeams = async () => {
    if (!players.length) { showToast.warning("لا يوجد مشاركون لتوزيعهم."); return; }
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    try {
      for (let i = 0; i < shuffled.length; i++) {
        const team: 1 | 2 = (i % 2 === 0) ? 1 : 2;
        await assignPlayerTeam(roomCode, shuffled[i].id, team);
      }
      showToast.success("تم توزيع المشاركين عشوائياً على الفريقين");
    } catch (e) { console.error(e); showToast.error("فشل التوزيع العشوائي"); }
  };

  const clearAllMembers = async () => {
    if (!players.length) { showToast.info("لا يوجد مشاركون لحذفهم."); return; }
    if (!window.confirm("هل تريد حذف جميع المشاركين من الغرفة؟")) return;
    try {
      for (const p of players) await removePlayer(roomCode, p.id);
      showToast.success("تم مسح جميع المشاركين");
    } catch (e) { console.error(e); showToast.error("فشل المسح"); }
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
          <div className="section-title" style={{ marginBottom: 0 }}>المشاركون ({players.length})</div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button className="btn-secondary" style={{ fontSize: "0.78rem" }} onClick={randomizeTeams} disabled={!players.length}>🎲 توزيع عشوائي</button>
            <button className="btn-danger" style={{ fontSize: "0.78rem" }} onClick={clearAllMembers} disabled={!players.length}>🗑 مسح الأعضاء</button>
          </div>
        </div>
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
      <JoinQRCard
        roomCode={roomCode}
        joinLink={jl}
        onCopy={copyText}
        onShowDisplay={() => window.open(`/display?room=${roomCode}`, "_blank", "noopener")}
        onOpenJoin={() => window.open(`/join?room=${roomCode}`, "_blank", "noopener")}
        size={180}
      />
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
