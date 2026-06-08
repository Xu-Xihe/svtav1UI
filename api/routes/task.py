import asyncio
import re
import psutil
import json
import shlex
import os

from fastapi import APIRouter, Query
from typing import Optional
from datetime import timedelta, datetime, timezone

from src.models import (
    ApiRunning,
    ApiSort,
    ApiWaiting,
    ApiFailed,
    ApiCompleted,
    TaskInfo,
    FileInfo,
    HistoryTable,
)
from src.database import Database as db
from src.logger import Lg
from src.eta import ETA
from routes.file import FileOprations
from routes.plan import PlanUtils

ENV = os.environ.copy()
ENV["SVT_LOG"] = "2"


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
    _pause = asyncio.Event()
    _pause_changed = False

    @classmethod
    async def init(cls):
        task = None
        PlanUtils._pause.set()
        cls._pause.set()
        cls._pause_changed = False
        try:
            while True:
                try:
                    task = await PlanUtils.get_next()
                except Exception:
                    await asyncio.sleep(3)
                else:
                    try:
                        cls._running = ApiRunning(
                            **task.model_dump(
                                exclude={"has_retry", "error", "sort", "eta"}
                            ),
                            start_time=datetime.now(timezone.utc),
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

                row = await db.fetchone("SELECT MIN(uid) FROM waiting;")
                min_uid = row[0] if row else None

                task.uid = min_uid - 1 if min_uid is not None else 1
                await cls.insert_task(task)

    @classmethod
    async def insert_task(
        cls,
        task: ApiWaiting | TaskInfo,
        priority: bool = False,
    ) -> None:
        if not all(f.path.is_file() for f in task.input):
            raise Exception("Input file not found.")

        if isinstance(task, ApiWaiting):
            detail = task

        else:
            detail = ApiWaiting(
                **task.model_dump(),
                sort=0,
                has_retry=0,
                eta=await ETA.get_eta_info(file_info=task, quick=True),
                error=[],
            )

            if priority:
                detail.sort = (
                    (await db.fetchone("SELECT MIN(sort) FROM waiting;"))[0] or 0
                ) - 1000
            else:
                detail.sort = (
                    (await db.fetchone("SELECT MAX(sort) FROM waiting;"))[0] or 0
                ) + 1000

        uid = (
            await db.fetchone(
                f"""
                INSERT INTO waiting
                ({'uid, ' if isinstance(task, ApiWaiting) else ''}sort, eta, input, output, args, settings, has_retry, error)
                VALUES ({str(task.uid) + ', ' if isinstance(task, ApiWaiting) else ''}?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING uid;
            """,
                detail.sort,
                detail.eta.model_dump_json(),
                json.dumps(
                    [f.model_dump(mode="json") for f in detail.input],
                    ensure_ascii=False,
                ),
                str(detail.output.resolve()),
                detail.args.model_dump_json(),
                detail.settings.model_dump_json(),
                detail.has_retry,
                json.dumps(detail.error, ensure_ascii=False),
            )
        )[0]

        if not isinstance(task, ApiWaiting):
            asyncio.create_task(ETA.eta_update(uid, detail))

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

        video_filters = []
        if task.args.sar_fix:
            video_filters.append(task.args.sar_fix)
        elif task.input[0].width % 2 != 0 or task.input[0].height % 2 != 0:
            video_filters.append("pad=ceil(iw/2)*2:ceil(ih/2)*2")
        if task.settings.rotate is not None:
            if task.settings.rotate in range(0, 4):
                video_filters.append(f"transpose={task.settings.rotate}")
            elif task.settings.rotate == 4:
                video_filters.append("hflip")
            elif task.settings.rotate == 5:
                video_filters.append("hflip,transpose=2,transpose=2")
            elif task.settings.rotate == 6:
                video_filters.append("transpose=2,transpose=2")
        video_filters.append("setsar=1")
        video_filters.append(task.args.zscale)
        video_filters.append(f"format={task.args.pix_fmt}")

        filter_complex = []
        if len(task.input) > 1:

            filter_complex += ["-filter_complex"]
            filter_complex += [
                f"{''.join(f"[{i}:v:0][{i}:a:0]" for i in range(len(task.input)))}"
                f"concat=n={len(task.input)}:v=1:a=1[outv][outa];"
                f"[outv]{','.join(video_filters)}[v]"
            ]
            filter_complex += ["-map", "[v]", "-map", "[outa]"]

        cmd = [
            "ffmpeg",
            "-v",
            "quiet",
            "-progress",
            "pipe:1",
            "-y" if task.settings.overwrite else "-n",
            *[arg for f in task.input for arg in ("-i", str(f.path.resolve()))],
            *filter_complex,
            "-c:v",
            "libsvtav1",
            "-b:v",
            str(min(task.args.video_br, task.settings.max_bitrate_mb * 1000 * 1000)),
            "-threads",
            "0",
            "-svtav1-params",
            f"rc=1:overshoot-pct={task.settings.overshoot_pct}:undershoot-pct={task.settings.undershoot_pct}:minsection-pct={task.settings.minsection_pct}:maxsection-pct={task.settings.maxsection_pct}:keyint={task.settings.keyint}:lookahead={task.settings.lookahead}:scd={int(task.settings.scd)}",
            "-preset",
            str(task.settings.preset),
            *(
                [
                    "-vf",
                    ",".join(video_filters),
                ]
                if not filter_complex
                else []
            ),
            "-movflags",
            "+faststart",
            "-pix_fmt",
            task.args.pix_fmt,
            "-c:a",
            "aac",
            "-b:a",
            str(task.args.audio_br),
            str(task.output.resolve()),
        ]

        Lg.info(
            f"Starting transcoding: {', '.join(str(t.path.resolve()) for t in task.input)} -> {task.output}"
        )
        Lg.debug(f"Running command: {" ".join(shlex.quote(arg) for arg in cmd)}\n\n")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=ENV,
        )

        assert proc.stdout is not None
        assert cls._running is not None
        total_duration = sum(f.duration for f in cls._running.input)
        while True:
            # Check if the process has finished or crashed
            if proc.returncode is not None:
                break

            # Check if the task is cancelled
            if cls._stop_transcoding:
                cls._stop_transcoding = False
                proc.kill()
                await proc.wait()
                task.output.unlink(missing_ok=True)
                return "Transcoding cancelled by user."

            # Check if the task is paused or resumed
            if cls._pause_changed:
                cls._pause_changed = False
                if cls._pause.is_set():
                    psutil.Process(proc.pid).resume()
                else:
                    psutil.Process(proc.pid).suspend()
            await cls._pause.wait()

            # Read progress info
            try:
                raw_line = await asyncio.wait_for(proc.stdout.readline(), timeout=0.3)
            except asyncio.TimeoutError:
                continue

            # Process progress info
            line = raw_line.decode().strip().split("=")
            if len(line) != 2:
                continue
            key, value = line
            if value == "N/A":
                if cls._running.progress > 10:
                    cls._running.progress = 100.0
                    cls._running.eta = timedelta(seconds=0)
                    break
            elif key == "frame":
                cls._running.frame = int(value)
            elif key == "fps":
                cls._running.fps = float(value)
            elif key == "stream_0_0_q":
                cls._running.qp = float(value)
            elif key == "bitrate":
                cls._running.bitrate = value
            elif key == "total_size":
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
            task.output.unlink(missing_ok=True)
            Lg.error(
                f"ffmpeg failed: {proc.returncode} {await proc.stderr.read() if proc.stderr else 'Unknown error'}\n\n"
            )
            return f"ffmpeg failed: {proc.returncode} {await proc.stderr.read() if proc.stderr else 'Unknown error'}"

    @classmethod
    async def call_back(cls, task: ApiWaiting, error: str) -> None:
        assert cls._running is not None
        if error:
            # Add error info
            task.has_retry += 1
            task.error.append(error)

            if task.has_retry <= task.settings.retry:
                await cls.insert_task(task)
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
                """
                    INSERT INTO completed 
                    (input, output, total_consumed, finished_time) 
                    VALUES (?, ?, ?, ?);
                """,
                json.dumps(
                    [f.model_dump(mode="json") for f in task.input], ensure_ascii=False
                ),
                (await FileOprations.fetch_file_info(task.output)).model_dump_json(),
                str(datetime.now(timezone.utc) - cls._running.start_time).split(".")[0],
                datetime.now().isoformat(),
            )

            sta_data = HistoryTable(
                total_consumed=int(
                    (
                        datetime.now(timezone.utc) - cls._running.start_time
                    ).total_seconds()
                ),
                **task.eta.model_dump(),
            ).model_dump(exclude={"uid"})
            await db.execute(
                f"""
                    INSERT INTO history
                    ({", ".join(sta_data.keys())})
                    VALUES ({", ".join("?" * len(sta_data))});
                """,
                *sta_data.values(),
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

        cpu = psutil.cpu_percent()
        if cpu > 0:
            cls._running.cpu_usage = cpu
        cls._running.ram_usage = psutil.virtual_memory().percent
        cls._running.consumed_time = (
            datetime.now(timezone.utc) - cls._running.start_time
        )
        return cls._running


task_router = APIRouter(prefix="/task", tags=["task"])


# Running
@task_router.get("/running", response_model=ApiRunning | None)
async def get_progress():
    return await TaskOprations.progress()


@task_router.get("/running/cancel", response_model=None)
async def stop_transcoding():
    TaskOprations._stop_transcoding = True

@task_router.get("/running/pause", response_model=bool)
async def is_pause_transcoding():
    return TaskOprations._pause.is_set()

@task_router.post("/running/pause", response_model=bool)
async def pause_transcoding(
    set: bool = Query(description="Whether to pause or resume transcoding, if not provided, it will toggle the current state")
):
    TaskOprations._pause_changed = True
    if set:
        TaskOprations._pause.set()
    else:
        TaskOprations._pause.clear()
    return TaskOprations._pause.is_set()


# Waiting
@task_router.post("/submit", response_model=None)
async def submit_task(
    task: TaskInfo,
    update: bool = Query(
        False, description="Whether to update an existing task if uid is provided"
    ),
    priority: bool = Query(
        False, description="Whether to add the task to the top of the waiting queue"
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
        await TaskOprations.insert_task(task, priority=priority)


@task_router.get("/waiting", response_model=list[ApiWaiting])
async def get_waiting():
    tasks: list[ApiWaiting] = []
    rows = await db.fetch("SELECT * FROM waiting;")
    for row in rows:
        tasks.append(await db.fetch_ApiWaiting(row))
    return sorted(tasks, key=lambda t: t.sort)


@task_router.post("/waiting/sort", response_model=None)
async def sort_waiting(data: ApiSort):
    if data.last:
        last = (await db.fetchone("SELECT sort FROM waiting WHERE uid=?;", data.last))[
            0
        ]
    else:
        last = 0
    if data.next:
        next = (await db.fetchone("SELECT sort FROM waiting WHERE uid=?;", data.next))[
            0
        ]
    else:
        next = ((await db.fetchone("SELECT MAX(sort) FROM waiting;"))[0] or 0) + 2000

    await db.execute(
        """
        UPDATE waiting
        SET sort = ?
        WHERE uid = ?;
        """,
        (last + next) / 2,
        data.uid,
    )


@task_router.get("/waiting/delete", response_model=None)
async def delete_waiting(
    uid: int = Query(..., description="The uid of the waiting task to delete")
):
    await db.execute("DELETE FROM waiting WHERE uid=?;", uid)


# Failed
@task_router.get("/failed", response_model=list[ApiFailed])
async def get_failed():
    tasks: list[ApiFailed] = []
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


@task_router.post("/failed/delete", response_model=None)
async def retry_task(
    uid: int = Query(..., description="The uid of the failed task to delete")
):
    await db.execute("DELETE FROM failed WHERE uid=?;", uid)


@task_router.post("/failed/clear", response_model=None)
async def clear_failed():
    await db.execute("DELETE FROM failed;")


# Completed
@task_router.get("/completed", response_model=list[ApiCompleted])
async def get_completed():
    tasks: list[ApiCompleted] = []
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

# Transcode cron Status
@task_router.post("/status", response_model=None)
async def pause_next_transcoding(
    set: bool = Query(..., description="Whether to pause or resume transcoding")
):
    if set:
        PlanUtils._pause.set()
    else:
        PlanUtils._pause.clear()


@task_router.get("/status", response_model=bool)
async def get_status():
    return PlanUtils._pause.is_set()
