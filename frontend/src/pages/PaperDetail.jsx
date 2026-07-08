import React, { useState } from 'react';
import { useEffect } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from "../context/AuthContext";
import RecommendationSidebar from "../components/RecommendationSidebar";
const API_URL = import.meta.env.VITE_API_URL;

export default function PaperDetail() {
  const navigate = useNavigate();
  const location = useLocation();

  const { user } = useAuth();
  const isAuthenticated = !!user;
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);

  // Dynamic paper data — comes from PaperCard's navigate(`/paper/${id}`, { state: { paper } })
  const paper = location.state?.paper;

  // Guard: agar direct URL se aaye bina state ke (refresh / direct link access)
  if (!paper) {
    return (
      <div className="min-h-screen bg-[#FDFDFF] flex flex-col items-center justify-center gap-4 font-interface px-6 text-center">
        <div className="text-4xl">📭</div>
        <h2 className="text-lg font-black text-slate-800 font-display">No Paper Data Found</h2>
        <p className="text-xs text-slate-500 font-medium max-w-sm">
          This page needs paper data passed via navigation. Please go back and open a paper from the list.
        </p>
        <button
          onClick={() => navigate('/workspace')}
          className="mt-2 bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-all"
        >
          ← Back to Workspace
        </button>
      </div>
    );
  }

  // Normalize authors: PaperCard stores it as a comma-separated string
  const authorsDisplay = paper.authors ? paper.authors : 'Unknown Author';

  const externalLink = paper.link || paper.url;
  const abstract = paper.abstract;
  useEffect(() => {
  async function loadRecommendations() {
    if (!paper?.id) return;

    try {
      setLoadingRecommendations(true);

      const response = await fetch(
        `${API_URL}/api/paper/${paper.id}`
      );

      if (!response.ok) {
        throw new Error("Failed to load recommendations");
      }

      const data = await response.json();

      setRecommendations(data.recommendations ?? []);
    } catch (err) {
      console.error(err);
      setRecommendations([]);
    } finally {
      setLoadingRecommendations(false);
    }
  }

  loadRecommendations();
}, [paper?.id]);

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-800 font-interface relative overflow-x-hidden pb-16">

      {/* 🔮 AMBIENT BACKDROP */}
      <div className="absolute top-0 inset-0 h-[500px] overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[750px] bg-linear-to-b from-[var(--color-brand-primary)]/12 via-[var(--color-brand-accent)]/6 to-transparent rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800d_1px,transparent_1px),linear-gradient(to_bottom,#8080800d_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_1px)]" />
      </div>

      {/* ================= NAVBAR ================= */}
      <nav className="w-full bg-white/80 backdrop-blur-md border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-9 h-9 bg-linear-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-xl flex items-center justify-center shadow-md shadow-purple-600/10 transition-transform duration-300 group-hover:scale-105">
              <span className="font-black text-white text-sm font-display">R</span>
            </div>
            <span className="text-base font-black tracking-tight text-slate-900 font-display">
              RESEARCH<span className="text-[var(--color-brand-primary)]">_MENTOR</span>
            </span>
          </div>

          {isAuthenticated ? (
            <div
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2.5 bg-purple-50/60 border border-purple-100/70 py-1.5 pl-3 pr-1.5 rounded-full shadow-inner cursor-pointer hover:border-[var(--color-brand-primary)]/30 transition-colors"
            >
              <span className="text-xs font-bold text-slate-600 hidden sm:inline">{user?.user_metadata?.full_name || "User"}</span>
              <div className="w-8 h-8 bg-linear-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-full flex items-center justify-center text-xs font-bold text-white shadow shadow-purple-600/20 ring-2 ring-white">
                {user?.user_metadata?.full_name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "U"}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/login')} className="text-xs font-bold text-slate-600 hover:text-[var(--color-brand-primary)] px-3.5 py-2 transition-colors cursor-pointer">
                Sign In
              </button>
              <button onClick={() => navigate('/signup')} className="text-xs font-bold text-white bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer">
                Create Account
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* ================= MAIN CONTENT: SINGLE COLUMN STACK ================= */}
      <div className="max-w-7xl mx-auto px-6 relative z-10 pt-8">

        {/* Back link */}
        <motion.button
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-brand-primary)] hover:text-[var(--color-brand-accent)] bg-white border border-purple-100 px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer hover:-translate-x-0.5"
        >
          ← Back to Results
        </motion.button>
        <div className="grid lg:grid-cols-[2fr_1fr] gap-8 items-start">
        <div className="space-y-6">

          

        {/* ─── TITLE BLOCK ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
          className="bg-white border border-purple-100 rounded-[2.2rem] p-7 md:p-9 shadow-[0_30px_70px_rgba(139,92,246,0.04)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)]" />

          <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 bg-[#F6F5FD] text-[var(--color-brand-primary)] border border-purple-100 rounded-md inline-block mb-4">
            📅 Published {paper.year || "N/A"}
          </span>

          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug font-display mb-3">
            {paper.title}
          </h1>

          <p className="text-sm text-slate-500 font-medium mb-6">
            👤 {authorsDisplay}
          </p>

          {externalLink && (
            <a
            
              href={externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md shadow-purple-600/10"
            >
              Open Original Paper ↗
            </a>

          )}
        </motion.div>

        {/* ─── ORIGINAL ABSTRACT ─── */}
        {abstract && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
            className="bg-white border border-purple-100 rounded-[2rem] p-7 md:p-9 shadow-sm"
          >
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
              📄 Original Paper Abstract
            </h3>
            <p className="text-sm text-slate-600 leading-8 font-medium bg-purple-50/5 border border-purple-100/50 p-5 rounded-2xl shadow-inner">
              {abstract}
            </p>
          </motion.div>
        )}

        {/* ─── KEYWORDS + BOOKMARK ─── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          className="bg-white border border-purple-100 rounded-[2rem] p-7 md:p-9 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5"
        >
          <div className="flex flex-wrap gap-2">
            {(paper.keywords || []).length > 0 ? (
              paper.keywords.slice(0, 8).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-bold uppercase text-[var(--color-brand-primary)] bg-purple-50 border border-purple-100 px-3 py-1 rounded-full"
                >
                  #{tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-400 font-semibold">No keywords listed</span>
            )}
          </div>

          <button
            onClick={() => setIsBookmarked(!isBookmarked)}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 shrink-0 cursor-pointer shadow-sm border active:scale-95 ${
              isBookmarked
                ? 'bg-linear-to-r from-brand-primary to-[var(--color-brand-accent)] border-transparent text-white shadow-purple-600/20 scale-[1.02]'
                : 'bg-white border-purple-100 text-brand-primary hover:bg-purple-50'
            }`}
          >
            {isBookmarked ? "★ Saved to Library" : "🔖 Bookmark This Paper"}
          </button>
          </motion.div>

      </div>

      {/* RIGHT COLUMN */}
      <RecommendationSidebar
    
    recommendations={recommendations}
    loading={loadingRecommendations}
/>

    </div>

  </div>

</div>
  );
}
        