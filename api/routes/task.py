import json
import os

from fastapi import APIRouter, Query, Request
from datetime import datetime

from src.models import (
    ApiRunning,
    ApiSort,
    ApiWaiting,
    ApiFailed,
    ApiCompleted,
    TaskInfo,
    LLMTaskInfo,
    FileInfo,
    ApiLLMCompleted,
    TranscodeInfo,
)
from src.database import Database as db
from src.queue import Queue
from src.llm import LLM

ENV = os.environ.copy()
ENV["SVT_LOG"] = "2"


task_router = APIRouter(prefix="/task", tags=["task"])


# Running
@task_router.get("/running", response_model=ApiRunning | None)
async def get_progress(r: Request):
    return r.app.state.queue.progress()


@task_router.get("/running/cancel", response_model=None)
async def stop_transcoding(r: Request):
    await r.app.state.queue.cancel_running()


@task_router.get("/running/pause", response_model=bool)
async def is_pause_transcoding(r: Request):
    return r.app.state.queue.is_running


@task_router.post("/running/pause", response_model=bool)
async def pause_transcoding(
    r: Request,
    set: bool = Query(description="True to resume, False to pause."),
):
    if set:
        r.app.state.queue.resume_running()
    else:
        r.app.state.queue.pause_running()

    return r.app.state.queue.is_running


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
        db.execute(
            "UPDATE waiting SET settings=?, output=? WHERE uid=?;",
            task.settings.model_dump_json(),
            str(task.output.resolve()),
            task.uid,
        )
    else:
        await Queue.insert(task, priority=priority)


@task_router.post("/submit/llm", response_model=None)
async def submit_llm_task(task: LLMTaskInfo):
    """
    Submit a new LLM task.
    """
    LLM.insert(task)


# Waiting
@task_router.get("/waiting/llm", response_model=list[LLMTaskInfo])
async def get_llm_tasks():
    tasks: list[LLMTaskInfo] = []
    rows = db.fetchall("SELECT * FROM llm_waiting;")
    for row in rows:
        tasks.append(LLMTaskInfo.model_validate(dict(row)))
    return tasks


@task_router.post("/waiting/llm/delete", response_model=None)
async def delete_llm_task(
    uid: int = Query(..., description="The uid of the waiting task to delete")
):
    db.execute("DELETE FROM llm_waiting WHERE uid=?;", uid)


@task_router.get("/waiting", response_model=list[ApiWaiting])
async def get_waiting():
    tasks: list[ApiWaiting] = []
    rows = db.fetchall("SELECT * FROM waiting;")
    for row in rows:
        tasks.append(db.fetch_ApiWaiting(row))
    return sorted(tasks, key=lambda t: t.sort)


@task_router.post("/waiting/sort", response_model=None)
async def sort_waiting(data: ApiSort):
    if data.last:
        last = (db.fetchone("SELECT sort FROM waiting WHERE uid=?;", data.last))[0]
    else:
        last = 0
    if data.next:
        next = (db.fetchone("SELECT sort FROM waiting WHERE uid=?;", data.next))[0]
    else:
        next = ((db.fetchone("SELECT MAX(sort) FROM waiting;"))[0] or 0) + 2000

    db.execute(
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
    db.execute("DELETE FROM waiting WHERE uid=?;", uid)


# Failed
@task_router.get("/failed", response_model=list[ApiFailed])
async def get_failed():
    tasks: list[ApiFailed] = []
    rows = db.fetchall("SELECT * FROM failed;")
    for row in rows:
        if row["settings"]:
            tasks.append(
                ApiFailed(
                    **(db.fetch_data(row)).model_dump(),
                    error=json.loads(row["error"]),
                )
            )
        else:
            data = dict(row)
            data["error"] = json.loads(row["error"])
            data["args"] = TranscodeInfo.model_validate_json(row["args"])
            tasks.append(ApiFailed.model_validate(data))

    tasks.reverse()
    return tasks


@task_router.post("/failed/delete", response_model=None)
async def retry_task(
    uid: int = Query(..., description="The uid of the failed task to delete")
):
    db.execute("DELETE FROM failed WHERE uid=?;", uid)


@task_router.post("/failed/clear", response_model=None)
async def clear_failed():
    db.execute("DELETE FROM failed;")


# Completed
@task_router.get("/completed", response_model=list[ApiCompleted])
async def get_completed():
    tasks: list[ApiCompleted] = []
    rows = db.fetchall("SELECT * FROM completed;")
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
    db.execute("DELETE FROM completed;")


@task_router.get("/completed/llm", response_model=list[ApiLLMCompleted])
async def get_llm_completed():
    tasks: list[ApiLLMCompleted] = []
    rows = db.fetchall("SELECT * FROM llm_completed;")
    for row in rows:
        tasks.append(ApiLLMCompleted.model_validate(dict(row)))
    return sorted(tasks, key=lambda t: t.finished_time, reverse=True)


@task_router.post("/completed/llm/clear", response_model=None)
async def clear_llm_completed():
    db.execute("DELETE FROM llm_completed;")


# Transcode cron Status
@task_router.post("/status", response_model=None)
async def pause_next_transcoding(
    r: Request,
    set: bool = Query(..., description="True to pause, False to resume the loop."),
):
    if set:
        r.app.state.queue.resume()
    else:
        r.app.state.queue.pause()


@task_router.get("/status", response_model=bool)
async def get_status(r: Request):
    return r.app.state.queue.suspend_loop.is_set()
