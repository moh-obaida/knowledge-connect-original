type TemplateLike = {
  name: string;
  categories: string[];
  level: string;
  questions: string[];
  boardBanks?: Array<{ label: string; questionBank: any[] }>;
};

export default function TemplatePreviewModal({ previewTemplate, onClose }: { previewTemplate: TemplateLike; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 560, width:"min(560px, 92vw)", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontWeight:800, color:"#f59e0b", marginBottom:"0.45rem" }}>Preview Template</div>
        <div style={{ fontWeight:700, color:"#f0ede8", marginBottom:"0.35rem" }}>{previewTemplate.name}</div>
        <div style={{ fontSize:"0.8rem", color:"#94a3b8", marginBottom:"0.8rem" }}>
          التصنيف: {previewTemplate.categories.join("، ")} • المستوى: {previewTemplate.level} • Questions: {previewTemplate.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || previewTemplate.questions.length} • Letters covered: {previewTemplate.boardBanks?.filter(b=>b.questionBank?.length).length || 0}
        </div>
        {previewTemplate.boardBanks && previewTemplate.boardBanks.length > 0 && (
          <div style={{ fontSize:"0.75rem", color:"#64748b", marginBottom:"0.55rem" }}>
            {previewTemplate.boardBanks.filter(b=>b.questionBank?.length).slice(0,6).map(b=>`${b.label}: ${b.questionBank.length}`).join(" • ")}
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:"0.35rem", marginBottom:"0.8rem" }}>
          {(previewTemplate.boardBanks?.flatMap(b=>b.questionBank.map((q:any)=>q)) || previewTemplate.questions.map((q:any)=>({ question:q, type:"fill" }))).slice(0,5).map((q:any, i)=>(
            <div key={i} style={{ fontSize:"0.86rem", color:"#f0ede8" }}>• [{q.type || "fill"}] {q.question || q.prompt || "—"}</div>
          ))}
        </div>
        {(previewTemplate.boardBanks?.flatMap(b=>b.questionBank||[]) || []).some((q:any)=>q.type==="image" && !q.imageUrl) && (
          <div style={{ fontSize:"0.78rem", color:"#f59e0b", marginBottom:"0.6rem" }}>This image question has no image yet, so a placeholder will be shown.</div>
        )}
        <button className="btn-secondary" onClick={onClose}>Back</button>
      </div>
    </div>
  );
}
