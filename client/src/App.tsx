import { useCallback, useRef, useState } from "react";
import { HappyRobotVoiceClient } from "@happyrobot-ai/sdk/voice";
import type { VoiceConnection } from "@happyrobot-ai/sdk/voice";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? (import.meta.env.DEV ? "http://localhost:3001" : "");
const BONPREU_SCREENSHOT = "/bonpreu.png";

type CallStatus = "idle" | "connecting" | "connected";

export function App() {
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const connectionRef = useRef<VoiceConnection | null>(null);

  const startCall = useCallback(async () => {
    setErrorMessage("");
    setCallStatus("connecting");

    try {
      const response = await fetch(`${SERVER_URL}/api/voice/token`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "No s'ha pogut iniciar la trucada.");
      }

      const { url, token } = await response.json();
      const voiceClient = new HappyRobotVoiceClient({ url, token });

      const connection = await voiceClient.connect({
        onConnected: () => setCallStatus("connected"),
        onDisconnected: () => {
          setCallStatus("idle");
          setIsMuted(false);
          connectionRef.current = null;
        },
        onAgentConnected: (participant) => {
          console.info("Agent joined:", participant.identity);
        },
        onError: (err) => {
          console.error("Voice error:", err);
          setErrorMessage("La trucada ha tingut un problema. Torna-ho a provar.");
          setCallStatus("idle");
        },
      });

      connectionRef.current = connection;
    } catch (err) {
      console.error("Failed to start call:", err);
      setErrorMessage(err instanceof Error ? err.message : "No s'ha pogut connectar amb l'assistent.");
      setCallStatus("idle");
    }
  }, []);

  const endCall = useCallback(async () => {
    await connectionRef.current?.disconnect();
    connectionRef.current = null;
    setCallStatus("idle");
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(async () => {
    if (!connectionRef.current) return;

    if (isMuted) {
      await connectionRef.current.unmute();
      setIsMuted(false);
    } else {
      await connectionRef.current.mute();
      setIsMuted(true);
    }
  }, [isMuted]);

  return (
    <main className="exact-page">
      <div className="bonpreu-canvas">
        <img src={BONPREU_SCREENSHOT} alt="BonpreuEsclat online" />

        <section className="voice-overlay" aria-live="polite" aria-label="HappyRobot voice call">
          {callStatus !== "connected" ? (
            <button className="voice-button" onClick={startCall} disabled={callStatus === "connecting"}>
              {callStatus === "connecting" ? "Connectant..." : "Truca ara"}
            </button>
          ) : (
            <>
              <button className="voice-button secondary" onClick={toggleMute}>
                {isMuted ? "Activa micro" : "Silencia"}
              </button>
              <button className="voice-button end" onClick={endCall}>
                Penja
              </button>
            </>
          )}
          {errorMessage ? <p className="voice-error">{errorMessage}</p> : null}
        </section>
      </div>
    </main>
  );
}
