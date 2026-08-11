import { useCallback, useEffect, useRef, useState } from "react";
import {
  blobToBase64,
  connectSession,
  sendUtterance,
  WsInbound,
} from "../api/wsClient";
import { fetchOpeningSuggestions } from "../api/client";

export interface Suggestion {
  text: string;
  tone: "empathetic" | "firm" | "neutral";
}

export interface TranscriptTurn {
  collector: string;
  customer: string;
  suggestions: Suggestion[];
}

export function useConversation(sessionId: string | null) {
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!sessionId) return;

    const socket = connectSession(sessionId, (msg: WsInbound) => {
      if (msg.type === "turn_processing") {
        setProcessing(true);
        setError(null);
        return;
      }
      if (msg.type === "error") {
        setProcessing(false);
        setError(msg.message);
        return;
      }
      if (msg.type === "turn_complete") {
        setProcessing(false);
        setTurns((prev) => [
          ...prev,
          {
            collector: msg.collector_transcript,
            customer: msg.customer_text,
            suggestions: msg.suggestions,
          },
        ]);
        setSuggestions(msg.suggestions);
        playCustomerAudio(
          msg.customer_audio_base64,
          msg.customer_audio_mime,
          msg.customer_text
        );
      }
    });

    socketRef.current = socket;

    // Fetch opening suggestions
    fetchOpeningSuggestions(sessionId)
      .then((data) => {
        setSuggestions(data.suggestions as Suggestion[]);
      })
      .catch(() => {});

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [sessionId]);

  const playCustomerAudio = (
    b64: string,
    mime: string,
    fallbackText: string
  ) => {
    if (!b64) {
      speechSynthesis.speak(new SpeechSynthesisUtterance(fallbackText));
      return;
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime || "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play().catch(() => {
      speechSynthesis.speak(new SpeechSynthesisUtterance(fallbackText));
    });
  };

  const startRecording = useCallback(async () => {
    setError(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
  }, []);

  const stopRecordingAndSend = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || !socketRef.current) return;

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    });

    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });
    chunksRef.current = [];
    recorderRef.current = null;

    if (blob.size === 0) {
      setError("No audio recorded");
      return;
    }

    const base64 = await blobToBase64(blob);
    sendUtterance(
      socketRef.current,
      base64,
      blob.type || "audio/webm"
    );
  }, []);

  return {
    turns,
    processing,
    error,
    suggestions,
    startRecording,
    stopRecordingAndSend,
  };
}
