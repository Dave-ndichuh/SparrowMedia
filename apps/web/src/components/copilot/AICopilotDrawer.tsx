"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Scissors,
  Film,
  Zap,
  RotateCcw,
  RotateCw,
  Send,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";
import { useEDLStore } from "@/lib/store/useEDLStore";
import { requestAgentEdit, AgentEditResponse } from "@/lib/api/agentsClient";

export const AICopilotDrawer: React.FC = () => {
  const {
    isCopilotOpen,
    setCopilotOpen,
    edl,
    applyAIEdit,
    undo,
    redo,
    past,
    future,
    lastActionDescription,
  } = useEDLStore();

  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [agentLogs, setAgentLogs] = useState<string[]>([]);
  const [proposedEdits, setProposedEdits] = useState<AgentEditResponse["proposed_edits"]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [agentLogs]);

  // Global Ctrl+Z / Cmd+Z for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  if (!isCopilotOpen) return null;

  const handleRunAgent = async (instruction: string) => {
    if (!instruction.trim() || isLoading) return;
    setIsLoading(true);
    setErrorMsg(null);
    setAgentLogs(["Supervisor: Sending request to LangGraph multi-agent engine..."]);
    setProposedEdits([]);

    try {
      const resp = await requestAgentEdit(edl, instruction);
      if (resp.success) {
        setAgentLogs(resp.status_log);
        setProposedEdits(resp.proposed_edits);
        applyAIEdit(resp.edl, `AI Edit: "${instruction}"`);
        setPrompt("");
      } else {
        setErrorMsg(resp.error || "Agent execution failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error contacting AI agent backend";
      setErrorMsg(msg);
      setAgentLogs((prev) => [...prev, `Error: ${msg}`]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePresetClick = (presetText: string) => {
    setPrompt(presetText);
    handleRunAgent(presetText);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-studio-900/95 border-l border-studio-700/80 shadow-2xl backdrop-blur-xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="h-14 px-5 bg-studio-950 border-b border-studio-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-500 text-white shadow-md shadow-sky-500/20">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wider uppercase flex items-center gap-1.5">
              <span>LangGraph AI Copilot</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-400 font-mono">
                v1.0
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Multi-agent automated timeline editor</p>
          </div>
        </div>

        <button
          onClick={() => setCopilotOpen(false)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Revert / Undo Banner (prominent 1-click rollback) */}
      {past.length > 0 && (
        <div className="px-4 py-2.5 bg-amber-950/40 border-b border-amber-800/50 flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-xs text-amber-300">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate max-w-[180px] text-[11px]" title={lastActionDescription || ""}>
              {lastActionDescription || "Timeline Modified"}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={undo}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold shadow-sm transition active:scale-95"
              title="Revert timeline to previous state (Ctrl+Z)"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Revert Edit</span>
            </button>
            {future.length > 0 && (
              <button
                onClick={redo}
                className="p-1 rounded bg-studio-800 hover:bg-studio-700 text-slate-300"
                title="Redo (Ctrl+Shift+Z)"
              >
                <RotateCw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Drawer Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* 1-Click Action Presets */}
        <div>
          <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase block mb-2">
            One-Click Action Presets
          </span>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => handlePresetClick("Auto-Cut Dead Air")}
              disabled={isLoading}
              className="flex items-center justify-between p-2.5 rounded-xl bg-studio-950 hover:bg-studio-850 border border-studio-800 hover:border-sky-500/50 text-left transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-sky-950 text-sky-400">
                  <Scissors className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-slate-200 group-hover:text-sky-300">
                    Auto-Cut Dead Air
                  </h5>
                  <p className="text-[10px] text-slate-500">Trim all silences &gt; 1.2s</p>
                </div>
              </div>
              <span className="text-[10px] text-sky-400 font-mono opacity-0 group-hover:opacity-100 transition">
                Run &rarr;
              </span>
            </button>

            <button
              onClick={() => handlePresetClick("Overlay Relevant B-Roll")}
              disabled={isLoading}
              className="flex items-center justify-between p-2.5 rounded-xl bg-studio-950 hover:bg-studio-850 border border-studio-800 hover:border-indigo-500/50 text-left transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-950 text-indigo-400">
                  <Film className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300">
                    Overlay Relevant B-Roll
                  </h5>
                  <p className="text-[10px] text-slate-500">Search pgvector vault &amp; place on V2</p>
                </div>
              </div>
              <span className="text-[10px] text-indigo-400 font-mono opacity-0 group-hover:opacity-100 transition">
                Run &rarr;
              </span>
            </button>

            <button
              onClick={() => handlePresetClick("Clean Up & Enhance Pacing")}
              disabled={isLoading}
              className="flex items-center justify-between p-2.5 rounded-xl bg-studio-950 hover:bg-studio-850 border border-studio-800 hover:border-amber-500/50 text-left transition group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-amber-950 text-amber-400">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h5 className="text-xs font-semibold text-slate-200 group-hover:text-amber-300">
                    Clean Up &amp; Enhance Pacing
                  </h5>
                  <p className="text-[10px] text-slate-500">Cut dead air + lay down B-roll</p>
                </div>
              </div>
              <span className="text-[10px] text-amber-400 font-mono opacity-0 group-hover:opacity-100 transition">
                Run &rarr;
              </span>
            </button>
          </div>
        </div>

        {/* Real-time Agent Execution Status Log */}
        <div className="flex-1 flex flex-col min-h-[160px] bg-studio-950 rounded-xl border border-studio-800 overflow-hidden">
          <div className="px-3 py-2 bg-studio-900 border-b border-studio-800 flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="font-bold text-slate-300">AGENT EXECUTION TRACE</span>
            {isLoading && <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />}
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-1.5 font-mono text-[10.5px]">
            {agentLogs.length === 0 ? (
              <p className="text-slate-600 italic">
                Awaiting instruction. Select a preset above or type a custom editing command below.
              </p>
            ) : (
              agentLogs.map((entry, idx) => (
                <div
                  key={idx}
                  className={`leading-relaxed ${
                    entry.startsWith("Supervisor")
                      ? "text-sky-300"
                      : entry.startsWith("Agent [Trimmer]")
                      ? "text-amber-300"
                      : entry.startsWith("Agent [B-Roll]")
                      ? "text-emerald-300"
                      : entry.startsWith("Error")
                      ? "text-rose-400 font-bold"
                      : "text-slate-400"
                  }`}
                >
                  &gt; {entry}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Proposed / Applied Edits Summary Cards */}
        {proposedEdits.length > 0 && (
          <div className="p-3 bg-studio-950 rounded-xl border border-studio-800 text-xs">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Applied {proposedEdits.length} AI Mutations</span>
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-300">
              {proposedEdits.map((e, idx) => (
                <div key={idx} className="p-1.5 rounded bg-studio-900 border border-studio-850">
                  {e.type === "trim_dead_air" ? (
                    <span>✂️ Cut {String(e.time_saved)}s dead air ({String(e.cut_interval)})</span>
                  ) : (
                    <span>🎬 Placed B-Roll &apos;{String(e.asset)}&apos; at {String(e.timelineStart)} ({String(e.duration)})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-950/70 border border-rose-800 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Prompt Input Form */}
      <div className="p-3 bg-studio-950 border-t border-studio-800">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleRunAgent(prompt);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading}
            placeholder="Type custom command (e.g. 'Cut silences & add sunset B-roll')..."
            className="flex-1 bg-studio-900 border border-studio-700/80 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 font-sans"
          />

          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className={`p-2 rounded-xl transition ${
              prompt.trim() && !isLoading
                ? "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md shadow-sky-500/20 active:scale-95 cursor-pointer"
                : "bg-studio-800 text-slate-600 cursor-not-allowed"
            }`}
            title="Execute LangGraph Workflow"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
