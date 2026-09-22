"use client";

// The real chat screen. Layout and states are the prototype's (ticket 12 verdict:
// message layout, 4-second rotating examples that pause on hover and fill the input,
// loading dots, streaming cursor, error bubble with Retry/Dismiss), wired to
// POST /api/chat and its distinct limit messages. Presentational pieces live in
// ./components.

import { useEffect, useRef, useState } from "react";

import { ChatInput } from "./components/chat-input";
import { EmptyState } from "./components/empty-state";
import { LoadingIndicator } from "./components/loading-indicator";
import { MessageBubble, type Message } from "./components/message-bubble";
import {
  GENERIC_NOTICE,
  LIMIT_NOTICES,
  NoticeBubble,
  refusalCode,
  type Notice,
} from "./components/notice-bubble";
import { RotatingExamples } from "./components/example-questions";
import { StreamingAnswer } from "./components/streaming-answer";

import { SSEPayloadParser } from "@/lib/chat-stream";
import type { ChatStreamEvent } from "@/lib/chat-stream";

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

  function send() {
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
        {messages.length === 0 && phase === "idle" && <EmptyState />}

        {messages.map((message, index) => (
          <MessageBubble key={index} message={message} />
        ))}

        {phase === "loading" && <LoadingIndicator />}

        {phase === "streaming" && <StreamingAnswer answer={answer} />}

        {notice && phase === "idle" && (
          <NoticeBubble
            notice={notice}
            onRetry={retry}
            onDismiss={() => setNotice(null)}
          />
        )}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-white via-white to-transparent pt-4 pb-1 dark:from-neutral-950 dark:via-neutral-950">
        <RotatingExamples onPick={setInput} />
        <ChatInput
          input={input}
          busy={busy}
          onInput={setInput}
          onSubmit={send}
        />
      </div>
    </section>
  );
}
