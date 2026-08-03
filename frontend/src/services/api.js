import axios from "axios";
import { supabase } from "../lib/supabase";

// Base instance configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});


api.interceptors.request.use(
  async (config) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      }
    } catch (err) {
      console.error("Failed to retrieve Supabase session token:", err);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Smart Unauthorized Handler
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      const publicPaths = ["/", "/public"];
      const isPublicPage = publicPaths.includes(window.location.pathname);
      const isChatPrepare = error.config.url.endsWith("/chat/prepare");

      // Guest chat prepare ke liye suppressed mode
      if (isPublicPage && isChatPrepare) {
        console.warn("Suppressing automatic redirect for guest chat prepare.");
        return Promise.reject(error); // component handle karega alert ke saath
      }

     
      if (isPublicPage) {
        console.warn(
          "Unauthorized operation on public page. Suppressing login redirect.",
        );
        return Promise.reject(error);
      }

      // Protected route (Workspace etc.) logic remains standard redirect
      console.warn("Session expired on protected route. Logging out...");
      localStorage.removeItem("app_login_timestamp");

      try {
        await supabase.auth.signOut();
      } catch (sErr) {
        console.error("Signout error:", sErr);
      }

      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

// API methods remain exact same...
export const startSearch = async (topic, description = "") => {
  try {
    const response = await api.post("/api/search", { topic, description });
    return response.data;
  } catch (error) {
    console.error("API Error in startSearch:", error);
    throw error;
  }
};
// ... rest of api.js ...
export default api;
