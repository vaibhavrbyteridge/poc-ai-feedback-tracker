import { useState, useEffect } from "react";
import { SessionInfo } from "../api/client";
import { useConversation, TranscriptTurn } from "../hooks/useConversation";
import MicButton from "./MicButton";
import SuggestionChips from "./SuggestionChips";

interface Props {
  session: SessionInfo;
  onTranscriptUpdate?: (turns: TranscriptTurn[]) => void;
}

export default function CallSimulator({ session, onTranscriptUpdate }: Props) {
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState("");

  const {
    turns,
    processing,
    error,
    suggestions,
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

  useEffect(() => {
    if (onTranscriptUpdate) {
      onTranscriptUpdate(turns);
    }
  }, [turns, onTranscriptUpdate]);

  return (
    <div className="space-y-4">
      {/* Session Info */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <span>Personality: <strong className="text-gray-700 capitalize">{session.personality_id}</strong></span>
        <span>·</span>
        <span>{session.company_name}</span>
      </div>

      {/* Two-column layout: Left = Call flow, Right = Suggestions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left Column — Call Flow (3/5 width) */}
        <div className="lg:col-span-3 space-y-4">

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

        {/* Right Column — Suggestions (2/5 width) */}
        <div className="lg:col-span-2 space-y-4">

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
