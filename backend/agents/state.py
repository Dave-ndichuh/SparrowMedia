from typing import TypedDict, List, Dict, Any, Optional

class EditorState(TypedDict):
    """
    State object passed between LangGraph agent nodes.
    Represents the centralized JSON Edit Decision List and AI operation metadata.
    """
    current_edl: Dict[str, Any]
    user_prompt: str
    target_asset_id: Optional[str]
    video_transcript: List[Dict[str, Any]]
    proposed_edits: List[Dict[str, Any]]
    status_log: List[str]
    silence_threshold: float
    b_roll_duration: float
    routing_decision: str
    is_completed: bool
    error: Optional[str]
