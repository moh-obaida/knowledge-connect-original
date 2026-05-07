import { useLocation } from "wouter";
import { useState } from "react";
import { showToast } from "../components/KcToast";

export default function Home() {
  const [, setLocation] = useLocation();
  const profileKey = "kc_host_profile";
  const raw = typeof window !== "undefined" ? localStorage.getItem(profileKey) : null;
  const parsed = raw ? JSON.parse(raw) : null;
  const [hostName, setHostName] = useState(parsed?.hostName || "");
  const [className, setClassName] = useState(parsed?.className || "");
  const [orgName, setOrgName] = useState(parsed?.orgName || "");
  const goHost = () => {
    if (!hostName.trim()) { showToast.warning("يرجى إدخال اسم المضيف."); return; }
    localStorage.setItem(profileKey, JSON.stringify({ hostName: hostName.trim(), className: className.trim(), orgName: orgName.trim() }));
    setLocation("/host");
  };
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.25rem", background:"linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)" }}>
      <div style={{ width:"100%", maxWidth:1040 }}>
        <div style={{ background:"#0f1623", border:"1.5px solid #1a2332", borderRadius:24, padding:"1.4rem", display:"grid", gridTemplateColumns:"1.25fr 1fr", gap:"1rem" }}>
          <div style={{ textAlign:"center", marginBottom:"1rem" }}>
            <div style={{ fontSize:"2.2rem", color:"#f59e0b", fontWeight:900 }}>وصلة المعرفة</div>
            <div style={{ color:"#94a3b8", fontWeight:700, marginTop:"0.25rem" }}>حوّل المراجعة إلى تحدي ممتع</div>
            <div style={{ color:"#64748b", marginTop:"0.25rem" }}>منصة تحديات تعليمية تفاعلية للمضيفين والمعلمين</div>
            <div style={{ color:"#64748b", fontSize:"0.9rem", marginTop:"0.2rem" }}>أنشئ، استضف، وتحدى بطريقة ممتعة</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"0.45rem", marginTop:"0.9rem", textAlign:"right" }}>
              {["قوالب جاهزة","لوحة تحكم للمضيف","وضع عرض للفصل","نتائج محفوظة محلياً","ألعاب قابلة للتخصيص","تحديات فرق ممتعة"].map(x=>(
                <div key={x} style={{ background:"#141e2d", border:"1px solid #1a2332", borderRadius:"10px", padding:"0.45rem 0.6rem", color:"#cbd5e1", fontSize:"0.82rem" }}>{x}</div>
              ))}
            </div>
            <div style={{ marginTop:"0.8rem", color:"#94a3b8", fontSize:"0.85rem" }}>مناسب لـ: المعلمون • المضيفون • الأهالي • قادة الأنشطة • الطلاب</div>
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
              <button className="btn-gold" onClick={goHost}>دخول لوحة التحكم</button>
              <button className="btn-secondary" onClick={()=>{ localStorage.setItem("kc_open_templates","1"); goHost(); }}>جرّب قالباً جاهزاً</button>
            </div>
            <button className="btn-secondary" style={{ width:"100%", marginTop:"0.5rem" }} onClick={()=>setLocation("/join")}>ابدأ الآن</button>
            <div style={{ marginTop:"0.7rem", color:"#94a3b8", fontSize:"0.78rem", textAlign:"center" }}>يتم حفظ البيانات محلياً على هذا الجهاز فقط.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
