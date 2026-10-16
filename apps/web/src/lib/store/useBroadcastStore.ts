import { create } from "zustand";

export type SwitcherInputId =
  | "input1_daemon"
  | "input2_browser"
  | "input3_timeline"
  | "input4_vault";

export type TransitionType = "cut" | "dissolve" | "wipe" | "stinger";

export type CompositorLayout =
  | "full"
  | "side_by_side"
  | "pip_bottom_right"
  | "pip_top_right";

export interface InputAudioConfig {
  volume: number; // 0.0 to 1.2
  muted: boolean;
  afv: boolean;   // Audio Follows Video
  peakDb: number;
}

export interface MediaPoolItem {
  id: string;
  title: string;
  type: "stinger" | "bumper" | "intro" | "sfx";
  duration: number; // seconds
  badge: string;
  sourceUrl?: string;
}

export interface LowerThirdConfig {
  enabled: boolean;
  speaker: string;
  title: string;
  organization: string;
  theme: "navy_cyan" | "crimson" | "amber" | "slate";
}

export interface StationBugConfig {
  enabled: boolean;
  callsign: string;
  location: string;
  isLivePulse: boolean;
}

export interface TickerConfig {
  enabled: boolean;
  label: string;
  text: string;
  speed: number;
}

export interface BroadcastTelemetry {
  isLive: boolean;
  destination: string;
  uptimeSeconds: number;
  droppedFrames: number;
  bitrateKbps: number;
  outputFile: string | null;
  fps: number;
}

export interface BroadcastState {
  // M/E Bus Switcher
  previewInput: SwitcherInputId;
  programInput: SwitcherInputId;
  previewLayout: CompositorLayout;
  programLayout: CompositorLayout;
  transitionType: TransitionType;
  transitionDurationMs: number;
  transitionProgress: number; // 0.0 to 1.0
  inTransition: boolean;

  // Stinger State
  activeStinger: {
    isPlaying: boolean;
    progress: number;
  };

  // Live Audio Mixer & AFV Engine
  audioChannels: Record<SwitcherInputId, InputAudioConfig>;
  masterAudio: {
    volume: number;
    muted: boolean;
    peakDb: number;
  };

  // Mini Media Pool
  mediaPool: MediaPoolItem[];
  activeMediaPoolItem: MediaPoolItem | null;

  // DSK Graphics Overlays
  graphics: {
    lowerThird: LowerThirdConfig;
    stationBug: StationBugConfig;
    ticker: TickerConfig;
  };

  // Broadcast Telemetry & Daemon Egress
  telemetry: BroadcastTelemetry;
  isStartingBroadcast: boolean;
  isStoppingBroadcast: boolean;

  // UI Modal & Mode Navigation (No-redirect)
  isGoLiveModalOpen: boolean;
  isSwitcherMode: boolean;

  // Actions
  setPreviewInput: (input: SwitcherInputId) => void;
  setProgramInput: (input: SwitcherInputId) => void;
  setPreviewLayout: (layout: CompositorLayout) => void;
  setProgramLayout: (layout: CompositorLayout) => void;
  setTransitionType: (type: TransitionType) => void;
  setTransitionDurationMs: (ms: number) => void;
  setTransitionProgress: (progress: number) => void;
  executeCut: () => void;
  executeAutoTransition: () => void;

  // Audio Mixer Actions
  setInputVolume: (id: SwitcherInputId, volume: number) => void;
  toggleInputMute: (id: SwitcherInputId) => void;
  toggleInputAFV: (id: SwitcherInputId) => void;
  setInputPeak: (id: SwitcherInputId, peakDb: number) => void;
  setMasterAudioVolume: (volume: number) => void;
  toggleMasterAudioMute: () => void;

  // Media Pool Actions
  fireMediaPoolItem: (item: MediaPoolItem) => void;
  stopMediaPoolItem: () => void;

