// Chunks the Resume (content/resume.md) into one Chunk per section or role entry,
// per ticket 07: ~100–200 token chunks, no overlap, metadata per chunk
// (`section`, `company`, `dates`, `skills[]`). Pure functions — no I/O, no
// bindings; scripts/embed-resume.ts feeds the chunk text to Workers AI.
//
// Markdown contract of content/resume.md:
//   `#` header block, `##` sections, `###` company (under Experience, an
//   em-dash-separated "Company — Location" line optionally followed by an
//   italic context line), `####` roles titled "Title | Dates".

export interface ResumeChunk {
  id: string;
  /** Markdown text that gets embedded; includes the heading for retrieval context. */
  text: string;
  section: string;
  company: string | null;
  dates: string | null;
  skills: string[];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isHeading(line: string, level: number): boolean {
  return line.startsWith("#".repeat(level) + " ");
}

function stripHeading(line: string): string {
  return line.replace(/^#+\s*/, "");
}

/** Skills vocabulary extracted from the Resume's own "Technical Skills" list. */
export function extractSkills(resume: string): string[] {
  const lines = resume.split("\n");
  const start = lines.findIndex(
    (line) => stripHeading(line) === "Technical Skills" && line.startsWith("#"),
  );
  if (start === -1) return [];

  const terms: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("## ")) break;
    const bullet = line.match(/^\s*[-*]\s*\*\*(.+?):\*\*(.*)$/);
    if (!bullet) continue;
    for (const term of bullet[2].split(",")) {
      // "Phalcon/Laravel (PHP)" yields Phalcon and Laravel; parentheticals are notes.
      const base = term.replace(/\s*\(.*?\)\s*$/, "").trim();
      // Split "Phalcon/Laravel"-style aliases, but keep "GitLab CI/CD" and lowercase
      // compounds like "build/test/deploy" intact — alias split only for two
      // capitalized technology names around a slash.
      const aliases = /^[A-Z][\w.+#-]*\/[A-Z]/.test(base)
        ? base.split("/")
        : [base];
      for (const alias of aliases) {
        const name = alias.trim();
        if (name && !terms.includes(name)) terms.push(name);
      }
    }
  }
  return terms;
}

function matchSkills(text: string, terms: string[]): string[] {
  const escaped = terms.map((term) =>
    term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  return terms.filter((_, i) =>
    new RegExp(`\\b${escaped[i]}\\b`, "i").test(text),
  );
}

/** Normalizes raw markdown lines into chunk text: separators out, blank runs collapsed. */
function toText(lines: string[]): string {
  return lines
    .filter((line) => line.trim() !== "---")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkResume(resume: string): ResumeChunk[] {
  const skills = extractSkills(resume);
  const chunks: ResumeChunk[] = [];
  const lines = resume.split("\n");

  let header: string[] = [];
  let inHeader = true;
  let company: string | null = null;
  let companyContext: string[] = [];
  let pending: {
    section: string;
    company: string | null;
    dates: string | null;
    heading: string;
    context: string[];
    body: string[];
  } | null = null;

  const flush = () => {
    if (!pending) return;
    const text = toText([...pending.context, pending.heading, ...pending.body]);
    // Headings with no body (e.g. "## Experience" wrapping the roles) are not chunks.
    if (
      text &&
      (pending.body.some((line) => line.trim()) || pending.context.length > 0)
    ) {
      chunks.push({
        id: pending.company
          ? `experience--${slugify(pending.section)}`
          : slugify(pending.section),
        text,
        section: pending.section,
        company: pending.company,
        dates: pending.dates,
        skills: matchSkills(text, skills),
      });
    }
    pending = null;
  };

  for (const line of lines) {
    if (isHeading(line, 2)) {
      flush();
      company = null;
      companyContext = [];
      // The contact header above the first section (name, tagline, contact info)
      // is not a chunk: it is not answerable content, and indexing it makes it
      // out-score actually relevant chunks (verified against the live index).
      header = [];
      inHeader = false;
      pending = {
        section: stripHeading(line),
        company: null,
        dates: null,
        heading: line,
        context: [],
        body: [],
      };
      continue;
    }
    if (inHeader) {
      header.push(line);
      continue;
    }
    if (isHeading(line, 3)) {
      flush();
      company = stripHeading(line).split(" — ")[0].trim();
      companyContext = [line];
      continue;
    }
    if (isHeading(line, 4)) {
      flush();
      const [title, dates] = stripHeading(line)
        .split("|")
        .map((part) => part.trim());
      pending = {
        section: title,
        company,
        dates: dates || null,
        heading: line,
        context: [...companyContext],
        body: [],
      };
      continue;
    }
    // Italic line directly under a company heading is company-level context.
    if (!pending && company && /^\s*\*[^*].*\*\s*$/.test(line)) {
      companyContext.push(line);
      continue;
    }
    if (!pending) continue;
    pending.body.push(line);
  }
  flush();

  return chunks;
}
