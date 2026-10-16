"use client";

import React, { useEffect, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  Scissors,
  Trash2,
  Magnet,
  ZoomIn,
  ZoomOut,
  Layers,
  Sparkles,
  LayoutTemplate,
  Rows,
  Maximize2,
  Minimize2,
  Scan,
} from "lucide-react";
import { useEDLStore } from "@/lib/store/useEDLStore";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { secondsToTimecode } from "@/lib/utils/timecode";

export const TimelineControls: React.FC = () => {
  const { workspacePreset, setWorkspacePreset } = useStudioStore();
  const {
    isPlaying,
    togglePlay,
    setPlayheadTime,
    zoom,
    setZoom,
    selectedClipId,
    deleteClip,
    splitClipAtPlayhead,
    snappingEnabled,
    setSnappingEnabled,
    edl,
  } = useEDLStore();

  const timecodeRef = useRef<HTMLSpanElement>(null);

  // Transient subscription: update timecode readout directly without React re-render
  useEffect(() => {
    const unsub = useEDLStore.subscribe((state) => {
      if (timecodeRef.current) {
        timecodeRef.current.textContent = secondsToTimecode(state.playheadTime, state.edl.fps);
      }
    });
    return unsub;
  }, []);

  // Global hotkeys (Space for play, S for split, Del for delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in search input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "KeyS") {
        e.preventDefault();
        splitClipAtPlayhead();
      } else if (e.code === "Delete" || e.code === "Backspace") {
        const id = useEDLStore.getState().selectedClipId;
        if (id) {
          e.preventDefault();
          deleteClip(id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, splitClipAtPlayhead, deleteClip]);

  return (
    <div className="h-10 px-4 bg-studio-950 border-b border-studio-800 flex items-center justify-between text-xs select-none">
      {/* Left: Transport Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setPlayheadTime(0)}
          className="p-1.5 rounded hover:bg-studio-800 text-slate-400 hover:text-white transition"
          title="Rewind to Start (00:00:00:00)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={togglePlay}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition ${
            isPlaying
              ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/20"
              : "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sm shadow-sky-500/20"
          }`}
          title="Play / Pause (Space)"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{isPlaying ? "Pause" : "Play"}</span>
        </button>

        <div className="h-4 w-px bg-studio-800 mx-1" />

        <button
          onClick={() => splitClipAtPlayhead()}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-studio-900 hover:bg-studio-800 text-slate-300 border border-studio-700/60 transition"
          title="Split Clip at Playhead (S)"
        >
          <Scissors className="w-3 h-3 text-sky-400" />
          <span>Split</span>
        </button>

        <button
          onClick={() => selectedClipId && deleteClip(selectedClipId)}
          disabled={!selectedClipId}
          className={`flex items-center gap-1 px-2.5 py-1 rounded border transition ${
            selectedClipId
              ? "bg-studio-900 hover:bg-rose-950/40 text-rose-400 border-rose-800/50"
              : "bg-studio-950 text-slate-600 border-studio-850 cursor-not-allowed"
          }`}
          title="Delete Selected Clip (Del)"
        >
          <Trash2 className="w-3 h-3" />
          <span>Delete</span>
        </button>

        <button
          onClick={() => setSnappingEnabled(!snappingEnabled)}
          className={`p-1.5 rounded border transition ${
            snappingEnabled
              ? "bg-sky-950/40 text-sky-400 border-sky-800/60"
              : "text-slate-500 border-transparent hover:text-slate-300"
          }`}
          title={snappingEnabled ? "Magnetic Snapping Enabled" : "Magnetic Snapping Disabled"}
        >
          <Magnet className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center: SMPTE Timecode Display */}
      <div className="hidden sm:flex items-center gap-2 bg-studio-900 px-3 py-1 rounded-md border border-studio-800 font-mono text-xs">
        <span className="text-[10px] text-slate-500">PLAYHEAD:</span>
        <span ref={timecodeRef} className="font-bold text-sky-300 tracking-wider">
          00:00:00:00
        </span>
        <span className="text-[10px] text-slate-500">/ {secondsToTimecode(edl.duration, edl.fps)}</span>
        <span className="text-[9px] px-1 py-0.2 bg-studio-950 rounded text-slate-400">
          {edl.fps} FPS
        </span>
      </div>

      {/* Right: Workspace Presets & Zoom Controls */}
      <div className="flex items-center gap-2.5">
        {/* Workspace View Presets */}
        <div className="hidden lg:flex items-center bg-studio-900 rounded-md p-0.5 border border-studio-800 text-[10px] font-mono">
          <button
            onClick={() => setWorkspacePreset("balanced")}
            className={`px-2 py-0.5 rounded transition ${
              workspacePreset === "balanced"
                ? "bg-studio-800 text-sky-300 font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
            title="Balanced Studio Workspace"
          >
            Balanced
          </button>
          <button
            onClick={() => setWorkspacePreset("focus_timeline")}
            className={`px-2 py-0.5 rounded transition ${
              workspacePreset === "focus_timeline"
                ? "bg-studio-800 text-sky-300 font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
            title="Focus Timeline (Expanded Multi-Track)"
          >
            Timeline
          </button>
          <button
            onClick={() => setWorkspacePreset("focus_monitor")}
            className={`px-2 py-0.5 rounded transition ${
              workspacePreset === "focus_monitor"
                ? "bg-studio-800 text-sky-300 font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
            title="Focus Monitor (Large Preview)"
          >
            Monitor
          </button>
        </div>

        <div className="hidden lg:block h-3.5 w-px bg-studio-800" />

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoom(zoom - 10)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-studio-850"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <input
            type="range"
            min="15"
            max="150"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-20 h-1 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
            title={`Zoom: ${zoom} px/sec`}
          />

          <button
            onClick={() => setZoom(zoom + 10)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-studio-850"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setZoom(50)}
            className="px-1.5 py-0.5 rounded bg-studio-900 border border-studio-800 text-[10px] text-slate-400 hover:text-white font-mono"
            title="Reset Zoom (Fit)"
          >
            Fit
          </button>
        </div>
      </div>
    </div>
  );
};
