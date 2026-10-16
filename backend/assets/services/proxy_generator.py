"""
Sparrow Media OS - Proxy and Keyframe Generator
Generates downscaled proxies and representative keyframe images for video/image assets.
"""

import os
from pathlib import Path
from typing import Dict, Any, List
import cv2
import numpy as np
from PIL import Image

def process_media_proxy(file_path: str, output_dir: str) -> Dict[str, Any]:
    """
    Extracts video metadata, generates thumbnail, and extracts keyframe images for Gemini analysis.
    """
    path = Path(file_path)
    ext = path.suffix.lower()
    os.makedirs(output_dir, exist_ok=True)
    
    thumb_filename = f"thumb_{path.stem}.jpg"
    thumb_path = os.path.join(output_dir, thumb_filename)
    
    proxy_filename = f"proxy_{path.stem}.mp4"
    proxy_path = os.path.join(output_dir, proxy_filename)

    keyframe_paths: List[str] = []

    # Check if image
    if ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp"]:
        try:
            with Image.open(file_path) as img:
                w, h = img.size
                img.thumbnail((480, 270))
                img.convert("RGB").save(thumb_path, "JPEG", quality=85)
                keyframe_paths.append(thumb_path)
                return {
                    "duration": 0.0,
                    "width": w,
                    "height": h,
                    "fps": 0.0,
                    "thumbnail_path": thumb_path,
                    "proxy_path": file_path, # same for static image
                    "keyframes": keyframe_paths,
                }
        except Exception as e:
            print(f"Error processing image {file_path}: {e}")

    # Check if video
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        # Fallback for audio or unsupported
        return {
            "duration": 0.0,
            "width": 0,
            "height": 0,
            "fps": 0.0,
            "thumbnail_path": "",
            "proxy_path": file_path,
            "keyframes": [],
        }

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 1)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1920)
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 1080)
    duration = total_frames / fps if fps > 0 else 0.0

    # Extract 3 keyframes (15%, 50%, 85%)
    sample_indices = [
        int(total_frames * 0.15),
        int(total_frames * 0.50),
        int(total_frames * 0.85),
    ]

    for idx, frame_no in enumerate(sample_indices):
        cap.set(cv2.CAP_PROP_POS_FRAMES, min(frame_no, total_frames - 1))
        ret, frame = cap.read()
        if ret and frame is not None:
            kf_name = f"kf_{path.stem}_{idx}.jpg"
            kf_file = os.path.join(output_dir, kf_name)
            cv2.imwrite(kf_file, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            keyframe_paths.append(kf_file)
            if idx == 0:
                cv2.imwrite(thumb_path, frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])

    # If no thumbnail saved, generate a placeholder
    if not os.path.exists(thumb_path):
        blank = np.zeros((270, 480, 3), dtype=np.uint8)
        cv2.putText(blank, path.name[:20], (20, 140), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
        cv2.imwrite(thumb_path, blank)

    cap.release()

    return {
        "duration": round(duration, 2),
        "width": width,
        "height": height,
        "fps": round(fps, 2),
        "thumbnail_path": thumb_path,
        "proxy_path": file_path,
        "keyframes": keyframe_paths,
    }
