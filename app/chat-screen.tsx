"use client";

// The real chat screen. Layout and states are the prototype's (ticket 12 verdict:
// message layout, 4-second rotating examples that pause on hover and fill the input,
// loading dots, streaming cursor, error bubble with Retry/Dismiss), wired to
// POST /api/chat and its distinct limit messages.

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { SSEPayloadParser } from "@/lib/chat-stream";
import type { ChatStreamEvent } from "@/lib/chat-stream";

const EXAMPLE_QUESTIONS = [
  "What kind of backend work has Clint done recently?",
  "Has Clint shipped anything with Cloudflare or edge runtimes?",
  "What does Clint know about retrieval and embeddings?",
  "Where did Clint work before his current role?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Notice {
  text: string;
  tone: "limit" | "error";
  retryable: boolean;
}

/** One distinct message per refusal the gate can return (ticket 10). */
const LIMIT_NOTICES: Record<string, Notice> = {
  minute_limit: {
    text: "You're asking faster than this chat allows. Give it a minute, then try again.",
    tone: "limit",
    retryable: true,
  },
  daily_limit: {
    text: "That's all of today's questions. The limit resets at midnight UTC.",
    tone: "limit",
    retryable: false,
  },
  monthly_limit: {
    text: "You've reached this month's question limit — check back on the 1st.",
    tone: "limit",
    retryable: false,
  },
};

const GENERIC_NOTICE: Notice = {
  text: "Something went wrong answering that. Try again.",
  tone: "error",
  retryable: true,
};

async function refusalCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "server_error";
  } catch {
    return "server_error";
  }
}

function parseClientEvent(payload: string): ChatStreamEvent | null {
  try {
    return JSON.parse(payload) as ChatStreamEvent;
  } catch {
    return null;
  }
}

export function ChatScreen({
  name,
  onUnauthorised,
}: {
  name: string;
  onUnauthorised: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "streaming">("idle");
  const [notice, setNotice] = useState<Notice | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, answer, phase, notice]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function settle(transcript: Message[], next: Notice | null, kept: string) {
    setMessages(
      kept ? [...transcript, { role: "assistant", content: kept }] : transcript,
    );
    setNotice(next);
    setAnswer("");
    setPhase("idle");
  }

  async function ask(question: string, transcript: Message[]) {
    const abort = new AbortController();
    abortRef.current = abort;
    setMessages(transcript);
    setInput("");
    setAnswer("");
    setNotice(null);
    setPhase("loading");

    let response: Response;
    try {
      response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: transcript }),
        signal: abort.signal,
      });
    } catch {
      if (!abort.signal.aborted) settle(transcript, GENERIC_NOTICE, "");
      return;
    }

    if (!response.ok) {
      const code = await refusalCode(response);
      if (code === "unauthorised") {
        setPhase("idle");
        onUnauthorised();
        return;
      }
      settle(transcript, LIMIT_NOTICES[code] ?? GENERIC_NOTICE, "");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      settle(transcript, GENERIC_NOTICE, "");
      return;
    }

    const parser = new SSEPayloadParser();
    const decoder = new TextDecoder();
    let text = "";
    let failure = false;
    let finished = false;
    try {
      read: for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const payload of parser.push(
          decoder.decode(value, { stream: true }),
        )) {
          const event = parseClientEvent(payload);
          if (event?.type === "delta") {
            text += event.text;
            setAnswer(text);
            setPhase("streaming");
          } else if (event?.type === "error") {
            failure = true;
            break read;
          } else if (event?.type === "done") {
            finished = true;
            break read;
          }
        }
      }
    } catch {
      // The connection dropped mid-answer: whatever text arrived is kept.
    } finally {
      await reader.cancel().catch(() => {});
    }

    // A stream that stopped without `done` is a truncated answer, and a clean turn
    // with no text at all is a failure too — both take the generic bubble.
    if (failure || !finished || text === "") {
      settle(transcript, GENERIC_NOTICE, text);
      return;
    }
    settle(transcript, null, text);
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || phase !== "idle") return;
    ask(question, [...messages, { role: "user", content: question }]);
  }

  function retry() {
    const lastQuestion = messages.findLastIndex((m) => m.role === "user");
    if (lastQuestion === -1) return;
    const transcript = messages.slice(0, lastQuestion + 1);
    ask(transcript[lastQuestion].content, transcript);
  }

  const busy = phase !== "idle";

  return (
    <section className="flex flex-1 flex-col">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h1 className="text-lg font-semibold">Clint&apos;s resume chat</h1>
        <p className="text-xs text-neutral-500">signed in as {name}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto">
        {messages.length === 0 && phase === "idle" && (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
            <h2 className="text-lg font-semibold">
              Ask about Clint&apos;s resume
            </h2>
            <p className="mt-2 max-w-sm text-sm text-neutral-600 dark:text-neutral-400">
              Answers come only from the resume document — grounding, not vibes.
              If it isn&apos;t on the resume, the app says so.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {phase === "loading" && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-neutral-100 px-4 py-2 text-sm dark:bg-neutral-800">
              <span className="inline-flex gap-1">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
            </div>
          </div>
        )}

        {phase === "streaming" && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-2 text-sm whitespace-pre-wrap dark:bg-neutral-800">
              {answer}
              <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-neutral-500 align-middle" />
            </div>
          </div>
        )}

        {notice && phase === "idle" && (
          <div className="flex justify-start">
            <div
              className={`max-w-[85%] rounded-2xl border px-4 py-2 text-sm ${
                notice.tone === "limit"
                  ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
                  : "border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              <p>{notice.text}</p>
              <div className="mt-2 flex gap-2">
                {notice.retryable && (
                  <button
                    onClick={retry}
                    className="rounded border border-current px-2 py-1 font-medium hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    Retry
                  </button>
                )}
                <button
                  onClick={() => setNotice(null)}
                  className="rounded border border-current/50 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-1 dark:from-neutral-950 dark:via-neutral-950">
        <RotatingExamples onPick={setInput} />
        <form onSubmit={send} className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              busy ? "Waiting for the answer…" : "Ask about the resume…"
            }
            disabled={busy}
            className="flex-1 rounded-full border border-neutral-400 px-4 py-2 text-sm disabled:opacity-50 dark:border-neutral-600"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            Ask
          </button>
        </form>
      </div>
    </section>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-500"
      style={{ animationDelay: delay }}
    />
  );
}

function RotatingExamples({ onPick }: { onPick: (question: string) => void }) {
  // Conveyor-style rotation: each tick, the outgoing pill's width is measured,
  // the new pill is laid out right after it, and the row slides left by exactly
  // that distance — the incoming question visibly pushes the old one off-screen.
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
