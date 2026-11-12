"""Small image uploads (community cover photos) stored in Mongo and served under /api/images/{id}."""
import base64
import binascii
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import current_user
from lib.db import db
from models.schemas import ImageUploadIn, ImageUploadOut, User, _id

router = APIRouter(prefix="/images", tags=["images"])

MAX_BYTES = 2 * 1024 * 1024
DATA_URL = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,(.+)$", re.S)


@router.post("", response_model=ImageUploadOut)
async def upload(body: ImageUploadIn, user: User = Depends(current_user)):
    m = DATA_URL.match(body.data_url)
    if not m:
        raise HTTPException(400, "Upload a JPG, PNG or WebP image")
    try:
        data = base64.b64decode(m.group(2), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Image data is corrupted")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Image is too large (max 2 MB)")
    iid = _id()
    await db.images.insert_one({"id": iid, "content_type": m.group(1), "data": data, "owner_id": user.user_id,
                                "created_at": datetime.now(timezone.utc)})
    return ImageUploadOut(id=iid, url=f"/api/images/{iid}")


@router.get("/{iid}")
async def get_image(iid: str):
    doc = await db.images.find_one({"id": iid}, {"_id": 0, "data": 1, "content_type": 1})
    if not doc:
        raise HTTPException(404, "Image not found")
    return Response(content=bytes(doc["data"]), media_type=doc["content_type"],
                    headers={"Cache-Control": "public, max-age=31536000, immutable"})
