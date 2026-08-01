import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import SearchBar from "../components/SearchBar";
import PaperCard from "../components/PaperCard";
import CollectionModal from "../components/CollectionModal";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useUserSearch } from "../context/UserSearchContext";
import { startSearch, loadMoreResults } from "../services/api";

export default function HomeUser() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);

  // Search state lives in UserSearchContext (above the routes) so it
  // survives navigating to PaperDetail and back — only transient UI
  // state (isLoading, loadingMore) and the bookmark modal stay local.
  const {
    topic,
    setTopic,
    description,
    setDescription,
    papers,
    setPapers,
    searchId,
    setSearchId,
    hasMore,
    setHasMore,
    errorMessage,
    setErrorMessage,
  } = useUserSearch();

  const [bookmarkedIds, setBookmarkedIds] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch Bookmarks
  const fetchBookmarks = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("bookmarks")
      .select("id, paper_id")
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setBookmarkedIds(data || []);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchBookmarks();
    }
  }, [user?.id, fetchBookmarks]);

  // Quick Action Preset Prompts
  const quickCategories = [
    {
      title: "Deep Learning & AI",
      desc: "Find recent survey and benchmark papers",
      icon: "🧠",
      topic: "Deep Learning Architectures",
      description:
        "State of the art transformers, vision models, and LLM optimizations",
      accent:
        "from-[var(--color-brand-primary)] to-[var(--color-brand-accent)]",
      iconBg: "from-purple-50 to-indigo-50 text-purple-600",
    },
    {
      title: "Medical & Healthcare",
      desc: "Medical imaging, segmentation & diagnosis",
      icon: "🩺",
      topic: "Medical Image Segmentation",
      description:
        "CT scan segmentation, disease detection, and clinical AI tools",
      accent: "from-blue-500 to-cyan-400",
      iconBg: "from-blue-50 to-cyan-50 text-blue-600",
    },
    {
      title: "Data & ML Pipelines",
      desc: "Data collection, scraping & web datasets",
      icon: "📊",
      topic: "E-Commerce Recommendation Systems",
      description:
        "Collaborative filtering, graph neural networks, and dataset cleaning",
      accent: "from-emerald-500 to-teal-400",
      iconBg: "from-emerald-50 to-teal-50 text-emerald-600",
    },
    {
      title: "Fact-Checking & NLP",
      desc: "Misinformation detection & NLP models",
      icon: "🔍",
      topic: "Automated Fact Checking NLP",
      description:
        "Claim verification, stance detection, and hallucination reduction",
      accent: "from-amber-500 to-orange-400",
      iconBg: "from-amber-50 to-orange-50 text-amber-600",
    },
  ];

  const executeSearchWithQuery = async (searchTopic, searchDesc = "") => {
    setTopic(searchTopic);
    setDescription(searchDesc);
    setIsLoading(true);
    setErrorMessage(null);
    setPapers([]);
    setSearchId(null);
    setHasMore(false);

    const finalQuery = `${searchTopic} ${searchDesc}`.trim();

    try {
      const data = await startSearch(searchTopic, searchDesc);

      if (user) {
        const { data: lastSearch } = await supabase
          .from("search_history")
          .select("query")
          .eq("user_id", user.id)
          .order("search_date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!lastSearch || lastSearch.query !== finalQuery) {
          await supabase.from("search_history").insert([
            {
              user_id: user.id,
              query: finalQuery,
            },
          ]);
        }
      }

      setPapers(data.results || []);
      setSearchId(data.search_id);
      setHasMore(Boolean(data.has_more));
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Search engine backend is offline or unreachable. Please try again later.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    executeSearchWithQuery(topic, description);
  };

  const handleBookmarkToggle = (paper) => {
    if (!user) {
      alert("Please login first.");
      return;
    }
    setSelectedPaper(paper);
    setShowCollectionModal(true);
  };

  const handleLoadMore = async () => {
    if (!searchId) return;

    setLoadingMore(true);

    try {
      const data = await loadMoreResults(searchId, papers.length);

      if (data.expired) {
        setHasMore(false);
        setErrorMessage(
          "This search session expired. Please search again to continue browsing.",
        );
        return;
      }

      const newPapers = data.results || [];

      setPapers((prev) => {
        const ids = new Set(prev.map((p) => p.paper_id));
        const filtered = newPapers.filter((paper) => !ids.has(paper.paper_id));
        return [...prev, ...filtered];
      });

      setHasMore(Boolean(data.has_more));
    } catch (error) {
      console.error(error);
      setErrorMessage("Failed to load more papers. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const userFirstName =
    user?.user_metadata?.full_name?.split(" ")[0] ||
    user?.email?.split("@")[0] ||
    "Researcher";

  return (
    <div className="max-w-5xl w-full mx-auto space-y-8 font-interface animate-in fade-in duration-300 pb-12">
      {/* 🌟 HERO WELCOME HEADER (Shown when no search results are loaded) */}
      {papers.length === 0 && !isLoading && (
        <div className="text-center pt-4 pb-2 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 border border-purple-100 text-[var(--color-brand-primary)] text-xs font-bold shadow-xs">
            <span>✨</span> Welcome Back, {userFirstName}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight font-display">
            What literature are you looking to explore today?
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-500 max-w-xl mx-auto">
            Search millions of research papers, extract insights, and summarize
            complex academic works instantly.
          </p>

          {/* 🌟 QUICK CATEGORY SUGGESTION CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
            {quickCategories.map((cat, idx) => (
              <motion.div
                key={idx}
                whileHover={{ y: -4, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  executeSearchWithQuery(cat.topic, cat.description)
                }
                className="relative p-4 pt-5 rounded-2xl bg-white border border-purple-100/70 shadow-sm hover:shadow-lg hover:shadow-purple-600/10 transition-all cursor-pointer text-left flex flex-col justify-between group overflow-hidden"
              >
                {/* Signature brand top accent strip, matching the rest of the app */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${cat.accent} opacity-80`}
                />

                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-2xl p-2 rounded-xl bg-gradient-to-br ${cat.iconBg} border border-white shadow-sm group-hover:scale-110 transition-transform`}
                  >
                    {cat.icon}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-[var(--color-brand-primary)] transition-colors">
                    Explore →
                  </span>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-800 group-hover:text-[var(--color-brand-primary)] transition-colors mb-1">
                    {cat.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {cat.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 🌟 SEARCH CONSOLE ENGINE CARD */}
      <div className="bg-white border border-purple-100/80 p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)] opacity-80" />
        <SearchBar
          topic={topic}
          setTopic={setTopic}
          description={description}
          setDescription={setDescription}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          variant="user"
        />
      </div>

      {/* 🌟 RESULTS SECTION */}
      <div className="space-y-5">
        {(papers.length > 0 || errorMessage) && (
          <div className="flex items-center justify-between px-1">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <span>📚</span>
              {errorMessage
                ? "System Error Report"
                : `Discovered Clustered Asset Cards (${papers.length})`}
            </h4>
            {papers.length > 0 && (
              <button
                onClick={() => {
                  setPapers([]);
                  setTopic("");
                  setDescription("");
                  setSearchId(null);
                  setHasMore(false);
                }}
                className="text-[11px] font-bold text-slate-400 hover:text-white bg-white hover:bg-gradient-to-r hover:from-[var(--color-brand-primary)] hover:to-[var(--color-brand-accent)] border border-purple-100 hover:border-transparent px-3 py-1.5 rounded-lg transition-all cursor-pointer"
              >
                Clear Results
              </button>
            )}
          </div>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-xs font-semibold text-red-600 shadow-sm text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Papers List */}
        <div className="flex flex-col gap-5">
          <AnimatePresence>
            {papers.map((paper, i) => (
              <motion.div
                key={paper.paper_id || i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05, ease: "easeOut" }}
              >
                <PaperCard
                  paper={paper}
                  isBookmarked={bookmarkedIds.some(
                    (item) => item.paper_id === paper.paper_id,
                  )}
                  onBookmarkToggle={handleBookmarkToggle}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Load More Button */}
        {papers.length > 0 && hasMore && (
          <div className="flex justify-center pt-4">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="inline-flex items-center gap-2 bg-white border border-purple-100 text-[var(--color-brand-primary)] font-bold text-xs px-6 py-3 rounded-xl shadow-sm hover:border-[var(--color-brand-primary)]/40 hover:shadow-md hover:shadow-purple-600/10 active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-purple-200 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
                  Loading More...
                </>
              ) : (
                "Load More Papers ↓"
              )}
            </button>
          </div>
        )}

        {papers.length > 0 && !hasMore && (
          <p className="text-center text-xs text-slate-400 font-semibold pt-4">
            You've reached the end of the results.
          </p>
        )}
      </div>

      <CollectionModal
        open={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        paper={selectedPaper}
        onSaved={fetchBookmarks}
      />
    </div>
  );
}
