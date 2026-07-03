import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from "../lib/supabase";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e) => {
  e.preventDefault();

  setError("");
  setIsSubmitting(true);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  setIsSubmitting(false);

  if (error) {
  if (error.message === "Invalid login credentials") {
    setError("Incorrect email or password.");
  } else if (error.message === "Email not confirmed") {
    setError("Please verify your email before logging in.");
  } else {
    setError(error.message);
  }

  return;
}

  navigate("/workspace");
};

  return (
    <div className="min-h-screen bg-[#FAF9FF] text-slate-800 font-interface flex flex-col justify-center items-center relative overflow-hidden px-4 py-12">

      {/* 🔮 HOME-PAGE STYLE BACKDROP GRID ENGINE */}
      <div className="absolute top-0 inset-0 h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[750px] bg-linear-to-b from-[var(--color-brand-primary)]/15 via-[var(--color-brand-accent)]/8 to-transparent rounded-full blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e8e3fa_1px,transparent_1px),linear-gradient(to_bottom,#e8e3fa_1px,transparent_1px)] bg-size-[40px_40px] opacity-30" />
      </div>

      {/* Top Branding Identity Header Node */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center gap-2.5 relative z-10 mb-8 cursor-pointer group"
        onClick={() => navigate('/')}
      >
        <div className="w-10 h-10 bg-linear-to-tr from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] rounded-xl flex items-center justify-center shadow-lg shadow-purple-600/20 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
          <span className="font-black text-white text-base font-display">R</span>
        </div>
        <span className="text-lg font-black tracking-tight text-slate-900 font-display">
          RESEARCH<span className="text-[var(--color-brand-primary)]">_MENTOR</span>
        </span>
      </motion.div>

      {/* 🌟 WIDE MASTER CENTER CARD WITH INTERNAL TWO-COLUMN SPLIT */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
        className="w-full max-w-4xl bg-white border border-purple-100 rounded-[2.2rem] shadow-[0_30px_70px_rgba(139,92,246,0.06)] relative z-10 grid grid-cols-1 md:grid-cols-12 overflow-hidden"
      >

        {/* ================= COLUMN 1: LEFT PANEL TEXT CONTEXT ================= */}
        <div className="md:col-span-5 bg-linear-to-br from-[var(--color-brand-primary)] via-[#6B2FE0] to-[var(--color-brand-deep)] p-8 lg:p-10 flex flex-col justify-between text-white relative overflow-hidden">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-10 -left-10 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"
          />
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-[-20%] right-[-10%] w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none"
          />

          <div className="space-y-4 my-auto relative z-10">
            <h3 className="text-2xl lg:text-3xl font-black tracking-tight leading-tight font-display">
              Analyze literature with absolute clarity.
            </h3>
            <p className="text-purple-100 text-xs leading-relaxed font-semibold opacity-90">
              Automate your vector summaries, parse dense files, and secure metadata indexes directly from your secure node terminal layer.
            </p>
          </div>

          <div className="text-[10px] font-mono tracking-widest text-purple-200 font-bold uppercase mt-6 relative z-10 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            Enterprise Auth Gate v1.0
          </div>
        </div>

        {/* ================= COLUMN 2: RIGHT PANEL ACTIVE FORM WINDOW ================= */}
        <div className="md:col-span-7 p-8 lg:p-10 flex flex-col justify-center bg-white relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-[var(--color-brand-primary)] via-[var(--color-brand-accent)] to-[var(--color-brand-primary)] md:hidden" />

          <div className="mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight font-display">Sign In</h2>
            <p className="text-xs font-bold text-slate-500 mt-1">
              Provide authorization access keys to verify identity profile.
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@university.edu"
                className="w-full bg-purple-50/10 border border-purple-200/60 px-4 py-3.5 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-4 focus:ring-[var(--color-brand-primary)]/10 focus:scale-[1.01] transition-all duration-200 text-sm font-bold shadow-inner"
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-widest">
                  Password
                </label>
               
                <button
                  type="button"
                  className="text-xs font-bold text-[var(--color-brand-primary)] hover:text-[var(--color-brand-accent)] transition-colors"
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-purple-50/10 border border-purple-200/60 px-4 py-3.5 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[var(--color-brand-primary)] focus:ring-4 focus:ring-[var(--color-brand-primary)]/10 focus:scale-[1.01] transition-all duration-200 text-sm font-bold shadow-inner"
                required
              />
               {error && (
                  <div className="mt-2 text-sm font-semibold text-red-500">
                    {error}
                  </div>
                )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-linear-to-r from-[var(--color-brand-primary)] to-[var(--color-brand-accent)] hover:opacity-90 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl transition-all duration-200 shadow-md shadow-purple-600/20 hover:shadow-lg hover:shadow-purple-600/30 text-sm cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </>
              ) : (
                "Sign In to Workspace Node"
              )}
            </button>
          </form>

          <div className="text-left pt-5 mt-6 border-t border-slate-100 text-xs font-bold text-slate-500">
            New researcher?{' '}
            <button
              onClick={() => navigate('/signup')}
              className="text-[var(--color-brand-primary)] hover:text-[var(--color-brand-accent)] font-extrabold hover:underline cursor-pointer"
            >
              Create Account Profile
            </button>
          </div>
        </div>

      </motion.div>

    </div>
  );
}