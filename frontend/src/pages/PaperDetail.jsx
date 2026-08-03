import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import RecommendationSidebar from "../components/RecommendationSidebar";
import CollectionModal from "../components/CollectionModal";
import ChatPanel from "../components/ChatPanel";
import { fetchPaperDetails } from "../services/api";

export default function PaperDetail() {
  const navigate = useNavigate();
  const location = useLocation();
  const { paperId } = useParams();

  const { user } = useAuth();
  const isAuthenticated = Boolean(user && (user.id || user.email));

  const [paper, setPaper] = useState(location.state?.paper || null);
  const [isLoadingPaper, setIsLoadingPaper] = useState(!location.state?.paper);
  const [notFound, setNotFound] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [chatStarted, setChatStarted] = useState(false);

  // 📱 Mobile Tab Switcher State: 'details' or 'chat'
  const [activeTab, setActiveTab] = useState("details");

  // ↔️ Resizable Chat Panel State (Desktop Only)
  const [chatWidth, setChatWidth] = useState(450);
  const isDraggingRef = useRef(false);

  const effectivePaperId = paperId || paper?.paper_id || paper?.id;

  // ─── Drag to Resize Handlers ───
  const startResizing = useCallback((e) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent) => {
      if (!isDraggingRef.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX - 24;
      if (newWidth >= 340 && newWidth <= 750) {
        setChatWidth(newWidth);
      }
    };

    const stopResizing = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);
  }, []);

  useEffect(() => {
    if (!effectivePaperId) {
      setIsLoadingPaper(false);
      setNotFound(true);
      return;
    }

    let cancelled = false;

    async function loadPaper() {
      try {
        setLoadingRecommendations(true);
        const data = await fetchPaperDetails(effectivePaperId);

        if (cancelled) return;

        if (data?.paper) {
          setPaper(data.paper);
          setRecommendations(data.recommendations || []);
        }
      } catch (err) {
        console.warn(
          "Backend paper fetch error - using client state if available:",
          err,
        );
        // Fallback: If 404 from API but state has paper details, don't trigger notFound
        if (!cancelled && !location.state?.paper) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingPaper(false);
          setLoadingRecommendations(false);
        }
      }
    }

    loadPaper();

    return () => {
      cancelled = true;
    };
  }, [effectivePaperId, location.state]);

  const checkBookmarkStatus = useCallback(async () => {
    if (!user?.id || !effectivePaperId) return;

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("paper_id", effectivePaperId)
      .maybeSingle();

    if (!error) {
      setIsBookmarked(Boolean(data));
    }
  }, [user?.id, effectivePaperId]);

  useEffect(() => {
    checkBookmarkStatus();
  }, [checkBookmarkStatus]);

  const handleBookmarkClick = () => {
    if (!isAuthenticated) {
      if (
        window.confirm(
          "Please Sign In or Create an Account to save papers to your library!",
        )
      ) {
        navigate("/login");
      }
      return;
    }
    setShowCollectionModal(true);
  };

  const handleHomeNavigate = () => {
    navigate(isAuthenticated ? "/workspace" : "/");
  };

  if (isLoadingPaper) {
    return (
      <div className="h-screen bg-[#FDFDFF] flex items-center justify-center font-interface">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-100 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
          <p className="text-xs font-bold text-slate-500">Loading paper...</p>
        </div>
      </div>
    );
  }

  if (notFound || !paper) {
    return (
      <div className="h-screen bg-[#FDFDFF] flex flex-col items-center justify-center gap-4 font-interface px-6 text-center">
        <div className="text-4xl">📭</div>
        <h2 className="text-lg font-black text-slate-800 font-display">
          Paper Not Found
        </h2>
        <p className="text-xs text-slate-500 font-medium max-w-sm">
          This paper couldn't be found. It may have been removed, or the link
          may be incorrect.
        </p>
        <button
          onClick={handleHomeNavigate}
          className="mt-2 bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:opacity-90 transition-all cursor-pointer"
        >
          ← Back to Home
        </button>
      </div>
    );
  }

  const authorsDisplay = paper.authors || "Unknown Author";
  const externalLink = paper.url;
  const abstract = paper.abstract;

  const userDisplayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Researcher";

  const userInitials = userDisplayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen lg:h-screen w-screen bg-[#FDFDFF] text-slate-800 font-interface relative overflow-x-hidden lg:overflow-hidden flex flex-col">
      {/* 🔮 AMBIENT BACKDROP */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[750px] rounded-full blur-[140px] bg-gradient-to-b from-[var(--color-brand-primary)]/12 via-[var(--color-brand-accent)]/6 to-transparent" />
      </div>

      {/* ================= NAVBAR ================= */}
      <nav className="w-full h-16 shrink-0 bg-white/80 backdrop-blur-md border-b border-purple-100 relative z-50">
        <div className="max-w-full px-4 sm:px-6 h-full flex justify-between items-center">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={handleHomeNavigate}
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-xl flex items-center justify-center shadow-md shadow-purple-600/10 transition-transform duration-300 group-hover:scale-105">
              <span className="font-black text-white text-sm font-display">
                R
              </span>
            </div>
            <span className="text-sm sm:text-base font-black tracking-tight text-slate-900 font-display">
              RESEARCH
              <span className="text-[var(--color-brand-primary)]">_MENTOR</span>
            </span>
          </div>

          {/* DYNAMIC AUTH HEADER ACTION */}
          {isAuthenticated ? (
            <div
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2.5 bg-purple-50/70 border border-purple-100 hover:border-[var(--color-brand-primary)]/40 py-1.5 pl-3.5 pr-1.5 rounded-full shadow-inner cursor-pointer transition-all hover:scale-105"
            >
              <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                {userDisplayName}
              </span>
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-full flex items-center justify-center text-xs font-black text-white shadow-md shadow-purple-600/20 ring-2 ring-white">
                {userInitials}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/login")}
                className="text-xs font-bold text-slate-600 hover:text-[var(--color-brand-primary)] px-2.5 sm:px-3.5 py-2 transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="text-xs font-bold text-white bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-3 sm:px-4 py-2 rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* 📱 MOBILE VIEW TAB SWITCHER HEADER (VISIBLE BELOW LG SCREENS) */}
      <div className="lg:hidden w-full bg-white border-b border-purple-100 px-4 py-2.5 flex gap-2 relative z-40 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "details"
              ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
              : "bg-purple-50/70 text-slate-600 hover:bg-purple-100/50"
          }`}
        >
          📄 Paper Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "chat"
              ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
              : "bg-purple-50/70 text-slate-600 hover:bg-purple-100/50"
          }`}
        >
          💬 AI Chat
        </button>
      </div>

      {/* ================= MAIN RESPONSIVE WORKSPACE ================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden relative z-10 p-3 sm:p-4 md:p-6 gap-4">
        {/* LEFT COLUMN: Independent Scrollable Details Panel */}
        <div
          className={`flex-1 h-full overflow-y-auto pr-0 lg:pr-2 space-y-6 ${
            activeTab === "details" ? "block" : "hidden lg:block"
          }`}
        >
          {/* Nav buttons */}
          <div className="flex items-center gap-3">
            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-brand-primary)] hover:text-[var(--color-brand-accent)] bg-white border border-purple-100 px-3.5 sm:px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer hover:-translate-x-0.5"
            >
              ← Back to Results
            </motion.button>

            <motion.button
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleHomeNavigate}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[var(--color-brand-primary)] bg-white border border-purple-100 px-3.5 sm:px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
            >
              ← Home
            </motion.button>
          </div>

          {/* Title Block */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-purple-100 rounded-[1.8rem] sm:rounded-[2.2rem] p-5 sm:p-7 md:p-9 shadow-[0_30px_70px_rgba(139,92,246,0.04)] relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)]" />

            <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 bg-[#F6F5FD] text-[var(--color-brand-primary)] border border-purple-100 rounded-md inline-block mb-4">
              📅 Published {paper.year || "N/A"}
            </span>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-snug font-display mb-3">
              {paper.title}
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-6">
              👤 {authorsDisplay}
            </p>

            {externalLink && (
              <a
                href={externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-xs font-bold px-4 sm:px-5 py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md shadow-purple-600/10"
              >
                Open Original Paper ↗
              </a>
            )}
          </motion.div>

          {/* Abstract */}
          {abstract && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-purple-100 rounded-[1.8rem] sm:rounded-[2rem] p-5 sm:p-7 md:p-9 shadow-sm"
            >
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-1.5">
                📄 Original Paper Abstract
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed sm:leading-8 font-medium bg-purple-50/5 border border-purple-100/50 p-4 sm:p-5 rounded-2xl shadow-inner">
                {abstract}
              </p>
            </motion.div>
          )}

          {/* Keywords & Bookmark */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-purple-100 rounded-[1.8rem] sm:rounded-[2rem] p-5 sm:p-7 md:p-9 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5"
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
                <span className="text-xs text-slate-400 font-semibold">
                  No keywords listed
                </span>
              )}
            </div>

            <button
              onClick={handleBookmarkClick}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 shrink-0 cursor-pointer shadow-sm border active:scale-95 ${
                isBookmarked
                  ? "bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] border-transparent text-white shadow-purple-600/20 scale-[1.02]"
                  : "bg-white border-purple-100 text-[var(--color-brand-primary)] hover:bg-purple-50"
              }`}
            >
              {isBookmarked ? "★ Saved to Library" : "🔖 Bookmark This Paper"}
            </button>
          </motion.div>

          {/* AI Recommendations */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="pb-8"
          >
            <RecommendationSidebar
              recommendations={recommendations}
              loading={loadingRecommendations}
            />
          </motion.div>
        </div>

        {/* ↔️ RESIZE HANDLE (DESKTOP ONLY) */}
        <div
          onMouseDown={startResizing}
          className="hidden lg:flex items-center justify-center w-3 h-full cursor-col-resize group hover:bg-purple-50 rounded-full transition-colors shrink-0"
          title="Drag to resize Chat Panel"
        >
          <div className="w-1 h-16 bg-purple-200 group-hover:bg-[var(--color-brand-primary)] rounded-full transition-colors" />
        </div>

        {/* RIGHT COLUMN: AI Chat Panel Container */}
        <div
          style={{
            width: window.innerWidth >= 1024 ? `${chatWidth}px` : "100%",
          }}
          className={`h-[550px] lg:h-full w-full shrink-0 flex flex-col transition-none ${
            activeTab === "chat" ? "block" : "hidden lg:flex"
          }`}
        >
          {chatStarted ? (
            /* 💡 CRITICAL FIX: user={user} passed to ChatPanel */
            <ChatPanel
              paperId={effectivePaperId}
              paperTitle={paper.title}
              user={user}
            />
          ) : (
            <div className="bg-white border border-purple-100 rounded-[1.8rem] sm:rounded-[2rem] p-6 sm:p-7 shadow-sm flex flex-col items-center text-center gap-3 h-full justify-center">
              <div className="text-2xl">💬</div>
              <h3 className="text-sm font-black text-slate-800">
                Chat With This Paper
              </h3>
              <p className="text-xs text-slate-500 font-medium max-w-xs">
                Ask questions and get answers grounded in this paper's content.
              </p>
              <button
                onClick={() => setChatStarted(true)}
                className="mt-1 bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-xs font-bold px-6 py-3 rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md shadow-purple-600/10 w-full cursor-pointer max-w-xs"
              >
                Start Chat →
              </button>
            </div>
          )}
        </div>
      </div>

      <CollectionModal
        open={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        paper={paper}
        onSaved={() => setIsBookmarked(true)}
      />
    </div>
  );
}
