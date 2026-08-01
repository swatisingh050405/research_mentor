import React, { createContext, useContext, useState } from "react";

/**
 * Holds search state (topic, description, results, pagination) for the
 * PUBLIC home page (HomePublic). Lives ABOVE the routes in the component
 * tree (wrap it in App.jsx, alongside AuthProvider), so navigating to
 * PaperDetail and back does NOT reset it — only HomePublic's own
 * useState would be lost on unmount, this context survives.
 *
 * A full browser reload still resets this (same as any in-memory React
 * state) — that's expected and fine; the bug being fixed here is SPA
 * navigation (back button / links), not page reloads.
 */
const PublicSearchContext = createContext(null);

const initialState = {
  topic: "",
  description: "",
  papers: [],
  searchId: null,
  hasMore: false,
  searched: false,
  errorMessage: null,
};

export function PublicSearchProvider({ children }) {
  const [topic, setTopic] = useState(initialState.topic);
  const [description, setDescription] = useState(initialState.description);
  const [papers, setPapers] = useState(initialState.papers);
  const [searchId, setSearchId] = useState(initialState.searchId);
  const [hasMore, setHasMore] = useState(initialState.hasMore);
  const [searched, setSearched] = useState(initialState.searched);
  const [errorMessage, setErrorMessage] = useState(initialState.errorMessage);

  const resetSearch = () => {
    setTopic(initialState.topic);
    setDescription(initialState.description);
    setPapers(initialState.papers);
    setSearchId(initialState.searchId);
    setHasMore(initialState.hasMore);
    setSearched(initialState.searched);
    setErrorMessage(initialState.errorMessage);
  };

  const value = {
    topic,
    setTopic,
    description,
    setDescription,
    papers,
    setPapers,
    searchId,
    setSearchId,
    hasMore,
    setHasMore,
    searched,
    setSearched,
    errorMessage,
    setErrorMessage,
    resetSearch,
  };

  return (
    <PublicSearchContext.Provider value={value}>
      {children}
    </PublicSearchContext.Provider>
  );
}

export function usePublicSearch() {
  const ctx = useContext(PublicSearchContext);
  if (!ctx) {
    throw new Error(
      "usePublicSearch must be used within a PublicSearchProvider",
    );
  }
  return ctx;
}
