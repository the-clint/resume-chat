"use client";

// THROWAWAY PROTOTYPE (ticket 12) — fake data, simulated streaming, no real
// token gate or LLM. Everything here is meant to be reacted to, then deleted.

import { useEffect, useRef, useState } from "react";

const DEMO_TOKEN = "demo";

const EXAMPLE_QUESTIONS = [
  "What kind of backend work has Clint done recently?",
  "Has Clint shipped anything with Cloudflare or edge runtimes?",
  "What does Clint know about retrieval and embeddings?",
  "Where did Clint work before his current role?",
];

const CANNED_ANSWER =
  "Most recently Clint built the retrieval pipeline you're reading this from: the resume is chunked by section, embedded with the local embed script, and stored in Cloudflare Vectorize. At query time the top 3 chunks are retrieved and stuffed into the system prompt alongside the question, and the answer streams back from OpenRouter. It's deliberately retrieval over stuffing — the single-document constraint is the whole point of the portfolio piece.";

type Screen = "token" | "chat";
type Phase = "idle" | "loading" | "streaming" | "error";

export default function ProtoPage() {
  const [screen, setScreen] = useState<Screen>("token");

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      <ProtoBanner screen={screen} setScreen={setScreen} />
      {screen === "token" ? (
        <TokenScreen onPass={() => setScreen("chat")} />
      ) : (
        <ChatScreen />
      )}
    </main>
  );
}

function ProtoBanner({
  screen,
  setScreen,
}: {
  screen: Screen;
  setScreen: (s: Screen) => void;
}) {
  return (
    <div className="mb-8 rounded-lg border border-dashed border-neutral-400 bg-neutral-50 p-4 text-sm dark:border-neutral-700 dark:bg-neutral-900">
      <p className="font-semibold">
        Throwaway prototype (ticket 12) — none of this is the real app.
      </p>
      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
        Token screen hint: pass with{" "}
        <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
          demo
        </code>
        ; anything else shows the wrong-token state.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setScreen(screen === "token" ? "chat" : "token")}
          className="rounded border border-neutral-400 px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
        >
          {screen === "token"
            ? "→ skip to chat screen"
            : "→ back to token screen"}
        </button>
        <span className="self-center text-xs text-neutral-500">
          (in the real app the token screen is the gate; this button is
          prototype-only)
        </span>
      </div>
    </div>
  );
}

