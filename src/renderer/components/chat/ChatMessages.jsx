import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";

export function ChatMessages({ messages }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="min-h-full">
      <div>
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            No messages yet. Ask something below.
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id ?? `msg-${msg.role}-${msg.content?.slice(0, 20)}`}
              role={msg.role}
              content={msg.content}
              messageId={msg.id}
              meta={msg.meta}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
