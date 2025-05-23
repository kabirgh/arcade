import { useEffect, useRef } from "react";

const useWebAudio = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<{ [key: string]: AudioBuffer }>({});
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    audioContextRef.current = new window.AudioContext();

    const loadSound = async (url: string, name: string) => {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current!.decodeAudioData(
        arrayBuffer
      );
      audioBuffersRef.current[name] = audioBuffer;
    };

    loadSound("/audio/pong/paddle.wav", "paddle");
    loadSound("/audio/pong/wall.wav", "wall");
    loadSound("/audio/pong/score.wav", "score");
    loadSound("/audio/bell.mp3", "bell");

    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const playSound = (sound: string) => {
    if (audioContextRef.current && audioBuffersRef.current[sound]) {
      // Stop currently playing sound if any
      if (currentSourceRef.current) {
        try {
          currentSourceRef.current.stop();
        } catch {
          // Ignore errors if source is already stopped
        }
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffersRef.current[sound];
      source.connect(audioContextRef.current.destination);

      // Clear the reference when the sound ends
      source.onended = () => {
        currentSourceRef.current = null;
      };

      source.start(0);
      currentSourceRef.current = source;
    }
  };

  return playSound;
};

export default useWebAudio;
