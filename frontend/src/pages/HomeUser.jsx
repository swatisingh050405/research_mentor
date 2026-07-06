import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import { motion, AnimatePresence } from 'framer-motion';
import PaperCard from '../components/PaperCard';
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import CollectionModal from "../components/CollectionModal";

export default function HomeUser() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [selectedPaper, setSelectedPaper] = useState(null);

  useEffect(() => {
    console.log("Current User:", user);
  }, [user]);

  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [bookmarkedIds, setBookmarkedIds] = useState([]);

  const fetchBookmarks = React.useCallback(async () => {
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

  const [isLoading, setIsLoading] = useState(false);
  const [papers, setPapers] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setHasMore(true);

    const finalQuery = `${topic} ${description}`.trim();
    setQuery(finalQuery);
    setOffset(0);

    try {
      const queryParams = new URLSearchParams({
        query: finalQuery,
        offset: 0
      });

      const response = await fetch(`http://127.0.0.1:8000/api/search?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`Status Exception: ${response.status}`);

      const data = await response.json();

      if (user) {
        const finalQuery = `${topic} ${description}`.trim();

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

      setPapers(data.papers || []);
    } catch (error) {
      console.error(error);
      setErrorMessage("FastAPI Pipeline Offline. Data streams cannot be reached.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBookmarkToggle = async (paper) => {
    setSelectedPaper(paper);
    setShowCollectionModal(true);
    return;
    if (!user) {
      alert("Please login first.");
      return;
    }

    const existing = bookmarkedIds.find(
      (item) => item.paper_id === paper.id
    );

    if (existing) {
      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", existing.id);

      if (error) {
        console.error(error);
        return;
      }

      setBookmarkedIds(prev =>
        prev.filter(item => item.id !== existing.id)
      );

    } else {
      const { data, error } = await supabase
        .from("bookmarks")
        .insert([
          {
            user_id: user.id,
            paper_id: paper.id,
            title: paper.title,
            authors: paper.authors,
            summary: paper.summary || paper.abstract,
            year: paper.year,
            pdf_url: paper.link || paper.url,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error(error);
        alert(error.message);
        return;
      }

      setBookmarkedIds(prev => [
        ...prev,
        { id: data.id, paper_id: paper.id }
      ]);
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

      const response = await fetch(`http://127.0.0.1:8000/api/search?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`Status Exception: ${response.status}`);

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
    <div className="max-w-6xl w-full mx-auto space-y-10 font-interface animate-in fade-in duration-500">

      {/* 🌟 SEARCH CONSOLE ENGINE CARD */}
      <SearchBar
        topic={topic}
        setTopic={setTopic}
        description={description}
        setDescription={setDescription}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        variant="user"
      />

      {/* 🌟 DISCOVERED ASSET CARDS — Rendering Data Dynamically */}
      <div className="space-y-5">
        {(papers.length > 0 || errorMessage) && (
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest pl-1">
            {errorMessage ? "System Error Report" : `Discovered Clustered Asset Cards (${papers.length})`}
          </h4>
        )}

        {errorMessage && (
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-xs font-semibold text-red-600 shadow-sm text-center">
            ⚠️ {errorMessage}
          </div>
        )}

        <div className="flex flex-col gap-6">
          <AnimatePresence>
            {papers.map((paper, i) => (
              <motion.div
                key={paper.id || i}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
              >
                <PaperCard
                  paper={paper}
                  isBookmarked={bookmarkedIds.some(
                    item => item.paper_id === paper.id
                  )}
                  onBookmarkToggle={handleBookmarkToggle}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Load More button */}
        {papers.length > 0 && hasMore && (
          <div className="flex justify-center pt-2">
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

        {papers.length > 0 && !hasMore && (
          <p className="text-center text-xs text-slate-400 font-semibold pt-2">
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