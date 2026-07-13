from fastapi import APIRouter
from datetime import datetime, timezone
from bitarray import bitarray

from src.database import Database as db
from src.models import FileETAInfo, TaskInfo, TaskSchedule, ApiWaiting
from src.eta import ETA
from src.logger import Lg

plan_router = APIRouter(prefix="/plan", tags=["plan"])


class PlanTask(ApiWaiting):
    value: int  # in seconds


class PlanUtils:
    _sta = TaskSchedule(finish_time=datetime.now(timezone.utc))

    @classmethod
    async def get_next(cls) -> ApiWaiting | None | bool:
        if cls._sta.on:

            if ETA.model is None:
                await ETA.train_model()

            tasks: list[PlanTask] = []
            rows = db.fetchall("SELECT * FROM waiting;")
            if not rows:
                raise Exception("No task in waiting queue.")
            for row in rows:
                task = db.fetch_ApiWaiting(row)
                if all(f.path.is_file() for f in task.input):
                    if cls._sta.weight == "size":
                        tasks.append(
                            PlanTask(
                                **task.model_dump(),
                                value=sum(t.size for t in task.input),
                            )
                        )
                    else:
                        eta = await ETA.get_eta(task.eta)
                        if eta > 0:
                            tasks.append(PlanTask(**task.model_dump(), value=eta))
            if not tasks:
                raise Exception("No task in waiting queue.")

            duration = int(
                (datetime.now(timezone.utc) - cls._sta.finish_time).total_seconds()
            )
            if duration < 0:
                raise Exception("Invalid plan status.")
            if duration > 8e4:
                return await cls._fetch_first()

            dp = [0] * (duration + 1)
            choice = [bitarray(duration + 1) for _ in range(len(tasks))]
            for row in choice:
                row.setall(0)

            for i in range(len(tasks)):
                for j in range(duration, -1, -1):
                    if j >= tasks[i].value:
                        if dp[j - tasks[i].value] + tasks[i].value > dp[j]:
                            dp[j] = dp[j - tasks[i].value] + tasks[i].value
                            choice[i][j] = 1

            chosen: list[PlanTask] = []
            j = duration
            for i in range(len(tasks) - 1, -1, -1):
                if j >= tasks[i].value and choice[i][j]:
                    chosen.append(tasks[i])
                    j -= tasks[i].value

            if not chosen:
                duration += cls._sta.max_extend * 60
                rtn = None
                for t in tasks:
                    if t.value <= duration:
                        if rtn is None or t.value < rtn.value:
                            rtn = t
                if rtn:
                    return rtn
                else:
                    cls._sta.on = False
                    raise Exception("No task can be scheduled within the time.")
            else:
                if cls._sta.sort == "longest":
                    return max(chosen, key=lambda x: x.value)
                elif cls._sta.sort == "shortest":
                    return min(chosen, key=lambda x: x.value)
                else:
                    return min(chosen, key=lambda x: x.sort)

        else:
            return await cls._fetch_first()

    @staticmethod
    async def _fetch_first() -> ApiWaiting | None:
        index = 0
        while True:
            row = db.fetchone(
                f"""
                        SELECT * FROM waiting 
                        ORDER BY sort
                        LIMIT 1 OFFSET ?;
                    """,
                index,
            )

            if not row:
                return None

            task = db.fetch_ApiWaiting(row)

            if (not all(f.path.is_file() for f in task.input)) or (
                not task.output.parent.is_dir()
            ):
                index += 1
                continue

            db.execute("DELETE FROM waiting WHERE uid=?;", task.uid)
            Lg.debug(f"Task fetched from waiting queue: {task.model_dump()}.")
            return task


@plan_router.post("/eta")
async def get_eta(data: TaskInfo | FileETAInfo) -> int:
    if isinstance(data, TaskInfo):
        eta_info = await ETA.get_eta_info(file_info=data)
    else:
        eta_info = data
    return await ETA.get_eta(eta_info)


@plan_router.get("/status")
async def get_status() -> TaskSchedule:
    return PlanUtils._sta


@plan_router.post("/status")
async def update_status(data: TaskSchedule) -> None:
    PlanUtils._sta = data
    Lg.info(f"Plan status updated: {data.model_dump_json()}")
