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
        <div className="section-title">Classroom Mode <span style={{fontSize:"0.75rem",color:"#94a3b8"}}>Prototype • Local demo • No real multiplayer yet</span></div>
        <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>{["teacher","student","display","ai"].map(t=><button key={t} className="btn-secondary" onClick={()=>setTab(t as any)}>{t}</button>)}</div>
        <div style={{ display:"flex", gap:"0.65rem", flexWrap:"wrap", marginTop:"0.5rem", color:"#94a3b8", fontSize:"0.8rem" }}>
          <label><input type="checkbox" checked={settings.colorBlindMode} onChange={e=>update({ colorBlindMode:e.target.checked })} /> Color-blind mode</label>
          <label><input type="checkbox" checked={settings.reducedMotion} onChange={e=>update({ reducedMotion:e.target.checked })} /> Reduced motion</label>
          <label><input type="checkbox" checked={settings.largerText} onChange={e=>update({ largerText:e.target.checked })} /> Larger text</label>
        </div>
      </div>

      {tab==="teacher" && <div className="kc-card"><div className="section-title">Teacher Mode</div>
        <div style={{display:"grid",gap:"0.45rem"}}>
          <input className="kc-input" aria-label="session title" value={session.title} onChange={e=>setSession({...session,title:e.target.value})} placeholder="Session title" />
          <input className="kc-input" aria-label="template" value={session.templateName} onChange={e=>setSession({...session,templateName:e.target.value})} placeholder="Selected template" />
          <select className="kc-input" value={session.mode} onChange={e=>setSession({...session,mode:e.target.value as any})}><option value="classic">Classic Mode</option><option value="timed">Timed Mode</option><option value="practice">Practice Mode</option><option value="challenge">Challenge Mode</option></select>
          <div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}><label><input type="checkbox" checked={session.allowSkips} onChange={e=>setSession({...session,allowSkips:e.target.checked})}/> allow skips</label><label><input type="checkbox" checked={session.showAnswer} onChange={e=>setSession({...session,showAnswer:e.target.checked})}/> show answers</label></div>
          <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
            <button className="btn-secondary" onClick={()=>{ setSession({...session,code:generateCode()}); setMsg("Mock session created."); }}>Generate code</button>
            <button className="btn-gold" onClick={()=>{ if(!session.title.trim()) return setMsg("No classroom session yet."); setSession({...session,status:"active"}); setMsg("Settings saved."); }}>Start session</button>
            <button className="btn-danger" onClick={()=>{ setSession({...session,status:"ended"}); setMsg("This action is a local prototype."); }}>End session</button>
          </div>
        </div>
        <div style={{marginTop:"0.8rem",fontSize:"0.85rem",color:"#94a3b8"}}>Waiting room preview: Code {session.code} • Players {session.players.length}</div>
      </div>}

      {tab==="student" && <div className="kc-card"><div className="section-title">Student Join (Local demo)</div>
        {!joined ? <div style={{display:"grid",gap:"0.45rem",maxWidth:420}}><input className="kc-input" value={studentCode} onChange={e=>setStudentCode(e.target.value)} placeholder="Game code"/><input className="kc-input" value={studentName} onChange={e=>setStudentName(e.target.value)} placeholder="Player name"/><button className="btn-gold" onClick={()=>{ if(studentCode.length<4) return setMsg("Invalid file format."); if(!studentName.trim()) return setMsg("Please enter a player name."); setJoined(true); setMsg("Mock session created."); }}>Student Join</button></div> : <div style={{color:"#94a3b8"}}>Hi {studentName || "Student"} — waiting for teacher to start. Ready ✅</div>}
      </div>}

      {tab==="display" && <div className="kc-card" style={{ textAlign:"center" }}><div style={{fontSize:"2rem",fontWeight:900,color:"#f59e0b"}}>{session.code}</div><div style={{fontSize:"1.2rem",color:"#f0ede8"}}>{session.title}</div><div style={{color:"#94a3b8"}}>{session.templateName} • {session.mode} • Q 1/10</div><div style={{fontSize:"2.1rem",fontWeight:900,marginTop:"0.5rem"}}>{session.timerSec}s</div><div style={{display:"flex",gap:"0.4rem",justifyContent:"center",marginTop:"0.6rem"}}><button className="btn-secondary" onClick={()=>setSession({...session,status:"active"})}>Start</button><button className="btn-secondary" onClick={()=>setSession({...session,timerSec:Math.max(0,session.timerSec-1)})}>Next</button><button className="btn-danger" onClick={()=>setSession({...session,status:"ended"})}>End</button></div><div style={{fontSize:"0.78rem",color:"#94a3b8",marginTop:"0.5rem"}}>Results summary placeholder • Prototype</div></div>}

      {tab==="ai" && <div className="kc-card"><div className="section-title">AI Helper (Prototype)</div>
        <div style={{fontSize:"0.8rem",color:"#94a3b8",marginBottom:"0.6rem"}}>AI connection coming later • Local mock output only</div>
        <div style={{display:"grid",gap:"0.45rem",maxWidth:520}}>
          <input className="kc-input" value={aiReq.topic} onChange={e=>setAiReq({...aiReq,topic:e.target.value})} placeholder="topic"/>
          <input className="kc-input" value={aiReq.subject} onChange={e=>setAiReq({...aiReq,subject:e.target.value})} placeholder="subject"/>
          <input className="kc-input" value={aiReq.grade} onChange={e=>setAiReq({...aiReq,grade:e.target.value})} placeholder="grade/level"/>
          <input className="kc-input" type="number" min={1} max={20} value={aiReq.count} onChange={e=>setAiReq({...aiReq,count:Number(e.target.value)||5})} placeholder="count"/>
          <div style={{display:"flex",gap:"0.45rem",flexWrap:"wrap"}}>{["Generate Questions","Improve Question Wording","Suggest Answer Choices","Suggest Distractors","Translate Questions","Create Arabic Letters Quiz","Create Islamic Values Quiz","Create Vocabulary Quiz"].map(a=><button key={a} className="btn-secondary" onClick={()=>{ if(!aiReq.topic.trim()) return setMsg("⚠ أدخل موضوعًا أولاً"); setAiOut(generateMockQuestions(aiReq)); setMsg("✨ Mock output generated"); }}>{a}</button>)}</div>
        </div>
        {aiOut.length>0 && <div style={{marginTop:"0.7rem",display:"grid",gap:"0.35rem"}}>{aiOut.map((q,i)=><div key={i} className="badge-chip">{q.question} — {q.answer}</div>)}</div>}
        {aiOut.length===0 && <div style={{marginTop:"0.7rem", color:"#94a3b8", fontSize:"0.85rem"}}>No AI output yet.</div>}
      </div>}

      {msg && <div className="kc-card" style={{ marginTop:"0.6rem", color:"#facc15" }}>{msg}</div>}
    </div>
  );
}
