from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from pathlib import Path
from datetime import datetime, timedelta, timezone

VERSION = "2.0.0"

FileSuffixs = [
    ".mp4",
    ".mkv",
    ".avi",
    ".mov",
    ".flv",
    ".wmv",
    ".ts",
    ".f4v",
    ".m4v",
    ".mpg",
    ".mpeg",
    ".vob",
    ".webm",
    ".m2ts",
    ".3gp",
]


Codec = {
    "av1": 1.0,
    "vp9": 0.85,
    "hevc": 0.8,
    "h265": 0.8,
    "hev1": 0.8,
    "h264": 0.65,
    "avc1": 0.65,
    "mpeg4": 0.5,
    "vc1": 0.5,
    "flv1": 0.4,
    "flv": 0.4,
    "mpeg2video": 0.35,
    "mpeg2": 0.35,
    "wmv3": 0.35,
    "prores": 0.3,
    "wmv1": 0.15,
    "mpeg1video": 0.15,
    "mp4v": 0.15,
}

CODEC_ID = {k: i for i, k in enumerate(Codec)}


# Base Models
class FileInfo(BaseModel):
    path: Path
    size: int
    codec: str
    width: int
    height: int
    sar: str
    pix_fmt: str
    color_space: str
    color_transfer: str
    color_primaries: str
    bit_rate: int
    frame_rate: float
    duration: float
    audio_bit_rate: int

    model_config = {"json_encoders": {Path: lambda p: str(p.resolve())}}

    @field_validator("audio_bit_rate")
    def validate_audio_bit_rate(cls, v):
        if not isinstance(v, int):
            return 128000
        elif v < 128000:
            return 128000
        elif v > 192000:
            return 192000
        else:
            return v


class FileETAInfo(BaseModel):
    codec: int
    pixel_count: int
    pixels_per_second: float
    frame_count: int

    preset: int
    target_bit_rate: int
    lookahead: int
    keyint: int  # frame count
    scd: bool

    E_mean: Optional[float] = None
    E_p95: Optional[float] = None
    E_diff_mean: Optional[float] = None

    h_mean: Optional[float] = None
    h_diff_mean: Optional[float] = None

    epsilon_mean: Optional[float] = None
    epsilon_diff_mean: Optional[float] = None

    @field_validator("codec")
    def validate_codec(cls, v):
        if isinstance(v, str):
            v = CODEC_ID.get(v, -1)
        return v


class Settings(BaseModel):
    vca_on: bool = True
    overwrite: bool = False
    delete_source: bool = True
    rotate: Optional[int] = Field(default=None, ge=0, le=6)
    retry: int = Field(default=3, ge=0, le=8)

    max_bitrate_mb: float = Field(default=48, ge=8)

    preset: int = Field(default=6, ge=0, le=12)
    overshoot_pct: int = Field(default=100, ge=0, le=100)
    undershoot_pct: int = Field(default=10, ge=0, le=100)
    minsection_pct: int = Field(default=80, ge=0, le=100)
    maxsection_pct: int = Field(default=6000, ge=0, le=10000)
    keyint: str = "6s"
    lookahead: int = Field(default=120, ge=0, le=120)
    scd: bool = True


class TranscodeInfo(BaseModel):
    pix_fmt: str
    zscale: str
    sar_fix: str = ""
    video_br: int
    audio_br: int


class TaskInfo(BaseModel):
    uid: Optional[int] = None
    input: list[FileInfo]
    output: Path
    args: TranscodeInfo
    settings: Settings


class TaskSchedule(BaseModel):
    on: bool = False
    finish_time: datetime
    max_extend: int = 8  # in minutes
    sort: Literal["default", "longest", "shortest"] = "default"
    weight: Literal["size", "duration"] = "size"


class HistoryTable(FileETAInfo):
    total_consumed: int


# Api Models
class ApiRunning(TaskInfo):
    cpu_usage: float = 0.0
    ram_usage: float = 0.0

    start_time: datetime = datetime.now(timezone.utc)
    consumed_time: timedelta = timedelta(seconds=0)

    frame: int = 0
    fps: float = 0.0
    qp: float = 0.0
    bitrate: str = ""
    size: str = ""
    completed_time: timedelta = timedelta(seconds=0)
    dup_frames: int = 0
    drop_frames: int = 0
    speed: float = 0.0
    progress: float = 0.0
    eta: timedelta = timedelta(seconds=0)

    class Config:
        json_encoders = {timedelta: lambda td: str(td).split(".")[0]}

    @field_validator("progress")
    def validate_progress(cls, v):
        if not isinstance(v, (int, float)):
            return 0.0
        elif v < 0:
            return 0.0
        elif v > 100:
            return 100.0
        else:
            return round(v, 2)


class ApiWaiting(TaskInfo):
    sort: float
    eta: FileETAInfo
    has_retry: int = 0
    error: list[str] = []


class ApiFailed(TaskInfo):
    error: list[str]


class ApiCompleted(BaseModel):
    input: list[FileInfo]
    output: FileInfo
    total_consumed: str
    finished_time: datetime


class ApiPathls(BaseModel):
    dir: list[str]
    file: list[str]


class ApiSort(BaseModel):
    uid: int
    last: Optional[int] = None
    next: Optional[int] = None
