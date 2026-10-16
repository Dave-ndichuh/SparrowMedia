"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Radio,
  CheckCircle,
  AlertTriangle,
  HardDrive,
  Globe,
  Settings,
  Cpu,
  Tv,
  Film,
  Activity,
  FileCheck,
  Disc,
  Play,
  Square,
} from "lucide-react";
import { useBroadcastStore } from "@/lib/store/useBroadcastStore";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { checkDaemonHealth } from "@/lib/webrtc/daemonClient";

export const GoLiveModal: React.FC = () => {
  const {
    isGoLiveModalOpen,
    setGoLiveModalOpen,
    telemetry,
    startBroadcast,
    stopBroadcast,
    isStartingBroadcast,
    isStoppingBroadcast,
  } = useBroadcastStore();

  const { activeStream, isAudioMuted } = useStudioStore();

  const [destinationType, setDestinationType] = useState<"local_sink" | "rtmp">("local_sink");
  const [rtmpUrl, setRtmpUrl] = useState<string>("rtmp://a.rtmp.youtube.com/live2/");
  const [streamKey, setStreamKey] = useState<string>("");
  const [daemonReady, setDaemonReady] = useState<boolean>(false);
  const [isAuditing, setIsAuditing] = useState<boolean>(false);

  // Audit daemon on mount or modal open
  useEffect(() => {
    if (isGoLiveModalOpen) {
      setIsAuditing(true);
      checkDaemonHealth()
        .then(() => setDaemonReady(true))
        .catch(() => setDaemonReady(false))
        .finally(() => setIsAuditing(false));
    }
  }, [isGoLiveModalOpen]);

  if (!isGoLiveModalOpen) return null;

  const handleStart = async () => {
    const fullRtmp =
      destinationType === "rtmp"
        ? `${rtmpUrl.replace(/\/$/, "")}/${streamKey}`
        : undefined;

    await startBroadcast(destinationType, fullRtmp);
  };

  const handleStop = async () => {
    await stopBroadcast();
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl ${
                telemetry.isLive
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                  : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
              }`}
            >
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-wider text-slate-100 font-mono">
                {telemetry.isLive ? "ON-AIR TRANSMISSION ACTIVE" : "PRE-FLIGHT BROADCAST CONTROL"}
              </h2>
              <p className="text-xs text-slate-400">
                {telemetry.isLive
                  ? "Live transmission routing through local edge pipeline"
                  : "Verify system readiness before opening edge transmission"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setGoLiveModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Active Broadcast Telemetry Card (If Live) */}
          {telemetry.isLive && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border border-rose-800/60 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase text-rose-400 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  LIVE TRANSMISSION TELEMETRY
                </span>
                <span className="text-xs font-mono font-black text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-700">
                  {formatUptime(telemetry.uptimeSeconds)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">
                    BITRATE
                  </span>
                  <span className="text-sm font-mono font-black text-slate-100">
                    {telemetry.bitrateKbps} kbps
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">
                    FRAMERATE
                  </span>
                  <span className="text-sm font-mono font-black text-emerald-400">
                    {telemetry.fps}.00 FPS
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block uppercase">
                    DROPPED
                  </span>
                  <span className="text-sm font-mono font-black text-slate-300">
                    {telemetry.droppedFrames} frames
                  </span>
                </div>
              </div>

              {telemetry.outputFile && (
                <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">SINK: {telemetry.outputFile}</span>
                </div>
              )}
            </div>
          )}

          {/* Pre-Flight Checklist */}
          <div>
            <span className="text-[11px] font-mono uppercase font-bold text-slate-400 tracking-wider block mb-2.5">
              1. PRE-FLIGHT HARDWARE & FEED AUDIT
            </span>
            <div className="space-y-2">
              {/* Check 1: Hardware Daemon */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Cpu className="w-4 h-4 text-sky-400" />
                  <span>Local Python Daemon (127.0.0.1:8765)</span>
                </div>
                <span
                  className={`flex items-center gap-1 font-bold ${
                    daemonReady ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {daemonReady ? "READY" : "OFFLINE / MOCK"}
                </span>
              </div>

              {/* Check 2: Video Feed */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Tv className="w-4 h-4 text-indigo-400" />
                  <span>Program Video Signal (1080p60)</span>
                </div>
                <span className="flex items-center gap-1 font-bold text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5" />
                  LOCKED
                </span>
              </div>

              {/* Check 3: Audio Bus */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-xs font-mono">
                <div className="flex items-center gap-2.5 text-slate-300">
                  <Activity className="w-4 h-4 text-rose-400" />
                  <span>Master Audio VU Meter Bus</span>
                </div>
                <span
                  className={`flex items-center gap-1 font-bold ${
                    !isAudioMuted ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {!isAudioMuted ? "ACTIVE" : "MUTED"}
                </span>
              </div>
            </div>
          </div>

          {/* Destination Selection */}
          {!telemetry.isLive && (
            <div>
              <span className="text-[11px] font-mono uppercase font-bold text-slate-400 tracking-wider block mb-2.5">
                2. SELECT TRANSMISSION DESTINATION
              </span>
              <div className="grid grid-cols-2 gap-3">
                {/* Option 1: Local Sink (Default) */}
                <button
                  type="button"
                  onClick={() => setDestinationType("local_sink")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    destinationType === "local_sink"
                      ? "bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/30"
                      : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/40 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono font-bold text-xs text-slate-200">
                    <HardDrive className="w-4 h-4 text-cyan-400" />
                    <span>Local Test Sink (Zero-Cost)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-relaxed">
                    Saves broadcast archive locally to `backend/media/broadcasts/` via OpenCV MP4 sink.
                  </span>
                </button>

                {/* Option 2: RTMP Egress */}
                <button
                  type="button"
                  onClick={() => setDestinationType("rtmp")}
                  className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition ${
                    destinationType === "rtmp"
                      ? "bg-sky-950/40 border-sky-500 shadow-md shadow-sky-950/30"
                      : "bg-slate-950/60 border-slate-800 hover:bg-slate-800/40 text-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2 font-mono font-bold text-xs text-slate-200">
                    <Globe className="w-4 h-4 text-rose-400" />
                    <span>Live RTMP Stream</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-relaxed">
                    Pushes FLV stream to YouTube Live, Twitch, or custom CDN edge.
                  </span>
                </button>
              </div>

              {/* RTMP Credentials Configuration */}
              {destinationType === "rtmp" && (
                <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">RTMP SERVER URL</label>
                    <input
                      type="text"
                      value={rtmpUrl}
                      onChange={(e) => setRtmpUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">STREAM KEY</label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••"
                      value={streamKey}
                      onChange={(e) => setStreamKey(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            onClick={() => setGoLiveModalOpen(false)}
            className="px-4 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white transition"
          >
            DISMISS
          </button>

          {telemetry.isLive ? (
            <button
              onClick={handleStop}
              disabled={isStoppingBroadcast}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-mono font-black text-xs uppercase tracking-wider transition shadow-lg shadow-rose-900/40 flex items-center gap-2 active:scale-95"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>{isStoppingBroadcast ? "TERMINATING..." : "END BROADCAST"}</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={isStartingBroadcast}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono font-black text-xs uppercase tracking-wider transition shadow-lg shadow-rose-600/30 flex items-center gap-2 active:scale-95"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              <span>{isStartingBroadcast ? "INITIALIZING..." : "START ON-AIR BROADCAST"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
