import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { subscribeToRoom } from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import { findWinningPath, type RoomState } from "../lib/store";
import QRCode from "../components/QRCode";
import HexBoard from "../components/HexBoard";
import { t as tr } from "../lib/i18n";
import { useLanguage } from "../hooks/useLanguage";
import { normalizeTfCanonical } from "../lib/questionTypes";

function getParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
}

export default function DisplayMode() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const roomCode = getParam("room");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!roomCode) { setLocation("/host"); return; }
    if (!isFirebaseConfigured()) return;
    try {
      const unsub = subscribeToRoom(roomCode, (s) => {
        if (s === null) setNotFound(true);
        else { setRoom(s); setNotFound(false); }
      });
      unsubRef.current = unsub;
    } catch (e) { console.error(e); }
    return () => { unsubRef.current?.(); };
  }, [roomCode, setLocation]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const joinLink = `${origin}/join?room=${roomCode}`;
  const participants = room ? Object.values(room.players || {}).length : 0;
  const isPlaying = room?.gameStatus === "active" && !room.winnerMessage;
  const isFinished = room?.gameStatus === "finished" || !!room?.winnerMessage;
  const winningPath = room && room.winnerTeam
    ? findWinningPath(room.board, room.gridSize, room.winnerTeam as 1 | 2)
    : [];

  if (notFound) {
    return (
      <div style={pageBg}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔍</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#ef4444", marginBottom: "0.5rem" }}>{tr("display.roomNotFound", language)}</div>
          <div style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>{tr("display.checkRoomCode", language)}</div>
          <a href="/host" style={linkBack}>{tr("display.backToHost", language)}</a>
        </div>
      </div>
    );
  }

  return (
    <div style={pageBg}>
      <div style={{ position: "fixed", top: "0.75rem", insetInlineStart: "0.75rem", zIndex: 50 }}>
        <a href="/host" style={{ ...linkBack, fontSize: "0.78rem", padding: "0.4rem 0.8rem" }}>{tr("display.backToHost", language)}</a>
      </div>

      <div style={{ width: "100%", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.25rem", padding: "1.75rem 1rem" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "clamp(1.8rem, 4.5vw, 3rem)", fontWeight: 900, color: "#f59e0b", lineHeight: 1.1 }}>
            {tr("hostHeader.title", language)}
          </div>
          {room?.gameTitle && room.gameTitle !== tr("hostHeader.title", language) && (
            <div style={{ fontSize: "1.05rem", color: "#cbd5e1", marginTop: "0.4rem" }}>{room.gameTitle}</div>
          )}
        </div>

        {(isPlaying || isFinished) && room ? (
          <>
            {/* Big team scores */}
            <div className="kc-card" style={{ width: "100%", maxWidth: 1000, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", padding: "1rem" }}>
              {[{ team: room.team1, score: room.team1Score, active: room.activeTeam === 1 && isPlaying },
                { team: room.team2, score: room.team2Score, active: room.activeTeam === 2 && isPlaying }].map((t, i) => (
                <div key={i} style={{
                  background: t.active ? `${t.team.color}1a` : "#141e2d",
                  border: `2.5px solid ${t.active ? t.team.color : "#1a2332"}`,
                  borderRadius: 16, padding: "0.85rem 1rem", textAlign: "center",
                  boxShadow: t.active ? `0 0 32px ${t.team.color}55` : "none",
                  transition: "all 0.3s ease",
                }}>
                  {t.active && <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.2rem" }}>🎯 {tr("display.turn", language)}</div>}
                  <div style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.6rem)", fontWeight: 800, color: t.team.color }}>{t.team.name}</div>
                  <div style={{ fontSize: "clamp(2.5rem, 6vw, 4.5rem)", fontWeight: 900, color: "#f0ede8", lineHeight: 1 }}>{t.score}</div>
                  <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{tr("display.points", language)}</div>
                </div>
              ))}
            </div>

            {/* Board + question grid */}
            <div style={{ width: "100%", maxWidth: 1000, display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr)", gap: "1rem" }} className="responsive-spectator-layout">
              <div className="kc-card" style={{ padding: "0.85rem" }}>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "center", marginBottom: "0.4rem", fontWeight: 700 }}>{tr("display.board", language)}</div>
                <HexBoard
                  board={room.board}
                  gridSize={room.gridSize}
                  mode="participant"
                  selectedCellId={room.selectedCellId}
                  team1={room.team1}
                  team2={room.team2}
                  winnerTeam={room.winnerTeam}
                  winningPathIds={winningPath}
                  questionBankByLetter={room.questionBankByLetter}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {room.timerRunning && room.timerMax > 0 && (
                  <div className="kc-card" style={{ textAlign: "center", padding: "0.6rem" }}>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{tr("display.timer", language)}</div>
                    <div style={{ fontSize: "clamp(2.5rem, 6vw, 3.5rem)", fontWeight: 900, color: room.timerValue <= 5 ? "#ef4444" : room.timerValue <= 10 ? "#f59e0b" : "#22c55e", lineHeight: 1 }}>
                      {room.timerValue}
                    </div>
                  </div>
                )}
                {room.activeQuestion ? (
                  <div className="kc-card" style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.78rem", color: "#94a3b8", marginBottom: "0.35rem", fontWeight: 700 }}>
                      {tr("display.letter", language)}: <span style={{ color: "#f59e0b" }}>{room.activeQuestion.cellLabel}</span>
                      {room.activeQuestion.category && <> • <span style={{ color: "#cbd5e1" }}>{room.activeQuestion.category}</span></>}
                    </div>
                    <div style={{ fontSize: "clamp(1.1rem, 2.5vw, 1.5rem)", fontWeight: 700, color: "#f0ede8", lineHeight: 1.6, direction: "rtl" }}>
                      {room.activeQuestion.question}
                    </div>
                    {room.activeQuestion.type === "mcq" && Array.isArray(room.activeQuestion.choices) && room.activeQuestion.choices.length > 0 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.4rem", marginTop: "0.7rem" }}>
                        {room.activeQuestion.choices.map((c, i) => {
                          const isCorrect = room.answerVisibleToParticipants && c === room.activeQuestion!.answer;
                          return (
                            <div key={i} style={{ padding: "0.5rem 0.6rem", borderRadius: 10, background: isCorrect ? "rgba(34,197,94,0.18)" : "#141e2d", border: `1.5px solid ${isCorrect ? "rgba(34,197,94,0.5)" : "#1a2332"}`, color: isCorrect ? "#22c55e" : "#cbd5e1", fontWeight: 700 }}>
                              {(["أ","ب","ج","د","هـ","و"][i] || String(i + 1))}. {c}{isCorrect ? " ✓" : ""}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {room.activeQuestion.type === "tf" && (() => {
                      const tfCanon = normalizeTfCanonical(room.activeQuestion.answer);
                      return (
                      <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.7rem" }}>
                        {(["صح", "خطأ"] as const).map((canon) => {
                          const label = canon === "صح" ? tr("display.true", language) : tr("display.false", language);
                          const isCorrect = room.answerVisibleToParticipants && tfCanon !== null && canon === tfCanon;
                          return (
                            <div key={canon} style={{ flex: 1, textAlign: "center", padding: "0.55rem", borderRadius: 10, background: isCorrect ? "rgba(34,197,94,0.18)" : "#141e2d", border: `1.5px solid ${isCorrect ? "rgba(34,197,94,0.5)" : "#1a2332"}`, color: isCorrect ? "#22c55e" : "#cbd5e1", fontWeight: 800 }}>
                              {label}{isCorrect ? " ✓" : ""}
                            </div>
                          );
                        })}
                      </div>
                      );
                    })()}
                    {room.answerVisibleToParticipants && (
                      <div style={{ marginTop: "0.7rem", padding: "0.6rem 0.85rem", borderRadius: 10, background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.4)" }}>
                        <div style={{ fontSize: "0.74rem", color: "#22c55e", fontWeight: 700, marginBottom: "0.2rem" }}>{tr("display.correctAnswer", language)}</div>
                        <div style={{ color: "#f0ede8", fontWeight: 700, fontSize: "1.05rem" }}>
                          {room.activeQuestion.type === "tf"
                            ? (normalizeTfCanonical(room.activeQuestion.answer) ?? room.activeQuestion.answer)
                            : room.activeQuestion.answer}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="kc-card" style={{ textAlign: "center", padding: "1.5rem", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: "0.4rem" }}>⏳</div>
                    <div style={{ fontWeight: 700, color: "#cbd5e1" }}>{tr("display.waitingNext", language)}</div>
                  </div>
                )}
              </div>
            </div>

            {isFinished && room.winnerMessage && (
              <div className="kc-card" style={{ width: "100%", maxWidth: 1000, textAlign: "center", padding: "1.25rem", border: `2.5px solid ${room.winnerTeam === 1 ? room.team1.color : room.winnerTeam === 2 ? room.team2.color : "#f59e0b"}` }}>
                <div style={{ fontSize: "3rem" }}>🏆</div>
                <div style={{ fontSize: "clamp(1.5rem, 4vw, 2.5rem)", fontWeight: 900, color: room.winnerTeam === 1 ? room.team1.color : room.winnerTeam === 2 ? room.team2.color : "#f59e0b" }}>
                  {room.winnerMessage}
                </div>
              </div>
            )}

            <div className="kc-card" style={{ width: "100%", maxWidth: 1000, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.7rem", padding: "0.6rem 0.85rem" }}>
              <div style={{ display: "flex", gap: "0.7rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{tr("display.roomCode", language)}:</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "#f59e0b", letterSpacing: "0.18em" }}>{roomCode}</span>
                <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{tr("display.participants", language)}:</span>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#f0ede8" }}>{participants}</span>
              </div>
              <div style={{ background: "#fff", padding: 4, borderRadius: 8 }}>
                <QRCode value={joinLink} size={64} margin={1} ariaLabel={`رمز QR للانضمام ${roomCode}`} />
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Lobby / waiting display */}
            <div style={{ fontSize: "0.95rem", color: "#94a3b8", marginTop: "-0.6rem" }}>{tr("display.classroomMode", language)}</div>
            <div className="kc-card" style={{ width: "100%", maxWidth: 760, display: "grid", gridTemplateColumns: "minmax(260px, 1fr) minmax(260px, 1fr)", gap: "1.5rem", alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.95rem", color: "#94a3b8", marginBottom: "0.5rem" }}>رمز الغرفة</div>
                <div style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)", fontWeight: 900, color: "#f59e0b", letterSpacing: "0.22em", fontVariantNumeric: "tabular-nums" }}>
                  {roomCode}
                </div>
                <div style={{ fontSize: "0.95rem", color: "#cbd5e1", marginTop: "0.5rem" }}>{tr("display.participants", language)}: <strong style={{ color: "#f0ede8" }}>{participants}</strong></div>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <div style={{ background: "#fff", padding: "0.6rem", borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
                  <QRCode value={joinLink} size={240} margin={1} ariaLabel={`رمز QR للانضمام إلى الغرفة ${roomCode}`} />
                </div>
              </div>
            </div>

            <div className="kc-card" style={{ width: "100%", maxWidth: 760 }}>
              <div className="section-title">{tr("display.howToJoin", language)}</div>
              <ol style={{ listStyle: "decimal", color: "#cbd5e1", fontSize: "1rem", lineHeight: 2.1, paddingInlineStart: "1.4rem" }}>
                <li>{tr("display.step1", language)}</li>
                <li>{tr("display.step2", language)} <strong style={{ color: "#f59e0b" }}>{roomCode}</strong></li>
                <li>{tr("display.step3", language)}</li>
                <li>{tr("display.step4", language)}</li>
              </ol>
              <div style={{ marginTop: "0.85rem", padding: "0.6rem 0.85rem", background: "#141e2d", border: "1px solid #1a2332", borderRadius: 10, color: "#94a3b8", fontSize: "0.85rem", direction: "ltr", textAlign: "center", wordBreak: "break-all" }}>
                {joinLink}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const pageBg: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #15243a 0%, #090d18 60%)",
  padding: "1rem",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
};

const linkBack: React.CSSProperties = {
  display: "inline-block",
  padding: "0.5rem 1rem",
  background: "#141e2d",
  border: "1px solid #1a2332",
  borderRadius: 10,
  color: "#cbd5e1",
  fontWeight: 600,
  textDecoration: "none",
  fontFamily: "var(--kc-font-arabic)",
};
