"""Chat: send message (streaming SSE), get history."""
import json
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUserId, DbSession
from app.models.session import Session
from app.models.chat_message import ChatMessage
from app.schemas.chat import ChatSendRequest, ChatHistoryResponse, ChatMessageRead

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/{session_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    session_id: str,
    user_id: CurrentUserId,
    db: DbSession,
    limit: int = 50,
):
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    msg_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
        .limit(limit)
    )
    messages = msg_result.scalars().all()
    return ChatHistoryResponse(messages=[ChatMessageRead.model_validate(m) for m in messages])


async def _stream_stub(session_id: str, user_message: str, db: DbSession):
    """Stub: yield SSE events (one token, then done). Real impl calls services.llm_chat."""
    # Persist user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=user_message)
    db.add(user_msg)
    await db.flush()
    # Stub assistant reply
    full_reply = "This is a stub reply. Connect an LLM in services/llm_chat for streaming responses."
    yield f"data: {json.dumps({'type': 'token', 'content': full_reply})}\n\n"
    yield f"data: {json.dumps({'type': 'done'})}\n\n"
    # Persist assistant message (in real impl do this after stream in the endpoint)
    assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=full_reply)
    db.add(assistant_msg)
    await db.flush()


@router.post("")
async def send_chat_message(body: ChatSendRequest, user_id: CurrentUserId, db: DbSession):
    result = await db.execute(
        select(Session).where(Session.id == body.session_id, Session.user_id == user_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return StreamingResponse(
        _stream_stub(body.session_id, body.message, db),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
