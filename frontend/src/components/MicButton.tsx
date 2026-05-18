interface Props {
  recording: boolean;
  disabled: boolean;
  onPress: () => void;
  onRelease: () => void;
}

export default function MicButton({
  recording,
  disabled,
  onPress,
  onRelease,
}: Props) {
  return (
    <button
      type="button"
      className={`mic-btn${recording ? " recording" : ""}`}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onPress();
      }}
      onMouseUp={() => {
        if (recording) onRelease();
      }}
      onMouseLeave={() => {
        if (recording) onRelease();
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        if (!disabled) onPress();
      }}
      onTouchEnd={() => {
        if (recording) onRelease();
      }}
    >
      {recording ? "Release to send" : "Hold to talk"}
    </button>
  );
}
