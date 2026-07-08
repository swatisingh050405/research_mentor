import axios from 'axios';

// Base instance configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // Matches your FastAPI Uvicorn port
  headers: {
    'Content-Type': 'application/json',
  },
});
/**
 * Service to fetch research papers
 * @param {string} query - User's search topic
 */
export const fetchResearchPapers = async (query) => {
  try {
    const response = await api.get(`/api/search?query=${encodeURIComponent(query)}`);
    console.log("API Response:", response.data);
    console.log("Papers:", response.data.papers);
    return response.data; // { query: "...", papers: [...] }
  } catch (error) {
    console.error("API Error in fetchResearchPapers:", error);
    throw error;
  }
};