import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePublicSearch } from "../context/PublicSearchContext";
import PaperCard from "../components/PaperCard";
import SearchBar from "../components/SearchBar";
import { startSearch, loadMoreResults } from "../services/api";

export default function HomePublic() {
  const navigate = useNavigate();
  const { user } = useAuth();

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
    searched,
    setSearched,
    errorMessage,
    setErrorMessage,
  } = usePublicSearch();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const handlePublicSearch = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSearched(true);
    setPapers([]);
    setSearchId(null);
    setHasMore(false);

    try {
      const data = await startSearch(topic, description);
      setPapers(data.results || []);
      setSearchId(data.search_id);
      setHasMore(Boolean(data.has_more));
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Search service currently unavailable. Please verify connection and retry.",
      );
    } finally {
      setIsLoading(false);
    }
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
        const ids = new Set(prev.map((p) => p.paper_id || p.id));
        const filtered = newPapers.filter(
          (paper) => !ids.has(paper.paper_id || paper.id),
        );
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

  return (
    <div className="min-h-screen w-full bg-[#FDFDFF] text-slate-800 font-interface relative overflow-x-hidden scroll-smooth transition-all duration-300">
      {/* Background Decorations */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-5%] left-[-10%] w-[70vw] sm:w-[50vw] h-[50vh] bg-[var(--color-brand-primary)]/10 rounded-full blur-[100px] sm:blur-[130px]" />
        <div className="absolute top-[10%] right-[-10%] w-[70vw] sm:w-[60vw] h-[60vh] bg-[var(--color-brand-accent)]/10 rounded-full blur-[110px] sm:blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e8e3fa_1px,transparent_1px),linear-gradient(to_bottom,#e8e3fa_1px,transparent_1px)] bg-[size:24px_24px] sm:bg-[size:40px_40px] opacity-30 sm:opacity-40 [mask-image:linear-gradient(to_bottom,white_30%,transparent_95%)]" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10">
        {/* HEADER */}
        <header className="flex justify-between items-center py-4 sm:py-6 border-b border-purple-100/60 backdrop-blur-xs">
          <div
            className="flex items-center gap-2 sm:gap-2.5 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-xl flex items-center justify-center shadow-md shadow-purple-600/10 shrink-0">
              <span className="font-black text-white text-sm sm:text-base font-display">
                R
              </span>
            </div>
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 font-display">
              RESEARCH
              <span className="text-[var(--color-brand-primary)]">_MENTOR</span>
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/workspace")}
                  className="text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-xs shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Workspace
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/profile")}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-bold text-xs sm:text-sm shrink-0 cursor-pointer"
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
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-xs shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Sign In
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-xs shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
                >
                  Create Account
                </button>
              </>
            )}
          </div>
        </header>

        {/* HERO SECTION */}
        <div className="flex flex-col items-center justify-center text-center pt-12 sm:pt-20 pb-8 sm:pb-12 max-w-3xl mx-auto px-2">
          <div className="inline-flex items-center gap-2 bg-purple-50/90 border border-purple-100 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold text-[var(--color-brand-primary)] mb-4 sm:mb-6 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[var(--color-brand-primary)] animate-pulse" />
            AI Research Assistant Active
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-3 sm:mb-4 leading-tight font-display">
            Find Papers Faster <br />
            <span className="bg-gradient-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)] bg-clip-text text-transparent">
              Understand Them Instantly
            </span>
          </h1>

          <p className="text-slate-500 text-xs sm:text-sm md:text-base max-w-xl mb-6 sm:mb-10 leading-relaxed font-medium">
            Search, summarize, and organize research papers — with AI that
            actually understands what you're looking for.
          </p>

          <div className="w-full">
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
        </div>

        {/* SEARCH RESULTS */}
        {searched && (
          <section className="border-t border-purple-100/60 pt-8 sm:pt-10 pb-16 sm:pb-24">
            {errorMessage && (
              <div className="bg-red-50 border border-red-100 p-3 sm:p-4 rounded-xl text-xs font-semibold text-red-600 max-w-xl mx-auto text-center shadow-xs mb-6">
                ⚠️ {errorMessage}
              </div>
            )}

            {isLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-6">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-56 sm:h-64 bg-white border border-purple-100/60 p-4 sm:p-6 rounded-2xl animate-pulse shadow-xs"
                  />
                ))}
              </div>
            )}

            {!isLoading && papers.length > 0 && (
              <div className="space-y-6 sm:space-y-8">
                {papers.map((paper, idx) => (
                  <PaperCard
                    key={paper.paper_id || paper.id || idx}
                    paper={paper}
                    onBookmarkToggle={() => {
                      if (!user) {
                        if (
                          window.confirm(
                            "Please Sign In or Create an Account to save papers to your workspace!",
                          )
                        ) {
                          navigate("/login");
                        }
                      }
                    }}
                  />
                ))}

                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 bg-white border border-purple-100 text-[var(--color-brand-primary)] font-bold text-xs sm:text-sm px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-xs hover:border-[var(--color-brand-primary)]/40 hover:shadow-md hover:shadow-purple-600/10 hover:-translate-y-0.5 active:scale-95 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingMore ? "Loading More..." : "Load More Papers ↓"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
