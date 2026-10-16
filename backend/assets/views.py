import os
import logging
from pathlib import Path
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
import numpy as np

from assets.models import MediaAsset, Project, HAS_PGVECTOR
from assets.serializers import MediaAssetSerializer
from assets.services.proxy_generator import process_media_proxy
from assets.services.gemini_pipeline import analyze_asset_with_gemini, embed_search_query

logger = logging.getLogger("sparrow.assets")


def cosine_similarity(v1, v2):
    """Calculates cosine similarity between two 1D numpy arrays."""
    a = np.array(v1, dtype=np.float32)
    b = np.array(v2, dtype=np.float32)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


class AssetUploadView(APIView):
    """
    POST /api/assets/upload/
    Handles file upload, extracts proxy keyframes, runs Gemini multimodal tagging,
    and indexes the 768d vector into pgvector.
    """
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "No file uploaded. Please provide 'file' field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        title = request.data.get("title") or uploaded_file.name
        detected_type = "video"
        ext = Path(uploaded_file.name).suffix.lower()
        if ext in [".jpg", ".jpeg", ".png", ".webp", ".svg"]:
            detected_type = "image"
        elif ext in [".mp3", ".wav", ".aac", ".flac", ".m4a"]:
            detected_type = "audio"
        elif ext in [".mp4", ".mov", ".avi", ".mkv", ".webm"]:
            detected_type = "video"

        file_type = request.data.get("file_type", detected_type)

        # 1. Create MediaAsset record
        asset = MediaAsset.objects.create(
            title=title,
            file_type=file_type,
            file=uploaded_file,
            status="uploading",
            status_detail="Saved original media to storage...",
        )

        try:
            # 2. Extract proxy, thumbnail, and keyframes
            asset.status = "processing"
            asset.status_detail = "Extracting proxy & keyframe visual samples..."
            asset.save(update_fields=["status", "status_detail"])

            output_dir = os.path.join(settings.MEDIA_ROOT, "extracted", str(asset.id))
            file_abs_path = asset.file.path

            proxy_data = process_media_proxy(file_abs_path, output_dir)
            asset.duration = proxy_data["duration"]
            asset.width = proxy_data["width"]
            asset.height = proxy_data["height"]
            asset.fps = proxy_data["fps"]

            if proxy_data.get("thumbnail_path") and os.path.exists(proxy_data["thumbnail_path"]):
                rel_thumb = os.path.relpath(proxy_data["thumbnail_path"], settings.MEDIA_ROOT)
                asset.thumbnail = rel_thumb.replace("\\", "/")

            # 3. Gemini Multimodal Tagging & Vector Pipeline
            asset.status_detail = "Gemini AI indexing scene semantics, mood & lighting..."
            asset.save(update_fields=["status", "status_detail", "duration", "width", "height", "fps", "thumbnail"])

            ai_results = analyze_asset_with_gemini(
                title=asset.title,
                file_type=asset.file_type,
                file_path=file_abs_path,
                keyframe_paths=proxy_data["keyframes"],
                duration=asset.duration,
            )

            asset.semantic_description = ai_results["description"]
            asset.semantic_tags = ai_results["tags"]
            asset.metadata_json = ai_results["metadata"]
            asset.embedding = ai_results["embedding"]
            asset.status = "indexed"
            asset.status_detail = "Ready in Media Library"
            asset.save()

            serializer = MediaAssetSerializer(asset, context={"request": request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Error processing asset {asset.id}: {e}", exc_info=True)
            asset.status = "failed"
            asset.status_detail = f"Processing error: {str(e)}"
            asset.save()
            return Response(
                {"error": str(e), "asset_id": str(asset.id)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class AssetSearchView(APIView):
    """
    POST /api/assets/search/
    Takes a natural language query (e.g., 'dramatic lighting', 'upbeat jazz'),
    computes its 768d embedding via Gemini, and runs cosine similarity search over pgvector.
    """
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        query = request.data.get("query", "").strip()
        if not query:
            return Response({"error": "Empty search query."}, status=status.HTTP_400_BAD_REQUEST)

        file_type = request.data.get("file_type")
        limit = int(request.data.get("limit", 20))

        # Generate query embedding (768 dimensions)
        query_vector = embed_search_query(query)

        results = []

        if HAS_PGVECTOR:
            from pgvector.django import CosineDistance
            qs = MediaAsset.objects.exclude(embedding__isnull=True)
            if file_type and file_type != "all":
                qs = qs.filter(file_type=file_type)

            # CosineDistance: 0 = identical, 2 = opposite
            ranked = qs.annotate(distance=CosineDistance("embedding", query_vector)).order_by("distance")[:limit]

            for item in ranked:
                data = MediaAssetSerializer(item, context={"request": request}).data
                # Convert distance to similarity percentage
                sim = max(0.0, min(1.0, 1.0 - (item.distance if hasattr(item, "distance") else 0.5)))
                data["similarity_score"] = round(sim * 100, 1)
                results.append(data)
        else:
            # High-performance NumPy Cosine fallback for SQLite/local mode
            qs = MediaAsset.objects.all()
            if file_type and file_type != "all":
                qs = qs.filter(file_type=file_type)

            scored_items = []
            for item in qs:
                emb = item.embedding
                if emb and isinstance(emb, (list, tuple)) and len(emb) == 768:
                    sim = cosine_similarity(query_vector, emb)
                else:
                    # Text match fallback
                    text_corpus = f"{item.title} {item.semantic_description} {' '.join(item.semantic_tags)}".lower()
                    sim = 0.5 if query.lower() in text_corpus else 0.1
                scored_items.append((item, sim))

            # Sort by similarity descending
            scored_items.sort(key=lambda x: x[1], reverse=True)

            for item, sim in scored_items[:limit]:
                data = MediaAssetSerializer(item, context={"request": request}).data
                data["similarity_score"] = round(sim * 100, 1)
                results.append(data)

        return Response({
            "query": query,
            "total_matches": len(results),
            "results": results,
        })


class AssetListView(APIView):
    """
    GET /api/assets/
    Lists media assets with optional filtering by type or status.
    """
    def get(self, request, *args, **kwargs):
        qs = MediaAsset.objects.all()
        file_type = request.query_params.get("file_type")
        if file_type and file_type != "all":
            qs = qs.filter(file_type=file_type)

        search_kw = request.query_params.get("search")
        if search_kw:
            qs = qs.filter(title__icontains=search_kw)

        serializer = MediaAssetSerializer(qs, many=True, context={"request": request})
        return Response({"assets": serializer.data, "count": qs.count()})


class AssetDetailView(APIView):
    """
    GET / DELETE /api/assets/<uuid:pk>/
    """
    def get(self, request, pk, *args, **kwargs):
        try:
            asset = MediaAsset.objects.get(pk=pk)
            return Response(MediaAssetSerializer(asset, context={"request": request}).data)
        except MediaAsset.DoesNotExist:
            return Response({"error": "Asset not found"}, status=status.HTTP_404_NOT_FOUND)

    def delete(self, request, pk, *args, **kwargs):
        try:
            asset = MediaAsset.objects.get(pk=pk)
            asset.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except MediaAsset.DoesNotExist:
            return Response({"error": "Asset not found"}, status=status.HTTP_404_NOT_FOUND)
