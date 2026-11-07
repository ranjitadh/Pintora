from rest_framework import serializers

from .models import Clipart, Design, DesignAsset, DesignTemplate, DesignVersion, FontResource


def absolute_url(obj, field, context):
    file = getattr(obj, field)
    if not file:
        return None
    request = context.get("request")
    return request.build_absolute_uri(file.url) if request else file.url


class TemplateSerializer(serializers.ModelSerializer):
    preview_url = serializers.SerializerMethodField()
    product_slug = serializers.SlugRelatedField(source="product", slug_field="slug", read_only=True)

    class Meta:
        model = DesignTemplate
        fields = [
            "id", "name", "slug", "category", "tags", "description", "preview_url",
            "canvas_json", "price", "product", "product_slug", "visibility",
        ]

    def get_preview_url(self, obj):
        return absolute_url(obj, "preview_image", self.context)


class AdminTemplateSerializer(serializers.ModelSerializer):
    preview_url = serializers.SerializerMethodField()

    class Meta:
        model = DesignTemplate
        fields = "__all__"
        read_only_fields = ["id", "slug", "preview_url"]

    def get_preview_url(self, obj):
        return absolute_url(obj, "preview_image", self.context)

    def validate_canvas_json(self, value):
        from .validation import DesignValidationError, validate_canvas

        try:
            validate_canvas(value, allow_stage_map=False)
        except DesignValidationError as exc:
            raise serializers.ValidationError(str(exc)) from exc
        return value


class ClipartSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Clipart
        fields = ["id", "name", "category", "tags", "image_url", "thumbnail_url", "price"]

    def get_image_url(self, obj):
        return absolute_url(obj, "image", self.context)

    def get_thumbnail_url(self, obj):
        return absolute_url(obj, "thumbnail", self.context) or absolute_url(obj, "image", self.context)


class AdminClipartSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Clipart
        fields = "__all__"
        read_only_fields = ["id", "image_url"]

    def get_image_url(self, obj):
        return absolute_url(obj, "image", self.context)


class FontResourceSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = FontResource
        fields = ["id", "name", "family", "url", "weight", "style"]

    def get_url(self, obj):
        return absolute_url(obj, "file", self.context)


class AdminFontResourceSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = FontResource
        fields = "__all__"
        read_only_fields = ["id", "url"]

    def get_url(self, obj):
        return absolute_url(obj, "file", self.context)


class DesignVersionSerializer(serializers.ModelSerializer):
    preview_url = serializers.SerializerMethodField()
    created_by_email = serializers.EmailField(source="created_by.email", read_only=True, default=None)

    class Meta:
        model = DesignVersion
        fields = ["id", "version", "canvas_json", "preview_url", "created_at", "created_by_email"]

    def get_preview_url(self, obj):
        return absolute_url(obj, "preview_image", self.context)


class DesignListSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_slug = serializers.SlugRelatedField(source="product", slug_field="slug", read_only=True)
    preview_url = serializers.SerializerMethodField()
    stage_name = serializers.CharField(source="stage.name", read_only=True, default=None)

    class Meta:
        model = Design
        fields = [
            "id", "name", "product", "product_name", "product_slug", "stage", "stage_name",
            "preview_url", "status", "version", "created_at", "updated_at",
        ]

    def get_preview_url(self, obj):
        return absolute_url(obj, "preview_image", self.context)


class DesignSerializer(DesignListSerializer):
    class Meta(DesignListSerializer.Meta):
        fields = DesignListSerializer.Meta.fields + ["canvas_json", "metadata"]


class DesignWriteSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    stage = serializers.UUIDField(required=False, allow_null=True)
    name = serializers.CharField(max_length=180, required=False, default="Untitled design")
    canvas_json = serializers.JSONField()
    status = serializers.ChoiceField(choices=Design.Status.choices, required=False, default="saved")
    metadata = serializers.JSONField(required=False, default=dict)

    def validate(self, attrs):
        from catalog.models import Product, ProductStage
        from .validation import DesignValidationError, validate_design_payload

        try:
            product = Product.objects.get(pk=attrs["product"], is_active=True)
        except Product.DoesNotExist:
            raise serializers.ValidationError({"product": "Product not found."})

        stages = list(product.stages.filter(is_active=True))
        if not stages:
            raise serializers.ValidationError({"product": "This product has no printable stages."})
        stage = None
        if attrs.get("stage"):
            stage = next((s for s in stages if str(s.id) == str(attrs["stage"])), None)
            if stage is None:
                raise serializers.ValidationError({"stage": "Stage does not belong to this product."})
        stage = stage or stages[0]
        attrs["stage_obj"] = stage
        attrs["product_obj"] = product

        try:
            payload = validate_design_payload(attrs["canvas_json"], stage_key=str(stage.id))
        except DesignValidationError as exc:
            raise serializers.ValidationError({"canvas_json": str(exc)}) from exc

        stage_ids = {str(s.id) for s in stages}
        unknown = set(payload.get("stages", {})) - stage_ids
        if unknown:
            raise serializers.ValidationError(
                {"canvas_json": "Design contains stages that do not belong to this product."}
            )
        if str(stage.id) not in payload.get("stages", {}):
            payload["stages"][str(stage.id)] = payload["stages"].get(
                payload.get("activeStage"), {"objects": [], "width": round(float(stage.print_area.width_mm) / 25.4 * stage.print_area.editor_dpi) if stage.print_area else 1000, "height": round(float(stage.print_area.height_mm) / 25.4 * stage.print_area.editor_dpi) if stage.print_area else 1000}
            )
        payload.setdefault("activeStage", str(stage.id))
        attrs["canvas_json"] = payload
        return attrs


class DesignAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = DesignAsset
        fields = [
            "id", "url", "asset_type", "original_name", "mime_type", "size_bytes",
            "width", "height", "created_at",
        ]

    def get_url(self, obj):
        return absolute_url(obj, "file", self.context)
