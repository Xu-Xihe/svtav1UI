import asyncio
import psutil
import json

from datetime import datetime, timezone, timedelta

from src.models import ApiWaiting, TaskInfo, LLMTaskInfo, TranscodeInfo
from src.database import Database as db
from src.logger import Lg
from src.eta import ETA
from src.audio import Audio
from src.transcode import Transcode
from src.whisper import Whisper
from src.llm import LLM
from routes.settings import SettingsManager
from routes.file import FileOprations
from routes.plan import PlanUtils


class Queue:
    def __init__(self):
        self.queue = asyncio.create_task(self._loop())
        self.running: (
            Audio | Transcode | Whisper | tuple[Transcode, Whisper] | LLM | None
        ) = None
        self.is_running = True
        self.llm: asyncio.Task | None = None
        self.suspend_timer = datetime.now(timezone.utc)
        self.suspend_total = timedelta(0)
        self.suspend_loop = asyncio.Event()
        self.suspend_loop.set()

    def progress(self):
        if isinstance(self.running, tuple):
            data = self.running[0].progress
        elif self.running is not None:
            data = self.running.progress
        else:
            return None

        if self.is_running:
            data.consumed_time = (
                datetime.now(timezone.utc) - data.start_time + self.suspend_total
            )
        else:
            data.consumed_time = (
                self.suspend_timer - data.start_time + self.suspend_total
            )

        cpu = psutil.cpu_percent()
        if cpu > 0:
            data.cpu_usage = cpu
        data.ram_usage = psutil.virtual_memory().percent

        rtn = data.model_copy(deep=True)
        data.log.clear()
        return rtn

    def pause(self):
        self.suspend_loop.clear()

    def resume(self):
        self.suspend_loop.set()

    async def cancel(self, sig: str):
        self.queue.cancel(sig)
        try:
            await self.queue
        except asyncio.CancelledError:
            pass

    def pause_running(self):
        self.suspend_timer = datetime.now(timezone.utc)
        self.is_running = False
        if self.running is not None:
            if isinstance(self.running, tuple):
                self.running[0].pause()
                self.running[1].pause()
            elif isinstance(self.running, LLM):
                raise RuntimeError("LLM is not pausable. Cannot pause LLM task.")
            else:
                self.running.pause()

    def resume_running(self):
        self.suspend_total += datetime.now(timezone.utc) - self.suspend_timer
        self.is_running = True
        if self.running is not None:
            if isinstance(self.running, tuple):
                self.running[0].resume()
                self.running[1].resume()
            elif isinstance(self.running, LLM):
                raise RuntimeError("LLM is not resumable. Cannot resume LLM task.")
            else:
                self.running.resume()

    async def cancel_running(self):
        if self.running is not None:
            try:
                if isinstance(self.running, tuple):
                    await self.running[0].cancel("task")
                    await self.running[1].cancel("task")
                elif isinstance(self.running, LLM):
                    raise RuntimeError("LLM is not cancelable. Cannot cancel LLM task.")
                else:
                    await self.running.cancel("task")
            except asyncio.CancelledError:
                pass

    @staticmethod
    async def insert(task: ApiWaiting | TaskInfo, priority: bool = False) -> int:
        if not all(f.path.is_file() for f in task.input):
            raise FileNotFoundError("One or more input files are missing.")

        if isinstance(task, ApiWaiting):
            data = task
        else:
            data = ApiWaiting(
                **task.model_dump(),
                sort=(
                    (((db.fetchone("SELECT MIN(sort) FROM waiting;"))[0] or 0) - 1000)
                    if priority
                    else (
                        ((db.fetchone("SELECT MAX(sort) FROM waiting;"))[0] or 0) + 1000
                    )
                ),
                has_retry=0,
                eta=await ETA.get_eta_info(file_info=task),
                error=[],
            )

        uid = (
            db.fetchone(
                f"""
                INSERT INTO waiting
                ({'uid, ' if isinstance(task, ApiWaiting) else ''}sort, eta, input, output, args, settings, has_retry, error)
                VALUES ({str(task.uid) + ', ' if isinstance(task, ApiWaiting) else ''}?, ?, ?, ?, ?, ?, ?, ?)
                RETURNING uid;
            """,
                data.sort,
                data.eta.model_dump_json(),
                json.dumps(
                    [f.model_dump(mode="json") for f in data.input],
                    ensure_ascii=False,
                ),
                str(data.output.resolve()),
                data.args.model_dump_json(),
                data.settings.model_dump_json(),
                data.has_retry,
                json.dumps(data.error, ensure_ascii=False),
            )
        )[0]
        return uid

    async def _loop(self):
        while True:
            # Reset
            self.running = None
            self.is_running = True
            self.llm = None
            self.suspend_total = timedelta(0)

            # Wait for suspend to be cleared
            await self.suspend_loop.wait()

            task = await self._preprocess()
            # Get Task
            if isinstance(task, bool):
                continue
            elif task is None:

                # Process LLM tasks if any
                row = db.fetchone("SELECT 1 FROM llm_waiting LIMIT 1;")
                if row is not None and await SettingsManager.translator_check():
                    self.running = LLM(SettingsManager._translator)
                    while True:
                        rtn = await self._llm_task()
                        if not rtn:
                            break
                else:
                    await asyncio.sleep(3)

                # Continue to next iteration
                continue

            # Run Task
            try:
                # Process Audio
                if task.args.subtitle is not None:
                    self.running = await Audio.run(task)
                    await self.running.wait()

                # Process Transcode & Whisper
                if task.args.video_br > 0 and task.args.subtitle is not None:
                    assert self.running is not None
                    self.running = (
                        await Transcode.run(task),
                        await Whisper.run(
                            task, self.running, SettingsManager._translator
                        ),
                    )
                    await asyncio.gather(self.running[0].wait(), self.running[1].wait())

                elif task.args.video_br <= 0 and task.args.subtitle is not None:
                    assert self.running is not None
                    self.running = await Whisper.run(
                        task, self.running, SettingsManager._translator
                    )
                    await self.running.wait()

                elif task.args.video_br > 0 and task.args.subtitle is None:
                    self.running = await Transcode.run(task)
                    await self.running.wait()

            except asyncio.CancelledError as e:
                if str(e) == "task":
                    continue
                else:
                    await self.insert(task, priority=True)
                    raise e

            except Exception as e:
                Lg.debug(f"Task failed with error: {task.model_dump()} -> {e}")
                await self._failed(task, str(e))
                continue

            else:
                await self._success(task)

            # Process LLM
            if task.args.tran is not None:
                if task.args.tran_inmediate and SettingsManager.translator_check():
                    self.running = LLM(SettingsManager._translator)
                    await self._llm_task(task)
                else:
                    LLM.insert(LLM.tran_from_taskinfo(task))

    async def _preprocess(self):
        task = await PlanUtils.get_next()
        return task

    async def _failed(self, task: ApiWaiting, error: str):
        task.has_retry += 1
        task.error.append(error)
        if task.has_retry < task.settings.retry:
            await self.insert(task)

        else:
            db.execute(
                "INSERT INTO failed (input, output, args, settings, error, time) VALUES (?, ?, ?, ?, ?, ?);",
                json.dumps(
                    [f.model_dump(mode="json") for f in task.input],
                    ensure_ascii=False,
                ),
                str(task.output.resolve()),
                task.args.model_dump_json(),
                task.settings.model_dump_json(),
                json.dumps(task.error, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            )

    async def _success(self, task: ApiWaiting):
        total_time = datetime.now(timezone.utc) - self.suspend_total
        if isinstance(self.running, tuple):
            total_time -= self.running[0].progress.start_time
        elif isinstance(self.running, Transcode) or isinstance(self.running, Whisper):
            total_time -= self.running.progress.start_time
        else:
            return

        db.execute(
            """
                    INSERT INTO completed 
                    (input, output, total_consumed, finished_time) 
                    VALUES (?, ?, ?, ?);
                """,
            json.dumps(
                [f.model_dump(mode="json") for f in task.input], ensure_ascii=False
            ),
            (await FileOprations.fetch_file_info(task.output)).model_dump_json(),
            str(total_time).split(".")[0],
            datetime.now(timezone.utc).isoformat(),
        )
        if task.args.video_br > 0:
            await ETA.insert_history(task, int(total_time.total_seconds()))

        if task.settings.delete_source and task.args.video_br > 0:
            for f in task.input:
                try:
                    f.path.unlink()
                    if len(list(f.path.parent.iterdir())) == 0:
                        f.path.parent.rmdir()
                except Exception:
                    Lg.debug(f"Failed to delete source file: {f.path.resolve()}")
                    pass

    async def _llm_task(self, task: LLMTaskInfo | TaskInfo | None = None) -> bool:
        if isinstance(self.running, LLM):
            if task is None:
                row = db.fetchone("SELECT * FROM llm_waiting ORDER BY uid ASC LIMIT 1;")
                if row is None:
                    return False
                task = LLMTaskInfo.model_validate(dict(row))
                db.execute("DELETE FROM llm_waiting WHERE uid=?;", task.uid)
            elif isinstance(task, TaskInfo):
                assert task.args.subtitle is not None
                assert task.args.tran is not None
                task = LLM.tran_from_taskinfo(task)

            try:
                self.llm = await self.running.run(task)
            except asyncio.CancelledError as e:
                LLM.insert(task)
                raise e
            except Exception as e:
                Lg.error(f"LLM task failed: {task.output} {e}")
                db.execute(
                    "INSERT INTO failed (input, output, args, error, time) VALUES (?, ?, ?, ?, ?);",
                    str(task.input.resolve()),
                    str(task.output.resolve()),
                    TranscodeInfo(
                        pix_fmt="",
                        zscale="",
                        video_br=-1,
                        audio_br=-1,
                        subtitle=task.org_lang,
                        tran=task.tran_lang,
                    ).model_dump_json(),
                    json.dumps([str(e)], ensure_ascii=False),
                    datetime.now(timezone.utc).isoformat(),
                )
                return False
            else:
                return True

        else:
            Lg.error("LLM is not running. Cannot process LLM task.")
            return False
