import React from 'react';

/**
 * Shared Search Bar component used in both HomePublic and HomeUser.
 * `variant` controls which exact original design/copy to render —
 * this preserves both pages' existing look pixel-for-pixel.
 */
export default function SearchBar({
  topic,
  setTopic,
  description,
  setDescription,
  onSubmit,
  isLoading,
  variant = 'public', // 'public' | 'user'
}) {
  if (variant === 'user') {
    return (
      <div className="bg-white rounded-[28px] p-8 shadow-[0_20px_50px_rgba(123,47,247,0.02)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[var(--color-brand-primary)] via-[#5A1FD4] to-[var(--color-brand-accent)]" />

        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 pl-1">
                Core Topic Parameters
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., Sparse Mixture of Experts (MoE) Token Optimization"
                className="w-full bg-[#F6F5FD]/70 border-0 px-4 py-4 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 text-sm font-bold shadow-inner text-slate-900 transition-all placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2 pl-1">
                Context Description Criteria
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Specify custom parameter sets or hardware metrics targets..."
                rows={2}
                className="w-full bg-[#F6F5FD]/70 border-0 px-4 py-4 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-[var(--color-brand-primary)]/20 text-sm font-bold shadow-inner resize-none leading-relaxed text-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className="bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-95 text-white text-xs font-bold px-7 py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-purple-300/30 cursor-pointer transform hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-300/40 disabled:opacity-50 disabled:cursor-not-allowed flex gap-2 items-center"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing Engine...
                </>
              ) : (
                "Ingest Repository Streams"
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // variant === 'public'
  return (
    <div className="w-full bg-white/90 backdrop-blur-md border border-purple-100 p-6 md:p-8 rounded-3xl shadow-[0_30px_70px_rgba(139,92,246,0.04)] text-left relative overflow-hidden group">
      <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)]" />
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Core Topic Focus
          </label>
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter your topic"
            className="w-full bg-purple-50/10 border border-purple-100/80 px-4 py-3.5 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-4 focus:ring-[var(--color-brand-primary)]/5 transition-all text-sm font-medium shadow-inner"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Search Context / Specific Parameters
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you're looking for (optional)."
            rows={3}
            className="w-full bg-purple-50/10 border border-purple-100/80 px-4 py-3.5 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-4 focus:ring-[var(--color-brand-primary)]/5 transition-all text-sm font-medium resize-none leading-relaxed shadow-inner"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !topic.trim()}
          className="w-full bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 text-white font-semibold py-3.5 rounded-xl transition-all shadow-md shadow-purple-600/10 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Synthesizing Semantic Papers...
            </>
          ) : (
            "Execute Academic Search"
          )}
        </button>
      </form>
    </div>
  );
}