import copy
import uuid
import logging
from typing import Dict, Any, List
import numpy as np

from assets.models import MediaAsset, HAS_PGVECTOR
from assets.services.gemini_pipeline import embed_search_query
from agents.state import EditorState

logger = logging.getLogger("sparrow.agents.b_roll")


def find_best_b_roll_asset(query: str) -> MediaAsset | None:
    """Queries pgvector database using dense vector embedding."""
    query_vector = embed_search_query(query)

    if HAS_PGVECTOR:
        from pgvector.django import CosineDistance
        qs = MediaAsset.objects.exclude(embedding__isnull=True)
        ranked = qs.annotate(distance=CosineDistance("embedding", query_vector)).order_by("distance")
        return ranked.first()
    else:
        # Cosine similarity calculation across assets
        assets = list(MediaAsset.objects.all())
        if not assets:
            return None

        best_asset = None
        best_sim = -1.0

        for a in assets:
            emb = a.embedding
            if emb and isinstance(emb, (list, tuple)) and len(emb) == 768:
                v1 = np.array(query_vector, dtype=np.float32)
                v2 = np.array(emb, dtype=np.float32)
                sim = float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2) + 1e-6))
            else:
                sim = 0.5 if any(k in a.title.lower() for k in query.lower().split()) else 0.1

            if sim > best_sim:
                best_sim = sim
                best_asset = a

        return best_asset


def b_roll_agent(state: EditorState) -> Dict[str, Any]:
    """
    Analyzes transcript for visual cues, queries pgvector vault, and inserts 4.0s B-roll overlays on Track V2.
    """
    log = list(state.get("status_log", []))
    log.append("Agent [B-Roll]: Extracting narrative topics and searching vector vault...")

    transcript = state.get("video_transcript", [])
    user_prompt = state.get("user_prompt", "").lower()
    b_roll_duration = state.get("b_roll_duration", 4.0)
    current_edl = copy.deepcopy(state.get("current_edl", {}))
    proposed_edits = list(state.get("proposed_edits", []))

    # Identify narrative moments that benefit from visual cutaways
    target_moments = []
    for phrase in transcript:
        text_lower = phrase["text"].lower()
        if any(k in text_lower for k in ["sunset", "golden hour", "warm", "water", "harbor", "cinematic", "story"]):
            target_moments.append({"time": phrase["start"], "topic": "golden hour sunset harbor"})
        elif any(k in text_lower for k in ["tech", "operating system", "software", "code", "ai"]):
            target_moments.append({"time": phrase["start"], "topic": "technology studio workspace"})

    # If prompt specifies a topic, prioritize it
    if not target_moments:
        target_moments.append({"time": 2.0, "topic": user_prompt or "b_roll visual footage"})

    tracks = current_edl.get("tracks", [])
    v2_track = next((t for t in tracks if t.get("id") == "v2"), None)
    if not v2_track:
        log.append("Agent [B-Roll]: Track V2 not found. Skipping overlay.")
        return {"current_edl": current_edl, "status_log": log}

    b_roll_count = 0
    for moment in target_moments[:2]: # Lay down up to 2 contextually relevant B-rolls
        topic = moment["topic"]
        match = find_best_b_roll_asset(topic)

        if match:
            target_time = round(moment["time"], 2)
            clip_id = f"broll_{uuid.uuid4().hex[:6]}"

            new_broll_clip = {
                "id": clip_id,
                "assetId": str(match.id),
                "trackId": "v2",
                "title": f"B-Roll: {match.title}",
                "timelineStart": target_time,
                "duration": b_roll_duration,
                "inPoint": 0.0,
                "outPoint": b_roll_duration,
                "speed": 1.0,
                "volume": 0.0, # B-roll overlays are muted by default
                "fileType": match.file_type,
                "proxyUrl": match.file.url if match.file else "",
                "thumbnailUrl": match.thumbnail.url if match.thumbnail else None,
                "effects": [],
            }

            v2_track["clips"].append(new_broll_clip)
            b_roll_count += 1

            proposed_edits.append({
                "type": "add_b_roll",
                "asset": match.title,
                "timelineStart": f"{target_time}s",
                "duration": f"{b_roll_duration}s",
                "topic": topic,
            })

            log.append(
                f"Agent [B-Roll]: Matched '{match.title}' for topic '{topic}'. Placed at {target_time}s on Track V2."
            )

    v2_track["clips"] = sorted(v2_track["clips"], key=lambda c: c["timelineStart"])

    if b_roll_count == 0:
        log.append("Agent [B-Roll]: No matching B-roll footage found in vault.")

    return {
        "current_edl": current_edl,
        "proposed_edits": proposed_edits,
        "status_log": log,
    }
