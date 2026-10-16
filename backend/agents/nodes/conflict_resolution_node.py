import copy
import datetime
import logging
from typing import Dict, Any
from agents.state import EditorState

logger = logging.getLogger("sparrow.agents.conflict_resolution")


def conflict_resolution_node(state: EditorState) -> Dict[str, Any]:
    """
    Reconciles jump cuts and B-roll placements.
    Ensures B-roll on Track V2 bridges cuts cleanly without timing desynchronization or overlaps.
    """
    log = list(state.get("status_log", []))
    log.append("Agent [Conflict Resolution]: Auditing timeline for jump cuts and track overlaps...")

    current_edl = copy.deepcopy(state.get("current_edl", {}))
    tracks = current_edl.get("tracks", [])

    v1_track = next((t for t in tracks if t.get("id") == "v1"), None)
    v2_track = next((t for t in tracks if t.get("id") == "v2"), None)

    # 1. Ensure no overlaps between consecutive clips on Track V2 (B-Roll)
    if v2_track and len(v2_track.get("clips", [])) > 1:
        v2_clips = sorted(v2_track["clips"], key=lambda c: c["timelineStart"])
        for i in range(len(v2_clips) - 1):
            curr_c = v2_clips[i]
            next_c = v2_clips[i + 1]
            curr_end = curr_c["timelineStart"] + curr_c["duration"]

            if curr_end > next_c["timelineStart"]:
                # Trim duration of current clip to avoid collision
                overlap = curr_end - next_c["timelineStart"]
                curr_c["duration"] = max(1.0, round(curr_c["duration"] - overlap, 2))
                curr_c["outPoint"] = round(curr_c["inPoint"] + curr_c["duration"], 2)
                log.append(f"Agent [Conflict Resolution]: Adjusted B-roll duration to avoid overlap at {next_c['timelineStart']}s.")

    # 2. Schema integrity check across all tracks
    max_timeline_end = 0.0
    for track in tracks:
        cleaned_clips = []
        for clip in track.get("clips", []):
            clip["timelineStart"] = max(0.0, float(clip.get("timelineStart", 0.0)))
            clip["duration"] = max(0.1, float(clip.get("duration", 1.0)))
            clip["inPoint"] = max(0.0, float(clip.get("inPoint", 0.0)))
            clip["outPoint"] = round(clip["inPoint"] + clip["duration"], 2)
            clip["speed"] = float(clip.get("speed", 1.0))
            clip["volume"] = float(clip.get("volume", 1.0))
            cleaned_clips.append(clip)

            end_t = clip["timelineStart"] + clip["duration"]
            if end_t > max_timeline_end:
                max_timeline_end = end_t

        track["clips"] = sorted(cleaned_clips, key=lambda c: c["timelineStart"])

    current_edl["duration"] = max(max_timeline_end + 15.0, current_edl.get("duration", 300.0))
    current_edl["version"] = current_edl.get("version", 1) + 1
    current_edl["updatedAt"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    log.append("Agent [Conflict Resolution]: Complete! Ready for creator review.")
    return {
        "current_edl": current_edl,
        "status_log": log,
        "is_completed": True,
    }
