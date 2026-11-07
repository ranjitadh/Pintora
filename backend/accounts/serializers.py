from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, UserProfile


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ["phone", "company", "address", "city", "postal_code", "country", "avatar"]
        read_only_fields = []


class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "first_name", "last_name", "role",
            "is_staff", "is_superuser", "date_joined", "profile", "display_name",
        ]
        read_only_fields = ["id", "email", "role", "is_staff", "is_superuser", "date_joined", "display_name"]

    def get_display_name(self, obj):
        return obj.get_full_name() or obj.first_name or obj.email.split("@")[0]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8, style={"input_type": "password"})
    password_confirm = serializers.CharField(write_only=True, style={"input_type": "password"})

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "password", "password_confirm"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return value.lower()

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.username = user.email
        user.set_password(password)
        user.save()
        UserProfile.objects.create(user=user)
        return user


class EmailTokenObtainPairSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})

    def validate(self, attrs):
        from rest_framework.exceptions import AuthenticationFailed
        from rest_framework_simplejwt.tokens import RefreshToken

        email = attrs.get("email", "").lower()
        password = attrs.get("password", "")
        user = User.objects.filter(email__iexact=email).first()
        if user is None or not user.check_password(password):
            raise AuthenticationFailed("Incorrect email or password.")
        if not user.is_active:
            raise AuthenticationFailed("This account has been disabled.")
        self.user = user
        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user).data,
        }


class AdminUserSerializer(serializers.ModelSerializer):
    design_count = serializers.IntegerField(read_only=True, default=0)
    order_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "role", "is_active",
            "date_joined", "design_count", "order_count",
        ]
