from rest_framework import serializers

from .models import (
    PrintArea,
    PrintingMethod,
    Product,
    ProductCategory,
    ProductImage,
    ProductPrintingMethod,
    ProductStage,
    ProductVariant,
    PricingRule,
)


class ProductCategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, default=0)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductCategory
        fields = ["id", "name", "slug", "description", "image_url", "sort_order", "product_count"]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class ProductImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    image = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = ProductImage
        fields = ["id", "image", "url", "alt", "sort_order"]

    def get_url(self, obj):
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = [
            "id", "name", "sku", "color_name", "color_hex", "size",
            "price_delta", "stock_quantity", "is_active", "sort_order",
        ]


class PrintAreaSerializer(serializers.ModelSerializer):
    width_px = serializers.IntegerField(read_only=True)
    height_px = serializers.IntegerField(read_only=True)
    export_width_px = serializers.IntegerField(read_only=True)
    export_height_px = serializers.IntegerField(read_only=True)

    class Meta:
        model = PrintArea
        fields = [
            "id", "name", "width_mm", "height_mm", "mockup_x", "mockup_y",
            "mockup_width", "mockup_height", "safe_area_mm", "bleed_mm",
            "editor_dpi", "export_dpi", "min_dpi", "grid_mm", "shape",
            "width_px", "height_px", "export_width_px", "export_height_px",
        ]


class ProductStageSerializer(serializers.ModelSerializer):
    print_area = PrintAreaSerializer(read_only=True)
    mockup_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductStage
        fields = ["id", "name", "slug", "mockup_url", "mockup_width", "mockup_height", "print_area", "sort_order"]

    def get_mockup_url(self, obj):
        if not obj.mockup_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.mockup_image.url) if request else obj.mockup_image.url


class PrintingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintingMethod
        fields = ["id", "name", "slug", "description", "base_fee", "per_area_fee", "sort_order"]


class ProductPrintingMethodSerializer(serializers.ModelSerializer):
    printing_method = PrintingMethodSerializer(read_only=True)

    class Meta:
        model = ProductPrintingMethod
        fields = ["id", "printing_method", "price_adjustment", "is_default"]


class ProductListSerializer(serializers.ModelSerializer):
    category = ProductCategorySerializer(read_only=True)
    image_url = serializers.SerializerMethodField()
    min_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    stage_count = serializers.SerializerMethodField()
    variant_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "short_description", "base_price", "min_price",
            "compare_at_price", "currency", "image_url", "category", "is_featured",
            "stage_count", "variant_count",
        ]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url

    def get_stage_count(self, obj):
        return obj.stages.count()

    def get_variant_count(self, obj):
        return obj.variants.count()


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    variants = serializers.SerializerMethodField()
    stages = serializers.SerializerMethodField()
    printing_methods = ProductPrintingMethodSerializer(
        source="printing_method_links", many=True, read_only=True
    )

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "description", "images", "variants", "stages", "printing_methods", "quantity_discounts",
        ]

    def get_variants(self, obj):
        variants = [v for v in obj.variants.all() if v.is_active]
        return ProductVariantSerializer(variants, many=True, context=self.context).data

    def get_stages(self, obj):
        stages = [s for s in obj.stages.all() if s.is_active and s.print_area]
        return ProductStageSerializer(stages, many=True, context=self.context).data


class AdminVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = [
            "id", "product", "name", "sku", "color_name", "color_hex", "size",
            "price_delta", "stock_quantity", "is_active", "sort_order",
        ]
        read_only_fields = ["id"]


class AdminCategorySerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    product_count = serializers.IntegerField(read_only=True, default=0)
    image = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = ProductCategory
        fields = [
            "id", "name", "slug", "description", "image", "image_url", "is_active",
            "sort_order", "product_count", "created_at",
        ]
        read_only_fields = ["id", "slug", "image_url", "product_count", "created_at"]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class AdminProductSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    stage_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Product
        fields = [
            "id", "category", "name", "slug", "short_description", "description",
            "base_price", "compare_at_price", "currency", "image_url", "is_active",
            "is_featured", "quantity_discounts", "metadata", "stage_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "image_url", "stage_count", "created_at", "updated_at"]

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.image.url) if request else obj.image.url


class AdminPrintAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintArea
        fields = "__all__"
        read_only_fields = ["id"]


class AdminStageSerializer(serializers.ModelSerializer):
    print_area_data = serializers.JSONField(write_only=True, required=False)
    mockup_url = serializers.SerializerMethodField()
    print_area = PrintAreaSerializer(read_only=True)

    class Meta:
        model = ProductStage
        fields = [
            "id", "product", "name", "slug", "mockup_image", "mockup_url",
            "mockup_width", "mockup_height", "print_area", "print_area_data",
            "sort_order", "is_active",
        ]
        read_only_fields = ["id", "slug", "mockup_url", "print_area"]
        validators = []
        extra_kwargs = {
            "mockup_image": {"write_only": True, "required": False},
            "product": {"required": False},
        }

    def get_mockup_url(self, obj):
        if not obj.mockup_image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.mockup_image.url) if request else obj.mockup_image.url

    def validate(self, attrs):
        product = attrs.get("product") or self.context.get("product")
        if self.instance is not None:
            product = product or self.instance.product
        if not product:
            raise serializers.ValidationError({"product": "Product is required."})
        name = attrs.get("name", getattr(self.instance, "name", None))
        duplicates = ProductStage.objects.filter(product=product, name=name)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if name and duplicates.exists():
            raise serializers.ValidationError(
                {"name": "A stage with this name already exists for this product."}
            )
        attrs["product"] = product
        return attrs

    def create(self, validated_data):
        print_area_data = validated_data.pop("print_area_data", None)
        if not print_area_data:
            raise serializers.ValidationError({"print_area_data": "Print area configuration is required."})
        area_serializer = AdminPrintAreaSerializer(data=print_area_data)
        area_serializer.is_valid(raise_exception=True)
        area = area_serializer.save()
        stage = ProductStage.objects.create(print_area=area, **validated_data)
        return stage

    def update(self, instance, validated_data):
        print_area_data = validated_data.pop("print_area_data", None)
        instance = super().update(instance, validated_data)
        if print_area_data and instance.print_area_id:
            area_serializer = AdminPrintAreaSerializer(
                instance.print_area, data=print_area_data, partial=True
            )
            area_serializer.is_valid(raise_exception=True)
            area_serializer.save()
        return instance


class AdminPrintingMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrintingMethod
        fields = "__all__"
        read_only_fields = ["id", "slug"]


class AdminPricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = "__all__"
        read_only_fields = ["id"]
