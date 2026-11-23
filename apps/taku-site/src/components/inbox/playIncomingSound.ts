import { useEffect } from "react";

const SOUND_UNLOCK_KEY = "TAKU_INCOMING_SOUND_UNLOCKED";

let audioEl: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let unlocked = false;

function writeString(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function createNotificationWavUrl() {
  const sampleRate = 22050;
  const duration = 0.36;
  const sampleCount = Math.floor(sampleRate * duration);
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, sampleCount * 2, true);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const frequency = t < 0.14 ? 980 : 1318;
    const attack = Math.min(1, t * 50);
    const release = Math.min(1, (duration - t) * 18);
    const sample =
      Math.sin(2 * Math.PI * frequency * t) * attack * release * 0.85;
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true);
  }

  const blob = new Blob([buffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function getAudioElement() {
  if (audioEl) return audioEl;
  objectUrl = createNotificationWavUrl();
  audioEl = new Audio(objectUrl);
  audioEl.preload = "auto";
  audioEl.volume = 1;
  return audioEl;
}

function markUnlocked() {
  unlocked = true;
  try {
    window.sessionStorage.setItem(SOUND_UNLOCK_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function isIncomingSoundUnlocked() {
  if (unlocked) return true;
  try {
    return window.sessionStorage.getItem(SOUND_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

export function unlockIncomingSound() {
  const audio = getAudioElement();
  audio.muted = true;
  const play = audio.play();
  if (play) {
    void play
      .then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        markUnlocked();
      })
      .catch(() => {
        audio.muted = false;
      });
  }
}

export function playIncomingSound() {
  const audio = getAudioElement();
  audio.muted = false;
  audio.currentTime = 0;
  const play = audio.play();
  if (play) {
    void play
      .then(() => {
        markUnlocked();
      })
      .catch(() => {
        unlockIncomingSound();
      });
  }
}

export function useArmIncomingSound() {
  useEffect(() => {
    const arm = () => unlockIncomingSound();
    window.addEventListener("pointerdown", arm, { once: true });
    window.addEventListener("keydown", arm, { once: true });
    window.addEventListener("touchstart", arm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
      window.removeEventListener("touchstart", arm);
    };
  }, []);
}
