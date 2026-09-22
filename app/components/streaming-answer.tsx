"use client";

export function StreamingAnswer({ answer }: { answer: string }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-2 text-sm whitespace-pre-wrap dark:bg-neutral-800">
        {answer}
        <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-neutral-500 align-middle" />
      </div>
    </div>
  );
}
