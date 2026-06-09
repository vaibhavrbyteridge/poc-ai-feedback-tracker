import { useState } from "react";
import { SessionInfo } from "../api/client";
import { useConversation } from "../hooks/useConversation";
import MicButton from "./MicButton";
import SuggestionChips from "./SuggestionChips";
import ClassificationBadge from "./ClassificationBadge";
import PhaseTracker from "./PhaseTracker";

interface Props {
  session: SessionInfo;
}

export default function CallSimulator({ session }: Props) {
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState("");

  const {
    turns,
    processing,
    error,
    suggestions,
    classification,
    phaseInfo,
    startRecording,
    stopRecordingAndSend,
  } = useConversation(session.session_id);

  const handleMicPress = async () => {
    setRecording(true);
    await startRecording();
  };

  const handleMicRelease = async () => {
    setRecording(false);
    await stopRecordingAndSend();
  };

  return (
    <div className="space-y-4">
      {/* Session Info */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>Personality: <strong className="text-gray-700 capitalize">{session.personality_id}</strong></span>
        <span>·</span>
        <span>{session.company_name}</span>
      </div>

      {/* Two-column layout: Left = Call flow, Right = Scripts + Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left Column — Call Flow (3/5 width) */}
        <div className="lg:col-span-3 space-y-4">

          {/* Classification Badge */}
          {classification && (
            <ClassificationBadge
              classification={classification}
              sessionId={session.session_id}
              turnNumber={turns.length}
            />
          )}

          {/* Phase Tracker */}
          {phaseInfo && <PhaseTracker phaseInfo={phaseInfo} />}

          {/* Transcript */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 min-h-[220px] max-h-[380px] overflow-y-auto">
            {turns.length === 0 && !processing && (
              <p className="text-gray-400 text-sm text-center py-8">
                Press and hold the mic button to speak. The AI customer will respond.
              </p>
            )}
            {turns.map((turn, i) => (
              <div key={i} className="mb-4">
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-xs font-bold text-blue-700 uppercase w-20 shrink-0 pt-0.5">Collector</span>
                  <p className="text-sm text-gray-800">{turn.collector}</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xs font-bold text-purple-700 uppercase w-20 shrink-0 pt-0.5">Customer</span>
                  <p className="text-sm text-gray-700">{turn.customer}</p>
                </div>
              </div>
            ))}
            {processing && (
              <div className="flex items-center gap-2 text-yellow-600 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                Processing turn…
              </div>
            )}
          </div>

          {/* Mic Button */}
          <div className="flex items-center gap-4">
            <MicButton
              recording={recording}
              disabled={processing}
              onPress={handleMicPress}
              onRelease={handleMicRelease}
            />
            {error && <span className="text-red-500 text-sm">{error}</span>}
          </div>

          {/* Draft */}
          {draft && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-blue-700 mb-1">Selected suggestion (copy to use)</h4>
              <p className="text-sm text-gray-800">{draft}</p>
            </div>
          )}
        </div>

        {/* Right Column — Scripts + Suggestions (2/5 width) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Top Performer Scripts */}
          {phaseInfo && (
            <TopPerformerPanel currentPhase={phaseInfo.current_phase} />
          )}

          {/* AI Suggestions */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              AI Suggestions
            </h4>
            {suggestions.length > 0 ? (
              <SuggestionChips suggestions={suggestions} onSelect={setDraft} />
            ) : (
              <p className="text-gray-400 text-sm text-center py-4">
                Suggestions will appear here once the call begins.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* Top Performer Scripts Panel */
const topPerformerScripts: Record<string, { title: string; sections: { heading: string; text: string }[] }> = {
  intro: {
    title: "Opening & Compliance",
    sections: [
      { heading: "Opening", text: "Hi, this is [Name] calling from [Company]. This call is an attempt to collect a debt and any information obtained will be used for that purpose. Am I speaking with [Customer Name]?" },
      { heading: "Disclosure", text: "I found [outstanding debt/amount]. My name is [Name] with [Company]." },
      { heading: "", text: "I'm calling regarding your account. For verification purposes, can you confirm your date of birth?" },
    ],
  },
  probe: {
    title: "Situation Assessment",
    sections: [
      { heading: "Assess", text: "I see your account is past due. I'd like to understand your situation — has anything changed recently that's made it difficult to keep up with payments?" },
      { heading: "Empathize", text: "I appreciate you being upfront with me. Can you walk me through what's been going on financially? That way I can find the best option for you." },
    ],
  },
  negotiate: {
    title: "Payment Arrangement",
    sections: [
      { heading: "Offer", text: "Based on what you've shared, I can offer a modified plan at $[amount] per month. If you set up autopay today, I can also request a waiver on the late fees." },
      { heading: "Counter", text: "I understand $[full amount] is tough right now. What if we split it into [X] payments of $[amount]? I want to find something that keeps your account in good standing." },
    ],
  },
  close: {
    title: "Confirmation & Wrap-up",
    sections: [
      { heading: "Confirm", text: "Great, so to confirm — you'll be paying $[amount] on [date] via [method]. I'll send you a written confirmation by email." },
      { heading: "Close", text: "Thank you for working with me on this, [Name]. Your first payment of $[amount] is due [date]. I'll follow up on [date] to make sure everything is on track." },
    ],
  },
};

function TopPerformerPanel({ currentPhase }: { currentPhase: string }) {
  const scripts = topPerformerScripts[currentPhase];
  if (!scripts) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
        <span className="text-amber-500">🏆</span>
        Top Performer – {scripts.title}
      </h4>
      <div className="space-y-3">
        {scripts.sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <p className="text-xs font-bold text-gray-600 mb-1">{section.heading}</p>
            )}
            <p className="text-sm text-gray-600 italic leading-relaxed">{section.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
