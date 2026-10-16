"use client";

import React, { useState } from "react";
import {
  useBroadcastStore,
  MediaPoolItem,
} from "@/lib/store/useBroadcastStore";
import {
  Sparkles,
  Play,
  Square,
  Zap,
  Music,
  Radio,
  Clock,
  CheckCircle2,
  Volume2,
} from "lucide-react";

export const MiniMediaPool: React.FC = () => {
  const { mediaPool, activeMediaPoolItem, fireMediaPoolItem, stopMediaPoolItem } =
    useBroadcastStore();

  const [activeFilter, setActiveFilter] = useState<"all" | "stinger" | "bumper" | "intro" | "sfx">("all");

  const filteredItems = mediaPool.filter(
    (item) => activeFilter === "all" || item.type === activeFilter
  );

  // Play a quick synthesized studio SFX cue via Web Audio API
  const playWebAudioCue = (type: MediaPoolItem["type"]) => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "stinger") {
        // High-tech frequency sweep
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === "sfx") {
        // Broadcast news chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880, now + 0.1); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        // Bumper / Intro chord
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // Audio context might be restricted before user gesture
    }
  };

  const handleFire = (item: MediaPoolItem) => {
    playWebAudioCue(item.type);
    fireMediaPoolItem(item);
  };

  const getTypeColor = (type: MediaPoolItem["type"]) => {
    switch (type) {
      case "stinger":
        return "bg-indigo-950/80 text-indigo-300 border-indigo-700/60";
      case "intro":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-700/60";
      case "bumper":
        return "bg-amber-950/80 text-amber-300 border-amber-700/60";
      case "sfx":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-700/60";
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Media Pool Header & Filter Chips */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-mono font-bold text-slate-200">
            STINGERS & MEDIA POOL
          </span>
        </div>

        {activeMediaPoolItem && (
          <button
            onClick={stopMediaPoolItem}
            className="px-2 py-0.5 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-[9px] font-mono font-bold flex items-center gap-1"
          >
            <Square className="w-2.5 h-2.5" />
            <span>HALT</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 text-[9px] font-mono">
        {(["all", "stinger", "intro", "bumper", "sfx"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-2 py-0.5 rounded uppercase font-bold transition whitespace-nowrap ${
              activeFilter === filter
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Media Pool Clips List */}
      <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-0.5">
        {filteredItems.map((item) => {
          const isActive = activeMediaPoolItem?.id === item.id;

          return (
            <div
              key={item.id}
              className={`p-2 rounded-lg border transition-all flex items-center justify-between gap-2 ${
                isActive
                  ? "bg-indigo-950/90 border-indigo-500 shadow-md shadow-indigo-950/40"
                  : "bg-slate-950/70 border-slate-800/80 hover:border-slate-700"
              }`}
            >
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-black border uppercase tracking-wider ${getTypeColor(
                      item.type
                    )}`}
                  >
                    {item.badge}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {item.duration.toFixed(1)}s
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-slate-200 truncate">
                  {item.title}
                </span>
              </div>

              {/* Action Trigger Button */}
              <button
                onClick={() => handleFire(item)}
                className={`px-2.5 py-1.5 rounded-md font-mono text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition active:scale-95 flex-shrink-0 ${
                  isActive
                    ? "bg-indigo-500 text-white animate-pulse"
                    : item.type === "stinger"
                    ? "bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white shadow-sm"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-200"
                }`}
              >
                {isActive ? (
                  <>
                    <Zap className="w-3 h-3 text-amber-300" />
                    <span>ON AIR</span>
                  </>
                ) : item.type === "stinger" ? (
                  <>
                    <Zap className="w-3 h-3 text-indigo-300" />
                    <span>STINGER</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3" />
                    <span>FIRE</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
