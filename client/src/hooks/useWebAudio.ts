import { useCallback, useEffect, useRef } from "react";

/* ---------- singletons shared by every component that imports this file ---------- */
const audioCtx = new AudioContext();
const buffers: Record<string, AudioBuffer> = {};

// preload once per page-load
async function loadAll() {
  const sounds: [string, string][] = [
    ["paddle", "/audio/pong/paddle.wav"],
    ["wall", "/audio/pong/wall.wav"],
    ["score", "/audio/pong/score.wav"],
    ["bell", "/audio/bell.mp3"],
    ["ninja", "/audio/ninja/bg2.mp3"],
  ];

  await Promise.all(
    sounds.map(async ([name, url]) => {
      if (buffers[name]) return; // already decoded
      const data = await fetch(url).then((r) => r.arrayBuffer());
      buffers[name] = await audioCtx.decodeAudioData(data);
    })
  );
}

/* ----------------------------------- hook --------------------------------------- */
export function useWebAudio() {
  const current = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // fire-and-forget; errors will surface in the console
    loadAll();
  }, []);

  /* playSound(name) — same API as before */
  return useCallback((name: string) => {
    const buf = buffers[name];
    if (!buf) return; // still loading or bad key

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
    current.current = src;
  }, []);
}

export default useWebAudio;
