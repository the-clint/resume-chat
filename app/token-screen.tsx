"use client";

// The gate's front door (tickets 10 + 12). Copy is the prototype's, kept as-is:
// cost-per-question framing, "protecting Clint's bill, not keeping people out".
// Every rejection from POST /api/login is identical by design, so one plain
// wrong-token message covers wrong, expired, and revoked.

import { useState } from "react";

type Phase = "idle" | "checking" | "rejected" | "unreachable";

export function TokenScreen({
  notice,
  onPass,
}: {
  notice: string | null;
  onPass: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const checking = phase === "checking";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const token = value.trim();
    if (!token || checking) return;
    setPhase("checking");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) {
        setPhase("rejected");
        return;
      }
      const { name } = (await response.json()) as { name?: string };
      onPass(name ?? "there");
    } catch {
      setPhase("unreachable");
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
        {notice && (
          <p className="mt-4 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            {notice}
          </p>
        )}
        <form onSubmit={submit} className="mt-6">
          <label htmlFor="access-token" className="block text-sm font-medium">
            Access token
          </label>
          <input
            id="access-token"
            type="password"
            autoComplete="off"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setPhase("idle");
            }}
            placeholder="paste token"
            disabled={checking}
            className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${
              phase === "rejected"
                ? "border-red-500 bg-red-50 dark:bg-red-950"
                : "border-neutral-400 dark:border-neutral-600"
            }`}
          />
          {phase === "rejected" && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              That token doesn&apos;t match. Check for a stray paste or ask
              Clint for the current one — the link itself won&apos;t work
              without it.
            </p>
          )}
          {phase === "unreachable" && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              Couldn&apos;t reach the app. Check your connection and try again.
            </p>
          )}
          <button
            type="submit"
            disabled={checking || !value.trim()}
            className="mt-4 w-full rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {checking ? "Checking…" : "Start chatting"}
          </button>
        </form>
      </div>
    </section>
  );
}
