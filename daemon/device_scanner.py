"""
Sparrow Media Group - Hardware Device Scanner
Enumerates local video & capture devices (HDMI capture cards, webcams, virtual cams)
using DirectShow / platform-specific APIs.
"""

import sys
import platform
import logging
from typing import List, Dict, Any
import cv2

logger = logging.getLogger("sparrow.device_scanner")

STANDARD_RESOLUTIONS = [
    {"width": 3840, "height": 2160, "fps": 30},
    {"width": 1920, "height": 1080, "fps": 60},
    {"width": 1920, "height": 1080, "fps": 30},
    {"width": 1280, "height": 720, "fps": 60},
    {"width": 1280, "height": 720, "fps": 30},
    {"width": 640, "height": 480, "fps": 30},
]


def classify_device(name: str, width: int, height: int, fps: int) -> str:
    lower_name = name.lower()
    if any(k in lower_name for k in ["cam link", "blackmagic", "capture", "hdmi", "elgato", "decklink", "avermedia"]):
        return "capture_card"
    if any(k in lower_name for k in ["obs", "virtual", "vcam", "sparrow virtual"]):
        return "virtual_camera"
    if width >= 1920 or fps >= 60:
        return "capture_card"
    return "webcam"


def probe_device_capabilities(index: int, backend: int) -> Dict[str, Any] | None:
    """Test a device index to see if it exists and test supported resolutions."""
    cap = cv2.VideoCapture(index, backend)
    if not cap.isOpened():
        cap.release()
        return None

    # Read a sample frame to confirm real hardware feed
    ret, frame = cap.read()
    if not ret or frame is None:
        cap.release()
        return None

    native_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 640)
    native_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 480)
    native_fps = int(cap.get(cv2.CAP_PROP_FPS) or 30)
    if native_fps <= 0 or native_fps > 120:
        native_fps = 30

    supported = []
    # Test high resolutions
    for res in STANDARD_RESOLUTIONS:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, res["width"])
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, res["height"])
        actual_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if actual_w == res["width"] and actual_h == res["height"]:
            supported.append(res)

    if not supported:
        supported.append({"width": native_width, "height": native_height, "fps": native_fps})

    cap.release()

    # Friendly name generation based on index and capabilities
    device_name = f"Video Source {index}"
    if native_width >= 1920:
        device_name = f"HD/4K Video Device {index} (DirectShow)"
    else:
        device_name = f"Standard Camera {index}"

    dev_type = classify_device(device_name, native_width, native_height, native_fps)

    return {
        "id": f"hw_video_{index}",
        "name": device_name,
        "type": dev_type,
        "index": index,
        "supportedResolutions": supported,
        "nativeResolution": {
            "width": native_width,
            "height": native_height,
            "fps": native_fps,
        },
        "backend": "DirectShow" if platform.system() == "Windows" else "V4L2",
    }


def scan_devices(max_indices: int = 4) -> List[Dict[str, Any]]:
    """Scan available capture hardware."""
    backend = cv2.CAP_DSHOW if platform.system() == "Windows" else cv2.CAP_ANY
    devices = []

    logger.info(f"Scanning up to {max_indices} video devices on {platform.system()}...")
    for idx in range(max_indices):
        try:
            profile = probe_device_capabilities(idx, backend)
            if profile:
                devices.append(profile)
        except Exception as err:
            logger.debug(f"Error probing device {idx}: {err}")

    # Always provide a high-definition synthetic Sparrow test pattern if no hardware connected
    if not devices:
        logger.info("No physical cameras detected. Registering Sparrow Virtual Test Generator.")
        devices.append({
            "id": "hw_video_synth_0",
            "name": "Sparrow Virtual SMPTE Generator (1080p60)",
            "type": "virtual_camera",
            "index": -1,
            "supportedResolutions": [
                {"width": 1920, "height": 1080, "fps": 60},
                {"width": 1280, "height": 720, "fps": 60},
            ],
            "nativeResolution": {"width": 1920, "height": 1080, "fps": 60},
            "backend": "DirectShow",
        })

    return devices


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    devs = scan_devices()
    print("Discovered Devices:")
    for d in devs:
        print(f" - [{d['type']}] {d['name']} (Index: {d['index']}) -> {d['nativeResolution']}")
