import { Suggestion } from "../hooks/useConversation";

interface Props {
  suggestions: Suggestion[];
  onSelect: (text: string) => void;
}

const toneConfig: Record<string, { label: string; icon: string; className: string }> = {
  empathetic: { label: "Empathetic", icon: "😊", className: "tone-empathetic" },
  firm: { label: "Firm", icon: "💪", className: "tone-firm" },
  neutral: { label: "Neutral", icon: "⚖️", className: "tone-neutral" },
};

export default function SuggestionChips({ suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div>
      <div className="flex flex-col gap-2">
        {suggestions.map((s, i) => {
          const config = toneConfig[s.tone] || toneConfig.neutral;
          return (
            <button
              key={i}
              type="button"
              className={`suggestion-chip ${config.className}`}
              onClick={() => onSelect(s.text)}
            >
              <span className="tone-badge">
                {config.icon} {config.label}
              </span>
              <span className="suggestion-text">{s.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
