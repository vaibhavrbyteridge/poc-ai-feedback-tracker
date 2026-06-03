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

const topPerformerScripts: Record<string, { title: string; examples: string[] }> = {
  intro: {
    title: "Opening & Compliance",
    examples: [
      "Hi, this is [Name] calling from [Company]. This call is an attempt to collect a debt and any information obtained will be used for that purpose. Am I speaking with [Customer Name]?",
      "Good [morning/afternoon]. My name is [Name] with [Company]. I'm calling regarding your account. For verification purposes, can you confirm your date of birth?",
    ],
  },
  probe: {
    title: "Situation Assessment",
    examples: [
      "I see your account is past due. I'd like to understand your situation — has anything changed recently that's made it difficult to keep up with payments?",
      "I appreciate you being upfront with me. Can you walk me through what's been going on financially? That way I can find the best option for you.",
    ],
  },
  negotiate: {
    title: "Payment Arrangement",
    examples: [
      "Based on what you've shared, I can offer a modified plan at $[amount] per month. If you set up autopay today, I can also request a waiver on the late fees. Does that work for you?",
      "I understand $[full amount] is tough right now. What if we split it into [X] payments of $[amount]? I want to find something that keeps your account in good standing.",
    ],
  },
  close: {
    title: "Confirmation & Wrap-up",
    examples: [
      "Great, so to confirm — you'll be paying $[amount] on [date] via [method]. I'll send you a written confirmation by email. Is there anything else I can help with today?",
      "Thank you for working with me on this, [Name]. Your first payment of $[amount] is due [date]. I'll follow up on [date] to make sure everything is on track. Have a good day.",
    ],
  },
};

export default function PhaseTracker({ phaseInfo }: Props) {
  if (!phaseInfo) return null;

  const currentScripts = topPerformerScripts[phaseInfo.current_phase];

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

      {/* Top performer scripts */}
      {currentScripts && (
        <div className="top-performer">
          <div className="top-performer-header">
            <span className="top-performer-icon">💡</span>
            <span className="top-performer-title">Top Performer — {currentScripts.title}</span>
          </div>
          <div className="top-performer-examples">
            {currentScripts.examples.map((example, i) => (
              <p key={i} className="top-performer-example">"{example}"</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
