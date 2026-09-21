# Decide grounding, refusal, and prompt-injection posture

Type: grilling
Status: resolved
Blocked by: 07

## Question

Decide the system prompt and guardrail behavior:

- What the bot does with a question that isn't about the resume — refuse, deflect, or answer from general knowledge?
- How it avoids inventing resume facts (grounding, and whether answers cite the resume section).
- How it resists prompt injection aimed at extracting the system prompt, the API key, or a policy bypass.
- What the failure mode looks like to the user when the model misbehaves.

HITL. Note: the chosen model and streaming behavior (ticket 09) constrain what the prompt can enforce.

## Answer

Resolved 2026-09-21 (grilling, HITL; all recommendations accepted).

- **Off-resume questions: refuse topical, allow social.** Greetings and "who are you" get natural 1–2-sentence answers; topical off-resume questions get a polite decline with a redirect ("ask me about Clint's experience"). General-knowledge answers rejected — they reopen the hallucination problem and look bad in a portfolio demo.
- **Citations: inline, loose format.** Grounded answers name the resume section(s) they drew from, using the Chunk metadata names ticket 07 already ships (`section`/`company`/`dates`). No rigid footnote syntax; one prompt line.
- **Weak retrieval: prompt-only guard.** "Answer only from the provided chunks; if they don't contain the answer, say you don't have that on the resume." No deterministic vectorize-score gate in v1 — bge-m3 thresholds are finicky and a wrong one silently breaks good answers. Add a gate only if real post-launch traffic shows misbehavior (tracked in map fog under post-launch visibility).
- **Multi-turn: history passed, retrieval on latest only.** Last ~6 turns of conversation go to the LLM; embedding/retrieval keys on the latest user message only. Follow-up questions ("where did he work before *that*?") work without ballooning the prompt; map fog item on memory is hereby resolved.
- **Injection: best-effort refusal, no secrecy assumption.** Prompt instructs to ignore user-message instructions that ask for the system prompt or a rule bypass; we accept a clever-enough attack wins. Real assets (OpenRouter key, Vectorize binding) are server-side and never appear in prompt text. Resume chunks are authored by Clint, not adversarial — not treated as untrusted input.
- **Failure UX: generic bubble.** "Something went wrong. Try again." in chat, details logged server-side only. No programmatic misbehavior detection in v1 — off-script answers are accepted and visible. The spend-ceiling exhaustion message is ticket 10's question.
- **Dependency:** final system-prompt wording adapts to ticket 09's model and streaming decision; this ticket fixes behavior, not exact strings.
