import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { subscribeToRoom, joinRoom } from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import type { RoomState, BoardCell, Team } from "../lib/store";

// ── URL helper ────────────────────────────────────────────────
function getParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
}

// ── Difficulty label ──────────────────────────────────────────
function diffLabel(d: string) {
  if (d === "easy") return { label: "سهل", color: "#22c55e" };
  if (d === "medium") return { label: "متوسط", color: "#f59e0b" };
  return { label: "صعب", color: "#ef4444" };
}

// ── Timer Ring ────────────────────────────────────────────────
function TimerRing({ value, max }: { value: number; max: number }) {
  const r = 36, circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  const offset = circ * (1 - pct);
  const color = value <= 5 ? "#ef4444" : value <= 10 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ position: "relative", width: 96, height: 96 }}>
      <svg width={96} height={96} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="#1a2332" strokeWidth={7} />
        <circle cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.5s linear, stroke 0.3s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontWeight: 900, fontSize: "1.4rem", color,
        fontFamily: "Cairo,sans-serif",
        animation: value <= 5 && value > 0 ? "timerPulse 0.5s ease-in-out infinite" : "none",
      }}>
        {value}
      </div>
      <style>{`@keyframes timerPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

// ── Board ─────────────────────────────────────────────────────
function Board({ board, gridSize, team1, team2 }: {
  board: BoardCell[]; gridSize: number; team1: Team; team2: Team;
}) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
      gap: "6px", width: "100%", maxWidth: 480, margin: "0 auto",
    }}>
      {board.map((cell, i) => {
        const claimed1 = cell.claimedBy === 1;
        const claimed2 = cell.claimedBy === 2;
        const bg = claimed1 ? team1.color : claimed2 ? team2.color : "#141e2d";
        const border = claimed1 ? team1.color : claimed2 ? team2.color : "#1a2332";
        const textColor = cell.claimedBy !== 0 ? "#fff" : "#3d5068";
        return (
          <div key={i} style={{
            aspectRatio: "1", background: bg, border: `2px solid ${border}`,
            borderRadius: "8px", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 800,
            fontSize: "clamp(0.6rem,2vw,1rem)", color: textColor,
            transition: "all 0.3s ease",
            boxShadow: cell.claimedBy !== 0 ? `0 2px 12px ${bg}66` : "none",
            fontFamily: "Cairo,sans-serif",
          }}>
            {cell.claimedBy === 1 ? team1.initials
              : cell.claimedBy === 2 ? team2.initials
              : cell.label}
          </div>
        );
      })}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function ParticipantView() {
  const [, setLocation] = useLocation();
  const roomCode = getParam("room");
  const playerName = getParam("name");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [firebaseError, setFirebaseError] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!roomCode) { setLocation("/join"); return; }
    if (!isFirebaseConfigured()) { setFirebaseError(true); return; }

    // Register player if name provided
    if (playerName && !joinedRef.current) {
      joinedRef.current = true;
      const playerId = localStorage.getItem("kc_player_id") || `p_${Date.now()}`;
      localStorage.setItem("kc_player_id", playerId);
      joinRoom(roomCode, playerId, playerName).catch(console.error);
    }

    try {
      const unsub = subscribeToRoom(roomCode, (state) => {
        if (state === null) setNotFound(true);
        else { setRoom(state); setNotFound(false); }
      });
      unsubRef.current = unsub;
    } catch (e) {
      console.error(e);
      setFirebaseError(true);
    }
    return () => { unsubRef.current?.(); };
  }, [roomCode, playerName, setLocation]);

  // ── Firebase not configured ──
  if (firebaseError) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#090d18", padding: "2rem" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚙️</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f59e0b", marginBottom: "0.5rem" }}>Firebase غير مُهيَّأ</div>
          <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            يجب إضافة إعدادات Firebase لتفعيل اللعب المباشر. راجع README للتفاصيل.
          </div>
          <a href="/join" style={{ display: "inline-block", padding: "0.6rem 1.5rem", background: "#f59e0b", color: "#090d18", borderRadius: "10px", fontWeight: 700, textDecoration: "none" }}>
            العودة
          </a>
        </div>
      </div>
    );
  }

  // ── Room not found ──
  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#090d18", padding: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#ef4444", marginBottom: "0.5rem" }}>الغرفة غير موجودة</div>
          <div style={{ color: "#64748b", marginBottom: "1.5rem" }}>رمز الغرفة غير صحيح أو انتهت صلاحيتها</div>
          <a href="/join" style={{ display: "inline-block", padding: "0.6rem 1.5rem", background: "#f59e0b", color: "#090d18", borderRadius: "10px", fontWeight: 700, textDecoration: "none" }}>
            حاول مجدداً
          </a>
        </div>
      </div>
    );
  }

  // ── Loading ──
  if (!room) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#090d18" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "2rem", color: "#f59e0b", marginBottom: "1rem", animation: "spin 1s linear infinite" }}>◌</div>
          <div style={{ color: "#64748b" }}>جارٍ الاتصال بالغرفة...</div>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  const { team1, team2, team1Score, team2Score, board, gridSize,
    activeQuestion, answerVisibleToParticipants, hintVisibleToParticipants,
    timerValue, timerMax, timerRunning, winnerMessage, questionStatus, gameStatus } = room;

  const diff = activeQuestion ? diffLabel(activeQuestion.difficulty) : null;

  // ── Lobby ──
  if (gameStatus === "lobby") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)", padding: "2rem" }}>
        <div style={{ fontSize: "3rem", fontWeight: 900, color: "#f59e0b", marginBottom: "0.5rem", textAlign: "center" }}>وصلة المعرفة</div>
        <div style={{ color: "#475569", marginBottom: "2rem", fontSize: "0.9rem" }}>
          غرفة: <span style={{ color: "#f59e0b", fontWeight: 700, letterSpacing: "0.2em" }}>{roomCode}</span>
        </div>
        <div style={{ background: "#0f1623", border: "1.5px solid #1a2332", borderRadius: "20px", padding: "2.5rem", textAlign: "center", maxWidth: 360, width: "100%" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f0ede8", marginBottom: "0.5rem" }}>في انتظار المضيف...</div>
          <div style={{ color: "#64748b", fontSize: "0.9rem", marginBottom: "1.5rem" }}>سيبدأ المضيف اللعبة قريباً</div>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            {[team1, team2].map((t, i) => (
              <div key={i} style={{ background: "#141e2d", borderRadius: "12px", padding: "0.75rem 1rem", textAlign: "center", minWidth: 90 }}>
                <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.25rem" }}>الفريق {i + 1}</div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: t.color }}>{t.name}</div>
              </div>
            ))}
          </div>
          {playerName && (
            <div style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "#475569" }}>
              مرحباً، <span style={{ color: "#f0ede8", fontWeight: 600 }}>{playerName}</span>!
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)" }}>
      {/* Winner overlay */}
      {winnerMessage && (
        <div className="winner-overlay">
          <div className="winner-card">
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🏆</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: "#f59e0b", fontFamily: "Cairo,sans-serif" }}>
              {winnerMessage}
            </div>
          </div>
        </div>
      )}

      <div className="container" style={{ paddingTop: "1.5rem", paddingBottom: "2rem" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#f59e0b" }}>وصلة المعرفة</div>
          <div style={{ fontSize: "0.75rem", padding: "0.3rem 0.75rem", borderRadius: "9999px", background: "#1a2332", color: "#64748b" }}>
            غرفة: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{roomCode}</span>
          </div>
        </div>

        {/* Scores */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
          {[
            { team: team1, score: team1Score, active: room.activeTeam === 1 },
            { team: team2, score: team2Score, active: room.activeTeam === 2 },
          ].map(({ team, score, active }, idx) => (
            <div key={idx} style={{
              background: active ? `${team.color}18` : "#0f1623",
              border: `2px solid ${active ? team.color : "#1a2332"}`,
              borderRadius: "16px", padding: "1rem", textAlign: "center",
              transition: "all 0.3s ease",
              boxShadow: active ? `0 0 24px ${team.color}33` : "none",
            }}>
              {active && <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "0.25rem" }}>🎯 دوره</div>}
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: team.color, marginBottom: "0.25rem" }}>{team.name}</div>
              <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#f0ede8", lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "0.25rem" }}>نقطة</div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem" }}>
          {/* Timer */}
          {timerRunning && timerMax > 0 && (
            <div style={{ display: "flex", justifyContent: "center" }}>
              <TimerRing value={timerValue} max={timerMax} />
            </div>
          )}

          {/* Time up banner */}
          {questionStatus === "time_up" && (
            <div style={{ textAlign: "center", padding: "0.75rem", borderRadius: "12px", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444", fontWeight: 700, fontSize: "1.1rem" }}>
              ⏰ انتهى الوقت!
            </div>
          )}

          {/* Question card */}
          {activeQuestion ? (
            <div style={{ background: "#0f1623", border: "1.5px solid #1a2332", borderRadius: "20px", padding: "1.5rem" }}>
              {/* Meta */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                {activeQuestion.category && (
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "9999px", background: "#1a2332", color: "#94a3b8", fontWeight: 600 }}>
                    {activeQuestion.category}
                  </span>
                )}
                {diff && (
                  <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "9999px", background: `${diff.color}22`, color: diff.color, fontWeight: 600 }}>
                    {diff.label}
                  </span>
                )}
                <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "9999px", background: "rgba(245,158,11,0.15)", color: "#f59e0b", fontWeight: 600 }}>
                  {activeQuestion.points} نقطة
                </span>
                <span style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: "9999px", background: "#1a2332", color: "#64748b", fontWeight: 700 }}>
                  حرف: {activeQuestion.cellLabel}
                </span>
              </div>

              {/* Question text */}
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f0ede8", lineHeight: 1.7, marginBottom: "1rem", direction: "rtl" }}>
                {activeQuestion.question}
              </div>

              {/* Hint */}
              {hintVisibleToParticipants && activeQuestion.hint && (
                <div style={{ borderRadius: "12px", padding: "0.75rem 1rem", marginBottom: "0.75rem", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f59e0b", marginBottom: "0.25rem" }}>💡 تلميح</div>
                  <div style={{ color: "#f0ede8", fontSize: "0.95rem" }}>{activeQuestion.hint}</div>
                </div>
              )}

              {/* Answer */}
              {answerVisibleToParticipants ? (
                <div style={{ borderRadius: "12px", padding: "1rem 1.25rem", background: "rgba(22,163,74,0.12)", border: "2px solid rgba(22,163,74,0.4)" }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#22c55e", marginBottom: "0.4rem" }}>✅ الإجابة الصحيحة</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#f0ede8" }}>{activeQuestion.answer}</div>
                  {activeQuestion.explanation && (
                    <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.5rem" }}>{activeQuestion.explanation}</div>
                  )}
                </div>
              ) : (
                <div style={{ borderRadius: "12px", padding: "1rem", textAlign: "center", background: "#141e2d", border: "1px dashed #1a2332" }}>
                  <div style={{ color: "#3d5068", fontSize: "0.9rem" }}>🔒 الإجابة مخفية حتى يكشفها المضيف</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: "#0f1623", border: "1.5px solid #1a2332", borderRadius: "20px", padding: "3rem", textAlign: "center" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⏳</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f0ede8", marginBottom: "0.5rem" }}>في انتظار السؤال التالي...</div>
              <div style={{ color: "#64748b", fontSize: "0.9rem" }}>المضيف يختار الحرف القادم</div>
            </div>
          )}

          {/* Board */}
          <div style={{ background: "#0f1623", border: "1.5px solid #1a2332", borderRadius: "20px", padding: "1.25rem" }}>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textAlign: "center", marginBottom: "0.75rem" }}>لوحة اللعب</div>
            <Board board={board} gridSize={gridSize} team1={team1} team2={team2} />
            <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginTop: "0.75rem" }}>
              {[team1, team2].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <div style={{ width: 12, height: 12, borderRadius: "3px", background: t.color }} />
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
