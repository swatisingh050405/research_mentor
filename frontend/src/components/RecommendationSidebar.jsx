import { useEffect, useState } from "react";

export default function RecommendationSidebar({ paper }) {
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    if (!paper) return;

    fetchRecommendations();
  }, [paper]);

  const fetchRecommendations = async () => {
    setLoading(true);

    // Dummy data for now
    setTimeout(() => {
      setRecommendations([
        {
          id: 1,
          title: "Attention Is All You Need"
        },
        {
          id: 2,
          title: "BERT: Pre-training of Deep Bidirectional Transformers"
        },
        {
          id: 3,
          title: "RoBERTa: A Robustly Optimized BERT"
        }
      ]);

      setLoading(false);
    }, 800);
  };

  return (
    <div className="sticky top-24">

      <div className="bg-white border border-purple-100 rounded-[2rem] p-6 shadow-sm">

        <h3 className="text-sm font-black text-slate-800 mb-5">
          🤖 AI Recommendations
        </h3>

        {loading ? (

          <div className="space-y-3">
            <div className="border rounded-xl p-4">Loading...</div>
            <div className="border rounded-xl p-4">Loading...</div>
            <div className="border rounded-xl p-4">Loading...</div>
          </div>

        ) : (

          <div className="space-y-3">

            {recommendations.map((item) => (

              <div
                key={item.id}
                className="border border-purple-100 rounded-xl p-4 hover:bg-purple-50 cursor-pointer transition"
              >

                <h4 className="font-bold text-sm">
                  {item.title}
                </h4>

              </div>

            ))}

          </div>

        )}

      </div>

    </div>
  );
}