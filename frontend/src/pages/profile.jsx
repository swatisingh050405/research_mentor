import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";

/**
 * This is the dedicated Profile component (src/pages/Profile.jsx).
 * Features an absolute top-tier SaaS banner with an overlapping avatar layout (rotate micro-interaction)
 * and a complete light-purple themed historical track grid for recent searches.
 */
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
        fullName: user.user_metadata.full_name,
        email: user.email,
        username: "@" + user.email.split("@")[0],
        role: "Researcher",
        tier: "Free",
      });

      // Total Bookmarks
      const { count: bookmarkCount } = await supabase
        .from("bookmarks")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Total Searches
      const { count: historyCount } = await supabase
        .from("search_history")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Total Collections
      const { count: collectionCount } = await supabase
        .from("collections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      // Search History
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
      <div className="p-10 text-center">
        Loading...
      </div>
    );
  }

  const stats = [
    {
      label: "Papers Saved",
      value: savedCount,
      icon: "📄",
    },
    {
      label: "Collections",
      value: collectionsCount,
      icon: "🗂️",
    },
    {
      label: "Searches Run",
      value: searchCount,
      icon: "🔍",
    },
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
      return;
    }

    setRecentSearches([]);
    setSearchCount(0);
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-8 md:p-10 space-y-8 font-interface animate-in fade-in duration-500">

      {/* ─── PREMIUM PROFILE BANNER CARD ─── */}
      <div className="bg-white rounded-[32px] border border-purple-100/60 shadow-[0_15px_40px_rgba(123,47,247,0.06)] overflow-hidden">

        {/* Dynamic Mesh Gradient Banner */}
        <div className="h-44 w-full relative overflow-hidden bg-linear-to-br from-[var(--color-brand-primary)] via-[#7B3FF2] to-[var(--color-brand-accent)]">
          <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(circle_at_20%_20%,white,transparent_35%)]" />
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />

          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[-30%] left-[8%] w-40 h-40 bg-white/20 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-40%] right-[15%] w-56 h-56 bg-[#F5D0FE]/20 rounded-full blur-3xl"
          />

          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(135deg, white 0px, white 1px, transparent 1px, transparent 14px)",
            }}
          />

          <div className="absolute top-5 right-6">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 backdrop-blur-md text-white border border-white/25 px-3 py-1.5 rounded-lg font-display flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              {userProfile.tier} Active
            </span>
          </div>
        </div>

        {/* Profile Content Block with Overlapping Avatar */}
        <div className="px-8 pb-8 relative">

          <div className="absolute -top-12 left-8 w-24 h-24 bg-linear-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-[1.75rem] rotate-3 flex items-center justify-center shadow-xl shadow-purple-300/40 border-[6px] border-white group transition-transform hover:rotate-0 duration-300">
            <span className="font-black text-3xl text-white font-display -rotate-3 group-hover:rotate-0 transition-transform">
              {userProfile.fullName
                ?.split(" ")
                .map((name) => name[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </span>
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-400 border-[3px] border-white" />
          </div>

          <div className="pt-16">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-display">
              {userProfile.fullName}
            </h1>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <span className="text-sm font-bold text-[var(--color-brand-primary)]">
                {userProfile.username}
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="text-sm font-medium text-slate-500">
                {userProfile.email}
              </span>
            </div>

            <p className="text-sm text-slate-500 font-medium mt-3 flex items-center gap-2">
              <span className="text-[var(--color-brand-accent)]">💼</span> {userProfile.role}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-7 pt-6 border-t border-purple-50">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-[#F6F5FD] transition-colors duration-200"
              >
                <div className="w-9 h-9 rounded-xl bg-linear-to-br from-[var(--color-brand-primary)]/10 to-[var(--color-brand-accent)]/10 flex items-center justify-center text-base shrink-0">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-base font-black text-slate-900 font-display leading-none">
                    {stat.value}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── RECENT SEARCHES HISTORY PANEL ─── */}
      <div className="bg-white rounded-[32px] border border-purple-100/60 shadow-[0_15px_40px_rgba(123,47,247,0.04)] p-8">

        <div className="flex justify-between items-end mb-6 border-b border-purple-50 pb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight font-display flex items-center gap-2">
              <span>🔍</span> Recent Search Queries
            </h2>
            <p className="text-xs text-slate-400 font-medium tracking-wide mt-1">
              Your historical log of parsed AI models and architecture streams.
            </p>
          </div>
          <button
            onClick={handleClearHistory}
            className="text-xs font-bold text-[var(--color-brand-primary)] hover:text-[var(--color-brand-accent)] transition-colors cursor-pointer"
          >
            Clear History
          </button>
        </div>

        <div className="space-y-1">
          {recentSearches.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              No search history yet.
            </div>
          )}
          {recentSearches.map((search) => (
            <div
              key={search.id}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl hover:bg-[#F6F5FD] transition-colors duration-200 group gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-[var(--color-brand-primary)] flex items-center justify-center shrink-0 border border-purple-100/50 group-hover:bg-white group-hover:shadow-md group-hover:shadow-purple-100 transition-all">
                  <span className="text-sm">💬</span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-[var(--color-brand-primary)] transition-colors line-clamp-1">
                    {search.query}
                  </h4>
                  <p className="text-[11px] font-semibold text-slate-400 mt-1 uppercase tracking-wider">
                    {search.search_date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pl-14 md:pl-0">
                <span className="text-xs font-bold text-[var(--color-brand-primary)] bg-white px-3 py-1 rounded-lg border border-purple-100 font-display whitespace-nowrap">
                  Search
                </span>
                <button className="text-xs font-bold text-slate-400 cursor-default">
                  Recent
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

    </div>
  );
}