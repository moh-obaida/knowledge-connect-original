import { useMemo, useRef, useState } from "react";
import type { GameTemplate } from "@/lib/gameData";
import { Link } from "wouter";
import { allTemplates } from "@/lib/gameData";

const SKIP_FEEDBACK_MS = 450;

export default function PlayPage({ params }: { params: { templateId: string } }) {
  const search = new URLSearchParams(window.location.search);
  const isPreviewMode = search.get("preview") === "1";

  const template = useMemo(() => {
    if (params.templateId === "custom-local") {
      const fromQuery = search.get("load");
      if (fromQuery) return JSON.parse(decodeURIComponent(fromQuery)) as GameTemplate;
      const local = localStorage.getItem("kc-custom-template");
      return local ? (JSON.parse(local) as GameTemplate) : undefined;
    }
    return allTemplates.find((x) => x.id === params.templateId);
  }, [params.templateId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);
  const skipTimer = useRef<number | null>(null);

  if (!template) return <main className="p-8">Template not found. <Link href="/templates">Go back</Link></main>;

  const total = template.questions.length;
  const question = template.questions[currentIndex];
  const isFinished = currentIndex >= total;
  const progress = Math.round((Math.min(currentIndex, total) / total) * 100);

  const moveNext = () => {
    if (skipTimer.current) {
      window.clearTimeout(skipTimer.current);
      skipTimer.current = null;
    }
    setSelected(null);
    setFeedback(null);
    setIsAutoAdvancing(false);
    setCurrentIndex((n) => n + 1);
  };

  const answer = (option: string) => {
    if (selected || isFinished || isAutoAdvancing) return;
    setSelected(option);
    if (option === question.correctAnswer) {
      setScore((s) => s + 10);
      setCorrectCount((c) => c + 1);
      setFeedback("Amazing! You found it!");
    } else {
      setFeedback("Nice try! Let’s learn it together.");
    }
  };

  const skip = () => {
    if (isFinished || isAutoAdvancing) return;
    setSelected(null);
    setSkipped((s) => s + 1);
    setFeedback("No worries, skip and keep going!");
    setIsAutoAdvancing(true);
    skipTimer.current = window.setTimeout(() => moveNext(), SKIP_FEEDBACK_MS);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-rose-50 to-cyan-100 py-6" dir="ltr">
      <div className="container max-w-3xl">
        {!isFinished ? (
          <section className="rounded-3xl bg-white p-6 shadow-xl border border-violet-100">
            {isPreviewMode && <p className="mb-3 text-sm font-bold text-cyan-700">Preview mode</p>}
            <div className="flex flex-wrap gap-2 justify-between text-sm font-bold mb-3">
              <span>Question {currentIndex + 1} / {total}</span>
              <span>Score: {score}</span>
              <span>Skipped: {skipped}</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-5">
              <div className="h-full bg-violet-500" style={{ width: `${progress}%` }} />
            </div>
            <h1 className="text-2xl font-black text-violet-700 mb-4">{question.text}</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {question.options.map((option) => {
                const isCorrect = selected && option === question.correctAnswer;
                const isWrong = selected === option && option !== question.correctAnswer;
                return (
                  <button
                    key={option}
                    onClick={() => answer(option)}
                    disabled={!!selected || isAutoAdvancing}
                    className={`rounded-2xl p-5 text-3xl font-black border-2 transition ${isCorrect ? "bg-green-100 border-green-400" : isWrong ? "bg-rose-100 border-rose-400" : "bg-violet-50 border-violet-200 hover:bg-violet-100"}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {feedback && <p className="mt-4 font-bold text-lg text-slate-700">{feedback}</p>}
            <div className="mt-5 flex gap-2 flex-wrap">
              <button className="btn-secondary" onClick={skip} disabled={isAutoAdvancing}>Skip question</button>
              <button className="btn-gold" disabled={!selected || isAutoAdvancing} onClick={moveNext}>Next</button>
              <Link href="/templates" className="btn-secondary">Templates</Link>
            </div>
          </section>
        ) : (
          <section className="rounded-3xl bg-white p-7 shadow-xl border border-violet-100 text-center">
            <h2 className="text-3xl font-black text-violet-700">Great game!</h2>
            <p className="mt-4 text-lg">Final score: <strong>{score}</strong></p>
            <p>Correct answers: <strong>{correctCount}</strong> / {total}</p>
            <p>Skipped questions: <strong>{skipped}</strong></p>
            <p>Progress complete: <strong>100%</strong></p>
            <p className="mt-3 text-slate-600">You are doing amazing. Keep practicing your Arabic letters! 🌟</p>
            <div className="mt-6 flex gap-3 justify-center flex-wrap">
              <Link href={`/play/${template.id}`} className="btn-gold">Play again</Link>
              <Link href="/templates" className="btn-secondary">Choose another template</Link>
              <Link href="/" className="btn-green">Home</Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
