export type WsInbound =
  | { type: "turn_processing" }
  | {
      type: "turn_complete";
      collector_transcript: string;
      customer_text: string;
      customer_audio_base64: string;
      customer_audio_mime: string;
      suggestions: { text: string; tone: "empathetic" | "firm" | "neutral" }[];
    }
  | { type: "error"; message: string };

export type WsOutbound = {
  type: "collector_utterance";
  audio_base64: string;
  mime: string;
};

function wsUrl(sessionId: string): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${proto}//${host}/ws/${sessionId}`;
}

export function connectSession(
  sessionId: string,
  onMessage: (msg: WsInbound) => void,
  onClose?: () => void
): WebSocket {
  const socket = new WebSocket(wsUrl(sessionId));

  socket.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data) as WsInbound);
    } catch {
      onMessage({ type: "error", message: "Invalid server message" });
    }
  };

  socket.onclose = () => onClose?.();

  return socket;
}

export function sendUtterance(
  socket: WebSocket,
  audioBase64: string,
  mime: string
): void {
  const msg: WsOutbound = {
    type: "collector_utterance",
    audio_base64: audioBase64,
    mime,
  };
  socket.send(JSON.stringify(msg));
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
