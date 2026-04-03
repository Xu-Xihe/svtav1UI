import asyncio
import json

from fastapi import APIRouter, HTTPException, Query
from pathlib import Path

from src.models import FileInfo, TranscodeInfo, Codec, CodecScale


class FileOprations:

    @staticmethod
    def check_sar(sar: str) -> str:
        if not sar in ["N/A", "1:1"]:
            try:
                sar_w, sar_h = map(float, sar.split(":"))
                return f"scale=trunc(iw*{sar_w/sar_h}/2)*2:trunc(ih/2)*2"
            except Exception:
                return ""
        return ""

    @staticmethod
    async def fetch_file_info(path: Path) -> FileInfo:
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height,avg_frame_rate,sample_aspect_ratio,bit_rate,duration",
            "-of",
            "json",
            str(path.resolve()),
        ]

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {stderr.decode()}")

        data = json.loads(stdout)["streams"]
        video: dict = data[0] if data[0]["codec_type"] == "video" else data[1]
        audio: dict = data[1] if data[1]["codec_type"] == "audio" else data[0]

        if (
            not video.get("codec_name")
            or not video.get("avg_frame_rate")
            or not video.get("duration")
        ):
            raise ValueError("Missing required video information.")

        if video["codec_name"] not in Codec.__members__:
            raise ValueError(f"Unsupported codec: {video['codec_name']}")

        return FileInfo(
            path=path,
            size=path.stat().st_size,
            codec=Codec[video["codec_name"]],
            width=int(video.get("width", 0)),
            height=int(video.get("height", 0)),
            sar=video.get("sample_aspect_ratio", "N/A"),
            frame_rate=(
                lambda x: (
                    round(float(x[0]) / float(x[1]), 1) if float(x[1]) != 0 else 0.0
                )
            )(video["avg_frame_rate"].split("/")),
            bit_rate=(
                int(video["bit_rate"])
                if video.get("bit_rate") and video["bit_rate"].isdigit()
                else 0
            ),
            duration=round(float(video["duration"])),
            audio_bit_rate=(
                int(audio["bit_rate"])
                if audio.get("bit_rate") and audio["bit_rate"].isdigit()
                else 128000
            ),
        )

    @staticmethod
    async def fetch_transcode_info(org: FileInfo) -> TranscodeInfo:
        avg_br = round(org.size * 8 / org.duration - org.audio_bit_rate)
        v_br = org.bit_rate if abs(org.bit_rate - avg_br) / avg_br <= 0.13 else avg_br

        return TranscodeInfo(
            video_br=round(v_br * CodecScale[org.codec.value].value),
            audio_br=org.audio_bit_rate,
            sar_fix=FileOprations.check_sar(org.sar),
        )

    @staticmethod
    async def fetch_multinput(
        infos: list[FileInfo],
    ) -> TranscodeInfo:

        if not all(
            (f.width, f.height, f.frame_rate, f.sar, f.codec)
            == (
                infos[0].width,
                infos[0].height,
                infos[0].frame_rate,
                infos[0].sar,
                infos[0].codec,
            )
            for f in infos
        ):
            raise Exception(
                "Input files must have the same resolution, frame rate and SAR."
            )

        avg_br = round(sum((f.size * 8 / f.duration - f.audio_bit_rate) for f in infos))
        max_br = max(f.bit_rate for f in infos)
        v_br = max_br if abs(max_br - avg_br) / avg_br <= 0.15 else avg_br

        return TranscodeInfo(
            video_br=round(v_br * CodecScale[infos[0].codec.value].value),
            audio_br=max(f.audio_bit_rate for f in infos),
            sar_fix=FileOprations.check_sar(infos[0].sar),
        )


file_router = APIRouter(prefix="/file", tags=["file"])


@file_router.get("/info", response_model=FileInfo)
async def get_file_info(
    file_path: str = Query(..., description="The path to the file")
):
    """
    Get information about a file, including its name, size, and last modified time.
    """
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    return await FileOprations.fetch_file_info(path)


@file_router.post("/single", response_model=TranscodeInfo)
async def get_transcode_info(
    file: FileInfo,
):
    """
    Get transcoding information about a file, including the recommended video and audio bit rates.
    """
    return await FileOprations.fetch_transcode_info(file)


@file_router.post("/multi", response_model=TranscodeInfo)
async def get_multinput_info(files: list[FileInfo]):
    """
    Get transcoding information about multiple files.
    """
    return await FileOprations.fetch_multinput(files)


@file_router.get("/test", response_model=dict)
async def test_endpoint(
    file_path: str = Query(..., description="The path to the file")
):
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    org = await FileOprations.fetch_file_info(path)
    return {
        "file_info": org,
        "transcode_info": await FileOprations.fetch_transcode_info(org),
    }
