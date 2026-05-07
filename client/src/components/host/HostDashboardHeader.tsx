import type { RoomState } from "../../lib/store";

type Props = {
  room: RoomState;
  roomCode: string;
  hostProfile: { hostName?: string; className?: string; orgName?: string };
  appearanceMode: "light"|"balanced"|"dark";
  setAppearanceMode: (m: "light"|"balanced"|"dark") => void;
  visualTheme: string;
  setVisualTheme: (t: string) => void;
  startGame: () => void;
  resetGame: () => void;
  onLogout: () => void;
  copyText: (text: string, label: string) => void;
  joinLink: string;
  displayLink: string;
};

export default function HostDashboardHeader(p: Props) {
  const { room, roomCode, hostProfile } = p;
  return (
    <div style={{ background:"#0f1623", borderBottom:"1.5px solid #1a2332", padding:"0.75rem 1.25rem" }}>
      <div style={{ maxWidth:1400, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem", marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
            <div style={{ fontWeight:900, fontSize:"1.3rem", color:"#f59e0b" }}>وصلة المعرفة</div>
            <span style={{ fontSize:"0.8rem", color:"#cbd5e1" }}>لوحة التحكم</span>
            {hostProfile.hostName && <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>مرحباً، {hostProfile.hostName}</span>}
            {hostProfile.className && <span style={{ fontSize:"0.72rem", color:"#64748b" }}>الصف/الفعالية: {hostProfile.className}</span>}
            {hostProfile.orgName && <span style={{ fontSize:"0.72rem", color:"#64748b" }}>الجهة: {hostProfile.orgName}</span>}
            <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
              <span style={{ fontSize:"0.75rem", color:"#64748b" }}>رمز الغرفة:</span>
              <span style={{ fontWeight:900, fontSize:"1.2rem", color:"#f0ede8", letterSpacing:"0.15em", background:"#1a2332", padding:"0.2rem 0.75rem", borderRadius:"8px", cursor:"pointer" }} onClick={()=>p.copyText(roomCode, "رمز الغرفة")} title="انقر للنسخ">{roomCode}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            <select className="kc-input" style={{ fontSize:"0.75rem", maxWidth:120 }} value={p.appearanceMode} onChange={e=>p.setAppearanceMode(e.target.value as any)}><option value="light">فاتح</option><option value="balanced">متوازن</option><option value="dark">داكن</option></select>
            <select className="kc-input" style={{ fontSize:"0.75rem", maxWidth:120 }} value={p.visualTheme} onChange={e=>p.setVisualTheme(e.target.value)}><option value="classic">كلاسيكي</option><option value="school">مدرسي</option><option value="space">فضاء</option><option value="ramadan">رمضان</option><option value="science">علوم</option><option value="vivid">ألوان زاهية</option></select>
            {room.gameStatus==="lobby" && <button className="btn-gold" style={{ fontSize:"0.8rem" }} onClick={p.startGame}>▶ بدء اللعبة</button>}
            <button className="btn-danger" style={{ fontSize:"0.8rem" }} onClick={p.resetGame}>↺ إعادة الضبط</button>
            <button className="btn-secondary" style={{ fontSize:"0.8rem" }} onClick={p.onLogout}>الخروج</button>
          </div>
        </div>
        <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
          <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>p.copyText(p.joinLink,"رابط الانضمام")}>📋 نسخ رابط الانضمام</button>
          <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>window.open(`/join?room=${roomCode}`,"_blank")}>🔗 فتح صفحة الانضمام</button>
          <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>p.copyText(p.displayLink,"رابط شاشة العرض")}>📺 نسخ رابط شاشة العرض</button>
          <button className="btn-secondary" style={{ fontSize:"0.75rem" }} onClick={()=>window.open(`/participant?room=${roomCode}`,"_blank")}>🖥 فتح شاشة العرض</button>
        </div>
      </div>
    </div>
  );
}
