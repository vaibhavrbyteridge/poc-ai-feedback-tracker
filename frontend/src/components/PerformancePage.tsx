import { useState, useEffect } from "react";
import { AgentPerformance, FeedbackGoal, WeeklyData, fetchAgentPerformance, fetchFeedbacks, updateFeedbackStatus, rejectFeedback, fetchWeeklyPerformance, fetchAiFeedback, generateAiFeedback } from "../api/client";

interface Props {
  userId: number;
  userName: string;
  onBack: () => void;
}

export default function PerformancePage({ userId, userName, onBack }: Props) {
  const [perf, setPerf] = useState<AgentPerformance | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackGoal[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [aiFeedbackDate, setAiFeedbackDate] = useState<string | null>(null);
  const [generatingFeedback, setGeneratingFeedback] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetchAgentPerformance(userId),
      fetchFeedbacks(userId),
      fetchWeeklyPerformance(userId),
      fetchAiFeedback(userId),
    ]).then(([p, f, w, ai]) => {
      setPerf(p);
      setFeedbacks(f);
      setWeeklyData(w);
      setAiFeedback(ai.feedback);
      setAiFeedbackDate(ai.updated_at);
    }).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, [userId]);

  const handleStatusChange = async (id: number, status: string) => {
    await updateFeedbackStatus(id, status);
    loadAll();
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Reason for rejecting?");
    if (!reason) return;
    await rejectFeedback(id, reason);
    loadAll();
  };

  const handleGenerateFeedback = async () => {
    setGeneratingFeedback(true);
    try {
      const res = await generateAiFeedback(userId);
      setAiFeedback(res.feedback);
      setAiFeedbackDate(new Date().toISOString());
    } catch (e) { console.error(e); }
    finally { setGeneratingFeedback(false); }
  };

  const activeFeedbacks = feedbacks.filter((f) => f.accepted && f.status !== "completed");
  const completedFeedbacks = feedbacks.filter((f) => f.accepted && f.status === "completed");

  const dimensions = [
    { key: "compliance" as const, label: "Compliance", color: "#3b82f6" },
    { key: "communication" as const, label: "Communication", color: "#8b5cf6" },
    { key: "empathy" as const, label: "Empathy", color: "#ec4899" },
    { key: "negotiation" as const, label: "Negotiation", color: "#f97316" },
    { key: "objection_handling" as const, label: "Objection Handling", color: "#14b8a6" },
    { key: "closure" as const, label: "Call Closure", color: "#22c55e" },
  ];

  const maxGraphScore = 100;
  const graphHeight = 200;

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>
        <button onClick={loadAll} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refresh Scores
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent"></div>
        </div>
      ) : perf && (
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Title + Overall Score */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">My Performance</h2>
            <p className="text-sm text-gray-500 mt-1">{userName} • {perf.total_calls_scored} call{perf.total_calls_scored !== 1 ? "s" : ""} scored</p>
          </div>

          {/* Score Card + Dimensions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overall Score */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
              <h3 className="text-sm font-semibold text-orange-500 mb-3">Overall Performance Score</h3>
              <div className="relative inline-block">
                <svg className="w-36 h-24" viewBox="0 0 140 80">
                  <path d="M 12 72 A 58 58 0 0 1 128 72" fill="none" stroke="#e5e7eb" strokeWidth="11" strokeLinecap="round" />
                  <path d="M 12 72 A 58 58 0 0 1 128 72" fill="none" stroke="url(#perfGrad)" strokeWidth="11" strokeLinecap="round"
                    strokeDasharray={`${(perf.overall_score / 100) * 182} 182`} />
                  <defs><linearGradient id="perfGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#f97316" /><stop offset="50%" stopColor="#ec4899" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex items-end justify-center pb-1">
                  <span className="text-4xl font-bold text-gray-800">{perf.overall_score}</span>
                  <span className="text-sm text-gray-400 ml-0.5 mb-1">/100</span>
                </div>
              </div>
            </div>

            {/* Dimensions */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4">📊 Scoring Parameters</h3>
              <div className="space-y-3">
                {dimensions.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-[130px] shrink-0">{label}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(perf[key].score / perf[key].max) * 100}%`, backgroundColor: color }}></div>
                    </div>
                    <span className="text-xs font-bold text-gray-800 w-14 text-right">{perf[key].score} / {perf[key].max}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Performance Timeline Graph */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="text-blue-500">📈</span> Performance Timeline
              </h3>
              <span className="text-xs text-gray-400">Calls Scored: <strong className="text-gray-700">{perf.total_calls_scored}</strong></span>
            </div>
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded-full"></span> Score</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-200 rounded-full"></span> Call Date</span>
            </div>
            {weeklyData.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No scored calls yet. Score some calls to see your performance timeline.</div>
            ) : (
              <div className="relative" style={{ height: graphHeight + 50 }}>
                {/* Y-axis labels + grid lines */}
                {[0, 20, 40, 60, 80, 100].map((val) => (
                  <div key={val} className="absolute left-0 flex items-center" style={{ bottom: (val / maxGraphScore) * graphHeight + 30, width: "100%" }}>
                    <span className="text-[10px] text-gray-400 w-6 text-right">{val}</span>
                    <div className="flex-1 ml-2 border-t border-dashed border-gray-200"></div>
                  </div>
                ))}
                {/* SVG Line Chart */}
                <svg className="absolute left-8 right-0 bottom-7" style={{ height: graphHeight + 10, width: "calc(100% - 32px)" }} viewBox={`0 0 ${Math.max(weeklyData.length - 1, 1) * 100} ${graphHeight}`} preserveAspectRatio="none">
                  {/* Line */}
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={weeklyData.map((w, i) => `${i * (100)},${graphHeight - (w.score / maxGraphScore) * graphHeight}`).join(" ")}
                  />
                  {/* Area fill */}
                  <polygon
                    fill="url(#lineGradient)"
                    opacity="0.15"
                    points={`0,${graphHeight} ${weeklyData.map((w, i) => `${i * 100},${graphHeight - (w.score / maxGraphScore) * graphHeight}`).join(" ")} ${(weeklyData.length - 1) * 100},${graphHeight}`}
                  />
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {/* Points */}
                  {weeklyData.map((w, i) => (
                    <circle
                      key={i}
                      cx={i * 100}
                      cy={graphHeight - (w.score / maxGraphScore) * graphHeight}
                      r="5"
                      fill="#3b82f6"
                      stroke="white"
                      strokeWidth="2"
                    />
                  ))}
                </svg>
                {/* X-axis labels */}
                <div className="absolute left-8 right-0 bottom-0 flex justify-between px-0">
                  {weeklyData.map((w, i) => (
                    <div key={i} className="text-center" style={{ width: `${100 / weeklyData.length}%` }}>
                      <span className="text-[9px] text-gray-400">{new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Learning Materials */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="text-amber-500">📚</span> Learning Materials
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-lime-100 to-lime-50 rounded-xl p-5 border border-lime-200 relative overflow-hidden">
                <div className="absolute top-2 right-3 text-2xl opacity-30">📖</div>
                <h4 className="text-base font-bold text-gray-800 mb-2">FDCPA Compliance Guide</h4>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  Master the Fair Debt Collection Practices Act requirements. Learn mandatory disclosures, prohibited language, and verification procedures to maintain full compliance on every call.
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-lime-200 rounded-full overflow-hidden"><div className="h-full bg-lime-500 rounded-full" style={{ width: "35%" }}></div></div>
                    <span className="text-[10px] text-gray-500">35%</span>
                  </div>
                  <button className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800">Study Now</button>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-xl p-5 border border-purple-200 relative overflow-hidden">
                <div className="absolute top-2 right-3 text-2xl opacity-30">🎯</div>
                <h4 className="text-base font-bold text-gray-800 mb-2">Negotiation Techniques</h4>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  Advanced negotiation strategies for debt collection. Learn how to probe affordability, offer payment alternatives, handle pushback, and secure commitments effectively.
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 bg-purple-200 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: "12%" }}></div></div>
                    <span className="text-[10px] text-gray-500">12%</span>
                  </div>
                  <button className="px-3 py-1.5 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800">Study Now</button>
                </div>
              </div>
            </div>
          </div>

          {/* AI Feedback */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <span className="text-blue-500">🤖</span> AI Feedback
              </h3>
              <button
                onClick={handleGenerateFeedback}
                disabled={generatingFeedback}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white text-xs font-medium rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {generatingFeedback ? (
                  <><div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div> Generating...</>
                ) : (
                  <><span className="font-bold">Ai✦</span> {aiFeedback ? "Regenerate" : "Generate"} Feedback</>
                )}
              </button>
            </div>
            {aiFeedback ? (
              <div>
                <p className="text-sm text-gray-700 leading-relaxed">{aiFeedback}</p>
                {aiFeedbackDate && (
                  <p className="text-[10px] text-gray-400 mt-3">Last updated: {new Date(aiFeedbackDate).toLocaleString()}</p>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                Click "Generate Feedback" to get personalized AI coaching based on your performance scores.
              </div>
            )}
          </div>

          {/* Improvement Goals */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="text-blue-500">🎯</span> Improvement Goals
            </h3>
            {activeFeedbacks.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">No active goals. Get AI feedback on your calls to create goals.</p>
            ) : (
              <div className="space-y-3">
                {activeFeedbacks.map((fb) => (
                  <div key={fb.id} className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-gray-800 flex-1">{fb.feedback_text}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${fb.status === "open" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                        {fb.status === "open" ? "Open" : "In Progress"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {fb.target_date && <span className="text-[10px] text-gray-400">Target: {fb.target_date}</span>}
                      <div className="flex-1"></div>
                      {fb.status === "open" && (
                        <button onClick={() => handleStatusChange(fb.id, "in_progress")} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Start</button>
                      )}
                      {fb.status === "in_progress" && (
                        <button onClick={() => handleStatusChange(fb.id, "completed")} className="text-[10px] px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100">✓ Complete</button>
                      )}
                      <button onClick={() => handleReject(fb.id)} className="text-[10px] px-2 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed Goals */}
          {completedFeedbacks.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span className="text-green-500">✓</span> Completed Goals
              </h3>
              <div className="space-y-2">
                {completedFeedbacks.map((fb) => (
                  <div key={fb.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-400 line-through flex-1">{fb.feedback_text}</span>
                    <span className="text-[10px] text-gray-400">{fb.completed_at ? new Date(fb.completed_at).toLocaleDateString() : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
