from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from pathlib import Path
from datetime import datetime, timedelta, timezone

VERSION = "3.0.0"


VideoSuffixs = [
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


Language = Literal[
    "en",
    "ja",
    "zh",
    "zh-CN",
    "zh-TW",
    "ko",
    "fr",
    "de",
    "es",
    "it",
    "ru",
    "pt",
    "ar",
    "th",
    "vi",
]


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
    frame_count: int
    subtitle: bool = False

    preset: int
    target_bit_rate: int
    lookahead: int
    keyint: int  # frame count
    scd: bool

    @field_validator("codec")
    def validate_codec(cls, v):
        if isinstance(v, str):
            v = CODEC_ID.get(v, -1)
        return v


class TranslatorSettings(BaseModel):
    # whisper settings
    asr_model: Optional[Path] = None
    max_length_segment: int = Field(default=38, ge=10, le=100)
    voice_temperature: float = Field(default=0.0, ge=0.0, le=1.0)
    no_speech_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    entropy_thold: float = Field(default=2.3, ge=0.0, le=8.0)
    logprob_thold: float = Field(default=-1.0, ge=-8.0, le=0.0)
    max_context: int = Field(default=-1, ge=-1, le=5120)
    suppress_nst: bool = False
    no_fallback: bool = False

    # VAD settings
    vad_model: Optional[Path] = None
    voice_speech_duration: int = Field(default=30, ge=0, le=300)
    voice_minimum_silence_duration: int = Field(default=300, ge=0, le=1000)
    voice_threshold: float = Field(default=0.63, ge=0.0, le=1.0)

    # llm settings
    llm_type: Literal["openai-api", "llama.cpp", "mlx"] = "openai-api"
    llm_key: Optional[str] = None
    max_tokens: int = Field(default=8000, ge=500, le=32000)
    max_input: int = Field(default=330, ge=30, le=8000)
    prompt: list[dict] = [
        {
            "role": "system",
            "content": "You must not return any think process between <think> and </think>.\n"
            "You are a professional and accurate translator.\n"
            "You will receive a multi-line text, and then tranlate it line-by-line.\n"
            "The multi-line text is provided for you to understand the context only.\n"
            "The only output you need to return is the translated text, without inferring or guessing the meaning of the text.\n"
            "Start output the translation with a line 'Singal: yyytttqqq.'.",
        }
    ]
    temperature: float = Field(default=0.13, ge=0.0, le=2.0)


class GeneralSettings(BaseModel):
    # General Settings
    overwrite: bool = False
    delete_source: bool = True
    retry: int = Field(default=3, ge=0, le=8)

    # Transcoder Settings
    preset: int = Field(default=6, ge=0, le=12)
    max_bitrate_mb: float = Field(default=88.8, ge=0.1, le=338)
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
    rotate: Optional[int] = Field(default=None, ge=0, le=6)
    subtitle: Optional[Language] = None
    tran: Optional[Language] = None
    tran_inmediate: bool = False


class TaskInfo(BaseModel):
    uid: Optional[int] = None
    input: list[FileInfo]
    output: Path
    args: TranscodeInfo
    settings: GeneralSettings


class LLMTaskInfo(BaseModel):
    uid: Optional[int] = None
    input: Path
    output: Path
    org_lang: Language
    tran_lang: Language


class TaskSchedule(BaseModel):
    on: bool = False
    finish_time: datetime
    max_extend: int = 8  # in minutes
    sort: Literal["default", "longest", "shortest"] = "default"
    weight: Literal["size", "duration"] = "size"


class HistoryTable(FileETAInfo):
    total_consumed: int


# Api Models
class ApiRunning(BaseModel):
    uid: int
    input: list[FileInfo] | Path
    output: Path
    args: Optional[TranscodeInfo] = None
    settings: Optional[GeneralSettings] = None
    org_lang: Optional[Language] = None
    tran_lang: Optional[Language] = None

    state: Literal["audio_prefix", "transcode", "whisper", "llm_gen"] = "audio_prefix"

    cpu_usage: float = 0.0
    ram_usage: float = 0.0

    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
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

    log: list[str] = []

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


class ApiFailed(BaseModel):
    uid: int
    input: list[FileInfo] | Path
    output: Path
    args: TranscodeInfo
    settings: Optional[GeneralSettings] = None
    error: list[str]
    time: datetime


class ApiCompleted(BaseModel):
    input: list[FileInfo]
    output: FileInfo
    total_consumed: str
    finished_time: datetime


class ApiLLMCompleted(BaseModel):
    input: Path
    output: Path
    org_lang: Language
    tran_lang: Language
    finished_time: datetime


class ApiPath(BaseModel):
    dir: list[str]
    file: list[str]


class ApiSort(BaseModel):
    uid: int
    last: Optional[int] = None
    next: Optional[int] = None
