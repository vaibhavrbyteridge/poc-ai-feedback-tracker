import { useState, useEffect, useCallback, type ReactNode } from "react";
import { CustomerDetail, SessionInfo, COLLECTOR, createSession, fetchPersonalities, fetchCustomerDetails, saveCallHistory, fetchCallHistory, fetchCallTurns, deleteCallHistory, CallHistoryItem, scoreCall, ScoreResult, fetchCallScore, deleteCallScore, createFeedback, updatePhoneNumbers, updateBankruptcyCases, saveDisposition, fetchDisposition, updateCustomerInfo, ActionItem, fetchActionItems, fetchCustomerActionItems, completeActionItem, EditFlags, fetchEditFlags, fetchContactPreferences, ContactPreferences, acceptAllActionItems } from "../api/client";
import { TranscriptTurn } from "../hooks/useConversation";
import CallSimulator from "./CallSimulator";

interface PreviousCall {
  id: string;
  session_id: string;
  agentName: string;
  date: string;
  turns: TranscriptTurn[];
  turnCount: number;
  score: number | null;
  dialedPhone: string;
}

interface Props {
  customer: CustomerDetail;
  onBack: () => void;
}

// Single hardcoded collector — no login/user selection in this POC.
const user = COLLECTOR;

export default function DetailView({ customer, onBack }: Props) {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [personalities, setPersonalities] = useState<string[]>([]);
  const [selectedPersonality, setSelectedPersonality] = useState("cooperative");
  const [selectedPhone, setSelectedPhone] = useState("");
  const [startingCall, setStartingCall] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState<TranscriptTurn[]>([]);
  const [previousCalls, setPreviousCalls] = useState<PreviousCall[]>([]);
  const [showEndCallPopup, setShowEndCallPopup] = useState(false);
  const [endedCallTranscript, setEndedCallTranscript] = useState<TranscriptTurn[]>([]);
  const [scoringResult, setScoringResult] = useState<ScoreResult | null>(null);
  const [scoring, setScoring] = useState(false);
  const [activePopupSessionId, setActivePopupSessionId] = useState<string>("");
  const [addedGoals, setAddedGoals] = useState<Set<string>>(new Set());
  const [editingPhone, setEditingPhone] = useState<{ phone: string; contact_name: string; email: string; type: string; status: string; timezone: string; do_not_call: boolean; do_not_text: boolean; do_not_email: boolean; is_main: boolean; index: number } | null>(null);
  const [showBankruptcyForm, setShowBankruptcyForm] = useState(false);
  const [bankruptcyForm, setBankruptcyForm] = useState({ caseNumber: "", chapter: "Chapter 7", petitionDate: "", status: "Active", dischargeDate: "" });
  const [editingBankruptcyIdx, setEditingBankruptcyIdx] = useState<number | null>(null);
  const [disposition, setDisposition] = useState<{ disposition: string; call_type: string; notes: string }>({ disposition: "", call_type: "Outbound", notes: "" });
  const [, forceRender] = useState(0);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [, setCustomerActionItems] = useState<ActionItem[]>([]);
  const [editFlags, setEditFlags] = useState<EditFlags[]>([]);
  const [, setContactPrefs] = useState<ContactPreferences>({ cease_all_calls: false, cease_all_texts: false, cease_all_emails: false, cease_all_contact: false });

  useEffect(() => {
    fetchPersonalities().then((p) => setPersonalities(p.map((x) => x.id)));
  }, []);

  // Load call history from MySQL on mount
  useEffect(() => {
    fetchCallHistory(user.id).then((history: CallHistoryItem[]) => {
      const calls: PreviousCall[] = history
        .filter((h) => h.customer_id === customer.accountInfo.accountNumber)
        .map((h) => ({
          id: String(h.id),
          session_id: h.session_id,
          agentName: user.full_name,
          date: new Date(h.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
          turns: [],
          turnCount: h.turn_count,
          score: h.ai_score,
          dialedPhone: h.dialed_phone || "",
        }));
      setPreviousCalls(calls);
    }).catch(console.error);
    // Load pending action items for ❗ indicators
    fetchCustomerActionItems(user.id, customer.accountInfo.accountNumber).then(setCustomerActionItems).catch(console.error);
    // Load edit flags
    fetchEditFlags(user.id, customer.accountInfo.accountNumber).then(setEditFlags).catch(console.error);
    // Load contact preferences
    fetchContactPreferences(customer.accountInfo.accountNumber).then(setContactPrefs).catch(console.error);
  }, [user.id, customer.accountInfo.accountNumber]);

  const handleStartCall = async () => {
    setStartingCall(true);
    try {
      const sess = await createSession({
        customer_id: customer.accountInfo.accountNumber,
        personality_id: selectedPersonality,
        company_name: "Acme Collections",
      });
      setSession(sess);
      setCurrentTranscript([]);
    } catch (e) {
      console.error(e);
    } finally {
      setStartingCall(false);
    }
  };

  const handleEndCall = () => {
    if (currentTranscript.length > 0 && session) {
      const newCall: PreviousCall = {
        id: `call-${Date.now()}`,
        session_id: session.session_id,
        agentName: user.full_name,
        date: new Date().toLocaleString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        }),
        turns: [...currentTranscript],
        turnCount: currentTranscript.length,
        score: null,
        dialedPhone: selectedPhone,
      };
      setPreviousCalls((prev) => [newCall, ...prev]);

      // Persist to MySQL
      saveCallHistory({
        session_id: session.session_id,
        user_id: user.id,
        customer_id: customer.accountInfo.accountNumber,
        customer_name: customer.basicInfo.fullName,
        personality_id: session.personality_id,
        company_name: session.company_name,
        dialed_phone: selectedPhone,
        turns: currentTranscript.map((t) => ({ collector: t.collector, customer: t.customer, suggestions: t.suggestions })),
      }).catch(console.error);
    }
    setSession(null);
    setCurrentTranscript([]);
  };

  const handleAnalyseCall = async (call: PreviousCall) => {
    setScoringResult(null);
    setActivePopupSessionId(call.session_id);

    // Load transcript
    let transcript: TranscriptTurn[] = [];
    if (call.turns.length > 0) {
      transcript = call.turns;
    } else {
      try {
        const turns = await fetchCallTurns(user.id, call.session_id);
        transcript = turns.map((t) => ({
          collector: t.collector,
          customer: t.customer,
          suggestions: t.suggestions as TranscriptTurn["suggestions"],
        }));
      } catch {
        console.error("Failed to load turns");
        return;
      }
    }
    setEndedCallTranscript(transcript);
    setShowEndCallPopup(true);

    // Check if already scored — if so, load the result directly
    try {
      const stored = await fetchCallScore(call.session_id);
      if (stored.scored) {
        const { scored, ...result } = stored;
        setScoringResult(result as ScoreResult);
      }
    } catch {
      // No stored score — user can click "Let AI Check Your Call"
    }

    // Load disposition
    try {
      const disp = await fetchDisposition(call.session_id);
      setDisposition({ disposition: disp.disposition || "", call_type: disp.call_type || "Outbound", notes: disp.notes || "" });
    } catch {
      setDisposition({ disposition: "", call_type: "Outbound", notes: "" });
    }

    // Load action items for this call
    fetchActionItems(call.session_id).then(setActionItems).catch(console.error);
  };

  const handleScoreCall = async () => {
    if (endedCallTranscript.length === 0) return;
    setScoring(true);
    try {
      const result = await scoreCall({
        session_id: activePopupSessionId,
        user_id: user.id,
        turns: endedCallTranscript.map((t) => ({ collector: t.collector, customer: t.customer })),
        dialed_phone: previousCalls.find((c) => c.session_id === activePopupSessionId)?.dialedPhone || selectedPhone || "",
      });
      setScoringResult(result);
      // Update the score in the local list
      setPreviousCalls((prev) =>
        prev.map((c) => c.session_id === activePopupSessionId ? { ...c, score: result.overall_score } : c)
      );
      // Reload action items
      fetchActionItems(activePopupSessionId).then(setActionItems).catch(console.error);
      fetchCustomerActionItems(user.id, customer.accountInfo.accountNumber).then(setCustomerActionItems).catch(console.error);
      // Reload edit flags
      fetchEditFlags(user.id, customer.accountInfo.accountNumber).then(setEditFlags).catch(console.error);
    } catch (err) {
      console.error("Scoring failed", err);
    } finally {
      setScoring(false);
    }
  };

  const handleDeleteScore = async () => {
    try {
      await deleteCallScore(activePopupSessionId);
      setScoringResult(null);
      setActionItems([]);
      // Reset score in local list
      setPreviousCalls((prev) =>
        prev.map((c) => c.session_id === activePopupSessionId ? { ...c, score: null } : c)
      );
      // Reload edit flags since they were cleared
      fetchEditFlags(user.id, customer.accountInfo.accountNumber).then(setEditFlags).catch(console.error);
    } catch (err) {
      console.error("Failed to delete score", err);
    }
  };

  const handleDeleteCall = (callId: string, sessionId: string) => {
    setPreviousCalls((prev) => prev.filter((c) => c.id !== callId));
    deleteCallHistory(user.id, sessionId).catch(console.error);
  };

  const handleTranscriptUpdate = useCallback((turns: TranscriptTurn[]) => {
    setCurrentTranscript(turns);
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("fail") || s.includes("overdue")) return "bg-red-100 text-red-800 border-red-200";
    if (s.includes("pending") || s.includes("upcoming")) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    if (s.includes("success") || s.includes("paid")) return "bg-green-100 text-green-800 border-green-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  return (
    <div className="px-6 py-6 space-y-6">
      {/* End Call / Scoring Popup */}
      {showEndCallPopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            {/* Popup Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md">
                  {customer.basicInfo.fullName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-semibold text-gray-800">{customer.basicInfo.fullName}</span>
                    <span className="text-xs font-bold text-blue-500">Ai✦</span>
                  </div>
                  <span className="text-xs text-gray-400">Call ended • {endedCallTranscript.length} turns</span>
                </div>
              </div>
              <button
                onClick={() => { setShowEndCallPopup(false); setScoringResult(null); fetchEditFlags(user.id, customer.accountInfo.accountNumber).then(setEditFlags).catch(console.error); }}
                className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Popup Body */}
            <div className="flex-1 overflow-hidden flex">
              {/* Left Panel — Scores */}
              {scoringResult && (
                <div className="w-[320px] shrink-0 border-r border-gray-100 p-6 overflow-y-auto">
                  {/* Overall Score */}
                  <div className="text-center mb-6">
                    <h3 className="text-sm font-semibold text-orange-500 tracking-wide mb-2">Overall Score</h3>
                    <div className="relative inline-block">
                      <svg className="w-32 h-20" viewBox="0 0 120 70">
                        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
                        <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="url(#scoreGradient)" strokeWidth="10" strokeLinecap="round"
                          strokeDasharray={`${(scoringResult.overall_score / 100) * 157} 157`} />
                        <defs>
                          <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-end justify-center pb-1">
                        <span className="text-3xl font-bold text-gray-800">{scoringResult.overall_score}</span>
                        <span className="text-sm text-gray-400 ml-0.5 mb-1">/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Score Dimensions — 2 column grid */}
                  <div className="space-y-3">
                    {([
                      { key: "compliance", label: "Compliance", color: "#3b82f6" },
                      { key: "communication", label: "Communication", color: "#8b5cf6" },
                      { key: "empathy", label: "Empathy", color: "#ec4899" },
                      { key: "negotiation", label: "Negotiation", color: "#f97316" },
                      { key: "objection_handling", label: "Objection Handling", color: "#14b8a6" },
                      { key: "closure", label: "Call Closure", color: "#22c55e" },
                    ] as const).map(({ key, label, color }): ReactNode => {
                      const comp = (scoringResult as unknown as Record<string, unknown>)?.comparison as Record<string, { diff: number; direction: string }> | undefined;
                      const dimComp = comp?.[key];
                      return (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-xs text-gray-600 w-[110px] shrink-0">{label}</span>
                          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(scoringResult[key].score / scoringResult[key].max) * 100}%`, backgroundColor: color }}></div>
                          </div>
                          <span className="text-xs font-bold text-gray-700 w-10 text-right">{scoringResult[key].score}/{scoringResult[key].max}</span>
                          {dimComp && (
                            <span className={`text-[10px] font-bold w-12 text-right ${dimComp.direction === "up" ? "text-green-600" : "text-red-500"}`}>
                              {dimComp.direction === "up" ? "↑" : "↓"} {Math.abs(dimComp.diff)}%
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* What Went Well */}
                  <div className="mt-6 bg-green-50 border border-green-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1">
                      <span>✓</span> What Went Well
                    </h4>
                    <ul className="space-y-1.5">
                      {scoringResult.what_went_well.map((item, i) => (
                        <li key={i} className="text-xs text-green-800 leading-relaxed">• {item}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Areas of Improvement */}
                  <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1">
                      <span>⚡</span> Areas of Improvement
                    </h4>
                    <ul className="space-y-2">
                      {scoringResult.areas_of_improvement.map((item, i) => {
                        const goalKey = `${activePopupSessionId}-${i}`;
                        const isAdded = addedGoals.has(goalKey);
                        return (
                          <li key={i} className="flex items-start justify-between gap-2">
                            <span className="text-xs text-orange-800 leading-relaxed">• {item}</span>
                            <button
                              onClick={() => {
                                if (isAdded) {
                                  setAddedGoals((prev) => { const n = new Set(prev); n.delete(goalKey); return n; });
                                } else {
                                  createFeedback({ user_id: user.id, session_id: activePopupSessionId, feedback_text: item }).catch(console.error);
                                  setAddedGoals((prev) => new Set(prev).add(goalKey));
                                }
                              }}
                              className={`text-[9px] px-2 py-0.5 rounded shrink-0 transition-colors ${isAdded ? "bg-green-200 text-green-800 hover:bg-red-100 hover:text-red-700" : "bg-orange-200 text-orange-800 hover:bg-orange-300"}`}
                            >
                              {isAdded ? "✓ Added" : "+ Goal"}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Feedback Achievements */}
                  {(((scoringResult as unknown as Record<string, unknown>)?.feedback_achievements as Array<{feedback_id: number; achieved: boolean; evidence: string}> | undefined) ?? []).filter((a) => a.achieved).length > 0 && (
                    <div className="mt-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1">
                        <span>🎯</span> Goals Achieved in This Call
                      </h4>
                      <ul className="space-y-1.5">
                        {((scoringResult as unknown as Record<string, unknown>).feedback_achievements as Array<{feedback_id: number; achieved: boolean; evidence: string}>).filter((a) => a.achieved).map((a, i) => (
                          <li key={i} className="text-xs text-emerald-800 leading-relaxed">✓ {a.evidence}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action Items */}
                  {actionItems.length > 0 && (
                    <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1">
                        <span>❗</span> Action Items
                      </h4>
                      <div className="space-y-2">
                        {actionItems.map((item) => (
                          <div key={item.id} className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1">
                              {item.status === "completed" ? (
                                <span className="text-green-500 text-xs mt-0.5">✓</span>
                              ) : (
                                <span className="text-amber-500 text-xs mt-0.5">❗</span>
                              )}
                              <span className={`text-xs leading-relaxed ${item.status === "completed" ? "text-gray-400 line-through" : "text-amber-800"}`}>{item.action_text}</span>
                            </div>
                            {item.status === "pending" && (
                              <button
                                onClick={() => { completeActionItem(item.id).then(() => { fetchActionItems(activePopupSessionId).then(setActionItems); fetchCustomerActionItems(user.id, customer.accountInfo.accountNumber).then(setCustomerActionItems); fetchEditFlags(user.id, customer.accountInfo.accountNumber).then(setEditFlags); }).catch(console.error); }}
                                className="text-[9px] px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200 shrink-0"
                              >
                                Done
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {actionItems.some((item) => item.status === "pending") && (
                        <button
                          onClick={() => {
                            acceptAllActionItems({ session_id: activePopupSessionId, user_id: user.id, customer_id: customer.accountInfo.accountNumber })
                              .then(() => {
                                fetchActionItems(activePopupSessionId).then(setActionItems);
                                fetchCustomerActionItems(user.id, customer.accountInfo.accountNumber).then(setCustomerActionItems);
                                fetchEditFlags(user.id, customer.accountInfo.accountNumber).then(setEditFlags);
                                // Reload customer data to reflect changes
                                fetchCustomerDetails().then((customers) => {
                                  const updated = customers.find((c) => c.accountInfo.accountNumber === customer.accountInfo.accountNumber);
                                  if (updated) {
                                    Object.assign(customer, updated);
                                    forceRender((n) => n + 1);
                                  }
                                });
                                // Reload disposition
                                fetchDisposition(activePopupSessionId).then((d) => setDisposition({ disposition: d.disposition || "", call_type: d.call_type || "Outbound", notes: d.notes || "" }));
                              })
                              .catch(console.error);
                          }}
                          className="mt-3 w-full px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all"
                        >
                          ✓ Accept All
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Right Panel — Transcript */}
              <div className="flex-1 overflow-y-auto p-6">
                <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Call Transcript
                </h4>
                <div className="space-y-4">
                  {endedCallTranscript.map((turn, i) => {
                    const idealResp = scoringResult?.ideal_responses?.find((r) => r.turn === i + 1);
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded w-[72px] text-center shrink-0 mt-0.5">Collector</span>
                          <p className="text-sm text-gray-800 leading-relaxed">{turn.collector}</p>
                        </div>
                        {idealResp && (
                          <div className="ml-[84px] bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg px-3 py-2">
                            <span className="text-[10px] font-bold text-indigo-600 uppercase">Ideal response</span>
                            <p className="text-xs text-indigo-800 mt-0.5 leading-relaxed">{idealResp.ideal_response}</p>
                          </div>
                        )}
                        <div className="flex items-start gap-3">
                          <span className="text-[10px] font-bold text-purple-600 uppercase bg-purple-50 px-2 py-0.5 rounded w-[72px] text-center shrink-0 mt-0.5">Customer</span>
                          <p className="text-sm text-gray-600 leading-relaxed">{turn.customer}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Call Disposition */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Call Disposition
                    {(editFlags.some((f) => f.flag_disposition && f.session_id === activePopupSessionId) || (actionItems.length > 0 && !disposition.disposition)) && <span className="ml-1 text-red-500">❗</span>}
                  </h4>

                  {/* Call Type */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-medium text-gray-500 mb-1.5">Call Type</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                        <input type="radio" checked={disposition.call_type === "Inbound"} onChange={() => { const d = { ...disposition, call_type: "Inbound" }; setDisposition(d); saveDisposition(activePopupSessionId, d).catch(console.error); }} className="h-3.5 w-3.5 text-blue-600" />
                        Inbound Call
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer">
                        <input type="radio" checked={disposition.call_type === "Outbound"} onChange={() => { const d = { ...disposition, call_type: "Outbound" }; setDisposition(d); saveDisposition(activePopupSessionId, d).catch(console.error); }} className="h-3.5 w-3.5 text-blue-600" />
                        Outbound Call
                      </label>
                    </div>
                  </div>

                  {/* Disposition Toggles — multiple can be active */}
                  <label className="block text-[10px] font-medium text-gray-500 mb-2">Call Dispositions</label>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    {["Promise to Pay", "Callback Requested", "No Answer", "Left Message", "Talked to Consumer", "Consumer Hung Up", "Disconnected Number", "Refused to Pay", "Wrong Number", "Payment Arrangement Made"].map((opt) => {
                      const activeDisps = disposition.disposition ? disposition.disposition.split(",").map((s) => s.trim()) : [];
                      const isOn = activeDisps.includes(opt);
                      const needsAttention = editFlags.some((f) => f.flag_disposition && f.session_id === activePopupSessionId && f.suggested_values && f.suggested_values["disposition"]?.toLowerCase().includes(opt.toLowerCase())) || actionItems.some((a) => a.status === "pending" && a.field_category === "disposition" && a.field_value?.toLowerCase().includes(opt.toLowerCase()));
                      return (
                        <div key={opt} className={`flex items-center justify-between ${needsAttention ? "bg-red-50 rounded px-1 -mx-1" : ""}`}>
                          <span className="text-xs text-gray-700">
                            {opt}
                            {needsAttention && <span className="ml-1 text-red-500">❗</span>}
                          </span>
                          <button
                            onClick={() => {
                              const newDisps = isOn ? activeDisps.filter((d) => d !== opt) : [...activeDisps, opt];
                              const newDispStr = newDisps.join(", ");
                              const d = { ...disposition, disposition: newDispStr, notes: "" };
                              setDisposition(d);
                              saveDisposition(activePopupSessionId, d).catch(console.error);
                            }}
                            className={`relative w-9 h-5 rounded-full transition-colors ${isOn ? "bg-blue-500" : "bg-gray-300"}`}
                          >
                            <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${isOn ? "translate-x-4" : ""}`}></span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Popup Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/50">
              <button
                onClick={() => { setShowEndCallPopup(false); setScoringResult(null); fetchEditFlags(user.id, customer.accountInfo.accountNumber).then(setEditFlags).catch(console.error); }}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Close
              </button>
              <div className="flex items-center gap-3">
                {scoringResult && (
                  <button
                    onClick={handleDeleteScore}
                    className="px-4 py-2 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Rating
                  </button>
                )}
                {!scoringResult && (
                  <button
                    onClick={handleScoreCall}
                    disabled={scoring}
                    className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-blue-700 transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
                  >
                    {scoring ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Analysing...
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-bold">Ai✦</span>
                        Let AI Check Your Call
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back Button + Account Info */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to List
        </button>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-800">{customer.basicInfo.fullName}</div>
          <div className="text-xs text-gray-500">Acc: {customer.accountInfo.accountNumber}</div>
        </div>
      </div>

      {/* Account Info Cards - 3 Column (Editable) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Account Highlights</h3>
          </div>
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-gray-100">
              <EditableRow label="Phone" value={(() => { const main = customer.phone_numbers?.find((p) => p.is_main); return main ? main.phone : String(customer.basicInfo.cPhone); })()} onSave={(v) => { customer.basicInfo.cPhone = v; const main = customer.phone_numbers?.find((p) => p.is_main); if (main) main.phone = v; updateCustomerInfo(customer.accountInfo.accountNumber, { basicInfo: { cPhone: v } }).catch(console.error); forceRender((n) => n + 1); }} hasAlert={editFlags.some((f) => f.flag_phone)} suggestedValue={editFlags.find((f) => f.flag_phone)?.suggested_values?.["phone"] || editFlags.find((f) => f.flag_phone)?.suggested_values?.["cPhone"]} />
              <EditableRow label="Email" value={(() => { const main = customer.phone_numbers?.find((p) => p.is_main); return main?.email || customer.basicInfo.email; })()} onSave={(v) => { customer.basicInfo.email = v; const main = customer.phone_numbers?.find((p) => p.is_main); if (main) main.email = v; updateCustomerInfo(customer.accountInfo.accountNumber, { basicInfo: { email: v } }).catch(console.error); forceRender((n) => n + 1); }} hasAlert={editFlags.some((f) => f.flag_email)} suggestedValue={editFlags.find((f) => f.flag_email)?.suggested_values?.["email"] || editFlags.find((f) => f.flag_email)?.suggested_values?.["email_address"]} />
              <EditableRow label="Address" value={customer.basicInfo.address} onSave={(v) => { customer.basicInfo.address = v; updateCustomerInfo(customer.accountInfo.accountNumber, { basicInfo: { address: v } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_address)} suggestedValue={editFlags.find((f) => f.flag_address)?.suggested_values?.["address"]} />
              <EditableRow label="Timezone" value={customer.basicInfo.timezone} onSave={(v) => { customer.basicInfo.timezone = v; const main = customer.phone_numbers?.find((p) => p.is_main); if (main) main.timezone = v; updateCustomerInfo(customer.accountInfo.accountNumber, { basicInfo: { timezone: v } }).catch(console.error); forceRender((n) => n + 1); }} hasAlert={editFlags.some((f) => f.flag_timezone)} suggestedValue={editFlags.find((f) => f.flag_timezone)?.suggested_values?.["timezone"]} />
              <EditableRow label="Language Preference" value={customer.basicInfo.language || "English"} onSave={(v) => { customer.basicInfo.language = v; updateCustomerInfo(customer.accountInfo.accountNumber, { basicInfo: { language: v } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_language_preference)} suggestedValue={editFlags.find((f) => f.flag_language_preference)?.suggested_values?.["language_preference"] || editFlags.find((f) => f.flag_language_preference)?.suggested_values?.["language"]} />
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Account Info</h3>
          </div>
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-gray-100">
              <InfoRow label="Account Number" value={customer.accountInfo.accountNumber} />
              <EditableRow label="Account Type" value={customer.accountInfo.accountType} onSave={(v) => { customer.accountInfo.accountType = v; updateCustomerInfo(customer.accountInfo.accountNumber, { accountInfo: { accountType: v } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_account_type)} suggestedValue={editFlags.find((f) => f.flag_account_type)?.suggested_values?.["accountType"] || editFlags.find((f) => f.flag_account_type)?.suggested_values?.["account_type"]} />
              <EditableRow label="Days Past Due" value={String(customer.accountInfo.daysPastDue)} onSave={(v) => { customer.accountInfo.daysPastDue = Number(v); updateCustomerInfo(customer.accountInfo.accountNumber, { accountInfo: { daysPastDue: Number(v) } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_days_past_due)} suggestedValue={editFlags.find((f) => f.flag_days_past_due)?.suggested_values?.["daysPastDue"] || editFlags.find((f) => f.flag_days_past_due)?.suggested_values?.["days_past_due"]} />
              <EditableRow label="Status" value={customer.accountInfo.status} onSave={(v) => { customer.accountInfo.status = v; updateCustomerInfo(customer.accountInfo.accountNumber, { accountInfo: { status: v } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_status)} suggestedValue={editFlags.find((f) => f.flag_status)?.suggested_values?.["status"]} />
            </tbody>
          </table>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Loan Details</h3>
          </div>
          <table className="w-full border-collapse">
            <tbody className="divide-y divide-gray-100">
              <EditableRow label="Total Loan Amount" value={String(customer.accountInfo.loanDetails.totalLoanAmount)} onSave={(v) => { customer.accountInfo.loanDetails.totalLoanAmount = Number(v); updateCustomerInfo(customer.accountInfo.accountNumber, { accountInfo: { loanDetails: { totalLoanAmount: Number(v) } } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_total_loan_amount)} suggestedValue={editFlags.find((f) => f.flag_total_loan_amount)?.suggested_values?.["totalLoanAmount"] || editFlags.find((f) => f.flag_total_loan_amount)?.suggested_values?.["total_loan_amount"]} />
              <EditableRow label="Principal" value={String(customer.accountInfo.loanDetails.principalAmount)} onSave={(v) => { customer.accountInfo.loanDetails.principalAmount = Number(v); updateCustomerInfo(customer.accountInfo.accountNumber, { accountInfo: { loanDetails: { principalAmount: Number(v) } } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_principal)} suggestedValue={editFlags.find((f) => f.flag_principal)?.suggested_values?.["principalAmount"] || editFlags.find((f) => f.flag_principal)?.suggested_values?.["principal"]} />
              <EditableRow label="Total Interest" value={String(customer.accountInfo.loanDetails.interestAmount)} onSave={(v) => { customer.accountInfo.loanDetails.interestAmount = Number(v); updateCustomerInfo(customer.accountInfo.accountNumber, { accountInfo: { loanDetails: { interestAmount: Number(v) } } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_interest)} suggestedValue={editFlags.find((f) => f.flag_interest)?.suggested_values?.["interestAmount"] || editFlags.find((f) => f.flag_interest)?.suggested_values?.["interest"]} />
              <EditableRow label="Monthly Payment" value={String(customer.accountInfo.paymentPlan.monthlyInstallment)} onSave={(v) => { customer.accountInfo.paymentPlan.monthlyInstallment = Number(v); updateCustomerInfo(customer.accountInfo.accountNumber, { accountInfo: { paymentPlan: { monthlyInstallment: Number(v) } } }).catch(console.error); }} hasAlert={editFlags.some((f) => f.flag_monthly_payment)} suggestedValue={editFlags.find((f) => f.flag_monthly_payment)?.suggested_values?.["monthlyInstallment"] || editFlags.find((f) => f.flag_monthly_payment)?.suggested_values?.["monthly_payment"]} />
            </tbody>
          </table>
        </div>
      </div>

      {/* Call Simulator Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-800">Call Simulator</h3>
            </div>
            {!session && (
              <div className="flex items-center gap-3">
                <select
                  value={selectedPersonality}
                  onChange={(e) => setSelectedPersonality(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  {personalities.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                {customer.phone_numbers && customer.phone_numbers.length > 0 && (() => {
                  const available = customer.phone_numbers!.filter((pn) => !pn.do_not_call && pn.status === "Active");
                  const currentVal = available.find((pn) => pn.phone === selectedPhone) ? selectedPhone : (available[0]?.phone || "");
                  if (currentVal !== selectedPhone) setTimeout(() => setSelectedPhone(currentVal), 0);
                  return (
                    <select
                      value={currentVal}
                      onChange={(e) => setSelectedPhone(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      {available.map((pn, i) => (
                        <option key={i} value={pn.phone}>{pn.phone} ({pn.contact_name})</option>
                      ))}
                      {available.length === 0 && <option value="">No numbers available</option>}
                    </select>
                  );
                })()}
                <button
                  onClick={handleStartCall}
                  disabled={startingCall}
                  className="px-5 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg font-medium hover:from-green-700 hover:to-green-800 transition-all shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Start Call
                </button>
              </div>
            )}
            {session && (
              <button
                onClick={handleEndCall}
                className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors text-sm"
              >
                End Call
              </button>
            )}
          </div>
        </div>
        <div className="p-6">
          {session ? (
            <CallSimulator session={session} onTranscriptUpdate={handleTranscriptUpdate} />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <p className="text-lg font-medium">Ready to simulate a call</p>
              <p className="text-sm mt-1">Select a personality and click "Start Call" to begin</p>
            </div>
          )}
        </div>
      </div>

      {/* Payments Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Pending Payments</h3>
          </div>
          {customer.pending_payments.length === 0 ? (
            <div className="text-gray-500 text-center py-8 text-sm">No pending payments</div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Due Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.pending_payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{p.id}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(p.dueDate)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Processed Payments</h3>
          </div>
          {customer.processed_payments.length === 0 ? (
            <div className="text-gray-500 text-center py-8 text-sm">No processed payments</div>
          ) : (
            <table className="w-full border-collapse">
              <thead className="bg-white border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Date</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Method</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.processed_payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{p.id}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(p.dueDate || "")}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.method}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(p.status)}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Phone Numbers */}
      {customer.phone_numbers && customer.phone_numbers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Phone Numbers</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Phone Number</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Contact Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Timezone</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs">Do Not Call</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs">Do Not Text</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs">Do Not Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customer.phone_numbers.map((pn, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 cursor-pointer" onClick={() => setEditingPhone({ ...pn, index: idx })}>
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">
                      {pn.phone}
                      {pn.is_main && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Main</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{pn.contact_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pn.email || "—"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pn.type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${pn.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {pn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pn.timezone}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ToggleSwitch active={pn.do_not_call} onToggle={() => { pn.do_not_call = !pn.do_not_call; updatePhoneNumbers(customer.accountInfo.accountNumber, customer.phone_numbers!).catch(console.error); forceRender((n) => n + 1); }} />
                        {editFlags.some((f) => f.flag_do_not_call && f.dialed_phone === pn.phone) && <span className="text-red-500 text-xs">❗</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ToggleSwitch active={pn.do_not_text} onToggle={() => { pn.do_not_text = !pn.do_not_text; updatePhoneNumbers(customer.accountInfo.accountNumber, customer.phone_numbers!).catch(console.error); forceRender((n) => n + 1); }} />
                        {editFlags.some((f) => f.flag_do_not_text && f.dialed_phone === pn.phone) && <span className="text-red-500 text-xs">❗</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <ToggleSwitch active={pn.do_not_email} onToggle={() => { pn.do_not_email = !pn.do_not_email; updatePhoneNumbers(customer.accountInfo.accountNumber, customer.phone_numbers!).catch(console.error); forceRender((n) => n + 1); }} />
                        {editFlags.some((f) => f.flag_do_not_email && f.dialed_phone === pn.phone) && <span className="text-red-500 text-xs">❗</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Phone Number Panel */}
      {editingPhone && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">Edit / View Phone Number</h3>
              <button onClick={() => setEditingPhone(null)} className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number *</label>
                  <input type="text" value={editingPhone.phone} onChange={(e) => setEditingPhone({ ...editingPhone, phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                  <input type="text" value={editingPhone.contact_name} onChange={(e) => setEditingPhone({ ...editingPhone, contact_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone Type</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">{editingPhone.type}</div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">{editingPhone.status}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input type="email" value={editingPhone.email} onChange={(e) => setEditingPhone({ ...editingPhone, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time Zone</label>
                  <input type="text" value={editingPhone.timezone} onChange={(e) => setEditingPhone({ ...editingPhone, timezone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Other Statuses</label>
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={editingPhone.do_not_call} onChange={(e) => setEditingPhone({ ...editingPhone, do_not_call: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    Do Not Call
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={editingPhone.do_not_text} onChange={(e) => setEditingPhone({ ...editingPhone, do_not_text: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    Do Not Text
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={editingPhone.do_not_email} onChange={(e) => setEditingPhone({ ...editingPhone, do_not_email: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                    Do Not Email
                  </label>
                </div>
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={editingPhone.is_main} onChange={(e) => setEditingPhone({ ...editingPhone, is_main: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <span className="font-medium">Mark as Primary</span>
                </label>
                <p className="text-[10px] text-gray-400 mt-0.5 ml-6">Primary phone and email will be displayed in Account Highlights</p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setEditingPhone(null)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button
                onClick={() => {
                  if (customer.phone_numbers) {
                    // If marking as main, unset all others
                    if (editingPhone.is_main) {
                      customer.phone_numbers.forEach((pn) => { pn.is_main = false; });
                    }
                    customer.phone_numbers[editingPhone.index] = {
                      phone: editingPhone.phone,
                      contact_name: editingPhone.contact_name,
                      email: editingPhone.email,
                      type: editingPhone.type,
                      status: editingPhone.status,
                      timezone: editingPhone.timezone,
                      do_not_call: editingPhone.do_not_call,
                      do_not_text: editingPhone.do_not_text,
                      do_not_email: editingPhone.do_not_email,
                      is_main: editingPhone.is_main,
                    };
                    updatePhoneNumbers(customer.accountInfo.accountNumber, customer.phone_numbers).catch(console.error);
                  }
                  setEditingPhone(null);
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bankruptcy Cases */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">Bankruptcy Cases</h3>
          <button
            onClick={() => { setBankruptcyForm({ caseNumber: "", chapter: "Chapter 7", petitionDate: "", status: "Active", dischargeDate: "" }); setEditingBankruptcyIdx(null); setShowBankruptcyForm(true); }}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            + Add Bankruptcy
          </button>
        </div>
        {(!customer.bankruptcyCases || customer.bankruptcyCases.length === 0) ? (
          <div className="text-gray-400 text-center py-8 text-sm">No bankruptcy cases on file</div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Case Number</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Chapter</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Petition Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600 text-xs">Discharge Date</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600 text-xs">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customer.bankruptcyCases.map((bc, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-blue-600">{bc.caseNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{bc.chapter}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{bc.petitionDate}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${bc.status === "Active" ? "bg-yellow-100 text-yellow-700" : bc.status === "Discharged" ? "bg-green-100 text-green-700" : bc.status === "Dismissed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>{bc.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{bc.dischargeDate || "—"}</td>
                  <td className="px-4 py-3 text-center flex gap-2 justify-center">
                    <button onClick={() => { setBankruptcyForm(bc); setEditingBankruptcyIdx(idx); setShowBankruptcyForm(true); }} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">Edit</button>
                    <button onClick={() => { customer.bankruptcyCases!.splice(idx, 1); updateBankruptcyCases(customer.accountInfo.accountNumber, customer.bankruptcyCases!).catch(console.error); setEditingBankruptcyIdx(null); }} className="text-[10px] px-2 py-0.5 bg-red-50 text-red-500 rounded hover:bg-red-100">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bankruptcy Add/Edit Modal */}
      {showBankruptcyForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-800">{editingBankruptcyIdx !== null ? "Edit" : "Add"} Bankruptcy Case</h3>
              <button onClick={() => setShowBankruptcyForm(false)} className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Case Number *</label>
                <input type="text" value={bankruptcyForm.caseNumber} onChange={(e) => setBankruptcyForm({ ...bankruptcyForm, caseNumber: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. BK-2025-1234" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Chapter</label>
                  <select value={bankruptcyForm.chapter} onChange={(e) => setBankruptcyForm({ ...bankruptcyForm, chapter: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                    <option>Chapter 7</option>
                    <option>Chapter 11</option>
                    <option>Chapter 13</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                  <select value={bankruptcyForm.status} onChange={(e) => setBankruptcyForm({ ...bankruptcyForm, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                    <option>Active</option>
                    <option>Dismissed</option>
                    <option>Discharged</option>
                    <option>Closed</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Petition Date *</label>
                  <input type="date" value={bankruptcyForm.petitionDate} onChange={(e) => setBankruptcyForm({ ...bankruptcyForm, petitionDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Discharge Date</label>
                  <input type="date" value={bankruptcyForm.dischargeDate} onChange={(e) => setBankruptcyForm({ ...bankruptcyForm, dischargeDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowBankruptcyForm(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button
                onClick={() => {
                  if (!bankruptcyForm.caseNumber || !bankruptcyForm.petitionDate) return;
                  if (!customer.bankruptcyCases) customer.bankruptcyCases = [];
                  if (editingBankruptcyIdx !== null) {
                    customer.bankruptcyCases[editingBankruptcyIdx] = { ...bankruptcyForm };
                  } else {
                    customer.bankruptcyCases.push({ ...bankruptcyForm });
                  }
                  updateBankruptcyCases(customer.accountInfo.accountNumber, customer.bankruptcyCases).catch(console.error);
                  setShowBankruptcyForm(false);
                }}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingBankruptcyIdx !== null ? "Save" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previous Calls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Previous Calls
        </h2>
        {previousCalls.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No previous calls yet. Complete a call to see it here.</div>
        ) : (
          <div className="space-y-3">
            {previousCalls.map((call) => (
              <div
                key={call.id}
                className="flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-purple-50/30 border border-gray-200 rounded-xl px-5 py-4 hover:shadow-md transition-shadow"
              >
                {/* Left: Avatar + Agent info */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                      {call.agentName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">{call.agentName}</span>
                      <span className="text-xs font-medium text-blue-600">Ai✦</span>
                    </div>
                    <span className="text-xs text-gray-500">{call.date}</span>
                  </div>
                </div>

                {/* Center: Analyse button or Score */}
                <div className="flex items-center gap-2">
                  {call.score !== null ? (
                    <button
                      onClick={() => handleAnalyseCall(call)}
                      className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-full shadow-sm hover:from-purple-600 hover:to-purple-700 transition-all flex items-center gap-1.5"
                    >
                      <span className="text-xs">Ai✦</span>
                      Score {call.score}/100 ↗
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAnalyseCall(call)}
                      className="px-4 py-1.5 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-full shadow-sm hover:from-purple-600 hover:to-purple-700 transition-all flex items-center gap-1.5"
                    >
                      <span className="text-xs">Ai✦</span>
                      Analyse
                    </button>
                  )}
                </div>

                {/* Right: Delete button */}
                <button
                  onClick={() => handleDeleteCall(call.id, call.session_id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete call"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-3 text-sm font-medium text-gray-600 text-left">{label}</td>
      <td className="px-6 py-3 text-sm text-gray-900 text-left">{value}</td>
    </tr>
  );
}

function EditableRow({ label, value, onSave, hasAlert, suggestedValue }: { label: string; value: string; onSave: (v: string) => void; hasAlert?: boolean; suggestedValue?: string }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const [displayVal, setDisplayVal] = useState(value);

  // Sync displayVal when value prop changes (e.g., after Accept All)
  useEffect(() => {
    setDisplayVal(value);
  }, [value]);

  const handleSave = () => {
    onSave(editVal);
    setDisplayVal(editVal);
    setEditing(false);
  };

  if (editing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-6 py-2 text-sm font-medium text-gray-600 text-left">{label}</td>
        <td className="px-6 py-2 text-left">
          <div className="flex items-center gap-2">
            <input type="text" value={editVal} onChange={(e) => setEditVal(e.target.value)} className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" autoFocus onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }} />
            <button onClick={handleSave} className="text-[10px] px-2 py-0.5 bg-blue-600 text-white rounded">✓</button>
            <button onClick={() => setEditing(false)} className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded">✕</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 cursor-pointer group" onClick={() => { setEditVal(suggestedValue || displayVal); setEditing(true); }}>
      <td className="px-6 py-3 text-sm font-medium text-gray-600 text-left align-top">
        {label}
        {hasAlert && <span className="ml-1 text-red-500">❗</span>}
      </td>
      <td className="px-6 py-3 text-sm text-gray-900 text-left align-top">
        <span>{displayVal}</span>
        {hasAlert && suggestedValue && suggestedValue !== displayVal && (
          <span className="ml-2 text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded">→ {suggestedValue}</span>
        )}
        <svg className="inline-block ml-2 h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </td>
    </tr>
  );
}

function ToggleSwitch({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`relative w-9 h-5 rounded-full transition-colors ${active ? "bg-red-500" : "bg-gray-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform ${active ? "translate-x-4" : ""}`}></span>
    </button>
  );
}
