import { useMemo, useState } from "react";
import { Link } from "wouter";
import type { GameQuestion } from "@/lib/gameData";

export default function BuilderPage() {
  const [title, setTitle] = useState("My Arabic Letter Set");
  const [description, setDescription] = useState("Custom practice game");
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [qText, setQText] = useState("");
  const [qType, setQType] = useState<"letter" | "word">("letter");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [optionsText, setOptionsText] = useState("");

  const canAdd = qText.trim() && correctAnswer.trim() && optionsText.split(",").map((x) => x.trim()).filter(Boolean).length >= 2;

  const addQuestion = () => {
    if (!canAdd) return;
    const options = optionsText.split(",").map((x) => x.trim()).filter(Boolean);
    setQuestions((prev) => [...prev, { id: crypto.randomUUID(), text: qText, type: qType, correctAnswer, options }]);
    setQText(""); setCorrectAnswer(""); setOptionsText("");
  };

  const removeQuestion = (id: string) => setQuestions((prev) => prev.filter((q) => q.id !== id));

  const encoded = useMemo(() => encodeURIComponent(JSON.stringify({ title, description, questions })), [title, description, questions]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 to-indigo-100 py-8" dir="ltr">
      <div className="container grid lg:grid-cols-2 gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-lg border">
          <h1 className="text-3xl font-black text-violet-700 mb-4">Create Template</h1>
          <div className="space-y-3">
            <input className="kc-input !bg-white !text-slate-800" placeholder="Template title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="kc-input !bg-white !text-slate-800" placeholder="Template description" value={description} onChange={(e) => setDescription(e.target.value)} />
            <select className="kc-input !bg-white !text-slate-800" value={qType} onChange={(e) => setQType(e.target.value as "letter" | "word")}> <option value="letter">Letter</option><option value="word">Word</option></select>
            <input className="kc-input !bg-white !text-slate-800" placeholder="Question text" value={qText} onChange={(e) => setQText(e.target.value)} />
            <input className="kc-input !bg-white !text-slate-800" placeholder="Correct answer" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} />
            <input className="kc-input !bg-white !text-slate-800" placeholder="Answer options (comma separated)" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
            <button className="btn-gold" onClick={addQuestion} disabled={!canAdd}>Add question</button>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-lg border">
          <h2 className="text-2xl font-black text-violet-700">Preview template</h2>
          <p className="text-slate-600">{description}</p>
          <p className="mt-2 font-bold">Questions: {questions.length}</p>
          <div className="space-y-2 mt-4 max-h-72 overflow-auto">
            {questions.map((q, i) => (
              <article key={q.id} className="border rounded-xl p-3 bg-slate-50">
                <p className="font-bold">{i + 1}. {q.text}</p>
                <p className="text-sm">Options: {q.options.join("، ")}</p>
                <p className="text-sm">Correct: {q.correctAnswer}</p>
                <button className="btn-danger mt-2" onClick={() => removeQuestion(q.id)}>Remove question</button>
              </article>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={() => localStorage.setItem("kc-custom-template", JSON.stringify({ id: "custom-local", title, description, difficulty: "Beginner", category: "Revision", source: "custom", questions }))}>Save locally</button>
            <Link href={`/play/custom-local?load=${encoded}`} className={`btn-green ${questions.length ? "" : "pointer-events-none opacity-50"}`}>Start playing created template</Link>
            <Link href="/" className="btn-secondary">Home</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
