// Messages vocaux et talkie-walkie des salons (docs/chat.md).
// Enregistrement court et léger (Opus 12 kbit/s quand c'est possible) :
// 30 s ≈ 45 Ko, assez petit pour les relais Nostr et le Bluetooth.
import { MAX_AUDIO_MS, type Audio as Clip } from "./p2p-chat";

const BITRATE = 12_000;
const TYPES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"];

export const voiceSupported = () =>
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;

export interface Recording {
  /** Arrête et renvoie le son (null si trop court ou vide). */
  stop(): Promise<Clip | null>;
  /** Arrête sans rien garder. */
  cancel(): void;
  /** Durée écoulée (ms). */
  elapsed(): number;
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Démarre l'enregistrement au micro ; s'arrête seul à `maxMs`
 * (`onLimit` est alors appelé, la suite passe par stop()).
 */
export async function startRecording(
  maxMs = MAX_AUDIO_MS,
  onLimit?: () => void,
): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
  });
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: BITRATE,
  });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const started = Date.now();
  let ended = Date.now();
  const done = new Promise<void>((resolve) => {
    recorder.onstop = () => {
      ended = Date.now();
      stream.getTracks().forEach((t) => t.stop());
      resolve();
    };
  });
  recorder.start();
  const limit = setTimeout(() => {
    if (recorder.state === "recording") recorder.stop();
    onLimit?.();
  }, maxMs);

  return {
    elapsed: () => (recorder.state === "recording" ? Date.now() : ended) - started,
    cancel() {
      clearTimeout(limit);
      chunks.length = 0;
      if (recorder.state === "recording") recorder.stop();
    },
    async stop() {
      clearTimeout(limit);
      if (recorder.state === "recording") recorder.stop();
      await done;
      const ms = Math.min(ended - started, maxMs);
      if (ms < 500 || chunks.length === 0) return null;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      const data = toBase64(new Uint8Array(await blob.arrayBuffer()));
      return { mime: blob.type.replace(/\s+/g, ""), data, ms };
    },
  };
}

/** Adresse lisible par <audio> pour un vocal reçu. */
export const audioSrc = (a: Clip) => `data:${a.mime.split(";")[0]};base64,${a.data}`;

/** Joue les vocaux un par un (talkie-walkie). */
export function createPlayer() {
  const queue: Clip[] = [];
  let playing: HTMLAudioElement | null = null;
  const next = () => {
    const a = queue.shift();
    if (!a) {
      playing = null;
      return;
    }
    playing = new Audio(audioSrc(a));
    playing.onended = next;
    playing.onerror = next;
    void playing.play().catch(next);
  };
  return {
    play(a: Clip) {
      queue.push(a);
      if (!playing) next();
    },
    stop() {
      queue.length = 0;
      playing?.pause();
      playing = null;
    },
  };
}
