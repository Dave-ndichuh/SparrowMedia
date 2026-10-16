from rest_framework import serializers
from assets.models import MediaAsset, Project, AssetChunk

class MediaAssetSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    proxy_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = [
            "id",
            "title",
            "file_type",
            "file_url",
            "proxy_url",
            "thumbnail_url",
            "duration",
            "width",
            "height",
            "fps",
            "transcript",
            "semantic_description",
            "semantic_tags",
            "metadata_json",
            "status",
            "status_detail",
            "created_at",
            "updated_at",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file:
            return request.build_absolute_uri(obj.file.url) if request else obj.file.url
        return None

    def get_proxy_url(self, obj):
        request = self.context.get("request")
        if obj.proxy_file:
            return request.build_absolute_uri(obj.proxy_file.url) if request else obj.proxy_file.url
        return self.get_file_url(obj)

    def get_thumbnail_url(self, obj):
        request = self.context.get("request")
        if obj.thumbnail:
            return request.build_absolute_uri(obj.thumbnail.url) if request else obj.thumbnail.url
        return None


class ProjectSerializer(serializers.ModelSerializer):
    asset_count = serializers.IntegerField(source="assets.count", read_only=True)

    class Meta:
        model = Project
        fields = ["id", "title", "description", "asset_count", "created_at", "updated_at"]
