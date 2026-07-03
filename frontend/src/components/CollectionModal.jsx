import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";

export default function CollectionModal({ open, onClose, paper, onSaved }) {
  const [collections, setCollections] = useState([]);
  const [newCollection, setNewCollection] = useState("");
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;

    const loadCollections = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("collections")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at");

      setCollections(data || []);
    };

    loadCollections();
  }, [open]);

  const handleCreateCollection = async () => {
    if (!newCollection.trim() || creating) return;

    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCreating(false);
      return;
    }

    const { data, error } = await supabase
      .from("collections")
      .insert([
        {
          user_id: user.id,
          name: newCollection,
        },
      ])
      .select()
      .single();

    setCreating(false);

    if (error) {
      console.error(error);
      return;
    }

    setCollections((prev) => [...prev, data]);
    setSelectedCollection(data.id);
    setNewCollection("");
  };

  const handleSave = async () => {
    if (saving) return; // 🚫 prevent double click

    if (!selectedCollection) {
      alert("Please select a collection.");
      return;
    }

    if (!paper) return;

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    // 🔥 CHECK DUPLICATE FIRST
    const { data: existing } = await supabase
      .from("bookmarks")
      .select("id")
      .eq("user_id", user.id)
      .eq("paper_id", paper.id)
      .eq("collection_id", selectedCollection)
      .maybeSingle();

    if (existing) {
      alert("Already saved in this collection");
      setSaving(false);
      onClose();
      return;
    }

    const { error } = await supabase.from("bookmarks").insert([
      {
        user_id: user.id,
        collection_id: selectedCollection,
        paper_id: paper.id,
        title: paper.title,
        authors: paper.authors,
        summary: paper.summary || paper.abstract,
        year: paper.year,
        pdf_url: paper.link || paper.url,
      },
    ]);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    onSaved();
    onClose(); // ✅ CLOSE IMMEDIATELY AFTER SUCCESS
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-[440px] rounded-[28px] p-7 shadow-[0_30px_70px_rgba(139,92,246,0.15)] border border-purple-100 font-interface relative overflow-hidden max-h-[85vh] overflow-y-auto"
          >
            {/* Top accent strip */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)]" />

            <div className="flex justify-between items-start mb-1">
              <h2 className="text-xl font-black text-slate-900 tracking-tight font-display">
                Save to Collection
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none p-1 cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {paper?.title && (
              <p className="text-xs text-slate-500 font-medium line-clamp-1 mb-6">
                {paper.title}
              </p>
            )}

            {/* Collections list */}
            {collections.length === 0 ? (
              <div className="text-center py-6 mb-6 bg-purple-50/40 border border-dashed border-purple-200 rounded-2xl">
                <div className="text-2xl mb-1">🗂️</div>
                <p className="text-xs text-slate-500 font-semibold">
                  No collections yet. Create your first one below.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 mb-6 max-h-[180px] overflow-y-auto pr-1">
                {collections.map((collection) => {
                  const isSelected = selectedCollection === collection.id;
                  return (
                    <label
                      key={collection.id}
                      onClick={() => setSelectedCollection(collection.id)}
                      className={`flex items-center gap-3 cursor-pointer p-3.5 rounded-xl border transition-all duration-200 ${
                        isSelected
                          ? "border-[var(--color-brand-primary)] bg-purple-50 shadow-sm"
                          : "border-slate-200 hover:border-[var(--color-brand-primary)]/40 hover:bg-purple-50/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="collection"
                        checked={isSelected}
                        onChange={() => setSelectedCollection(collection.id)}
                        className="accent-[var(--color-brand-primary)] w-4 h-4 cursor-pointer"
                      />
                      <span
                        className={`text-sm font-semibold ${
                          isSelected ? "text-[var(--color-brand-primary)]" : "text-slate-700"
                        }`}
                      >
                        {collection.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Create new collection */}
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5">
                + Create New Collection
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. AI Papers"
                  value={newCollection}
                  onChange={(e) => setNewCollection(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
                  className="flex-1 border border-purple-100 bg-purple-50/10 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-4 focus:ring-[var(--color-brand-primary)]/10 transition-all shadow-inner"
                />
                <button
                  onClick={handleCreateCollection}
                  disabled={creating || !newCollection.trim()}
                  className="shrink-0 px-4 rounded-xl bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white text-sm font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {creating ? "..." : "Add"}
                </button>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex justify-end gap-3 mt-7 pt-5 border-t border-slate-100">
              <button
                onClick={onClose}
                className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-6 py-2.5 rounded-xl text-white text-sm font-bold transition-all duration-200 active:scale-95 flex items-center gap-2 cursor-pointer ${
                  saving
                    ? "bg-[var(--color-brand-primary)]/50 cursor-not-allowed"
                    : "bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 shadow-md shadow-purple-600/20"
                }`}
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>

          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}