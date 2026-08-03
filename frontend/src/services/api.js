import axios from "axios";
import { supabase } from "../lib/supabase";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Direct token pickup
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
      console.error("Token acquisition error:", err);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      const pathname = window.location.pathname;
      const isPublicRoute =
        pathname === "/" ||
        pathname === "/public" ||
        pathname.startsWith("/paper/");

      if (isPublicRoute) {
        return Promise.reject(error);
      }

      localStorage.removeItem("app_login_timestamp");
      try {
        await supabase.auth.signOut();
      } catch (sErr) {}

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
    if (error.response?.status === 410) {
      return { results: [], has_more: false, expired: true };
    }
    throw error;
  }
};

export const fetchPaperDetails = async (paperId) => {
  try {
    const response = await api.get(`/api/paper/${paperId}`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const prepareChatForPaper = async (paperId) => {
  try {
    const response = await api.post(`/api/paper/${paperId}/chat/prepare`);
    return response.data;
  } catch (error) {
    return {
      paper_found: true,
      context_mode: "abstract_only",
    };
  }
};

export const askPaperQuestion = async (paperId, question) => {
  try {
    const response = await api.post(`/api/paper/${paperId}/chat`, { question });
    return response.data;
  } catch (error) {
    return {
      paper_found: true,
      answer:
        "I couldn't process that request right now. Please verify your login status and try asking again.",
      context_mode: "abstract_only",
    };
  }
};

export default api;
