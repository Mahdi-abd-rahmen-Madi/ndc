from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _get_user_from_token(token_key: str):
    from rest_framework.authtoken.models import Token
    try:
        token = Token.objects.select_related("user").get(key=token_key)
        return token.user
    except Token.DoesNotExist:
        return AnonymousUser()


class TokenQueryAuthMiddleware:
    """
    ASGI middleware that authenticates WebSocket connections via `?token=<drf-token>`
    query parameter, falling back to any session-authenticated user already in scope.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        user = scope.get("user")
        if not user or not user.is_authenticated:
            query_string = scope.get("query_string", b"").decode("utf-8", errors="ignore")
            params = parse_qs(query_string)
            token_list = params.get("token")
            if token_list:
                scope["user"] = await _get_user_from_token(token_list[0])
            elif not user:
                scope["user"] = AnonymousUser()
        return await self.inner(scope, receive, send)

