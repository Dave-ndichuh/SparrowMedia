import { create } from "zustand";
import { EditDecisionList, Track, Clip } from "@sparrow/edl";

export interface EDLState {
  edl: EditDecisionList;
  playheadTime: number; // In seconds
  isPlaying: boolean;
  zoom: number;         // Pixels per second
  scrollLeft: number;   // Horizontal scroll offset in pixels
  selectedClipId: string | null;
  activeSnapLine: number | null;
  snappingEnabled: boolean;

  // History Stack (Undo / Redo)
  past: EditDecisionList[];
  future: EditDecisionList[];
  lastActionDescription: string | null;

  // AI Copilot UI Drawer
  isCopilotOpen: boolean;

  // Actions
  setPlayheadTime: (time: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setZoom: (zoom: number) => void;
  setScrollLeft: (scrollLeft: number) => void;
  setSelectedClipId: (id: string | null) => void;
  setSnappingEnabled: (enabled: boolean) => void;
  setCopilotOpen: (open: boolean) => void;

  // Undo / Redo & AI Mutation
  applyAIEdit: (newEdl: EditDecisionList, description: string) => void;
  undo: () => void;
  redo: () => void;

  // Clip manipulation
  addClipToTrack: (
    trackId: string,
    clipData: Omit<Clip, "id" | "trackId" | "effects"> & { effects?: Clip["effects"] }
  ) => Clip;
  moveClip: (clipId: string, newTimelineStart: number, newTrackId?: string) => void;
  trimClip: (clipId: string, edge: "left" | "right", newBoundaryTime: number) => void;
  splitClipAtPlayhead: (clipId?: string) => void;
  deleteClip: (clipId: string) => void;
  setClipWaveform: (clipId: string, peaks: number[]) => void;

  // Track controls
  toggleTrackMute: (trackId: string) => void;
  toggleTrackLock: (trackId: string) => void;
  toggleTrackSolo: (trackId: string) => void;
  setTrackVolume: (trackId: string, volume: number) => void;

  // Magnetic Snapping helper
  findSnapPoint: (
    targetTime: number,
    excludeClipId?: string,
    snapRadiusPx?: number
  ) => { snappedTime: number; isSnapped: boolean };
}

const DEFAULT_TRACKS: Track[] = [
  { id: "v1", name: "V1: Main", type: "video", muted: false, locked: false, volume: 1.0, clips: [] },
  { id: "v2", name: "V2: B-Roll", type: "video", muted: false, locked: false, volume: 1.0, clips: [] },
  { id: "v3", name: "V3: Graphics", type: "graphics", muted: false, locked: false, volume: 1.0, clips: [] },
  { id: "a1", name: "A1: Primary Audio", type: "audio", muted: false, locked: false, volume: 1.0, clips: [] },
  { id: "a2", name: "A2: Music / FX", type: "audio", muted: false, locked: false, volume: 1.0, clips: [] },
];

const INITIAL_EDL: EditDecisionList = {
  id: "edl_master_001",
  title: "Main Studio Timeline",
  fps: 60.0,
  duration: 300.0,
  resolution: { width: 1920, height: 1080 },
  tracks: DEFAULT_TRACKS,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const useEDLStore = create<EDLState>((set, get) => ({
  edl: INITIAL_EDL,
  playheadTime: 0.0,
  isPlaying: false,
  zoom: 50,
  scrollLeft: 0,
  selectedClipId: null,
  activeSnapLine: null,
  snappingEnabled: true,

  past: [],
  future: [],
  lastActionDescription: null,
  isCopilotOpen: false,

  setPlayheadTime: (time) => {
    const clamped = Math.max(0, Math.min(get().edl.duration, time));
    set({ playheadTime: clamped });
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(300, zoom)) }),
  setScrollLeft: (scrollLeft) => set({ scrollLeft: Math.max(0, scrollLeft) }),
  setSelectedClipId: (selectedClipId) => set({ selectedClipId }),
  setSnappingEnabled: (snappingEnabled) => set({ snappingEnabled }),
  setCopilotOpen: (isCopilotOpen) => set({ isCopilotOpen }),

  applyAIEdit: (newEdl, description) => {
    set((state) => ({
      past: [...state.past, state.edl],
      future: [],
      edl: newEdl,
      lastActionDescription: description,
    }));
  },

  undo: () => {
    const { past, future, edl } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    set({
      past: newPast,
      future: [edl, ...future],
      edl: previous,
      lastActionDescription: "Undone to previous state",
    });
  },

  redo: () => {
    const { past, future, edl } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    set({
      past: [...past, edl],
      future: newFuture,
      edl: next,
      lastActionDescription: "Redone to next state",
    });
  },

  addClipToTrack: (trackId, clipData) => {
    const newId = `clip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newClip: Clip = {
      ...clipData,
      id: newId,
      trackId,
      effects: clipData.effects || [],
    };

    set((state) => {
      const updatedTracks = state.edl.tracks.map((track) => {
        if (track.id === trackId) {
          return {
            ...track,
            clips: [...track.clips, newClip].sort((a, b) => a.timelineStart - b.timelineStart),
          };
        }
        return track;
      });

      const maxClipEnd = Math.max(
        ...updatedTracks.flatMap((t) => t.clips.map((c) => c.timelineStart + c.duration)),
        state.edl.duration
      );

      return {
        past: [...state.past, state.edl],
        future: [],
        edl: {
          ...state.edl,
          duration: Math.max(maxClipEnd + 30, state.edl.duration),
          tracks: updatedTracks,
          version: state.edl.version + 1,
          updatedAt: new Date().toISOString(),
        },
        selectedClipId: newId,
      };
    });

    return newClip;
  },

  moveClip: (clipId, newTimelineStart, newTrackId) => {
    set((state) => {
      let targetClip: Clip | null = null;
      let sourceTrackId: string | null = null;

      for (const track of state.edl.tracks) {
        const found = track.clips.find((c) => c.id === clipId);
        if (found) {
          targetClip = { ...found };
          sourceTrackId = track.id;
          break;
        }
      }

      if (!targetClip || !sourceTrackId) return state;

      const destinationTrackId = newTrackId || sourceTrackId;
      targetClip.timelineStart = Math.max(0, newTimelineStart);
      targetClip.trackId = destinationTrackId;

      const updatedTracks = state.edl.tracks.map((track) => {
        if (track.id === sourceTrackId && sourceTrackId !== destinationTrackId) {
          return {
            ...track,
            clips: track.clips.filter((c) => c.id !== clipId),
          };
        }
        if (track.id === destinationTrackId) {
          const filtered = track.clips.filter((c) => c.id !== clipId);
          return {
            ...track,
            clips: [...filtered, targetClip!].sort((a, b) => a.timelineStart - b.timelineStart),
          };
        }
        return track;
      });

      return {
        edl: {
          ...state.edl,
          tracks: updatedTracks,
          version: state.edl.version + 1,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  trimClip: (clipId, edge, newBoundaryTime) => {
    set((state) => {
      const updatedTracks = state.edl.tracks.map((track) => {
        const clipIdx = track.clips.findIndex((c) => c.id === clipId);
        if (clipIdx === -1) return track;

        const clip = { ...track.clips[clipIdx] };
        const originalEnd = clip.timelineStart + clip.duration;

        if (edge === "left") {
          const clampedStart = Math.min(newBoundaryTime, originalEnd - 0.2);
          const delta = clampedStart - clip.timelineStart;
          clip.timelineStart = Math.max(0, clampedStart);
          clip.inPoint = Math.max(0, clip.inPoint + delta);
          clip.duration = Math.max(0.2, originalEnd - clip.timelineStart);
        } else {
          const clampedEnd = Math.max(newBoundaryTime, clip.timelineStart + 0.2);
          const newDuration = clampedEnd - clip.timelineStart;
          clip.duration = newDuration;
          clip.outPoint = clip.inPoint + newDuration;
        }

        const newClips = [...track.clips];
        newClips[clipIdx] = clip;
        return { ...track, clips: newClips };
      });

      return {
        edl: {
          ...state.edl,
          tracks: updatedTracks,
          version: state.edl.version + 1,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  splitClipAtPlayhead: (targetClipId) => {
    const { edl, playheadTime } = get();
    let splitClipId = targetClipId;

    if (!splitClipId) {
      for (const track of edl.tracks) {
        const found = track.clips.find(
          (c) => playheadTime > c.timelineStart && playheadTime < c.timelineStart + c.duration
        );
        if (found) {
          splitClipId = found.id;
          break;
        }
      }
    }

    if (!splitClipId) return;

    set((state) => {
      const updatedTracks = state.edl.tracks.map((track) => {
        const clipIdx = track.clips.findIndex((c) => c.id === splitClipId);
        if (clipIdx === -1) return track;

        const original = track.clips[clipIdx];
        if (playheadTime <= original.timelineStart || playheadTime >= original.timelineStart + original.duration) {
          return track;
        }

        const firstDuration = playheadTime - original.timelineStart;
        const secondDuration = original.duration - firstDuration;

        const firstPart: Clip = {
          ...original,
          duration: firstDuration,
          outPoint: original.inPoint + firstDuration,
        };

        const secondPart: Clip = {
          ...original,
          id: `clip_${Date.now()}_split`,
          timelineStart: playheadTime,
          duration: secondDuration,
          inPoint: original.inPoint + firstDuration,
          outPoint: original.outPoint,
        };

        const newClips = [...track.clips];
        newClips.splice(clipIdx, 1, firstPart, secondPart);
        return { ...track, clips: newClips };
      });

      return {
        past: [...state.past, state.edl],
        future: [],
        edl: {
          ...state.edl,
          tracks: updatedTracks,
          version: state.edl.version + 1,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  deleteClip: (clipId) => {
    set((state) => ({
      past: [...state.past, state.edl],
      future: [],
      edl: {
        ...state.edl,
        tracks: state.edl.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((c) => c.id !== clipId),
        })),
        version: state.edl.version + 1,
        updatedAt: new Date().toISOString(),
      },
      selectedClipId: state.selectedClipId === clipId ? null : state.selectedClipId,
    }));
  },

  setClipWaveform: (clipId, peaks) => {
    set((state) => ({
      edl: {
        ...state.edl,
        tracks: state.edl.tracks.map((track) => ({
          ...track,
          clips: track.clips.map((clip) =>
            clip.id === clipId ? { ...clip, waveformPeaks: peaks } : clip
          ),
        })),
      },
    }));
  },

  toggleTrackMute: (trackId) => {
    set((state) => ({
      edl: {
        ...state.edl,
        tracks: state.edl.tracks.map((t) =>
          t.id === trackId ? { ...t, muted: !t.muted } : t
        ),
      },
    }));
  },

  toggleTrackLock: (trackId) => {
    set((state) => ({
      edl: {
        ...state.edl,
        tracks: state.edl.tracks.map((t) =>
          t.id === trackId ? { ...t, locked: !t.locked } : t
        ),
      },
    }));
  },

  toggleTrackSolo: (trackId) => {
    set((state) => {
      const currentTrack = state.edl.tracks.find((t) => t.id === trackId);
      const isCurrentlySoloed = currentTrack && !currentTrack.muted;
      // If turning on solo: unmute this track, mute others of the same kind (video/audio)
      const targetType = currentTrack?.type;
      return {
        edl: {
          ...state.edl,
          tracks: state.edl.tracks.map((t) => {
            if (t.type !== targetType) return t;
            if (t.id === trackId) return { ...t, muted: false };
            return { ...t, muted: isCurrentlySoloed ? false : true };
          }),
        },
      };
    });
  },

  setTrackVolume: (trackId, volume) => {
    set((state) => ({
      edl: {
        ...state.edl,
        tracks: state.edl.tracks.map((t) =>
          t.id === trackId ? { ...t, volume: Math.max(0, Math.min(2.0, volume)) } : t
        ),
      },
    }));
  },

  findSnapPoint: (targetTime, excludeClipId, snapRadiusPx = 10) => {
    const { edl, playheadTime, zoom, snappingEnabled } = get();
    if (!snappingEnabled) {
      return { snappedTime: targetTime, isSnapped: false };
    }

    const timeThreshold = snapRadiusPx / zoom;
    const candidates: number[] = [0, playheadTime];

    for (const track of edl.tracks) {
      for (const clip of track.clips) {
        if (clip.id === excludeClipId) continue;
        candidates.push(clip.timelineStart);
        candidates.push(clip.timelineStart + clip.duration);
      }
    }

    let closestDist = Infinity;
    let closestSnap = targetTime;

    for (const point of candidates) {
      const dist = Math.abs(targetTime - point);
      if (dist <= timeThreshold && dist < closestDist) {
        closestDist = dist;
        closestSnap = point;
      }
    }

    const isSnapped = closestDist < Infinity;
    set({ activeSnapLine: isSnapped ? closestSnap : null });
    return { snappedTime: closestSnap, isSnapped };
  },
}));
