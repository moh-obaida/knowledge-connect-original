import { Link } from "wouter";
import { communityTemplates, officialTemplates } from "@/lib/gameData";

const features = [
  { title: "Learn letters", text: "Big Arabic letters and clear choices help kids build confidence." },
  { title: "Practice sounds", text: "Simple sound-focused questions support early reading skills." },
  { title: "Play at your own pace", text: "Skip any question and keep moving without getting stuck." },
];

export default function HomePage() {
  const featured = [...officialTemplates.slice(0, 3), ...communityTemplates.slice(0, 2)];

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 to-violet-100 text-slate-800">
      <main className="container py-10 space-y-10" dir="ltr">
        <section className="rounded-3xl bg-white/85 border border-white shadow-xl p-8 md:p-10">
          <h1 className="text-4xl md:text-5xl font-black text-violet-700">Knowledge Connect</h1>
          <p className="text-lg mt-2 text-slate-600">Practice Arabic letters through fun mini-games.</p>
          <p className="mt-4 max-w-3xl text-slate-700">Welcome! Students can play ready-made templates or create their own Arabic-letter practice set. Everything is simple, colorful, and made for young learners.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/play/haa-waw-yaa" className="btn-gold !rounded-full">Start Playing</Link>
            <Link href="/templates" className="btn-secondary !rounded-full">Explore Templates</Link>
            <Link href="/create" className="btn-green !rounded-full">Create Template</Link>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          {features.map((f) => (
            <article key={f.title} className="rounded-3xl bg-white p-6 shadow-lg border border-violet-100">
              <div className="text-4xl mb-3">🫧</div>
              <h3 className="font-extrabold text-xl text-violet-700">{f.title}</h3>
              <p className="mt-2 text-slate-600">{f.text}</p>
            </article>
          ))}
        </section>

        <section>
          <h2 className="text-2xl font-black text-violet-700 mb-4">Featured Templates</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((tpl) => (
              <article key={tpl.id} className="rounded-2xl bg-white p-5 shadow-md border border-violet-100">
                <p className="text-xs font-bold text-pink-600 uppercase tracking-wide">{tpl.source}</p>
                <h3 className="text-lg font-extrabold mt-1">{tpl.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{tpl.description}</p>
                <div className="mt-4 flex justify-between text-sm">
                  <span>Questions: {tpl.questions.length}</span>
                  <Link href={`/play/${tpl.id}`} className="text-violet-700 font-bold">Play →</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
