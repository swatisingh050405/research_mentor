import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const [userProfile, setUserProfile] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [searchCount, setSearchCount] = useState(0);
  const [collectionsCount, setCollectionsCount] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUserProfile({
        fullName: user.user_metadata?.full_name || "Swati Singh",
        email: user.email,
        username: "@" + user.email.split("@")[0],
        role: "AI & ML Researcher",
      });

      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: historyCount } = await supabase
        .from("search_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { count: collectionCount } = await supabase
        .from("collections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      const { data: history } = await supabase
        .from("search_history")
        .select("*")
        .eq("user_id", user.id)
        .order("search_date", { ascending: false });

      setSavedCount(bookmarkCount || 0);
      setSearchCount(historyCount || 0);
      setCollectionsCount(collectionCount || 0);
      setRecentSearches(history || []);
    };
    getUser();
  }, []);

  if (!userProfile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-purple-100 border-t-[var(--color-brand-primary)] rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">
          Fetching profile metrics...
        </p>
      </div>
    );
  }

  const stats = [
    { label: "Saved Papers", value: savedCount, icon: "📄" },
    { label: "Collections", value: collectionsCount, icon: "🗂️" },
    { label: "Searches Run", value: searchCount, icon: "🔍" },
  ];

  const handleClearHistory = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from("search_history")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      alert("Could not clear history: " + error.message);
      return;
    }

    setRecentSearches([]);
    setSearchCount(0);
  };

  const handleDeleteSingleSearch = async (id) => {
    const { error } = await supabase
      .from("search_history")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    setRecentSearches((prev) => prev.filter((s) => s.id !== id));
    setSearchCount((prev) => Math.max(0, prev - 1));
  };

  return (
    <div className="relative min-h-full w-full font-interface bg-[#FDFDFF] pb-12">
      {/* 🌟 MAIN CONTENT CONTAINER */}
      <div className="max-w-5xl w-full mx-auto space-y-6 relative z-10 animate-in fade-in duration-300 pt-2">
        {/* ─── PROFILE CARD WITH COMPACT ARTIFICIAL PATTERN BANNER ─── */}
        <div className="bg-white rounded-[2rem] border border-purple-100/80 shadow-xs overflow-hidden">
          {/* Compact Geometric Mesh Banner */}
          <div className="h-24 w-full relative overflow-hidden bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50">
            <div
              className="absolute inset-0 opacity-[0.4]"
              style={{
                backgroundImage: `
                  radial-gradient(at 20% 20%, rgba(124, 58, 237, 0.15) 0px, transparent 50%),
                  radial-gradient(at 80% 80%, rgba(168, 85, 247, 0.15) 0px, transparent 50%),
                  linear-gradient(to right, rgba(124,58,237,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(124,58,237,0.05) 1px, transparent 1px)
                `,
                backgroundSize: "100% 100%, 100% 100%, 24px 24px, 24px 24px",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
          </div>

          {/* User Details & Avatar */}
          <div className="px-6 md:px-8 pb-6 relative">
            {/* Avatar Pill overlapping banner */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10 mb-4">
              <div className="relative shrink-0">
                <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-black text-2xl flex items-center justify-center shadow-md shadow-purple-600/15 font-display border-4 border-white">
                  {userProfile.fullName
                    ?.split(" ")
                    .map((name) => name[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <span className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-100 text-xs font-bold text-[var(--color-brand-primary)] self-start sm:self-auto">
                💼 {userProfile.role}
              </span>
            </div>

            {/* Profile Info Header */}
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight font-display">
                {userProfile.fullName}
              </h1>

              <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 flex-wrap">
                <span className="text-[var(--color-brand-primary)] font-bold">
                  {userProfile.username}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span>✉️ {userProfile.email}</span>
              </div>
            </div>

            {/* Metrics Dashboard Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-6 pt-6 border-t border-purple-100/60">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 p-3 rounded-xl bg-purple-50/40 border border-purple-100/60 hover:bg-purple-50/80 transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-white border border-purple-100 flex items-center justify-center text-base shrink-0 shadow-2xs">
                    {stat.icon}
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900 font-display leading-none">
                      {stat.value}
                    </p>
                    <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-1">
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── RECENT SEARCH HISTORY PANEL ─── */}
        <div className="bg-white rounded-[2rem] border border-purple-100/80 shadow-xs p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 border-b border-purple-100/60 pb-4">
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tight font-display flex items-center gap-2">
                <span>🔍</span> Search Query History
              </h2>
              <p className="text-xs text-slate-400 font-medium tracking-wide mt-0.5">
                Your recent AI search requests and literature explorations.
              </p>
            </div>

            {recentSearches.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-xs font-bold text-red-500 hover:text-red-600 bg-red-50/60 hover:bg-red-50 border border-red-100/80 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer self-start sm:self-auto"
              >
                Clear History
              </button>
            )}
          </div>

          <div className="space-y-2">
            {recentSearches.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <span className="text-2xl block mb-2">📭</span>
                <p className="text-xs font-bold">
                  No search history recorded yet.
                </p>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Searches you run from the workspace will appear here.
                </p>
              </div>
            ) : (
              recentSearches.map((search) => (
                <div
                  key={search.id}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-purple-50/30 border border-purple-100/40 hover:bg-purple-50/70 hover:border-purple-200/80 transition-all group gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white text-[var(--color-brand-primary)] flex items-center justify-center shrink-0 border border-purple-100 shadow-2xs group-hover:scale-105 transition-transform">
                      <span className="text-xs">💬</span>
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-[var(--color-brand-primary)] transition-colors truncate">
                        {search.query}
                      </h4>
                      <p className="text-[10px] font-semibold text-slate-400 mt-0.5 tracking-wider">
                        {search.search_date
                          ? new Date(search.search_date).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )
                          : "Recent"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteSingleSearch(search.id)}
                    className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-white"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
