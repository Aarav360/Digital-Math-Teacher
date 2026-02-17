"""Chat request/response schemas."""
from datetime import datetime
from pydantic import BaseModel


class ChatMessageRead(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSendRequest(BaseModel):
    session_id: str
    message: str
    include_steps: bool = True


class ChatHistoryResponse(BaseModel):
    messages: list[ChatMessageRead]
