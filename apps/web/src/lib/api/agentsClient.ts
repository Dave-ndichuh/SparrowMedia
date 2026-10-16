import { EditDecisionList } from "@sparrow/edl";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface AgentEditResponse {
  success: boolean;
  edl: EditDecisionList;
  status_log: string[];
  proposed_edits: Array<{
    type: string;
    [key: string]: unknown;
  }>;
  error?: string;
}

/**
 * Strips heavy in-memory UI caches (like Float32Array waveform peaks) before sending over network.
 */
export function serializeEDLForTransport(edl: EditDecisionList): Record<string, unknown> {
  return {
    id: edl.id,
    title: edl.title,
    fps: edl.fps,
    duration: edl.duration,
    resolution: edl.resolution,
    version: edl.version,
    tracks: edl.tracks.map((track) => ({
      id: track.id,
      name: track.name,
      type: track.type,
      muted: track.muted,
      locked: track.locked,
      volume: track.volume,
      clips: track.clips.map((clip) => {
        const { waveformPeaks, ...cleanClip } = clip;
        return cleanClip;
      }),
    })),
  };
}

export async function requestAgentEdit(
  edl: EditDecisionList,
  prompt: string,
  targetAssetId?: string
): Promise<AgentEditResponse> {
  const cleanEdl = serializeEDLForTransport(edl);

  const response = await fetch(`${API_BASE_URL}/api/agents/edit/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      edl: cleanEdl,
      prompt,
      target_asset_id: targetAssetId,
      silence_threshold: 1.2,
      b_roll_duration: 4.0,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Agent request failed with HTTP ${response.status}: ${errText}`);
  }

  return await response.json();
}
