"use client";

import React, { useEffect, useState } from "react";
import {
  useBroadcastStore,
  SwitcherInputId,
} from "@/lib/store/useBroadcastStore";
import {
  Volume2,
  VolumeX,
  Radio,
  Sliders,
  Camera,
  Video,
  Film,
  FileVideo,
  Headphones,
  Zap,
} from "lucide-react";

interface AudioStripConfig {
  id: SwitcherInputId;
  label: string;
  source: string;
  icon: React.ReactNode;
}

const CHANNELS: AudioStripConfig[] = [
  {
    id: "input1_daemon",
    label: "CAM 1",
    source: "Daemon Mic",
    icon: <Camera className="w-3.5 h-3.5" />,
  },
  {
    id: "input2_browser",
    label: "CAM 2",
    source: "Webcam / Desk",
    icon: <Video className="w-3.5 h-3.5" />,
  },
  {
    id: "input3_timeline",
    label: "TIMELINE",
    source: "NLE Master",
    icon: <Film className="w-3.5 h-3.5" />,
  },
  {
    id: "input4_vault",
    label: "VAULT",
    source: "Clip Audio",
    icon: <FileVideo className="w-3.5 h-3.5" />,
  },
];

export const LiveAudioMixer: React.FC = () => {
  const {
    previewInput,
    programInput,
    inTransition,
    audioChannels,
    masterAudio,
    setInputVolume,
    toggleInputMute,
    toggleInputAFV,
    setMasterAudioVolume,
    toggleMasterAudioMute,
  } = useBroadcastStore();

  // Simulated live peak meter level animations for each channel
  const [channelPeaks, setChannelPeaks] = useState<Record<string, number>>({
    input1_daemon: 0,
    input2_browser: 0,
    input3_timeline: 0,
    input4_vault: 0,
    master: 0,
  });

  useEffect(() => {
    let animId: number;

    const updateMeters = () => {
      const newPeaks: Record<string, number> = {};
      let totalPgmLevel = 0;
      let activePgmChannels = 0;

      CHANNELS.forEach((ch) => {
        const config = audioChannels[ch.id];
        const isLiveOnAir = programInput === ch.id;
        const isQueued = previewInput === ch.id;

        // If AFV is active and channel is NOT on air and not in transition, mute signal
        const isSuppressedByAFV = config.afv && !isLiveOnAir && !(inTransition && isQueued);

        if (config.muted || isSuppressedByAFV || config.volume === 0) {
          newPeaks[ch.id] = 0;
        } else {
          // Dynamic jitter based on volume
          const base = 0.45 + Math.random() * 0.35;
          const level = Math.min(1.0, Math.max(0, base * (config.volume / 1.0)));
          newPeaks[ch.id] = level;

          if (isLiveOnAir || (inTransition && isQueued)) {
            totalPgmLevel += level * config.volume;
            activePgmChannels++;
          }
        }
      });

      if (masterAudio.muted || masterAudio.volume === 0 || activePgmChannels === 0) {
        newPeaks["master"] = 0;
      } else {
        const avg = (totalPgmLevel / activePgmChannels) * (masterAudio.volume / 1.0);
        newPeaks["master"] = Math.min(1.0, Math.max(0, avg + (Math.random() * 0.1 - 0.05)));
      }

      setChannelPeaks(newPeaks);
      animId = requestAnimationFrame(updateMeters);
    };

    const interval = setInterval(updateMeters, 100);
    return () => {
      clearInterval(interval);
      cancelAnimationFrame(animId);
    };
  }, [audioChannels, masterAudio, programInput, previewInput, inTransition]);

  const formatDb = (volume: number) => {
    if (volume === 0) return "-INF";
    const db = (volume - 0.85) * 20;
    return `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`;
  };

  return (
    <div className="bg-slate-900/90 rounded-xl border border-slate-800 p-3 sm:p-4 shadow-lg flex flex-col gap-3">
      {/* Mixer Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-mono font-black tracking-wider uppercase text-slate-200">
            LIVE AUDIO MIXER
          </span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-[9px] font-mono text-cyan-300">
            4-CH + AFV ENGINE
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-bold">AFV: EQUAL-POWER CROSSFADE</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1">
            <Headphones className="w-3 h-3 text-slate-400" />
            <span>SOLO BUS: PGM</span>
          </div>
        </div>
      </div>

      {/* Channel Strips Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 items-stretch">
        {/* 4 Input Strips */}
        {CHANNELS.map((ch) => {
          const config = audioChannels[ch.id];
          const isLiveOnAir = programInput === ch.id;
          const isQueued = previewInput === ch.id;
          const peak = channelPeaks[ch.id] || 0;

          return (
            <div
              key={ch.id}
              className={`rounded-lg border p-2.5 flex flex-col justify-between gap-2.5 transition-all ${
                isLiveOnAir
                  ? "bg-slate-950/90 border-rose-500/70 shadow-md shadow-rose-950/20"
                  : isQueued
                  ? "bg-slate-950/70 border-emerald-500/50"
                  : "bg-slate-950/50 border-slate-800/80"
              }`}
            >
              {/* Channel Label & Tally Pill */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`p-1 rounded ${
                      isLiveOnAir
                        ? "bg-rose-500/20 text-rose-400"
                        : isQueued
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {ch.icon}
                  </div>
                  <div>
                    <span className="text-[11px] font-mono font-bold text-slate-200 block leading-tight">
                      {ch.label}
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 block leading-tight">
                      {ch.source}
                    </span>
                  </div>
                </div>

                {/* Tally Badge */}
                {isLiveOnAir && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[8px] font-mono font-black">
                    ON AIR
                  </span>
                )}
                {!isLiveOnAir && isQueued && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600/80 text-white text-[8px] font-mono font-black">
                    PVW
                  </span>
                )}
              </div>

              {/* Fader & Dual-LED Peak Meter Row */}
              <div className="flex items-center gap-2">
                {/* Vertical Segmented LED Meter */}
                <div className="flex gap-0.5 h-20 w-3 bg-slate-900 rounded p-0.5 border border-slate-800">
                  <div className="flex-1 flex flex-col-reverse gap-0.5">
                    {Array.from({ length: 12 }).map((_, i) => {
                      const threshold = (i + 1) / 12;
                      const isLit = peak >= threshold;
                      const isClip = i >= 10;
                      const isWarn = i >= 8 && i < 10;
                      return (
                        <div
                          key={i}
                          className={`w-full flex-1 rounded-[1px] transition-colors ${
                            !isLit
                              ? "bg-slate-800/40"
                              : isClip
                              ? "bg-rose-500 shadow-[0_0_4px_#f43f5e]"
                              : isWarn
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Vertical Volume Slider Controls */}
                <div className="flex-1 flex flex-col justify-between h-20 py-1">
                  <div className="flex items-center justify-between text-[9px] font-mono">
                    <span className="text-slate-400">GAIN:</span>
                    <span
                      className={`font-bold ${
                        config.volume > 1.0
                          ? "text-rose-400"
                          : config.volume === 0
                          ? "text-slate-600"
                          : "text-cyan-400"
                      }`}
                    >
                      {formatDb(config.volume)}
                    </span>
                  </div>

                  {/* Range Slider */}
                  <input
                    type="range"
                    min="0"
                    max="1.2"
                    step="0.02"
                    value={config.volume}
                    onChange={(e) => setInputVolume(ch.id, parseFloat(e.target.value))}
                    disabled={config.muted}
                    className="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded cursor-pointer disabled:opacity-40"
                  />

                  <div className="flex justify-between text-[8px] font-mono text-slate-500">
                    <span>-INF</span>
                    <span>0dB</span>
                    <span>+2dB</span>
                  </div>
                </div>
              </div>

              {/* Toggles: AFV and MUTE */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800/80">
                {/* AFV Toggle */}
                <button
                  onClick={() => toggleInputAFV(ch.id)}
                  title="Audio Follows Video: Automatically crossfades when video transitions"
                  className={`py-1 px-1 rounded text-[9px] font-mono font-bold tracking-wider flex items-center justify-center gap-1 transition ${
                    config.afv
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm"
                      : "bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Zap className={`w-2.5 h-2.5 ${config.afv ? "text-cyan-400" : ""}`} />
                  <span>{config.afv ? "AFV ON" : "AFV"}</span>
                </button>

                {/* MUTE Toggle */}
                <button
                  onClick={() => toggleInputMute(ch.id)}
                  className={`py-1 px-1 rounded text-[9px] font-mono font-bold tracking-wider flex items-center justify-center gap-1 transition ${
                    config.muted
                      ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                      : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {config.muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                  <span>{config.muted ? "MUTED" : "MUTE"}</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* 5th Strip: MASTER AUDIO BUS */}
        <div className="rounded-lg border border-amber-500/50 bg-gradient-to-b from-slate-950/90 to-amber-950/20 p-2.5 flex flex-col justify-between gap-2.5 shadow-md">
          {/* Master Label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded bg-amber-500/20 text-amber-400">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div>
                <span className="text-[11px] font-mono font-black text-amber-300 block leading-tight">
                  MASTER PGM
                </span>
                <span className="text-[8px] font-mono text-amber-500/80 block leading-tight">
                  Main Broadcast Bus
                </span>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[8px] font-mono font-bold">
              MASTER
            </span>
          </div>

          {/* Fader & Dual Stereo Master LED Meter */}
          <div className="flex items-center gap-2">
            {/* Stereo L/R Meters */}
            <div className="flex gap-0.5 h-20 w-4 bg-slate-900 rounded p-0.5 border border-slate-800">
              {/* L */}
              <div className="flex-1 flex flex-col-reverse gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => {
                  const threshold = (i + 1) / 12;
                  const isLit = channelPeaks.master >= threshold;
                  const isClip = i >= 10;
                  const isWarn = i >= 8 && i < 10;
                  return (
                    <div
                      key={`l-${i}`}
                      className={`w-full flex-1 rounded-[1px] transition-colors ${
                        !isLit
                          ? "bg-slate-800/40"
                          : isClip
                          ? "bg-rose-500 shadow-[0_0_4px_#f43f5e]"
                          : isWarn
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                    />
                  );
                })}
              </div>
              {/* R */}
              <div className="flex-1 flex flex-col-reverse gap-0.5">
                {Array.from({ length: 12 }).map((_, i) => {
                  const threshold = (i + 1) / 12;
                  const isLit = (channelPeaks.master * 0.96) >= threshold;
                  const isClip = i >= 10;
                  const isWarn = i >= 8 && i < 10;
                  return (
                    <div
                      key={`r-${i}`}
                      className={`w-full flex-1 rounded-[1px] transition-colors ${
                        !isLit
                          ? "bg-slate-800/40"
                          : isClip
                          ? "bg-rose-500 shadow-[0_0_4px_#f43f5e]"
                          : isWarn
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Master Slider */}
            <div className="flex-1 flex flex-col justify-between h-20 py-1">
              <div className="flex items-center justify-between text-[9px] font-mono">
                <span className="text-slate-400">OUT GAIN:</span>
                <span className="text-amber-400 font-bold">
                  {formatDb(masterAudio.volume)}
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1.2"
                step="0.02"
                value={masterAudio.volume}
                onChange={(e) => setMasterAudioVolume(parseFloat(e.target.value))}
                disabled={masterAudio.muted}
                className="w-full accent-amber-400 bg-slate-800 h-1.5 rounded cursor-pointer disabled:opacity-40"
              />

              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                <span>-INF</span>
                <span>0dB</span>
                <span>+2dB</span>
              </div>
            </div>
          </div>

          {/* Master MUTE */}
          <div className="pt-1 border-t border-slate-800/80">
            <button
              onClick={toggleMasterAudioMute}
              className={`w-full py-1 rounded text-[9px] font-mono font-bold tracking-wider flex items-center justify-center gap-1.5 transition ${
                masterAudio.muted
                  ? "bg-rose-600 text-white shadow-md shadow-rose-950/40"
                  : "bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
              }`}
            >
              {masterAudio.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3 text-amber-400" />}
              <span>{masterAudio.muted ? "MASTER MUTED" : "MUTE MASTER"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
