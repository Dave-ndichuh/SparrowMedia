"use client";

import React, { useEffect, useRef, useState } from "react";

interface AudioVUMeterProps {
  stream: MediaStream | null;
  orientation?: "vertical" | "horizontal";
  height?: number | string;
  width?: number | string;
  showLabels?: boolean;
}

export const AudioVUMeter: React.FC<AudioVUMeterProps> = ({
  stream,
  orientation = "horizontal",
  height,
  width,
  showLabels = true,
}) => {
  const [leftDb, setLeftDb] = useState<number>(-60);
  const [rightDb, setRightDb] = useState<number>(-60);
  const [peakDb, setPeakDb] = useState<number>(-60);
  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) {
      setLeftDb(-60);
      setRightDb(-60);
      setPeakDb(-60);
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        analyser.getByteFrequencyData(dataArray);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const normalized = Math.min(100, (rms / 128) * 100);

        // Convert roughly to dB
        const db = normalized > 0 ? 20 * Math.log10(normalized / 100) : -60;
        const clampedDb = Math.max(-60, Math.min(0, db));

        setLeftDb(clampedDb);
        setRightDb(clampedDb * 0.95);
        setPeakDb((prev) => Math.max(prev - 0.5, clampedDb));

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      animFrameRef.current = requestAnimationFrame(updateMeter);

      return () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        if (ctx.state !== "closed") {
          ctx.close();
        }
      };
    } catch (err) {
      console.warn("Could not start Web Audio analyser", err);
    }
  }, [stream]);

  // Convert dB to percentage (0% at -60dB, 100% at 0dB)
  const dbToPercent = (db: number) => {
    return Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
  };

  const leftPercent = dbToPercent(leftDb);
  const rightPercent = dbToPercent(rightDb);

  if (orientation === "vertical") {
    return (
      <div className="flex flex-col h-full items-center justify-between p-2 bg-studio-950/90 rounded-lg border border-studio-800/80 font-mono text-[9px] select-none min-w-[48px]">
        <div className="text-[9px] font-bold text-slate-400 mb-1 tracking-tighter">VU</div>

        {/* Vertical Dual Towers */}
        <div className="flex-1 flex items-stretch gap-1.5 min-h-[100px] w-full px-1">
          {/* Left Channel */}
          <div className="relative flex-1 bg-studio-900 rounded-sm overflow-hidden flex flex-col justify-end border border-studio-800/80">
            <div
              className={`w-full transition-all duration-75 ${
                leftPercent > 85
                  ? "bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                  : leftPercent > 65
                  ? "bg-gradient-to-t from-emerald-500 to-amber-400"
                  : "bg-emerald-500"
              }`}
              style={{ height: `${leftPercent}%` }}
            />
          </div>

          {/* Right Channel */}
          <div className="relative flex-1 bg-studio-900 rounded-sm overflow-hidden flex flex-col justify-end border border-studio-800/80">
            <div
              className={`w-full transition-all duration-75 ${
                rightPercent > 85
                  ? "bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500"
                  : rightPercent > 65
                  ? "bg-gradient-to-t from-emerald-500 to-amber-400"
                  : "bg-emerald-500"
              }`}
              style={{ height: `${rightPercent}%` }}
            />
          </div>

          {/* dB Scale Labels */}
          {showLabels && (
            <div className="flex flex-col justify-between text-[8px] text-slate-500 font-mono pl-0.5 select-none leading-none py-0.5">
              <span className="text-amber-400 font-bold">0</span>
              <span>-6</span>
              <span>-12</span>
              <span>-24</span>
              <span>-36</span>
              <span>-60</span>
            </div>
          )}
        </div>

        <div className="flex justify-between w-full px-1 pt-1.5 text-[8px] text-slate-500 font-mono font-bold">
          <span>L</span>
          <span>R</span>
        </div>
      </div>
    );
  }

  // Horizontal Compact Mode
  return (
    <div className="flex flex-col gap-1 p-2 bg-studio-950/80 rounded-lg border border-studio-800/80 font-mono text-xs select-none">
      <div className="flex items-center justify-between text-[10px] text-slate-400 pb-0.5">
        <span className="font-semibold text-slate-300">AUDIO VU</span>
        <span className="text-slate-400 tabular-nums">{peakDb.toFixed(1)} dB</span>
      </div>

      {/* Dual Channel Bars */}
      <div className="flex gap-1.5 items-center">
        <span className="text-[10px] text-slate-500 w-3 font-bold">L</span>
        <div className="relative flex-1 h-2 bg-studio-900 rounded-sm overflow-hidden border border-studio-800/80">
          <div
            className={`h-full transition-all duration-75 rounded-sm ${
              leftPercent > 85
                ? "bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                : leftPercent > 65
                ? "bg-gradient-to-r from-emerald-500 to-amber-400"
                : "bg-emerald-500"
            }`}
            style={{ width: `${leftPercent}%` }}
          />
        </div>
      </div>

      <div className="flex gap-1.5 items-center">
        <span className="text-[10px] text-slate-500 w-3 font-bold">R</span>
        <div className="relative flex-1 h-2 bg-studio-900 rounded-sm overflow-hidden border border-studio-800/80">
          <div
            className={`h-full transition-all duration-75 rounded-sm ${
              rightPercent > 85
                ? "bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500"
                : rightPercent > 65
                ? "bg-gradient-to-r from-emerald-500 to-amber-400"
                : "bg-emerald-500"
            }`}
            style={{ width: `${rightPercent}%` }}
          />
        </div>
      </div>

      {showLabels && (
        <div className="flex justify-between text-[8px] text-slate-500 px-4 pt-0.5">
          <span>-60</span>
          <span>-36</span>
          <span>-24</span>
          <span>-12</span>
          <span>-6</span>
          <span className="text-amber-500 font-bold">0dB</span>
        </div>
      )}
    </div>
  );
};
