"""Blob storage for canvas snapshot images. Stub."""
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from io import BytesIO


async def upload_snapshot_image(session_id: str, snapshot_id: str, image_data: "BytesIO") -> str | None:
    """
    Upload PNG bytes to bucket (e.g. Supabase Storage or S3). Return public URL or None.
    Stub: returns None.
    """
    return None
