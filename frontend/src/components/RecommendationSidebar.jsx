import { useNavigate } from "react-router-dom";

/**
 * Vertical list of recommendations — lives in the main/left column now
 * (below Keywords+Bookmark), not as a page sidebar. Chat now occupies
 * the right sidebar slot instead.
 */
export default function RecommendationSidebar({
  recommendations = [],
  loading = false,
}) {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-purple-100 rounded-[2rem] p-7 md:p-9 shadow-sm">
      <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-5 flex items-center gap-1.5">
        🤖 AI Recommendations
      </h3>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="border border-purple-100 rounded-xl p-4 animate-pulse"
            >
              <div className="h-4 bg-purple-100 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-purple-50 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-slate-500">No recommendations available.</p>
      ) : (
        <div className="space-y-3">
          {recommendations.map((item) => (
            <div
              key={item.paper_id}
              onClick={() =>
                navigate(`/paper/${item.paper_id}`, {
                  state: { paper: item },
                })
              }
              className="border border-purple-100 rounded-xl p-4 hover:bg-purple-50 hover:border-[var(--color-brand-primary)]/30 cursor-pointer transition-all"
            >
              <h4 className="font-bold text-sm text-slate-800 line-clamp-2">
                {item.title}
              </h4>

              <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                {item.authors || "Unknown Author"}
              </p>

              <div className="flex justify-between items-center mt-3 gap-2">
                <span className="text-[10px] font-bold bg-purple-50 px-2 py-1 rounded-full text-purple-700 shrink-0">
                  {item.year || "N/A"}
                </span>

                <span className="text-[10px] font-bold bg-purple-100 px-2 py-1 rounded-full text-purple-700 truncate">
                  {item.difficulty_level || "Intermediate"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
