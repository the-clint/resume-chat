# resume-chat

A chat app that answers questions grounded in exactly one document: Clint's resume. Its vocabulary centers on that single-document retrieval pipeline.

## Language

**Resume**:
The canonical resume text, kept as `content/resume.md`. The only source the pipeline reads; the PDF is never a data source.
_Avoid_: source of truth file, corpus, document set

**Chunk**:
One resume section or role entry, stored as a vector with metadata (`section`, `company`, `dates`, `skills[]`).
_Avoid_: passage, segment, snippet

**Embed script**:
The local command (`npm run embed:resume`) that chunks the Resume, embeds it, and replaces the Vectorize index contents. The only thing that embeds; runtime never does.
_Avoid_: indexer, ingestion pipeline

**Re-embed**:
Running the Embed script after editing the Resume. Whole-index replace; no incremental update exists.

**Top-k**:
The k highest-scoring chunks (k=3) retrieved per question and injected into the prompt with their scores.
_Avoid_: context window fill, retrieved set

**Stuffing**:
The rejected alternative of pasting the whole Resume into the system prompt. Kept as vocabulary because the deliberate choice of retrieval over Stuffing is the portfolio's point.

**Turn**:
One user question and its streamed answer — the unit that the spend cap and the daily/monthly counters all count.
_Avoid_: message, exchange, round trip

**Turn history**:
The last ~6 conversation turns passed to the LLM so follow-ups make sense. Retrieval embeds only the latest question, never the history.
_Avoid_: memory, transcript, session state
