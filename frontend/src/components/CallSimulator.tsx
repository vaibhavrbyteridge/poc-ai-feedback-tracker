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
        <span>Personality: <strong className="text-gray-700">{session.personality_id}</strong></span>
        <span>·</span>
        <span>{session.company_name}</span>
      </div>

      {/* Phase Tracker */}
      {phaseInfo && <PhaseTracker phaseInfo={phaseInfo} />}

      {/* Transcript */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 min-h-[200px] max-h-[360px] overflow-y-auto">
        {turns.length === 0 && !processing && (
          <p className="text-gray-400 text-sm text-center py-8">
            Press and hold the mic button to speak. The AI customer will respond.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="mb-4">
            <div className="flex items-start gap-2 mb-1">
              <span className="text-xs font-semibold text-blue-600 uppercase w-20 shrink-0">Collector:</span>
              <p className="text-sm text-gray-800">{turn.collector}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-purple-600 uppercase w-20 shrink-0">Customer:</span>
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

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">AI Suggestions</h4>
          <SuggestionChips suggestions={suggestions} onSelect={setDraft} />
        </div>
      )}

      {/* Classification */}
      {classification && (
        <ClassificationBadge
          classification={classification}
          sessionId={session.session_id}
          turnNumber={turns.length}
        />
      )}

      {/* Draft */}
      {draft && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-blue-700 mb-1">Selected suggestion (copy to use)</h4>
          <p className="text-sm text-gray-800">{draft}</p>
        </div>
      )}
    </div>
  );
}
