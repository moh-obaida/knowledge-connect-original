type TemplateLike = {
  name: string;
  categories: string[];
  level: string;
  questions: string[];
  language?: "ar" | "en";
  boardBanks?: Array<{ label: string; questionBank: any[] }>;
  userCreated?: boolean;
};

import { useLanguage } from "@/hooks/useLanguage";
import { getLabelForValue } from "@/lib/i18n";

export default function TemplatePreviewModal({ previewTemplate, onClose }: { previewTemplate: TemplateLike; onClose: () => void }) {
  const { t, language } = useLanguage();
  const questions = (previewTemplate.boardBanks?.flatMap(b=>b.questionBank.map((q:any)=>q)) || previewTemplate.questions.map((q:any)=>({ question:q, type:"fill" })));
  const covered = previewTemplate.boardBanks ? previewTemplate.boardBanks.filter(b=>b.questionBank?.length).length : undefined;
  const coveredLabel = typeof covered === 'number' ? (covered === 0 && questions.length > 0 ? t('common.notSpecified') : String(covered)) : t('common.notSpecified');
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: 560, width:"min(560px, 92vw)", maxHeight:"85vh", overflowY:"auto" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontWeight:800, color:"#f59e0b", marginBottom:"0.45rem" }}>{t('template.preview')}</div>
        <div style={{ fontWeight:700, color:"#f0ede8", marginBottom:"0.35rem" }}>{previewTemplate.name}</div>
        <div style={{ fontSize:"0.8rem", color:"#94a3b8", marginBottom:"0.8rem" }}>
          {t('template.questions')}: {previewTemplate.boardBanks?.reduce((n,b)=>n+(b.questionBank?.length||0),0) || previewTemplate.questions.length} • {t('template.covered')}: {coveredLabel} • {language === 'ar' ? 'اللغة' : 'Language'}: {previewTemplate.language === 'en' ? t('template.languageEnglish') : t('template.languageArabic')}
        </div>
        {previewTemplate.boardBanks && previewTemplate.boardBanks.length > 0 && (
          <div style={{ fontSize:"0.75rem", color:"#64748b", marginBottom:"0.55rem" }}>
            {previewTemplate.boardBanks.filter(b=>b.questionBank?.length).slice(0,6).map(b=>`${b.label}: ${b.questionBank.length}`).join(" • ")}
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:"0.35rem", marginBottom:"0.8rem" }}>
          {questions.slice(0,5).map((q:any, i)=>(
            <div key={i} style={{ fontSize:"0.86rem", color:"#f0ede8" }}>{i+1}. {q.question || q.prompt || "—"} — {getLabelForValue('qtype', q.type || 'fill', language)}</div>
          ))}
        </div>
        {(previewTemplate.boardBanks?.flatMap(b=>b.questionBank||[]) || []).some((q:any)=>q.type==="image" && !q.imageUrl) && (
          <div style={{ fontSize:"0.78rem", color:"#f59e0b", marginBottom:"0.6rem" }}>سؤال الصورة لا يحتوي على صورة بعد، سيتم عرض عنصر بديل.</div>
        )}
        <button className="btn-secondary" onClick={onClose}>{t('common.close')}</button>
      </div>
    </div>
  );
}
