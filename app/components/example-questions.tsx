"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const EXAMPLE_QUESTIONS = [
  "What kind of backend work has Clint done recently?",
  "Has Clint shipped anything with Cloudflare or edge runtimes?",
  "What does Clint know about retrieval and embeddings?",
  "Where did Clint work before his current role?",
];

/** ↘ hint that clicking a question puts it into the input. */
function ArrowDownRight() {
  return (
    <svg
      aria-hidden
      className="size-3 shrink-0 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7l10 10" />
      <path d="M17 7v10H7" />
    </svg>
  );
}

// Conveyor-style rotation: each tick, the outgoing pill's width is measured,
// the new pill is laid out right after it, and the row slides left by exactly
// that distance — the incoming question visibly pushes the old one off-screen.
export function RotatingExamples({
  onPick,
}: {
  onPick: (question: string) => void;
}) {
  const [slot, setSlot] = useState<{
    index: number;
    leaving: number | null;
    push: number;
  }>({ index: 0, leaving: null, push: 0 });
  const [paused, setPaused] = useState(false);
  const currentRef = useRef<HTMLButtonElement>(null);
  const { index, leaving, push } = slot;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setSlot((current) => ({
        index: (current.index + 1) % EXAMPLE_QUESTIONS.length,
        leaving: current.index,
        push: (currentRef.current?.getBoundingClientRect().width ?? 0) + 8,
      }));
    }, 4000);
    return () => clearInterval(id);
  }, [paused]);

  // Drop the outgoing question once the slide has finished.
  useEffect(() => {
    if (leaving === null) return;
    const timeout = setTimeout(() => {
      setSlot((current) => ({ ...current, leaving: null }));
    }, 500);
    return () => clearTimeout(timeout);
  }, [leaving]);

  const pillClass =
    "flex cursor-pointer items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-xs whitespace-nowrap dark:border-neutral-600";

  return (
    <div
      className="mb-2 flex items-center gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="@container relative h-7 flex-1 overflow-hidden">
        <div
          key={index}
          className={`absolute inset-y-0 left-0 flex items-center gap-2 ${
            leaving !== null ? "animate-example-push" : ""
          }`}
          style={{ "--push": `${push}px` } as CSSProperties}
        >
          {leaving !== null && (
            <button
              aria-hidden
              onClick={() => onPick(EXAMPLE_QUESTIONS[leaving])}
              className={`${pillClass} pointer-events-none`}
            >
              {EXAMPLE_QUESTIONS[leaving]}
              <ArrowDownRight />
            </button>
          )}
          <button
            ref={currentRef}
            onClick={() => onPick(EXAMPLE_QUESTIONS[index])}
            className={pillClass}
          >
            {EXAMPLE_QUESTIONS[index]}
            <ArrowDownRight />
          </button>
        </div>
      </div>
    </div>
  );
}
