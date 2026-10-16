"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Camera,
  Cpu,
  Monitor,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Volume2,
  Sliders,
  ChevronDown,
  Copy,
  Check,
  Video,
} from "lucide-react";
import { useStudioStore } from "@/lib/store/useStudioStore";
import { DeviceProfile } from "@sparrow/edl";
import {
  checkDaemonHealth,
  fetchDaemonDevices,
  connectDaemonWebRTC,
} from "@/lib/webrtc/daemonClient";
import { AudioVUMeter } from "../studio/AudioVUMeter";

export const DeviceConnectionModal: React.FC = () => {
  const {
    isConnectModalOpen,
    setConnectModalOpen,
    setActiveStream,
    setConnectionMode,
    setActiveVideoDevice,
    setStreamMetrics,
  } = useStudioStore();

  const [activeTab, setActiveTab] = useState<"daemon" | "browser">("daemon");

  // Daemon state
  const [isDaemonOnline, setIsDaemonOnline] = useState<boolean | null>(null);
  const [isCheckingDaemon, setIsCheckingDaemon] = useState<boolean>(false);
  const [daemonDevices, setDaemonDevices] = useState<DeviceProfile[]>([]);
  const [selectedDaemonDeviceIndex, setSelectedDaemonDeviceIndex] = useState<number>(0);
  const [selectedResolution, setSelectedResolution] = useState<{
    width: number;
    height: number;
    fps: number;
  }>({ width: 1920, height: 1080, fps: 60 });

  // Browser Direct state
  const [browserVideoDevices, setBrowserVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [browserAudioDevices, setBrowserAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedBrowserVideoId, setSelectedBrowserVideoId] = useState<string>("");
  const [selectedBrowserAudioId, setSelectedBrowserAudioId] = useState<string>("");

  // Preview state
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const [copiedCmd, setCopiedCmd] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);

  // Poll Daemon Status on open or tab switch
  useEffect(() => {
    if (!isConnectModalOpen) {
      stopPreview();
      return;
    }
    if (activeTab === "daemon") {
      checkDaemon();
    } else {
      queryBrowserDevices();
    }
  }, [isConnectModalOpen, activeTab]);

  // Hook preview stream into video element
  useEffect(() => {
    if (previewVideoRef.current && previewStream) {
      previewVideoRef.current.srcObject = previewStream;
      previewVideoRef.current.play().catch(() => {});
    }
  }, [previewStream]);

  const stopPreview = () => {
    if (previewStream) {
      previewStream.getTracks().forEach((t) => t.stop());
      setPreviewStream(null);
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  };

  const checkDaemon = async () => {
    setIsCheckingDaemon(true);
    setPreviewError(null);
    try {
      await checkDaemonHealth();
      setIsDaemonOnline(true);
      const devs = await fetchDaemonDevices();
      setDaemonDevices(devs);
      if (devs.length > 0) {
        setSelectedDaemonDeviceIndex(devs[0].index);
      }
    } catch {
      setIsDaemonOnline(false);
      setDaemonDevices([]);
    } finally {
      setIsCheckingDaemon(false);
    }
  };

  const queryBrowserDevices = async () => {
    try {
      // Trigger permission query
      const initial = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const video = devices.filter((d) => d.kind === "videoinput");
      const audio = devices.filter((d) => d.kind === "audioinput");

      setBrowserVideoDevices(video);
      setBrowserAudioDevices(audio);
      if (video.length > 0) setSelectedBrowserVideoId(video[0].deviceId);
      if (audio.length > 0) setSelectedBrowserAudioId(audio[0].deviceId);

      // Start initial browser preview
      setPreviewStream(initial);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Camera access denied by browser";
      setPreviewError(message);
    }
  };

  // Test / Start Preview for selected mode
  const startPreview = async () => {
    stopPreview();
    setIsPreviewLoading(true);
    setPreviewError(null);

    try {
      if (activeTab === "daemon") {
        const { stream } = await connectDaemonWebRTC({
          videoDeviceIndex: selectedDaemonDeviceIndex,
          width: selectedResolution.width,
          height: selectedResolution.height,
          fps: selectedResolution.fps,
        });
        setPreviewStream(stream);
      } else {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: selectedBrowserVideoId ? { deviceId: { exact: selectedBrowserVideoId } } : true,
          audio: selectedBrowserAudioId ? { deviceId: { exact: selectedBrowserAudioId } } : true,
        });
        setPreviewStream(stream);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to initiate preview";
      setPreviewError(message);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Confirm connection and attach to master studio
  const handleConnectToStudio = () => {
    if (!previewStream) return;

    if (activeTab === "daemon") {
      const dev = daemonDevices.find((d) => d.index === selectedDaemonDeviceIndex);
      setConnectionMode("daemon_webrtc");
      setActiveVideoDevice(
        dev || {
          id: `hw_${selectedDaemonDeviceIndex}`,
          name: `Hardware Input ${selectedDaemonDeviceIndex}`,
          type: "capture_card",
          index: selectedDaemonDeviceIndex,
          supportedResolutions: [selectedResolution],
        }
      );
      setStreamMetrics({
        width: selectedResolution.width,
        height: selectedResolution.height,
        fps: selectedResolution.fps,
        latencyMs: 25,
      });
    } else {
      const dev = browserVideoDevices.find((d) => d.deviceId === selectedBrowserVideoId);
      setConnectionMode("browser_direct");
      setActiveVideoDevice({
        id: selectedBrowserVideoId,
        name: dev?.label || "Browser Camera",
        type: "webcam",
        index: 0,
        supportedResolutions: [{ width: 1920, height: 1080, fps: 30 }],
      });
      setStreamMetrics({
        width: 1920,
        height: 1080,
        fps: 30,
        latencyMs: 15,
      });
    }

    setActiveStream(previewStream);
    setConnectModalOpen(false);
  };

  const copyLaunchCommand = () => {
    navigator.clipboard.writeText("python -m daemon.server");
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  if (!isConnectModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-studio-900 border border-studio-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-studio-800 bg-studio-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Hardware & Camera Connection
              </h2>
              <p className="text-xs text-slate-400">
                Connect physical capture cards, DSLRs, or direct browser cameras with zero downtime.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopPreview();
              setConnectModalOpen(false);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-studio-800 bg-studio-900/50 px-6 pt-2">
          <button
            onClick={() => {
              stopPreview();
              setActiveTab("daemon");
            }}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === "daemon"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span>Hardware Bridge Daemon (HDMI / Capture Cards)</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 font-mono">
              RECOMMENDED
            </span>
          </button>

          <button
            onClick={() => {
              stopPreview();
              setActiveTab("browser");
            }}
            className={`flex items-center gap-2 pb-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === "browser"
                ? "border-sky-500 text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Browser Direct (Webcam / Plug & Play)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Column: Device Configuration Form */}
          <div className="md:col-span-6 flex flex-col gap-4">
            {activeTab === "daemon" ? (
              <>
                {/* Daemon Status Card */}
                <div
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    isDaemonOnline
                      ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                      : "bg-amber-950/20 border-amber-800/40 text-amber-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 text-xs">
                    {isDaemonOnline ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {isDaemonOnline
                          ? "Sparrow Daemon Online (127.0.0.1:8765)"
                          : "Daemon Not Detected"}
                      </p>
                      <p className="text-[11px] opacity-80">
                        {isDaemonOnline
                          ? "DirectShow & PyAV bridge ready"
                          : "Start daemon locally to enable HDMI cards"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={checkDaemon}
                    disabled={isCheckingDaemon}
                    className="p-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 text-slate-200 transition"
                    title="Retry connection"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isCheckingDaemon ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>

                {!isDaemonOnline ? (
                  /* Helpful copy-paste launch guide */
                  <div className="p-4 rounded-xl bg-studio-950 border border-studio-800 flex flex-col gap-2.5">
                    <p className="text-xs text-slate-300 font-medium">
                      Start your local hardware daemon:
                    </p>
                    <div className="flex items-center justify-between bg-studio-900 px-3 py-2 rounded-lg border border-studio-700/60 font-mono text-xs text-sky-300">
                      <span>python -m daemon.server</span>
                      <button
                        onClick={copyLaunchCommand}
                        className="p-1 hover:text-white transition"
                        title="Copy command"
                      >
                        {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Or switch to the <strong>Browser Direct</strong> tab above for instant webcam capture without running Python.
                    </p>
                  </div>
                ) : (
                  /* Device Selection Dropdowns */
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Detected Hardware Source:
                      </label>
                      <select
                        value={selectedDaemonDeviceIndex}
                        onChange={(e) => setSelectedDaemonDeviceIndex(Number(e.target.value))}
                        className="w-full bg-studio-950 border border-studio-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                      >
                        {daemonDevices.map((dev) => (
                          <option key={dev.id} value={dev.index}>
                            [{dev.type.toUpperCase()}] {dev.name} (Index {dev.index})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Capture Profile / Target Quality:
                      </label>
                      <select
                        onChange={(e) => {
                          const [w, h, fps] = e.target.value.split("x").map(Number);
                          setSelectedResolution({ width: w, height: h, fps });
                        }}
                        className="w-full bg-studio-950 border border-studio-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                      >
                        <option value="1920x1080x60">1080p @ 60 FPS (Studio Broadcast Standard)</option>
                        <option value="1920x1080x30">1080p @ 30 FPS (Power Saver)</option>
                        <option value="3840x2160x30">4K Ultra HD @ 30 FPS (High Bitrate)</option>
                        <option value="1280x720x60">720p @ 60 FPS (Ultra Low Latency)</option>
                      </select>
                    </div>

                    <button
                      onClick={startPreview}
                      disabled={isPreviewLoading}
                      className="mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-studio-800 hover:bg-studio-700 border border-studio-700 text-xs font-semibold text-slate-200 transition"
                    >
                      <Video className="w-3.5 h-3.5 text-sky-400" />
                      <span>{previewStream ? "Restart Preview Feed" : "Test Live Feed"}</span>
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Browser Direct Mode Form */
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Camera:
                  </label>
                  <select
                    value={selectedBrowserVideoId}
                    onChange={(e) => setSelectedBrowserVideoId(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {browserVideoDevices.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label || `Camera ${dev.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Select Microphone / Audio Input:
                  </label>
                  <select
                    value={selectedBrowserAudioId}
                    onChange={(e) => setSelectedBrowserAudioId(e.target.value)}
                    className="w-full bg-studio-950 border border-studio-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                  >
                    {browserAudioDevices.map((dev) => (
                      <option key={dev.deviceId} value={dev.deviceId}>
                        {dev.label || `Microphone ${dev.deviceId.slice(0, 6)}`}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={startPreview}
                  disabled={isPreviewLoading}
                  className="mt-2 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-studio-800 hover:bg-studio-700 border border-studio-700 text-xs font-semibold text-slate-200 transition"
                >
                  <Video className="w-3.5 h-3.5 text-sky-400" />
                  <span>{previewStream ? "Update Preview" : "Start In-Modal Preview"}</span>
                </button>
              </div>
            )}

            {/* In-place Troubleshooting Accordion */}
            <div className="mt-auto pt-3 border-t border-studio-800/80">
              <button
                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                className="flex items-center justify-between w-full text-[11px] text-slate-400 hover:text-slate-200"
              >
                <span>Hardware Connection & Troubleshooting Help</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    showTroubleshooting ? "rotate-180" : ""
                  }`}
                />
              </button>

              {showTroubleshooting && (
                <div className="mt-2 p-3 bg-studio-950 rounded-lg border border-studio-800 text-[11px] text-slate-400 flex flex-col gap-1.5">
                  <p>• <strong>Cam Link / HDMI card:</strong> Ensure camera clean HDMI output is enabled in camera menu.</p>
                  <p>• <strong>Black screen:</strong> Confirm no other software (OBS, Zoom, Teams) has locked the capture device.</p>
                  <p>• <strong>Permissions:</strong> If using Browser Direct, ensure camera and microphone toggles are granted in browser URL bar.</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: In-Modal Live Preview Tile */}
          <div className="md:col-span-6 flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-300">
              Live Monitor Preview
            </span>

            <div className="relative aspect-video w-full bg-black rounded-xl border border-studio-800 overflow-hidden flex items-center justify-center">
              {previewStream ? (
                <video
                  ref={previewVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  <Camera className="w-8 h-8 text-slate-600 mb-2" />
                  <p className="text-xs text-slate-400">
                    {isPreviewLoading ? "Negotiating WebRTC stream..." : "No live preview yet."}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Click &apos;Test Live Feed&apos; to verify before connecting.
                  </p>
                </div>
              )}

              {previewError && (
                <div className="absolute inset-x-2 bottom-2 p-2 bg-rose-950/90 border border-rose-800 rounded text-rose-200 text-[11px] flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{previewError}</span>
                </div>
              )}
            </div>

            {/* Audio VU meter for preview */}
            {previewStream && (
              <div className="w-full">
                <AudioVUMeter stream={previewStream} height={50} showLabels={false} />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-studio-800 bg-studio-950/90">
          <button
            onClick={() => {
              stopPreview();
              setConnectModalOpen(false);
            }}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-studio-800 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleConnectToStudio}
            disabled={!previewStream}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold transition shadow-lg ${
              previewStream
                ? "bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sky-500/20 active:scale-95 cursor-pointer"
                : "bg-studio-800 text-slate-500 cursor-not-allowed border border-studio-700/50"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Lock Feed into Studio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
