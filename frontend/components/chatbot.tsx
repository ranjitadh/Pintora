"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, MessageCircle, Send, Sparkles, Trash2, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { AssistantReply } from "@/lib/types";

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatbotProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Chatbot({ open: openProp, onOpenChange: onOpenChangeProp }: ChatbotProps) {
  const [open, setOpen] = useState(openProp ?? false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    if (open) setUnreadCount(0);
  }, [open]);

  useEffect(() => {
    setOpen(openProp ?? false);
    openRef.current = openProp ?? false;
    if (openProp) setUnreadCount(0);
  }, [openProp]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = (role: AssistantMessage["role"], content: string) => {
    setMessages((prev) => [...prev, { role, content }]);
    if (role === "assistant" && !openRef.current) {
      setUnreadCount((count) => count + 1);
    }
  };

  const handleSend = async () => {
    const textValue = input.trim();
    if (!textValue || loading) return;

    setInput("");
    inputRef.current?.blur();
    setLoading(true);
    setError(null);
    addMessage("user", textValue);

    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const data = await api.post<AssistantReply>("/assistant/chat/", {
        message: textValue,
        history,
      });
      addMessage("assistant", data.reply);
    } catch (err) {
      const msg = errorMessage(err);
      setError(msg);
      addMessage("assistant", "I'm sorry, I couldn't process that. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (text: string) => {
    setInput(text);
    handleSend();
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setLoading(false);
    setError(null);
    setUnreadCount(0);
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    openRef.current = next;
    if (next) setUnreadCount(0);
    onOpenChangeProp?.(next);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
      {/* Floating toggle button */}
      <button
        onClick={toggleOpen}
        className={[
          "relative flex items-center gap-2 rounded-full bg-ink text-cream px-4 py-2.5 shadow-lg",
          open ? "ring-2 ring-clay" : "hover:bg-clay transition",
        ].join(" ")}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        <Sparkles size={16} className="animate-pulse" />
        <span className="text-xs font-semibold uppercase tracking-wider">Assistant</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-rose-600 text-[9px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-[70px] right-6 z-[60] flex flex-col h-[85vh] w-[440px] max-w-[90vw] bg-cream border border-ink/20 rounded-3xl shadow-2xl overflow-hidden flex-shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-ink text-cream">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-clay text-cream">
                <Bot size={16} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Printora Assistant</h3>
                <p className="text-xs text-cream/70">How can I help?</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                  onClick={clearChat}
                  className="p-1.5 rounded-md text-cream/60 hover:bg-white/10 hover:text-white transition"
                  title="Clear chat"
                >
                  <Trash2 size={14} />
                </button>
              <button
                onClick={toggleOpen}
                className="p-1.5 rounded-md text-cream/60 hover:bg-white/10 hover:text-white transition"
                title="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-cream/5">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-sm text-ink/60">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-50" />
                <p>Hi! I'm your Printora assistant.</p>
                <p className="mt-2 text-xs">Ask me about products, orders, pricing, or how to use the editor.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={["flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row"].join(" ")}>
                {msg.role === "assistant" && (
                  <div className="h-8 w-8 rounded-full bg-clay text-cream flex items-center justify-center flex-shrink-0">
                    <Bot size={12} />
                  </div>
                )}
                <div
                  className={[
                    "rounded-xl px-4 py-2.5 text-sm max-w-[80%] break-words shadow-sm",
                    msg.role === "user"
                      ? "bg-ink text-cream ml-auto rounded-tr-none rounded-bl-lg"
                      : "bg-white text-ink mr-auto rounded-tl-none rounded-br-lg",
                  ].join(" ")}
                >
                  {msg.content}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-cream flex-shrink-0">
                    <MessageCircle size={12} />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-ink/60">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-ink flex-shrink-0">
                  <Sparkles size={12} className="animate-pulse" />
                </div>
                <span className="animate-pulse">Assistant is typing…</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 text-sm">
                <span className="flex-shrink-0">⚠️</span>
                <span>{error}</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-cream border-t border-ink/10 p-4">
            <form onSubmit={handleFormSubmit} className="relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                className={[
                  "w-full resize-none border border-ink/20 px-5 py-2.5 text-sm",
                  loading ? "opacity-50 pointer-events-none" : "",
                ].join(" ")}
                disabled={loading}
                rows={1}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={[
                  "absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-xs font-semibold",
                  !input.trim() || loading
                    ? "bg-ink/20 text-ink/40"
                    : "bg-ink text-cream hover:bg-clay transition",
                ].join(" ")}
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Chatbot;