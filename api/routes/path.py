from fastapi import APIRouter, Query
from pathlib import Path
from pypinyin import lazy_pinyin
from natsort import natsorted

from src.models import ApiPathls

path_router = APIRouter(prefix="/path", tags=["path"])


@path_router.get("/ls", response_model=ApiPathls)
async def list_directory(
    path_str: str = Query(..., description="Directory path to list")
):
    path = Path(path_str)
    if not path.exists():
        raise Exception("Path not found")
    if not path.is_dir():
        return ApiPathls(dir=[], file=[])
    dir: list[str] = []
    file: list[str] = []
    for p in path.iterdir():
        if p.name.startswith("."):
            continue
        if p.is_dir():
            dir.append(p.name)
        else:
            if p.suffix.lower() in [
                ".mp4",
                ".mkv",
                ".avi",
                ".mov",
                ".flv",
                ".wmv",
                ".ts",
                ".f4v",
                ".m4v",
            ]:
                file.append(p.name)
    return ApiPathls(
        dir=natsorted(dir, key=lambda x: lazy_pinyin(x)),
        file=natsorted(file, key=lambda x: lazy_pinyin(x)),
    )


@path_router.get("/mkdir", response_model=None)
async def mkdir_path(
    path_str: str = Query(..., description="Directory path to create")
):
    path = Path(path_str)
    path.mkdir(parents=True, exist_ok=True)
