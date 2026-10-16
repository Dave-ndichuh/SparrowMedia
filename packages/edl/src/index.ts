/**
 * Sparrow Media Group - Edit Decision List & Hardware Bridge Shared Interfaces
 */

export type DeviceType =
  | 'webcam'
  | 'capture_card'
  | 'virtual_camera'
  | 'microphone'
  | 'line_in'
  | 'unknown';

export interface DeviceResolution {
  width: number;
  height: number;
  fps: number;
}

export interface DeviceProfile {
  id: string;
  name: string;
  type: DeviceType;
  index: number;
  supportedResolutions: DeviceResolution[];
  isDefault?: boolean;
  vendor?: string;
  backend?: 'DirectShow' | 'V4L2' | 'AVFoundation' | 'BrowserMediaDevices';
}

export type ConnectionMode = 'browser_direct' | 'daemon_webrtc' | 'disconnected';

export interface MediaStreamConfig {
  videoDeviceId?: string;
  audioDeviceId?: string;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  bitrate?: number;
}

export interface DaemonStatus {
  online: boolean;
  version: string;
  host: string;
  port: number;
  discoveredDevices: DeviceProfile[];
  activePeers: number;
  uptimeSeconds: number;
}

export interface ClipEffect {
  type: 'color_grade' | 'chroma_key' | 'blur' | 'lower_third';
  parameters: Record<string, number | string | boolean>;
}

export interface Clip {
  id: string;
  assetId: string;
  trackId: string;
  title: string;
  timelineStart: number;  // Position in seconds on the timeline
  duration: number;       // Duration in seconds on the timeline
  inPoint: number;        // Start offset in source media (seconds)
  outPoint: number;       // End offset in source media (seconds)
  speed: number;          // 1.0 = normal
  volume: number;         // 0.0 - 1.0
  fileType: 'video' | 'audio' | 'image' | 'graphics';
  proxyUrl?: string;
  thumbnailUrl?: string;
  effects: ClipEffect[];
  waveformPeaks?: number[]; // Normalized 0..1 audio peaks
}

export interface Track {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'graphics';
  muted: boolean;
  locked: boolean;
  solo?: boolean;
  volume: number;
  clips: Clip[];
}

export interface EditDecisionList {
  id: string;
  title: string;
  fps: number;
  duration: number; // Total timeline length in seconds
  resolution: {
    width: number;
    height: number;
  };
  tracks: Track[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebRTCOfferPayload {
  sdp: string;
  type: 'offer' | 'answer';
  video_device_index?: number;
  audio_device_index?: number;
  width?: number;
  height?: number;
  fps?: number;
}

export interface WebRTCAnswerPayload {
  sdp: string;
  type: 'answer';
}
