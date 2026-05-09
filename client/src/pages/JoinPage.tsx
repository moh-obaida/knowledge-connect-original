import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { joinRoom } from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import { showToast } from "../components/KcToast";
import { t } from "../lib/i18n";
import { useLanguage } from "../hooks/useLanguage";

function getParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
}

export default function JoinPage() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Auto-fill room code from URL ?room=XXXXXX
  useEffect(() => {
    const codeFromUrl = getParam("room");
    if (codeFromUrl) setRoomCode(codeFromUrl.replace(/\D/g, "").slice(0, 6));
    const savedName = typeof window !== "undefined" ? localStorage.getItem("kc_player_name") : "";
    if (savedName) setPlayerName(savedName);
  }, []);

  const handleJoin = async () => {
    const code = roomCode.trim();
    const name = playerName.trim();
    setError("");
    if (!code) { setError(t("join.enterRoomCode")); showToast.error(t("join.enterRoomCode")); return; }
    if (code.length !== 6) { setError(t("join.roomCode6")); showToast.error(t("join.roomCode6")); return; }
    if (!name) { setError(t("join.enterName")); showToast.error(t("join.enterName")); return; }
    if (!isFirebaseConfigured()) { setError(t("join.serviceUnavailable")); showToast.error(t("join.serviceRetry")); return; }
    setLoading(true);
    try {
      const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const joined = await joinRoom(code, playerId, name);
      if (!joined) { setError(t("join.roomNotFound")); showToast.error(t("join.connectRoomFailed")); setLoading(false); return; }
      localStorage.setItem("kc_player_id", playerId);
      localStorage.setItem("kc_player_name", name);
      setLocation(`/participant?room=${code}&name=${encodeURIComponent(name)}`);
    } catch (e) {
      console.error(e);
      setError(t("join.joinError"));
      showToast.error(t("join.joinError"));
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
      background: "linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)",
    }}>
      {/* Page identity badge */}
      <div style={{ fontSize:"0.72rem", padding:"0.25rem 0.75rem", borderRadius:"9999px", background:"#1a2332", color:"#cbd5e1", marginBottom:"1.25rem", fontWeight:600 }}>
        🏷 {t("join.joinChallenge")}
      </div>

      {/* Logo */}
      <div style={{ marginBottom:"1.5rem", textAlign:"center" }}>
        <div style={{ fontSize:"clamp(2.4rem, 8vw, 3.5rem)", fontWeight:900, color:"#f59e0b", fontFamily:"var(--kc-font-arabic)", lineHeight:1.1 }}>
          وصلة المعرفة
        </div>
        <div style={{ fontSize:"1rem", fontWeight:700, color:"#cbd5e1", marginTop:"0.5rem" }}>
          {t("join.joinChallenge")}
        </div>
        <div style={{ fontSize:"0.85rem", color:"#94a3b8", marginTop:"0.3rem" }}>
          {t("join.subtitle")}
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "#0f1623",
        border: "1.5px solid #1a2332",
        borderRadius: "20px",
        padding: "2rem",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
      }}>
        <h2 style={{ fontWeight:800, fontSize:"1.2rem", color:"#f0ede8", textAlign:"center", marginBottom:"1.5rem" }}>
          {t("join.joinRoom")}
        </h2>

        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          {/* Room code */}
          <div>
            <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#94a3b8", marginBottom:"0.4rem" }}>
              {t("hostHeader.roomCode")}
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder={t("join.sixDigits")}
              style={{
                width:"100%", background:"#141e2d", border:"2px solid #1a2332",
                borderRadius:"12px", padding:"0.75rem 1rem",
                textAlign:"center", fontSize:"1.8rem", fontWeight:900,
                letterSpacing:"0.3em", color:"#f59e0b", outline:"none",
                fontFamily:"var(--kc-font-arabic)", transition:"border-color 0.15s ease",
              }}
              onFocus={e => (e.currentTarget.style.borderColor="#f59e0b")}
              onBlur={e => (e.currentTarget.style.borderColor="#1a2332")}
            />
          </div>

          {/* Player name */}
          <div>
            <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#94a3b8", marginBottom:"0.4rem" }}>
              {t("join.yourName")}
            </label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder={t("join.enterYourName")}
              style={{
                width:"100%", background:"#141e2d", border:"2px solid #1a2332",
                borderRadius:"12px", padding:"0.75rem 1rem",
                fontSize:"1rem", color:"#f0ede8", outline:"none",
                fontFamily:"var(--kc-font-arabic)", transition:"border-color 0.15s ease",
              }}
              onFocus={e => (e.currentTarget.style.borderColor="#f59e0b")}
              onBlur={e => (e.currentTarget.style.borderColor="#1a2332")}
            />
          </div>

          {/* Inline error */}
          {error && (
            <div role="alert" style={{ background:"rgba(239,68,68,0.1)", border:"1.5px solid rgba(239,68,68,0.35)", color:"#fca5a5", borderRadius:"10px", padding:"0.55rem 0.75rem", fontSize:"0.85rem" }}>
              {error}
            </div>
          )}

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={loading}
            style={{
              width:"100%", padding:"0.85rem", borderRadius:"12px",
              fontSize:"1.05rem", fontWeight:800,
              background: loading ? "#92400e" : "#f59e0b",
              color:"#090d18", border:"none",
              opacity: loading ? 0.7 : 1,
              transition:"all 0.15s ease",
              fontFamily:"var(--kc-font-arabic)",
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform="translateY(0)"; }}
          >
            {loading ? t("join.joining") : t("join.joinChallenge")}
          </button>
        </div>

        <p style={{ textAlign:"center", fontSize:"0.78rem", color:"#475569", marginTop:"1rem" }}>
          {t("join.askHostCode")}
        </p>
      </div>

      {/* How to join card */}
      <div style={{
        width:"100%", maxWidth: 380, marginTop:"1rem",
        background:"#0f1623", border:"1px solid #1a2332",
        borderRadius:"16px", padding:"1rem 1.1rem",
      }}>
        <div style={{ fontWeight:700, color:"#f59e0b", fontSize:"0.82rem", marginBottom:"0.4rem" }}>{t("join.howToJoin")}</div>
        <ol style={{ listStyle:"decimal", color:"#cbd5e1", fontSize:"0.84rem", lineHeight:1.95, paddingInlineStart:"1.2rem" }}>
          <li>{t("join.step1")}</li>
          <li>{t("join.step2")}</li>
          <li>{t("join.step3")}</li>
        </ol>
      </div>

      {/* Host link */}
      <div style={{ marginTop:"1.4rem", textAlign:"center" }}>
        <a href="/" style={{ fontSize:"0.85rem", color:"#94a3b8", textDecoration:"none" }}>
          {t("join.areYouHost")}{" "}
          <span style={{ color:"#f59e0b", fontWeight:700 }}>{t("join.backDashboard")}</span>
        </a>
      </div>
    </div>
  );
}