  toggleGraphic: (key: keyof BroadcastState["graphics"]) => void;
  updateLowerThird: (data: Partial<LowerThirdConfig>) => void;
  updateStationBug: (data: Partial<StationBugConfig>) => void;
  updateTicker: (data: Partial<TickerConfig>) => void;

  setGoLiveModalOpen: (open: boolean) => void;
  setSwitcherMode: (mode: boolean) => void;

  startBroadcast: (destination?: string, rtmpUrl?: string) => Promise<boolean>;
  stopBroadcast: () => Promise<boolean>;
  fetchTelemetry: () => Promise<void>;
}

const DAEMON_URL = "http://127.0.0.1:8765";

const DEFAULT_AUDIO_CHANNELS: Record<SwitcherInputId, InputAudioConfig> = {
  input1_daemon: { volume: 0.85, muted: false, afv: true, peakDb: -60 },
  input2_browser: { volume: 0.85, muted: false, afv: true, peakDb: -60 },
  input3_timeline: { volume: 0.8, muted: false, afv: true, peakDb: -60 },
  input4_vault: { volume: 0.9, muted: false, afv: false, peakDb: -60 },
};

const DEFAULT_MEDIA_POOL: MediaPoolItem[] = [
  {
    id: "pool_stinger_01",
    title: "Velocity Alpha Wipe",
    type: "stinger",
    duration: 1.2,
    badge: "STINGER",
  },
  {
    id: "pool_intro_01",
    title: "Sparrow Main Title 4K",
    type: "intro",
    duration: 5.0,
    badge: "SHOW INTRO",
  },
  {
    id: "pool_bumper_01",
    title: "Break Bumper (Short)",
    type: "bumper",
    duration: 2.5,
    badge: "BUMPER",
  },
  {
    id: "pool_sfx_01",
    title: "Breaking News Hit",
    type: "sfx",
    duration: 1.8,
    badge: "SOUND FX",
  },
  {
    id: "pool_sfx_02",
    title: "Chime & Transition",
    type: "sfx",
    duration: 1.0,
    badge: "SOUND FX",
  },
];

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  previewInput: "input2_browser",
  programInput: "input1_daemon",
  previewLayout: "full",
  programLayout: "full",
  transitionType: "dissolve",
  transitionDurationMs: 500,
  transitionProgress: 0,
  inTransition: false,

  activeStinger: {
    isPlaying: false,
    progress: 0,
  },

  audioChannels: DEFAULT_AUDIO_CHANNELS,
  masterAudio: {
    volume: 0.9,
    muted: false,
    peakDb: -60,
  },

  mediaPool: DEFAULT_MEDIA_POOL,
  activeMediaPoolItem: null,

  graphics: {
    lowerThird: {
      enabled: false,
      speaker: "Dr. Aris Vance",
      title: "Lead Broadcast Architect",
      organization: "Sparrow Media Group",
      theme: "navy_cyan",
    },
    stationBug: {
      enabled: true,
      callsign: "SPARROW OS",
      location: "STUDIO A",
      isLivePulse: true,
    },
    ticker: {
      enabled: true,
      label: "BREAKING NEWS",
      text: "BREAKING: Sparrow Media Group launches next-generation browser production OS with real-time WebRTC, 60fps NLE, and edge broadcast engine...",
      speed: 1,
    },
  },

  telemetry: {
    isLive: false,
    destination: "local_sink",
    uptimeSeconds: 0,
    droppedFrames: 0,
    bitrateKbps: 0,
    outputFile: null,
    fps: 60,
  },
  isStartingBroadcast: false,
  isStoppingBroadcast: false,

  isGoLiveModalOpen: false,
  isSwitcherMode: false,

  setPreviewInput: (previewInput) => set({ previewInput }),
  setProgramInput: (programInput) => set({ programInput }),
  setPreviewLayout: (previewLayout) => set({ previewLayout }),
  setProgramLayout: (programLayout) => set({ programLayout }),
  setTransitionType: (transitionType) => set({ transitionType }),
  setTransitionDurationMs: (transitionDurationMs) => set({ transitionDurationMs }),
  setTransitionProgress: (transitionProgress) => set({ transitionProgress }),

  // Live Audio Mixer Actions
  setInputVolume: (id, volume) =>
    set((state) => ({
      audioChannels: {
        ...state.audioChannels,
        [id]: {
          ...state.audioChannels[id],
          volume: Math.max(0, Math.min(1.2, volume)),
        },
      },
    })),

  toggleInputMute: (id) =>
    set((state) => ({
      audioChannels: {
        ...state.audioChannels,
        [id]: {
          ...state.audioChannels[id],
          muted: !state.audioChannels[id].muted,
        },
      },
    })),

  toggleInputAFV: (id) =>
    set((state) => ({
      audioChannels: {
        ...state.audioChannels,
        [id]: {
          ...state.audioChannels[id],
          afv: !state.audioChannels[id].afv,
        },
      },
    })),

  setInputPeak: (id, peakDb) =>
    set((state) => ({
      audioChannels: {
        ...state.audioChannels,
        [id]: {
          ...state.audioChannels[id],
          peakDb,
        },
      },
    })),

  setMasterAudioVolume: (volume) =>
    set((state) => ({
      masterAudio: {
        ...state.masterAudio,
        volume: Math.max(0, Math.min(1.2, volume)),
      },
    })),

  toggleMasterAudioMute: () =>
    set((state) => ({
      masterAudio: {
        ...state.masterAudio,
        muted: !state.masterAudio.muted,
      },
    })),

  // Media Pool Actions
  fireMediaPoolItem: (item) => {
    set({ activeMediaPoolItem: item });
    if (item.type === "stinger") {
      get().setTransitionType("stinger");
      get().executeAutoTransition();
    } else {
      setTimeout(() => {
        set({ activeMediaPoolItem: null });
      }, item.duration * 1000);
    }
  },

  stopMediaPoolItem: () => set({ activeMediaPoolItem: null }),

  executeCut: () => {
    const { previewInput, programInput, previewLayout, programLayout } = get();

    // Hot swap video and layouts
    set({
      programInput: previewInput,
      previewInput: programInput,
      programLayout: previewLayout,
      previewLayout: programLayout,
      transitionProgress: 0,
      inTransition: false,
    });
  },

  executeAutoTransition: () => {
    const {
      inTransition,
      transitionDurationMs,
      transitionType,
      previewInput,
      programInput,
      previewLayout,
      programLayout,
    } = get();

    if (inTransition) return;

    const duration = transitionType === "stinger" ? 1200 : transitionDurationMs;
    set({ inTransition: true, transitionProgress: 0 });

    if (transitionType === "stinger") {
      set({ activeStinger: { isPlaying: true, progress: 0 } });
    }

    const startTime = performance.now();
    let cutPointReached = false;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1.0, elapsed / duration);

      set({ transitionProgress: progress });

      if (transitionType === "stinger") {
        set({ activeStinger: { isPlaying: true, progress } });
        // At 50% midpoint of the stinger wipe, flip Program and Preview underneath!
        if (progress >= 0.5 && !cutPointReached) {
          cutPointReached = true;
          set({
            programInput: previewInput,
            previewInput: programInput,
            programLayout: previewLayout,
            previewLayout: programLayout,
          });
        }
      }

      if (progress < 1.0) {
        requestAnimationFrame(animate);
      } else {
        // Complete transition
        if (transitionType !== "stinger") {
          set({
            programInput: previewInput,
            previewInput: programInput,
            programLayout: previewLayout,
            previewLayout: programLayout,
          });
        }
        set({
          transitionProgress: 0,
          inTransition: false,
          activeStinger: { isPlaying: false, progress: 0 },
        });
      }
    };

    requestAnimationFrame(animate);
  },

  toggleGraphic: (key) =>
    set((state) => ({
      graphics: {
        ...state.graphics,
        [key]: {
          ...state.graphics[key],
          enabled: !state.graphics[key].enabled,
        },
      },
    })),

  updateLowerThird: (data) =>
    set((state) => ({
      graphics: {
        ...state.graphics,
        lowerThird: {
          ...state.graphics.lowerThird,
          ...data,
        },
      },
    })),

  updateStationBug: (data) =>
    set((state) => ({
      graphics: {
        ...state.graphics,
        stationBug: {
          ...state.graphics.stationBug,
          ...data,
        },
      },
    })),

  updateTicker: (data) =>
    set((state) => ({
      graphics: {
        ...state.graphics,
        ticker: {
          ...state.graphics.ticker,
          ...data,
        },
      },
    })),

  setGoLiveModalOpen: (isGoLiveModalOpen) => set({ isGoLiveModalOpen }),
  setSwitcherMode: (isSwitcherMode) => set({ isSwitcherMode }),

  startBroadcast: async (destination = "local_sink", rtmpUrl) => {
    set({ isStartingBroadcast: true });
    try {
      const res = await fetch(`${DAEMON_URL}/broadcast/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          rtmp_url: rtmpUrl || undefined,
        }),
      });

      if (!res.ok) throw new Error(`Daemon returned ${res.status}`);
      const data = await res.json();

      set({
        telemetry: {
          isLive: data.is_live ?? true,
          destination: data.destination ?? destination,
          uptimeSeconds: data.uptime_seconds ?? 0,
          droppedFrames: data.dropped_frames ?? 0,
          bitrateKbps: data.bitrate_kbps ?? 4500,
          outputFile: data.output_file ?? null,
          fps: data.fps ?? 60,
        },
        isStartingBroadcast: false,
      });
      return true;
    } catch (err) {
      console.error("Failed to start broadcast on daemon:", err);
      // Fallback synthetic telemetry for standalone UI mode
      set((state) => ({
        telemetry: {
          ...state.telemetry,
          isLive: true,
          destination,
          bitrateKbps: 4500,
          outputFile: `media/broadcasts/mock_stream_${Date.now()}.mp4`,
        },
        isStartingBroadcast: false,
      }));
      return true;
    }
  },

  stopBroadcast: async () => {
    set({ isStoppingBroadcast: true });
    try {
      const res = await fetch(`${DAEMON_URL}/broadcast/stop`, {
        method: "POST",
      });
      const data = await res.json();
      set({
        telemetry: {
          isLive: false,
          destination: data.destination ?? "local_sink",
          uptimeSeconds: data.uptime_seconds ?? 0,
          droppedFrames: data.dropped_frames ?? 0,
          bitrateKbps: 0,
          outputFile: data.output_file ?? null,
          fps: data.fps ?? 60,
        },
        isStoppingBroadcast: false,
      });
      return true;
    } catch (err) {
      console.error("Failed to stop broadcast:", err);
      set((state) => ({
        telemetry: { ...state.telemetry, isLive: false, bitrateKbps: 0 },
        isStoppingBroadcast: false,
      }));
      return true;
    }
  },

  fetchTelemetry: async () => {
    try {
      const res = await fetch(`${DAEMON_URL}/broadcast/status`);
      if (res.ok) {
        const data = await res.json();
        set({
          telemetry: {
            isLive: data.is_live ?? false,
            destination: data.destination ?? "local_sink",
            uptimeSeconds: data.uptime_seconds ?? 0,
            droppedFrames: data.dropped_frames ?? 0,
            bitrateKbps: data.bitrate_kbps ?? 0,
            outputFile: data.output_file ?? null,
            fps: data.fps ?? 60,
          },
        });
      }
    } catch {
      // Daemon may be offline, keep current state
    }
  },
}));
