import React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

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

  return (
    <div className="flex h-screen w-full font-interface bg-[var(--color-brand-primary)]">
      <aside className="w-[260px] shrink-0 flex flex-col py-8 z-20">
        <div
          className="px-8 mb-12 flex items-center gap-3 cursor-pointer group"
          onClick={() => navigate("/workspace")}
        >
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[var(--color-brand-accent)] to-white/20 flex items-center justify-center shadow-lg shadow-black/20 transition-transform duration-300 group-hover:scale-105">
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
                className="relative flex items-center gap-4 px-8 py-5 text-xs font-bold uppercase tracking-wider"
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-bg"
                    className="absolute inset-0 bg-[#F8F7FC] z-0"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  >
                    <div className="absolute -top-6 right-0 h-6 w-6 bg-[#F8F7FC]">
                      <div className="absolute inset-0 bg-[var(--color-brand-primary)] rounded-br-2xl" />
                    </div>
                    <div className="absolute -bottom-6 right-0 h-6 w-6 bg-[#F8F7FC]">
                      <div className="absolute inset-0 bg-[var(--color-brand-primary)] rounded-tr-2xl" />
                    </div>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-linear-to-b from-[var(--color-brand-primary)] to-[var(--color-brand-accent)]" />
                  </motion.div>
                )}

                <span
                  className={`relative z-10 text-lg transition-transform duration-300 ${
                    isActive ? "scale-110" : "group-hover:scale-105"
                  }`}
                >
                  {item.icon}
                </span>
                <span
                  className={`relative z-10 transition-colors duration-300 ${
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

      <div className="flex-1 bg-[#F8F7FC] rounded-l-[32px] overflow-hidden flex flex-col shadow-2xl">
        {/* Navbar with gradient border-bottom */}
        <header className="relative h-20 px-12 flex items-center justify-between">
          {/* LEFT: Title + subtitle */}
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-800">
              {getPageTitle()}
            </h2>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              {getPageSubtitle()}
            </p>
          </div>

          {/* RIGHT: Profile + Logout grouped together */}
          <div className="flex items-center gap-5">
            <div
              className="flex items-center gap-3 cursor-pointer group pr-5 border-r border-slate-200"
              onClick={() => navigate("/profile")}
            >
              <div className="text-right">
                <p className="text-xs font-bold text-slate-800">
                  {user?.user_metadata?.full_name || "Researcher"}
                </p>
                <p className="text-[10px] font-semibold text-slate-400 tracking-wide">
                  {user?.email}
                </p>
              </div>
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-linear-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] text-white font-bold flex items-center justify-center ring-2 ring-white shadow-md shadow-purple-200 transition-transform duration-300 group-hover:scale-105">
                  {user?.user_metadata?.full_name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase() || "R"}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white" />
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-bold text-white bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 active:scale-95 px-5 py-2.5 rounded-xl shadow-sm shadow-purple-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              Logout
            </button>
          </div>

          {/* gradient border line */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-[var(--color-brand-primary)] to-[var(--color-brand-accent)] opacity-70" />
        </header>

        <main className="flex-1 overflow-y-auto p-12">
          <Outlet />
        </main>
      </div>
    </div>
  );
}