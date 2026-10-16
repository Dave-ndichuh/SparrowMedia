"""
Sparrow Media OS - RTMP & Local Broadcast Pusher
Ingests the master 1080p60 Program canvas feed and streams to RTMP destinations
(YouTube Live, Twitch) or records to local broadcast MP4 archives.
"""

import os
import time
import subprocess
import logging
from typing import Dict, Any, Optional
import cv2
import numpy as np

logger = logging.getLogger("sparrow.broadcast")

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "backend", "media", "broadcasts")
os.makedirs(OUTPUT_DIR, exist_ok=True)


class BroadcastSession:
    def __init__(self, destination: str = "local_sink", rtmp_url: Optional[str] = None, width: int = 1920, height: int = 1080, fps: int = 60):
        self.destination = destination
        self.rtmp_url = rtmp_url
        self.width = width
        self.height = height
        self.fps = fps
        self.is_live = False
        self.start_time: Optional[float] = None
        self.frame_count = 0
        self.dropped_frames = 0
        self.bitrate_kbps = 4500 # 1080p60 target

        self.ffmpeg_proc: Optional[subprocess.Popen] = None
        self.cv_writer: Optional[cv2.VideoWriter] = None
        self.output_file: Optional[str] = None

    def start(self) -> Dict[str, Any]:
        """Initiates the broadcast stream or recording session."""
        self.start_time = time.time()
        self.is_live = True
        self.frame_count = 0
        self.dropped_frames = 0

        timestamp = time.strftime("%Y%m%d_%H%M%S")
        self.output_file = os.path.join(OUTPUT_DIR, f"sparrow_live_{timestamp}.mp4")

        # Test if ffmpeg binary exists
        has_ffmpeg = False
        try:
            res = subprocess.run(["where", "ffmpeg"], capture_output=True, text=True)
            has_ffmpeg = (res.returncode == 0)
        except Exception:
            has_ffmpeg = False

        if self.destination == "rtmp" and self.rtmp_url and has_ffmpeg:
            logger.info(f"Launching FFmpeg RTMP pipe to {self.rtmp_url}...")
            cmd = [
                "ffmpeg",
                "-y",
                "-f", "rawvideo",
                "-vcodec", "rawvideo",
                "-pix_fmt", "bgr24",
                "-s", f"{self.width}x{self.height}",
                "-r", str(self.fps),
                "-i", "-",
                "-c:v", "libx264",
                "-preset", "ultrafast",
                "-tune", "zerolatency",
                "-b:v", f"{self.bitrate_kbps}k",
                "-maxrate", f"{self.bitrate_kbps}k",
                "-bufsize", f"{self.bitrate_kbps * 2}k",
                "-pix_fmt", "yuv420p",
                "-g", str(self.fps * 2),
                "-f", "flv",
                self.rtmp_url,
            ]
            self.ffmpeg_proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        else:
            # Fallback to local high-efficiency OpenCV MP4 recording sink
            logger.info(f"Starting local broadcast recording sink: {self.output_file}")
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            self.cv_writer = cv2.VideoWriter(
                self.output_file,
                fourcc,
                self.fps,
                (self.width, self.height),
            )

        return self.get_telemetry()

    def push_frame(self, frame: np.ndarray):
        """Pushes a single BGR frame from the master program canvas."""
        if not self.is_live:
            return

        self.frame_count += 1

        if self.ffmpeg_proc and self.ffmpeg_proc.stdin:
            try:
                self.ffmpeg_proc.stdin.write(frame.tobytes())
            except Exception as e:
                logger.warning(f"Error writing to FFmpeg stdin: {e}")
                self.dropped_frames += 1
        elif self.cv_writer:
            try:
                if frame.shape[1] != self.width or frame.shape[0] != self.height:
                    frame = cv2.resize(frame, (self.width, self.height))
                self.cv_writer.write(frame)
            except Exception as e:
                logger.warning(f"Error writing to OpenCV sink: {e}")
                self.dropped_frames += 1

    def stop(self) -> Dict[str, Any]:
        """Terminates the live broadcast and finalizes the media stream."""
        if not self.is_live:
            return self.get_telemetry()

        self.is_live = False
        duration = time.time() - (self.start_time or time.time())
        logger.info(f"Stopping broadcast. Total frames: {self.frame_count}, duration: {duration:.1f}s")

        if self.ffmpeg_proc:
            if self.ffmpeg_proc.stdin:
                self.ffmpeg_proc.stdin.close()
            self.ffmpeg_proc.terminate()
            self.ffmpeg_proc = None

        if self.cv_writer:
            self.cv_writer.release()
            self.cv_writer = None

        telemetry = self.get_telemetry()
        telemetry["output_file"] = self.output_file
        return telemetry

    def get_telemetry(self) -> Dict[str, Any]:
        uptime = int(time.time() - self.start_time) if self.start_time and self.is_live else 0
        return {
            "is_live": self.is_live,
            "destination": self.destination,
            "uptime_seconds": uptime,
            "frame_count": self.frame_count,
            "dropped_frames": self.dropped_frames,
            "bitrate_kbps": self.bitrate_kbps if self.is_live else 0,
            "output_file": self.output_file,
            "fps": self.fps,
        }


# Global singleton broadcast session
current_broadcast: Optional[BroadcastSession] = None


def start_broadcast(destination: str = "local_sink", rtmp_url: Optional[str] = None) -> Dict[str, Any]:
    global current_broadcast
    if current_broadcast and current_broadcast.is_live:
        return current_broadcast.get_telemetry()

    current_broadcast = BroadcastSession(destination=destination, rtmp_url=rtmp_url)
    return current_broadcast.start()


def stop_broadcast() -> Dict[str, Any]:
    global current_broadcast
    if not current_broadcast:
        return {"is_live": False, "uptime_seconds": 0}
    return current_broadcast.stop()


def get_broadcast_status() -> Dict[str, Any]:
    global current_broadcast
    if not current_broadcast:
        return {"is_live": False, "uptime_seconds": 0, "dropped_frames": 0, "bitrate_kbps": 0}
    return current_broadcast.get_telemetry()
