import React, { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getPageTitle = () => {
    if (location.pathname.includes("bookmarks")) return "Saved Research Vault";
    if (location.pathname.includes("profile")) return "User Profile Control";
    return "Neural Workspace Panel";
  };

  const getPageSubtitle = () => {
    if (location.pathname.includes("bookmarks")) return "Manage your organized research collections";
    if (location.pathname.includes("profile")) return "View activity and account settings";
    return "Search, discover, and analyze literature";
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const navItems = [
    { path: "/workspace", icon: "🎛️", label: "Core Workspace" },
    { path: "/bookmarks", icon: "🔖", label: "Saved Bookmarks" },
    { path: "/profile", icon: "👤", label: "User Profile" },
  ];

  const initials =
    user?.user_metadata?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "R";

  return (
    <div className="flex h-screen w-full font-interface bg-[var(--color-brand-primary)] relative">

      {/* ─── MOBILE OVERLAY (tap outside to close menu) ─── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ─── SIDEBAR: fixed drawer on mobile, static column on desktop ─── */}
      <aside
        className={`w-[260px] shrink-0 flex flex-col py-8 z-40 fixed lg:static top-0 left-0 h-full transition-transform duration-300 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div
          className="px-8 mb-12 flex items-center gap-3 cursor-pointer group"
          onClick={() => {
            navigate("/workspace");
            setMobileMenuOpen(false);
          }}
        >
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[var(--color-brand-accent)] to-white/20 flex items-center justify-center shadow-lg shadow-black/20 transition-transform duration-300 group-hover:scale-105 shrink-0">
            <span className="font-black text-white">R</span>
          </div>
          <span className="text-white font-black tracking-widest uppercase">
            MENTOR_HUB
          </span>
        </div>

        <nav className="flex flex-col relative">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="relative flex items-center gap-4 px-8 py-5 text-xs font-bold uppercase tracking-wider"
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 bg-[#F8F7FC] z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  >
                    <div className="absolute -top-6 right-0 h-6 w-6 bg-[#F8F7FC] hidden lg:block">
                      <div className="absolute inset-0 bg-[var(--color-brand-primary)] rounded-br-2xl" />
                    </div>
                    <div className="absolute -bottom-6 right-0 h-6 w-6 bg-[#F8F7FC] hidden lg:block">
                      <div className="absolute inset-0 bg-[var(--color-brand-primary)] rounded-tr-2xl" />
                    </div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-linear-to-b from-[var(--color-brand-primary)] to-[var(--color-brand-accent)]" />
                  </motion.div>
                )}

                <span
                  className={`relative z-10 text-lg transition-transform duration-300 shrink-0 ${
                    isActive ? "scale-110" : "group-hover:scale-105"
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`relative z-10 transition-colors duration-300 truncate ${
                    isActive
                      ? "text-[var(--color-brand-primary)]"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {item.label}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 bg-[#F8F7FC] lg:rounded-l-[32px] overflow-hidden flex flex-col shadow-2xl min-w-0">
        {/* Navbar with gradient border-bottom */}
        <header className="relative h-20 px-4 sm:px-6 lg:px-12 flex items-center justify-between gap-3">

          {/* LEFT: Hamburger (mobile only) + Title + subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden shrink-0 w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-[var(--color-brand-primary)] cursor-pointer"
              aria-label="Open menu"
            >
              ☰
            </button>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-slate-800 truncate">
                {getPageTitle()}
              </h2>
              <p className="text-[10px] sm:text-[11px] font-medium text-slate-400 mt-0.5 truncate hidden sm:block">
                {getPageSubtitle()}
              </p>
            </div>
          </div>

          {/* RIGHT: Profile + Logout grouped together */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 shrink-0">
            <div
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group lg:pr-5 lg:border-r border-slate-200"
              onClick={() => navigate("/profile")}
            >
              {/* Name/email hidden on small screens, only avatar shows */}
              <div className="text-right hidden md:block">
                <p className="text-xs font-bold text-slate-800 max-w-[140px] truncate">
                  {user?.user_metadata?.full_name || "Researcher"}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 tracking-wide max-w-[140px] truncate">
                  {user?.email}
                </p>
              </div>
              <div className="relative shrink-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-linear-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-bold flex items-center justify-center ring-2 ring-white shadow-md shadow-purple-200 transition-transform duration-300 group-hover:scale-105 text-xs sm:text-sm">
                  {initials}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white" />
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-bold text-white bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 active:scale-95 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-sm shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
            >
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">⏻</span>
            </button>
          </div>

          {/* gradient border line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-[var(--color-brand-primary)] to-[var(--color-brand-accent)] opacity-70" />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}