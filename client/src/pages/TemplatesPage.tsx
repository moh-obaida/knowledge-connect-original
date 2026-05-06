import { useMemo, useState } from "react";
import { Link } from "wouter";
import { allTemplates } from "@/lib/gameData";

const filters = ["All", "Beginner", "Sounds", "Shapes", "Words", "Revision"] as const;

export default function TemplatesPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const templates = useMemo(() => allTemplates.filter((t) => filter === "All" || t.category === filter), [filter]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-amber-50 to-sky-100 py-8" dir="ltr">
      <div className="container">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-3xl font-black text-violet-700">Templates Library</h1>
          <Link href="/" className="btn-secondary">Home</Link>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          {filters.map((item) => (
            <button key={item} onClick={() => setFilter(item)} className={`px-4 py-2 rounded-full border font-bold ${filter === item ? "bg-violet-600 text-white" : "bg-white text-slate-700"}`}>
              {item}
            </button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <article key={tpl.id} className="rounded-3xl bg-white p-5 shadow-lg border border-violet-100">
              <h2 className="text-xl font-extrabold">{tpl.title}</h2>
              <p className="text-slate-600 mt-1">{tpl.description}</p>
              <div className="mt-3 text-sm space-y-1">
                <p><strong>Questions:</strong> {tpl.questions.length}</p>
                <p><strong>Difficulty:</strong> {tpl.difficulty}</p>
                <p><strong>Category:</strong> {tpl.category}</p>
              </div>
              <div className="mt-4 flex gap-2">
                <Link href={`/play/${tpl.id}`} className="btn-gold">Play</Link>
                <Link href={`/play/${tpl.id}?preview=1`} className="btn-secondary">Preview</Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
