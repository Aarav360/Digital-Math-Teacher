"""Auth request/response schemas."""
from pydantic import BaseModel


class OAuthFinishRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user_id: str
