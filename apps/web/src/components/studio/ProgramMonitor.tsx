"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Camera,
  Radio,
  Maximize2,
  Volume2,
  VolumeX,
  Wifi,
  Sparkles,
  Layers,
  Settings,
  Film,
  Play,
} from "lucide-react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { useEDLStore } from "@/lib/store/useEDLStore";
import { secondsToTimecode } from "@/lib/utils/timecode";
import { AudioVUMeter } from "./AudioVUMeter";

export const ProgramMonitor: React.FC = () => {
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const timelineVideoRef = useRef<HTMLVideoElement>(null);
  const timelineTimecodeRef = useRef<HTMLSpanElement>(null);
  const currentClipIdRef = useRef<string | null>(null);

  const [monitorMode, setMonitorMode] = useState<"live" | "timeline">("live");

  const {
    activeStream,
    connectionMode,
    activeVideoDevice,
    streamMetrics,
    isAudioMuted,
    setAudioMuted,
    setConnectModalOpen,
  } = useStudioStore();

  // Attach live WebRTC / camera stream
  useEffect(() => {
    if (liveVideoRef.current) {
      if (activeStream) {
        liveVideoRef.current.srcObject = activeStream;
        liveVideoRef.current.play().catch(() => {});
      } else {
        liveVideoRef.current.srcObject = null;
      }
    }
  }, [activeStream]);

  // Zero-Rerender Playhead Sync Engine for Timeline Playback
  useEffect(() => {
    const unsub = useEDLStore.subscribe((state) => {
      const t = state.playheadTime;
      const videoEl = timelineVideoRef.current;

      // Direct textContent update for timecode
      if (timelineTimecodeRef.current) {
        timelineTimecodeRef.current.textContent = secondsToTimecode(t, state.edl.fps);
      }

      if (!videoEl) return;

      // Find top-most active video clip intersecting playhead (V3 -> V2 -> V1)
      const tracks = state.edl.tracks;
      let activeClip = null;

      for (let i = 2; i >= 0; i--) {
        const track = tracks[i];
        if (!track || track.muted) continue;
        const clip = track.clips.find(
          (c) => t >= c.timelineStart && t <= c.timelineStart + c.duration
        );
        if (clip) {
          activeClip = clip;
          break;
        }
      }

      if (activeClip) {
        const targetSrc = activeClip.proxyUrl || "";
        const targetOffset = (t - activeClip.timelineStart) + activeClip.inPoint;

        if (currentClipIdRef.current !== activeClip.id) {
          currentClipIdRef.current = activeClip.id;
          if (videoEl.src !== targetSrc && targetSrc) {
            videoEl.src = targetSrc;
          }
        }

        // Direct seek without React state update
        if (activeClip.fileType === "video" && Math.abs(videoEl.currentTime - targetOffset) > 0.05) {
          videoEl.currentTime = Math.max(0, targetOffset);
        }

        if (state.isPlaying && videoEl.paused) {
          videoEl.play().catch(() => {});
        } else if (!state.isPlaying && !videoEl.paused) {
          videoEl.pause();
        }
      } else {
        currentClipIdRef.current = null;
        if (!videoEl.paused) videoEl.pause();
      }
    });

    return unsub;
  }, []);

  const toggleFullscreen = () => {
    const target = monitorMode === "live" ? liveVideoRef.current : timelineVideoRef.current;
    if (target) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        target.requestFullscreen();
      }
    }
  };

  const isLiveConnected = connectionMode !== "disconnected" && activeStream !== null;

  return (
    <div className="relative w-full h-full flex flex-col bg-studio-950 rounded-xl border border-studio-800/80 shadow-2xl overflow-hidden group">
      {/* Top Monitor Bar / Broadcast Tally HUD */}
      <div className="flex items-center justify-between px-4 py-2 bg-studio-900/90 border-b border-studio-800/70 backdrop-blur z-10 text-xs">
        <div className="flex items-center gap-2">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center bg-studio-950 rounded-lg p-0.5 border border-studio-800 text-[11px] font-mono">
            <button
              onClick={() => setMonitorMode("live")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                monitorMode === "live"
                  ? "bg-studio-800 text-sky-300 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Radio className="w-3 h-3 text-rose-500" />
              <span>LIVE CAM</span>
            </button>

            <button
              onClick={() => setMonitorMode("timeline")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                monitorMode === "timeline"
                  ? "bg-studio-800 text-sky-300 font-bold shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Film className="w-3 h-3 text-sky-400" />
              <span>NLE TIMELINE</span>
            </button>
          </div>

          {/* Mode-Specific Status Pill */}
          {monitorMode === "live" ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-studio-950 border border-studio-700/60 font-mono text-[10px]">
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveConnected ? "bg-rose-500 tally-pulse-live" : "bg-slate-500"
                }`}
              />
              <span className={`font-bold ${isLiveConnected ? "text-rose-400" : "text-slate-400"}`}>
                {isLiveConnected ? "PROGRAM FEED" : "STANDBY"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-studio-950 border border-studio-700/60 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="font-bold text-sky-300">TIMELINE PROGRAM</span>
            </div>
          )}

          {monitorMode === "live" && isLiveConnected && (
            <div className="hidden sm:flex items-center gap-1.5 text-slate-300 font-mono text-[10px] bg-studio-850 px-2 py-0.5 rounded border border-studio-700/50">
              <Camera className="w-3 h-3 text-sky-400" />
              <span className="truncate max-w-[140px]">
                {activeVideoDevice?.name || "Active Feed"}
              </span>
            </div>
          )}
        </div>

        {/* Right Telemetry / Timecode Readout */}
        <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
          {monitorMode === "live" ? (
            isLiveConnected ? (
              <>
                <div className="flex items-center gap-1 text-emerald-400 text-[10px]">
                  <Wifi className="w-3 h-3" />
                  <span>{streamMetrics.latencyMs > 0 ? `${streamMetrics.latencyMs}ms` : "< 30ms"}</span>
                </div>
                <div className="px-2 py-0.5 bg-studio-800 rounded border border-studio-700/50 text-slate-200 text-[10px]">
                  1080p @ {streamMetrics.fps || 60}fps
                </div>
              </>
            ) : (
              <span className="text-slate-500 italic text-[10px]">No hardware feed locked</span>
            )
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500">NLE TC:</span>
              <span
                ref={timelineTimecodeRef}
                className="px-2 py-0.5 bg-studio-800 rounded border border-studio-700/50 text-sky-300 font-bold"
              >
                00:00:00:00
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Viewport & Integrated Audio VU Tower */}
      <div className="relative flex-1 flex bg-black items-stretch overflow-hidden">
        {/* Video Screen Area */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {monitorMode === "live" ? (
            /* Live Hardware Camera View */
            isLiveConnected ? (
              <video
                ref={liveVideoRef}
                autoPlay
                playsInline
                muted={isAudioMuted}
                className="w-full h-full object-contain bg-black"
              />
            ) : (
              /* Standby State with In-Place Connect CTA */
              <div className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
                <div className="relative mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-studio-900 border border-studio-700/80 flex items-center justify-center">
                    <Radio className="w-7 h-7 text-sky-400 animate-pulse" />
                  </div>
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-studio-950" />
                </div>

                <h3 className="text-sm font-semibold text-white tracking-wide mb-1">
                  No Video Feed Connected
                </h3>
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                  Connect an HDMI capture card, webcam, or switch to the <strong>NLE Timeline</strong> tab above.
                </p>

                <button
                  onClick={() => setConnectModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition shadow-md shadow-sky-500/20 active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Connect Hardware / Camera</span>
                </button>
              </div>
            )
          ) : (
            /* Timeline NLE Program View */
            <video
              ref={timelineVideoRef}
              playsInline
              muted={isAudioMuted}
              className="w-full h-full object-contain bg-black"
            />
          )}
        </div>
      </div>

      {/* Bottom Monitor Control Deck */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-studio-900/95 border-t border-studio-800/80 text-slate-400 text-xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAudioMuted(!isAudioMuted)}
            className={`p-1 rounded hover:bg-studio-800 transition ${
              isAudioMuted ? "text-rose-400" : "text-slate-300"
            }`}
            title={isAudioMuted ? "Unmute Monitor" : "Mute Monitor"}
          >
            {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <span className="text-[10px] text-slate-400 font-mono">16:9 PROD CANVAS</span>
        </div>

        <div className="flex items-center gap-2">
          {monitorMode === "live" && (
            <button
              onClick={() => setConnectModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-0.5 bg-studio-800 hover:bg-studio-700 text-slate-200 rounded text-[11px] transition border border-studio-700/60"
            >
              <Settings className="w-3 h-3 text-slate-400" />
              <span>Switch Feed</span>
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-1 rounded hover:bg-studio-800 text-slate-300 transition"
            title="Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
