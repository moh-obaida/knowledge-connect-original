import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { joinRoom } from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import { showToast } from "../components/KcToast";

function getParam(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) || "";
}

export default function JoinPage() {
  const [, setLocation] = useLocation();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-fill room code from URL ?room=XXXXXX
  useEffect(() => {
    const codeFromUrl = getParam("room");
    if (codeFromUrl) setRoomCode(codeFromUrl);
  }, []);

  const handleJoin = async () => {
    const code = roomCode.trim();
    const name = playerName.trim();
    if (!code || code.length !== 6) { showToast.error("Invalid file format."); return; }
    if (!name) { showToast.error("Please enter a player name."); return; }
    if (!isFirebaseConfigured()) { showToast.error("تعذر الاتصال بالخدمة. يرجى المحاولة لاحقًا. راجع ملف التعليمات أو تواصل مع المسؤول"); return; }
    setLoading(true);
    try {
      const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const joined = await joinRoom(code, playerId, name);
      if (!joined) { showToast.error("تعذر الاتصال بالغرفة. تحقق من الرمز وحاول مرة أخرى."); setLoading(false); return; }
      localStorage.setItem("kc_player_id", playerId);
      localStorage.setItem("kc_player_name", name);
      setLocation(`/participant?room=${code}&name=${encodeURIComponent(name)}`);
    } catch (e) {
      console.error(e);
      showToast.error("حدث خطأ أثناء الانضمام — تحقق من الاتصال بالإنترنت");
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
      <div style={{ fontSize:"0.72rem", padding:"0.25rem 0.75rem", borderRadius:"9999px", background:"#1a2332", color:"#64748b", marginBottom:"1.5rem", fontWeight:600 }}>
        🏷 الانضمام إلى التحدي
      </div>

      {/* Logo */}
      <div style={{ marginBottom:"2rem", textAlign:"center" }}>
        <div style={{ fontSize:"3.5rem", fontWeight:900, color:"#f59e0b", fontFamily:"Cairo,sans-serif", lineHeight:1.1 }}>
          وصلة المعرفة
        </div>
        <div style={{ fontSize:"0.9rem", color:"#475569", marginTop:"0.4rem" }}>
          أهلًا بك في وصلة المعرفة — انضم بسرعة وابدأ التحدي
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
          الانضمام إلى الغرفة
        </h2>

        <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>
          {/* Room code */}
          <div>
            <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#94a3b8", marginBottom:"0.4rem" }}>
              رمز الغرفة
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder="٦ أرقام"
              style={{
                width:"100%", background:"#141e2d", border:"2px solid #1a2332",
                borderRadius:"12px", padding:"0.75rem 1rem",
                textAlign:"center", fontSize:"1.8rem", fontWeight:900,
                letterSpacing:"0.3em", color:"#f59e0b", outline:"none",
                fontFamily:"Cairo,sans-serif", transition:"border-color 0.15s ease",
              }}
              onFocus={e => (e.currentTarget.style.borderColor="#f59e0b")}
              onBlur={e => (e.currentTarget.style.borderColor="#1a2332")}
            />
          </div>

          {/* Player name */}
          <div>
            <label style={{ display:"block", fontSize:"0.82rem", fontWeight:600, color:"#94a3b8", marginBottom:"0.4rem" }}>
              اسمك
            </label>
            <input
              type="text"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleJoin()}
              placeholder="أدخل اسمك"
              style={{
                width:"100%", background:"#141e2d", border:"2px solid #1a2332",
                borderRadius:"12px", padding:"0.75rem 1rem",
                fontSize:"1rem", color:"#f0ede8", outline:"none",
                fontFamily:"Cairo,sans-serif", transition:"border-color 0.15s ease",
              }}
              onFocus={e => (e.currentTarget.style.borderColor="#f59e0b")}
              onBlur={e => (e.currentTarget.style.borderColor="#1a2332")}
            />
          </div>

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
              fontFamily:"Cairo,sans-serif",
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform="translateY(0)"; }}
          >
            {loading ? "Joining..." : "Student Join"}
          </button>
        </div>

        <p style={{ textAlign:"center", fontSize:"0.78rem", color:"#475569", marginTop:"1.25rem" }}>
          اطلب رمز الانضمام من المضيف ثم أدخله هنا
        </p>
      </div>

      {/* Host link */}
      <div style={{ marginTop:"2rem", textAlign:"center" }}>
        <a href="/" style={{ fontSize:"0.85rem", color:"#475569", textDecoration:"none" }}>
          Are you the host?{" "}
          <span style={{ color:"#f59e0b", fontWeight:700 }}>Back to Dashboard</span>
        </a>
      </div>
    </div>
  );
}
