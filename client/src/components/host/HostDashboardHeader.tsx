import type { RoomState } from "../../lib/store";
import { t } from "../../lib/i18n";

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
    <div style={{ background:"#0f1623", borderBottom:"1.5px solid #1a2332", padding:"0.9rem 1rem" }}>
      <div style={{ maxWidth:1400, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.5rem", marginBottom:"0.5rem" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"0.7rem", flexWrap:"wrap" }}>
            <div style={{ fontWeight:900, fontSize:"1.3rem", color:"#f59e0b" }}>{t('hostHeader.title')}</div>
            <span style={{ fontSize:"0.8rem", color:"#cbd5e1" }}>{t('hostHeader.dashboard')}</span>
            {hostProfile.hostName && <span style={{ fontSize:"0.78rem", color:"#94a3b8" }}>{t('hostHeader.welcome')} {hostProfile.hostName}</span>}
            {hostProfile.className && <span style={{ fontSize:"0.72rem", color:"#64748b" }}>{t('hostHeader.classActivity')}: {hostProfile.className}</span>}
            {hostProfile.orgName && <span style={{ fontSize:"0.72rem", color:"#64748b" }}>{t('hostHeader.organization')}: {hostProfile.orgName}</span>}
            <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
              <span style={{ fontSize:"0.75rem", color:"#64748b" }}>{t('hostHeader.roomCode')}:</span>
              <span style={{ fontWeight:900, fontSize:"1.05rem", color:"#f0ede8", letterSpacing:"0.12em", background:"#1a2332", padding:"0.3rem 0.75rem", borderRadius:"8px", cursor:"pointer" }} onClick={()=>p.copyText(roomCode, t('hostHeader.code'))} title={t('hostHeader.clickToCopy')}>{roomCode}</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
            <select className="kc-input" style={{ fontSize:"0.75rem", maxWidth:120 }} aria-label={t('hostHeader.appearanceMode')} value={p.appearanceMode} onChange={e=>p.setAppearanceMode(e.target.value as any)}><option value="light">{t('hostHeader.appearanceLight')}</option><option value="balanced">{t('hostHeader.appearanceBalanced')}</option><option value="dark">{t('hostHeader.appearanceDark')}</option></select>
            <select className="kc-input" style={{ fontSize:"0.75rem", maxWidth:120 }} aria-label={t('hostHeader.visualTheme')} value={p.visualTheme} onChange={e=>p.setVisualTheme(e.target.value)}><option value="classic">{t('hostHeader.themeClassic')}</option><option value="school">{t('hostHeader.themeSchool')}</option><option value="space">{t('hostHeader.themeSpace')}</option><option value="ramadan">{t('hostHeader.themeRamadan')}</option><option value="science">{t('hostHeader.themeScience')}</option><option value="vivid">{t('hostHeader.themeVivid')}</option></select>
            {room.gameStatus==="lobby" && <button className="btn-gold" style={{ fontSize:"0.8rem", minHeight: 40 }} onClick={p.startGame}>▶ {t('hostHeader.startGame')}</button>}
            <button className="btn-danger" style={{ fontSize:"0.8rem", minHeight: 40 }} onClick={p.resetGame}>↺ {t('hostHeader.playAgain')}</button>
            <button className="btn-secondary" style={{ fontSize:"0.8rem", minHeight: 40 }} onClick={p.onLogout}>{t('hostHeader.logout')}</button>
          </div>
        </div>
        <div style={{ display:"grid", gap:"0.45rem", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))" }}>
          <button className="btn-secondary" style={{ fontSize:"0.75rem", minHeight: 40 }} onClick={()=>p.copyText(p.joinLink,t('hostHeader.joinLink'))}>📋 {t('hostHeader.copyStudentJoinLink')}</button>
          <button className="btn-secondary" style={{ fontSize:"0.75rem", minHeight: 40 }} onClick={()=>window.open(`/join?room=${roomCode}`,"_blank")}>🔗 {t('hostHeader.openJoinPage')}</button>
          <button className="btn-secondary" style={{ fontSize:"0.75rem", minHeight: 40 }} onClick={()=>p.copyText(p.displayLink,t('hostHeader.displayLink'))}>📺 {t('hostHeader.copyDisplayLink')}</button>
          <button className="btn-secondary" style={{ fontSize:"0.75rem", minHeight: 40 }} onClick={()=>window.open(`/participant?room=${roomCode}`,"_blank")}>🖥 {t('hostHeader.openDisplayScreen')}</button>
        </div>
      </div>
    </div>
  );
}
