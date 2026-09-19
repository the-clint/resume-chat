# Decide grounding, refusal, and prompt-injection posture

Type: grilling
Status: open
Blocked by: 07

## Question

Decide the system prompt and guardrail behavior:

- What the bot does with a question that isn't about the resume — refuse, deflect, or answer from general knowledge?
- How it avoids inventing resume facts (grounding, and whether answers cite the resume section).
- How it resists prompt injection aimed at extracting the system prompt, the API key, or a policy bypass.
- What the failure mode looks like to the user when the model misbehaves.

HITL. Note: the chosen model and streaming behavior (ticket 09) constrain what the prompt can enforce.
