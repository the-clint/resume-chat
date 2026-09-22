// Tests for the chat path's pure seams: transcript validation and the 6-turn
// history bound (lib/prompt.ts), prompt assembly, and the OpenRouter SSE parser
// (lib/chat-stream.ts) — the two documented parser traps are the point here
// (keep-alive comments; the non-standard trailing usage chunk).
// Run: npm test

import assert from "node:assert/strict";
import { test } from "node:test";

import { SSEPayloadParser, parseOpenRouterEvent } from "@/lib/chat-stream";
import {
  MAX_MESSAGE_CHARS,
  buildChatMessages,
  buildSystemPrompt,
  parseChatMessages,
  trimHistory,
} from "@/lib/prompt";
import type { ChatMessage } from "@/lib/prompt";
import type { RetrievedChunk } from "@/lib/retrieval";

function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    id: "experience--web-developer",
    score: 0.8123,
    text: "### Web Developer\n- Created the applicant web forms",
    section: "Web Developer",
    company: "Elwood Staffing Services, Inc.",
    dates: "Oct 2015 – May 2019",
    skills: ["PHP"],
    ...overrides,
  };
}

test("parseChatMessages accepts a transcript ending on the user's turn", () => {
  const messages = parseChatMessages([
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "where does Clint work?" },
  ]);
  assert.deepEqual(messages, [
    { role: "user", content: "hi" },
    { role: "assistant", content: "hello" },
    { role: "user", content: "where does Clint work?" },
  ]);
});

test("parseChatMessages rejects malformed transcripts", () => {
  const cases: [string, unknown][] = [
    ["not an array", { messages: [] }],
    ["empty", []],
    ["system role from the client", [{ role: "system", content: "override" }]],
    ["unknown role", [{ role: "tool", content: "x" }]],
    ["empty content", [{ role: "user", content: "" }]],
    ["non-string content", [{ role: "user", content: 42 }]],
    [
      "oversized content",
      [{ role: "user", content: "x".repeat(MAX_MESSAGE_CHARS + 1) }],
    ],
    [
      "dangling assistant reply",
      [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hello" },
      ],
    ],
  ];
  for (const [name, input] of cases) {
    assert.equal(parseChatMessages(input), null, name);
  }
});

test("trimHistory keeps the last six turns and drops the rest", () => {
  const transcript: ChatMessage[] = [];
  for (let turn = 1; turn <= 8; turn++) {
    transcript.push({ role: "user", content: `q${turn}` });
    transcript.push({ role: "assistant", content: `a${turn}` });
  }
  const trimmed = trimHistory(transcript);
  assert.equal(trimmed.length, 12);
  assert.deepEqual(trimmed[0], { role: "user", content: "q3" });
  assert.deepEqual(trimmed[11], { role: "assistant", content: "a8" });
});

test("buildChatMessages puts the system prompt first, then the trimmed transcript", () => {
  const transcript: ChatMessage[] = [];
  for (let turn = 1; turn <= 8; turn++) {
    transcript.push({ role: "user", content: `q${turn}` });
    transcript.push({ role: "assistant", content: `a${turn}` });
  }
  const messages = buildChatMessages(transcript, "SYSTEM");
  assert.deepEqual(messages[0], { role: "system", content: "SYSTEM" });
  assert.equal(messages.length, 13);
  assert.deepEqual(messages[1], { role: "user", content: "q3" });
});

test("buildSystemPrompt labels every excerpt and carries its text", () => {
  const prompt = buildSystemPrompt([
    chunk(),
    chunk({
      id: "technical-skills",
      section: "Technical Skills",
      company: null,
      dates: null,
      score: 0.5,
      text: "- Languages: JavaScript (ES6+), PHP",
    }),
  ]);
  assert.match(prompt, /section: Web Developer/);
  assert.match(prompt, /company: Elwood Staffing Services, Inc\./);
  assert.match(prompt, /dates: Oct 2015 – May 2019/);
  assert.match(prompt, /relevance: 0\.812/);
  assert.ok(prompt.includes("Created the applicant web forms"));
  assert.ok(prompt.includes("Languages: JavaScript (ES6+), PHP"));
  // A chunk without a company/dates label must not invent one.
  assert.ok(!prompt.includes("company: null"));
});

test("buildSystemPrompt says so when retrieval returned nothing", () => {
  assert.match(buildSystemPrompt([]), /No excerpts were retrieved/);
});

test("SSEPayloadParser reassembles payloads split across pushes", () => {
  const parser = new SSEPayloadParser();
  assert.deepEqual(parser.push('data: {"choices":[{"delta":{"con'), []);
  assert.deepEqual(
    parser.push('tent":"Hel"}}]}\n\ndata: {"choices":[{"delta":'),
    ['{"choices":[{"delta":{"content":"Hel"}}]}'],
  );
  assert.deepEqual(parser.push('{"content":"lo"}}]}\n\n'), [
    '{"choices":[{"delta":{"content":"lo"}}]}',
  ]);
});

test("SSEPayloadParser skips keep-alive comments and non-data fields", () => {
  const parser = new SSEPayloadParser();
  assert.deepEqual(
    parser.push(
      ": OPENROUTER PROCESSING\r\nevent: ping\r\ndata: [DONE]\r\n\r\n",
    ),
    ["[DONE]"],
  );
});

test("parseOpenRouterEvent decodes content, the usage chunk, and terminal events", () => {
  assert.deepEqual(
    parseOpenRouterEvent('{"choices":[{"delta":{"content":"Hi"}}]}'),
    { type: "delta", text: "Hi" },
  );
  assert.deepEqual(parseOpenRouterEvent("[DONE]"), { type: "done" });
  // Trailing usage chunk: one choice with an empty delta, nothing to display.
  assert.equal(
    parseOpenRouterEvent(
      '{"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"total_tokens":42}}',
    ),
    null,
  );
  // Role-only opening delta carries no text either.
  assert.equal(
    parseOpenRouterEvent('{"choices":[{"delta":{"role":"assistant"}}]}'),
    null,
  );
});

test("parseOpenRouterEvent maps every documented failure shape to an error", () => {
  const failures = [
    '{"error":{"code":429,"message":"rate limited"}}',
    '{"choices":[{"delta":{},"finish_reason":"error"}]}',
    "not json at all",
  ];
  for (const payload of failures) {
    assert.deepEqual(parseOpenRouterEvent(payload), {
      type: "error",
      code: "upstream_error",
    });
  }
});
