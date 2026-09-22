// Ticket 10: `npm run token:add <name>` — generates one `rchat_` + 32-hex token
// (~128 bits), prints its TOKEN_LIST entry on stdout and the RAW TOKEN on stderr.
// The raw token is shown once and stored nowhere; only its SHA-256 digest goes
// into the list (append the printed entry to token-list.json, then
// `npx wrangler secret put TOKEN_LIST < token-list.json`).
// Revocation/rotation stays a hand edit on token-list.json (README Operations).

import { randomBytes, createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

const name = process.argv[2];
if (!name || process.argv[3]) {
  console.error(
    'Usage: npm run token:add <name>   (one name, e.g. "Alice Example")',
  );
  process.exit(1);
}

const id = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error(`Name "${name}" produces invalid id "${id}"`);
  process.exit(1);
}

// Session cookies and the usage counter key on id, so a duplicate id would merge
// two people into one cookie identity, one counter, and defeat revocation.
const listPath = "token-list.json";
if (existsSync(listPath)) {
  const existing = JSON.parse(readFileSync(listPath, "utf8")) as {
    id: string;
  }[];
  if (Array.isArray(existing) && existing.some((e) => e.id === id)) {
    console.error(
      `Id "${id}" already exists in token-list.json — two people sharing an id`,
      `breaks revocation and the usage counter. Use a distinguishing name, or`,
      `rotate the existing token (README Operations).`,
    );
    process.exit(1);
  }
}

const token = `rchat_${randomBytes(16).toString("hex")}`;
const entry = {
  id,
  name,
  sha256: createHash("sha256").update(token).digest("hex"),
};

console.log(JSON.stringify(entry, null, 2));
console.error(
  "RAW TOKEN — share with the person out of band, store it nowhere:",
  token,
);
