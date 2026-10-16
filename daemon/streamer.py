"""
Sparrow Media Group - WebRTC Media Streamer
Captures frames from hardware capture devices (via OpenCV/PyAV) and streams them
through aiortc VideoStreamTrack to the browser client with ultra-low latency (<50ms).
"""

import time
import asyncio
import fractions
import logging
import platform
import numpy as np
import cv2
import av
from aiortc import VideoStreamTrack

logger = logging.getLogger("sparrow.streamer")


def generate_synthetic_frame(width: int, height: int, frame_count: int, fps: int) -> np.ndarray:
    """Generate high-contrast SMPTE-style test pattern with real-time HUD."""
    img = np.zeros((height, width, 3), dtype=np.uint8)

    # 7 standard SMPTE bars
    bar_width = width // 7
    colors = [
        (180, 180, 180),  # White / Grey
        (0, 180, 180),    # Yellow
        (180, 180, 0),    # Cyan
        (0, 180, 0),      # Green
        (180, 0, 180),    # Magenta
        (0, 0, 180),      # Red
        (180, 0, 0),      # Blue
    ]
    for i, col in enumerate(colors):
        x1 = i * bar_width
        x2 = width if i == 6 else (i + 1) * bar_width
        img[0 : int(height * 0.75), x1:x2] = col

    # Bottom dark HUD section
    img[int(height * 0.75) :, :] = (20, 20, 24)

    # Animated ping sweep to verify live motion
    sweep_x = int((frame_count * 8) % width)
    cv2.line(img, (sweep_x, 0), (sweep_x, height), (255, 255, 255), 2)

    # Overlay metadata
    timestamp_str = time.strftime("%H:%M:%S") + f".{int((time.time() % 1) * 100):02d}"
    text_primary = f"SPARROW MEDIA OS // HARDWARE BRIDGE (SYNTH 1080p)"
    text_secondary = f"TIME: {timestamp_str} | FPS: {fps} | FRAME: {frame_count}"

    cv2.putText(
        img,
        text_primary,
        (40, int(height * 0.83)),
        cv2.FONT_HERSHEY_DUPLEX,
        1.1,
        (255, 255, 255),
        2,
        cv2.LINE_AA,
    )
    cv2.putText(
        img,
        text_secondary,
        (40, int(height * 0.92)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (0, 230, 180),
        2,
        cv2.LINE_AA,
    )

    return img


class OpenCVVideoStreamTrack(VideoStreamTrack):
    """
    aiortc VideoTrack reading from OpenCV VideoCapture with async loop integration.
    """

    kind = "video"

    def __init__(
        self,
        device_index: int = 0,
        width: int = 1920,
        height: int = 1080,
        fps: int = 30,
    ):
        super().__init__()
        self.device_index = device_index
        self.width = width
        self.height = height
        self.fps = fps
        self.time_base = fractions.Fraction(1, 90000)
        self.start_time = None
        self.frame_count = 0
        self.is_synthetic = (device_index < 0)
        self.cap = None

        if not self.is_synthetic:
            backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY
            logger.info(f"Opening capture hardware index {device_index} at {width}x{height}@{fps}fps...")
            self.cap = cv2.VideoCapture(device_index, backend)
            if self.cap.isOpened():
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
                self.cap.set(cv2.CAP_PROP_FPS, fps)
                actual_w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                actual_h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                logger.info(f"Hardware camera ready. Actual capture size: {actual_w}x{actual_h}")
            else:
                logger.warning(f"Could not open device {device_index}. Falling back to Sparrow Virtual Test Feed.")
                self.is_synthetic = True

    async def recv(self):
        """Called by aiortc whenever a new video frame is demanded by the WebRTC pipeline."""
        if self.start_time is None:
            self.start_time = time.time()

        # Compute next target presentation timestamp
        self.frame_count += 1
        target_pts = int((self.frame_count / self.fps) * 90000)

        # Frame pacing
        target_time = self.start_time + (self.frame_count / self.fps)
        sleep_duration = target_time - time.time()
        if sleep_duration > 0.001:
            await asyncio.sleep(sleep_duration)

        frame = None
        if not self.is_synthetic and self.cap and self.cap.isOpened():
            # Run blocking capture in executor thread to keep async event loop responsive
            loop = asyncio.get_running_loop()
            ret, captured = await loop.run_in_executor(None, self.cap.read)
            if ret and captured is not None:
                if captured.shape[1] != self.width or captured.shape[0] != self.height:
                    frame = cv2.resize(captured, (self.width, self.height))
                else:
                    frame = captured

        # Fallback to synthetic if hardware read fails
        if frame is None:
            frame = generate_synthetic_frame(self.width, self.height, self.frame_count, self.fps)

        # Convert BGR numpy to PyAV VideoFrame
        video_frame = av.VideoFrame.from_ndarray(frame, format="bgr24")
        video_frame.pts = target_pts
        video_frame.time_base = self.time_base
        return video_frame

    def stop(self):
        super().stop()
        if self.cap and self.cap.isOpened():
            logger.info(f"Releasing hardware capture index {self.device_index}")
            self.cap.release()
            self.cap = None
