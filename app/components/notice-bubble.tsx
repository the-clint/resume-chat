"use client";

export interface Notice {
  text: string;
  tone: "limit" | "error";
  retryable: boolean;
}

/** One distinct message per refusal the gate can return (ticket 10). */
export const LIMIT_NOTICES: Record<string, Notice> = {
  minute_limit: {
    text: "You're asking faster than this chat allows. Give it a minute, then try again.",
    tone: "limit",
    retryable: true,
  },
  daily_limit: {
    text: "That's all of today's questions. The limit resets at midnight UTC.",
    tone: "limit",
    retryable: false,
  },
  monthly_limit: {
    text: "You've reached this month's question limit — check back on the 1st.",
    tone: "limit",
    retryable: false,
  },
};

export const GENERIC_NOTICE: Notice = {
  text: "Something went wrong answering that. Try again.",
  tone: "error",
  retryable: true,
};

export async function refusalCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : "server_error";
  } catch {
    return "server_error";
  }
}

export function NoticeBubble({
  notice,
  onRetry,
  onDismiss,
}: {
  notice: Notice;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[85%] rounded-2xl border px-4 py-2 text-sm ${
          notice.tone === "limit"
            ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200"
            : "border-red-400 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        <p>{notice.text}</p>
        <div className="mt-2 flex gap-2">
          {notice.retryable && (
            <button
              onClick={onRetry}
              className="rounded border border-current px-2 py-1 font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              Retry
            </button>
          )}
          <button
            onClick={onDismiss}
            className="rounded border border-current/50 px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
