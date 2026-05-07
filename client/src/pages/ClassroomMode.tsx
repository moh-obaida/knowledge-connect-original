import { useState } from "react";
import { createMockSession, generateCode } from "../lib/mockSessionService";
import { generateMockQuestions } from "../lib/mockAiHelperService";
import type { AiRequest, ClassroomSession } from "../lib/sessionTypes";
import { useAppSettings } from "../hooks/useAppSettings";

export default function ClassroomMode() {
  const [tab, setTab] = useState<"teacher"|"student"|"display"|"ai">("teacher");
  const [session, setSession] = useState<ClassroomSession>(createMockSession());
  const [studentName, setStudentName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [joined, setJoined] = useState(false);
  const [msg, setMsg] = useState("");
  const [aiReq, setAiReq] = useState<AiRequest>({ topic:"الحروف", subject:"لغة عربية", grade:"الصف الأول", count:5, questionType:"mcq", language:"ar", difficulty:"easy" });
  const [aiOut, setAiOut] = useState<any[]>([]);
  const { settings, update, textScale } = useAppSettings();

  return (
    <div className="container" style={{ paddingTop:"1rem", paddingBottom:"2rem", fontSize:`${textScale}rem` }}>
      <div className="kc-card" style={{ marginBottom:"0.75rem" }}>
        <div className="section-title">وضع الفصل <span style={{fontSize:"0.75rem",color:"#94a3b8"}}>ميزة تجريبية • تجربة محلية • اللعب الجماعي الحقيقي غير مفعّل حالياً</span></div>
        <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>{[{k:"teacher",l:"المعلم"},{k:"student",l:"الطالب"},{k:"display",l:"شاشة العرض"},{k:"ai",l:"المساعد الذكي"}].map(t=><button key={t.k} className="btn-secondary" onClick={()=>setTab(t.k as any)}>{t.l}</button>)}</div>
        <div style={{ display:"flex", gap:"0.65rem", flexWrap:"wrap", marginTop:"0.5rem", color:"#94a3b8", fontSize:"0.8rem" }}>
          <label><input type="checkbox" checked={settings.colorBlindMode} onChange={e=>update({ colorBlindMode:e.target.checked })} /> وضع عمى الألوان</label>
          <label><input type="checkbox" checked={settings.reducedMotion} onChange={e=>update({ reducedMotion:e.target.checked })} /> تقليل الحركة</label>
          <label><input type="checkbox" checked={settings.largerText} onChange={e=>update({ largerText:e.target.checked })} /> تكبير النص</label>
        </div>
      </div>

      {tab==="teacher" && <div className="kc-card"><div className="section-title">وضع المعلم</div>
        <div style={{display:"grid",gap:"0.45rem"}}>
          <input className="kc-input" aria-label="عنوان الجلسة" value={session.title} onChange={e=>setSession({...session,title:e.target.value})} placeholder="عنوان الجلسة" />
          <input className="kc-input" aria-label="القالب" value={session.templateName} onChange={e=>setSession({...session,templateName:e.target.value})} placeholder="القالب المختار" />
          <select className="kc-input" value={session.mode} onChange={e=>setSession({...session,mode:e.target.value as any})}><option value="classic">الوضع الكلاسيكي</option><option value="timed">الوضع المؤقت</option><option value="practice">وضع التدريب</option><option value="challenge">وضع التحدي</option></select>
          <div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}><label><input type="checkbox" checked={session.allowSkips} onChange={e=>setSession({...session,allowSkips:e.target.checked})}/> السماح بالتخطي</label><label><input type="checkbox" checked={session.showAnswer} onChange={e=>setSession({...session,showAnswer:e.target.checked})}/> عرض الإجابات</label></div>
          <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
            <button className="btn-secondary" onClick={()=>{ setSession({...session,code:generateCode()}); setMsg("تم إنشاء الجلسة التجريبية."); }}>توليد الكود</button>
            <button className="btn-gold" onClick={()=>{ if(!session.title.trim()) return setMsg("لا توجد جلسة فصل حالياً."); setSession({...session,status:"active"}); setMsg("تم حفظ الإعدادات."); }}>بدء الجلسة</button>
            <button className="btn-danger" onClick={()=>{ setSession({...session,status:"ended"}); setMsg("هذه العملية ضمن تجربة محلية."); }}>إنهاء الجلسة</button>
          </div>
        </div>
        <div style={{marginTop:"0.8rem",fontSize:"0.85rem",color:"#94a3b8"}}>معاينة غرفة الانتظار: الكود {session.code} • عدد الطلاب {session.players.length}</div>
      </div>}

      {tab==="student" && <div className="kc-card"><div className="section-title">انضمام الطالب (تجربة محلية)</div>
        {!joined ? <div style={{display:"grid",gap:"0.45rem",maxWidth:420}}><input className="kc-input" value={studentCode} onChange={e=>setStudentCode(e.target.value)} placeholder="كود اللعبة"/><input className="kc-input" value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="اسم الطالب"/><button className="btn-gold" onClick={()=>{ if(studentCode.length<4) return setMsg("تنسيق الملف غير صالح."); if(!studentName.trim()) return setMsg("يرجى إدخال الاسم."); setJoined(true); setMsg("تم إنشاء الجلسة التجريبية."); }}>انضمام الطالب</button></div> : <div style={{color:"#94a3b8"}}>مرحبًا {studentName || "طالب"} — بانتظار بدء المعلم. جاهز ✅</div>}
      </div>}

      {tab==="display" && <div className="kc-card" style={{ textAlign:"center" }}><div style={{fontSize:"2rem",fontWeight:900,color:"#f59e0b"}}>{session.code}</div><div style={{fontSize:"1.2rem",color:"#f0ede8"}}>{session.title}</div><div style={{color:"#94a3b8"}}>{session.templateName} • {session.mode} • س 1/10</div><div style={{fontSize:"2.1rem",fontWeight:900,marginTop:"0.5rem"}}>{session.timerSec}ث</div><div style={{display:"flex",gap:"0.4rem",justifyContent:"center",marginTop:"0.6rem"}}><button className="btn-secondary" onClick={()=>setSession({...session,status:"active"})}>بدء</button><button className="btn-secondary" onClick={()=>setSession({...session,timerSec:Math.max(0,session.timerSec-1)})}>التالي</button><button className="btn-danger" onClick={()=>setSession({...session,status:"ended"})}>إنهاء</button></div><div style={{fontSize:"0.78rem",color:"#94a3b8",marginTop:"0.5rem"}}>ملخص نتائج تجريبي • ميزة تجريبية</div></div>}

      {tab==="ai" && <div className="kc-card"><div className="section-title">مساعد الذكاء الاصطناعي التجريبي</div>
        <div style={{fontSize:"0.8rem",color:"#94a3b8",marginBottom:"0.6rem"}}>يمكن ربط الذكاء الاصطناعي لاحقاً • بيانات تجريبية محلية فقط</div>
        <div style={{display:"grid",gap:"0.45rem",maxWidth:520}}>
          <input className="kc-input" value={aiReq.topic} onChange={e=>setAiReq({...aiReq,topic:e.target.value})} placeholder="الموضوع"/>
          <input className="kc-input" value={aiReq.subject} onChange={e=>setAiReq({...aiReq,subject:e.target.value})} placeholder="المادة"/>
          <input className="kc-input" value={aiReq.grade} onChange={e=>setAiReq({...aiReq,grade:e.target.value})} placeholder="الصف/المستوى"/>
          <input className="kc-input" type="number" min={1} max={20} value={aiReq.count} onChange={e=>setAiReq({...aiReq,count:Number(e.target.value)||5})} placeholder="عدد الأسئلة"/>
          <div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}>{["توليد أسئلة","تحسين صياغة السؤال","اقتراح خيارات الإجابة","اقتراح مشتتات","ترجمة الأسئلة","إنشاء اختبار الحروف العربية","إنشاء اختبار القيم الإسلامية","إنشاء اختبار المفردات"].map(a=><button key={a} className="btn-secondary" onClick={()=>{ if(!aiReq.topic.trim()) return setMsg("يرجى إدخال الموضوع أولاً."); setAiOut(generateMockQuestions(aiReq)); setMsg("تم إنشاء نتيجة تجريبية."); }}>{a}</button>)}</div>
        </div>
        {aiOut.length>0 && <div style={{marginTop:"0.7rem",display:"grid",gap:"0.35rem"}}>{aiOut.map((q,i)=><div key={i} className="badge-chip">{q.question} — {q.answer}</div>)}</div>}
        {aiOut.length===0 && <div style={{marginTop:"0.7rem", color:"#94a3b8", fontSize:"0.85rem"}}>لا توجد مخرجات تجريبية بعد.</div>}
      </div>}

      {msg && <div className="kc-card" style={{ marginTop:"0.6rem", color:"#facc15" }}>{msg}</div>}
    </div>
  );
}
