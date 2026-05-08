import { useLocation } from "wouter";
import { useState } from "react";
import { showToast } from "../components/KcToast";
import { useAppSettings } from "../hooks/useAppSettings";
import { useLanguage } from "../hooks/useLanguage";

export default function Home() {
  const [, setLocation] = useLocation();
  const { t, language, toggleLanguage } = useLanguage();
  const profileKey = "kc_host_profile";
  const { settings, textScale } = useAppSettings();
  const appearanceMode = settings.theme === "soft" ? "balanced" : settings.theme === "high-contrast" ? "dark" : settings.theme;
  const visualTheme = (typeof window !== "undefined" ? localStorage.getItem("kc_visual_theme") : null) || "classic";
  const bgByMode: Record<string, string> = {
    light: "linear-gradient(160deg,#f8fafc 0%,#eef2ff 60%,#f8fafc 100%)",
    balanced: "linear-gradient(160deg,#f1f5f9 0%,#dbeafe 60%,#e2e8f0 100%)",
    dark: "linear-gradient(160deg,#090d18 0%,#0f172a 60%,#090d18 100%)",
  };
  const accentByTheme: Record<string, string> = { classic: "#f59e0b", school: "#2563eb", space: "#22d3ee", ramadan: "#22c55e", science: "#8b5cf6", vivid: "#ef4444" };
  const accent = accentByTheme[visualTheme] || "#f59e0b";

  const raw = typeof window !== "undefined" ? localStorage.getItem(profileKey) : null;
  const parsed = raw ? JSON.parse(raw) : null;
  const [hostName, setHostName] = useState(parsed?.hostName || "");
  const [className, setClassName] = useState(parsed?.className || "");
  const [orgName, setOrgName] = useState(parsed?.orgName || "");

  const goHost = () => {
    if (!hostName.trim()) { showToast.warning(language === "ar" ? "يرجى إدخال الاسم." : "Please enter a name."); return; }
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
    <div style={{ minHeight: "100vh", padding: "1.25rem 1rem", fontSize: `${textScale}rem`, background: bgByMode[appearanceMode] || bgByMode.dark }}>
      <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display:"flex", justifyContent:"flex-end" }}><button className="btn-secondary" onClick={toggleLanguage}>{language === "ar" ? "English" : "العربية"}</button></div>

        {/* Hero */}
        <div className="kc-card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", padding: "1.5rem" }}>
          <div>
            <div style={{ display: "inline-block", fontSize: "0.7rem", padding: "0.2rem 0.65rem", borderRadius: 9999, background: `${accent}20`, color: accent, fontWeight: 700, marginBottom: "0.65rem" }}>
              منصة تحديات تعليمية تفاعلية
            </div>
            <div style={{ fontSize: "clamp(1.7rem, 5vw, 2.5rem)", fontWeight: 900, color: accent, lineHeight: 1.2 }}>
              وصلة المعرفة — تعلّم باللعب وابدأ التحدي بسهولة
            </div>
            <div style={{ color: "#cbd5e1", fontSize: "1rem", marginTop: "0.6rem", lineHeight: 1.85 }}>
              أنشئ ألعاباً تعليمية تفاعلية، استخدم قوالب جاهزة، واستضف تحديات ممتعة للطلاب بسرعة وسهولة.
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <button className="btn-gold" onClick={goHost}>{t("home.startNow")}</button>
              <button className="btn-secondary" onClick={openTemplates}>{t("home.exploreTemplates")}</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "0.45rem", marginTop: "1rem" }}>
              {["قوالب جاهزة", "لوحة تحكم للمضيف", "وضع عرض للفصل", "QR للانضمام"].map((x) => (
                <div key={x} style={{ background: "#141e2d", border: "1px solid #1a2332", borderRadius: 10, padding: "0.45rem 0.6rem", color: "#cbd5e1", fontSize: "0.82rem" }}>{x}</div>
              ))}
            </div>
            <div style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.85rem" }}>مناسب للمعلمين • المضيفين • الأهالي • قادة الأنشطة • الطلاب</div>
          </div>

          <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 16, padding: "1rem" }}>
            <div style={{ color: accent, fontWeight: 800, marginBottom: "0.6rem" }}>{t("home.hostLogin")}</div>
            <label style={lbl}>{t("home.hostName")}</label>
            <input className="kc-input" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="مثال: الأستاذ أحمد" />
            <label style={lbl}>اسم الصف أو الفعالية (اختياري)</label>
            <input className="kc-input" value={className} onChange={(e) => setClassName(e.target.value)} />
            <label style={lbl}>اسم المدرسة أو الجهة (اختياري)</label>
            <input className="kc-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.7rem" }}>
              <button className="btn-gold" onClick={goHost}>بدء الاستضافة</button>
              <button className="btn-secondary" onClick={openTemplates}>القوالب</button>
            </div>
            <button className="btn-secondary" style={{ width: "100%", marginTop: "0.5rem" }} onClick={() => setLocation("/join")}>{t("home.joinStudent")}</button>
            <div style={{ marginTop: "0.7rem", color: "#94a3b8", fontSize: "0.78rem", textAlign: "center" }}>
              تجربة محلية: تُحفظ البيانات على هذا الجهاز فقط.
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="kc-card">
          <div className="section-title">لماذا وصلة المعرفة؟</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.65rem" }}>
            {[
              { icon: "🎮", title: "إنشاء ألعاب بسهولة", body: "أنشئ تحدياً جديداً خلال دقائق بدون تعقيد." },
              { icon: "📚", title: "قوالب جاهزة", body: "قوالب لمواد متعددة وللمراجعة السريعة." },
              { icon: "📡", title: "استضافة مباشرة", body: "ابدأ التحدي وتفاعل مع الطلاب لحظياً." },
              { icon: "📊", title: "نتائج ومتابعة", body: "احفظ نتائج كل لعبة وتابع تقدّم الفرق." },
              { icon: "🍎", title: "للمعلمين والطلاب", body: "تجربة مصمَّمة للفصل الدراسي والأنشطة." },
            ].map((f) => (
              <div key={f.title} style={{ background: "#141e2d", border: "1px solid #1a2332", borderRadius: 12, padding: "0.85rem" }}>
                <div style={{ fontSize: "1.5rem" }}>{f.icon}</div>
                <div style={{ fontWeight: 800, color: "#f0ede8", marginTop: "0.3rem" }}>{f.title}</div>
                <div style={{ color: "#94a3b8", fontSize: "0.84rem", marginTop: "0.2rem" }}>{f.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="kc-card">
          <div className="section-title">كيف تعمل المنصة؟</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
            {[
              "1) اختر قالباً أو أنشئ لعبة جديدة",
              "2) أضف الأسئلة",
              "3) ابدأ الاستضافة",
              "4) تابع النتائج",
            ].map((step) => (
              <div key={step} style={{ background: "#141e2d", border: "1px solid #1a2332", borderRadius: 10, padding: "0.7rem", color: "#cbd5e1", fontSize: "0.86rem", lineHeight: 1.7 }}>
                {step}
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="kc-card">
          <div className="section-title">فئات تعليمية متنوعة</div>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {["اللغة العربية", "التربية الإسلامية", "العلوم", "الرياضيات", "الحروف الأساسية", "القيم والأخلاق", "المفردات"].map((c) => (
              <span key={c} className="badge-chip" style={{ color: "#cbd5e1", background: "#141e2d", borderColor: "#1a2332" }}>{c}</span>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="kc-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.7rem" }}>
          <div>
            <div style={{ fontWeight: 800, color: "#f0ede8", fontSize: "1.05rem" }}>جاهز لبدء أول تحدٍ؟</div>
            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>أدخل اسمك وابدأ تحدياً جديداً، أو افتح القوالب الجاهزة.</div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn-gold" onClick={goHost}>{t("home.startNow")}</button>
            <button className="btn-secondary" onClick={openTemplates}>عرض القوالب</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { color: "#94a3b8", fontSize: "0.8rem", display: "block", marginTop: "0.45rem" };
