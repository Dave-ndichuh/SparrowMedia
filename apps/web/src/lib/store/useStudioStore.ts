import { create } from "zustand";
import { DeviceProfile, ConnectionMode, DaemonStatus } from "@sparrow/edl";
import { AssetRecord } from "../api/assetsClient";

export interface UploadQueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  progress: number;
  stage: "uploading" | "processing" | "indexed" | "failed";
  statusMessage: string;
  asset?: AssetRecord;
}

export interface StudioState {
  // Connection and Stream state
  connectionMode: ConnectionMode;
  activeStream: MediaStream | null;
  activeVideoDevice: DeviceProfile | null;
  activeAudioDevice: DeviceProfile | null;
  streamMetrics: {
    width: number;
    height: number;
    fps: number;
    bitrateKbps: number;
    latencyMs: number;
  };

  // Hardware Daemon state
  daemonStatus: DaemonStatus | null;
  isDaemonScanning: boolean;
  daemonError: string | null;

  // Audio / VU telemetry
  audioLevels: {
    left: number;
    right: number;
    peak: number;
  };
  isAudioMuted: boolean;
  masterVolume: number;

  // Ingestion & Media Library
  uploadQueue: UploadQueueItem[];
  mediaAssets: AssetRecord[];
  isMediaLibraryOpen: boolean;
  mediaFilter: "all" | "video" | "audio" | "image" | "graphics";
  semanticQuery: string;
  isSearching: boolean;

  // Pro Studio Dock & Workspace Architecture
  studioDockTab: "vault" | "copilot" | "inspector";
  dockPosition: "side" | "bottom";
  workspacePreset: "balanced" | "focus_timeline" | "focus_monitor";

  // UI / Modal Controls (strictly in-place)
  isConnectModalOpen: boolean;
  isDropzoneOpen: boolean;
  isRecordActive: boolean;
  activeStudioTab: "monitor" | "timeline" | "mixer" | "ai_assistant";

  // Actions
  setConnectionMode: (mode: ConnectionMode) => void;
  setActiveStream: (stream: MediaStream | null) => void;
  setActiveVideoDevice: (dev: DeviceProfile | null) => void;
  setActiveAudioDevice: (dev: DeviceProfile | null) => void;
  setStreamMetrics: (metrics: Partial<StudioState["streamMetrics"]>) => void;
  setDaemonStatus: (status: DaemonStatus | null) => void;
  setDaemonScanning: (scanning: boolean) => void;
  setDaemonError: (error: string | null) => void;
  setAudioLevels: (levels: { left: number; right: number; peak: number }) => void;
  setAudioMuted: (muted: boolean) => void;
  setMasterVolume: (vol: number) => void;
  setConnectModalOpen: (open: boolean) => void;
  setDropzoneOpen: (open: boolean) => void;
  setRecordActive: (active: boolean) => void;
  setActiveStudioTab: (tab: StudioState["activeStudioTab"]) => void;
  setStudioDockTab: (tab: "vault" | "copilot" | "inspector") => void;
  setDockPosition: (pos: "side" | "bottom") => void;
  setWorkspacePreset: (preset: "balanced" | "focus_timeline" | "focus_monitor") => void;
  disconnectStream: () => void;

  // Media Library actions
  setMediaLibraryOpen: (open: boolean) => void;
  setMediaFilter: (filter: StudioState["mediaFilter"]) => void;
  setSemanticQuery: (query: string) => void;
  setIsSearching: (isSearching: boolean) => void;
  setMediaAssets: (assets: AssetRecord[]) => void;
  addMediaAsset: (asset: AssetRecord) => void;
  enqueueUpload: (item: UploadQueueItem) => void;
  updateUploadProgress: (id: string, updates: Partial<UploadQueueItem>) => void;
  clearCompletedUploads: () => void;
}

export const useStudioStore = create<StudioState>((set, get) => ({
  connectionMode: "disconnected",
  activeStream: null,
  activeVideoDevice: null,
  activeAudioDevice: null,
  streamMetrics: {
    width: 0,
    height: 0,
    fps: 0,
    bitrateKbps: 0,
    latencyMs: 0,
  },

  daemonStatus: null,
  isDaemonScanning: false,
  daemonError: null,

  audioLevels: {
    left: 0,
    right: 0,
    peak: 0,
  },
  isAudioMuted: false,
  masterVolume: 1.0,

  uploadQueue: [],
  mediaAssets: [],
  isMediaLibraryOpen: true,
  mediaFilter: "all",
  semanticQuery: "",
  isSearching: false,

  studioDockTab: "vault",
  dockPosition: "side",
  workspacePreset: "balanced",

  isConnectModalOpen: false,
  isDropzoneOpen: false,
  isRecordActive: false,
  activeStudioTab: "monitor",

  setConnectionMode: (mode) => set({ connectionMode: mode }),
  setActiveStream: (stream) => set({ activeStream: stream }),
  setActiveVideoDevice: (dev) => set({ activeVideoDevice: dev }),
  setActiveAudioDevice: (dev) => set({ activeAudioDevice: dev }),
  setStreamMetrics: (metrics) =>
    set((state) => ({
      streamMetrics: { ...state.streamMetrics, ...metrics },
    })),
  setDaemonStatus: (status) => set({ daemonStatus: status }),
  setDaemonScanning: (isDaemonScanning) => set({ isDaemonScanning }),
  setDaemonError: (daemonError) => set({ daemonError }),
  setAudioLevels: (audioLevels) => set({ audioLevels }),
  setAudioMuted: (isAudioMuted) => set({ isAudioMuted }),
  setMasterVolume: (masterVolume) => set({ masterVolume }),
  setConnectModalOpen: (isConnectModalOpen) => set({ isConnectModalOpen }),
  setDropzoneOpen: (isDropzoneOpen) => set({ isDropzoneOpen }),
  setRecordActive: (isRecordActive) => set({ isRecordActive }),
  setActiveStudioTab: (activeStudioTab) => set({ activeStudioTab }),
  setStudioDockTab: (studioDockTab) => set({ studioDockTab }),
  setDockPosition: (dockPosition) => set({ dockPosition }),
  setWorkspacePreset: (workspacePreset) => set({ workspacePreset }),

  setMediaLibraryOpen: (isMediaLibraryOpen) => set({ isMediaLibraryOpen }),
  setMediaFilter: (mediaFilter) => set({ mediaFilter }),
  setSemanticQuery: (semanticQuery) => set({ semanticQuery }),
  setIsSearching: (isSearching) => set({ isSearching }),
  setMediaAssets: (mediaAssets) => set({ mediaAssets }),
  addMediaAsset: (asset) =>
    set((state) => ({
      mediaAssets: [asset, ...state.mediaAssets.filter((a) => a.id !== asset.id)],
    })),

  enqueueUpload: (item) =>
    set((state) => ({
      uploadQueue: [item, ...state.uploadQueue],
    })),

  updateUploadProgress: (id, updates) =>
    set((state) => ({
      uploadQueue: state.uploadQueue.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),

  clearCompletedUploads: () =>
    set((state) => ({
      uploadQueue: state.uploadQueue.filter((item) => item.stage !== "indexed"),
    })),

  disconnectStream: () => {
    const { activeStream } = get();
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }
    set({
      activeStream: null,
      connectionMode: "disconnected",
      streamMetrics: {
        width: 0,
        height: 0,
        fps: 0,
        bitrateKbps: 0,
        latencyMs: 0,
      },
      audioLevels: { left: 0, right: 0, peak: 0 },
    });
  },
}));
