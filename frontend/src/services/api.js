import axios from "axios";
import { supabase } from "../lib/supabase";

// Base instance configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Safely Attach Supabase Access Token
api.interceptors.request.use(
  async (config) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        config.headers.Authorization = `Bearer ${session.access_token}`;
      } else {
        delete config.headers.Authorization;
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
      const pathname = window.location.pathname;

      // 💡 Public routes & guest actions detection
      const isPublicRoute =
        pathname === "/" ||
        pathname === "/public" ||
        pathname.startsWith("/paper/");

      const isChatPrepare = error.config?.url?.includes("/chat/prepare");

      // Suppress forced redirect on public pages/guest alerts
      if (isPublicRoute || isChatPrepare) {
        console.warn(
          "401/403 caught on public or paper page. Suppressing login redirect.",
        );
        return Promise.reject(error);
      }

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

export const startSearch = async (topic, description = "") => {
  try {
    const response = await api.post("/api/search", { topic, description });
    return response.data;
  } catch (error) {
    console.error("API Error in startSearch:", error);
    throw error;
  }
};

export const loadMoreResults = async (searchId, currentCount) => {
  try {
    const response = await api.get("/api/search/more", {
      params: { search_id: searchId, current_count: currentCount },
    });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 410) {
      return { results: [], has_more: false, expired: true };
    }
    console.error("API Error in loadMoreResults:", error);
    throw error;
  }
};

export const fetchPaperDetails = async (paperId) => {
  try {
    const response = await api.get(`/api/paper/${paperId}`);
    return response.data;
  } catch (error) {
    console.error("API Error in fetchPaperDetails:", error);
    throw error;
  }
};

export const prepareChatForPaper = async (paperId) => {
  try {
    const response = await api.post(`/api/paper/${paperId}/chat/prepare`);
    return response.data;
  } catch (error) {
    console.error("API Error in prepareChatForPaper:", error);
    throw error;
  }
};

export const askPaperQuestion = async (paperId, question) => {
  try {
    const response = await api.post(`/api/paper/${paperId}/chat`, { question });
    return response.data;
  } catch (error) {
    console.error("API Error in askPaperQuestion:", error);
    throw error;
  }
};

export default api;
