import logging
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import JSONParser

from agents.graph import run_editor_pipeline

logger = logging.getLogger("sparrow.agents.api")

class AgentEditView(APIView):
    """
    POST /api/agents/edit/
    Receives current EDL and user prompt, executes the multi-agent LangGraph workflow,
    and returns the mutated EDL with real-time agent execution status logs.
    """
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        edl = request.data.get("edl")
        if not edl:
            return Response(
                {"error": "Missing 'edl' object in request body."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        prompt = request.data.get("prompt", "Enhance timeline and pacing").strip()
        target_asset_id = request.data.get("target_asset_id")
        silence_threshold = float(request.data.get("silence_threshold", 1.2))
        b_roll_duration = float(request.data.get("b_roll_duration", 4.0))

        logger.info(f"Executing LangGraph agent edit with prompt: '{prompt}'")

        result = run_editor_pipeline(
            current_edl=edl,
            user_prompt=prompt,
            target_asset_id=target_asset_id,
            silence_threshold=silence_threshold,
            b_roll_duration=b_roll_duration,
        )

        return Response(result, status=status.HTTP_200_OK if result.get("success") else status.HTTP_500_INTERNAL_SERVER_ERROR)
