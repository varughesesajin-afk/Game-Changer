from typing import List

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user, is_admin
from lib.community_access import get_community, require_manage
from lib.db import db
from models.schemas import GalleryPhoto, GalleryPhotoIn, User

router = APIRouter(tags=["gallery"])


@router.get("/communities/{cid}/gallery", response_model=List[GalleryPhoto])
async def list_gallery(cid: str):
    docs = await db.gallery.find({"community_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [GalleryPhoto(**d) for d in docs]


@router.post("/communities/{cid}/gallery", response_model=GalleryPhoto)
async def add_photo(cid: str, body: GalleryPhotoIn, user: User = Depends(current_user)):
    c = await get_community(cid)
    require_manage(c, user)
    if not body.url.startswith("/api/images/"):
        raise HTTPException(400, "Upload the photo first")
    p = GalleryPhoto(**body.model_dump(), community_id=cid, uploaded_by=user.user_id, uploaded_by_name=user.name)
    await db.gallery.insert_one(p.model_dump())
    return p


@router.delete("/gallery/{pid}")
async def delete_photo(pid: str, user: User = Depends(current_user)):
    doc = await db.gallery.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Photo not found")
    c = await get_community(doc["community_id"])
    if c.owner_id != user.user_id and not is_admin(user):
        raise HTTPException(403, "Only the community host can remove photos")
    await db.gallery.delete_one({"id": pid})
    return {"ok": True}
