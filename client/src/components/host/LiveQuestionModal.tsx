import type { RoomState, BoardCell, ActiveQuestion } from "../../lib/store";
import { getCellDisplayLetter } from "../../lib/store";
import { normalizeTfCanonical } from "../../lib/questionTypes";

type Props = {
  room: RoomState;
  cell: BoardCell;
  activeQuestion: ActiveQuestion | null;
  onClose: () => void;
  onShowAnswer: () => void;
  onAwardTeam: (team: 1 | 2) => void;
  onSkip: () => void;
  onReturnToBank: () => void;
  onRevealToParticipants: () => void;
  onAddQuestion: () => void;
};

const diffLabel = (d: string) => d === "easy" ? "سهل" : d === "hard" ? "صعب" : "متوسط";

export default function LiveQuestionModal({
  room, cell, activeQuestion, onClose, onShowAnswer, onAwardTeam, onSkip, onReturnToBank, onRevealToParticipants, onAddQuestion,
}: Props) {
  const bank = (cell as any).questionBank as any[] | undefined;
  const bankCount = Array.isArray(bank) ? bank.filter((q) => String(q?.question || "").trim()).length : (cell.question.trim() ? 1 : 0);
  const idx = activeQuestion && Array.isArray(bank)
    ? Math.max(0, bank.findIndex((q) => q?.question === activeQuestion.question && q?.answer === activeQuestion.answer))
    : 0;
  const remaining = Math.max(0, bankCount - idx - 1);
  const hasQuestion = !!activeQuestion;
  const isMcq = activeQuestion?.type === "mcq";
  const isTf = activeQuestion?.type === "tf";
  const tfCanon = activeQuestion && isTf ? normalizeTfCanonical(activeQuestion.answer) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box modal-box-scroll"
        style={{ maxWidth: 560, width: "min(560px, 94vw)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header-safe" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8", fontWeight: 700 }}>الحرف المختار</div>
            <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#f59e0b", lineHeight: 1.1 }}>{getCellDisplayLetter(cell)}</div>
          </div>
          <button aria-label="إغلاق" onClick={onClose} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: "1.2rem" }}>✕</button>
        </div>

        {!hasQuestion ? (
          <div>
            <div style={{ background: "#141e2d", border: "1px dashed #334155", borderRadius: 12, padding: "1.5rem 1rem", textAlign: "center", color: "#cbd5e1" }}>
              <div style={{ fontSize: "1.8rem", marginBottom: "0.4rem" }}>📭</div>
              <div style={{ fontWeight: 700, color: "#f0ede8" }}>لا توجد أسئلة لهذا الحرف</div>
              <div style={{ fontSize: "0.82rem", color: "#94a3b8", marginTop: "0.25rem" }}>أضف سؤالاً، أو اختر حرفاً آخر للبدء.</div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.85rem" }}>
              <button className="btn-gold" onClick={onAddQuestion}>إضافة سؤال</button>
              <button className="btn-secondary" onClick={onClose}>اختيار سؤال آخر</button>
              <button className="btn-secondary" style={{ marginInlineStart: "auto" }} onClick={onClose}>إغلاق</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
              <span className="badge-chip" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 700 }}>
                {activeQuestion!.type === "mcq" ? "اختيار من متعدد" : activeQuestion!.type === "tf" ? "صح/خطأ" : "إجابة قصيرة"}
              </span>
              {activeQuestion!.category && (
                <span className="badge-chip" style={{ color: "#cbd5e1", background: "#0f1623" }}>التصنيف: {activeQuestion!.category}</span>
              )}
              <span className="badge-chip" style={{ color: "#cbd5e1", background: "#0f1623" }}>المستوى: {diffLabel(activeQuestion!.difficulty)}</span>
              <span className="badge-chip" style={{ color: "#f59e0b", background: "rgba(245,158,11,0.1)", fontWeight: 700 }}>{activeQuestion!.points} نقطة</span>
              <span className="badge-chip" style={{ color: "#cbd5e1", background: "#0f1623" }}>المتبقي لهذا الحرف: {remaining}</span>
            </div>

            <div style={{ background: "#141e2d", border: "1px solid #1a2332", borderRadius: 12, padding: "0.85rem", marginBottom: "0.65rem" }}>
              <div style={{ fontSize: "0.74rem", fontWeight: 700, color: "#94a3b8", marginBottom: "0.3rem" }}>السؤال</div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#f0ede8", lineHeight: 1.7, direction: "rtl" }}>{activeQuestion!.question}</div>
            </div>

            {isMcq && Array.isArray(activeQuestion!.choices) && activeQuestion!.choices!.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.4rem", marginBottom: "0.65rem" }}>
                {activeQuestion!.choices!.map((c, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.6rem", borderRadius: 10, background: c === activeQuestion!.answer ? "rgba(34,197,94,0.12)" : "#0f1623", border: `1.5px solid ${c === activeQuestion!.answer ? "rgba(34,197,94,0.4)" : "#1a2332"}`, color: c === activeQuestion!.answer ? "#22c55e" : "#cbd5e1", fontWeight: 700 }}>
                    <span style={{ fontSize: "0.74rem", color: "#94a3b8" }}>{(["أ","ب","ج","د","هـ","و"][i] || String(i + 1))}.</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{c}</span>
                    {c === activeQuestion!.answer && <span style={{ fontSize: "0.7rem" }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
            {isTf && (
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.65rem" }}>
                {(["صح", "خطأ"] as const).map((c) => (
                  <div key={c} style={{ flex: 1, textAlign: "center", padding: "0.55rem", borderRadius: 10, background: tfCanon !== null && c === tfCanon ? "rgba(34,197,94,0.15)" : "#0f1623", border: `1.5px solid ${tfCanon !== null && c === tfCanon ? "rgba(34,197,94,0.45)" : "#1a2332"}`, color: tfCanon !== null && c === tfCanon ? "#22c55e" : "#cbd5e1", fontWeight: 800 }}>
                    {c}
                  </div>
                ))}
              </div>
            )}

            {room.answerVisibleToHost ? (
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1.5px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "0.65rem 0.85rem", marginBottom: "0.65rem" }}>
                <div style={{ fontSize: "0.7rem", color: "#22c55e", fontWeight: 700, marginBottom: "0.2rem" }}>الإجابة</div>
                <div style={{ color: "#f0ede8", fontWeight: 700 }}>
                  {activeQuestion!.type === "tf"
                    ? (normalizeTfCanonical(activeQuestion!.answer) ?? activeQuestion!.answer)
                    : activeQuestion!.answer}
                </div>
                {activeQuestion!.hint && <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginTop: "0.3rem" }}>تلميح: {activeQuestion!.hint}</div>}
              </div>
            ) : (
              <button className="btn-secondary" style={{ width: "100%", marginBottom: "0.5rem", fontSize: "0.85rem" }} onClick={onShowAnswer}>👁 كشف الإجابة (للمضيف)</button>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.4rem" }}>
              <button className={room.answerVisibleToParticipants ? "btn-secondary" : "btn-gold"} style={{ fontSize: "0.82rem" }} onClick={onRevealToParticipants}>
                {room.answerVisibleToParticipants ? "🔒 إخفاء الإجابة" : "📢 كشف الإجابة للطلاب"}
              </button>
              <button className="btn-green" style={{ fontSize: "0.82rem", background: `${room.team1.color}22`, color: room.team1.color, borderColor: `${room.team1.color}66` }} onClick={() => onAwardTeam(1)}>✅ احتساب: {room.team1.name}</button>
              <button className="btn-green" style={{ fontSize: "0.82rem", background: `${room.team2.color}22`, color: room.team2.color, borderColor: `${room.team2.color}66` }} onClick={() => onAwardTeam(2)}>✅ احتساب: {room.team2.name}</button>
              <button className="btn-secondary" style={{ fontSize: "0.82rem" }} onClick={onSkip}>⏭ تخطي السؤال</button>
              <button className="btn-secondary" style={{ fontSize: "0.82rem" }} onClick={onReturnToBank}>↩ إرجاع السؤال للبنك</button>
              <button className="btn-secondary" style={{ fontSize: "0.82rem" }} onClick={onClose}>إغلاق</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
