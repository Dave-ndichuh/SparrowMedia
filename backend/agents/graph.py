"""
Sparrow Media OS - Multi-Agent LangGraph Workflow
Orchestrates speech transcription, silence trimming, semantic B-roll overlay,
and conflict resolution into a production-grade automated NLE editing pipeline.
"""

import logging
from typing import Dict, Any, Literal
from langgraph.graph import StateGraph, END

from agents.state import EditorState
from agents.nodes.transcription_node import transcription_node
from agents.nodes.trimmer_agent import trimmer_agent
from agents.nodes.b_roll_agent import b_roll_agent
from agents.nodes.conflict_resolution_node import conflict_resolution_node

logger = logging.getLogger("sparrow.agents.graph")


def supervisor_router(state: EditorState) -> Literal["trim_only", "broll_only", "both"]:
    """
    Analyzes user prompt and decides execution flow.
    """
    prompt = state.get("user_prompt", "").lower()

    has_trim = any(k in prompt for k in ["trim", "cut", "dead air", "silence", "filler", "stutter", "pacing", "clean"])
    has_broll = any(k in prompt for k in ["b-roll", "broll", "overlay", "footage", "illustrate", "sunset", "cutaway", "video 2"])

    if has_trim and not has_broll:
        return "trim_only"
    if has_broll and not has_trim:
        return "broll_only"
    return "both"


def build_editor_graph():
    """Builds and compiles the multi-agent LangGraph workflow."""
    workflow = StateGraph(EditorState)

    # Register Nodes
    workflow.add_node("transcription", transcription_node)
    workflow.add_node("trimmer", trimmer_agent)
    workflow.add_node("b_roll", b_roll_agent)
    workflow.add_node("conflict_resolution", conflict_resolution_node)

    # Set Entry Point
    workflow.set_entry_point("transcription")

    # Conditional Routing from Transcription
    workflow.add_conditional_edges(
        "transcription",
        supervisor_router,
        {
            "trim_only": "trimmer",
            "broll_only": "b_roll",
            "both": "trimmer",
        },
    )

    # Sequential chaining
    workflow.add_edge("trimmer", "b_roll")
    workflow.add_edge("b_roll", "conflict_resolution")
    workflow.add_edge("conflict_resolution", END)

    return workflow.compile()


# Singleton compiled graph
editor_graph = build_editor_graph()


def run_editor_pipeline(
    current_edl: Dict[str, Any],
    user_prompt: str,
    target_asset_id: str | None = None,
    silence_threshold: float = 1.2,
    b_roll_duration: float = 4.0,
) -> Dict[str, Any]:
    """
    Entry point invoked by Django API view.
    Runs LangGraph workflow and returns mutated EDL with detailed execution logs.
    """
    initial_state: EditorState = {
        "current_edl": current_edl,
        "user_prompt": user_prompt,
        "target_asset_id": target_asset_id,
        "video_transcript": [],
        "proposed_edits": [],
        "status_log": [
            f"Supervisor: Received editing instruction: '{user_prompt}'",
            "Supervisor: Initializing multi-agent pipeline...",
        ],
        "silence_threshold": silence_threshold,
        "b_roll_duration": b_roll_duration,
        "routing_decision": "",
        "is_completed": False,
        "error": None,
    }

    try:
        final_state = editor_graph.invoke(initial_state)
        return {
            "success": True,
            "edl": final_state["current_edl"],
            "status_log": final_state["status_log"],
            "proposed_edits": final_state["proposed_edits"],
        }
    except Exception as ex:
        logger.error(f"Error during LangGraph execution: {ex}", exc_info=True)
        return {
            "success": False,
            "error": str(ex),
            "edl": current_edl,
            "status_log": initial_state["status_log"] + [f"Error in pipeline: {str(ex)}"],
            "proposed_edits": [],
        }


if __name__ == "__main__":
    import json
    dummy_edl = {
        "tracks": [
            {"id": "v1", "name": "V1: Main", "type": "video", "clips": [
                {"id": "clip_main", "title": "Main Interview", "timelineStart": 0.0, "duration": 20.0, "inPoint": 0.0, "outPoint": 20.0, "speed": 1.0, "volume": 1.0, "fileType": "video"}
            ]},
            {"id": "v2", "name": "V2: B-Roll", "type": "video", "clips": []},
            {"id": "a1", "name": "A1: Audio", "type": "audio", "clips": [
                {"id": "clip_audio", "title": "Main Audio", "timelineStart": 0.0, "duration": 20.0, "inPoint": 0.0, "outPoint": 20.0, "speed": 1.0, "volume": 1.0, "fileType": "audio"}
            ]},
        ],
        "duration": 30.0,
        "fps": 60,
    }

    res = run_editor_pipeline(dummy_edl, "Cut the dead air and add sunset B-roll")
    print(json.dumps(res, indent=2))
