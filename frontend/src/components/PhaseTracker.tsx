import { PhaseInfo } from "../hooks/useConversation";

interface Props {
  phaseInfo: PhaseInfo | null;
}

const phases = [
  { id: "intro", label: "Intro", icon: "👋" },
  { id: "probe", label: "Probe", icon: "🔍" },
  { id: "negotiate", label: "Negotiate", icon: "🤝" },
  { id: "close", label: "Close", icon: "✅" },
];

export default function PhaseTracker({ phaseInfo }: Props) {
  if (!phaseInfo) return null;

  return (
    <div className="phase-tracker">
      {/* Progress bar */}
      <div className="phase-steps">
        {phases.map((phase, idx) => {
          const isCompleted = phaseInfo.phases_completed.includes(phase.id);
          const isCurrent = phaseInfo.current_phase === phase.id;
          let className = "phase-step";
          if (isCompleted) className += " completed";
          if (isCurrent) className += " current";

          return (
            <div key={phase.id} className={className}>
              <span className="phase-icon">{phase.icon}</span>
              <span className="phase-label">{phase.label}</span>
              {idx < phases.length - 1 && <span className="phase-arrow">→</span>}
            </div>
          );
        })}
      </div>

      {/* Next step guidance */}
      {phaseInfo.next_step && (
        <div className="phase-next-step">
          <span className="next-step-icon">📍</span>
          <span className="next-step-text">{phaseInfo.next_step}</span>
        </div>
      )}

      {/* Alerts */}
      {phaseInfo.alerts.length > 0 && (
        <div className="phase-alerts">
          {phaseInfo.alerts.map((alert, i) => (
            <div key={i} className="phase-alert">
              <span className="alert-icon">⚠️</span>
              <span>{alert}</span>
            </div>
          ))}
        </div>
      )}

      {/* Compliance status */}
      <div className="phase-compliance">
        <span className={phaseInfo.compliance_disclosed ? "check-done" : "check-pending"}>
          {phaseInfo.compliance_disclosed ? "✅" : "⬜"} Compliance disclosure
        </span>
        <span className={phaseInfo.identity_verified ? "check-done" : "check-pending"}>
          {phaseInfo.identity_verified ? "✅" : "⬜"} Identity verified
        </span>
      </div>
    </div>
  );
}
