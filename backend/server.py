import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
from pathlib import Path

from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from lib.db import client, ensure_indexes  # noqa: E402
from routers import admin, auth, communities, gallery, images, reminders, tournaments  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.index_task = asyncio.create_task(ensure_indexes())
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "PlayHub API"}


api_router.include_router(auth.router)
api_router.include_router(communities.router)
api_router.include_router(tournaments.router)
api_router.include_router(admin.router)
api_router.include_router(reminders.router)
api_router.include_router(images.router)
api_router.include_router(gallery.router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')

app.include_router(api_router)


# ---- single-service hosting: serve the built React app (frontend/dist) from this same FastAPI process ----
# Only active when `yarn build` output exists (e.g. in the Docker image on Render); in local dev Vite serves the frontend.
DIST_DIR = ROOT_DIR.parent / "frontend" / "dist"
if DIST_DIR.is_dir():
    if (DIST_DIR / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            return JSONResponse({"detail": "Not found"}, status_code=404)
        candidate = (DIST_DIR / full_path).resolve()
        if full_path and candidate.is_file() and DIST_DIR.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(DIST_DIR / "index.html")  # React Router handles the rest
