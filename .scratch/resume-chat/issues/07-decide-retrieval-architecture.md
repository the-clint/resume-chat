# Decide retrieval architecture for the resume corpus

Type: grilling
Status: open
Blocked by: 03

## Question

Decide how a question becomes resume-grounded context, and where the resume text lives. Informed by the retrieval research (ticket 03):

- Full-context stuffing versus embedding retrieval — and if retrieval, which embedding source and which store.
- The resume source of truth: committed markdown, the PDF, or both. What does the deployed app read?
- Chunking strategy if retrieval is chosen.
- How updates to the resume propagate after launch (re-embed, redeploy, or nothing).

HITL.
