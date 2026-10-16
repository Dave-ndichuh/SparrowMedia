"use client";

import React, { useState, useEffect } from "react";
import {
  Camera,
  Layers,
  Sparkles,
  Sliders,
  Radio,
  Cpu,
  UploadCloud,
  Film,
  Play,
  Square,
  Volume2,
  VolumeX,
  Activity,
  Maximize2,
  CheckCircle,
  FolderOpen,
  LayoutTemplate,
  SlidersHorizontal,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { useEDLStore } from "@/lib/store/useEDLStore";
import { useBroadcastStore } from "@/lib/store/useBroadcastStore";
import { ProgramMonitor } from "./ProgramMonitor";
import { MasterAudioConsole } from "./MasterAudioConsole";
import { StudioDockPanel } from "./StudioDockPanel";
import { DeviceConnectionModal } from "../connection/DeviceConnectionModal";
import { SmartDropzone } from "../ingestion/SmartDropzone";
import { UploadProgressPanel } from "../ingestion/UploadProgressPanel";
import { TimelineEditor } from "../timeline/TimelineEditor";
import { AICopilotDrawer } from "../copilot/AICopilotDrawer";
import { VisionSwitcherDeck } from "../broadcast/VisionSwitcherDeck";
import { GoLiveModal } from "../broadcast/GoLiveModal";
import { checkDaemonHealth } from "@/lib/webrtc/daemonClient";

export const StudioLayout: React.FC = () => {
  const {
    isConnectModalOpen,
    setConnectModalOpen,
    activeStream,
    connectionMode,
    activeVideoDevice,
    isAudioMuted,
    setAudioMuted,
    isMediaLibraryOpen,
    setMediaLibraryOpen,
    studioDockTab,
    setStudioDockTab,
    dockPosition,
    setDockPosition,
    workspacePreset,
    setWorkspacePreset,
    disconnectStream,
  } = useStudioStore();

  const { isCopilotOpen, setCopilotOpen, edl } = useEDLStore();
  const { isSwitcherMode, setSwitcherMode, telemetry, setGoLiveModalOpen } = useBroadcastStore();

  const [daemonOnline, setDaemonOnline] = useState<boolean>(false);
  const [timeStr, setTimeStr] = useState<string>("");

  // Real-time Studio Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toTimeString().split(" ")[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Daemon background heartbeat check
  useEffect(() => {
    const check = async () => {
      try {
        await checkDaemonHealth();
        setDaemonOnline(true);
      } catch {
        setDaemonOnline(false);
      }
    };
    check();
    const poll = setInterval(check, 5000);
    return () => clearInterval(poll);
  }, []);

  const isConnected = connectionMode !== "disconnected" && activeStream !== null;

  // Compute heights based on workspace preset
  const getDeckHeights = () => {
    if (workspacePreset === "focus_timeline") {
      return { upper: "h-[30%]", lower: "h-[70%]" };
    }
    if (workspacePreset === "focus_monitor") {
      return { upper: "h-[68%]", lower: "h-[32%]" };
    }
    // Balanced default
    return { upper: "h-[46%]", lower: "h-[54%]" };
  };

  const { upper: upperHeight, lower: lowerHeight } = getDeckHeights();

  return (
    <div className="relative flex flex-col h-screen w-screen bg-studio-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header / Master Broadcast Status Bar */}
      <header className="h-11 border-b border-studio-800/90 bg-studio-900/95 backdrop-blur px-4 flex items-center justify-between z-20 flex-shrink-0">
        {/* Left: Brand & Mode Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shadow-md shadow-sky-500/20">
              S
            </div>
            <span className="text-xs font-black tracking-widest uppercase text-white hidden sm:inline">
              Sparrow OS
            </span>
          </div>

          <div className="h-3.5 w-px bg-studio-800" />

          {/* Mode Switcher: Timeline NLE vs Live Vision Switcher */}
          <div className="flex items-center bg-studio-950 p-0.5 rounded-lg border border-studio-800">
            <button
              onClick={() => setSwitcherMode(false)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                !isSwitcherMode
                  ? "bg-studio-800 text-sky-300 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Timeline NLE</span>
            </button>
            <button
              onClick={() => setSwitcherMode(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition ${
                isSwitcherMode
                  ? "bg-rose-950/60 text-rose-400 border border-rose-800/60 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Live Switcher</span>
            </button>
          </div>
        </div>

        {/* Center: Master On-Air Status & Clock */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setGoLiveModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider border cursor-pointer transition ${
              telemetry.isLive || isConnected
                ? "bg-rose-950/40 text-rose-400 border-rose-800/60 tally-pulse-live"
                : "bg-studio-950 text-slate-400 border-studio-800 hover:border-slate-700"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                telemetry.isLive || isConnected ? "bg-rose-500" : "bg-slate-600"
              }`}
            />
            <span>{telemetry.isLive ? "LIVE BROADCAST" : isConnected ? "FEED ACTIVE" : "OFF AIR"}</span>
          </button>

          <div className="hidden md:block font-mono text-[11px] text-slate-400 bg-studio-950 px-2 py-0.5 rounded border border-studio-800">
            {timeStr || "00:00:00"}
          </div>
        </div>

        {/* Right: Actions Deck */}
        <div className="flex items-center gap-2">
          {/* Master Go Live Button */}
          <button
            onClick={() => setGoLiveModalOpen(true)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-mono font-bold text-xs transition shadow-md active:scale-95 ${
              telemetry.isLive
                ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                : "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{telemetry.isLive ? "ON AIR" : "GO LIVE"}</span>
          </button>

          {/* AI Copilot Tab Switcher / Toggle */}
          <button
            onClick={() => {
              if (dockPosition === "side") {
                setStudioDockTab("copilot");
                setMediaLibraryOpen(true);
              } else {
                setCopilotOpen(!isCopilotOpen);
              }
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-semibold transition ${
              studioDockTab === "copilot" && isMediaLibraryOpen && dockPosition === "side"
                ? "bg-amber-950/40 text-amber-300 border-amber-800/60"
                : "bg-studio-800 text-slate-300 border-studio-700 hover:text-white"
            }`}
            title="Toggle AI Copilot"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Copilot</span>
          </button>

          {/* Media Vault Tab Switcher / Toggle */}
          <button
            onClick={() => {
              setStudioDockTab("vault");
              setMediaLibraryOpen(!isMediaLibraryOpen);
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs font-medium transition ${
              isMediaLibraryOpen
                ? "bg-studio-800 text-sky-400 border-studio-700"
                : "text-slate-400 border-studio-800 hover:text-white"
            }`}
            title="Toggle Media Vault"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Vault</span>
          </button>

          {/* Daemon Status Chip */}
          <button
            onClick={() => setConnectModalOpen(true)}
            className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono border transition ${
              daemonOnline
                ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40 hover:bg-emerald-900/30"
                : "bg-studio-800/60 text-slate-400 border-studio-700/50 hover:bg-studio-800"
            }`}
            title="Local Hardware Bridge Daemon Status"
          >
            <Cpu className="w-3 h-3" />
            <span>{daemonOnline ? "DAEMON (8765)" : "OFFLINE"}</span>
          </button>

          {/* Device Connect Button */}
          <button
            onClick={() => setConnectModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition shadow-sm active:scale-95"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isConnected ? "Feed" : "Connect"}</span>
          </button>

          {isConnected && (
            <button
              onClick={disconnectStream}
              className="p-1 rounded bg-studio-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 border border-studio-700 transition"
              title="Disconnect Stream"
            >
              <Square className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {isSwitcherMode ? (
          <VisionSwitcherDeck />
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* UPPER DECK: Dockable Bin / Copilot Panel + Program Monitor + Master Audio Console */}
            <div className={`w-full ${upperHeight} p-2 flex gap-2 min-h-0 transition-all duration-200`}>
              {/* UPPER LEFT: Studio Dock (Side position) */}
              {dockPosition === "side" && isMediaLibraryOpen && (
                <div className="w-[30%] min-w-[280px] max-w-[400px] h-full flex flex-col min-h-0 flex-shrink-0">
                  <StudioDockPanel isBottomDock={false} />
                </div>
              )}

              {/* UPPER CENTER: Program Monitor */}
              <div className="flex-1 h-full min-h-0">
                <ProgramMonitor />
              </div>

              {/* UPPER RIGHT: Master Audio Bus & NLE Engine Status Console */}
              <div className="w-64 min-w-[240px] max-w-[280px] h-full flex flex-col min-h-0 flex-shrink-0">
                <MasterAudioConsole />
              </div>
            </div>

            {/* LOWER DECK: Full-Width 60FPS Timeline NLE */}
            <div className={`w-full ${lowerHeight} flex flex-col min-h-0 border-t border-studio-800 transition-all duration-200`}>
              <div className="flex-1 min-h-0">
                <TimelineEditor />
              </div>

              {/* Optional Bottom Dock (when user toggles dock to bottom) */}
              {dockPosition === "bottom" && isMediaLibraryOpen && (
                <div className="h-56 border-t border-studio-800 flex-shrink-0">
                  <StudioDockPanel isBottomDock={true} />
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Slim Studio Footer Rail */}
      <footer className="h-6 border-t border-studio-800/80 bg-studio-950 px-3 flex items-center justify-between text-[10px] font-mono text-slate-500 z-10 select-none flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${daemonOnline ? "bg-emerald-400" : "bg-slate-600"}`} />
            <span>Bridge: {daemonOnline ? "127.0.0.1:8765" : "Offline"}</span>
          </span>
          <span className="text-slate-700">|</span>
          <span>Engine: Canvas 60fps</span>
          <span className="text-slate-700">|</span>
          <span>Tracks: {edl.tracks.length}</span>
        </div>

        <div className="flex items-center gap-3">
          <span>Preset: {workspacePreset.replace("_", " ")}</span>
          <span className="text-slate-700">|</span>
          <span>Dock: {dockPosition}</span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">SMPTE 29.97 / 60p</span>
        </div>
      </footer>

      {/* Floating Ingestion Progress Feedback */}
      <UploadProgressPanel />

      {/* Global Ingestion Drag & Drop Listener */}
      <SmartDropzone />

      {/* Hardware Connection Modal */}
      <DeviceConnectionModal />

      {/* Go Live Broadcast Modal */}
      <GoLiveModal />

      {/* Floating Copilot Drawer fallback when dock is bottom */}
      {dockPosition === "bottom" && isCopilotOpen && <AICopilotDrawer />}
    </div>
  );
};

