import { TranscriptTurn } from "../hooks/useConversation";

interface Props {
  turns: TranscriptTurn[];
}

export default function TranscriptPanel({ turns }: Props) {
  return (
    <div className="card transcript">
      <h2>Transcript</h2>
      {turns.length === 0 && (
        <p style={{ color: "#6b7280" }}>
          Hold the mic button to speak as the collector.
        </p>
      )}
      {turns.map((t, i) => (
        <div key={i} className="turn">
          <div className="turn-collector">
            <strong>Collector:</strong> {t.collector}
          </div>
          <div className="turn-customer">
            <strong>Customer:</strong> {t.customer}
          </div>
        </div>
      ))}
    </div>
  );
}
