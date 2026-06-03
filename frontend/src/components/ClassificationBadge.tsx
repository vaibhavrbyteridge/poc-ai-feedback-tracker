import { useState } from "react";
import { Classification } from "../hooks/useConversation";
import { overrideClassification } from "../api/client";

interface Props {
  classification: Classification | null;
  sessionId: string;
  turnNumber: number;
}

const categories = [
  { id: "financial_hardship", label: "Financial Hardship", icon: "💸" },
  { id: "intentional_delay", label: "Intentional Delay", icon: "⏳" },
  { id: "dispute", label: "Dispute", icon: "⚠️" },
  { id: "confusion", label: "Confusion", icon: "❓" },
  { id: "cooperative", label: "Cooperative", icon: "🤝" },
];

const categoryConfig: Record<string, { label: string; icon: string; className: string }> = {
  financial_hardship: { label: "Financial Hardship", icon: "💸", className: "cls-hardship" },
  intentional_delay: { label: "Intentional Delay", icon: "⏳", className: "cls-delay" },
  dispute: { label: "Dispute", icon: "⚠️", className: "cls-dispute" },
  confusion: { label: "Confusion", icon: "❓", className: "cls-confusion" },
  cooperative: { label: "Cooperative", icon: "🤝", className: "cls-cooperative" },
};

export default function ClassificationBadge({ classification, sessionId, turnNumber }: Props) {
  const [overridden, setOverridden] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!classification || !classification.classification) return null;

  const activeClassification = overridden || classification.classification;
  const config = categoryConfig[activeClassification] || {
    label: activeClassification,
    icon: "🏷️",
    className: "cls-default",
  };

  const confidencePct = Math.round(classification.confidence * 100);

  const handleOverride = async (newClassification: string) => {
    if (newClassification === activeClassification) return;
    setSaving(true);
    try {
      await overrideClassification(sessionId, turnNumber, newClassification);
      setOverridden(newClassification);
    } catch (e) {
      console.error("Override failed:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`classification-badge ${config.className}`}>
      <div className="cls-header">
        <span className="cls-icon">{config.icon}</span>
        <span className="cls-label">
          {config.label}
          {overridden && <span className="cls-overridden">(overridden)</span>}
        </span>
        {!overridden && <span className="cls-confidence">{confidencePct}%</span>}
      </div>
      {classification.reasoning && !overridden && (
        <p className="cls-reasoning">{classification.reasoning}</p>
      )}
      <div className="cls-override">
        <label className="cls-override-label">
          {overridden ? "Change:" : "Override:"}
        </label>
        <select
          className="cls-override-select"
          value={activeClassification}
          onChange={(e) => handleOverride(e.target.value)}
          disabled={saving}
        >
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.icon} {cat.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
