import asyncio
import re
import psutil
import json
import shlex

from fastapi import APIRouter, Query
from datetime import timedelta, datetime, timezone

from src.models import (
    ApiRunning,
    ApiWaiting,
    ApiFailed,
    ApiCompleted,
    TaskInfo,
    FileInfo,
)
from src.database import Database as db
from routes.file import FileOprations


class TaskOprations:

    _running: ApiRunning | None = None
    _pattern = re.compile(
        r"frame=\s*(?P<frame>\d+)\s*"
        r"fps=\s*(?P<fps>[\d\.]+)\s*"
        r"q=\s*(?P<q>[\d\.\-]+)\s*"
        r"size=\s*(?P<size>\S+)\s*"
        r"time=\s*(?P<time>\d{2}:\d{2}:\d{2}\.?\d*)\s*"
        r"bitrate=\s*(?P<bitrate>\S+)\s*"
        r"speed=\s*(?P<speed>[\d\.]+)x\s*"
        r"elapsed=\s*(?P<elapsed>\d+:\d{2}:\d{2}\.?\d*)"
    )
    _stop_transcoding = False

    @classmethod
    async def init(cls):
        task = None
        try:
            while True:
                try:
                    task = await cls.pre_check()
                except Exception:
                    await asyncio.sleep(3)
                else:
                    try:
                        cls._running = ApiRunning(
                            **task.model_dump(exclude={"has_retry", "error"})
                        )
                        error = await cls.transcode(task)
                        if error == "Transcoding cancelled by user.":
                            raise Exception(error)
                        await cls.call_back(task, error)
                        cls._running = None
                    except Exception as e:
                        cls._running = None
                        print(e)

        except asyncio.CancelledError:
            if cls._running and task:
                task.output.unlink(missing_ok=True)
                await db.insert_task(task)

    @staticmethod
    async def pre_check() -> ApiWaiting:
        index = 0
        while True:
            try:
                row = await db.fetchone(
                    f"SELECT * FROM waiting ORDER BY uid LIMIT 1 OFFSET ?;", index
                )
                if not row:
                    break
                task = await db.fetch_ApiWaiting(row)
                if not all(f.path.is_file() for f in task.input):
                    raise Exception
                task.output.parent.mkdir(parents=True, exist_ok=True)
                await db.execute("DELETE FROM waiting WHERE uid=?;", task.uid)
            except Exception:
                index += 1
            else:
                return task
        raise Exception("No task in waiting queue.")

    @classmethod
    def parse_ffmpeg_time(cls, s: str, default: timedelta) -> timedelta:
        assert cls._running is not None
        parts = s.split(":")
        if len(parts) == 3:
            h, m, sec = parts
        elif len(parts) == 2:
            h, m, sec = 0, parts[0], parts[1]
        else:
            return default
        return timedelta(hours=int(h), minutes=int(m), seconds=float(sec))

    @classmethod
    async def transcode(cls, task: TaskInfo) -> str:
        if (not task.settings.overwrite) and task.output.exists():
            return "Output file already exists and overwrite is disabled."

        video_filters = f"setsar=1{',' + task.args.sar_fix if task.args.sar_fix else ''}{',transpose=' + str(task.settings.rotate) if task.settings.rotate is not None else ''}"

        filter_complex = []
        if len(task.input) > 1:

            filter_complex += ["-filter_complex"]
            filter_complex += [
                f"{''.join(f"[{i}:v:0][{i}:a:0]" for i in range(len(task.input)))}"
                f"concat=n={len(task.input)}:v=1:a=1[outv][outa];"
                f"[outv]{video_filters}[v]"
            ]
            filter_complex += ["-map", "[v]", "-map", "[outa]"]

        cmd = [
            "ffmpeg",
            "-progress",
            "pipe:1",
            "-y" if task.settings.overwrite else "-n",
            *[arg for f in task.input for arg in ("-i", str(f.path.resolve()))],
            *filter_complex,
            "-c:v",
            "libsvtav1",
            "-b:v",
            str(task.args.video_br),
            "-threads",
            "0",
            "-svtav1-params",
            f"rc=1:overshoot-pct={task.settings.overshoot_pct}:undershoot-pct={task.settings.undershoot_pct}:maxsection-pct={task.settings.maxsection_pct}:keyint={task.settings.keyint}:lookahead={task.settings.lookahead}:scd={int(task.settings.scd)}",
            "-preset",
            str(task.settings.preset),
            *(
                [
                    "-vf",
                    video_filters,
                ]
                if not filter_complex
                else []
            ),
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            str(task.args.audio_br),
            str(task.output.resolve()),
        ]

        print(" ".join(shlex.quote(arg) for arg in cmd))

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        assert proc.stdout is not None
        assert cls._running is not None
        total_duration = sum(f.duration for f in cls._running.input)
        while True:
            # Check if the task is cancelled
            if cls._stop_transcoding:
                cls._stop_transcoding = False
                proc.terminate()
                await proc.wait()
                task.output.unlink(missing_ok=True)
                return "Transcoding cancelled by user."

            raw_line = await proc.stdout.readline()
            if proc.returncode is not None:
                break
            line = raw_line.decode().strip().split("=")
            if len(line) != 2:
                continue
            key, value = line
            if value == "N/A":
                if cls._running.progress > 10:
                    cls._running.progress = 100.0
            elif key == "frame":
                cls._running.frame = int(value)
            elif key == "fps":
                cls._running.fps = float(value)
            elif key == "stream_0_0_q":
                cls._running.qp = float(value)
            elif key == "bitrate":
                cls._running.bitrate = value
            elif key == "size":
                cls._running.size = (
                    f"{int(value)/1024:.2f} KB"
                    if int(value) < 1024**2
                    else f"{int(value)/1024**2:.2f} MB"
                )
            elif key == "out_time_us":
                cls._running.completed_time = timedelta(microseconds=int(value))
                cls._running.progress = (
                    (cls._running.completed_time.total_seconds() / total_duration * 100)
                    if cls._running.progress < 100
                    else 100.0
                )
                cls._running.eta = timedelta(
                    seconds=(
                        round(
                            (
                                total_duration
                                - cls._running.completed_time.total_seconds()
                            )
                            / cls._running.speed
                        )
                        if cls._running.speed > 0
                        else 0
                    )
                )

            elif key == "dup_frames":
                cls._running.dup_frames = int(value)
            elif key == "drop_frames":
                cls._running.drop_frames = int(value)
            elif key == "speed":
                cls._running.speed = float(value.replace("x", ""))

        await proc.wait()
        if proc.returncode == 0:
            return ""
        else:
            return f"ffmpeg failed: {proc.returncode} {await proc.stderr.read() if proc.stderr else 'Unknown error'}"

    @classmethod
    async def call_back(cls, task: ApiWaiting, error: str) -> None:
        assert cls._running is not None
        if error:
            # Add error info
            task.uid = None
            task.has_retry += 1
            task.error.append(error)

            if task.has_retry < task.settings.retry:
                await db.insert_task(task)
            else:
                await db.execute(
                    "INSERT INTO failed (input, output, args, settings, error) VALUES (?, ?, ?, ?, ?);",
                    json.dumps(
                        [f.model_dump(mode="json") for f in task.input],
                        ensure_ascii=False,
                    ),
                    str(task.output.resolve()),
                    task.args.model_dump_json(),
                    task.settings.model_dump_json(),
                    json.dumps(task.error, ensure_ascii=False),
                )
        else:
            await db.execute(
                "INSERT INTO completed (input, output, total_consumed, finished_time) VALUES (?, ?, ?, ?);",
                json.dumps(
                    [f.model_dump(mode="json") for f in task.input], ensure_ascii=False
                ),
                (await FileOprations.fetch_file_info(task.output)).model_dump_json(),
                str(datetime.now(timezone.utc) - cls._running.start_time).split(".")[0],
                datetime.now().isoformat(),
            )
            if task.settings.delete_source:
                for f in task.input:
                    try:
                        f.path.unlink()
                        if len(list(f.path.parent.iterdir())) == 0:
                            f.path.parent.rmdir()
                    except Exception:
                        pass

    @classmethod
    async def progress(cls) -> ApiRunning | None:
        if cls._running is None:
            return None

        cls._running.cpu_usage = psutil.cpu_percent()
        cls._running.ram_usage = psutil.virtual_memory().percent
        cls._running.consumed_time = (
            datetime.now(timezone.utc) - cls._running.start_time
        )
        return cls._running


