/**
 * Sparrow Media OS - SMPTE Timecode Utilities
 * Formats milliseconds and seconds to exact SMPTE Timecode (HH:MM:SS:FF)
 */

export function secondsToTimecode(totalSeconds: number, fps: number = 60): string {
  if (isNaN(totalSeconds) || totalSeconds < 0) totalSeconds = 0;

  const totalFrames = Math.floor(totalSeconds * fps);
  const frames = totalFrames % Math.round(fps);
  const totalSecsInt = Math.floor(totalSeconds);
  const seconds = totalSecsInt % 60;
  const minutes = Math.floor(totalSecsInt / 60) % 60;
  const hours = Math.floor(totalSecsInt / 3600);

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  const ff = frames.toString().padStart(2, "0");

  return `${hh}:${mm}:${ss}:${ff}`;
}

export function msToTimecode(ms: number, fps: number = 60): string {
  return secondsToTimecode(ms / 1000, fps);
}

export function timecodeToSeconds(timecode: string, fps: number = 60): number {
  const parts = timecode.split(":").map(Number);
  if (parts.length !== 4) return 0;
  const [hh, mm, ss, ff] = parts;
  return hh * 3600 + mm * 60 + ss + ff / fps;
}

export function formatRulerTick(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  if (ms > 0) {
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
