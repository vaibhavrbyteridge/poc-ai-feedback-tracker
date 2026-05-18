interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
}

export default function SuggestionChips({ suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="card">
      <h2>Suggested responses</h2>
      <div className="suggestions">
        {suggestions.map((s, i) => (
          <button
            key={i}
            type="button"
            className="suggestion-chip"
            onClick={() => onSelect(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
