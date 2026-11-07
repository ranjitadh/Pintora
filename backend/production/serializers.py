from rest_framework import serializers

from .models import GeneratedFile


class GeneratedFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    design_name = serializers.CharField(source="design.name", read_only=True)
    stage_name = serializers.CharField(source="stage.name", read_only=True, default=None)

    class Meta:
        model = GeneratedFile
        fields = [
            "id", "design", "design_name", "order_item", "stage", "stage_name", "file_type",
            "status", "url", "dpi", "width_px", "height_px", "size_bytes", "error", "warnings",
            "metadata", "created_at", "completed_at",
        ]

    def get_url(self, obj):
        if not obj.file:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.file.url) if request else obj.file.url
