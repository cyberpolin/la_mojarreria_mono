let audioContext: AudioContext | null = null;

function getAudioContext() {
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new Ctor();
  }
  return audioContext;
}

export function unlockIncomingSound() {
  const context = getAudioContext();
  if (context?.state === "suspended") {
    void context.resume();
  }
}

export function playIncomingSound() {
  const context = getAudioContext();
  if (!context) return;
  if (context.state === "suspended") {
    void context.resume();
  }

  const playTone = (frequency: number, start: number, duration: number) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  };

  const now = context.currentTime;
  playTone(880, now, 0.12);
  playTone(1174, now + 0.13, 0.16);
}
