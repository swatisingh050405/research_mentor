import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  
  // Real Data States (Replaced hardcoded trackedPapers)
  const [isLoading, setIsLoading] = useState(false);
  const [papers, setPapers] = useState([]);
  const [errorMessage, setErrorMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const queryParams = new URLSearchParams({
        query: `${topic} ${description}`.trim()
      });

      // Same structural bridge used in Public Layer
      const response = await fetch(`http://127.0.0.1:8000/api/search?${queryParams.toString()}`);
      if (!response.ok) throw new Error(`Status Exception: ${response.status}`);

      const data = await response.json();
      // Save search history
      if (user) {
        await supabase.from("search_history").insert([
          {
            user_id: user.id,
            query: `${topic} ${description}`.trim(),
          },
        ]);
      }

        setPapers(data.papers || []);

      // setPapers(data.papers || []);
      // setPapers(data.papers || []);
      
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

  // REMOVE from UI
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

  // ADD to UI
  setBookmarkedIds(prev => [
    ...prev,
    { id: data.id, paper_id: paper.id }
  ]);
}

};

  



  return (
    <div className="max-w-6xl w-full mx-auto space-y-10 font-interface animate-in fade-in duration-500">

      {/* 🌟 SEARCH CONSOLE ENGINE CARD */}
      <div className="bg-white rounded-[28px] p-8 shadow-[0_20px_50px_rgba(123,47,247,0.02)] relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[4px] bg-gradient-to-r from-[var(--color-brand-primary)] via-[#5A1FD4] to-[var(--color-brand-accent)]" />

        <form className="space-y-6" onSubmit={handleSubmit}>
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