task_router = APIRouter(prefix="/task", tags=["task"])


@task_router.get("/running", response_model=ApiRunning | None)
async def get_progress():
    return await TaskOprations.progress()


@task_router.get("/running/cancel", response_model=None)
async def stop_transcoding():
    TaskOprations._stop_transcoding = True


@task_router.post("/submit", response_model=None)
async def submit_task(
    task: TaskInfo,
    update: bool = Query(
        False, description="Whether to update an existing task if uid is provided"
    ),
):
    """
    Submit a new transcoding task or update an existing one if uid is provided.
    Only settings & output can be updated.
    """
    if update:
        await db.execute(
            "UPDATE waiting SET settings=?, output=? WHERE uid=?;",
            task.settings.model_dump_json(),
            str(task.output.resolve()),
            task.uid,
        )
    else:
        await db.insert_task(task)


@task_router.get("/waiting", response_model=list[ApiWaiting])
async def get_waiting():
    tasks = []
    rows = await db.fetch("SELECT * FROM waiting;")
    for row in rows:
        tasks.append(await db.fetch_ApiWaiting(row))
    return tasks


@task_router.get("/failed", response_model=list[ApiFailed])
async def get_failed():
    tasks = []
    rows = await db.fetch("SELECT * FROM failed;")
    for row in rows:
        tasks.append(
            ApiFailed(
                **(await db.fetch_data(row)).model_dump(),
                error=json.loads(row["error"]),
            )
        )
    tasks.reverse()
    return tasks


@task_router.get("/failed/delete", response_model=None)
async def retry_task(
    uid: int = Query(..., description="The uid of the failed task to delete")
):
    await db.execute("DELETE FROM failed WHERE uid=?;", uid)


@task_router.get("/completed", response_model=list[ApiCompleted])
async def get_completed():
    tasks = []
    rows = await db.fetch("SELECT * FROM completed;")
    for row in rows:
        tasks.append(
            ApiCompleted(
                input=[FileInfo.model_validate(f) for f in json.loads(row["input"])],
                output=FileInfo.model_validate_json(row["output"]),
                total_consumed=row["total_consumed"],
                finished_time=datetime.fromisoformat(row["finished_time"]),
            )
        )
    return sorted(tasks, key=lambda t: t.finished_time, reverse=True)


@task_router.post("/completed/clear", response_model=None)
async def clear_completed():
    await db.execute("DELETE FROM completed;")
