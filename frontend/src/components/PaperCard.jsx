import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PaperCard({
  paper,
  isBookmarked = false,
  onBookmarkToggle,
}) {
  const navigate = useNavigate();

  if (!paper) return null;

  return (
    <div className="w-full bg-white rounded-[28px] p-7 border border-purple-100/80 shadow-[0_15px_40px_rgba(123,47,247,0.04)] hover:shadow-[0_25px_50px_rgba(123,47,247,0.12)] transition-all duration-300 flex flex-col relative overflow-hidden group">

      {/* Top Gradient */}
      <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-[var(--color-brand-primary)] via-[#A855F7] to-[#D6BCFA]" />

      <div className="space-y-5">

        {/* Year + Bookmark */}
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 bg-[#F6F5FD] text-[var(--color-brand-primary)] border border-purple-100 rounded-md">
            📅 {paper.year || "N/A"}
          </span>

          {onBookmarkToggle && (
            <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmarkToggle(paper);
            }}
            className="text-2xl cursor-pointer transition-transform duration-200 hover:scale-110"
          >
            {isBookmarked ? "⭐" : "🔖"}
          </button>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg md:text-xl font-black tracking-tight leading-snug">
          <a
            href={paper.url || paper.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-900 hover:text-[var(--color-brand-primary)] hover:underline transition-colors"
          >
            {paper.title}
          </a>
        </h3>

        {/* Authors */}
        <p className="text-sm text-slate-500 font-medium">
          👤{" "}
          {paper.authors
            ? (() => {
                const authors = paper.authors
                  .split(",")
                  .map((a) => a.trim());

                return authors.length > 3
                  ? `${authors.slice(0, 3).join(", ")} et al.`
                  : authors.join(", ");
              })()
            : "Unknown Author"}
        </p>

        <div className="flex items-center gap-2 flex-wrap">

  <span
    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full
      ${
        paper.difficulty_level === "Beginner"
          ? "bg-green-50 text-green-700 border border-green-200"
          : paper.difficulty_level === "Advanced"
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-yellow-50 text-yellow-700 border border-yellow-200"
      }
    `}
  >
    {paper.difficulty_level || "Intermediate"}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-purple-50 border border-purple-100 text-[var(--color-brand-primary)]">
        {paper.source_type}
      </span>

    

    </div>
        {/* Summary */}
        <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-5">
          <h4 className="text-xs font-black uppercase tracking-widest text-[var(--color-brand-primary)] mb-3">
            Summary
          </h4>

          <p className="text-sm text-slate-600 leading-8">
            {paper.summary ||
              paper.abstract ||
              "No abstract available."}
          </p>
        </div>

      </div>

      {/* Footer */}
      <div className="pt-6 mt-6 border-t border-purple-100 space-y-4">

        <div className="flex flex-wrap gap-2">
          {(paper.keywords || []).slice(0, 5).map((tag, idx) => (
            <span
              key={idx}
              className="text-[10px] font-bold uppercase text-[var(--color-brand-primary)] bg-purple-50 border border-purple-100 px-3 py-1 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>

        <button
          onClick={() =>
            navigate(`/paper/${paper.id}`, {
              state: { paper },
            })
          }
          className="bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-sm font-bold px-6 py-3 rounded-xl cursor-pointer hover:opacity-90 w-fit"
        >
          Launch Read Console →
        </button>

      </div>

    </div>
  );
}