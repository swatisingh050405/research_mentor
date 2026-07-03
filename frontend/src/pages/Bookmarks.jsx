import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PaperCard from '../components/PaperCard';
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Bookmarks() {
  const { user } = useAuth();
  const [collections, setCollections] = useState([
    { id: "saved", name: "Saved Papers", bookmarks: [] },
  ]);
  const [activeCollectionId, setActiveCollectionId] = useState(null);

  // ─── New Collection Modal State ───
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchBookmarks();
  }, [user]);

  const fetchBookmarks = async () => {
    const { data, error } = await supabase
      .from("collections")
      .select(`
        id,
        name,
        bookmarks (
          id,
          paper_id,
          title,
          authors,
          summary,
          year,
          pdf_url
        )
      `)
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setCollections(data || []);
  };

  useEffect(() => {
    if (collections.length > 0 && !activeCollectionId) {
      setActiveCollectionId(collections[0].id);
    }
  }, [collections]);

  const activeCollection =
    collections.find((c) => c.id === activeCollectionId) || collections[0];

  const handleRemoveBookmark = async (paper) => {
    const { error } = await supabase
      .from("bookmarks")
      .delete()
      .eq("id", paper.id);

    if (error) {
      console.error(error);
      return;
    }

    fetchBookmarks();
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim() || creating || !user) return;

    setCreating(true);

    const { data, error } = await supabase
      .from("collections")
      .insert([{ user_id: user.id, name: newCollectionName.trim() }])
      .select()
      .single();

    setCreating(false);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    setCollections((prev) => [...prev, { ...data, bookmarks: [] }]);
    setActiveCollectionId(data.id);
    setNewCollectionName('');
    setShowCreateModal(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-8 md:px-12 pt-4 space-y-10 font-interface animate-in fade-in duration-500">

      {/* Vault Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-purple-100/50 pb-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight font-display flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-linear-to-br from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] flex items-center justify-center text-base shadow-md shadow-purple-200">
              🗂️
            </span>
            Research Collections
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-wide pl-12">
            Organize your saved academic streams into dedicated thematic folders.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="relative overflow-hidden bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-purple-200 hover:shadow-lg hover:shadow-purple-300 hover:-translate-y-0.5 transition-all duration-300 font-display cursor-pointer"
        >
          + New Collection
        </button>
      </div>

      {/* Folders/Pills Navigation — with sliding active indicator */}
      <div className="flex flex-wrap items-center gap-3 relative">
        {collections.map(collection => {
          const isActive = activeCollectionId === collection.id;
          return (
            <button
              key={collection.id}
              onClick={() => setActiveCollectionId(collection.id)}
              className={`relative px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-colors duration-300 font-display border overflow-hidden cursor-pointer ${
                isActive
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-500 border-purple-100 hover:border-[var(--color-brand-primary)]/40 hover:text-[var(--color-brand-primary)]'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="collection-pill-bg"
                  className="absolute inset-0 -z-0 bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] shadow-md shadow-purple-200"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {collection.name}{" "}
                <span className="ml-1.5 opacity-70">({collection.bookmarks?.length || 0})</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* FULL WIDTH CARDS FEED — animated on collection switch */}
      <div className="w-full min-h-[400px]">
        <AnimatePresence mode="wait">
          {activeCollection?.bookmarks?.length > 0 ? (
            <motion.div
              key={activeCollection.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-col gap-6"
            >
              {activeCollection.bookmarks.map((paper, i) => (
                <motion.div
                  key={paper.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                >
                  <PaperCard
                    paper={paper}
                    isBookmarked={true}
                    onBookmarkToggle={handleRemoveBookmark}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20 bg-white/40 rounded-3xl border border-dashed border-purple-200"
            >
              <div className="text-4xl opacity-50">📭</div>
              <h3 className="text-lg font-black text-slate-800 font-display">Folder is Empty</h3>
              <p className="text-xs text-slate-400 font-medium max-w-sm">
                No papers in this collection yet.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── NEW COLLECTION MODAL ─── */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-[400px] rounded-[28px] p-7 shadow-[0_30px_70px_rgba(139,92,246,0.15)] border border-purple-100 font-interface relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)]" />

              <div className="flex justify-between items-start mb-5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight font-display">
                  New Collection
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none p-1 cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-2">
                Collection Name
              </label>
              <input
                type="text"
                autoFocus
                placeholder="e.g. AI Papers"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                className="w-full border border-purple-100 bg-purple-50/10 rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-4 focus:ring-[var(--color-brand-primary)]/10 transition-all shadow-inner"
              />

              <div className="flex justify-end gap-3 mt-7">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateCollection}
                  disabled={creating || !newCollectionName.trim()}
                  className="px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 active:scale-95 flex items-center gap-2 cursor-pointer bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 shadow-md shadow-purple-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? "Creating..." : "Create Collection"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}