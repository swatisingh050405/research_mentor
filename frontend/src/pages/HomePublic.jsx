import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from 'framer-motion';
import PaperCard from '../components/PaperCard';
import SearchBar from '../components/SearchBar';


export default function HomePublic() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [papers, setPapers] = useState([]);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searched, setSearched] = useState(false);

  const handlePublicSearch = async (e) => {
    e.preventDefault();

    if (!topic.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setHasMore(true);
    setSearched(true);
    setPapers([]);

    const finalQuery = `${topic} ${description}`.trim();

    setQuery(finalQuery);
    setOffset(0);

    try {
      const queryParams = new URLSearchParams({
        query: finalQuery,
        offset: 0
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/search?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Status Exception: ${response.status}`);
      }

      const data = await response.json();

      console.log(data);

      setPapers(data.papers || []);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Local ML API Pipeline status offline. Verify terminal session." 
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const nextOffset = offset + 5;

      const queryParams = new URLSearchParams({
        query: query,
        offset: nextOffset
      });

      const response = await fetch(
        `http://127.0.0.1:8000/api/search?${queryParams.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Status Exception: ${response.status}`);
      }

      const data = await response.json();
      const newPapers = data.papers || [];

    setPapers(prev => {
    const ids = new Set(prev.map(p => p.id));

    const filtered = newPapers.filter(
        paper => !ids.has(paper.id)
    );

    return [...prev, ...filtered];
});
      setOffset(nextOffset);

      if (newPapers.length < 5) {
        setHasMore(false);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFF] text-slate-800 font-interface relative overflow-x-hidden">

      {/* 🌟 PREMIUM DETAILED STRUCTURAL VECTOR BACKGROUND */}
      <div className="absolute top-0 inset-0 h-180 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[80%] bg-[var(--color-brand-primary)]/10 rounded-full blur-[130px]" />
        <div className="absolute top-[5%] right-[-10%] w-[60%] h-[90%] bg-[var(--color-brand-accent)]/10 rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e8e3fa_1px,transparent_1px),linear-gradient(to_bottom,#e8e3fa_1px,transparent_1px)] bg-size-[40px_40px] opacity-40 mask-linear-[to_bottom,white_40%,transparent_95%]" />

        <svg className="absolute inset-0 w-full h-full opacity-60 text-[var(--color-brand-primary)]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="dotGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#8A22F9" stopOpacity="1" />
              <stop offset="100%" stopColor="#8A22F9" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M -10,120 L 300,120 L 450,280 L 900,280 L 1050,140 L 1500,140" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="opacity-40" />
          <path d="M 150,450 L 500,450 L 680,240 L 1200,240" fill="none" stroke="currentColor" strokeWidth="0.75" className="opacity-30" />
          <path d="M 350,20 L 450,150 L 450,350 L 200,600" fill="none" stroke="#5B37F7" strokeWidth="0.5" className="opacity-20" />
          <path d="M 850,50 L 950,200 L 800,450" fill="none" stroke="#5B37F7" strokeWidth="0.5" className="opacity-20" />
          <circle cx="300" cy="120" r="4" fill="#8A22F9" className="animate-pulse" />
          <circle cx="450" cy="280" r="5" fill="#5B37F7" />
          <circle cx="900" cy="280" r="4" fill="#A855F7" />
          <circle cx="1050" cy="140" r="5" fill="#8A22F9" />
          <circle cx="500" cy="450" r="3.5" fill="#5A1FD4" />
          <circle cx="680" cy="240" r="4.5" fill="#A855F7" />
          <path d="M 295,120 L 305,120 M 300,115 L 300,125" stroke="currentColor" strokeWidth="0.5" />
          <path d="M 1045,140 L 1055,140 M 1050,135 L 1050,145" stroke="currentColor" strokeWidth="0.5" />
        </svg>

        <div className="absolute top-[18%] left-[12%] w-2 h-2 bg-[var(--color-brand-primary)]/40 rounded-full animate-ping" />
        <div className="absolute top-[45%] right-[10%] w-3 h-3 bg-[var(--color-brand-accent)]/30 rounded-full animate-pulse" />
      </div>

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <header className="flex justify-between items-center py-6 border-b border-purple-100/60 backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-linear-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-xl flex items-center justify-center shadow-md shadow-purple-600/10">
              <span className="font-black text-white text-base font-display">R</span>
            </div>
            <span className="text-lg font-black tracking-tight text-slate-900 font-display">
              RESEARCH<span className="text-[var(--color-brand-primary)]">_MENTOR</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-500">
            <a href="#features" className="hover:text-[var(--color-brand-primary)] transition-colors">Features</a>
            <a href="#about" className="hover:text-[var(--color-brand-primary)] transition-colors">About System</a>
            <a href="#docs" className="hover:text-[var(--color-brand-primary)] transition-colors">Docs</a>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => navigate("/workspace")}
                  className="text-sm font-semibold text-white bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-5 py-2.5 rounded-xl shadow-sm shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Workspace
                </button>

                <button
                  onClick={() => navigate("/profile")}
                  className="w-10 h-10 rounded-full bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-bold"
                >
                  {user.user_metadata?.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "R"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  className="text-sm font-semibold text-white bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-5 py-2.5 rounded-xl shadow-sm shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Sign In
                </button>

                <button
                  onClick={() => navigate("/signup")}
                  className="text-sm font-semibold text-white bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-5 py-2.5 rounded-xl shadow-sm shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Create Account
                </button>
              </>
            )}
          </div>
        </header>

        <div className="flex flex-col items-center justify-center text-center pt-24 pb-12 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-purple-50/90 border border-purple-100 px-3 py-1 rounded-full text-xs font-bold text-[var(--color-brand-primary)] mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)] animate-pulse" />
            NLP Literature Engine Connected
          </div>

          <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4 leading-tight font-display">
            Supercharge Your <br />
            <span className="bg-linear-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)] bg-clip-text text-transparent">
              Literature Review
            </span>
          </h1>

          <p className="text-slate-500 text-sm md:text-base max-w-xl mb-10 leading-relaxed font-medium">
            Find, summarize, and organize academic research papers with production-grade AI insights, extraction, and real-time semantic tracking.
          </p>

          <SearchBar
          topic={topic}
          setTopic={setTopic}
          description={description}
          setDescription={setDescription}
          onSubmit={handlePublicSearch}
          isLoading={isLoading}
          variant="public"
        />

          
        </div>

        {/* Results Rendering Stream */}
        {searched && (
          <section className="border-t border-purple-100/60 pt-10 pb-24">
            
            {errorMessage && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-xs font-semibold text-red-600 max-w-xl mx-auto text-center shadow-sm">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Loading Grid */}
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-64 bg-white border border-purple-100/60 p-6 rounded-2xl animate-pulse shadow-sm" />
                ))}
              </div>
            )}

            {/* Live Data Mapping */}
            {!isLoading && papers.length > 0 && (
              <div className="space-y-8">
                {papers.map((paper, idx) => (
                  <PaperCard 
                    key={paper.id || idx} 
                    paper={{
                      ...paper,
                      summary: paper.ai_summary || paper.summary || paper.abstract,
                      keywords: paper.keywords || []
                    }}
                    onBookmarkToggle={() => alert("Please Sign In to save this paper!")}
                  />
                ))}

                {/* Load More button */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 bg-white border border-purple-100 text-[var(--color-brand-primary)] font-bold text-sm px-6 py-3 rounded-xl shadow-sm hover:border-[var(--color-brand-primary)]/40 hover:shadow-md hover:shadow-purple-600/10 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    >
                      {loadingMore ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-[var(--color-brand-primary)]" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Loading More...
                        </>
                      ) : (
                        "Load More Papers ↓"
                      )}
                    </button>
                  </div>
                )}

                {papers.length >0 && !hasMore && (
                  <p className="text-center text-xs text-slate-400 font-semibold pt-4">
                    You've reached the end of the results.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}