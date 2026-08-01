import axios from "axios";
import { supabase } from "../lib/supabase"; // Updated relative path for src/services/

// Base instance configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // Matches your FastAPI Uvicorn port
  headers: {
    "Content-Type": "application/json",
  },
});

// ----------------------------------------------------------------------
// Request Interceptor: Attach Supabase Access Token to Every Request
// ----------------------------------------------------------------------
api.interceptors.request.use(
  async (config) => {
    try {
      // Dynamically fetch the current valid Supabase session
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

// ----------------------------------------------------------------------
// Response Interceptor: Handle Expired Sessions (401 / 403)
// ----------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      error.response &&
      (error.response.status === 401 || error.response.status === 403)
    ) {
      console.warn("Session expired or unauthorized. Logging out...");

      // Clear local login timestamp
      localStorage.removeItem("app_login_timestamp");

      // Sign out from Supabase (clears stored keys safely)
      await supabase.auth.signOut();

      // Redirect user back to login page
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Starts a new search: builds the ranked result pool once on the backend
 * and returns the first page (up to 5 papers, summarized).
 *
 * @param {string} topic - Core subject to search for.
 * @param {string} description - Optional context/intent/constraints.
 * @returns {Promise<{search_id: string|null, results: Array, has_more: boolean, total_pool_size: number}>}
 */
export const startSearch = async (topic, description = "") => {
  try {
    const response = await api.post("/api/search", { topic, description });
    return response.data;
  } catch (error) {
    console.error("API Error in startSearch:", error);
    throw error;
  }
};

/**
 * Loads the next page of results for an existing search session.
 *
 * @param {string} searchId - search_id returned by startSearch().
 * @param {number} currentCount - How many results are already shown.
 * @returns {Promise<{results: Array, has_more: boolean, expired: boolean}>}
 */
export const loadMoreResults = async (searchId, currentCount) => {
  try {
    const response = await api.get("/api/search/more", {
      params: { search_id: searchId, current_count: currentCount },
    });
    return response.data;
  } catch (error) {
    // A 410 means the search pool session expired on backend
    if (error.response && error.response.status === 410) {
      return { results: [], has_more: false, expired: true };
    }
    console.error("API Error in loadMoreResults:", error);
    throw error;
  }
};

/**
 * Fetches full details for a single paper, plus similar-paper recommendations.
 *
 * @param {string} paperId
 * @returns {Promise<{paper: object, recommendations: Array}>}
 */
export const fetchPaperDetails = async (paperId) => {
  try {
    const response = await api.get(`/api/paper/${paperId}`);
    return response.data;
  } catch (error) {
    console.error("API Error in fetchPaperDetails:", error);
    throw error;
  }
};

/**
 * Triggers lazy PDF processing (fetch + chunk + embed) for a paper's chat.
 * Call this when the chat panel is opened, before the user asks anything.
 *
 * @param {string} paperId
 * @returns {Promise<{context_mode: 'full_text'|'abstract_only', paper_found: boolean}>}
 */
export const prepareChatForPaper = async (paperId) => {
  try {
    const response = await api.post(`/api/paper/${paperId}/chat/prepare`);
    return response.data;
  } catch (error) {
    console.error("API Error in prepareChatForPaper:", error);
    throw error;
  }
};

/**
 * Asks a question about a specific paper (RAG chat).
 *
 * @param {string} paperId
 * @param {string} question
 * @returns {Promise<{answer: string, context_mode: string, used_gemini: boolean, paper_found: boolean}>}
 */
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
