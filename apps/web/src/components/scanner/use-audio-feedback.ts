"use client";

import { useCallback, useEffect, useRef } from "react";

export function useAudioFeedback(enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null);

  const getOrCreateContext = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) {
      return null;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtor();
    }

    return audioContextRef.current;
  }, []);

  const resumeContext = useCallback(() => {
    const context = getOrCreateContext();
    if (context?.state === "suspended") {
      void context.resume().catch((error: unknown) => {
        console.error("No se pudo reanudar el contexto de audio:", error);
      });
    }
    return context;
  }, [getOrCreateContext]);

  const ensureContext = useCallback(
    () => (enabled ? resumeContext() : null),
    [enabled, resumeContext],
  );

  const playTone = useCallback((
    type: OscillatorType,
    frequency: number,
    durationMs: number,
    volume = 0.04,
    endFrequency?: number,
  ) => {
    const context = ensureContext();
    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + durationMs / 1000);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + durationMs / 1000);
  }, [ensureContext]);

  const playSuccess = useCallback(() => {
    playTone("sine", 880, 100, 0.04, 1320);
  }, [playTone]);

  const playError = useCallback(() => {
    playTone("sawtooth", 180, 180, 0.05, 120);
  }, [playTone]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, []);

  return { activateAudio: resumeContext, playSuccess, playError };
}
