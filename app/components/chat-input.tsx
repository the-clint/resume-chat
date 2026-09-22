"use client";

export function ChatInput({
  input,
  busy,
  onInput,
  onSubmit,
}: {
  input: string;
  busy: boolean;
  onInput: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex gap-2"
    >
      <input
        value={input}
        onChange={(event) => onInput(event.target.value)}
        placeholder={busy ? "Waiting for the answer…" : "Ask about the resume…"}
        disabled={busy}
        className="flex-1 rounded-full border border-neutral-400 px-4 py-2 text-sm disabled:opacity-50 dark:border-neutral-600"
      />
      <button
        type="submit"
        disabled={busy || !input.trim()}
        className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        Ask
      </button>
    </form>
  );
}
