from rest_framework import serializers

class PhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField(required=True)
