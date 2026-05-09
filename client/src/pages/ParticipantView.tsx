import { useEffect, useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { subscribeToRoom, joinRoom } from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import type { RoomState } from "../lib/store";
import HexBoard from "../components/HexBoard";
import { appearanceGradient, appearanceSurface, readAppearanceMode, readVisualTheme, themeAccent } from "../lib/appearance";

function getParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
}

function diffLabel(d: string) {
  if (d === "easy") return { label: "سهل", color: "#22c55e" };
  if (d === "medium") return { label: "متوسط", color: "#f59e0b" };
  return { label: "صعب", color: "#ef4444" };
}

function TimerRing({ value, max }: { value: number; max: number }) {
  const r = 38, circ = 2 * Math.PI * r;
  const pct = max > 0 ? value / max : 0;
  const offset = circ * (1 - pct);
  const color = value <= 5 ? "#ef4444" : value <= 10 ? "#f59e0b" : "#22c55e";
  return (
    <div style={{ position:"relative", width:100, height:100 }}>
      <svg width={100} height={100} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="#1a2332" strokeWidth={7} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 0.5s linear, stroke 0.3s ease" }} />
      </svg>
      <div style={{
        position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
        fontWeight:900, fontSize:"1.5rem", color, fontFamily:"var(--kc-font-arabic)",
        animation: value<=5&&value>0 ? "timerPulse 0.5s ease-in-out infinite" : "none",
      }}>{value}</div>
      <style>{`@keyframes timerPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

export default function ParticipantView() {
  const [, setLocation] = useLocation();
  const roomCode = getParam("room");
  const playerName = getParam("name");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [firebaseError, setFirebaseError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const mode = readAppearanceMode();
  const visualTheme = readVisualTheme();
  const surface = appearanceSurface(mode);
  const accent = themeAccent[visualTheme];
  const myPlayerId = typeof window !== "undefined" ? localStorage.getItem("kc_player_id") || "" : "";
  const unsubRef = useRef<(() => void) | null>(null);
  const joinedRef = useRef(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(console.error);
      setFullscreen(true);
    } else {
      document.exitFullscreen().catch(console.error);
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    if (!roomCode) { setLocation("/join"); return; }
    if (!isFirebaseConfigured()) { setFirebaseError(true); return; }
    if (playerName && !joinedRef.current) {
      joinedRef.current = true;
      const pid = localStorage.getItem("kc_player_id") || `p_${Date.now()}`;
      localStorage.setItem("kc_player_id", pid);
      joinRoom(roomCode, pid, playerName).catch(console.error);
    }
    try {
      const unsub = subscribeToRoom(roomCode, s => {
        if (s === null) setNotFound(true);
        else { setRoom(s); setNotFound(false); }
      });
      unsubRef.current = unsub;
    } catch (e) { console.error(e); setFirebaseError(true); }
    return () => { unsubRef.current?.(); };
  }, [roomCode, playerName, setLocation]);

  const bg = appearanceGradient(mode, visualTheme);

  if (firebaseError) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:surface.bg, padding:"2rem" }}>
      <div style={{ textAlign:"center", maxWidth:400 }}>
        <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>⚙️</div>
        <div style={{ fontSize:"1.25rem", fontWeight:700, color:accent, marginBottom:"0.5rem" }}>تعذر الاتصال بالخدمة. يرجى المحاولة لاحقًا.</div>
        <div style={{ color:surface.muted, fontSize:"0.9rem", marginBottom:"1.5rem" }}>يرجى مراجعة إعدادات المشروع أو التواصل مع المسؤول.</div>
        <a href="/join" style={{ display:"inline-block", padding:"0.6rem 1.5rem", background:"#f59e0b", color:"#090d18", borderRadius:"10px", fontWeight:700, textDecoration:"none" }}>العودة</a>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:surface.bg, padding:"2rem" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🔍</div>
        <div style={{ fontSize:"1.25rem", fontWeight:700, color:"#ef4444", marginBottom:"0.5rem" }}>الغرفة غير موجودة</div>
        <div style={{ color:surface.muted, marginBottom:"1.5rem" }}>رمز الغرفة غير صحيح أو انتهت صلاحيتها</div>
        <a href="/join" style={{ display:"inline-block", padding:"0.6rem 1.5rem", background:"#f59e0b", color:"#090d18", borderRadius:"10px", fontWeight:700, textDecoration:"none" }}>حاول مجدداً</a>
      </div>
    </div>
  );

  if (!room) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:surface.bg }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:"2.5rem", color:accent, marginBottom:"1rem", animation:"spin 1.5s linear infinite" }}>◌</div>
        <div style={{ color:surface.muted }}>جارٍ الاتصال بالغرفة...</div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  const { team1, team2, team1Score, team2Score, board, gridSize,
    activeQuestion, answerVisibleToParticipants, hintVisibleToParticipants,
    timerValue, timerMax, timerRunning, winnerMessage, winnerTeam,
    questionStatus, gameStatus, roundNumber, selectedCellId, gameTitle, logoText } = room;

  const diff = activeQuestion ? diffLabel(activeQuestion.difficulty) : null;

  // ── Lobby ──
  if (gameStatus === "lobby") {
    const myPlayer = room.players?.[myPlayerId];
    const teamName = myPlayer?.team === 1 ? room.team1.name : myPlayer?.team === 2 ? room.team2.name : null;
    const teamColor = myPlayer?.team === 1 ? room.team1.color : myPlayer?.team === 2 ? room.team2.color : "#64748b";
    const totalParticipants = Object.keys(room.players || {}).length;
    return (
      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:bg, padding:"1.5rem" }}>
        <div style={{ fontSize:"0.72rem", padding:"0.25rem 0.75rem", borderRadius:"9999px", background:surface.card, color:surface.muted, marginBottom:"1.25rem", fontWeight:600 }}>🏷 صفحة المشارك</div>
        <div style={{ fontSize:"clamp(2rem, 6vw, 3rem)", fontWeight:900, color:accent, marginBottom:"0.4rem", textAlign:"center" }}>{gameTitle || "وصلة المعرفة"}</div>
        {logoText && <div style={{ fontSize:"1.05rem", color:surface.muted, marginBottom:"0.5rem" }}>{logoText}</div>}

        <div style={{ background:surface.card, border:`1.5px solid ${surface.border}`, borderRadius:"22px", padding:"1.85rem 1.5rem", textAlign:"center", maxWidth:440, width:"100%", boxShadow:"0 16px 36px rgba(0,0,0,0.45)" }}>
          <div style={{ display:"inline-block", padding:"0.35rem 0.85rem", borderRadius:9999, background:"rgba(34,197,94,0.15)", color:"#22c55e", fontWeight:700, fontSize:"0.78rem", marginBottom:"0.85rem" }}>✅ تم الانضمام بنجاح</div>
          <div style={{ fontSize:"1.45rem", fontWeight:800, color:surface.text, marginBottom:"0.3rem" }}>بانتظار بدء التحدي من المضيف</div>
          <div style={{ color:surface.muted, fontSize:"0.92rem", marginBottom:"1.4rem" }}>استعد، سيبدأ التحدي قريباً.</div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(105px, 1fr))", gap:"0.55rem", marginBottom:"1.2rem" }}>
            <div style={{ background:"#141e2d", borderRadius:"12px", padding:"0.6rem 0.4rem" }}>
              <div style={{ fontSize:"0.68rem", color:surface.muted, marginBottom:"0.25rem" }}>اسمك</div>
              <div style={{ fontWeight:800, color:surface.text, fontSize:"0.95rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{playerName || "—"}</div>
            </div>
            <div style={{ background:"#141e2d", borderRadius:"12px", padding:"0.6rem 0.4rem" }}>
              <div style={{ fontSize:"0.68rem", color:surface.muted, marginBottom:"0.25rem" }}>رمز الغرفة</div>
              <div style={{ fontWeight:900, color:accent, fontSize:"1rem", letterSpacing:"0.18em" }}>{roomCode || "—"}</div>
            </div>
            <div style={{ background:"#141e2d", borderRadius:"12px", padding:"0.6rem 0.4rem" }}>
              <div style={{ fontSize:"0.68rem", color:surface.muted, marginBottom:"0.25rem" }}>الفريق</div>
              <div style={{ fontWeight:800, color: teamName ? teamColor : surface.muted, fontSize:"0.9rem" }}>
                {teamName || "بانتظار التعيين"}
              </div>
            </div>
          </div>

          <div style={{ position:"relative", width:60, height:60, margin:"0 auto 0.85rem", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:`3px solid ${accent}33`, borderTopColor:accent, animation:"spin 1.4s linear infinite" }} />
            <div style={{ fontSize:"1.4rem" }}>⏳</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>

          <div style={{ fontSize:"0.78rem", color:surface.muted }}>
            {totalParticipants > 0 ? `إجمالي المشاركين الحاليين: ${totalParticipants}` : "أنت أول من ينضم — انتظر بقية الفريق"}
          </div>

          <div style={{ marginTop:"1.1rem", padding:"0.7rem 0.85rem", background:"#141e2d", border:"1px solid #1a2332", borderRadius:12, color:"#cbd5e1", fontSize:"0.8rem", lineHeight:1.9, textAlign:"right" }}>
            <div style={{ fontWeight:700, color:accent, marginBottom:"0.25rem" }}>تعليمات سريعة</div>
            <div>• ابقِ هذه الصفحة مفتوحة حتى يبدأ المضيف التحدي.</div>
            <div>• ستظهر اللوحة والأسئلة تلقائياً عند البدء.</div>
            <div>• يمكنك الانضمام إلى فريق إذا لم تكن مُعيَّناً بعد.</div>
          </div>

          <div style={{ display:"flex", gap:"1rem", justifyContent:"center", marginTop:"1.1rem" }}>
            {[team1, team2].map((t, i) => (
              <div key={i} style={{ background:"#0f1623", borderRadius:"12px", padding:"0.55rem 0.85rem", textAlign:"center", minWidth:96, border: myPlayer?.team === i+1 ? `1.5px solid ${t.color}` : "1px solid #1a2332" }}>
                <div style={{ fontSize:"0.68rem", color:surface.muted, marginBottom:"0.2rem" }}>الفريق {i+1}</div>
                <div style={{ fontWeight:700, fontSize:"0.82rem", color:t.color }}>{t.name}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:bg, position:"relative" }}>
      {/* Page badge + fullscreen */}
      <div style={{ position:"fixed", top:"0.75rem", left:"0.75rem", zIndex:50, display:"flex", gap:"0.4rem" }}>
        <div style={{ fontSize:"0.65rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:surface.card, color:surface.muted, fontWeight:600 }}>🏷 شاشة العرض</div>
        <button onClick={toggleFullscreen} style={{ fontSize:"0.65rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:surface.card, color:surface.muted, border:"none", cursor:"pointer", fontFamily:"var(--kc-font-arabic)" }}>
          {fullscreen ? "⊡ خروج" : "⛶ ملء الشاشة"}
        </button>
      </div>

      {/* Winner overlay */}
      {winnerMessage && (
        <div className="winner-overlay">
          <div className="winner-card" style={{ borderColor: winnerTeam===1?team1.color:winnerTeam===2?team2.color:accent }}>
            <div style={{ fontSize:"5rem", marginBottom:"1rem" }}>🏆</div>
            <div style={{ fontSize:"2.5rem", fontWeight:900, color: winnerTeam===1?team1.color:winnerTeam===2?team2.color:accent, fontFamily:"var(--kc-font-arabic)" }}>
              {winnerMessage}
            </div>
          </div>
        </div>
      )}

      <div className="container" style={{ paddingTop:"2rem", paddingBottom:"2rem" }}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:"1rem" }}>
          <div style={{ fontSize:"2rem", fontWeight:900, color:accent }}>{gameTitle || "وصلة المعرفة"}</div>
          {logoText && <div style={{ fontSize:"0.9rem", color:"#94a3b8" }}>{logoText}</div>}
          <div style={{ fontSize:"0.75rem", color:"#475569", marginTop:"0.25rem" }}>
            غرفة: <span style={{ color:accent, fontWeight:700 }}>{roomCode}</span>
            {roundNumber > 1 && <span style={{ marginRight:"0.75rem", color:surface.muted }}>• الجولة {roundNumber}</span>}
          </div>
        </div>

        {/* Scores */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem", marginBottom:"1rem" }}>
          {[
            { team:team1, score:team1Score, active:room.activeTeam===1 },
            { team:team2, score:team2Score, active:room.activeTeam===2 },
          ].map(({ team, score, active }, idx) => (
            <div key={idx} style={{
              background: active?`${team.color}18`:"#0f1623",
              border:`2px solid ${active?team.color:"#1a2332"}`,
              borderRadius:"16px", padding:"0.85rem", textAlign:"center",
              transition:"all 0.3s ease",
              boxShadow: active?`0 0 24px ${team.color}33`:"none",
            }}>
              {active && <div style={{ fontSize:"0.65rem", color:surface.muted, marginBottom:"0.2rem" }}>🎯 دوره</div>}
              <div style={{ fontWeight:700, fontSize:"0.9rem", color:team.color, marginBottom:"0.2rem" }}>{team.name}</div>
              <div style={{ fontSize:"2.5rem", fontWeight:900, color:surface.text, lineHeight:1 }}>{score}</div>
              <div style={{ fontSize:"0.7rem", color:"#475569", marginTop:"0.2rem" }}>نقطة</div>
            </div>
          ))}
        </div>

        {/* Main: board + question */}
        {/* Show participant team if they have a name */}
        {playerName && (() => {
          const myPlayer = room.players?.[myPlayerId];
          const teamName = myPlayer?.team === 1 ? room.team1.name : myPlayer?.team === 2 ? room.team2.name : null;
          const teamColor = myPlayer?.team === 1 ? room.team1.color : myPlayer?.team === 2 ? room.team2.color : "#64748b";
          return (
            <div style={{ textAlign:"center", marginBottom:"0.75rem", fontSize:"0.85rem" }}>
              <span style={{ color:"#94a3b8" }}>مرحبًا، <strong style={{ color:surface.text }}>{playerName}</strong> — </span>
              {teamName
                ? <span style={{ color:teamColor, fontWeight:700 }}>فريقك: {teamName}</span>
                : <span style={{ color:"#475569" }}>لم يتم تعيينك في فريق بعد.</span>}
            </div>
          );
        })()}
        <div className="responsive-spectator-layout" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
          {/* Board */}
          <div style={{ background:surface.card, border:`1.5px solid ${surface.border}`, borderRadius:"20px", padding:"1rem", overflow:"hidden", gridColumn:"1" }}>
            <div style={{ fontSize:"0.78rem", fontWeight:700, color:surface.muted, textAlign:"center", marginBottom:"0.5rem" }}>لوحة الحروف</div>
            {/* Path goal legend */}
            <div style={{ display:"flex", gap:"1rem", justifyContent:"center", marginBottom:"0.5rem", flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.3rem" }}>
                <div style={{ width:14, height:4, background:team1.color, borderRadius:"2px" }} />
                <span style={{ fontSize:"0.65rem", color:surface.muted }}>{team1.name}: يسار←يمين</span>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"0.3rem" }}>
                <div style={{ width:4, height:14, background:team2.color, borderRadius:"2px" }} />
                <span style={{ fontSize:"0.65rem", color:surface.muted }}>{team2.name}: أعلى↓أسفل</span>
              </div>
            </div>
            <HexBoard board={board} gridSize={gridSize} mode="participant"
              selectedCellId={selectedCellId} team1={team1} team2={team2} />
          </div>

          {/* Question + timer */}
          <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
            {/* Timer */}
            <div style={{ textAlign:"center", fontSize:"0.76rem", color:surface.muted, fontWeight:700 }}>المؤقت</div>
            {timerRunning && timerMax > 0 && (
              <div style={{ display:"flex", justifyContent:"center" }}>
                <TimerRing value={timerValue} max={timerMax} />
              </div>
            )}
            {questionStatus === "time_up" && (
              <div style={{ textAlign:"center", padding:"0.65rem", borderRadius:"12px", background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.3)", color:"#ef4444", fontWeight:700 }}>
                ⏰ انتهى الوقت!
              </div>
            )}
            <div style={{ textAlign:"center", fontSize:"0.76rem", color:surface.muted, fontWeight:700 }}>
              الدور الحالي: {room.activeTeam === 1 ? team1.name : team2.name}
            </div>

            {/* Question card */}
            {activeQuestion ? (
              <div style={{ background:surface.card, border:`1.5px solid ${surface.border}`, borderRadius:"20px", padding:"1.25rem", flex:1 }}>
                <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                  {activeQuestion.cellLabel && (
                    <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:"rgba(245,158,11,0.15)", color:accent, fontWeight:700 }}>
                      الحرف: {activeQuestion.cellLabel}
                    </span>
                  )}
                  {activeQuestion.category && (
                    <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:surface.card, color:"#94a3b8" }}>
                      {activeQuestion.category}
                    </span>
                  )}
                  {diff && (
                    <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:`${diff.color}22`, color:diff.color, fontWeight:600 }}>
                      {diff.label}
                    </span>
                  )}
                  <span style={{ fontSize:"0.72rem", padding:"0.2rem 0.55rem", borderRadius:"9999px", background:"rgba(245,158,11,0.15)", color:accent }}>
                    {activeQuestion.points} نقطة
                  </span>
                </div>

                <div style={{ fontSize:"clamp(2rem, 4.8vw, 3.1rem)", fontWeight:900, color:surface.text, lineHeight:1.45, marginBottom:"0.85rem", direction:"rtl" }}>
                  {activeQuestion.question}
                </div>

                {(activeQuestion as any).type === "mcq" && Array.isArray((activeQuestion as any).choices) && (activeQuestion as any).choices.length > 0 && (
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:"0.45rem", marginBottom:"0.8rem" }}>
                    {((activeQuestion as any).choices as string[]).map((c, i) => {
                      const isCorrect = answerVisibleToParticipants && c === activeQuestion.answer;
                      return (
                        <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.4rem", padding:"0.55rem 0.7rem", borderRadius:12, background: isCorrect ? "rgba(34,197,94,0.15)" : "#141e2d", border: `1.5px solid ${isCorrect ? "rgba(34,197,94,0.45)" : "#1a2332"}`, color: isCorrect ? "#22c55e" : surface.text, fontWeight:700, fontSize:"1rem" }}>
                          <span style={{ fontSize:"0.78rem", color:isCorrect ? "#22c55e" : surface.muted, fontWeight:700, minWidth:18 }}>{(["أ","ب","ج","د","هـ","و"][i] || String(i + 1))}.</span>
                          <span style={{ flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis" }}>{c}</span>
                          {isCorrect && <span>✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {(activeQuestion as any).type === "tf" && (
                  <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.8rem" }}>
                    {["صحيح","خطأ"].map((c) => {
                      const isCorrect = answerVisibleToParticipants && c === activeQuestion.answer;
                      return (
                        <div key={c} style={{ flex:1, textAlign:"center", padding:"0.65rem", borderRadius:12, background: isCorrect ? "rgba(34,197,94,0.15)" : "#141e2d", border: `1.5px solid ${isCorrect ? "rgba(34,197,94,0.45)" : "#1a2332"}`, color: isCorrect ? "#22c55e" : surface.text, fontWeight:800, fontSize:"1.05rem" }}>
                          {c}{isCorrect ? " ✓" : ""}
                        </div>
                      );
                    })}
                  </div>
                )}

                {hintVisibleToParticipants && activeQuestion.hint && (
                  <div style={{ borderRadius:"12px", padding:"0.65rem 0.85rem", marginBottom:"0.75rem", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)" }}>
                    <div style={{ fontSize:"0.72rem", fontWeight:700, color:accent, marginBottom:"0.2rem" }}>💡 تلميح</div>
                    <div style={{ color:surface.text, fontSize:"0.9rem" }}>{activeQuestion.hint}</div>
                  </div>
                )}

                {answerVisibleToParticipants ? (
                  <div style={{ borderRadius:"12px", padding:"0.85rem 1rem", background:"rgba(22,163,74,0.12)", border:"2px solid rgba(22,163,74,0.4)" }}>
                    <div style={{ fontSize:"0.72rem", fontWeight:700, color:"#22c55e", marginBottom:"0.3rem" }}>✅ الإجابة الصحيحة</div>
                    <div style={{ fontSize:"clamp(1.7rem, 4vw, 2.6rem)", fontWeight:900, color:surface.text }}>{activeQuestion.answer}</div>
                    {activeQuestion.explanation && (
                      <div style={{ fontSize:"0.82rem", color:"#94a3b8", marginTop:"0.4rem" }}>{activeQuestion.explanation}</div>
                    )}
                  </div>
                ) : (
                  <div style={{ borderRadius:"12px", padding:"0.85rem", textAlign:"center", background:"#141e2d", border:"1px dashed #1a2332" }}>
                    <div style={{ color:"#3d5068", fontSize:"0.9rem" }}>🔒 الإجابة مخفية حتى يكشفها المضيف</div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ background:surface.card, border:`1.5px solid ${surface.border}`, borderRadius:"20px", padding:"3rem", textAlign:"center", flex:1 }}>
                <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>⏳</div>
                <div style={{ fontSize:"1.1rem", fontWeight:700, color:surface.text, marginBottom:"0.5rem" }}>بانتظار اختيار الحرف</div>
                <div style={{ color:surface.muted, fontSize:"0.9rem" }}>سيعرض المضيف السؤال الحالي بعد اختيار الحرف.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
