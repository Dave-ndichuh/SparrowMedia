"use client";

import React from "react";
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  FileVideo,
  FileAudio,
  FileImage,
} from "lucide-react";
import { useStudioStore, UploadQueueItem } from "@/lib/store/useStudioStore";

export const UploadProgressPanel: React.FC = () => {
  const { uploadQueue, clearCompletedUploads } = useStudioStore();

  if (uploadQueue.length === 0) return null;

  const hasCompleted = uploadQueue.some((item) => item.stage === "indexed");

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStageIcon = (item: UploadQueueItem) => {
    switch (item.stage) {
      case "indexed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />;
      case "processing":
        return <Sparkles className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />;
      default:
        return <Loader2 className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" />;
    }
  };

  return (
    <div className="fixed bottom-8 right-6 z-40 w-80 bg-studio-900/95 border border-studio-700/80 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-studio-950 border-b border-studio-800 text-xs">
        <div className="flex items-center gap-2">
          <UploadCloud className="w-4 h-4 text-sky-400" />
          <span className="font-semibold text-slate-200">Ingestion Pipeline</span>
          <span className="px-1.5 py-0.2 rounded-full bg-studio-800 text-[10px] text-slate-400 font-mono">
            {uploadQueue.length}
          </span>
        </div>

        {hasCompleted && (
          <button
            onClick={clearCompletedUploads}
            className="text-[10px] text-slate-400 hover:text-white transition"
          >
            Clear done
          </button>
        )}
      </div>

      {/* Item List */}
      <div className="max-h-60 overflow-y-auto divide-y divide-studio-800/60 p-2 space-y-2">
        {uploadQueue.map((item) => (
          <div key={item.id} className="pt-1.5 pb-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 truncate pr-2">
                {getStageIcon(item)}
                <span className="font-medium text-slate-200 truncate" title={item.fileName}>
                  {item.fileName}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {formatFileSize(item.fileSize)}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-studio-950 rounded-full overflow-hidden border border-studio-800">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  item.stage === "indexed"
                    ? "bg-emerald-400"
                    : item.stage === "failed"
                    ? "bg-rose-500"
                    : item.stage === "processing"
                    ? "bg-gradient-to-r from-sky-400 via-indigo-400 to-amber-400 animate-pulse"
                    : "bg-sky-500"
                }`}
                style={{ width: `${item.progress}%` }}
              />
            </div>

            {/* Status Message Microcopy */}
            <div className="flex items-center justify-between text-[10px]">
              <span
                className={`truncate ${
                  item.stage === "indexed"
                    ? "text-emerald-400 font-semibold"
                    : item.stage === "failed"
                    ? "text-rose-400"
                    : "text-slate-400"
                }`}
              >
                {item.statusMessage}
              </span>
              <span className="font-mono text-slate-500">{item.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
