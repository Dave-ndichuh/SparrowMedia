"use client";

import React, { useEffect, useState } from "react";
import {
  SwitcherInputId,
  CompositorLayout,
  useBroadcastStore,
} from "@/lib/store/useBroadcastStore";
import { LayoutGrid, Maximize2, SplitSquareVertical, PictureInPicture2, Volume2, VolumeX } from "lucide-react";

interface MultiBoxCompositorProps {
  layout: CompositorLayout;
  primaryInput: SwitcherInputId;
  secondaryInput?: SwitcherInputId;
  isProgram?: boolean;
  renderFeed: (inputId: SwitcherInputId, isPreview?: boolean) => React.ReactNode;
  showVuMeter?: boolean;
}

export const MultiBoxCompositor: React.FC<MultiBoxCompositorProps> = ({
  layout,
  primaryInput,
  secondaryInput,
  isProgram = false,
  renderFeed,
  showVuMeter = true,
}) => {
  const { audioChannels, masterAudio } = useBroadcastStore();

  // Smart fallback for secondary input if not explicitly provided
  const resolvedSecondaryInput: SwitcherInputId =
    secondaryInput ||
    (primaryInput === "input1_daemon"
      ? "input2_browser"
      : primaryInput === "input2_browser"
      ? "input1_daemon"
      : "input1_daemon");

  // Determine active channel audio for the VU meter
  const primaryAudio = audioChannels[primaryInput];
  const isMuted = isProgram ? masterAudio.muted : primaryAudio?.muted;

  // Simulate audio VU bounce for visual confidence
  const [meterLevels, setMeterLevels] = useState<{ l: number; r: number }>({ l: 0, r: 0 });

  useEffect(() => {
    let animId: number;
    const updateMeter = () => {
      if (isMuted) {
        setMeterLevels({ l: 0, r: 0 });
      } else {
        const volumeFactor = isProgram ? masterAudio.volume : primaryAudio?.volume ?? 0.8;
        // Jitter between -42dB and -3dB, normalized to 0.0 - 1.0
        const base = Math.random() * 0.4 + 0.35;
        const l = Math.min(1.0, Math.max(0, base * volumeFactor + (Math.random() * 0.15 - 0.07)));
        const r = Math.min(1.0, Math.max(0, base * volumeFactor + (Math.random() * 0.15 - 0.07)));
        setMeterLevels({ l, r });
      }
      animId = requestAnimationFrame(updateMeter);
    };

    const interval = setInterval(updateMeter, 80);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animId);
    };
  }, [isMuted, isProgram, masterAudio.volume, primaryAudio?.volume]);

  // Labels for inputs
  const getInputBadge = (id: SwitcherInputId) => {
    switch (id) {
      case "input1_daemon":
        return "CAM 1";
      case "input2_browser":
        return "CAM 2";
      case "input3_timeline":
        return "TIMELINE";
      case "input4_vault":
        return "VAULT";
      default:
        return id;
    }
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden select-none">
      {/* 1. FULL LAYOUT */}
      {layout === "full" && (
        <div className="w-full h-full relative">
          {renderFeed(primaryInput, !isProgram)}
          {/* Subtle Input Tally Overlay Badge */}
          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm border border-slate-700/60 text-[9px] font-mono font-bold tracking-wider text-slate-300">
            {getInputBadge(primaryInput)}
          </div>
        </div>
      )}

      {/* 2. SIDE-BY-SIDE (2-BOX) LAYOUT */}
      {layout === "side_by_side" && (
        <div className="w-full h-full grid grid-cols-2 gap-1 p-1 bg-slate-950">
          {/* Box 1 (Left / Primary) */}
          <div className="relative w-full h-full bg-slate-900 rounded overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {renderFeed(primaryInput, !isProgram)}
            <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded bg-slate-950/85 backdrop-blur border border-slate-700/60 text-[8px] font-mono font-bold text-cyan-400">
              BOX A // {getInputBadge(primaryInput)}
            </div>
          </div>

          {/* Box 2 (Right / Secondary) */}
          <div className="relative w-full h-full bg-slate-900 rounded overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center">
            {renderFeed(resolvedSecondaryInput, !isProgram)}
            <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded bg-slate-950/85 backdrop-blur border border-slate-700/60 text-[8px] font-mono font-bold text-amber-400">
              BOX B // {getInputBadge(resolvedSecondaryInput)}
            </div>
          </div>
        </div>
      )}

      {/* 3. PICTURE-IN-PICTURE BOTTOM RIGHT */}
      {layout === "pip_bottom_right" && (
        <div className="relative w-full h-full">
          {/* Background Primary Feed */}
          <div className="w-full h-full">{renderFeed(primaryInput, !isProgram)}</div>

          {/* Floating Inset Feed (Bottom Right) */}
          <div className="absolute bottom-3 right-3 w-[34%] aspect-video rounded-lg overflow-hidden border-2 border-slate-600/90 shadow-2xl shadow-black/90 z-20 transition-all duration-200">
            {renderFeed(resolvedSecondaryInput, !isProgram)}
            <div className="absolute top-1 left-1 z-10 px-1.5 py-0.2 rounded bg-slate-950/90 text-[8px] font-mono font-black text-amber-300 border border-slate-700/50">
              PiP // {getInputBadge(resolvedSecondaryInput)}
            </div>
          </div>

          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm border border-slate-700/60 text-[9px] font-mono font-bold tracking-wider text-slate-300">
            MAIN // {getInputBadge(primaryInput)}
          </div>
        </div>
      )}

      {/* 4. PICTURE-IN-PICTURE TOP RIGHT */}
      {layout === "pip_top_right" && (
        <div className="relative w-full h-full">
          {/* Background Primary Feed */}
          <div className="w-full h-full">{renderFeed(primaryInput, !isProgram)}</div>

          {/* Floating Inset Feed (Top Right) */}
          <div className="absolute top-3 right-3 w-[34%] aspect-video rounded-lg overflow-hidden border-2 border-slate-600/90 shadow-2xl shadow-black/90 z-20 transition-all duration-200">
            {renderFeed(resolvedSecondaryInput, !isProgram)}
            <div className="absolute top-1 left-1 z-10 px-1.5 py-0.2 rounded bg-slate-950/90 text-[8px] font-mono font-black text-amber-300 border border-slate-700/50">
              PiP // {getInputBadge(resolvedSecondaryInput)}
            </div>
          </div>

          <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-sm border border-slate-700/60 text-[9px] font-mono font-bold tracking-wider text-slate-300">
            MAIN // {getInputBadge(primaryInput)}
          </div>
        </div>
      )}

      {/* MINI LED VU METERS IN MONITOR FRAME */}
      {showVuMeter && (
        <div className="absolute bottom-2 left-2 z-20 pointer-events-none flex items-center gap-1.5 bg-slate-950/90 backdrop-blur-md px-2 py-1 rounded border border-slate-800 shadow-xl">
          {isMuted ? (
            <VolumeX className="w-3 h-3 text-rose-500 animate-pulse" />
          ) : (
            <Volume2
              className={`w-3 h-3 ${isProgram ? "text-rose-400" : "text-emerald-400"}`}
            />
          )}

          <div className="flex flex-col gap-0.5 w-16">
            {/* Left Channel Meter */}
            <div className="h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  meterLevels.l > 0.85
                    ? "bg-rose-500"
                    : meterLevels.l > 0.65
                    ? "bg-amber-400"
                    : isProgram
                    ? "bg-rose-400"
                    : "bg-emerald-400"
                }`}
                style={{ width: `${meterLevels.l * 100}%` }}
              />
            </div>
            {/* Right Channel Meter */}
            <div className="h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden flex">
              <div
                className={`h-full transition-all duration-75 ${
                  meterLevels.r > 0.85
                    ? "bg-rose-500"
                    : meterLevels.r > 0.65
                    ? "bg-amber-400"
                    : isProgram
                    ? "bg-rose-400"
                    : "bg-emerald-400"
                }`}
                style={{ width: `${meterLevels.r * 100}%` }}
              />
            </div>
          </div>

          <span className="text-[8px] font-mono font-black text-slate-400 tracking-tighter">
            {isMuted ? "MUTED" : isProgram ? "PGM" : "PVW"}
          </span>
        </div>
      )}
    </div>
  );
};
