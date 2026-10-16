import { DeviceProfile, DaemonStatus } from "@sparrow/edl";

export const DEFAULT_DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_URL || "http://127.0.0.1:8765";

export interface DaemonConnectionOptions {
  videoDeviceIndex: number;
  width?: number;
  height?: number;
  fps?: number;
  daemonUrl?: string;
  onTrack?: (stream: MediaStream) => void;
  onStateChange?: (state: RTCPeerConnectionState) => void;
}

export async function checkDaemonHealth(daemonUrl: string = DEFAULT_DAEMON_URL): Promise<DaemonStatus> {
  const res = await fetch(`${daemonUrl}/health`, {
    method: "GET",
    signal: AbortSignal.timeout(3000),
  });

  if (!res.ok) {
    throw new Error(`Daemon responded with HTTP status ${res.status}`);
  }

  const data = await res.json();
  return {
    online: true,
    version: data.version || "0.1.0",
    host: "127.0.0.1",
    port: 8765,
    discoveredDevices: [],
    activePeers: data.active_peers || 0,
    uptimeSeconds: data.uptime_seconds || 0,
  };
}

export async function fetchDaemonDevices(daemonUrl: string = DEFAULT_DAEMON_URL): Promise<DeviceProfile[]> {
  const res = await fetch(`${daemonUrl}/devices`, {
    method: "GET",
    signal: AbortSignal.timeout(4000),
  });

  if (!res.ok) {
    throw new Error(`Failed to query devices: ${res.statusText}`);
  }

  const data = await res.json();
  return data.devices || [];
}

export async function connectDaemonWebRTC(options: DaemonConnectionOptions): Promise<{
  stream: MediaStream;
  peerConnection: RTCPeerConnection;
  cleanup: () => void;
}> {
  const {
    videoDeviceIndex,
    width = 1920,
    height = 1080,
    fps = 30,
    daemonUrl = DEFAULT_DAEMON_URL,
    onTrack,
    onStateChange,
  } = options;

  const t0 = performance.now();
  const pc = new RTCPeerConnection({
    iceServers: [], // Localhost loopback connection, no STUN/TURN needed
  });

  const remoteStream = new MediaStream();

  pc.ontrack = (event) => {
    if (event.track) {
      remoteStream.addTrack(event.track);
      if (onTrack) {
        onTrack(remoteStream);
      }
    }
  };

  pc.onconnectionstatechange = () => {
    if (onStateChange) {
      onStateChange(pc.connectionState);
    }
  };

  // Add video receiver transceiver
  pc.addTransceiver("video", { direction: "recvonly" });

  // Create offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Send SDP offer to daemon
  const response = await fetch(`${daemonUrl}/offer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sdp: pc.localDescription?.sdp,
      type: pc.localDescription?.type,
      video_device_index: videoDeviceIndex,
      width,
      height,
      fps,
    }),
  });

  if (!response.ok) {
    pc.close();
    throw new Error(`Hardware daemon rejected offer with HTTP ${response.status}`);
  }

  const answer = await response.json();
  await pc.setRemoteDescription(new RTCSessionDescription(answer));

  const latencyMs = Math.round(performance.now() - t0);

  const cleanup = () => {
    try {
      remoteStream.getTracks().forEach((t) => t.stop());
      pc.close();
    } catch (err) {
      console.warn("Error during WebRTC cleanup", err);
    }
  };

  return {
    stream: remoteStream,
    peerConnection: pc,
    cleanup,
  };
}
