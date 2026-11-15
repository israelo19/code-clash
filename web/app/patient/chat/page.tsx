"use client";

import { useEffect, useRef, useState } from "react";
import { ChatBubble, PageHeader } from "@/components/ui";
import { sendChat } from "@/lib/api";
import { COMPANION_NAME, NOT_A_DOCTOR_LINE } from "@/lib/config";
import { signedInUser } from "@/lib/session";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = ["I think I have strep. What will it cost?", "What vaccines do I have?", "What does my visit summary mean?"];

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "companion",
      text: `Hi ${signedInUser()?.name.split(" ")[0] ?? "there"}, I'm your ${COMPANION_NAME}. I can explain your records and estimate what care will cost. What's going on?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: t }]);
    setThinking(true);
    try {
      const reply = await sendChat(t);
      setMessages((m) => [...m, reply]);
    } catch {
      setMessages((m) => [...m, { role: "companion", text: "I can't answer right now. Please try again." }]);
    } finally {
      setThinking(false); // whatever happened, stop showing the "thinking" dots
    }
  };

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-4rem)]">
      <PageHeader title={COMPANION_NAME} />
      <p className="-mt-3 mb-4 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">⚕️ {NOT_A_DOCTOR_LINE}</p>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.map((m, i) => (
          <ChatBubble key={i} msg={m} />
        ))}
        {thinking && (
          <div className="flex gap-1 px-2 py-3">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 2 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="shrink-0 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-xs text-teal-800 hover:bg-teal-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your records or a cost…"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm"
        />
        <button
          disabled={!input.trim() || thinking}
          className="rounded-xl bg-teal-600 px-4 text-sm font-medium text-white disabled:bg-slate-300"
        >
          Send
        </button>
      </form>
    </div>
  );
}
