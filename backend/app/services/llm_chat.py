"""LLM chat: build tutor prompt, stream response, persist message. Stub."""
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.session import Session
from app.models.chat_message import ChatMessage


async def stream_tutor_response(
    db: AsyncSession,
    session: Session,
    user_message: str,
    include_steps: bool = True,
) -> AsyncGenerator[str, None]:
    """
    Load problem, steps, chat history; build prompt; stream LLM tokens; persist assistant message.
    Stub: yields one chunk then stops. Real impl uses OpenAI (or other) streaming API.
    """
    yield "Stub: connect OpenAI in services/llm_chat for real streaming."


async def save_assistant_message(db: AsyncSession, session_id: str, content: str) -> ChatMessage:
    """Persist assistant message after stream completes."""
    msg = ChatMessage(session_id=session_id, role="assistant", content=content)
    db.add(msg)
    await db.flush()
    return msg
