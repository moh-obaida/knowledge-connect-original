import { useState, useEffect, useRef, useCallback } from "react";
import {
  createRoom, generateUniqueCode, updateRoom, subscribeToRoom, deleteRoom,
} from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  defaultRoomState, generateBoard, checkWinner,
  loadLastRoomCode, saveLastRoomCode,
  type RoomState, type BoardCell, type ActiveQuestion,
} from "../lib/store";
import { showToast } from "../components/KcToast";

// ── Helpers ───────────────────────────────────────────────────
function diffLabel(d: string) {
  if (d === "easy") return { label: "سهل", color: "#22c55e" };
  if (d === "medium") return { label: "متوسط", color: "#f59e0b" };
  return { label: "صعب", color: "#ef4444" };
}

function ConfirmModal({ msg, onYes, onNo }: { msg: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="modal-overlay" onClick={onNo}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: "1rem" }}>⚠️</div>
        <div style={{ fontWeight: 600, color: "#f0ede8", textAlign: "center", marginBottom: "1.5rem", lineHeight: 1.6 }}>{msg}</div>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button className="btn-danger" onClick={onYes}>نعم، متأكد</button>
          <button className="btn-secondary" onClick={onNo}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ── Cell Question Editor Modal ────────────────────────────────
function CellEditor({ cell, onSave, onClose }: {
  cell: BoardCell;
  onSave: (updated: Partial<BoardCell>) => void;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState(cell.question);
  const [answer, setAnswer] = useState(cell.answer);
  const [category, setCategory] = useState(cell.category);
  const [difficulty, setDifficulty] = useState(cell.difficulty);
  const [points, setPoints] = useState(cell.points);
  const [hint, setHint] = useState(cell.hint);
  const [explanation, setExplanation] = useState(cell.explanation);

  const handleSave = () => {
    if (!question.trim()) { showToast.error("نص السؤال مطلوب"); return; }
    if (!answer.trim()) { showToast.error("الإجابة الصحيحة مطلوبة"); return; }
    onSave({ question: question.trim(), answer: answer.trim(), category: category.trim(), difficulty, points: Number(points) || 1, hint: hint.trim(), explanation: explanation.trim() });
  };

  const handleClear = () => {
    onSave({ question: "", answer: "", category: "", difficulty: "easy", points: 1, hint: "", explanation: "" });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 520, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#f59e0b" }}>
            سؤال الحرف: <span style={{ fontSize: "1.4rem" }}>{cell.label}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>نص السؤال *</label>
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3}
              placeholder="اكتب نص السؤال هنا..." className="kc-input" style={{ resize: "vertical" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>الإجابة الصحيحة *</label>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)}
              placeholder="اكتب الإجابة الصحيحة هنا..." className="kc-input" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>التصنيف</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)}
                placeholder="اكتب التصنيف..." className="kc-input" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>مستوى الصعوبة</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as BoardCell["difficulty"])} className="kc-input">
                <option value="easy">سهل</option>
                <option value="medium">متوسط</option>
                <option value="hard">صعب</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>النقاط</label>
            <input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(Number(e.target.value))} className="kc-input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>تلميح اختياري</label>
            <input value={hint} onChange={(e) => setHint(e.target.value)}
              placeholder="اكتب تلميحًا اختياريًا..." className="kc-input" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>شرح اختياري</label>
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2}
              placeholder="اكتب شرحًا اختياريًا..." className="kc-input" style={{ resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
            <button className="btn-gold" style={{ flex: 1 }} onClick={handleSave}>💾 حفظ سؤال الحرف</button>
            <button className="btn-danger" onClick={handleClear}>مسح</button>
            <button className="btn-secondary" onClick={onClose}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Board Setup Grid ──────────────────────────────────────────
function BoardSetupGrid({ board, gridSize, onCellClick, team1Color, team2Color, isGameMode }: {
  board: BoardCell[]; gridSize: number; onCellClick: (cell: BoardCell) => void;
  team1Color: string; team2Color: string; isGameMode: boolean;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${gridSize}, 1fr)`, gap: "5px" }}>
      {board.map((cell, i) => {
        const hasQ = !!cell.question.trim();
        const claimed1 = cell.claimedBy === 1;
        const claimed2 = cell.claimedBy === 2;
        const bg = claimed1 ? team1Color : claimed2 ? team2Color : hasQ ? "#1a2332" : "#141e2d";
        const border = claimed1 ? team1Color : claimed2 ? team2Color : hasQ ? "#253347" : "#1a2332";
        return (
          <div key={i} onClick={() => onCellClick(cell)}
            className="board-cell"
            style={{
              background: bg,
              borderColor: border,
              color: claimed1 || claimed2 ? "#fff" : hasQ ? "#f0ede8" : "#3d5068",
              position: "relative",
              cursor: "pointer",
            }}
          >
            {cell.claimedBy === 1 ? (
              <span style={{ fontWeight: 900 }}>{cell.label}</span>
            ) : cell.claimedBy === 2 ? (
              <span style={{ fontWeight: 900 }}>{cell.label}</span>
            ) : (
              <>
                <span>{cell.label}</span>
                {!isGameMode && (
                  <span style={{
                    position: "absolute", top: 2, left: 2, fontSize: "0.5rem",
                    color: hasQ ? "#22c55e" : "#ef4444",
                  }}>
                    {hasQ ? "✓" : "!"}
                  </span>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOST VIEW
// ═══════════════════════════════════════════════════════════════
export default function HostView() {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"setup" | "board" | "game" | "settings">("setup");
  const [editingCell, setEditingCell] = useState<BoardCell | null>(null);
  const [confirmMsg, setConfirmMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [timerInterval, setTimerIntervalState] = useState<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const roomRef = useRef<RoomState | null>(null);

  // Keep roomRef in sync
  useEffect(() => { roomRef.current = room; }, [room]);

  // ── Load last room on mount ──
  useEffect(() => {
    const lastCode = loadLastRoomCode();
    if (lastCode && isFirebaseConfigured()) {
      setRoomCode(lastCode);
      const unsub = subscribeToRoom(lastCode, (state) => {
        if (state) setRoom(state);
        else { setRoom(null); setRoomCode(""); saveLastRoomCode(""); }
      });
      unsubRef.current = unsub;
    }
    return () => { unsubRef.current?.(); };
  }, []);

  // ── Timer tick ──
  useEffect(() => {
    if (!room) return;
    if (room.timerRunning && room.timerValue > 0) {
      const id = setInterval(async () => {
        const current = roomRef.current;
        if (!current || !current.timerRunning) { clearInterval(id); return; }
        const newVal = current.timerValue - 1;
        if (newVal <= 0) {
          clearInterval(id);
          await updateRoom(current.roomCode, { timerValue: 0, timerRunning: false, questionStatus: "time_up" });
        } else {
          await updateRoom(current.roomCode, { timerValue: newVal });
        }
      }, 1000);
      setTimerIntervalState(id);
      return () => clearInterval(id);
    } else if (!room.timerRunning && timerInterval) {
      clearInterval(timerInterval);
      setTimerIntervalState(null);
    }
  }, [room?.timerRunning]);

  // ── Confirm helper ──
  const confirm = (msg: string, action: () => void) => {
    setConfirmMsg(msg);
    setConfirmAction(() => action);
  };

  // ── Push update to Firebase ──
  const push = useCallback(async (updates: Partial<RoomState>) => {
    if (!roomCode) return;
    try { await updateRoom(roomCode, updates); }
    catch (e) { console.error(e); showToast.error("فشل الاتصال بـ Firebase"); }
  }, [roomCode]);

  // ── Create room ──
  const handleCreateRoom = async () => {
    if (!isFirebaseConfigured()) {
      showToast.error("Firebase غير مُهيَّأ — أضف إعدادات Firebase في ملف .env");
      return;
    }
    setCreating(true);
    try {
      const code = await generateUniqueCode();
      await createRoom(code);
      saveLastRoomCode(code);
      setRoomCode(code);
      unsubRef.current?.();
      const unsub = subscribeToRoom(code, (state) => {
        if (state) setRoom(state);
      });
      unsubRef.current = unsub;
      showToast.success(`تم إنشاء الغرفة! الرمز: ${code}`);
      setActiveTab("setup");
    } catch (e) {
      console.error(e);
      showToast.error("فشل إنشاء الغرفة. تحقق من الاتصال.");
    }
    setCreating(false);
  };

  // ── Copy join link ──
  const copyJoinLink = () => {
    const url = `${window.location.origin}/join`;
    navigator.clipboard.writeText(url).then(() => showToast.success("تم نسخ رابط الانضمام!")).catch(() => showToast.error("فشل النسخ"));
  };

  // ── Open participant screen ──
  const openParticipant = () => {
    if (!roomCode) { showToast.error("أنشئ غرفة أولاً"); return; }
    window.open(`/participant?room=${roomCode}`, "_blank");
  };

  // ── Cell click: setup mode = edit question; game mode = load question ──
  const handleCellClick = (cell: BoardCell) => {
    if (!room) return;
    if (room.gameStatus === "lobby") {
      setEditingCell(cell);
    } else {
      // Game mode: load this cell's question
      if (!cell.question.trim()) {
        showToast.warning("لا يوجد سؤال محفوظ لهذا الحرف بعد.");
        return;
      }
      if (cell.claimedBy !== 0) {
        showToast.info("هذا الحرف محجوز بالفعل.");
        return;
      }
      const aq: ActiveQuestion = {
        cellId: cell.id,
        cellLabel: cell.label,
        question: cell.question,
        answer: cell.answer,
        category: cell.category,
        difficulty: cell.difficulty,
        points: cell.points,
        hint: cell.hint,
        explanation: cell.explanation,
      };
      push({
        activeQuestion: aq,
        answerVisibleToHost: false,
        answerVisibleToParticipants: false,
        hintVisibleToParticipants: false,
        questionStatus: "active",
        timerValue: room.timerSetting,
        timerRunning: false,
      });
      showToast.info(`تم تحميل سؤال الحرف: ${cell.label}`);
    }
  };

  // ── Save cell question ──
  const handleSaveCellQuestion = async (updates: Partial<BoardCell>) => {
    if (!room || !editingCell) return;
    const newBoard = room.board.map((c) =>
      c.id === editingCell.id ? { ...c, ...updates } : c
    );
    await push({ board: newBoard });
    showToast.success("تم حفظ سؤال الحرف ✓");
    setEditingCell(null);
  };

  // ── Claim cell for active team ──
  const claimCell = async (cellId: string) => {
    if (!room) return;
    const newBoard = room.board.map((c) =>
      c.id === cellId ? { ...c, claimedBy: room.activeTeam as 0 | 1 | 2, used: true } : c
    );
    const pts = room.activeQuestion?.points || 1;
    const scoreUpdate = room.activeTeam === 1
      ? { team1Score: room.team1Score + pts }
      : { team2Score: room.team2Score + pts };

    // Check winner after claim
    const winner = checkWinner(newBoard, room.gridSize);
    const winMsg = winner === 1
      ? `🏆 ${room.team1.name} فاز!`
      : winner === 2
      ? `🏆 ${room.team2.name} فاز!`
      : "";

    await push({
      board: newBoard,
      ...scoreUpdate,
      questionStatus: "correct",
      winnerMessage: winMsg,
      gameStatus: winMsg ? "finished" : room.gameStatus,
    });
    if (winMsg) showToast.success(winMsg);
  };

  // ── Mark correct ──
  const markCorrect = async () => {
    if (!room?.activeQuestion) return;
    await claimCell(room.activeQuestion.cellId);
  };

  // ── Mark wrong ──
  const markWrong = async () => {
    if (!room) return;
    await push({ questionStatus: "wrong" });
    if (room.stealMode === "steal") showToast.info("فرصة سرقة متاحة!");
  };

  // ── Allow steal ──
  const allowSteal = async () => {
    if (!room) return;
    const next: 1 | 2 = room.activeTeam === 1 ? 2 : 1;
    await push({ activeTeam: next });
    showToast.info(`الدور انتقل إلى ${next === 1 ? room.team1.name : room.team2.name}`);
  };

  // ── Skip question ──
  const skipQuestion = async () => {
    if (!room) return;
    await push({ activeQuestion: null, questionStatus: "skipped", answerVisibleToHost: false, answerVisibleToParticipants: false, hintVisibleToParticipants: false });
  };

  // ── Timer controls ──
  const startTimer = () => { if (!room) return; push({ timerRunning: true }); };
  const pauseTimer = () => { if (!room) return; push({ timerRunning: false }); };
  const resetTimer = () => { if (!room) return; push({ timerRunning: false, timerValue: room.timerSetting }); };

  // ── Score controls ──
  const addScore = (team: 1 | 2, delta: number) => {
    if (!room) return;
    if (team === 1) push({ team1Score: Math.max(0, room.team1Score + delta) });
    else push({ team2Score: Math.max(0, room.team2Score + delta) });
  };

  // ── Declare winner manually ──
  const declareWinner = (team: 1 | 2 | "draw") => {
    if (!room) return;
    const msg = team === "draw" ? "🤝 تعادل!" : team === 1 ? `🏆 ${room.team1.name} فاز!` : `🏆 ${room.team2.name} فاز!`;
    push({ winnerMessage: msg, gameStatus: "finished" });
  };

  // ── Start game ──
  const startGame = async () => {
    if (!room) return;
    const emptyCells = room.board.filter((c) => !c.question.trim());
    if (emptyCells.length > 0) {
      confirm(
        `بعض الحروف لا تحتوي على أسئلة (${emptyCells.length} حرف). هل تريد المتابعة؟`,
        () => push({ gameStatus: "active" })
      );
    } else {
      await push({ gameStatus: "active" });
      showToast.success("بدأت اللعبة!");
      setActiveTab("game");
    }
  };

  // ── Reset game ──
  const resetGame = () => {
    if (!room) return;
    confirm("هل أنت متأكد من إعادة ضبط اللعبة؟ سيتم مسح النقاط والخلايا والسؤال الحالي.", async () => {
      const freshBoard = generateBoard(room.gridSize, room.cellLabelStyle);
      // Keep questions but reset claimed/used status
      const resetBoard = room.board.map((c, i) => ({
        ...c,
        claimedBy: 0 as const,
        used: false,
        label: freshBoard[i]?.label || c.label,
      }));
      await push({
        board: resetBoard,
        team1Score: 0,
        team2Score: 0,
        activeQuestion: null,
        answerVisibleToHost: false,
        answerVisibleToParticipants: false,
        hintVisibleToParticipants: false,
        timerRunning: false,
        timerValue: room.timerSetting,
        winnerMessage: "",
        questionStatus: "idle",
        gameStatus: "lobby",
        activeTeam: 1,
      });
      showToast.success("تم إعادة ضبط اللعبة");
    });
  };

  // ── Export board questions ──
  const exportBoard = () => {
    if (!room) return;
    const data = JSON.stringify(room.board, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `wasla-board-${roomCode}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast.success("تم تصدير أسئلة اللوحة");
  };

  // ── Import board questions ──
  const importBoard = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text) as BoardCell[];
        if (!Array.isArray(parsed)) throw new Error("Invalid format");
        await push({ board: parsed });
        showToast.success("تم استيراد أسئلة اللوحة بنجاح");
      } catch {
        showToast.error("ملف غير صالح. تحقق من التنسيق.");
      }
    };
    input.click();
  };

  // ── Settings: update team/grid ──
  const updateSettings = async (updates: Partial<RoomState>) => {
    if (!room) return;
    // If grid size changed, regenerate board
    if (updates.gridSize && updates.gridSize !== room.gridSize) {
      const style = updates.cellLabelStyle || room.cellLabelStyle;
      updates.board = generateBoard(updates.gridSize, style);
    }
    await push(updates);
    showToast.success("تم حفظ الإعدادات");
  };

  // ── Render: no Firebase ──
  if (!isFirebaseConfigured()) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#090d18", padding: "2rem" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔥</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f59e0b", marginBottom: "0.75rem" }}>وصلة المعرفة</div>
          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#ef4444", marginBottom: "1rem" }}>Firebase غير مُهيَّأ</div>
          <div style={{ background: "#0f1623", border: "1.5px solid #1a2332", borderRadius: "16px", padding: "1.5rem", textAlign: "right" }}>
            <div className="section-title">خطوات الإعداد</div>
            <ol style={{ color: "#94a3b8", fontSize: "0.85rem", lineHeight: 2, paddingRight: "1.25rem" }}>
              <li>أنشئ مشروع Firebase على <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" style={{ color: "#f59e0b" }}>console.firebase.google.com</a></li>
              <li>فعّل Realtime Database</li>
              <li>أنشئ ملف <code style={{ color: "#f59e0b" }}>.env</code> في مجلد المشروع</li>
              <li>أضف متغيرات Firebase (راجع README)</li>
              <li>أعد تشغيل الخادم</li>
            </ol>
          </div>
          <a href="/README.md" target="_blank" style={{ display: "inline-block", marginTop: "1rem", padding: "0.6rem 1.5rem", background: "#f59e0b", color: "#090d18", borderRadius: "10px", fontWeight: 700, textDecoration: "none" }}>
            قراءة README
          </a>
        </div>
      </div>
    );
  }

  // ── Render: no room yet ──
  if (!room) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)", padding: "2rem" }}>
        <div style={{ fontSize: "3rem", fontWeight: 900, color: "#f59e0b", marginBottom: "0.5rem", textAlign: "center" }}>وصلة المعرفة</div>
        <div style={{ color: "#475569", marginBottom: "3rem", fontSize: "0.9rem" }}>تحدي الفرق التفاعلي للفصل الدراسي</div>
        <div style={{ background: "#0f1623", border: "1.5px solid #1a2332", borderRadius: "20px", padding: "2.5rem", maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🎮</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#f0ede8", marginBottom: "0.5rem" }}>لوحة التحكم للمضيف</div>
          <div style={{ color: "#64748b", fontSize: "0.85rem", marginBottom: "2rem" }}>أنشئ غرفة جديدة لبدء اللعبة</div>
          <button className="btn-gold" style={{ width: "100%", padding: "0.85rem", fontSize: "1rem" }}
            onClick={handleCreateRoom} disabled={creating}>
            {creating ? "جارٍ الإنشاء..." : "إنشاء غرفة جديدة 🚀"}
          </button>
          <div style={{ marginTop: "1.5rem", fontSize: "0.8rem", color: "#475569" }}>
            المشاركون يدخلون من:{" "}
            <span style={{ color: "#f59e0b", fontWeight: 600 }}>{window.location.origin}/join</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Main host dashboard ──
  const filledCells = room.board.filter((c) => c.question.trim()).length;
  const totalCells = room.board.length;

  return (
    <div style={{ minHeight: "100vh", background: "#090d18" }}>
      {/* Confirm modal */}
      {confirmMsg && confirmAction && (
        <ConfirmModal msg={confirmMsg} onYes={() => { confirmAction(); setConfirmMsg(""); setConfirmAction(null); }}
          onNo={() => { setConfirmMsg(""); setConfirmAction(null); }} />
      )}

      {/* Cell editor modal */}
      {editingCell && (
        <CellEditor cell={editingCell} onSave={handleSaveCellQuestion} onClose={() => setEditingCell(null)} />
      )}

      {/* Winner overlay */}
      {room.winnerMessage && (
        <div className="winner-overlay">
          <div className="winner-card">
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏆</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f59e0b" }}>{room.winnerMessage}</div>
            <button className="btn-secondary" style={{ marginTop: "1.5rem" }}
              onClick={() => push({ winnerMessage: "" })}>إغلاق</button>
          </div>
        </div>
      )}

      {/* Top header */}
      <div style={{ background: "#0f1623", borderBottom: "1.5px solid #1a2332", padding: "0.85rem 1.5rem" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
          {/* Left: title + room code */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ fontWeight: 900, fontSize: "1.3rem", color: "#f59e0b" }}>وصلة المعرفة</div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>رمز الغرفة:</span>
              <span style={{ fontWeight: 900, fontSize: "1.2rem", color: "#f0ede8", letterSpacing: "0.15em", background: "#1a2332", padding: "0.2rem 0.75rem", borderRadius: "8px" }}>
                {roomCode}
              </span>
            </div>
            <div style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem", borderRadius: "9999px", fontWeight: 600,
              background: room.gameStatus === "active" ? "rgba(22,163,74,0.2)" : room.gameStatus === "finished" ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.2)",
              color: room.gameStatus === "active" ? "#22c55e" : room.gameStatus === "finished" ? "#ef4444" : "#f59e0b" }}>
              {room.gameStatus === "lobby" ? "انتظار" : room.gameStatus === "active" ? "جارية" : "منتهية"}
            </div>
          </div>
          {/* Right: action buttons */}
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={copyJoinLink}>📋 نسخ رابط الانضمام</button>
            <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => window.open("/join", "_blank")}>🔗 فتح صفحة الانضمام</button>
            <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={openParticipant}>📺 شاشة المشاركين</button>
            {room.gameStatus === "lobby" && (
              <button className="btn-gold" style={{ fontSize: "0.8rem" }} onClick={startGame}>▶ بدء اللعبة</button>
            )}
            <button className="btn-danger" style={{ fontSize: "0.8rem" }} onClick={resetGame}>↺ إعادة الضبط</button>
            <button className="btn-secondary" style={{ fontSize: "0.8rem" }}
              onClick={() => confirm("هل تريد حذف هذه الغرفة نهائياً؟", async () => {
                await deleteRoom(roomCode);
                saveLastRoomCode("");
                setRoom(null); setRoomCode("");
                unsubRef.current?.();
              })}>🗑 حذف الغرفة</button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#0f1623", borderBottom: "1.5px solid #1a2332", padding: "0 1.5rem" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", gap: "0.25rem", overflowX: "auto", paddingBottom: "0.5rem", paddingTop: "0.5rem" }}>
          {([
            { id: "setup", label: "إعداد أسئلة الحروف" },
            { id: "game", label: "التحكم باللعبة" },
            { id: "settings", label: "الإعدادات" },
          ] as const).map((tab) => (
            <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="container" style={{ paddingTop: "1.5rem", paddingBottom: "3rem" }}>

        {/* ── TAB: Setup ── */}
        {activeTab === "setup" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Board grid */}
            <div className="kc-card">
              <div className="section-title">لوحة الحروف</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
                اضغط على أي حرف لإضافة سؤاله •{" "}
                <span style={{ color: "#22c55e" }}>✓ يحتوي سؤال</span>{" "}
                <span style={{ color: "#ef4444" }}>! فارغ</span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "1rem" }}>
                تم ملء {filledCells} من {totalCells} حرف
              </div>
              <div style={{ marginBottom: "0.5rem" }}>
                <div style={{ height: 4, background: "#1a2332", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#f59e0b", width: `${(filledCells / totalCells) * 100}%`, transition: "width 0.3s ease" }} />
                </div>
              </div>
              <BoardSetupGrid board={room.board} gridSize={room.gridSize}
                onCellClick={handleCellClick} team1Color={room.team1.color}
                team2Color={room.team2.color} isGameMode={false} />
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={exportBoard}>📤 تصدير الأسئلة</button>
                <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={importBoard}>📥 استيراد الأسئلة</button>
              </div>
            </div>

            {/* Cell list */}
            <div className="kc-card" style={{ maxHeight: "70vh", overflowY: "auto" }}>
              <div className="section-title">قائمة الحروف والأسئلة</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {room.board.map((cell) => (
                  <div key={cell.id} onClick={() => setEditingCell(cell)}
                    style={{
                      display: "flex", alignItems: "center", gap: "0.75rem",
                      padding: "0.6rem 0.75rem", borderRadius: "10px", cursor: "pointer",
                      background: "#141e2d", border: "1.5px solid #1a2332",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a2332")}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "8px", background: "#1a2332", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#f59e0b", flexShrink: 0 }}>
                      {cell.label}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {cell.question ? (
                        <>
                          <div style={{ fontSize: "0.85rem", color: "#f0ede8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {cell.question}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {cell.category && `${cell.category} • `}
                            {diffLabel(cell.difficulty).label} • {cell.points} نقطة
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize: "0.85rem", color: "#3d5068" }}>هذا الحرف لا يحتوي على سؤال بعد</div>
                      )}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: cell.question ? "#22c55e" : "#ef4444" }}>
                      {cell.question ? "✓" : "!"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Game ── */}
        {activeTab === "game" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Left: Current question + controls */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Teams */}
              <div className="kc-card">
                <div className="section-title">الفرق</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  {([1, 2] as const).map((t) => {
                    const team = t === 1 ? room.team1 : room.team2;
                    const score = t === 1 ? room.team1Score : room.team2Score;
                    const active = room.activeTeam === t;
                    return (
                      <div key={t} style={{
                        background: active ? `${team.color}18` : "#141e2d",
                        border: `2px solid ${active ? team.color : "#1a2332"}`,
                        borderRadius: "14px", padding: "1rem", textAlign: "center",
                        transition: "all 0.2s ease",
                      }}>
                        {active && <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "0.25rem" }}>🎯 الفريق النشط</div>}
                        <div style={{ fontWeight: 700, color: team.color, marginBottom: "0.25rem" }}>{team.name}</div>
                        <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f0ede8" }}>{score}</div>
                        <div style={{ fontSize: "0.7rem", color: "#475569", marginBottom: "0.5rem" }}>نقطة</div>
                        <div style={{ display: "flex", gap: "0.3rem", justifyContent: "center" }}>
                          <button className="btn-secondary" style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }} onClick={() => push({ activeTeam: t })}>تحديد</button>
                          <button className="btn-green" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }} onClick={() => addScore(t, 1)}>+١</button>
                          <button className="btn-danger" style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }} onClick={() => addScore(t, -1)}>-١</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="btn-gold" style={{ fontSize: "0.8rem" }} onClick={() => declareWinner(1)}>🏆 فوز الفريق ١</button>
                  <button className="btn-gold" style={{ fontSize: "0.8rem" }} onClick={() => declareWinner(2)}>🏆 فوز الفريق ٢</button>
                  <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => declareWinner("draw")}>🤝 تعادل</button>
                </div>
              </div>

              {/* Timer */}
              <div className="kc-card">
                <div className="section-title">المؤقت</div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{
                    fontSize: "3rem", fontWeight: 900, color:
                      room.timerValue <= 5 ? "#ef4444" : room.timerValue <= 10 ? "#f59e0b" : "#f0ede8",
                    fontVariantNumeric: "tabular-nums",
                    animation: room.timerValue <= 5 && room.timerRunning ? "timerPulse 0.5s ease-in-out infinite" : "none",
                  }}>
                    {room.timerValue}
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "#64748b" }}>ثانية</div>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {!room.timerRunning
                      ? <button className="btn-green" style={{ fontSize: "0.8rem" }} onClick={startTimer}>▶ بدء</button>
                      : <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={pauseTimer}>⏸ إيقاف</button>}
                    <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={resetTimer}>↺ إعادة</button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                  {[15, 30, 45, 60].map((s) => (
                    <button key={s} className="btn-secondary" style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                      onClick={() => push({ timerSetting: s, timerValue: s, timerRunning: false })}>
                      {s}ث
                    </button>
                  ))}
                </div>
              </div>

              {/* Current question panel */}
              <div className="kc-card">
                <div className="section-title">السؤال الحالي</div>
                {room.activeQuestion ? (
                  <>
                    <div style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem", borderRadius: "9999px", background: "#1a2332", color: "#f59e0b", fontWeight: 700, display: "inline-block", marginBottom: "0.75rem" }}>
                      حرف: {room.activeQuestion.cellLabel}
                    </div>
                    <div style={{ fontSize: "1rem", fontWeight: 700, color: "#f0ede8", lineHeight: 1.7, marginBottom: "1rem" }}>
                      {room.activeQuestion.question}
                    </div>

                    {/* Answer (host only) */}
                    <div style={{ marginBottom: "0.75rem" }}>
                      {room.answerVisibleToHost ? (
                        <div style={{ background: "rgba(22,163,74,0.12)", border: "1.5px solid rgba(22,163,74,0.4)", borderRadius: "10px", padding: "0.75rem 1rem" }}>
                          <div style={{ fontSize: "0.7rem", color: "#22c55e", fontWeight: 700, marginBottom: "0.25rem" }}>الإجابة (للمضيف فقط)</div>
                          <div style={{ color: "#f0ede8", fontWeight: 600 }}>{room.activeQuestion.answer}</div>
                          {room.activeQuestion.hint && (
                            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.4rem" }}>تلميح: {room.activeQuestion.hint}</div>
                          )}
                        </div>
                      ) : (
                        <button className="btn-secondary" style={{ width: "100%", fontSize: "0.85rem" }}
                          onClick={() => push({ answerVisibleToHost: true })}>
                          👁 إظهار الإجابة للمضيف
                        </button>
                      )}
                    </div>

                    {/* Participant visibility */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                      {!room.answerVisibleToParticipants
                        ? <button className="btn-gold" style={{ fontSize: "0.8rem" }} onClick={() => push({ answerVisibleToParticipants: true, answerVisibleToHost: true, questionStatus: "answer_revealed" })}>
                            📢 إظهار الإجابة للمشاركين
                          </button>
                        : <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => push({ answerVisibleToParticipants: false })}>
                            🔒 إخفاء الإجابة
                          </button>}
                      {!room.hintVisibleToParticipants
                        ? <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => push({ hintVisibleToParticipants: true })}>
                            💡 إظهار التلميح
                          </button>
                        : <button className="btn-secondary" style={{ fontSize: "0.8rem" }} onClick={() => push({ hintVisibleToParticipants: false })}>
                            💡 إخفاء التلميح
                          </button>}
                    </div>

                    {/* Correct / Wrong / Steal / Skip */}
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <button className="btn-green" style={{ fontSize: "0.85rem" }} onClick={markCorrect}>✅ إجابة صحيحة</button>
                      <button className="btn-danger" style={{ fontSize: "0.85rem" }} onClick={markWrong}>❌ إجابة خاطئة</button>
                      {room.stealMode !== "none" && (
                        <button className="btn-secondary" style={{ fontSize: "0.85rem" }} onClick={allowSteal}>🔄 فرصة سرقة</button>
                      )}
                      <button className="btn-secondary" style={{ fontSize: "0.85rem" }} onClick={skipQuestion}>⏭ تخطي</button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: "center", padding: "2rem", color: "#3d5068" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>👆</div>
                    <div>اضغط على حرف في اللوحة لتحميل سؤاله</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Game board */}
            <div className="kc-card">
              <div className="section-title">لوحة اللعب</div>
              <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "0.75rem" }}>
                اضغط على حرف لتحميل سؤاله
              </div>
              <BoardSetupGrid board={room.board} gridSize={room.gridSize}
                onCellClick={handleCellClick} team1Color={room.team1.color}
                team2Color={room.team2.color} isGameMode={true} />

              {/* Claim cell button */}
              {room.activeQuestion && room.questionStatus !== "correct" && (
                <div style={{ marginTop: "1rem" }}>
                  <button className="btn-gold" style={{ width: "100%", fontSize: "0.9rem" }}
                    onClick={markCorrect}>
                    🎯 منح الحرف "{room.activeQuestion.cellLabel}" للفريق النشط
                  </button>
                </div>
              )}

              {/* Legend */}
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "1rem", justifyContent: "center" }}>
                {[room.team1, room.team2].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{ width: 14, height: 14, borderRadius: "4px", background: t.color }} />
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{t.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Settings ── */}
        {activeTab === "settings" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            {/* Team 1 */}
            <div className="kc-card">
              <div className="section-title">الفريق الأول</div>
              <TeamSettingsForm
                team={room.team1}
                onChange={(t) => updateSettings({ team1: t })}
              />
            </div>
            {/* Team 2 */}
            <div className="kc-card">
              <div className="section-title">الفريق الثاني</div>
              <TeamSettingsForm
                team={room.team2}
                onChange={(t) => updateSettings({ team2: t })}
              />
            </div>
            {/* Game settings */}
            <div className="kc-card">
              <div className="section-title">إعدادات اللعبة</div>
              <GameSettingsForm room={room} onChange={updateSettings} />
            </div>
            {/* Room info */}
            <div className="kc-card">
              <div className="section-title">معلومات الغرفة</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <InfoRow label="رمز الغرفة" value={roomCode} />
                <InfoRow label="عنوان اللعبة" value={room.gameTitle} />
                <InfoRow label="رابط الانضمام" value={`${window.location.origin}/join`} />
                <InfoRow label="رابط المشاركين" value={`${window.location.origin}/participant?room=${roomCode}`} />
                <div style={{ marginTop: "0.5rem" }}>
                  <button className="btn-secondary" style={{ width: "100%", fontSize: "0.85rem" }} onClick={copyJoinLink}>
                    📋 نسخ رابط الانضمام
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Team settings form ────────────────────────────────────────
function TeamSettingsForm({ team, onChange }: {
  team: { name: string; color: string; initials: string };
  onChange: (t: { name: string; color: string; initials: string }) => void;
}) {
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [initials, setInitials] = useState(team.initials);

  useEffect(() => { setName(team.name); setColor(team.color); setInitials(team.initials); }, [team]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>اسم الفريق</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="kc-input" />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>الأحرف الأولى</label>
        <input value={initials} onChange={(e) => setInitials(e.target.value)} maxLength={3} className="kc-input" />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>لون الفريق</label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            style={{ width: 44, height: 36, border: "none", borderRadius: "8px", cursor: "pointer", background: "none" }} />
          <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>{color}</span>
        </div>
      </div>
      <button className="btn-gold" onClick={() => onChange({ name, color, initials })}>حفظ الفريق</button>
    </div>
  );
}

// ── Game settings form ────────────────────────────────────────
function GameSettingsForm({ room, onChange }: {
  room: RoomState;
  onChange: (updates: Partial<RoomState>) => void;
}) {
  const [gridSize, setGridSize] = useState<4 | 5 | 6>(room.gridSize);
  const [cellLabelStyle, setCellLabelStyle] = useState(room.cellLabelStyle);
  const [winningMode, setWinningMode] = useState(room.winningMode);
  const [timerSetting, setTimerSetting] = useState(room.timerSetting);
  const [stealMode, setStealMode] = useState(room.stealMode);
  const [gameTitle, setGameTitle] = useState(room.gameTitle);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>عنوان اللعبة</label>
        <input value={gameTitle} onChange={(e) => setGameTitle(e.target.value)} className="kc-input" />
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>حجم اللوحة</label>
        <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value) as 4 | 5 | 6)} className="kc-input">
          <option value={4}>٤ × ٤</option>
          <option value={5}>٥ × ٥</option>
          <option value={6}>٦ × ٦</option>
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>نمط تسمية الخلايا</label>
        <select value={cellLabelStyle} onChange={(e) => setCellLabelStyle(e.target.value as RoomState["cellLabelStyle"])} className="kc-input">
          <option value="arabic">حروف عربية</option>
          <option value="english">حروف إنجليزية</option>
          <option value="numbers">أرقام</option>
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>نظام الفوز</label>
        <select value={winningMode} onChange={(e) => setWinningMode(e.target.value as RoomState["winningMode"])} className="kc-input">
          <option value="path">مسار (الفريق ١: يسار←يمين / الفريق ٢: أعلى←أسفل)</option>
          <option value="points">نقاط (الأكثر نقاطاً يفوز)</option>
          <option value="manual">يدوي (المضيف يعلن الفائز)</option>
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>وقت المؤقت (ثانية)</label>
        <select value={timerSetting} onChange={(e) => setTimerSetting(Number(e.target.value))} className="kc-input">
          <option value={0}>بدون مؤقت</option>
          <option value={15}>١٥ ثانية</option>
          <option value={30}>٣٠ ثانية</option>
          <option value={45}>٤٥ ثانية</option>
          <option value={60}>٦٠ ثانية</option>
        </select>
      </div>
      <div>
        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}>وضع السرقة</label>
        <select value={stealMode} onChange={(e) => setStealMode(e.target.value as RoomState["stealMode"])} className="kc-input">
          <option value="none">بدون سرقة</option>
          <option value="steal">السرقة متاحة بعد الإجابة الخاطئة</option>
          <option value="manual">المضيف يقرر</option>
        </select>
      </div>
      <button className="btn-gold" onClick={() => onChange({ gridSize, cellLabelStyle, winningMode, timerSetting, stealMode, gameTitle })}>
        حفظ الإعدادات
      </button>
    </div>
  );
}

// ── Info row ──────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: "0.85rem", color: "#f0ede8", fontWeight: 600, wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
