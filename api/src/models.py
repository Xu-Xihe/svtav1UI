from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum
from pathlib import Path
from datetime import datetime, timedelta, timezone


# Enum
class CodecInfo(BaseModel):
    name: str
    scale: float


class CodecScale(float, Enum):
    av1 = 1.0
    hevc = 0.8
    h264 = 0.65
    mpeg4 = 0.5
    vp9 = 0.85
    vc1 = 0.5
    wmv3 = 0.35
    wmv1 = 0.15
    mpeg1 = 0.15
    mp4v = 0.15
    prores = 0.3


class Codec(str, Enum):
    av1 = "av1"
    hevc = "hevc"
    h264 = "h264"
    mpeg4 = "mpeg4"
    vp9 = "vp9"
    vc1 = "vc1"
    wmv3 = "wmv3"
    wmv1 = "wmv1"
    mpeg1 = "mpeg1video"
    mp4v = "mp4v"
    prores = "prores"


# Base Models
class FileInfo(BaseModel):
    path: Path
    size: int
    codec: Codec
    width: int
    height: int
    sar: str
    bit_rate: int
    frame_rate: float
    duration: int
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


class Settings(BaseModel):
    overwrite: bool = False
    delete_source: bool = True
    rotate: Optional[int] = Field(default=None, ge=0, le=6)
    retry: int = Field(default=3, ge=0, le=8)

    preset: int = Field(default=6, ge=0, le=12)
    overshoot_pct: int = Field(default=100, ge=0, le=100)
    undershoot_pct: int = Field(default=10, ge=0, le=100)
    maxsection_pct: int = Field(default=6000, ge=0, le=10000)
    keyint: str = "6s"
    lookahead: int = Field(default=120, ge=0, le=120)
    scd: bool = True


class TranscodeInfo(BaseModel):
    sar_fix: str = ""
    video_br: int
    audio_br: int


class TaskInfo(BaseModel):
    uid: Optional[int] = None
    input: list[FileInfo]
    output: Path
    args: TranscodeInfo
    settings: Settings


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
