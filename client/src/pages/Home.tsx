import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"1.25rem", background:"linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)" }}>
      <div style={{ width:"100%", maxWidth:900 }}>
        <div style={{ background:"#0f1623", border:"1.5px solid #1a2332", borderRadius:24, padding:"1.4rem" }}>
          <div style={{ textAlign:"center", marginBottom:"1rem" }}>
            <div style={{ fontSize:"2.2rem", color:"#f59e0b", fontWeight:900 }}>وصلة المعرفة</div>
            <div style={{ color:"#94a3b8" }}>لعبة صفّية ممتعة لتعلم أسرع ومنافسة أذكى</div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"0.6rem" }}>
            <button className="btn-gold" onClick={()=>setLocation("/join")}>ابدأ اللعب</button>
            <button className="btn-secondary" onClick={()=>setLocation("/host")}>إنشاء لعبة</button>
            <button className="btn-secondary" onClick={()=>{ localStorage.setItem("kc_open_templates","1"); setLocation("/host"); }}>استكشف القوالب</button>
            <button className="btn-secondary" onClick={()=>setLocation("/classroom")}>Classroom Mode (Prototype)</button>
          </div>
          <div style={{ marginTop:"1rem", color:"#94a3b8", fontSize:"0.9rem", textAlign:"center" }}>لا حاجة لتسجيل دخول — كل شيء يعمل محلياً على جهازك.</div>
        </div>
      </div>
    </div>
  );
}
