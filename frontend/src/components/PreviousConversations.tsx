import { useState } from "react";
import { ConversationLog, fetchCustomerConversations } from "../api/client";

interface Props {
  customerId: string;
  customerName: string;
}

export default function PreviousConversations({ customerId, customerName }: Props) {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomerConversations(customerId);
      setConversations(data);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div>
      <button
        type="button"
        className="prev-conv-btn"
        onClick={handleOpen}
        disabled={loading}
      >
        {loading ? "Loading…" : open ? "Hide previous conversations" : "📋 Previous conversations"}
      </button>

      {error && <p className="error">{error}</p>}

      {open && (
        <div className="prev-conv-panel">
          {conversations.length === 0 ? (
            <p style={{ color: "#6b7280", margin: "0.5rem 0" }}>
              No previous conversations with {customerName}.
            </p>
          ) : (
            conversations.map((conv) => (
              <details key={conv.session_id} className="conv-session">
                <summary className="conv-summary">
                  <span>{formatDate(conv.created_at)}</span>
                  <span className="conv-meta">
                    {conv.personality_id} · {conv.turn_count} turns
                  </span>
                </summary>
                <div className="conv-turns">
                  {conv.turns.map((turn) => (
                    <div key={turn.turn_number} className="conv-turn">
                      <div className="turn-collector">
                        <strong>Collector:</strong> {turn.collector_transcript}
                      </div>
                      <div className="turn-customer">
                        <strong>Customer:</strong> {turn.customer_text}
                      </div>
                      {turn.suggestions.length > 0 && (
                        <div className="conv-suggestions">
                          <span className="conv-suggestions-label">Suggestions:</span>
                          {turn.suggestions.map((s, i) => (
                            <span key={i} className={`conv-chip tone-${s.tone}`}>
                              {s.text}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            ))
          )}
        </div>
      )}
    </div>
  );
}
