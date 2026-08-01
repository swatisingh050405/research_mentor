import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext();

// 4 hours
const MAX_SESSION_DURATION = 4 * 60 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    localStorage.removeItem("app_login_timestamp");
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    let logoutTimer;

    const setupSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }

      const now = Date.now();
      let loginTimestamp = localStorage.getItem("app_login_timestamp");

      // First login
      if (!loginTimestamp) {
        loginTimestamp = now.toString();
        localStorage.setItem("app_login_timestamp", loginTimestamp);
      }

      const elapsed = now - Number(loginTimestamp);

      // Already expired
      if (elapsed >= MAX_SESSION_DURATION) {
        await logout();
        setLoading(false);
        return;
      }

      setUser(session.user);

      // Logout after remaining time
      const remaining = MAX_SESSION_DURATION - elapsed;

      logoutTimer = setTimeout(async () => {
        alert("Your session has expired. Please log in again.");
        await logout();
      }, remaining);

      setLoading(false);
    };

    setupSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        localStorage.setItem("app_login_timestamp", Date.now().toString());

        setUser(session?.user ?? null);

        if (logoutTimer) clearTimeout(logoutTimer);

        logoutTimer = setTimeout(async () => {
          alert("Your session has expired. Please log in again.");
          await logout();
        }, MAX_SESSION_DURATION);
      }

      if (event === "SIGNED_OUT") {
        localStorage.removeItem("app_login_timestamp");

        if (logoutTimer) clearTimeout(logoutTimer);

        setUser(null);
      }
    });

    return () => {
      if (logoutTimer) clearTimeout(logoutTimer);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
