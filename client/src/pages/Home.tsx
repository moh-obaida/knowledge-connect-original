import { useLocation } from "wouter";
import { useState } from "react";
import { showToast } from "../components/KcToast";
import { useAppSettings } from "../hooks/useAppSettings";

export default function Home() {
  const [, setLocation] = useLocation();
  const profileKey = "kc_host_profile";
  const { settings, textScale } = useAppSettings();
  const appearanceMode = settings.theme === "soft" ? "balanced" : settings.theme === "high-contrast" ? "dark" : settings.theme;
  const visualTheme = (typeof window !== "undefined" ? localStorage.getItem("kc_visual_theme") : null) || "classic";
  const bgByMode: Record<string, string> = {
    light: "linear-gradient(160deg,#f8fafc 0%,#eef2ff 60%,#f8fafc 100%)",
    balanced: "linear-gradient(160deg,#f1f5f9 0%,#dbeafe 60%,#e2e8f0 100%)",
    dark: "linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)",
  };
  const accentByTheme: Record<string, string> = { classic:"#f59e0b", school:"#2563eb", space:"#22d3ee", ramadan:"#22c55e", science:"#8b5cf6", vivid:"#ef4444" };
  const raw = typeof window !== "undefined" ? localStorage.getItem(profileKey) : null;
  const parsed = raw ? JSON.parse(raw) : null;
  const [hostName, setHostName] = useState(parsed?.hostName || "");
  const [className, setClassName] = useState(parsed?.className || "");
  const [orgName, setOrgName] = useState(parsed?.orgName || "");
  const goHost = () => {
    if (!hostName.trim()) { showToast.warning("يرجى إدخال الاسم."); return; }
    localStorage.setItem(profileKey, JSON.stringify({ hostName: hostName.trim(), className: className.trim(), orgName: orgName.trim() }));
    setLocation("/host");
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.25rem", fontSize:`${textScale}rem`, background:bgByMode[appearanceMode] || bgByMode.dark }}>
      <div style={{ width:"100%", maxWidth:1040 }}>
        <div style={{ background:"#0f1623", border:"1.5px solid #1a2332", borderRadius:24, padding:"1.25rem", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"1rem" }}>
          <div style={{ textAlign:"center", marginBottom:"1rem" }}>
            <div style={{ fontSize:"2.4rem", color:accentByTheme[visualTheme] || "#f59e0b", fontWeight:900 }}>وصلة المعرفة</div>
            <div style={{ color:"#94a3b8", fontWeight:700, marginTop:"0.25rem" }}>حوّل المراجعة إلى تحدٍ ممتع</div>
            <div style={{ color:"#64748b", marginTop:"0.25rem" }}>منصة تحديات تعليمية تفاعلية للمضيفين والمعلمين</div>
            <div style={{ color:"#64748b", fontSize:"0.9rem", marginTop:"0.2rem" }}>أنشئ اللعبة واستضفها وابدأ التحدي بسهولة</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"0.45rem", marginTop:"0.9rem", textAlign:"right" }}>
              {["قوالب جاهزة","لوحة تحكم للمضيف","وضع عرض للفصل"].map(x=>(
                <div key={x} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.45rem 0.6rem", color:"#cbd5e1", fontSize:"0.82rem" }}>{x}</div>
              ))}
            </div>
            <div style={{ marginTop:"0.8rem", color:"#94a3b8", fontSize:"0.85rem" }}>مناسب للمعلمين • المضيفين • الأهالي • قادة الأنشطة • الطلاب</div>
          </div>
          <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:"16px", padding:"0.9rem" }}>
            <div style={{ color:"#f59e0b", fontWeight:800, marginBottom:"0.6rem" }}>دخول المضيف</div>
            <label style={{ color:"#94a3b8", fontSize:"0.8rem" }}>اسم المضيف</label>
            <input className="kc-input" value={hostName} onChange={e=>setHostName(e.target.value)} placeholder="مثال: الأستاذ أحمد" />
            <label style={{ color:"#94a3b8", fontSize:"0.8rem" }}>اسم الصف أو الفعالية (اختياري)</label>
            <input className="kc-input" value={className} onChange={e=>setClassName(e.target.value)} />
            <label style={{ color:"#94a3b8", fontSize:"0.8rem" }}>اسم المدرسة أو الجهة (اختياري)</label>
            <input className="kc-input" value={orgName} onChange={e=>setOrgName(e.target.value)} />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginTop:"0.7rem" }}>
              <button className="btn-gold" onClick={goHost}>بدء الاستضافة</button>
              <button className="btn-secondary" onClick={()=>{ localStorage.setItem("kc_open_templates","1"); goHost(); }}>القوالب</button>
            </div>
            <button className="btn-secondary" style={{ width:"100%", marginTop:"0.5rem" }} onClick={()=>setLocation("/join")}>انضمام الطالب</button>
            <div style={{ marginTop:"0.7rem", color:"#94a3b8", fontSize:"0.78rem", textAlign:"center" }}>تجربة محلية: تُحفظ البيانات على هذا الجهاز فقط.</div>
          </div>
        </div>
        <div style={{ marginTop:"1rem", display:"grid", gap:"0.8rem" }}>
          <div className="kc-card">
            <div className="section-title">كيف تعمل المنصة؟</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"0.55rem" }}>
              {["1) اختر قالباً أو أنشئ لعبة جديدة","2) أضف الأسئلة أو استخدم نموذجاً جاهزاً","3) ابدأ الاستضافة وشارك التحدي","4) تابع النتائج وتفاعل الطلاب"].map((step)=>(
                <div key={step} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.6rem", color:"#cbd5e1", fontSize:"0.84rem" }}>{step}</div>
              ))}
            </div>
          </div>
          <div className="kc-card" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"0.65rem" }}>
            <div>
              <div style={{ fontWeight:800, color:"#f0ede8" }}>جاهز لبدء أول تحدٍ؟</div>
              <div style={{ color:"#94a3b8", fontSize:"0.84rem" }}>فئات مقترحة: اللغة العربية • التربية الإسلامية • العلوم • الرياضيات • الحروف الأساسية</div>
            </div>
            <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
              <button className="btn-gold" onClick={goHost}>ابدأ الآن</button>
              <button className="btn-secondary" onClick={()=>{ localStorage.setItem("kc_open_templates","1"); goHost(); }}>عرض القوالب</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
