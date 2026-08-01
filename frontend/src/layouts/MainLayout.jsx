import React, { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = Boolean(user && (user.id || user.email));

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);

  // Fetch recent searches for sidebar
  useEffect(() => {
    async function fetchHistory() {
      if (!user?.id) return;
      const { data } = await supabase
        .from("search_history")
        .select("id, query, search_date")
        .eq("user_id", user.id)
        .order("search_date", { ascending: false })
        .limit(5);

      if (data) setSearchHistory(data);
    }
    fetchHistory();
  }, [user?.id]);

  const getPageTitle = () => {
    if (location.pathname.includes("bookmarks")) return "Saved Research Vault";
    if (location.pathname.includes("profile")) return "User Profile Control";
    return "Core Workspace Panel";
  };

  const getPageSubtitle = () => {
    if (location.pathname.includes("bookmarks"))
      return "Manage your organized research collections";
    if (location.pathname.includes("profile"))
      return "View activity and account settings";
    return "Search, discover, and analyze literature";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const navItems = [
    { path: "/workspace", icon: "", label: "Core Workspace" },
    { path: "/bookmarks", icon: "", label: "Saved Vault" },
    { path: "/profile", icon: "", label: "Profile Settings" },
  ];

  const userDisplayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Researcher";

  const userEmail = user?.email || "";

  const initials = userDisplayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen w-full font-interface bg-[#FDFDFF] p-2 sm:p-3 lg:p-4 gap-3 relative overflow-hidden">
      {/* ─── MOBILE BACKDROP ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-purple-950/30 backdrop-blur-xs z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ─── BRAND MATCHING SIDEBAR ─── */}
      <aside
        className={`w-[270px] shrink-0 bg-white rounded-3xl border border-purple-100/80 shadow-xs flex flex-col p-4 z-40 fixed lg:static top-3 bottom-3 left-3 h-[calc(100vh-1.5rem)] lg:h-full transition-transform duration-300 ease-in-out ${
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {/* Brand Logo - Restored Exact Purple Gradient R Box */}
        <div className="flex items-center justify-between pb-4 border-b border-purple-100/80 mb-4 px-1">
          <div
            className="flex items-center gap-2.5 cursor-pointer group"
            onClick={() => {
              navigate("/workspace");
              setMobileMenuOpen(false);
            }}
          >
            <div className="w-9 h-9 bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-xl flex items-center justify-center shadow-md shadow-purple-600/20 transition-transform duration-300 group-hover:scale-105 shrink-0">
              <span className="font-black text-white text-sm font-display">
                R
              </span>
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900 font-display">
              RESEARCH
              <span className="text-[var(--color-brand-primary)]">_MENTOR</span>
            </span>
          </div>
          
        </div>

        {/* User Card Header inside Sidebar */}
        {isAuthenticated && (
          <div
            onClick={() => navigate("/profile")}
            className="flex items-center gap-3 p-2.5 rounded-2xl bg-purple-50/50 border border-purple-100/70 hover:border-[var(--color-brand-primary)]/40 transition-all cursor-pointer mb-5"
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-bold flex items-center justify-center text-xs shadow-xs ring-2 ring-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">
                {userDisplayName}
              </p>
              <p className="text-[10px] font-semibold text-slate-400 truncate">
                {userEmail}
              </p>
            </div>
          </div>
        )}

        {/* Main Navigation Links */}
        <nav className="space-y-1.5 mb-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? "bg-purple-50 text-[var(--color-brand-primary)] border border-purple-100 shadow-2xs"
                    : "text-slate-500 hover:text-[var(--color-brand-primary)] hover:bg-purple-50/50"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Recent Search History Section */}
        <div className="flex-1 min-h-0 flex flex-col pt-4 border-t border-purple-100/80">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 mb-2">
            Recent Searches
          </span>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {searchHistory.length > 0 ? (
              searchHistory.map((history) => (
                <div
                  key={history.id}
                  onClick={() => navigate("/workspace")}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-purple-50/60 hover:text-[var(--color-brand-primary)] transition-colors cursor-pointer truncate"
                >
                  <span className="text-purple-400 text-xs shrink-0">🔍</span>
                  <span className="truncate">{history.query}</span>
                </div>
              ))
            ) : (
              <p className="text-[11px] text-slate-400 px-2 py-1 font-medium">
                No recent searches
              </p>
            )}
          </div>
        </div>

        {/* Sidebar Footer Logout / Auth */}
        <div className="pt-3 border-t border-purple-100/80 space-y-1">
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <span>🚪</span> Logout
            </button>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold text-[var(--color-brand-primary)] hover:bg-purple-50 transition-colors cursor-pointer"
            >
              <span>🔑</span> Sign In
            </button>
          )}
        </div>
      </aside>

      {/* ─── MAIN FLOATING CANVAS ─── */}
      <div className="flex-1 bg-white rounded-3xl border border-purple-100/80 shadow-xs overflow-hidden flex flex-col min-w-0">
        {/* Header / Navbar */}
        <header className="relative h-18 px-6 lg:px-8 border-b border-purple-100/80 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md">
          {/* LEFT: Mobile Hamburger */}
          <div className="flex items-center shrink-0 min-w-[40px]">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden shrink-0 w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-[var(--color-brand-primary)] cursor-pointer hover:bg-purple-100/70 transition-colors"
              aria-label="Open menu"
            >
              ☰
            </button>
          </div>

          {/* CENTER: Centered Title & Subtitle */}
          <div className="absolute left-1/2 -translate-x-1/2 text-center max-w-md sm:max-w-xl truncate px-2">
            <h2 className="text-sm sm:text-base font-black uppercase tracking-[0.2em] text-slate-800 font-display truncate">
              {getPageTitle()}
            </h2>
            <p className="text-[11px] font-semibold text-purple-600/80 tracking-wide mt-0.5 truncate hidden sm:block">
              {getPageSubtitle()}
            </p>
          </div>

          {/* RIGHT: Avatar/Logout or Auth */}
          <div className="flex items-center gap-2 shrink-0">
            {isAuthenticated ? (
              <div
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 p-1 rounded-full hover:bg-purple-50 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-bold flex items-center justify-center text-xs shadow-sm ring-2 ring-purple-100">
                  {initials}
                </div>
              </div>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="text-xs font-bold text-white bg-gradient-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
              >
                Sign In
              </button>
            )}
          </div>

          {/* Gradient Line Under Header */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--color-brand-primary)] to-[var(--color-brand-accent)] opacity-60" />
        </header>

        {/* Inner Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FDFDFF]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
