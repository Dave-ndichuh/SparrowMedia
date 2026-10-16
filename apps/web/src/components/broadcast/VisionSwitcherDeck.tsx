"use client";

import React, { useRef, useEffect, useState } from "react";
import {
  Radio,
  Sliders,
  Layers,
  Sparkles,
  ArrowRightLeft,
  Scissors,
  Eye,
  Video,
  Monitor,
  Film,
  Camera,
  Play,
  Settings2,
  CheckCircle2,
  AlertTriangle,
  Type,
  FileVideo,
  LayoutGrid,
  Maximize2,
  SplitSquareVertical,
  PictureInPicture2,
  Cpu,
  Keyboard,
  Zap,
} from "lucide-react";
import {
  useBroadcastStore,
  SwitcherInputId,
  TransitionType,
  CompositorLayout,
} from "@/lib/store/useBroadcastStore";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { useEDLStore } from "@/lib/store/useEDLStore";
import { GraphicsCompositor } from "./GraphicsCompositor";
import { MultiBoxCompositor } from "./MultiBoxCompositor";
import { LiveAudioMixer } from "./LiveAudioMixer";
import { MiniMediaPool } from "./MiniMediaPool";

interface InputMeta {
  id: SwitcherInputId;
  label: string;
  source: string;
  icon: React.ReactNode;
}

const SWITCHER_INPUTS: InputMeta[] = [
  {
    id: "input1_daemon",
    label: "CAM 1 (DAEMON)",
    source: "127.0.0.1:8765 WebRTC",
    icon: <Camera className="w-4 h-4" />,
  },
  {
    id: "input2_browser",
    label: "CAM 2 (BROWSER)",
    source: "Webcam / Pattern",
    icon: <Video className="w-4 h-4" />,
  },
  {
    id: "input3_timeline",
    label: "NLE TIMELINE",
    source: "Track V1/V2 Playout",
    icon: <Film className="w-4 h-4" />,
  },
  {
    id: "input4_vault",
    label: "MEDIA VAULT",
    source: "Direct Clip Playout",
    icon: <FileVideo className="w-4 h-4" />,
  },
];

