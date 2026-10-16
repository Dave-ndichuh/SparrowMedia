import uuid
from django.db import models
from django.conf import settings

# Graceful pgvector check
try:
    from pgvector.django import VectorField, HnswIndex
    HAS_PGVECTOR = settings.USE_POSTGRES
except ImportError:
    HAS_PGVECTOR = False


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255, default="Main Studio Production")
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class MediaAsset(models.Model):
    FILE_TYPE_CHOICES = [
        ("video", "Video"),
        ("audio", "Audio"),
        ("image", "Image"),
        ("graphics", "Graphics / Overlay"),
    ]

    STATUS_CHOICES = [
        ("uploading", "Uploading"),
        ("processing", "Generating Proxy & Tagging"),
        ("indexed", "Indexed & Ready"),
        ("failed", "Processing Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="assets", null=True, blank=True)
    title = models.CharField(max_length=255)
    file_type = models.CharField(max_length=20, choices=FILE_TYPE_CHOICES, default="video")
    
    file = models.FileField(upload_to="originals/%Y/%m/")
    proxy_file = models.FileField(upload_to="proxies/%Y/%m/", null=True, blank=True)
    thumbnail = models.ImageField(upload_to="thumbnails/%Y/%m/", null=True, blank=True)
    
    duration = models.FloatField(default=0.0)
    width = models.IntegerField(default=0)
    height = models.IntegerField(default=0)
    fps = models.FloatField(default=30.0)
    
    transcript = models.TextField(blank=True, default="")
    semantic_description = models.TextField(blank=True, default="")
    semantic_tags = models.JSONField(default=list, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)

    # 768-dimensional embedding from Gemini text-embedding-004
    if HAS_PGVECTOR:
        embedding = VectorField(dimensions=768, null=True, blank=True)
    else:
        embedding = models.JSONField(default=list, blank=True, null=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="uploading")
    status_detail = models.CharField(max_length=255, blank=True, default="")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        if HAS_PGVECTOR:
            indexes = [
                HnswIndex(
                    name="asset_embed_hnsw_idx",
                    fields=["embedding"],
                    m=16,
                    ef_construction=64,
                    opclasses=["vector_cosine_ops"],
                ),
            ]

    def __str__(self):
        return f"{self.title} ({self.file_type}) [{self.status}]"


class AssetChunk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(MediaAsset, on_delete=models.CASCADE, related_name="chunks")
    start_time = models.FloatField(default=0.0)
    end_time = models.FloatField(default=0.0)
    text_transcript = models.TextField(blank=True, default="")
    visual_summary = models.TextField(blank=True, default="")
    
    if HAS_PGVECTOR:
        chunk_embedding = VectorField(dimensions=768, null=True, blank=True)
    else:
        chunk_embedding = models.JSONField(default=list, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Chunk {self.start_time:.1f}s-{self.end_time:.1f}s of {self.asset.title}"
