"use client";

export function EmptyState() {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
      <h2 className="text-lg font-semibold">Ask about Clint&apos;s resume</h2>
      <p className="mt-2 max-w-sm text-sm text-neutral-600 dark:text-neutral-400">
        Answers come only from the resume document — grounding, not vibes. If it
        isn&apos;t on the resume, the app says so.
      </p>
    </div>
  );
}
