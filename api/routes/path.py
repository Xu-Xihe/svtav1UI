from fastapi import APIRouter, Query
from pathlib import Path
from pypinyin import lazy_pinyin
from natsort import natsorted
from typing import Literal

from src.models import ApiPath, VideoSuffixs
from src.logger import Lg

path_router = APIRouter(prefix="/path", tags=["Path"])


@path_router.get("/home", response_model=str)
async def get_home_path():
    """
    Get the home directory path.
    """
    return str(Path.home().resolve())


@path_router.get("/ls", response_model=ApiPath)
async def list_directory(
    path_str: str = Query(..., description="Directory path to list"),
    filter: str = Query(
        "video",
        description="Type of files to list: 'video', 'model' or 'subtitle'. Use space to separate multiple types, e.g., 'video model'.",
    ),
):
    path = Path(path_str)
    if not path.exists():
        raise Exception("Path not found")
    if not path.is_dir():
        return ApiPath(dir=[], file=[])
    dir: list[str] = []
    file: list[str] = []
    for p in path.iterdir():
        if p.name.startswith("."):
            continue
        if p.is_dir():
            dir.append(p.name)
        else:
            if "video" in filter and p.suffix.lower() in VideoSuffixs:
                file.append(p.name)
            if "model" in filter and p.suffix.lower() in [".bin"]:
                file.append(p.name)
            if "subtitle" in filter and p.suffix.lower() in [".srt"]:
                file.append(p.name)
    return ApiPath(
        dir=natsorted(dir, key=lambda x: lazy_pinyin(x)),
        file=natsorted(file, key=lambda x: lazy_pinyin(x)),
    )


@path_router.get("/mkdir", response_model=None)
async def mkdir_path(
    path_str: str = Query(..., description="Directory path to create")
):
    path = Path(path_str)
    path.mkdir(parents=True, exist_ok=True)
    Lg.debug(f"Created directory: {path.resolve()}")


@path_router.get("/is_file", response_model=bool)
async def is_file_path(path_str: str = Query(..., description="Path to check")):
    path = Path(path_str)
    if not path.exists():
        raise Exception("Path not found")
    else:
        return path.is_file()
