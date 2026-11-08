from rest_framework import serializers

MAX_MESSAGE_CHARS = 1200
MAX_HISTORY_TURNS = 8


class ChatTurnSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=("user", "assistant"))
    content = serializers.CharField(max_length=MAX_MESSAGE_CHARS, trim_whitespace=True)


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=MAX_MESSAGE_CHARS, trim_whitespace=True)
    history = ChatTurnSerializer(many=True, required=False, default=list)

    def validate_message(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Please enter a message.")
        return value

    def validate_history(self, value):
        return list(value or [])[-MAX_HISTORY_TURNS:]
