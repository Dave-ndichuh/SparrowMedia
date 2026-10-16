"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UploadCloud, Sparkles, Film, Music, Image as ImageIcon } from "lucide-react";
import { useStudioStore, UploadQueueItem } from "@/lib/store/useStudioStore";
import { uploadMediaAsset } from "@/lib/api/assetsClient";

export const SmartDropzone: React.FC = () => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const { enqueueUpload, updateUploadProgress, addMediaAsset } = useStudioStore();

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.types.includes("Files")) {
      setIsDraggingOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only dismiss if leaving window boundary
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length === 0) return;

      for (const file of files) {
        const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const queueItem: UploadQueueItem = {
          id: uploadId,
          fileName: file.name,
          fileSize: file.size,
          progress: 0,
          stage: "uploading",
          statusMessage: "Starting upload...",
        };

        enqueueUpload(queueItem);

        // Upload and process in background
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
    },
    [enqueueUpload, updateUploadProgress, addMediaAsset]
  );

  useEffect(() => {
    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop]);

  if (!isDraggingOver) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-sky-950/70 backdrop-blur-md border-4 border-dashed border-sky-400 pointer-events-none animate-in fade-in duration-150">
      <div className="flex flex-col items-center justify-center p-10 bg-studio-900/95 border border-sky-500/40 rounded-3xl shadow-2xl text-center max-w-lg">
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <UploadCloud className="w-10 h-10 animate-bounce" />
          </div>
          <Sparkles className="w-6 h-6 text-amber-400 absolute -top-2 -right-2 animate-pulse" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-wide mb-1">
          Drop Files to Ingest into Studio
        </h2>
        <p className="text-xs text-slate-300 mb-6 leading-relaxed">
          Files are automatically converted to editing proxies and indexed with 768-dimensional Gemini semantic vectors.
        </p>

        <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5 px-3 py-1 bg-studio-950 rounded-lg border border-studio-800">
            <Film className="w-3.5 h-3.5 text-sky-400" />
            MP4 / MOV / ProRes
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-studio-950 rounded-lg border border-studio-800">
            <Music className="w-3.5 h-3.5 text-indigo-400" />
            WAV / MP3
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 bg-studio-950 rounded-lg border border-studio-800">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
            PNG / JPG
          </span>
        </div>
      </div>
    </div>
  );
};
