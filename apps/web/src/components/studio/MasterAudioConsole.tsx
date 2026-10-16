"use client";

import React from "react";
import {
  Volume2,
  VolumeX,
  Activity,
  Cpu,
  Wifi,
  Sliders,
  Radio,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { AudioVUMeter } from "./AudioVUMeter";

interface MasterAudioConsoleProps {
  onClose?: () => void;
}

export const MasterAudioConsole: React.FC<MasterAudioConsoleProps> = ({ onClose }) => {
  const {
    activeStream,
    isAudioMuted,
    setAudioMuted,
    masterVolume,
    setMasterVolume,
    streamMetrics,
    daemonStatus,
    setConnectModalOpen,
  } = useStudioStore();

  return (
    <div className="flex flex-col h-full w-full bg-studio-950 rounded-xl border border-studio-800/90 shadow-2xl overflow-hidden select-none">
      {/* 1. MASTER AUDIO BUS HEADER */}
      <div className="p-3 border-b border-studio-800/80 bg-studio-900/90 flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-bold tracking-wider text-slate-200 text-[11px] uppercase">
              MASTER AUDIO BUS
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setAudioMuted(!isAudioMuted)}
              className={`p-1 rounded transition ${
                isAudioMuted
                  ? "bg-rose-950/60 text-rose-400 border border-rose-800/60"
                  : "text-slate-400 hover:text-white hover:bg-studio-800"
              }`}
              title={isAudioMuted ? "Unmute Master Audio" : "Mute Master Audio"}
            >
              {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Master Volume Fader Slider */}
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400 pt-0.5">
          <span className="w-6 text-slate-500">VOL</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isAudioMuted ? 0 : masterVolume}
            onChange={(e) => {
              if (isAudioMuted) setAudioMuted(false);
              setMasterVolume(Number(e.target.value));
            }}
            className="flex-1 h-1 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
          />
          <span className="w-9 text-right font-bold text-slate-300">
            {isAudioMuted ? "0%" : `${Math.round(masterVolume * 100)}%`}
          </span>
        </div>

        {/* Audio VU Meter Display */}
        <div className="pt-1">
          <AudioVUMeter stream={activeStream} height={60} showLabels={true} orientation="horizontal" />
        </div>
      </div>

      {/* 2. NLE ENGINE STATUS */}
      <div className="flex-1 p-3 flex flex-col justify-between overflow-y-auto space-y-3 min-h-0 bg-studio-950/80">
        <div>
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2 font-mono">
            NLE ENGINE STATUS
          </span>

          <div className="space-y-1.5">
            <div className="p-2 rounded-lg bg-studio-900 border border-studio-800 text-[11px] flex items-center justify-between">
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-mono block">Canvas Engine</span>
                <span className="text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  60 FPS Hardware 2D
                </span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono border border-emerald-800/40">
                ACTIVE
              </span>
            </div>

            <div className="p-2 rounded-lg bg-studio-900 border border-studio-800 text-[11px] flex items-center justify-between">
              <div>
                <span className="text-[9px] text-slate-500 uppercase font-mono block">Agent Pipeline</span>
                <span className="text-sky-300 font-mono font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  LangGraph Supervisor
                </span>
              </div>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 font-mono border border-sky-800/40">
                READY
              </span>
            </div>
          </div>
        </div>

        {/* 3. HARDWARE BRIDGE & TELEMETRY */}
        <div className="pt-2 border-t border-studio-800/80">
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2 font-mono">
            HARDWARE & TELEMETRY
          </span>

          <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
            <div className="p-2 rounded bg-studio-900 border border-studio-800">
              <span className="text-[8px] text-slate-500 uppercase block">Bridge</span>
              <span className="text-slate-300 font-bold truncate block">
                {daemonStatus?.online ? "8765 WebRTC" : "Ready (8765)"}
              </span>
            </div>

            <div className="p-2 rounded bg-studio-900 border border-studio-800">
              <span className="text-[8px] text-slate-500 uppercase block">Latency</span>
              <span className="text-emerald-400 font-bold block">
                {streamMetrics.latencyMs > 0 ? `${streamMetrics.latencyMs}ms` : "< 30ms"}
              </span>
            </div>

            <div className="p-2 rounded bg-studio-900 border border-studio-800">
              <span className="text-[8px] text-slate-500 uppercase block">Render Mode</span>
              <span className="text-slate-300 block">1080p @ 60fps</span>
            </div>

            <div className="p-2 rounded bg-studio-900 border border-studio-800">
              <span className="text-[8px] text-slate-500 uppercase block">Audio Routing</span>
              <span className="text-indigo-300 font-bold block">Ch 1/2 Master</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
