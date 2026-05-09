import { useLocation } from "wouter";
import { useState } from "react";
import { showToast } from "../components/KcToast";
import { useAppSettings } from "../hooks/useAppSettings";

export default function Home() {
  const [, setLocation] = useLocation();
  const profileKey = "kc_host_profile";
  const { textScale } = useAppSettings();

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

  const openTemplates = () => {
    if (!hostName.trim()) {
      localStorage.setItem("kc_open_templates", "1");
      setLocation("/host");
      return;
    }
    localStorage.setItem("kc_open_templates", "1");
    goHost();
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", fontSize: `${textScale}rem`, background: "radial-gradient(circle at 80% 0%, rgba(245,158,11,0.18), transparent 28%), radial-gradient(circle at 12% 18%, rgba(37,99,235,0.2), transparent 30%), linear-gradient(160deg,#fff7ed 0%,#eef2ff 48%,#f8fafc 100%)", color: "#0f172a", overflowX: "hidden" }}>
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto", padding: "1.25rem 1rem 2rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.8rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <div style={{ width: 46, height: 46, borderRadius: 16, background: "linear-gradient(135deg,#1d4ed8,#f59e0b)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, boxShadow: "0 12px 30px rgba(37,99,235,0.24)" }}>و</div>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "#1e3a8a" }}>وصلة المعرفة</div>
              <div style={{ color: "#64748b", fontSize: "0.78rem" }}>منصة صفية لتعلّم الحروف العربية</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
            <button className="btn-secondary" style={{ background: "#ffffffcc", color: "#1e293b", borderColor: "#dbeafe" }} onClick={() => setLocation("/join")}>انضم إلى لعبة</button>
            <button className="btn-gold" onClick={goHost}>ابدأ الآن</button>
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem", alignItems: "stretch" }}>
          <div style={{ background: "rgba(255,255,255,0.82)", border: "1px solid rgba(219,234,254,0.9)", borderRadius: 28, padding: "clamp(1.25rem, 3vw, 2.1rem)", boxShadow: "0 24px 70px rgba(30,64,175,0.12)", backdropFilter: "blur(14px)" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", padding: "0.28rem 0.75rem", borderRadius: 9999, background: "#fef3c7", color: "#92400e", fontWeight: 800, marginBottom: "0.8rem" }}>
              ✨ عربية بالكامل وجاهزة للفصل
            </div>
            <h1 style={{ fontSize: "clamp(2.25rem, 8vw, 4.2rem)", fontWeight: 900, color: "#1e3a8a", lineHeight: 1.05, margin: 0 }}>وصلة المعرفة</h1>
            <h2 style={{ fontSize: "clamp(1.2rem, 3vw, 1.8rem)", color: "#d97706", lineHeight: 1.35, margin: "0.65rem 0 0" }}>تعلّم الحروف العربية بطريقة تفاعلية ممتعة</h2>
            <p style={{ color: "#475569", fontSize: "1rem", lineHeight: 2, marginTop: "0.85rem", maxWidth: 660 }}>
              منصة صفية تساعد المعلمين على إنشاء ألعاب تعليمية قائمة على الحروف، الأسئلة، التحدي، والعمل الجماعي.
            </p>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <button className="btn-gold" style={{ fontSize: "1rem", padding: "0.75rem 1.45rem" }} onClick={goHost}>ابدأ الآن</button>
              <button className="btn-secondary" style={{ fontSize: "1rem", padding: "0.75rem 1.45rem", background: "#eef2ff", color: "#1e3a8a", borderColor: "#c7d2fe" }} onClick={openTemplates}>استعراض القوالب</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.55rem", marginTop: "1.2rem" }}>
              {["بنك أسئلة لكل حرف", "قوالب جاهزة", "شاشة عرض للطلاب", "نتائج محفوظة"].map((x) => (
                <div key={x} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "0.65rem 0.75rem", color: "#334155", fontSize: "0.86rem", fontWeight: 700 }}>{x}</div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.8rem" }}>
            <div style={{ background: "linear-gradient(145deg,#111827,#1e293b)", border: "1px solid rgba(148,163,184,0.22)", borderRadius: 28, padding: "1rem", boxShadow: "0 28px 80px rgba(15,23,42,0.26)", minHeight: 360 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.65rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <div style={{ color: "#fbbf24", fontWeight: 900 }}>معاينة اللعبة</div>
                  <div style={{ color: "#94a3b8", fontSize: "0.76rem" }}>تحدي الحروف داخل الصف</div>
                </div>
                <div style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 12, padding: "0.35rem 0.7rem", color: "#22c55e", fontWeight: 900 }}>٤٥ث</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginBottom: "0.75rem" }}>
                {[{ name: "فريق البيان", score: 8, color: "#38bdf8" }, { name: "فريق الضاد", score: 7, color: "#f97316" }].map((team) => (
                  <div key={team.name} style={{ background: `${team.color}18`, border: `1px solid ${team.color}66`, borderRadius: 16, padding: "0.65rem", textAlign: "center" }}>
                    <div style={{ color: team.color, fontWeight: 800, fontSize: "0.82rem" }}>{team.name}</div>
                    <div style={{ color: "#fff", fontSize: "2rem", lineHeight: 1, fontWeight: 900 }}>{team.score}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "0.35rem", direction: "ltr", maxWidth: 360, margin: "0 auto" }}>
                {"أبتثجحخدذرزسشصضطظعغفقكلمن".slice(0, 25).split("").map((letter, index) => (
                  <div key={`${letter}-${index}`} style={{ aspectRatio: "1", clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)", display: "grid", placeItems: "center", color: "#fff", fontWeight: 900, fontSize: "clamp(0.9rem, 3vw, 1.25rem)", background: index % 7 === 0 ? "linear-gradient(135deg,#2563eb,#38bdf8)" : index % 6 === 0 ? "linear-gradient(135deg,#f97316,#facc15)" : "linear-gradient(135deg,#1e293b,#334155)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.16)" }}>{letter}</div>
                ))}
              </div>
              <div style={{ marginTop: "0.85rem", background: "rgba(15,23,42,0.72)", border: "1px solid #334155", borderRadius: 16, padding: "0.85rem" }}>
                <div style={{ color: "#94a3b8", fontSize: "0.72rem", fontWeight: 800 }}>السؤال الحالي</div>
                <div style={{ color: "#fff", fontWeight: 800, lineHeight: 1.7 }}>اذكر كلمة تبدأ بحرف ب.</div>
              </div>
            </div>

            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 24, padding: "1rem", boxShadow: "0 18px 50px rgba(15,23,42,0.08)" }}>
              <div style={{ color: "#1e3a8a", fontWeight: 900, marginBottom: "0.65rem" }}>دخول المعلم</div>
              <label style={lbl}>اسم المضيف</label>
              <input className="kc-input" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="مثال: الأستاذ أحمد" style={lightInput} />
              <label style={lbl}>اسم الصف أو الفعالية (اختياري)</label>
              <input className="kc-input" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="مثال: الصف الثالث" style={lightInput} />
              <label style={lbl}>اسم المدرسة أو الجهة (اختياري)</label>
              <input className="kc-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="مثال: مدرسة المعرفة" style={lightInput} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0.55rem", marginTop: "0.8rem" }}>
                <button className="btn-gold" onClick={goHost}>بدء الاستضافة</button>
                <button className="btn-secondary" style={{ background: "#eef2ff", color: "#1e3a8a", borderColor: "#c7d2fe" }} onClick={openTemplates}>القوالب</button>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-grid">
          {[
            { icon: "🎲", title: "ألعاب حروف تفاعلية", body: "لوحة حروف مشوقة تربط التعلم بالتحدي الجماعي." },
            { icon: "📚", title: "بنك أسئلة لكل حرف", body: "أضف عدة أسئلة للحرف الواحد ونوّع الإجابات." },
            { icon: "🧩", title: "قوالب جاهزة للمعلمين", body: "ابدأ بسرعة ثم عدّل الأسئلة بما يناسب حصتك." },
            { icon: "🖥", title: "شاشة عرض مناسبة للطلاب", body: "واجهة نظيفة للسبورة الذكية والآيباد." },
            { icon: "ع", title: "دعم كامل للغة العربية", body: "اتجاه يمين إلى يسار ونصوص عربية واضحة." },
            { icon: "✨", title: "تصميم صفي حديث", body: "ألوان ودودة، بطاقات واضحة، وتجربة منظمة." },
          ].map((f) => (
            <article key={f.title} style={featureCard}>
              <div style={{ fontSize: "1.6rem", marginBottom: "0.45rem", color: "#2563eb", fontWeight: 900 }}>{f.icon}</div>
              <div style={{ fontWeight: 900, color: "#0f172a" }}>{f.title}</div>
              <div style={{ color: "#64748b", fontSize: "0.86rem", lineHeight: 1.8, marginTop: "0.25rem" }}>{f.body}</div>
            </article>
          ))}
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1rem" }}>
          <div style={whitePanel}>
            <div className="section-title" style={{ color: "#1e3a8a", borderRightColor: "#f59e0b" }}>كيف تعمل المنصة؟</div>
            {["اختر قالباً أو أنشئ أسئلتك", "ابدأ غرفة لعب جديدة", "اعرض اللوحة للطلاب", "تابع النقاط والفائز بطريقة ممتعة"].map((step, idx) => (
              <div key={step} style={{ display: "flex", gap: "0.7rem", alignItems: "center", padding: "0.55rem 0", color: "#334155", fontWeight: 700 }}>
                <span style={{ width: 32, height: 32, borderRadius: 12, background: "#fef3c7", color: "#92400e", display: "grid", placeItems: "center", fontWeight: 900 }}>{idx + 1}</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div style={whitePanel}>
            <div className="section-title" style={{ color: "#1e3a8a", borderRightColor: "#f59e0b" }}>مصممة للمعلمين</div>
            {["توفير وقت التحضير", "تنويع الأسئلة لكل حرف", "تشجيع المشاركة بين الفرق", "جعل تعلم الحروف أكثر متعة"].map((tip) => (
              <div key={tip} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "0.65rem 0.75rem", color: "#334155", fontWeight: 700, marginBottom: "0.45rem" }}>✓ {tip}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { color: "#475569", fontSize: "0.82rem", fontWeight: 700, display: "block", marginTop: "0.55rem", marginBottom: "0.25rem" };
const lightInput: React.CSSProperties = { background: "#f8fafc", borderColor: "#dbe2ea", color: "#0f172a" };
const featureCard: React.CSSProperties = { background: "rgba(255,255,255,0.86)", border: "1px solid #e2e8f0", borderRadius: 22, padding: "1rem", boxShadow: "0 16px 42px rgba(15,23,42,0.07)" };
const whitePanel: React.CSSProperties = { background: "rgba(255,255,255,0.9)", border: "1px solid #e2e8f0", borderRadius: 24, padding: "1.1rem", boxShadow: "0 18px 48px rgba(15,23,42,0.08)" };
