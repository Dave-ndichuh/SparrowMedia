"use client";

import React from "react";
import { Radio, AlertCircle } from "lucide-react";
import { useBroadcastStore, LowerThirdConfig } from "@/lib/store/useBroadcastStore";

interface GraphicsCompositorProps {
  className?: string;
  hideStationBug?: boolean;
  hideLowerThird?: boolean;
  hideTicker?: boolean;
}

export const GraphicsCompositor: React.FC<GraphicsCompositorProps> = ({
  className = "",
  hideStationBug = false,
  hideLowerThird = false,
  hideTicker = false,
}) => {
  const { graphics, telemetry } = useBroadcastStore();
  const { lowerThird, stationBug, ticker } = graphics;

  const getThemeClasses = (theme: LowerThirdConfig["theme"]) => {
    switch (theme) {
      case "navy_cyan":
        return {
          bar: "bg-cyan-500",
          card: "bg-gradient-to-r from-slate-950/95 via-sky-950/90 to-slate-950/80 border-l-4 border-cyan-400 text-slate-100",
          tag: "bg-cyan-950/80 text-cyan-300 border-cyan-800/60",
          accent: "text-cyan-400",
        };
      case "crimson":
        return {
          bar: "bg-rose-500",
          card: "bg-gradient-to-r from-slate-950/95 via-rose-950/90 to-slate-950/80 border-l-4 border-rose-500 text-slate-100",
          tag: "bg-rose-950/80 text-rose-300 border-rose-800/60",
          accent: "text-rose-400",
        };
      case "amber":
        return {
          bar: "bg-amber-500",
          card: "bg-gradient-to-r from-slate-950/95 via-amber-950/90 to-slate-950/80 border-l-4 border-amber-400 text-slate-100",
          tag: "bg-amber-950/80 text-amber-300 border-amber-800/60",
          accent: "text-amber-400",
        };
      default:
        return {
          bar: "bg-slate-400",
          card: "bg-gradient-to-r from-slate-900/95 to-slate-950/90 border-l-4 border-slate-400 text-slate-100",
          tag: "bg-slate-800 text-slate-300 border-slate-700",
          accent: "text-slate-300",
        };
    }
  };

  const themeStyle = getThemeClasses(lowerThird.theme);

  return (
    <div
      className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-10 flex flex-col justify-between ${className}`}
    >
      {/* Top Layer: Station Bug / On-Air Callout */}
      <div className="p-3 sm:p-4 flex items-start justify-between">
        <div /> {/* Left spacer */}
        {stationBug.enabled && !hideStationBug && (
          <div className="flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-xl shadow-black/40">
            {/* Live Indicator */}
            {stationBug.isLivePulse && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-600/30 border border-rose-500/50">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-mono font-black text-rose-300 tracking-widest uppercase">
                  {telemetry.isLive ? "ON AIR" : "FEED"}
                </span>
              </div>
            )}

            {/* Callsign */}
            <div className="flex flex-col">
              <span className="text-[11px] font-black tracking-widest text-slate-100 font-mono">
                {stationBug.callsign}
              </span>
              <span className="text-[8px] font-mono text-slate-400 tracking-wider">
                {stationBug.location}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Layer: Lower-Third & News Ticker */}
      <div className="flex flex-col gap-2">
        {/* DSK 1: Animated Lower-Third Graphic */}
        {lowerThird.enabled && !hideLowerThird && (
          <div className="px-4 pb-1 transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-4">
            <div
              className={`max-w-xl backdrop-blur-md px-4 py-2.5 rounded-r-lg shadow-2xl shadow-black/70 border border-slate-800/80 ${themeStyle.card}`}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base sm:text-lg font-black tracking-wider uppercase drop-shadow font-sans">
                    {lowerThird.speaker}
                  </h3>
                  <p className="text-xs sm:text-sm font-semibold opacity-90 tracking-wide drop-shadow text-slate-200">
                    {lowerThird.title}
                  </p>
                </div>

                {lowerThird.organization && (
                  <div
                    className={`hidden sm:block px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider border uppercase ${themeStyle.tag}`}
                  >
                    {lowerThird.organization}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* DSK 3: Crawling Breaking News Ticker */}
        {ticker.enabled && !hideTicker && (
          <div className="w-full bg-slate-950/95 backdrop-blur border-t border-slate-800 flex items-stretch h-8 sm:h-9 overflow-hidden shadow-2xl">
            {/* Ticker Badge / Label */}
            <div className="flex items-center gap-1.5 px-3 sm:px-4 bg-gradient-to-r from-rose-700 to-rose-600 text-white font-black text-[11px] sm:text-xs tracking-widest uppercase flex-shrink-0 z-20 shadow-md">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>{ticker.label}</span>
            </div>

            {/* Marquee Crawl Track */}
            <div className="relative flex-1 overflow-hidden flex items-center">
              <div
                className="whitespace-nowrap font-mono text-xs sm:text-sm font-medium text-slate-200 tracking-wide animate-marquee flex items-center"
                style={{
                  animationDuration: "25s",
                }}
              >
                <span className="inline-block px-4">{ticker.text}</span>
                <span className="inline-block text-cyan-400 px-3">///</span>
                <span className="inline-block px-4">{ticker.text}</span>
                <span className="inline-block text-cyan-400 px-3">///</span>
                <span className="inline-block px-4">{ticker.text}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 28s linear infinite;
        }
      `}</style>
    </div>
  );
};
