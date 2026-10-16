"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Film,
  Music,
  Image as ImageIcon,
  Layers,
  Search,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Upload,
  Play,
  Clock,
  Tag,
  X,
  RefreshCw,
  Plus,
  LayoutGrid,
  Bot,
  SlidersHorizontal,
  Scissors,
  Trash2,
  Volume2,
  VolumeX,
  RotateCcw,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PanelLeftClose,
  PanelLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useStudioStore, UploadQueueItem } from "@/lib/store/useStudioStore";
import { useEDLStore } from "@/lib/store/useEDLStore";
import {
  fetchAssets,
  searchAssetsSemantic,
  uploadMediaAsset,
  AssetRecord,
} from "@/lib/api/assetsClient";
import { requestAgentEdit, AgentEditResponse } from "@/lib/api/agentsClient";
import { secondsToTimecode } from "@/lib/utils/timecode";

interface StudioDockPanelProps {
  isBottomDock?: boolean;
}

export const StudioDockPanel: React.FC<StudioDockPanelProps> = ({ isBottomDock = false }) => {
  const {
    mediaAssets,
    setMediaAssets,
    addMediaAsset,
    mediaFilter,
    setMediaFilter,
    semanticQuery,
    setSemanticQuery,
    isSearching,
    setIsSearching,
    isMediaLibraryOpen,
    setMediaLibraryOpen,
    studioDockTab,
    setStudioDockTab,
    dockPosition,
    setDockPosition,
    enqueueUpload,
    updateUploadProgress,
  } = useStudioStore();

  const {
    edl,
    selectedClipId,
    deleteClip,
    splitClipAtPlayhead,
    applyAIEdit,
    undo,
    redo,
    past,
    future,
    lastActionDescription,
  } = useEDLStore();

  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Copilot Agent State
  const [copilotPrompt, setCopilotPrompt] = useState("");
  const [isAgentLoading, setIsAgentLoading] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [agentEdits, setAgentEdits] = useState<AgentEditResponse["proposed_edits"]>([]);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentLogs]);

  // Initial asset load
  useEffect(() => {
    loadAssets();
  }, [mediaFilter]);

  const loadAssets = async () => {
    try {
      const data = await fetchAssets(mediaFilter);
      setMediaAssets(data);
    } catch {
      // Backend may be starting; store preserves any uploaded clips
    }
  };

  // Debounced semantic search
  const handleSearchChange = (text: string) => {
    setSemanticQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!text.trim()) {
      setIsSearching(false);
      loadAssets();
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const resp = await searchAssetsSemantic(text, mediaFilter);
        setMediaAssets(resp.results);
      } catch (err) {
        console.warn("Semantic search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 450);
  };

  const handleManualUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const queueItem: UploadQueueItem = {
        id: uploadId,
        fileName: file.name,
        fileSize: file.size,
        progress: 0,
        stage: "uploading",
        statusMessage: "Uploading file...",
      };

      enqueueUpload(queueItem);

      uploadMediaAsset(file, (evt) => {
        updateUploadProgress(uploadId, {
          progress: evt.percent,
          stage: evt.stage,
          statusMessage: evt.message,
        });
      })
        .then((asset) => {
          updateUploadProgress(uploadId, {
            progress: 100,
            stage: "indexed",
            statusMessage: "Indexed in pgvector vault",
            asset,
          });
          addMediaAsset(asset);
        })
        .catch((err) => {
          updateUploadProgress(uploadId, {
            stage: "failed",
            statusMessage: err.message || "Upload failed",
          });
        });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRunAgent = async (instruction: string) => {
    if (!instruction.trim() || isAgentLoading) return;
    setIsAgentLoading(true);
    setCopilotError(null);
    setAgentLogs(["Supervisor: Sending request to LangGraph multi-agent engine..."]);
    setAgentEdits([]);

    try {
      const resp = await requestAgentEdit(edl, instruction);
      if (resp.success) {
        setAgentLogs(resp.status_log);
        setAgentEdits(resp.proposed_edits);
        applyAIEdit(resp.edl, `AI Edit: "${instruction}"`);
        setCopilotPrompt("");
      } else {
        setCopilotError(resp.error || "Agent execution failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting AI agent backend";
      setCopilotError(msg);
      setAgentLogs((prev) => [...prev, `Error: ${msg}`]);
    } finally {
      setIsAgentLoading(false);
    }
  };

  const formatDuration = (sec: number) => {
    if (!sec) return "00:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Find currently selected clip for Inspector
  let selectedClip = null;
  let selectedTrack = null;
  if (selectedClipId) {
    for (const track of edl.tracks) {
      const found = track.clips.find((c) => c.id === selectedClipId);
      if (found) {
        selectedClip = found;
        selectedTrack = track;
        break;
      }
    }
  }

  return (
    <div
      className={`flex flex-col bg-studio-950 border-studio-800/90 rounded-xl overflow-hidden shadow-2xl transition-all duration-200 ${
        isBottomDock
          ? isMediaLibraryOpen
            ? "h-64 border-t"
            : "h-10 border-t"
          : "h-full w-full border"
      }`}
    >
      {/* Dock Top Tabbed Header */}
      <div className="h-10 px-3 bg-studio-900/95 border-b border-studio-800 flex items-center justify-between select-none flex-shrink-0">
        {/* Left: Tab Switchers */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setStudioDockTab("vault");
              if (!isMediaLibraryOpen) setMediaLibraryOpen(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              studioDockTab === "vault"
                ? "bg-studio-800 text-sky-400 shadow-sm border border-studio-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-studio-850"
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            <span>Media Vault</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-studio-950 text-slate-400 font-mono">
              {mediaAssets.length}
            </span>
          </button>

          <button
            onClick={() => {
              setStudioDockTab("copilot");
              if (!isMediaLibraryOpen) setMediaLibraryOpen(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              studioDockTab === "copilot"
                ? "bg-studio-800 text-amber-400 shadow-sm border border-studio-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-studio-850"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI Copilot</span>
          </button>

          <button
            onClick={() => {
              setStudioDockTab("inspector");
              if (!isMediaLibraryOpen) setMediaLibraryOpen(true);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition ${
              studioDockTab === "inspector"
                ? "bg-studio-800 text-emerald-400 shadow-sm border border-studio-700/60"
                : "text-slate-400 hover:text-slate-200 hover:bg-studio-850"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Inspector</span>
            {selectedClip && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Right: Dock controls & Ingest Trigger */}
        <div className="flex items-center gap-1.5">
          {studioDockTab === "vault" && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleManualUpload}
                multiple
                accept="video/*,audio/*,image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-md text-xs font-bold transition shadow-sm active:scale-95"
                title="Upload Media Assets"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ingest</span>
              </button>
            </>
          )}

          {/* Dock Position Switcher Toggle (Side vs Bottom) */}
          <button
            onClick={() => setDockPosition(dockPosition === "side" ? "bottom" : "side")}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-studio-800 transition"
            title={dockPosition === "side" ? "Dock Panel to Bottom" : "Dock Panel to Upper Left"}
          >
            {dockPosition === "side" ? (
              <ArrowDownToLine className="w-3.5 h-3.5" />
            ) : (
              <ArrowUpFromLine className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            onClick={() => setMediaLibraryOpen(!isMediaLibraryOpen)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-studio-800 transition"
            title={isMediaLibraryOpen ? "Collapse Panel" : "Expand Panel"}
          >
            {isMediaLibraryOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Dock Content Body */}
      {isMediaLibraryOpen && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* TAB 1: MEDIA VAULT */}
          {studioDockTab === "vault" && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Search & Filter Header Sub-bar */}
              <div className="p-2 border-b border-studio-800/80 bg-studio-950/90 flex flex-col gap-2">
                {/* Natural Language Semantic Search Input */}
                <div className="relative flex items-center">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={semanticQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search clips (e.g. 'sunset b-roll', 'dramatic sound')..."
                    className="w-full bg-studio-900 border border-studio-800 focus:border-sky-500 rounded-lg pl-8 pr-7 py-1 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition"
                  />
                  {semanticQuery ? (
                    <button
                      onClick={() => handleSearchChange("")}
                      className="absolute right-2 p-0.5 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : isSearching ? (
                    <RefreshCw className="w-3 h-3 text-sky-400 animate-spin absolute right-2 pointer-events-none" />
                  ) : null}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5">
                  {(["all", "video", "audio", "image", "graphics"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setMediaFilter(tab)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition ${
                        mediaFilter === tab
                          ? "bg-studio-800 text-sky-300 border border-studio-700/80"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset List / Grid */}
              <div
                className={`flex-1 overflow-y-auto p-2.5 min-h-0 ${
                  isBottomDock
                    ? "flex gap-2.5 overflow-x-auto overflow-y-hidden items-center"
                    : "grid grid-cols-2 gap-2"
                }`}
              >
                {mediaAssets.length === 0 ? (
                  <div className="col-span-2 w-full py-8 flex flex-col items-center justify-center text-center text-slate-500">
                    <Film className="w-8 h-8 mb-2 opacity-30 text-sky-400" />
                    <p className="text-xs font-semibold text-slate-400">
                      {semanticQuery
                        ? `No clips matching "${semanticQuery}"`
                        : "Media Vault is Empty"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                      Drag and drop files anywhere or click + Ingest above to add clips.
                    </p>
                  </div>
                ) : (
                  mediaAssets.map((asset) => (
                    <div
                      key={asset.id}
                      draggable={true}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("application/json", JSON.stringify(asset));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onMouseEnter={() => setHoveredAssetId(asset.id)}
                      onMouseLeave={() => setHoveredAssetId(null)}
                      className={`group relative bg-studio-900 rounded-lg border border-studio-800 hover:border-sky-500/70 shadow transition flex flex-col overflow-hidden cursor-grab active:cursor-grabbing ${
                        isBottomDock ? "w-48 h-40 flex-shrink-0" : "w-full"
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
                        {asset.thumbnail_url ? (
                          <img
                            src={asset.thumbnail_url}
                            alt={asset.title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-studio-950 text-slate-600">
                            {asset.file_type === "audio" ? (
                              <Music className="w-5 h-5 text-indigo-400" />
                            ) : (
                              <Film className="w-5 h-5 text-sky-400" />
                            )}
                          </div>
                        )}

                        {/* Semantic Match Pill */}
                        {asset.similarity_score !== undefined && (
                          <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-950/90 border border-emerald-500/60 text-[9px] font-mono font-bold text-emerald-300 shadow">
                            <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                            <span>{asset.similarity_score}%</span>
                          </div>
                        )}

                        {/* Duration Badge */}
                        {asset.duration > 0 && (
                          <div className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-black/85 text-[9px] font-mono text-slate-300">
                            {formatDuration(asset.duration)}
                          </div>
                        )}

                        {/* Type Chip */}
                        <div className="absolute top-1 right-1 px-1 py-0.2 rounded bg-black/85 text-[8px] uppercase font-mono text-slate-300">
                          {asset.file_type}
                        </div>
                      </div>

                      {/* Info & Add to Track */}
                      <div className="p-1.5 flex flex-col justify-between flex-1 gap-1">
                        <h4
                          className="text-[11px] font-semibold text-slate-200 truncate group-hover:text-sky-300 transition"
                          title={asset.title}
                        >
                          {asset.title}
                        </h4>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-studio-800">
                          <span>{asset.width > 0 ? `${asset.width}p` : "Audio"}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const targetTrackId = asset.file_type === "audio" ? "a1" : "v1";
                              const dur = asset.duration > 0 ? asset.duration : 10.0;
                              const currentEdl = useEDLStore.getState().edl;
                              const targetTrack = currentEdl.tracks.find(
                                (t) => t.id === targetTrackId
                              );
                              const lastClipEnd =
                                targetTrack?.clips.reduce(
                                  (acc, c) => Math.max(acc, c.timelineStart + c.duration),
                                  0
                                ) || 0;

                              useEDLStore.getState().addClipToTrack(targetTrackId, {
                                assetId: asset.id,
                                title: asset.title,
                                timelineStart: lastClipEnd,
                                duration: dur,
                                inPoint: 0,
                                outPoint: dur,
                                speed: 1.0,
                                volume: 1.0,
                                fileType: asset.file_type,
                                proxyUrl: asset.proxy_url || asset.file_url,
                                thumbnailUrl: asset.thumbnail_url || undefined,
                              });
                            }}
                            className="text-sky-400 hover:text-sky-300 font-semibold"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 2: AI COPILOT */}
          {studioDockTab === "copilot" && (
            <div className="flex-1 flex flex-col min-h-0 p-3 gap-3 overflow-y-auto">
              {/* History Revert Banner */}
              {past.length > 0 && (
                <div className="px-3 py-2 bg-amber-950/40 border border-amber-800/60 rounded-lg flex items-center justify-between text-xs text-amber-300">
                  <div className="flex items-center gap-1.5 truncate pr-2">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate text-[11px]">{lastActionDescription || "Timeline Modified"}</span>
                  </div>
                  <button
                    onClick={undo}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold shadow-sm transition active:scale-95 flex-shrink-0"
                    title="Undo last edit (Ctrl+Z)"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Undo</span>
                  </button>
                </div>
              )}

              {/* One-Click Action Presets */}
              <div>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-1.5">
                  1-Click Multi-Agent Presets
                </span>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    {
                      title: "Auto-Cut Dead Air",
                      desc: "Trim all silences > 1.2s",
                      icon: <Scissors className="w-3.5 h-3.5 text-sky-400" />,
                    },
                    {
                      title: "Overlay Relevant B-Roll",
                      desc: "Search vault & insert on V2",
                      icon: <Film className="w-3.5 h-3.5 text-indigo-400" />,
                    },
                    {
                      title: "Clean Up & Enhance Pacing",
                      desc: "Cut dead air + lay down B-roll",
                      icon: <Sparkles className="w-3.5 h-3.5 text-amber-400" />,
                    },
                  ].map((preset) => (
                    <button
                      key={preset.title}
                      onClick={() => handleRunAgent(preset.title)}
                      disabled={isAgentLoading}
                      className="flex items-center justify-between p-2 rounded-lg bg-studio-900 hover:bg-studio-850 border border-studio-800 hover:border-sky-500/50 text-left transition group"
                    >
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-studio-950">{preset.icon}</div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-sky-300">
                            {preset.title}
                          </div>
                          <div className="text-[10px] text-slate-500">{preset.desc}</div>
                        </div>
                      </div>
                      <span className="text-[10px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 transition">
                        Run &rarr;
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Real-time Agent Execution Trace */}
              <div className="flex-1 flex flex-col min-h-[120px] bg-studio-900 rounded-lg border border-studio-800 overflow-hidden">
                <div className="px-2.5 py-1.5 bg-studio-950 border-b border-studio-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="font-bold text-slate-300">AGENT LOGS</span>
                  {isAgentLoading && <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />}
                </div>

                <div className="flex-1 p-2 overflow-y-auto space-y-1 font-mono text-[10px]">
                  {agentLogs.length === 0 ? (
                    <p className="text-slate-600 italic">
                      Ready for prompt. Choose a preset above or type an instruction below.
                    </p>
                  ) : (
                    agentLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className={`leading-relaxed ${
                          log.startsWith("Supervisor")
                            ? "text-sky-300"
                            : log.startsWith("Agent")
                            ? "text-amber-300"
                            : log.startsWith("Error")
                            ? "text-rose-400 font-bold"
                            : "text-slate-400"
                        }`}
                      >
                        &gt; {log}
                      </div>
                    ))
                  )}
                  <div ref={logsEndRef} />
                </div>
              </div>

              {copilotError && (
                <div className="p-2 bg-rose-950/70 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{copilotError}</span>
                </div>
              )}

              {/* Prompt Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRunAgent(copilotPrompt);
                }}
                className="flex items-center gap-2 pt-1"
              >
                <input
                  type="text"
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  disabled={isAgentLoading}
                  placeholder="e.g. 'Cut silent gaps & overlay nature clips'..."
                  className="flex-1 bg-studio-900 border border-studio-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 transition"
                />
                <button
                  type="submit"
                  disabled={!copilotPrompt.trim() || isAgentLoading}
                  className={`p-2 rounded-lg transition ${
                    copilotPrompt.trim() && !isAgentLoading
                      ? "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sm active:scale-95"
                      : "bg-studio-900 text-slate-600 cursor-not-allowed"
                  }`}
                  title="Run Agent"
                >
                  {isAgentLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: CLIP INSPECTOR */}
          {studioDockTab === "inspector" && (
            <div className="flex-1 p-3 overflow-y-auto">
              {selectedClip ? (
                <div className="space-y-3 text-xs">
                  <div className="p-2.5 bg-studio-900 rounded-lg border border-studio-800">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block mb-0.5">
                      CLIP TITLE
                    </span>
                    <h4 className="text-sm font-bold text-white truncate">{selectedClip.title}</h4>
                    <span className="text-[10px] font-mono text-sky-400 mt-0.5 block">
                      ID: {selectedClip.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                    <div className="p-2 bg-studio-900 rounded border border-studio-800">
                      <span className="text-[9px] text-slate-500 uppercase block">Timeline In</span>
                      <span className="text-slate-200">
                        {secondsToTimecode(selectedClip.timelineStart, edl.fps)}
                      </span>
                    </div>

                    <div className="p-2 bg-studio-900 rounded border border-studio-800">
                      <span className="text-[9px] text-slate-500 uppercase block">Duration</span>
                      <span className="text-emerald-400">
                        {selectedClip.duration.toFixed(2)}s
                      </span>
                    </div>

                    <div className="p-2 bg-studio-900 rounded border border-studio-800">
                      <span className="text-[9px] text-slate-500 uppercase block">Track</span>
                      <span className="text-sky-300 font-bold uppercase">
                        {selectedTrack?.name || selectedClip.trackId}
                      </span>
                    </div>

                    <div className="p-2 bg-studio-900 rounded border border-studio-800">
                      <span className="text-[9px] text-slate-500 uppercase block">Type</span>
                      <span className="text-amber-400 font-bold uppercase">
                        {selectedClip.fileType}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-studio-800 flex gap-2">
                    <button
                      onClick={() => splitClipAtPlayhead(selectedClip?.id)}
                      className="flex-1 py-1.5 px-2 rounded bg-studio-900 hover:bg-studio-800 border border-studio-800 text-slate-200 flex items-center justify-center gap-1.5 font-semibold text-xs transition"
                    >
                      <Scissors className="w-3.5 h-3.5 text-sky-400" />
                      <span>Split Clip</span>
                    </button>

                    <button
                      onClick={() => selectedClip && deleteClip(selectedClip.id)}
                      className="flex-1 py-1.5 px-2 rounded bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 flex items-center justify-center gap-1.5 font-semibold text-xs transition"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <SlidersHorizontal className="w-8 h-8 mb-2 opacity-30 text-emerald-400" />
                  <p className="text-xs font-semibold text-slate-400">No Clip Selected</p>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                    Click any clip on the timeline to inspect timing, tracks, volume, and properties.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
