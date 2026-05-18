import { useState } from "react";
import { SessionInfo } from "./api/client";
import SessionSetup from "./components/SessionSetup";
import TranscriptPanel from "./components/TranscriptPanel";
import MicButton from "./components/MicButton";
import SuggestionChips from "./components/SuggestionChips";
import { useConversation } from "./hooks/useConversation";

export default function App() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState("");

  const {
    turns,
    processing,
    error,
    suggestions,
    startRecording,
    stopRecordingAndSend,
  } = useConversation(session?.session_id ?? null);

  if (!session) {
    return (
      <div className="app-layout">
        <h1>Debt Collection Simulator</h1>
        <SessionSetup onSession={setSession} />
      </div>
    );
  }

  const handleMicPress = async () => {
    setRecording(true);
    await startRecording();
  };

  const handleMicRelease = async () => {
    setRecording(false);
    await stopRecordingAndSend();
  };

  return (
    <div className="app-layout">
      <h1>Call — {session.customer_name}</h1>
      <p style={{ color: "#6b7280", margin: 0 }}>
        Personality: {session.personality_id} · {session.company_name}
      </p>

      <TranscriptPanel turns={turns} />

      <div className="card mic-row">
        <MicButton
          recording={recording}
          disabled={processing}
          onPress={handleMicPress}
          onRelease={handleMicRelease}
        />
        {processing && <span className="processing">Processing turn…</span>}
        {error && <span className="error">{error}</span>}
      </div>

      <SuggestionChips suggestions={suggestions} onSelect={setDraft} />

      {draft && (
        <div className="card">
          <h2>Draft (copy to use)</h2>
          <p style={{ margin: 0 }}>{draft}</p>
        </div>
      )}

      <button
        type="button"
        style={{
          background: "transparent",
          border: "1px solid #2d3a4d",
          color: "#a8b0ba",
          padding: "0.5rem",
          borderRadius: 6,
        }}
        onClick={() => setSession(null)}
      >
        End session
      </button>
    </div>
  );
}
