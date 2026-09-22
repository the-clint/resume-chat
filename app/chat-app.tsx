"use client";

// The two screens (ticket 12's verdict): token screen, then chat. The server
// component passes the initial session state, so a live cookie renders straight
// into the chat with no client-side auth probe — and a 401 from a later request
// (expired or revoked) drops back here with the reason.

import { useState } from "react";

import { ChatScreen } from "./chat-screen";
import { TokenScreen } from "./token-screen";

export default function ChatApp({
  initialName,
}: {
  initialName: string | null;
}) {
  const [name, setName] = useState(initialName);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-10">
      {name ? (
        <ChatScreen
          name={name}
          onUnauthorised={() => {
            setName(null);
            setNotice(
              "Your session ended or that token was revoked — enter your token again.",
            );
          }}
        />
      ) : (
        <TokenScreen
          notice={notice}
          onPass={(next) => {
            setNotice(null);
            setName(next);
          }}
        />
      )}
    </main>
  );
}
