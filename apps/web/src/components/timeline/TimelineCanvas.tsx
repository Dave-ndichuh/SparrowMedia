"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { useEDLStore } from "@/lib/store/useEDLStore";
import { formatRulerTick } from "@/lib/utils/timecode";
import { Track, Clip } from "@sparrow/edl";

const RULER_HEIGHT = 28;
const TRACK_HEIGHT = 44;
const TRACK_GAP = 4;
const HEADER_WIDTH = 200;
const TRIM_HANDLE_WIDTH = 8;

export const TimelineCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    edl,
    zoom,
    scrollLeft,
    setScrollLeft,
    setPlayheadTime,
    selectedClipId,
    setSelectedClipId,
    moveClip,
    trimClip,
    addClipToTrack,
    findSnapPoint,
    toggleTrackMute,
    toggleTrackSolo,
    toggleTrackLock,
  } = useEDLStore();

  // Interaction drag states
  const dragRef = useRef<{
    type: "scrub" | "move_clip" | "trim_left" | "trim_right" | null;
    clipId: string | null;
    trackId: string | null;
    initialMouseX: number;
    initialMouseY: number;
    initialClipStart: number;
    initialClipDuration: number;
  }>({
    type: null,
    clipId: null,
    trackId: null,
    initialMouseX: 0,
    initialMouseY: 0,
    initialClipStart: 0,
    initialClipDuration: 0,
  });

  const lastFrameTimeRef = useRef<number>(performance.now());
  const animIdRef = useRef<number | null>(null);

  // Time to pixel conversion
  const timeToX = useCallback((t: number) => t * zoom - scrollLeft, [zoom, scrollLeft]);
  const xToTime = useCallback((x: number) => (x + scrollLeft) / zoom, [zoom, scrollLeft]);

  // 60FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isDestroyed = false;

    const render = () => {
      if (isDestroyed) return;
      const now = performance.now();
      const dt = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      const store = useEDLStore.getState();

      // Advance playhead during active playback
      if (store.isPlaying) {
        const nextTime = store.playheadTime + dt;
        if (nextTime >= store.edl.duration) {
          store.setPlayheadTime(0);
          store.setIsPlaying(false);
        } else {
          store.setPlayheadTime(nextTime);
        }
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Reset transform & clear
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#090A0F";
      ctx.fillRect(0, 0, width, height);

      const tracks = store.edl.tracks;
      const playheadX = store.playheadTime * store.zoom - store.scrollLeft;

      // 1. Draw Track Lanes Background
      let currentY = RULER_HEIGHT;
      tracks.forEach((track, idx) => {
        ctx.fillStyle = idx % 2 === 0 ? "#0F111A" : "#141724";
        ctx.fillRect(0, currentY, width, TRACK_HEIGHT);

        // Track bottom divider
        ctx.strokeStyle = "#1A1E2E";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, currentY + TRACK_HEIGHT);
        ctx.lineTo(width, currentY + TRACK_HEIGHT);
        ctx.stroke();

        currentY += TRACK_HEIGHT + TRACK_GAP;
      });

      // 2. Draw Clips inside Tracks
      currentY = RULER_HEIGHT;
      tracks.forEach((track) => {
        for (const clip of track.clips) {
          const clipX = clip.timelineStart * store.zoom - store.scrollLeft;
          const clipW = clip.duration * store.zoom;
          const clipY = currentY + 2;
          const clipH = TRACK_HEIGHT - 4;

          // Cull clips outside visible canvas
          if (clipX + clipW < 0 || clipX > width) continue;

          const isSelected = store.selectedClipId === clip.id;

          // Apply track mute opacity dimming
          ctx.save();
          if (track.muted) {
            ctx.globalAlpha = 0.35;
          }

          // Clip Body Fill
          let gradient = ctx.createLinearGradient(clipX, clipY, clipX, clipY + clipH);
          if (track.type === "graphics") {
            gradient.addColorStop(0, "#059669");
            gradient.addColorStop(1, "#047857");
          } else if (track.type === "audio") {
            gradient.addColorStop(0, "#4f46e5");
            gradient.addColorStop(1, "#3730a3");
          } else if (track.id === "v2") {
            gradient.addColorStop(0, "#6366f1");
            gradient.addColorStop(1, "#4f46e5");
          } else {
            gradient.addColorStop(0, "#0284c7");
            gradient.addColorStop(1, "#0369a1");
          }

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(clipX, clipY, clipW, clipH, 4);
          ctx.fill();

          // Selection border
          ctx.strokeStyle = isSelected ? "#38bdf8" : "rgba(255,255,255,0.15)";
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();

          // Draw Audio Waveform if present
          if (track.type === "audio" && clip.waveformPeaks && clip.waveformPeaks.length > 0) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
            const peaks = clip.waveformPeaks;
            const barW = Math.max(1, clipW / peaks.length);
            const centerY = clipY + clipH / 2;

            for (let pIdx = 0; pIdx < peaks.length; pIdx++) {
              const bx = clipX + pIdx * barW;
              if (bx > clipX + clipW) break;
              const barH = peaks[pIdx] * (clipH * 0.7);
              ctx.fillRect(bx, centerY - barH / 2, Math.max(1, barW - 0.5), barH);
            }
          }

          // Clip Title text
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px system-ui, sans-serif";
          ctx.save();
          ctx.beginPath();
          ctx.rect(clipX + 8, clipY, clipW - 16, clipH);
          ctx.clip();
          ctx.fillText(clip.title, clipX + 8, clipY + 16);

          // Sub-duration
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "9px monospace";
          ctx.fillText(`${clip.duration.toFixed(1)}s`, clipX + 8, clipY + 28);
          ctx.restore();

          // Trim handles (left and right edges)
          if (isSelected) {
            ctx.fillStyle = "#38bdf8";
            ctx.fillRect(clipX, clipY, 3, clipH);
            ctx.fillRect(clipX + clipW - 3, clipY, 3, clipH);
          }

          ctx.restore(); // Restore track-level mute save
        }
        currentY += TRACK_HEIGHT + TRACK_GAP;
      });

      // 3. Draw Magnetic Snap Guide Line
      if (store.activeSnapLine !== null) {
        const snapX = store.activeSnapLine * store.zoom - store.scrollLeft;
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(snapX, 0);
        ctx.lineTo(snapX, height);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 4. Draw Time Ruler at Top
      ctx.fillStyle = "#0F111A";
      ctx.fillRect(0, 0, width, RULER_HEIGHT);
      ctx.strokeStyle = "#262C42";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, RULER_HEIGHT);
      ctx.lineTo(width, RULER_HEIGHT);
      ctx.stroke();

      // Dynamic Ruler Ticks based on zoom
      const secStep = store.zoom > 80 ? 1 : store.zoom > 30 ? 2 : 5;
      const startTime = Math.floor(store.scrollLeft / store.zoom);
      const endTime = Math.ceil((store.scrollLeft + width) / store.zoom);

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      for (let s = startTime; s <= endTime; s += secStep) {
        const tx = s * store.zoom - store.scrollLeft;
        ctx.strokeStyle = s % 5 === 0 ? "#475569" : "#334155";
        ctx.beginPath();
        ctx.moveTo(tx, RULER_HEIGHT - (s % 5 === 0 ? 12 : 6));
        ctx.lineTo(tx, RULER_HEIGHT);
        ctx.stroke();

        if (s % (secStep * 2) === 0 || s % 5 === 0) {
          ctx.fillText(formatRulerTick(s), tx + 3, RULER_HEIGHT - 12);
        }
      }

      // 5. Draw Playhead Needle
      if (playheadX >= -10 && playheadX <= width + 10) {
        // Red vertical tracking needle
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(playheadX, RULER_HEIGHT);
        ctx.lineTo(playheadX, height);
        ctx.stroke();

        // Top Header Needle Tag
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, 0);
        ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX + 6, RULER_HEIGHT - 6);
        ctx.lineTo(playheadX, RULER_HEIGHT);
        ctx.lineTo(playheadX - 6, RULER_HEIGHT - 6);
        ctx.closePath();
        ctx.fill();
      }

      animIdRef.current = requestAnimationFrame(render);
    };

    animIdRef.current = requestAnimationFrame(render);

    return () => {
      isDestroyed = true;
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    };
  }, []);

  // Resize canvas when container size changes
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(10, container.clientWidth - HEADER_WIDTH);
      const h = Math.max(10, container.clientHeight);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    handleResize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      ro = new ResizeObserver(handleResize);
      ro.observe(containerRef.current);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Hit-testing helper
  const hitTest = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      if (y < RULER_HEIGHT) {
        return { type: "ruler", time: xToTime(x) };
      }

      const store = useEDLStore.getState();
      const trackIndex = Math.floor((y - RULER_HEIGHT) / (TRACK_HEIGHT + TRACK_GAP));
      if (trackIndex < 0 || trackIndex >= store.edl.tracks.length) return null;

      const track = store.edl.tracks[trackIndex];
      const clickTime = xToTime(x);

      // Search clips in track
      for (const clip of track.clips) {
        if (clickTime >= clip.timelineStart && clickTime <= clip.timelineStart + clip.duration) {
          const clipStartX = timeToX(clip.timelineStart);
          const clipEndX = timeToX(clip.timelineStart + clip.duration);

          // Left trim edge check
          if (Math.abs(x - clipStartX) <= TRIM_HANDLE_WIDTH) {
            return { type: "trim_left", clip, track };
          }
          // Right trim edge check
          if (Math.abs(x - clipEndX) <= TRIM_HANDLE_WIDTH) {
            return { type: "trim_right", clip, track };
          }
          return { type: "clip", clip, track };
        }
      }

      return { type: "empty_track", track, time: clickTime };
    },
    [xToTime, timeToX]
  );

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;

    if (hit.type === "ruler") {
      dragRef.current = {
        type: "scrub",
        clipId: null,
        trackId: null,
        initialMouseX: e.clientX,
        initialMouseY: e.clientY,
        initialClipStart: 0,
        initialClipDuration: 0,
      };
      setPlayheadTime(hit.time!);
    } else if (hit.type === "clip") {
      setSelectedClipId(hit.clip!.id);
      if (!hit.track!.locked) {
        dragRef.current = {
          type: "move_clip",
          clipId: hit.clip!.id,
          trackId: hit.track!.id,
          initialMouseX: e.clientX,
          initialMouseY: e.clientY,
          initialClipStart: hit.clip!.timelineStart,
          initialClipDuration: hit.clip!.duration,
        };
      }
    } else if (hit.type === "trim_left") {
      setSelectedClipId(hit.clip!.id);
      if (!hit.track!.locked) {
        dragRef.current = {
          type: "trim_left",
          clipId: hit.clip!.id,
          trackId: hit.track!.id,
          initialMouseX: e.clientX,
          initialMouseY: e.clientY,
          initialClipStart: hit.clip!.timelineStart,
          initialClipDuration: hit.clip!.duration,
        };
      }
    } else if (hit.type === "trim_right") {
      setSelectedClipId(hit.clip!.id);
      if (!hit.track!.locked) {
        dragRef.current = {
          type: "trim_right",
          clipId: hit.clip!.id,
          trackId: hit.track!.id,
          initialMouseX: e.clientX,
          initialMouseY: e.clientY,
          initialClipStart: hit.clip!.timelineStart,
          initialClipDuration: hit.clip!.duration,
        };
      }
    } else if (hit.type === "empty_track") {
      setSelectedClipId(null);
      setPlayheadTime(hit.time!);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cursor Styling when hovering
    if (!drag.type) {
      const hit = hitTest(e.clientX, e.clientY);
      if (hit?.type === "trim_left" || hit?.type === "trim_right") {
        canvas.style.cursor = "ew-resize";
      } else if (hit?.type === "clip") {
        canvas.style.cursor = "grab";
      } else if (hit?.type === "ruler") {
        canvas.style.cursor = "pointer";
      } else {
        canvas.style.cursor = "default";
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentTime = xToTime(currentX);

    if (drag.type === "scrub") {
      setPlayheadTime(currentTime);
    } else if (drag.type === "move_clip" && drag.clipId) {
      const deltaSec = (e.clientX - drag.initialMouseX) / zoom;
      const rawStart = drag.initialClipStart + deltaSec;

      // Determine track hover
      const trackIndex = Math.floor((e.clientY - rect.top - RULER_HEIGHT) / (TRACK_HEIGHT + TRACK_GAP));
      const targetTrack = edl.tracks[trackIndex];
      const targetTrackId = targetTrack ? targetTrack.id : drag.trackId!;

      // Magnetic snap
      const { snappedTime } = findSnapPoint(rawStart, drag.clipId, 10);
      moveClip(drag.clipId, snappedTime, targetTrackId);
    } else if (drag.type === "trim_left" && drag.clipId) {
      const { snappedTime } = findSnapPoint(currentTime, drag.clipId, 10);
      trimClip(drag.clipId, "left", snappedTime);
    } else if (drag.type === "trim_right" && drag.clipId) {
      const { snappedTime } = findSnapPoint(currentTime, drag.clipId, 10);
      trimClip(drag.clipId, "right", snappedTime);
    }
  };

  const handleMouseUp = () => {
    dragRef.current = {
      type: null,
      clipId: null,
      trackId: null,
      initialMouseX: 0,
      initialMouseY: 0,
      initialClipStart: 0,
      initialClipDuration: 0,
    };
    useEDLStore.setState({ activeSnapLine: null });
  };

  // Horizontal pan & zoom on wheel
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || e.altKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      useEDLStore.getState().setZoom(zoom * zoomFactor);
    } else {
      // Horizontal pan
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      setScrollLeft(scrollLeft + delta * 0.8);
    }
  };

  // Drag and drop from Media Vault onto Timeline Canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rawData = e.dataTransfer.getData("application/json");
    if (!rawData) return;

    try {
      const asset = JSON.parse(rawData);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const dropTime = Math.max(0, xToTime(x));
      const trackIndex = Math.floor((y - RULER_HEIGHT) / (TRACK_HEIGHT + TRACK_GAP));
      const targetTrack =
        edl.tracks[trackIndex] ||
        (asset.file_type === "audio" ? edl.tracks.find((t) => t.type === "audio") : edl.tracks[0]);

      if (!targetTrack) return;

      const duration = asset.duration > 0 ? asset.duration : 10.0;

      // Add clip to track
      const newClip = addClipToTrack(targetTrack.id, {
        assetId: asset.id,
        title: asset.title,
        timelineStart: dropTime,
        duration,
        inPoint: 0,
        outPoint: duration,
        speed: 1.0,
        volume: 1.0,
        fileType: asset.file_type,
        proxyUrl: asset.proxy_url || asset.file_url,
        thumbnailUrl: asset.thumbnail_url,
      });

      // If audio, trigger waveform worker
      if (asset.file_type === "audio" || targetTrack.type === "audio") {
        extractWaveform(newClip.id, asset.proxy_url || asset.file_url);
      }
    } catch (err) {
      console.warn("Failed to drop media asset onto timeline", err);
    }
  };

  const extractWaveform = (clipId: string, url: string) => {
    try {
      const worker = new Worker("/workers/waveformWorker.js");
      worker.postMessage({ clipId, audioUrl: url, samplesPerSec: 60 });
      worker.onmessage = (e) => {
        if (e.data?.peaks) {
          useEDLStore.getState().setClipWaveform(clipId, e.data.peaks);
        }
        worker.terminate();
      };
    } catch (e) {
      console.warn("Waveform worker unavailable", e);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex h-full w-full bg-studio-950 overflow-hidden select-none"
    >
      {/* Left Track Headers Deck */}
      <div
        className="flex-shrink-0 bg-studio-900 border-r border-studio-800 z-10 flex flex-col select-none"
        style={{ width: `${HEADER_WIDTH}px` }}
      >
        {/* Ruler Header Blank */}
        <div
          className="bg-studio-950 border-b border-studio-800 flex items-center justify-between px-3 text-[10px] font-mono text-slate-500 font-bold"
          style={{ height: `${RULER_HEIGHT}px` }}
        >
          <span>TRACKS</span>
          <span className="text-[9px] text-slate-600 font-mono tracking-wider">M / S / L</span>
        </div>

        {/* Track Label Rows */}
        <div className="flex-1 flex flex-col">
          {edl.tracks.map((track) => (
            <div
              key={track.id}
              className={`flex items-center justify-between px-2.5 border-b border-studio-800/80 transition-colors ${
                track.muted ? "bg-studio-950/70 opacity-70" : "bg-studio-900/70 hover:bg-studio-850"
              }`}
              style={{ height: `${TRACK_HEIGHT + TRACK_GAP}px` }}
            >
              {/* Left: Indicator & Track Name */}
              <div className="flex items-center gap-1.5 min-w-0 pr-1">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    track.type === "graphics"
                      ? "bg-emerald-400"
                      : track.type === "audio"
                      ? "bg-indigo-400"
                      : "bg-sky-400"
                  }`}
                />
                <span
                  className="text-xs font-semibold text-slate-200 truncate max-w-[88px]"
                  title={track.name}
                >
                  {track.name}
                </span>
              </div>

              {/* Right: Controls Cluster (Mute, Solo, Lock) */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Mute Toggle */}
                <button
                  onClick={() => toggleTrackMute(track.id)}
                  className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition ${
                    track.muted
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "bg-studio-950 text-slate-500 hover:text-slate-200 hover:bg-studio-800"
                  }`}
                  title={track.muted ? "Unmute Track (M)" : "Mute Track (M)"}
                >
                  M
                </button>

                {/* Solo Toggle */}
                <button
                  onClick={() => toggleTrackSolo(track.id)}
                  className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition ${
                    !track.muted &&
                    edl.tracks.some((t) => t.type === track.type && t.muted && t.id !== track.id)
                      ? "bg-emerald-500 text-slate-950 shadow-sm"
                      : "bg-studio-950 text-slate-500 hover:text-slate-200 hover:bg-studio-800"
                  }`}
                  title="Solo Track (S)"
                >
                  S
                </button>

                {/* Lock Toggle */}
                <button
                  onClick={() => toggleTrackLock(track.id)}
                  className={`w-4 h-4 rounded text-[9px] font-mono font-bold flex items-center justify-center transition ${
                    track.locked
                      ? "bg-rose-500 text-slate-950 shadow-sm"
                      : "bg-studio-950 text-slate-500 hover:text-slate-200 hover:bg-studio-800"
                  }`}
                  title={track.locked ? "Unlock Track (L)" : "Lock Track (L)"}
                >
                  L
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main 60fps Canvas Viewport */}
      <div className="relative flex-1 h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="block w-full h-full"
        />
      </div>
    </div>
  );
};
