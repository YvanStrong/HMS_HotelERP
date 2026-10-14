"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { matchHelpAnswer, suggestFaqs, type HelpFaq } from "@/lib/helpFaqs";

type ChatMsg = {
  id: string;
  role: "user" | "bot";
  text: string;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function HelpChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [suggestions, setSuggestions] = useState<HelpFaq[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSuggestions(suggestFaqs(pathname, 4));
    if (messages.length === 0) {
      setMessages([
        {
          id: uid(),
          role: "bot",
          text: "Hi — ask a short how-to question about this hotel system, or pick a suggestion.",
        },
      ]);
    }
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only refresh suggestions when opened / route changes
  }, [open, pathname]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  function ask(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const { answer, suggestions: next } = matchHelpAnswer(text, pathname);
    setMessages((prev) => [
      ...prev,
      { id: uid(), role: "user", text },
      { id: uid(), role: "bot", text: answer },
    ]);
    setSuggestions(next.length ? next : suggestFaqs(pathname, 3));
    setInput("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <div className="pointer-events-none fixed bottom-5 left-4 z-[95] flex flex-col items-start gap-3">
      {open ? (
        <div
          className="pointer-events-auto flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-float)]"
          role="dialog"
          aria-label="Help chatbot"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-3 py-2.5 text-primary-foreground">
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight">Help</p>
              <p className="truncate text-[11px] opacity-90">Quick answers for staff</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 hover:bg-white/15"
              aria-label="Close help chat"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div ref={listRef} className="max-h-72 space-y-2.5 overflow-y-auto px-3 py-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[90%] rounded-2xl rounded-br-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "max-w-[90%] rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {suggestions.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => ask(s.title)}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:bg-accent"
                >
                  {s.title}
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-2.5">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a short question…"
              maxLength={200}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none ring-primary focus:ring-2"
              aria-label="Help question"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="hms-btn-solid shrink-0 rounded-xl px-3 py-2 text-sm disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-float)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-label={open ? "Close help chat" : "Open help chat"}
        aria-expanded={open}
      >
        {open ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
