import { useState } from "react";
import { useLocation } from "wouter";
import { joinRoom } from "../lib/roomOps";
import { isFirebaseConfigured } from "../lib/firebase";
import { showToast } from "../components/KcToast";

export default function JoinPage() {
  const [, setLocation] = useLocation();
  const [roomCode, setRoomCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    const code = roomCode.trim();
    const name = playerName.trim();
    if (!code || code.length !== 6) {
      showToast.error("أدخل رمز الغرفة المكوّن من 6 أرقام");
      return;
    }
    if (!name) {
      showToast.error("أدخل اسمك للانضمام");
      return;
    }
    if (!isFirebaseConfigured()) {
      showToast.error("Firebase غير مُهيَّأ — راجع README لإضافة إعدادات Firebase");
      return;
    }
    setLoading(true);
    try {
      const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const joined = await joinRoom(code, playerId, name);
      if (!joined) {
        showToast.error("رمز الغرفة غير صحيح أو الغرفة غير موجودة");
        setLoading(false);
        return;
      }
      localStorage.setItem("kc_player_id", playerId);
      localStorage.setItem("kc_player_name", name);
      setLocation(`/participant?room=${code}`);
    } catch (e) {
      console.error(e);
      showToast.error("حدث خطأ أثناء الانضمام — تحقق من الاتصال بالإنترنت");
    }
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: "linear-gradient(160deg,#0a0e1a 0%,#0f172a 60%,#0a0e1a 100%)" }}
    >
      {/* Logo */}
      <div className="mb-10 text-center select-none">
        <div
          className="text-5xl font-black mb-2"
          style={{ color: "#f59e0b", fontFamily: "Cairo,sans-serif", letterSpacing: "-0.01em" }}
        >
          وصلة المعرفة
        </div>
        <div className="text-sm font-medium" style={{ color: "#475569" }}>
          لعبة المسابقة التفاعلية للفصل الدراسي
        </div>
      </div>

      {/* Card */}
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "#111827",
          border: "1px solid #1e2a3a",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        }}
      >
        <h2 className="text-xl font-bold text-center mb-6" style={{ color: "#f0ede8" }}>
          انضم إلى الغرفة
        </h2>

        <div className="space-y-4">
          {/* Room code input */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "#94a3b8" }}>
              رمز الغرفة
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="٦ أرقام"
              className="w-full rounded-xl px-4 py-3 text-center text-2xl font-black tracking-[0.3em] transition-all"
              style={{
                background: "#1a2332",
                border: "2px solid #1e2a3a",
                color: "#f59e0b",
                outline: "none",
                fontFamily: "Cairo,sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1e2a3a")}
            />
          </div>

          {/* Player name input */}
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "#94a3b8" }}>
              اسمك
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="أدخل اسمك"
              className="w-full rounded-xl px-4 py-3 text-lg transition-all"
              style={{
                background: "#1a2332",
                border: "2px solid #1e2a3a",
                color: "#f0ede8",
                outline: "none",
                fontFamily: "Cairo,sans-serif",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#1e2a3a")}
            />
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={loading}
            className="w-full rounded-xl py-3 text-lg font-bold transition-all duration-150 mt-2"
            style={{
              background: loading ? "#92400e" : "#f59e0b",
              color: "#0a0e1a",
              border: "none",
              opacity: loading ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            }}
          >
            {loading ? "جارٍ الانضمام..." : "انضم الآن 🎯"}
          </button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "#475569" }}>
          احصل على رمز الغرفة من المضيف
        </p>
      </div>

      {/* Host link */}
      <div className="mt-8 text-center">
        <a href="/" className="text-sm transition-colors" style={{ color: "#475569" }}>
          هل أنت المضيف؟{" "}
          <span style={{ color: "#f59e0b" }} className="font-semibold">
            افتح لوحة التحكم
          </span>
        </a>
      </div>
    </div>
  );
}
