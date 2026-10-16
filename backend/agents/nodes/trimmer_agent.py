import copy
import logging
from typing import Dict, Any, List
from agents.state import EditorState

logger = logging.getLogger("sparrow.agents.trimmer")


def trimmer_agent(state: EditorState) -> Dict[str, Any]:
    """
    Trims dead air and filler pauses greater than silence_threshold (default 1.2s).
    Mutates track V1 and A1 clips in the EDL and ripples subsequent clips backward.
    """
    log = list(state.get("status_log", []))
    log.append("Agent [Trimmer]: Scanning transcript for dead air exceeding 1.2s...")

    transcript = state.get("video_transcript", [])
    threshold = state.get("silence_threshold", 1.2)
    current_edl = copy.deepcopy(state.get("current_edl", {}))
    proposed_edits = list(state.get("proposed_edits", []))

    if not transcript or not current_edl.get("tracks"):
        log.append("Agent [Trimmer]: No clips or transcript available to trim.")
        return {"current_edl": current_edl, "status_log": log}

    # Find dead air intervals between consecutive phrases
    dead_air_intervals: List[Dict[str, float]] = []
    for i in range(len(transcript) - 1):
        curr_p = transcript[i]
        next_p = transcript[i + 1]
        gap = next_p["start"] - curr_p["end"]
        if gap >= threshold:
            dead_air_intervals.append({
                "cut_start": round(curr_p["end"], 2),
                "cut_end": round(next_p["start"], 2),
                "duration": round(gap, 2),
            })

    if not dead_air_intervals:
        log.append("Agent [Trimmer]: Pacing is already tight. No dead air exceeding threshold.")
        return {"current_edl": current_edl, "status_log": log}

    total_time_saved = sum(item["duration"] for item in dead_air_intervals)
    log.append(
        f"Agent [Trimmer]: Detected {len(dead_air_intervals)} dead air pause(s). Removing {total_time_saved:.1f}s..."
    )

    # Mutate primary video & audio tracks
    tracks = current_edl.get("tracks", [])
    for track in tracks:
        if track.get("id") in ["v1", "a1"]:
            original_clips = track.get("clips", [])
            new_clips = []

            for clip in original_clips:
                clip_start = clip["timelineStart"]
                clip_end = clip_start + clip["duration"]

                # Check if any dead air falls within this clip
                cuts_in_clip = [
                    d for d in dead_air_intervals
                    if d["cut_start"] >= clip_start and d["cut_end"] <= clip_end
                ]

                if not cuts_in_clip:
                    # Clip is untouched, but may need shifting if prior cuts occurred
                    cumulative_shift = sum(
                        d["duration"] for d in dead_air_intervals if d["cut_end"] <= clip_start
                    )
                    shifted_clip = copy.deepcopy(clip)
                    shifted_clip["timelineStart"] = max(0, round(clip_start - cumulative_shift, 2))
                    new_clips.append(shifted_clip)
                    continue

                # Clip has cuts: split into segments around each cut
                cursor = clip_start
                cumulative_shift = sum(
                    d["duration"] for d in dead_air_intervals if d["cut_end"] <= clip_start
                )

                for cut in cuts_in_clip:
                    segment_duration = cut["cut_start"] - cursor
                    if segment_duration > 0.1:
                        seg = copy.deepcopy(clip)
                        seg["id"] = f"{clip['id']}_seg_{round(cursor, 1)}"
                        seg["timelineStart"] = max(0, round(cursor - cumulative_shift, 2))
                        seg["duration"] = round(segment_duration, 2)
                        seg["inPoint"] = round(clip["inPoint"] + (cursor - clip_start), 2)
                        seg["outPoint"] = round(seg["inPoint"] + segment_duration, 2)
                        new_clips.append(seg)

                    # Advance cursor past dead air
                    cumulative_shift += cut["duration"]
                    cursor = cut["cut_end"]

                # Remainder after last cut
                if clip_end - cursor > 0.1:
                    seg = copy.deepcopy(clip)
                    seg["id"] = f"{clip['id']}_seg_end"
                    seg["timelineStart"] = max(0, round(cursor - cumulative_shift, 2))
                    seg["duration"] = round(clip_end - cursor, 2)
                    seg["inPoint"] = round(clip["inPoint"] + (cursor - clip_start), 2)
                    seg["outPoint"] = round(seg["inPoint"] + seg["duration"], 2)
                    new_clips.append(seg)

            track["clips"] = sorted(new_clips, key=lambda c: c["timelineStart"])

    for cut in dead_air_intervals:
        proposed_edits.append({
            "type": "trim_dead_air",
            "time_saved": cut["duration"],
            "cut_interval": f"{cut['cut_start']}s - {cut['cut_end']}s",
        })

    log.append(f"Agent [Trimmer]: Timeline compacted. Saved {total_time_saved:.1f}s of dead air.")
    return {
        "current_edl": current_edl,
        "proposed_edits": proposed_edits,
        "status_log": log,
    }
