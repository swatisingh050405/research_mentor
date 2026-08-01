import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { prepareChatForPaper, askPaperQuestion } from "../services/api";

export default function ChatPanel({ paperId, paperTitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isPreparing, setIsPreparing] = useState(true);
  const [contextMode, setContextMode] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [prepareError, setPrepareError] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      setIsPreparing(true);
      setPrepareError(null);

      try {
        const data = await prepareChatForPaper(paperId);
        if (cancelled) return;
        setContextMode(data.context_mode);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setPrepareError(
            "Couldn't prepare this paper for chat. You can still try asking a question.",
          );
        }
      } finally {
        if (!cancelled) setIsPreparing(false);
      }
    }

    if (paperId) prepare();

    return () => {
      cancelled = true;
    };
  }, [paperId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || isSending) return;

    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setInput("");
    setIsSending(true);

    try {
      const data = await askPaperQuestion(paperId, question);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: data.answer },
      ]);
      setContextMode(data.context_mode);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, something went wrong answering that. Please try again.",
          isError: true,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-full w-full bg-white border border-purple-100 rounded-[2rem] shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-7 md:px-9 pt-7 pb-4 border-b border-purple-100/70 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
          💬 Chat With This Paper
        </h3>

        {!isPreparing && contextMode && (
          <span
            className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
              contextMode === "full_text"
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {contextMode === "full_text"
              ? "✓ Full-text mode"
              : "⚠ Abstract-only mode"}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col px-7 md:px-9 py-5 overflow-hidden">
        {isPreparing && (
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 py-4">
            <div className="w-4 h-4 border-2 border-purple-100 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
            Preparing this paper for chat...
          </div>
        )}

        {prepareError && !isPreparing && (
          <div className="bg-amber-50 border border-amber-100 text-amber-700 text-xs font-semibold p-3 rounded-xl mb-4">
            ⚠️ {prepareError}
          </div>
        )}

        {!isPreparing &&
          contextMode === "abstract_only" &&
          messages.length === 0 && (
            <p className="text-xs text-slate-400 font-medium mb-4">
              Full text isn't available for this paper, so answers are based on
              its abstract only.
            </p>
          )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
          {messages.length === 0 && !isPreparing ? (
            <p className="text-sm text-slate-400 font-medium py-6 text-center">
              Ask a question about "{paperTitle}" to get started.
            </p>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] text-sm leading-relaxed rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-medium"
                      : msg.isError
                        ? "bg-red-50 border border-red-100 text-red-600 font-medium"
                        : "bg-purple-50/60 border border-purple-100 text-slate-700"
                  }`}
                >
                  {msg.role === "assistant" && !msg.isError ? (
                    <div className="chat-markdown">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 mb-2 space-y-1">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 mb-2 space-y-1">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="leading-relaxed">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className="font-bold text-slate-900">
                              {children}
                            </strong>
                          ),
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))
          )}

          {isSending && (
            <div className="flex justify-start">
              <div className="bg-purple-50/60 border border-purple-100 rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-[var(--color-brand-primary)] rounded-full animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 bg-[var(--color-brand-primary)] rounded-full animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 bg-[var(--color-brand-primary)] rounded-full animate-bounce" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isPreparing
                ? "Preparing paper..."
                : "Ask a question about this paper..."
            }
            disabled={isPreparing || isSending}
            className="flex-1 bg-purple-50/10 border border-purple-100/80 px-4 py-3 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-4 focus:ring-[var(--color-brand-primary)]/5 transition-all text-sm font-medium shadow-inner disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isPreparing || isSending || !input.trim()}
            className="bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-sm font-bold px-5 py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
