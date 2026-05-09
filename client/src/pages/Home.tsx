import { useLocation } from "wouter";
import { useMemo, useState, type CSSProperties } from "react";
import { showToast } from "../components/KcToast";
import { useAppSettings } from "../hooks/useAppSettings";
import HexBoard from "../components/HexBoard";
import KcLogo from "../components/KcLogo";
import { generateBoard } from "../lib/store";

export default function Home() {
  const [, setLocation] = useLocation();
  const profileKey = "kc_host_profile";
  const { textScale } = useAppSettings();

  const raw = typeof window !== "undefined" ? localStorage.getItem(profileKey) : null;
  const parsed = (() => {
    try { return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  })();
  const [hostName, setHostName] = useState(parsed?.hostName || "");
  const [className, setClassName] = useState(parsed?.className || "");
  const [orgName, setOrgName] = useState(parsed?.orgName || "");
  const [helperVisible, setHelperVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("kc_first_helper_dismissed") !== "1";
  });
  const previewBoard = useMemo(() => generateBoard(5, "arabic"), []);
  const blueTeam = { name: "الفريق الأزرق", color: "#2563eb", initials: "أز" };
  const redTeam = { name: "الفريق الأحمر", color: "#ef4444", initials: "أح" };

  const goHost = () => {
    localStorage.setItem(profileKey, JSON.stringify({ hostName: hostName.trim(), className: className.trim(), orgName: orgName.trim() }));
    setLocation("/host");
  };

  const openTemplates = () => {
    localStorage.setItem("kc_open_templates", "1");
    goHost();
  };

  const showGuide = () => document.getElementById("quick-guide")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const dismissHelper = () => {
    localStorage.setItem("kc_first_helper_dismissed", "1");
    setHelperVisible(false);
  };

  return (
    <div dir="rtl" style={{ minHeight: "100vh", fontSize: `${textScale}rem`, background: "radial-gradient(circle at 82% 0%, rgba(245,158,11,0.28), transparent 28%), radial-gradient(circle at 12% 12%, rgba(37,99,235,0.2), transparent 30%), linear-gradient(145deg,#2e1065 0%,#4c1d95 42%,#f8fafc 42%,#fff7ed 100%)", color: "#160f2e", overflowX: "hidden" }}>
      {helperVisible && (
        <div style={{ position: "fixed", insetInline: "1rem", bottom: "1rem", zIndex: 60, display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: 760, width: "100%", background: "#fffaf0", border: "2px solid #f59e0b", borderRadius: 24, padding: "1rem", boxShadow: "0 24px 70px rgba(46,16,101,0.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 900, color: "#2e1065", fontSize: "1.1rem" }}>مرحباً بك في وصلة المعرفة!</div>
                <div style={{ color: "#64748b", lineHeight: 1.8 }}>يمكنك البدء بقالب جاهز أو إنشاء لعبة جديدة خلال دقائق.</div>
              </div>
              <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                <button className="btn-gold" onClick={() => { dismissHelper(); goHost(); }}>ابدأ الآن</button>
                <button className="btn-secondary" style={lightButton} onClick={() => { dismissHelper(); showGuide(); }}>شاهد الدليل السريع</button>
                <button className="btn-secondary" style={lightButton} onClick={() => { dismissHelper(); openTemplates(); }}>استخدم قالباً جاهزاً</button>
                <button className="btn-secondary" style={lightButton} aria-label="إغلاق المساعدة" onClick={dismissHelper}>إغلاق</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 1220, margin: "0 auto", padding: "1.25rem 1rem 2.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.8rem", flexWrap: "wrap", color: "#fff" }}>
          <KcLogo light subtitle="لعبة صفية عربية للحروف والأسئلة" />
          <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
            <button className="btn-secondary" style={{ background: "rgba(255,255,255,0.14)", color: "#fff", borderColor: "rgba(255,255,255,0.28)" }} onClick={() => setLocation("/join")}>عرض شاشة الطلاب</button>
            <button className="btn-gold" onClick={goHost}>دخول شاشة المعلم</button>
          </div>
        </header>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(300px,1.05fr) minmax(300px,0.95fr)", gap: "1rem", alignItems: "stretch" }} className="responsive-dashboard-hero">
          <div style={{ background: "rgba(255,255,255,0.94)", border: "1px solid rgba(245,158,11,0.38)", borderRadius: 32, padding: "clamp(1.25rem, 3vw, 2.2rem)", boxShadow: "0 28px 80px rgba(46,16,101,0.22)", backdropFilter: "blur(14px)" }}>
            <div style={pill}>عربية بالكامل • بلا تسجيل • جاهزة للصف</div>
            <h1 style={{ fontSize: "clamp(3rem, 9vw, 5rem)", fontWeight: 900, color: "#2e1065", lineHeight: 1.02, margin: 0 }}>وصلة المعرفة</h1>
            <h2 style={{ fontSize: "clamp(1.35rem, 3vw, 2rem)", color: "#a16207", lineHeight: 1.45, margin: "0.75rem 0 0" }}>لعبة تعليمية تفاعلية تربط الحروف بالأسئلة والتحدي داخل الصف</h2>
            <p style={{ color: "#475569", fontSize: "1.08rem", lineHeight: 2, marginTop: "0.9rem", maxWidth: 720 }}>
              أنشئ لعبة صفية ممتعة، اختر الحروف، أضف الأسئلة، وابدأ التحدي بين الفريق الأحمر والفريق الأزرق بطريقة واضحة ومناسبة للعرض داخل الصف.
            </p>
            <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "1.1rem" }}>
              <button className="btn-gold" style={{ fontSize: "1.05rem", padding: "0.85rem 1.5rem" }} onClick={goHost}>ابدأ لعبة جديدة</button>
              <button className="btn-secondary" style={lightButton} onClick={goHost}>دخول شاشة المعلم</button>
              <button className="btn-secondary" style={lightButton} onClick={() => setLocation("/join")}>عرض شاشة الطلاب</button>
              <button className="btn-secondary" style={lightButton} onClick={showGuide}>شاهد الدليل السريع</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "0.55rem", marginTop: "1.25rem" }}>
              {["بنك أسئلة لكل حرف", "قوالب جاهزة للحصة", "شاشة عرض نظيفة", "فوز بالوصل بين الجهات"].map((x) => (
                <div key={x} style={miniStat}>{x}</div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: "0.8rem" }}>
            <div style={{ background: "linear-gradient(145deg,#160f2e,#2e1065)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 32, padding: "1rem", boxShadow: "0 28px 80px rgba(15,23,42,0.34)", minHeight: 380 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.65rem", alignItems: "center", marginBottom: "0.75rem", color: "#fff" }}>
                <div>
                  <div style={{ color: "#fbbf24", fontWeight: 900 }}>معاينة اللعبة</div>
                  <div style={{ color: "#ddd6fe", fontSize: "0.82rem" }}>لوحة سداسية تفاعلية مثل قالب الصف</div>
                </div>
                <div style={{ background: "#fffaf0", border: "1px solid #f59e0b", borderRadius: 14, padding: "0.35rem 0.7rem", color: "#2e1065", fontWeight: 900 }}>٦٠ث</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginBottom: "0.75rem" }}>
                {[{ name: "الفريق الأزرق", score: 8, color: "#60a5fa" }, { name: "الفريق الأحمر", score: 7, color: "#fb7185" }].map((team) => (
                  <div key={team.name} style={{ background: `${team.color}18`, border: `1px solid ${team.color}66`, borderRadius: 16, padding: "0.65rem", textAlign: "center" }}>
                    <div style={{ color: team.color, fontWeight: 800, fontSize: "0.82rem" }}>{team.name}</div>
                    <div style={{ color: "#fff", fontSize: "2rem", lineHeight: 1, fontWeight: 900 }}>{team.score}</div>
                  </div>
                ))}
              </div>
              <div style={{ maxWidth: 470, margin: "0 auto" }}>
                <HexBoard board={previewBoard} gridSize={5} mode="participant" team1={blueTeam} team2={redTeam} compact />
              </div>
              <div style={{ marginTop: "0.85rem", background: "rgba(15,23,42,0.72)", border: "1px solid #334155", borderRadius: 16, padding: "0.85rem" }}>
                <div style={{ color: "#fbbf24", fontSize: "0.76rem", fontWeight: 800 }}>السؤال الحالي</div>
                <div style={{ color: "#fff", fontWeight: 800, lineHeight: 1.7, fontSize: "1.05rem" }}>اذكر كلمة تبدأ بحرف ب.</div>
              </div>
            </div>

            <div style={whitePanel}>
              <div style={{ color: "#2e1065", fontWeight: 900, marginBottom: "0.35rem", fontSize: "1.05rem" }}>تجهيز سريع للمعلم</div>
              <div style={{ color: "#64748b", fontSize: "0.86rem", lineHeight: 1.7 }}>هذه البيانات اختيارية وتساعد على تخصيص شاشة الاستضافة.</div>
              <label style={lbl}>اسم المضيف</label>
              <input className="kc-input" value={hostName} onChange={(e) => setHostName(e.target.value)} placeholder="مثال: الأستاذ أحمد" style={lightInput} />
              <label style={lbl}>اسم الصف أو الفعالية (اختياري)</label>
              <input className="kc-input" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="مثال: الصف الثالث" style={lightInput} />
              <label style={lbl}>اسم المدرسة أو الجهة (اختياري)</label>
              <input className="kc-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="مثال: مدرسة المعرفة" style={lightInput} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: "0.55rem", marginTop: "0.8rem" }}>
                <button className="btn-gold" onClick={goHost}>بدء الإعداد</button>
                <button className="btn-secondary" style={lightButton} onClick={openTemplates}>القوالب الجاهزة</button>
              </div>
            </div>
          </div>
        </section>

        <Section title="كيف تعمل اللعبة؟" cards={[
          ["١", "اختر الحروف", "حدد الحروف التي تريد مراجعتها مع الطلاب."],
          ["٢", "أضف الأسئلة", "اربط كل حرف بسؤال وإجابة مناسبة."],
          ["٣", "ابدأ التحدي", "يعرض الطلاب اللوحة ويتنافس الفريقان."],
          ["٤", "اربط الطريق للفوز", "يفوز الفريق عندما يصل بين جهتيه على اللوحة."],
        ]} />

        <Section title="مناسبة للحصة الصفية" cards={[
          ["ع", "مراجعة الحروف", "تدريب سريع على الحروف والكلمات."],
          ["؟", "أسئلة سريعة", "أسئلة قصيرة تناسب وقت الحصة."],
          ["ف", "تعلم جماعي", "الفريق يساعد ويشارك ويتنافس."],
          ["⭐", "منافسة ممتعة", "نقاط ولوحة وفوز واضح."],
          ["📺", "عرض واضح للطلاب", "واجهة كبيرة للسبورة وجهاز العرض."],
          ["🎛", "تحكم كامل للمعلم", "السؤال والإجابة والنقاط بيد المعلم."],
        ]} />

        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1rem" }}>
          <div style={whitePanel}>
            <div className="section-title" style={{ color: "#2e1065", borderRightColor: "#f59e0b" }}>للمعلم والطلاب</div>
            {["شاشة المعلم تحتوي على أدوات التحكم.", "شاشة الطلاب تعرض اللعبة فقط.", "الإجابة لا تظهر إلا عندما يكشفها المعلم.", "النقاط واللوحة تتحدث بطريقة واضحة."].map((tip) => (
              <div key={tip} style={simpleLine}>✓ {tip}</div>
            ))}
          </div>
          <div style={whitePanel}>
            <div className="section-title" style={{ color: "#2e1065", borderRightColor: "#f59e0b" }}>ابدأ بسرعة</div>
            <div style={{ display: "grid", gap: "0.55rem" }}>
              <button style={actionCard} onClick={openTemplates}>استخدم قالباً جاهزاً</button>
              <button style={actionCard} onClick={goHost}>أنشئ بنك أسئلة</button>
              <button style={actionCard} onClick={showGuide}>افتح الدليل السريع</button>
            </div>
          </div>
        </section>

        <section id="quick-guide" style={{ ...whitePanel, scrollMarginTop: "1rem" }}>
          <div className="section-title" style={{ color: "#2e1065", borderRightColor: "#f59e0b" }}>الدليل السريع</div>
          <div style={{ color: "#64748b", lineHeight: 1.9, marginBottom: "0.9rem" }}>اتبع هذه الخطوات البسيطة لبدء لعبة صفية خلال دقائق.</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "0.65rem" }}>
            {[
              ["١", "جهز الأسئلة", "أضف أسئلة مرتبطة بالحروف أو استخدم قالباً جاهزاً."],
              ["٢", "اختر الحروف", "حدد الحروف التي تريد استخدامها في اللعبة."],
              ["٣", "جهز الفريقين", "استخدم الفريق الأحمر والفريق الأزرق، ويمكنك تعديل الأسماء."],
              ["٤", "افتح شاشة الطلاب", "اعرض شاشة الطلاب على السبورة أو جهاز العرض."],
              ["٥", "ابدأ التحدي", "اختر حرفاً، اعرض السؤال، ثم استقبل الإجابة من الطلاب."],
              ["٦", "اكشف الإجابة", "لا تظهر الإجابة إلا عندما يضغط المعلم على زر كشف الإجابة."],
              ["٧", "سجّل النقاط", "امنح الخانة للفريق الذي يجيب إجابة صحيحة."],
              ["٨", "اربط الطريق للفوز", "الأحمر يصل من الأعلى للأسفل، والأزرق من اليسار لليمين."],
            ].map(([num, title, body]) => (
              <article key={title} style={guideCard}>
                <div style={guideNumber}>{num}</div>
                <div style={{ fontWeight: 900, color: "#160f2e" }}>{title}</div>
                <div style={{ color: "#64748b", lineHeight: 1.8, fontSize: "0.88rem", marginTop: "0.2rem" }}>{body}</div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Section({ title, cards }: { title: string; cards: string[][] }) {
  return (
    <section>
      <div className="section-title" style={{ color: "#2e1065", borderRightColor: "#f59e0b", fontSize: "1rem" }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "0.75rem" }}>
        {cards.map(([icon, cardTitle, body]) => (
          <article key={cardTitle} style={featureCard}>
            <div style={{ width: 42, height: 42, borderRadius: 16, background: "#fef3c7", color: "#2e1065", display: "grid", placeItems: "center", fontWeight: 900, marginBottom: "0.5rem" }}>{icon}</div>
            <div style={{ fontWeight: 900, color: "#160f2e", fontSize: "1.05rem" }}>{cardTitle}</div>
            <div style={{ color: "#64748b", lineHeight: 1.8, marginTop: "0.25rem" }}>{body}</div>
          </article>
        ))}
      </div>
    </section>
  );
}

const lbl: CSSProperties = { color: "#475569", fontSize: "0.84rem", fontWeight: 800, display: "block", marginTop: "0.6rem", marginBottom: "0.28rem" };
const lightInput: CSSProperties = { background: "#f8fafc", borderColor: "#dbe2ea", color: "#0f172a" };
const lightButton: CSSProperties = { fontSize: "1rem", padding: "0.75rem 1.15rem", background: "#f8fafc", color: "#2e1065", borderColor: "#ddd6fe" };
const featureCard: CSSProperties = { background: "rgba(255,255,255,0.94)", border: "1px solid #e2e8f0", borderRadius: 24, padding: "1rem", boxShadow: "0 18px 46px rgba(46,16,101,0.09)" };
const whitePanel: CSSProperties = { background: "rgba(255,255,255,0.94)", border: "1px solid #e2e8f0", borderRadius: 26, padding: "1.15rem", boxShadow: "0 18px 48px rgba(46,16,101,0.09)" };
const pill: CSSProperties = { display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.82rem", padding: "0.32rem 0.82rem", borderRadius: 9999, background: "#fef3c7", color: "#92400e", fontWeight: 900, marginBottom: "0.85rem" };
const miniStat: CSSProperties = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 16, padding: "0.75rem 0.85rem", color: "#334155", fontSize: "0.9rem", fontWeight: 800 };
const simpleLine: CSSProperties = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "0.7rem 0.8rem", color: "#334155", fontWeight: 800, marginBottom: "0.48rem" };
const actionCard: CSSProperties = { width: "100%", textAlign: "right", background: "#f8fafc", color: "#2e1065", border: "1px solid #ddd6fe", borderRadius: 16, padding: "0.85rem 1rem", fontWeight: 900, fontSize: "1rem" };
const guideCard: CSSProperties = { background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 18, padding: "0.9rem", position: "relative" };
const guideNumber: CSSProperties = { width: 34, height: 34, borderRadius: 14, background: "linear-gradient(135deg,#2e1065,#7c3aed)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 900, marginBottom: "0.45rem" };
