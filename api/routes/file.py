import asyncio
import json
import shlex

from typing import Literal
from fastapi import APIRouter, HTTPException, Query
from pathlib import Path

from src.models import FileInfo, TranscodeInfo, Codec
from src.logger import Lg


class FileOprations:

    pix_fmt_map = {
        420: {
            8: "yuv420p",
            10: "yuv420p10le",
            12: "yuv420p12le",
            14: "yuv420p14le",
            16: "yuv420p16le",
        },
        422: {
            8: "yuv422p",
            10: "yuv422p10le",
            12: "yuv422p12le",
            14: "yuv422p14le",
            16: "yuv422p16le",
        },
        444: {
            8: "yuv444p",
            10: "yuv444p10le",
            12: "yuv444p12le",
            14: "yuv444p14le",
            16: "yuv444p16le",
        },
    }

    @staticmethod
    def _check_sar(sar: str) -> str:
        if not sar in ["N/A", "1:1"]:
            sar_w, sar_h = map(float, sar.split(":"))
            return f"scale=trunc(iw*{sar_w/sar_h}/2)*2:trunc(ih/2)*2"
        return ""

    @classmethod
    def _check_zscale(cls, cs: str, ct: str, cp: str, pf: str) -> str:
        cmd = "zscale="
        hdr = cls._check_hdr(ct)

        if (
            not any(x in pf for x in ["rgb", "gbr", "bgr"])
            and any(x in cs for x in ["rgb", "gbr", "bgr"])
        ) or cs == "":
            cmd += f"matrixin={'bt2020nc' if hdr else 'bt709'}:"
        else:
            cmd += f"matrixin={cs}:"

        if ct == "":
            cmd += f"transferin={'smpte2084' if hdr else 'bt709'}:"
        else:
            cmd += f"transferin={ct}:"

        if cp == "":
            cmd += f"primariesin={'bt2020' if hdr else 'bt709'}:"
        else:
            cmd += f"primariesin={cp}:"

        if hdr:
            cmd += (
                "matrix=bt2020nc:transfer=smpte2084:primaries=bt2020:range=tv:npl=1000"
            )

        else:
            cmd += "matrix=bt709:transfer=bt709:primaries=bt709:range=tv"

        return cmd

    @staticmethod
    def _check_fmt_bit(pix_fmt: str) -> Literal[8, 10, 12, 14, 16]:
        fmt = pix_fmt.lower()

        # Direct explicit match (fast path)
        if "16le" in fmt or "16be" in fmt:
            return 16
        if "12le" in fmt or "12be" in fmt:
            return 12
        if "10le" in fmt or "10be" in fmt:
            return 10

        # Common explicit patterns
        if "p16" in fmt:
            return 16
        if "p12" in fmt:
            return 12
        if "p10" in fmt:
            return 10
        if "p8" in fmt:
            return 8

        # Packed hardware formats
        hw_map = {
            "nv12": 8,
            "yuyv422": 8,
            "uyvy422": 8,
            "yuvj420p": 8,
            "yuvj422p": 8,
            "yuvj444p": 8,
            "bgr0": 8,
            "rgb0": 8,
            "p010le": 10,
            "p016le": 16,
            "p012le": 12,
            "p210le": 10,
            "p216le": 16,
        }
        if fmt in hw_map:
            return hw_map[fmt]  # type: ignore

        # Common suffix patterns
        if any(x in fmt for x in ["yuv", "rgb", "bgr", "pal"]):
            return 8

        return 8

    @staticmethod
    def _check_fmt_chroma(pix_fmt: str) -> Literal[420, 422, 444]:
        fmt = pix_fmt.lower()

        # Direct explicit match (fast path)
        if "420" in fmt:
            return 420
        if "422" in fmt:
            return 422
        if "444" in fmt:
            return 444

        # Common explicit patterns
        if fmt in ["nv12", "nv21", "p010le", "p016le", "p012le"]:
            return 420
        if fmt in ["p210le", "p216le"]:
            return 422
        if any(x in fmt for x in ["gbr", "rgb", "bgr"]):
            return 444

        return 420

    @staticmethod
    def _check_hdr(color_transfer: str) -> bool:
        ct = color_transfer.lower()

        hdr_transfer = {
            "smpte2084",  # PQ (HDR10 / HDR10+)
            "arib-std-b67",  # HLG
            "smpte428",  # Cineon (罕见 HDR/DI)
        }
        if ct in hdr_transfer:
            return True

        if "pq" in ct or "hlg" in ct:
            return True

        return False

    @classmethod
    async def fetch_file_info(cls, path: Path) -> FileInfo:
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height,avg_frame_rate,sample_aspect_ratio,bit_rate,duration,pix_fmt,color_space,color_transfer,color_primaries",
            "-of",
            "json",
            str(path.resolve()),
        ]

        Lg.debug(
            f"Fetch file info with command: {' '.join(shlex.quote(arg) for arg in cmd)}"
        )

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"ffprobe failed: {stderr.decode()}")

        data = json.loads(stdout)["streams"]
        video = next((s for s in data if s.get("codec_type") == "video"), {})
        audio = next((s for s in data if s.get("codec_type") == "audio"), {})

        if (
            not video.get("codec_name")
            or not video.get("avg_frame_rate")
            or not video.get("duration")
        ):
            raise ValueError("Missing required video information.")

        if Codec.get(video["codec_name"]) is None:
            raise ValueError(f"Unsupported codec: {video['codec_name']}")

        return FileInfo(
            path=path,
            size=path.stat().st_size,
            codec=video["codec_name"],
            width=int(video.get("width", 0)),
            height=int(video.get("height", 0)),
            sar=video.get("sample_aspect_ratio", "N/A"),
            pix_fmt=video.get("pix_fmt", "yuv420p"),
            color_space=video.get("color_space", ""),
            color_transfer=video.get("color_transfer", ""),
            color_primaries=video.get("color_primaries", ""),
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
            duration=float(video["duration"]),
            audio_bit_rate=(
                int(audio["bit_rate"])
                if audio.get("bit_rate") and audio["bit_rate"].isdigit()
                else 128000
            ),
        )

    @classmethod
    async def fetch_transcode_info(cls, org: FileInfo) -> TranscodeInfo:
        avg_br = round(org.size * 8 / org.duration - org.audio_bit_rate)
        v_br = org.bit_rate if abs(org.bit_rate - avg_br) / avg_br <= 0.13 else avg_br

        rtn = TranscodeInfo(
            zscale=cls._check_zscale(
                org.color_space,
                org.color_transfer,
                org.color_primaries,
                org.pix_fmt,
            ),
            pix_fmt=cls.pix_fmt_map[cls._check_fmt_chroma(org.pix_fmt)][
                cls._check_fmt_bit(org.pix_fmt)
            ],
            video_br=round(v_br * Codec[org.codec]),
            audio_br=org.audio_bit_rate,
            sar_fix=cls._check_sar(org.sar),
        )
        Lg.debug(f"Fetch transcode info {org.path}: {rtn}")
        return rtn

    @classmethod
    async def fetch_multinput(
        cls,
        infos: list[FileInfo],
    ) -> TranscodeInfo:

        c_s = {f.color_space for f in infos if f.color_space is not None}
        c_t = {f.color_transfer for f in infos if f.color_transfer is not None}
        c_p = {f.color_primaries for f in infos if f.color_primaries is not None}

        if (
            not all(
                (
                    f.width,
                    f.height,
                    f.frame_rate,
                    f.sar,
                    f.codec,
                    f.pix_fmt,
                )
                == (
                    infos[0].width,
                    infos[0].height,
                    infos[0].frame_rate,
                    infos[0].sar,
                    infos[0].codec,
                    infos[0].pix_fmt,
                )
                for f in infos
            )
            or len(c_s) > 1
            or len(c_t) > 1
            or len(c_p) > 1
        ):
            raise Exception(
                "Input files must have the same resolution, frame rate and SAR."
            )

        avg_br = round(
            sum((f.size * 8 / f.duration - f.audio_bit_rate) for f in infos)
            / len(infos)
        )
        max_br = max(f.bit_rate for f in infos)
        v_br = max_br if abs(max_br - avg_br) / avg_br <= 0.15 else avg_br

        rtn = TranscodeInfo(
            zscale=cls._check_zscale(
                c_s.pop() if c_s else "",
                c_t.pop() if c_t else "",
                c_p.pop() if c_p else "",
                infos[0].pix_fmt,
            ),
            pix_fmt=cls.pix_fmt_map[cls._check_fmt_chroma(infos[0].pix_fmt)][
                cls._check_fmt_bit(infos[0].pix_fmt)
            ],
            video_br=round(v_br * Codec[infos[0].codec]),
            audio_br=max(f.audio_bit_rate for f in infos),
            sar_fix=cls._check_sar(infos[0].sar),
        )
        Lg.debug(f"Fetch multinput transcode info: {rtn}")
        return rtn


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
        raise HTTPException(400, "Invalid path")
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
    """
    Test the endpoint by fetching file information and transcoding information for a given file path.
    """
    path = Path(file_path)
    if not path.exists():
        raise HTTPException(400, "Invalid path")
    if not path.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    org = await FileOprations.fetch_file_info(path)
    return {
        "file_info": org,
        "transcode_info": await FileOprations.fetch_transcode_info(org),
    }
