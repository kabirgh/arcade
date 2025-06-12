import { useCallback, useEffect } from "react";

import { perceptualToAmplitude } from "../util/perceptual";

/* ---------- singletons shared by every component that imports this file ---------- */
const audioCtx = new AudioContext();
const buffers: Record<string, AudioBuffer> = {};
let isLoading = true;
let loadingPromise: Promise<void> | null = null;

// Queue for sounds requested before loading is complete
const pendingQueue: Array<{
  name: string;
  options: { loop?: boolean; volume?: number };
  resolve: (stopFn: () => void) => void;
}> = [];

// preload once per page-load
async function loadAll() {
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const sounds: [string, string][] = [
      ["paddle", "/audio/pong/paddle.wav"],
      ["wall", "/audio/pong/wall.wav"],
      ["score", "/audio/pong/score.wav"],
      ["bell", "/audio/bell.mp3"],
      ["ninja/bg", "/audio/ninja/bg2.mp3"],
      ["boat/bg", "/audio/boat/bg.mp3"],
      ["boat/quack", "/audio/boat/quack.mp3"],
    ];

    await Promise.all(
      sounds.map(async ([name, url]) => {
        if (buffers[name]) return; // already decoded
        const data = await fetch(url).then((r) => r.arrayBuffer());
        buffers[name] = await audioCtx.decodeAudioData(data);
      })
    );

    isLoading = false;

    // Process queued sounds
    while (pendingQueue.length > 0) {
      const { name, options, resolve } = pendingQueue.shift()!;
      const stopFn = playSound(name, options);
      resolve(stopFn);
    }
  })();

  return loadingPromise;
}

// Helper function to actually play a sound
function playSound(
  name: string,
  options: { loop?: boolean; volume?: number } = { loop: false, volume: 1 }
): () => void {
  if (!buffers[name]) return () => {}; // bad key

  const buf = buffers[name];
  if (!buf) return () => {}; // bad key

  const src = audioCtx.createBufferSource();
  const gainNode = audioCtx.createGain();

  src.buffer = buf;
  src.loop = options.loop ?? false;

  // Set volume using perceptual scaling (default to 100% if not specified)
  const volume = options.volume ?? 1;
  const amplitude = perceptualToAmplitude(volume);
  gainNode.gain.value = amplitude; // Convert back to 0-1 range for Web Audio API

  // Connect: source -> gain -> destination
  src.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  src.start();

  // Return a function to stop the sound
  return () => {
    try {
      src.stop();
      src.disconnect();
      gainNode.disconnect();
    } catch {
      // Already stopped/disconnected
    }
  };
}

/* ----------------------------------- hook --------------------------------------- */
export function useWebAudio() {
  useEffect(() => {
    // fire-and-forget; errors will surface in the console
    loadAll();
  }, []);

  return useCallback(
    (
      name: string,
      options: { loop?: boolean; volume?: number } = {
        loop: false,
        volume: 1,
      }
    ) => {
      if (!isLoading) {
        // Buffers are ready, play immediately
        const stopFn = playSound(name, options);
        return stopFn;
      } else {
        // Buffers not ready, queue the request
        let stopped = false;
        let actualStopFn: (() => void) | null = null;

        const queuedRequest = {
          name,
          options,
          resolve: (stopFn: () => void) => {
            if (!stopped) {
              actualStopFn = stopFn;
            } else {
              // Sound was stopped before it could play
              stopFn();
            }
          },
        };

        pendingQueue.push(queuedRequest);

        // Return a stop function that works even for queued sounds
        return () => {
          stopped = true;
          if (actualStopFn) {
            actualStopFn();
          } else {
            // Remove from queue if it hasn't been processed yet
            const index = pendingQueue.indexOf(queuedRequest);
            if (index > -1) {
              pendingQueue.splice(index, 1);
            }
          }
        };
      }
    },
    []
  );
}

export default useWebAudio;