export const VisionSwitcherDeck: React.FC = () => {
  const {
    previewInput,
    programInput,
    previewLayout,
    programLayout,
    transitionType,
    transitionDurationMs,
    transitionProgress,
    inTransition,
    activeStinger,
    graphics,
    telemetry,
    setPreviewInput,
    setProgramInput,
    setPreviewLayout,
    setProgramLayout,
    setTransitionType,
    setTransitionDurationMs,
    executeCut,
    executeAutoTransition,
    fireMediaPoolItem,
    toggleGraphic,
    updateLowerThird,
    updateTicker,
    setGoLiveModalOpen,
    fetchTelemetry,
  } = useBroadcastStore();

  const { activeStream, mediaAssets } = useStudioStore();
  const { edl } = useEDLStore();

  const [activeDskTab, setActiveDskTab] = useState<"dsk1" | "dsk2" | "dsk3" | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<"dsk" | "media_pool">("dsk");
  const [midiDeviceName, setMidiDeviceName] = useState<string | null>(null);

  // Poll broadcast telemetry periodically
  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, [fetchTelemetry]);

  // Video element references for each input source
  const daemonVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (activeStream && daemonVideoRef.current) {
      daemonVideoRef.current.srcObject = activeStream;
      daemonVideoRef.current.play().catch(() => {});
    }
  }, [activeStream]);

  // 1. HARDWARE KEYBOARD HOTKEY ROUTING (1-4, Shift+1-4, Space, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CRITICAL SAFETY GUARD: Disable switcher shortcuts if user is typing in form inputs
      const isInputFocused =
        ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName || "") ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (isInputFocused) return;

      const keyMap: Record<string, SwitcherInputId> = {
        "1": "input1_daemon",
        "2": "input2_browser",
        "3": "input3_timeline",
        "4": "input4_vault",
      };

      if (keyMap[e.key]) {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift + 1-4: Direct Program Hot Cut
          setProgramInput(keyMap[e.key]);
        } else {
          // 1-4: Queue on Preview Bus
          setPreviewInput(keyMap[e.key]);
        }
        return;
      }

      // Spacebar: Auto Transition
      if (e.code === "Space") {
        e.preventDefault();
        executeAutoTransition();
        return;
      }

      // Enter / NumpadEnter: Instant Cut / Take
      if (e.code === "Enter" || e.code === "NumpadEnter") {
        e.preventDefault();
        executeCut();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setPreviewInput, setProgramInput, executeAutoTransition, executeCut]);

  // 2. WEB MIDI / STREAM DECK INTEGRATION
  useEffect(() => {
    // Expose Sparrow Switcher API to window for Stream Deck browser plugins & external macros
    if (typeof window !== "undefined") {
      (window as unknown as { __sparrow_switcher__: unknown }).__sparrow_switcher__ = {
        cut: executeCut,
        autoTrans: executeAutoTransition,
        setPreview: setPreviewInput,
        setProgram: setProgramInput,
        setLayoutPreview: setPreviewLayout,
        setLayoutProgram: setProgramLayout,
        setTransition: setTransitionType,
        fireMediaPool: fireMediaPoolItem,
      };
    }

    // Connect to Web MIDI controllers if browser permits
    if (typeof navigator !== "undefined" && "requestMIDIAccess" in navigator) {
      type MIDIInputLike = { name?: string; onmidimessage: ((event: unknown) => void) | null };
      type MIDIAccessLike = {
        inputs: {
          forEach: (callback: (input: MIDIInputLike) => void) => void;
        };
      };

      (navigator as unknown as { requestMIDIAccess?: () => Promise<MIDIAccessLike> })
        .requestMIDIAccess?.()
        .then(
          (access) => {
            let foundName: string | null = null;
            access.inputs.forEach((input) => {
              foundName = input.name || "Hardware Controller";
              input.onmidimessage = (event: unknown) => {
                const midiEvent = event as { data?: Uint8Array };
                if (!midiEvent.data || midiEvent.data.length < 2) return;
                const status = midiEvent.data[0];
                const noteOrCc = midiEvent.data[1];
                const velocity = midiEvent.data[2] || 0;
                const type = status & 0xf0;

                if (type === 0x90 && velocity > 0) {
                  // Note On Mapping
                  if (noteOrCc === 36) setPreviewInput("input1_daemon");
                  else if (noteOrCc === 37) setPreviewInput("input2_browser");
                  else if (noteOrCc === 38) setPreviewInput("input3_timeline");
                  else if (noteOrCc === 39) setPreviewInput("input4_vault");
                  else if (noteOrCc === 40) setProgramInput("input1_daemon");
                  else if (noteOrCc === 41) setProgramInput("input2_browser");
                  else if (noteOrCc === 42) setProgramInput("input3_timeline");
                  else if (noteOrCc === 43) setProgramInput("input4_vault");
                  else if (noteOrCc === 44) executeCut();
                  else if (noteOrCc === 45) executeAutoTransition();
                }
              };
            });
            if (foundName) setMidiDeviceName(foundName);
          },
          () => {}
        );
    }
  }, [
    executeCut,
    executeAutoTransition,
    setPreviewInput,
    setProgramInput,
    setPreviewLayout,
    setProgramLayout,
    setTransitionType,
    fireMediaPoolItem,
  ]);

  // Helper to render individual video feed preview
  const renderInputFeed = (inputId: SwitcherInputId, isPreview: boolean = false) => {
    switch (inputId) {
      case "input1_daemon":
        return activeStream ? (
          <video
            ref={daemonVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-slate-500 font-mono text-xs gap-1 relative overflow-hidden">
            {/* SMPTE color bars synthetic fallback */}
            <div className="absolute inset-0 grid grid-cols-7 opacity-75">
              <div className="bg-gray-200" />
              <div className="bg-yellow-400" />
              <div className="bg-cyan-400" />
              <div className="bg-green-500" />
              <div className="bg-fuchsia-500" />
              <div className="bg-red-500" />
              <div className="bg-blue-600" />
            </div>
            <div className="relative z-10 bg-slate-950/80 px-3 py-1 rounded text-slate-200 border border-slate-700/60 font-black">
              DAEMON STANDBY (1080p60)
            </div>
          </div>
        );

      case "input2_browser":
        return (
          <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-slate-900 to-sky-950 flex flex-col items-center justify-center font-mono text-xs text-sky-400 relative">
            <Video className="w-8 h-8 opacity-40 mb-1" />
            <span className="font-bold tracking-wider">CAM 2 : STUDIO DESK</span>
            <span className="text-[10px] text-slate-400">DirectShow HD</span>
          </div>
        );

      case "input3_timeline":
        return (
          <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-amber-300 relative border border-slate-800">
            <Film className="w-8 h-8 opacity-40 mb-1" />
            <span className="font-bold tracking-wider">NLE TIMELINE OUTPUT</span>
            <span className="text-[10px] text-slate-400">
              {edl.tracks.flatMap((t) => t.clips).length} Clips Loaded
            </span>
          </div>
        );

      case "input4_vault":
        const topAsset = mediaAssets[0];
        return (
          <div className="w-full h-full bg-slate-950 flex flex-col items-center justify-center font-mono text-xs text-emerald-400 relative">
            <FileVideo className="w-8 h-8 opacity-40 mb-1" />
            <span className="font-bold tracking-wider">
              {topAsset ? topAsset.title : "MEDIA VAULT PLAYOUT"}
            </span>
            <span className="text-[10px] text-slate-400">
              {topAsset ? `${topAsset.file_type} (${topAsset.width || 1920}x${topAsset.height || 1080})` : "Idle"}
            </span>
          </div>
        );
    }
  };

  const getTransitionStyle = () => {
    if (!inTransition) return {};
    if (transitionType === "dissolve") {
      return { opacity: 1 - transitionProgress };
    }
    if (transitionType === "wipe") {
      return {
        clipPath: `polygon(${transitionProgress * 100}% 0, 100% 0, 100% 100%, ${
          transitionProgress * 100
        }% 100%)`,
      };
    }
    return {};
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-y-auto font-sans p-3 sm:p-4 gap-4">
      {/* Studio Header Bar with Hardware Status */}
      <div className="flex items-center justify-between bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-mono font-black tracking-widest text-slate-200">
            SPARROW LIVE PRODUCTION ENGINE // PHASE 5 VISION SWITCHER
          </span>
        </div>

        <div className="flex items-center gap-3 text-[10px] font-mono">
          {/* Keyboard mapping status */}
          <div className="flex items-center gap-1 text-slate-400">
            <Keyboard className="w-3 h-3 text-cyan-400" />
            <span>KEYS [1-4] PVW | [SHIFT+1-4] PGM | [SPACE] AUTO | [ENTER] CUT</span>
          </div>

          <span className="text-slate-600">|</span>

          {/* MIDI Controller Status */}
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-amber-400" />
            <span className={midiDeviceName ? "text-amber-300 font-bold" : "text-slate-500"}>
              {midiDeviceName ? `MIDI: ${midiDeviceName}` : "STREAMDECK / MIDI: READY"}
            </span>
          </div>
        </div>
      </div>

      {/* Upper Section: Broadcast Dual-Deck (PVW / Program + Transition Column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch min-h-[320px]">
        {/* Left: PREVIEW (PVW) Deck with Green Tally */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900/90 rounded-xl border-2 border-emerald-500/80 shadow-lg shadow-emerald-950/20 overflow-hidden relative">
          {/* Header Bar */}
          <div className="h-8 bg-slate-950/90 px-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-black tracking-widest text-emerald-400 font-mono">
                PVW // PREVIEW BUS
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 uppercase font-bold">
                {previewLayout.replace("_", " ")}
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                {SWITCHER_INPUTS.find((i) => i.id === previewInput)?.label}
              </span>
            </div>
          </div>

          {/* Multi-Box Feed Canvas */}
          <div className="relative flex-1 bg-black aspect-video overflow-hidden">
            <MultiBoxCompositor
              layout={previewLayout}
              primaryInput={previewInput}
              isProgram={false}
              renderFeed={renderInputFeed}
              showVuMeter={true}
            />
          </div>
        </div>

        {/* Center: Transition & Layout Control Column */}
        <div className="lg:col-span-2 flex flex-col justify-between bg-slate-900/70 rounded-xl border border-slate-800 p-3 shadow-md gap-2.5">
          {/* Layout Selector for Preview Cue */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center">
              COMPOSITING LAYOUT
            </span>
            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setPreviewLayout("full")}
                className={`py-1 px-1 text-[9px] font-mono uppercase font-bold rounded flex items-center justify-center gap-1 transition ${
                  previewLayout === "full"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Full 1-Box Screen"
              >
                <Maximize2 className="w-2.5 h-2.5" />
                <span>FULL</span>
              </button>
              <button
                onClick={() => setPreviewLayout("side_by_side")}
                className={`py-1 px-1 text-[9px] font-mono uppercase font-bold rounded flex items-center justify-center gap-1 transition ${
                  previewLayout === "side_by_side"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Side-by-Side 2-Box"
              >
                <SplitSquareVertical className="w-2.5 h-2.5" />
                <span>2-BOX</span>
              </button>
              <button
                onClick={() => setPreviewLayout("pip_bottom_right")}
                className={`py-1 px-1 text-[9px] font-mono uppercase font-bold rounded flex items-center justify-center gap-1 transition ${
                  previewLayout === "pip_bottom_right"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Picture in Picture (Bottom Right)"
              >
                <PictureInPicture2 className="w-2.5 h-2.5" />
                <span>PiP BR</span>
              </button>
              <button
                onClick={() => setPreviewLayout("pip_top_right")}
                className={`py-1 px-1 text-[9px] font-mono uppercase font-bold rounded flex items-center justify-center gap-1 transition ${
                  previewLayout === "pip_top_right"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Picture in Picture (Top Right)"
              >
                <LayoutGrid className="w-2.5 h-2.5" />
                <span>PiP TR</span>
              </button>
            </div>
          </div>

          {/* Transition Mode Selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest text-center">
              TRANSITION
            </span>

            <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(["cut", "dissolve", "wipe", "stinger"] as TransitionType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setTransitionType(type)}
                  className={`py-1 text-[9px] font-mono uppercase font-bold rounded transition ${
                    transitionType === type
                      ? "bg-sky-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Speed Selector */}
            <div className="flex items-center justify-between gap-1 text-[9px] font-mono text-slate-400">
              <span>SPEED:</span>
              <div className="flex gap-1">
                {[300, 500, 1000].map((ms) => (
                  <button
                    key={ms}
                    onClick={() => setTransitionDurationMs(ms)}
                    className={`px-1 py-0.5 rounded border transition ${
                      transitionDurationMs === ms
                        ? "bg-slate-700 text-sky-400 border-sky-500/50"
                        : "border-slate-800 hover:text-white"
                    }`}
                  >
                    {ms}ms
                  </button>
                ))}
              </div>
            </div>

            {/* Transition Progress Bar */}
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 transition-all duration-75"
                style={{ width: `${transitionProgress * 100}%` }}
              />
            </div>
          </div>

          {/* Action Trigger Buttons: CUT & AUTO */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={executeCut}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-black text-xs tracking-wider uppercase transition shadow-md active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>TAKE / CUT [ENTER]</span>
            </button>

            <button
              onClick={executeAutoTransition}
              disabled={inTransition}
              className={`w-full py-3 rounded-lg font-black text-xs tracking-wider uppercase transition shadow-lg flex items-center justify-center gap-2 active:scale-95 ${
                inTransition
                  ? "bg-sky-600/50 text-sky-200 cursor-not-allowed"
                  : "bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/20"
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{inTransition ? "TRANSITIONING..." : "AUTO TRANS [SPACE]"}</span>
            </button>
          </div>
        </div>

        {/* Right: PROGRAM (PGM) Deck with Red On-Air Tally & Compositor Overlays */}
        <div className="lg:col-span-5 flex flex-col bg-slate-900/90 rounded-xl border-2 border-rose-500 shadow-xl shadow-rose-950/30 overflow-hidden relative">
          {/* Header Bar */}
          <div className="h-8 bg-slate-950/90 px-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[11px] font-black tracking-widest text-rose-400 font-mono">
                PGM // PROGRAM (ON AIR)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-rose-950/80 border border-rose-700/60 text-rose-300 uppercase font-bold">
                {programLayout.replace("_", " ")}
              </span>
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                {SWITCHER_INPUTS.find((i) => i.id === programInput)?.label}
              </span>
            </div>
          </div>

          {/* Feed Canvas Container with Crossfade Stack & Stinger Layer */}
          <div className="relative flex-1 bg-black aspect-video overflow-hidden">
            {/* Base Incoming Feed during Auto Transition */}
            {inTransition && (
              <div className="absolute inset-0">
                <MultiBoxCompositor
                  layout={previewLayout}
                  primaryInput={previewInput}
                  isProgram={true}
                  renderFeed={renderInputFeed}
                  showVuMeter={false}
                />
              </div>
            )}

            {/* Active Program Feed (Crossfades or wipes out) */}
            <div className="absolute inset-0" style={getTransitionStyle()}>
              <MultiBoxCompositor
                layout={programLayout}
                primaryInput={programInput}
                isProgram={true}
                renderFeed={renderInputFeed}
                showVuMeter={!inTransition}
              />
            </div>

            {/* Stinger Wipe Graphic Sweep Overlay */}
            {activeStinger.isPlaying && (
              <div
                className="absolute inset-0 z-30 pointer-events-none overflow-hidden transition-none"
                style={{
                  transform: `translateX(${(activeStinger.progress - 0.5) * 200}%)`,
                }}
              >
                <div className="w-[140%] h-full -skew-x-12 bg-gradient-to-r from-transparent via-cyan-500/90 to-indigo-600/95 shadow-2xl flex items-center justify-center border-x-4 border-cyan-300">
                  <div className="flex items-center gap-2 px-6 py-2 bg-slate-950/90 rounded-xl border border-cyan-400/80 shadow-2xl skew-x-12">
                    <Sparkles className="w-5 h-5 text-cyan-300 animate-spin" />
                    <span className="text-sm font-black font-mono tracking-widest text-white">
                      SPARROW // STINGER TRANSITION
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Broadcast DSK Overlay Layer */}
            <GraphicsCompositor />
          </div>
        </div>
      </div>

      {/* Middle Section: M/E Bus Switching & Downstream Keyer / Media Pool Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {/* Left: Input Selection Rows (Program Bus & Preview Bus) */}
        <div className="lg:col-span-8 bg-slate-900/90 rounded-xl border border-slate-800 p-4 flex flex-col justify-between shadow-lg gap-4">
          {/* PROGRAM BUS ROW */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black font-mono tracking-wider text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                PROGRAM BUS (DIRECT TO AIR)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                [SHIFT + 1-4] HOT CUT TO AIR
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SWITCHER_INPUTS.map((inp, idx) => {
                const isActive = programInput === inp.id;
                return (
                  <button
                    key={`pgm-${inp.id}`}
                    onClick={() => setProgramInput(inp.id)}
                    className={`py-3 px-3 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition active:scale-95 ${
                      isActive
                        ? "bg-rose-600/90 border-rose-400 text-white shadow-lg shadow-rose-900/40"
                        : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs font-mono">
                      {inp.icon}
                      <span>{inp.label}</span>
                    </div>
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="text-[8px] font-mono text-slate-400">{inp.source}</span>
                      <span className="text-[8px] font-mono font-bold text-slate-500">[{idx + 1}]</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PREVIEW BUS ROW */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black font-mono tracking-wider text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                PREVIEW BUS (QUEUE NEXT)
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                [1-4] CUE FOR TRANSITION
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SWITCHER_INPUTS.map((inp, idx) => {
                const isActive = previewInput === inp.id;
                return (
                  <button
                    key={`pvw-${inp.id}`}
                    onClick={() => setPreviewInput(inp.id)}
                    className={`py-3 px-3 rounded-lg border flex flex-col items-center justify-center gap-1.5 transition active:scale-95 ${
                      isActive
                        ? "bg-emerald-600/90 border-emerald-400 text-white shadow-lg shadow-emerald-900/40"
                        : "bg-slate-950/80 border-slate-800 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-black text-xs font-mono">
                      {inp.icon}
                      <span>{inp.label}</span>
                    </div>
                    <div className="flex items-center justify-between w-full px-1">
                      <span className="text-[8px] font-mono text-slate-400">{inp.source}</span>
                      <span className="text-[8px] font-mono font-bold text-slate-500">[{idx + 1}]</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Downstream Keyer (DSK) & Media Pool Tabbed Panel */}
        <div className="lg:col-span-4 bg-slate-900/90 rounded-xl border border-slate-800 p-4 flex flex-col justify-between shadow-lg gap-3">
          <div>
            {/* Panel Tab Switcher */}
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setRightPanelTab("dsk")}
                  className={`text-xs font-mono font-bold tracking-wide transition pb-0.5 ${
                    rightPanelTab === "dsk"
                      ? "text-cyan-400 border-b-2 border-cyan-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  DSK GRAPHICS
                </button>
                <button
                  onClick={() => setRightPanelTab("media_pool")}
                  className={`text-xs font-mono font-bold tracking-wide transition pb-0.5 ${
                    rightPanelTab === "media_pool"
                      ? "text-indigo-400 border-b-2 border-indigo-400"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  MEDIA POOL / STINGERS
                </button>
              </div>
              <span className="text-[9px] font-mono text-slate-500">STUDIO ENGINE</span>
            </div>

            {/* TAB 1: DSK Graphics */}
            {rightPanelTab === "dsk" && (
              <div className="space-y-2">
                {/* DSK 1: Lower-Third */}
                <div className="bg-slate-950 rounded-lg border border-slate-800 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          graphics.lowerThird.enabled ? "bg-cyan-400 animate-pulse" : "bg-slate-600"
                        }`}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">DSK 1: Lower-Third</span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {graphics.lowerThird.speaker}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveDskTab(activeDskTab === "dsk1" ? null : "dsk1")}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Edit Lower-Third"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleGraphic("lowerThird")}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                          graphics.lowerThird.enabled
                            ? "bg-cyan-500 text-slate-950 shadow-sm"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {graphics.lowerThird.enabled ? "ON AIR" : "OFF"}
                      </button>
                    </div>
                  </div>

                  {/* In-place editor for Lower-Third */}
                  {activeDskTab === "dsk1" && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-800 space-y-2 text-xs">
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                          SPEAKER NAME
                        </label>
                        <input
                          type="text"
                          value={graphics.lowerThird.speaker}
                          onChange={(e) => updateLowerThird({ speaker: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                          TITLE / ROLE
                        </label>
                        <input
                          type="text"
                          value={graphics.lowerThird.title}
                          onChange={(e) => updateLowerThird({ title: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* DSK 2: Station Bug */}
                <div className="bg-slate-950 rounded-lg border border-slate-800 p-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        graphics.stationBug.enabled ? "bg-cyan-400 animate-pulse" : "bg-slate-600"
                      }`}
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">DSK 2: Station Bug</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {graphics.stationBug.callsign}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleGraphic("stationBug")}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                      graphics.stationBug.enabled
                        ? "bg-cyan-500 text-slate-950 shadow-sm"
                        : "bg-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {graphics.stationBug.enabled ? "ON AIR" : "OFF"}
                  </button>
                </div>

                {/* DSK 3: News Ticker */}
                <div className="bg-slate-950 rounded-lg border border-slate-800 p-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          graphics.ticker.enabled ? "bg-rose-400 animate-pulse" : "bg-slate-600"
                        }`}
                      />
                      <div>
                        <span className="text-xs font-bold text-slate-200 block">DSK 3: Breaking Ticker</span>
                        <span className="text-[10px] font-mono text-slate-400 truncate max-w-[150px] inline-block">
                          {graphics.ticker.text}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setActiveDskTab(activeDskTab === "dsk3" ? null : "dsk3")}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title="Edit Ticker Text"
                      >
                        <Type className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleGraphic("ticker")}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                          graphics.ticker.enabled
                            ? "bg-rose-600 text-white shadow-sm"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {graphics.ticker.enabled ? "ON AIR" : "OFF"}
                      </button>
                    </div>
                  </div>

                  {/* In-place editor for Ticker */}
                  {activeDskTab === "dsk3" && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-xs">
                      <label className="text-[10px] font-mono text-slate-400 block mb-0.5">
                        TICKER CRAWL TEXT
                      </label>
                      <textarea
                        rows={2}
                        value={graphics.ticker.text}
                        onChange={(e) => updateTicker({ text: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-200 text-xs font-mono focus:outline-none focus:border-rose-500 resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Mini Media Pool */}
            {rightPanelTab === "media_pool" && <MiniMediaPool />}
          </div>

          {/* Master Egress / Go Live Quick Trigger */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[9px] font-mono text-slate-400 uppercase">BROADCAST EGRESS</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {telemetry.isLive ? `${telemetry.bitrateKbps} kbps // 1080p60` : "STANDBY"}
              </span>
            </div>

            <button
              onClick={() => setGoLiveModalOpen(true)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs font-mono uppercase tracking-wider transition shadow-md active:scale-95 flex items-center gap-1.5 ${
                telemetry.isLive
                  ? "bg-rose-600 hover:bg-rose-500 text-white animate-pulse"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{telemetry.isLive ? "ON AIR // STOP" : "GO LIVE"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Live Audio Mixer Panel */}
      <LiveAudioMixer />
    </div>
  );
};