function TokenScreen({ onPass }: { onPass: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() === DEMO_TOKEN) {
      onPass();
    } else {
      setError(true);
    }
  }

  return (
    <section className="flex flex-1 flex-col items-center justify-center">
      <div className="w-full max-w-sm rounded-xl border border-neutral-300 p-8 shadow-sm dark:border-neutral-700">
        <h1 className="text-xl font-semibold">Clint&apos;s resume chat</h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          This chat costs real money per question — every turn is an LLM call
          over retrieved resume chunks. The token keeps a public link from
          turning into an open tab on Clint&apos;s bill, not from keeping anyone
          out: ask him for it, paste it, and start.
        </p>
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="proto-token" className="block text-sm font-medium">
            Access token
          </label>
          <input
            id="proto-token"
            type="password"
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder="paste token"
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
              error
                ? "border-red-500 bg-red-50 dark:bg-red-950"
                : "border-neutral-400 dark:border-neutral-600"
            }`}
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              That token doesn&apos;t match. Check for a stray paste or ask
              Clint for the current one — the link itself won&apos;t work
              without it.
            </p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Start chatting
          </button>
        </form>
      </div>
    </section>
  );
}

function ChatScreen() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [demoPanel, setDemoPanel] = useState(true);
  const timersRef = useRef<number[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  type Msg = { role: "user" | "assistant"; text: string; error?: boolean };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  // clear pending fake-stream timers on unmount
  useEffect(
    () => () => {
      for (const t of timersRef.current) clearTimeout(t);
    },
    [],
  );

  function simulateTurn(question: string, forceError = false) {
    // cancel any in-flight simulation, then run a fresh fake turn
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setPhase("loading");
    const turns = timersRef.current;
    turns.push(
      window.setTimeout(() => {
        if (forceError) {
          setPhase("error");
          return;
        }
        setPhase("streaming");
        const words = CANNED_ANSWER.split(" ");
        for (let i = 1; i <= words.length; i++) {
          turns.push(
            window.setTimeout(() => {
              setMessages((m) => {
                const base = m.slice(0, -1); // drop partial assistant msg
                return [
                  ...base,
                  {
                    role: "assistant" as const,
                    text: words.slice(0, i).join(" "),
                  },
                ];
              });
              if (i === words.length) setPhase("idle");
            }, i * 60),
          );
        }
      }, 1200),
    );
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q || phase === "loading" || phase === "streaming") return;
    // prototype hook: a question containing "error" shows the error state
    simulateTurn(q, q.toLowerCase().includes("error"));
  }

  const busy = phase === "loading" || phase === "streaming";

  return (
    <section className="flex flex-1 flex-col">
      {demoPanel && (
        <div className="mb-4 rounded-lg border border-dashed border-neutral-400 bg-neutral-50 p-3 text-xs dark:border-neutral-700 dark:bg-neutral-900">
          <p className="font-semibold">State jump panel (prototype-only)</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => setMessages([])}
              className="rounded border border-neutral-400 px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              empty state
            </button>
            <button
              onClick={() => {
                setMessages([{ role: "user", text: EXAMPLE_QUESTIONS[0] }]);
                setPhase("loading");
              }}
              className="rounded border border-neutral-400 px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              loading state
            </button>
            <button
              onClick={() =>
                simulateTurn("Tell me about the retrieval pipeline")
              }
              className="rounded border border-neutral-400 px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              streaming state
            </button>
            <button
              onClick={() => simulateTurn("make this error", true)}
              className="rounded border border-neutral-400 px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              error state
            </button>
            <button
              onClick={() => setDemoPanel(false)}
              className="rounded border border-neutral-400 px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800"
            >
              hide
            </button>
          </div>
          <p className="mt-2 text-neutral-500">
            Typing a question containing &quot;error&quot; also triggers the
            error state.
          </p>
        </div>
      )}

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

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800"
              } ${m.error ? "border border-red-400" : ""}`}
            >
              {m.text}
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
            <div className="rounded-2xl bg-neutral-100 px-4 py-2 text-sm dark:bg-neutral-800">
              <span className="inline-block h-4 w-2 animate-pulse bg-neutral-500 align-middle" />
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl border border-red-400 bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">
              <p>Something broke answering that — the request failed.</p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => {
                    const last =
                      messages.findLast((m) => m.role === "user")?.text ?? "";
                    setMessages((m) => m.slice(0, -1));
                    simulateTurn(last);
                  }}
                  className="rounded border border-red-400 px-2 py-1 font-medium hover:bg-red-100 dark:hover:bg-red-900"
                >
                  Retry
                </button>
                <button
                  onClick={() => setPhase("idle")}
                  className="rounded border border-red-300 px-2 py-1 hover:bg-red-100 dark:hover:bg-red-900"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-white via-white to-transparent pb-1 pt-4 dark:from-neutral-950 dark:via-neutral-950">
        <RotatingExamples onPick={(q) => setInput(q)} />
        <form onSubmit={send} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
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

function RotatingExamples({ onPick }: { onPick: (q: string) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % EXAMPLE_QUESTIONS.length),
      4000,
    );
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="mb-2 flex items-center gap-2"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-1 gap-2 overflow-hidden">
        {EXAMPLE_QUESTIONS.map((q, i) => (
          <button
            key={q}
            onClick={() => onPick(q)}
            aria-hidden={i !== index}
            className={`shrink-0 rounded-full border border-neutral-300 px-3 py-1 text-xs whitespace-nowrap transition-all duration-500 dark:border-neutral-600 ${
              i === index
                ? "opacity-100"
                : "pointer-events-none -translate-x-2 opacity-0"
            }`}
          >
            {q}
          </button>
        ))}
      </div>
      <span className="text-[10px] text-neutral-400">click fills input</span>
    </div>
  );
}
