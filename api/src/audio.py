import secrets
import asyncio
import psutil
import shlex

from pathlib import Path
from datetime import timedelta

from src.models import VideoSuffixs, TaskInfo, ApiRunning
from src.monitor import Monitor
from src.logger import Lg


class Audio:

    def __init__(self, task: TaskInfo):
        # init & validate the file
        self.task = task
        self.progress = ApiRunning.model_validate(task.model_dump())
        self.total_duration = sum(f.duration for f in task.input)

        if not all(
            f.path.is_file() and f.path.suffix.lower() in VideoSuffixs
            for f in task.input
        ):
            raise FileNotFoundError(
                "One or more input files are missing or not supported video formats."
            )
        self.input = [f.path for f in task.input]

        # Generate a unique output file name
        self.output = (
            Path(__file__).parent.parent
            / "cache"
            / "temp"
            / f"{secrets.token_hex(8)}.wav"
        )
        self.output.parent.mkdir(parents=True, exist_ok=True)

        # run command
        self.proc: asyncio.subprocess.Process
        self.monitor: Monitor

    @classmethod
    async def run(cls, task: TaskInfo):
        self = cls(TaskInfo.model_validate(task.model_dump()))

        # run command
        self.proc = await asyncio.create_subprocess_exec(
            *self._command(),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        self.monitor = Monitor(proc=self.proc, decoder=self._decoder)
        return self

    def resume(self):
        psutil.Process(self.proc.pid).resume()

    def pause(self):
        psutil.Process(self.proc.pid).suspend()

    async def cancel(self, sig: str):
        await self.monitor.cancel(sig)
        self.proc.kill()
        await self.proc.wait()
        self.output.unlink(missing_ok=True)

    async def wait(self):
        try:
            await self.monitor.wait()
        except asyncio.CancelledError as e:
            await self.cancel(str(e))
            raise e
        except Exception as e:
            self.output.unlink(missing_ok=True)
            raise e

    def _filter(self) -> list[str]:
        return [
            "-filter_complex",
            f"{''.join(f"[{i}:a:0]" for i in range(len(self.input)))}"
            f"concat=n={len(self.input)}:v=0:a=1[outa]",
            "-map",
            "[outa]",
        ]

    def _command(self) -> list[str]:
        # Build the command to extract audio from the video file
        cmd = [
            "ffmpeg",
            "-v",
            "quiet",
            "-progress",
            "pipe:1",
            "-y",
            *[arg for f in self.input for arg in ("-i", str(f.resolve()))],
            *self._filter(),
            "-ar",
            "16000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            str(self.output),
        ]

        Lg.debug(
            f"Initialized Audio task: input: {self.input}; output: {self.output}; cmd: {' '.join(shlex.quote(arg) for arg in cmd)}"
        )
        return cmd

    def _decoder(self, raw_line: str) -> None:
        # decode & validation
        line = raw_line.split("=")
        if len(line) != 2:
            return
        key, value = line

        # update progress
        if value == "N/A":
            if self.progress.progress > 10:
                self.progress.progress = 100.0
                self.progress.eta = timedelta(seconds=0)
                return
        elif key == "bitrate":
            self.progress.bitrate = value
        elif key == "total_size":
            self.progress.size = (
                f"{int(value)/1024:.2f} KB"
                if int(value) < 1024**2
                else f"{int(value)/1024**2:.2f} MB"
            )
        elif key == "out_time_us":
            self.progress.completed_time = timedelta(microseconds=int(value))
            self.progress.progress = (
                (
                    self.progress.completed_time.total_seconds()
                    / self.total_duration
                    * 100
                )
                if self.progress.progress < 100
                else 100.0
            )
            self.progress.eta = timedelta(
                seconds=(
                    round(
                        (
                            self.total_duration
                            - self.progress.completed_time.total_seconds()
                        )
                        / self.progress.speed
                    )
                    if self.progress.speed > 0
                    else 0
                )
            )
        elif key == "dup_frames":
            self.progress.dup_frames = int(value)
        elif key == "drop_frames":
            self.progress.drop_frames = int(value)
        elif key == "speed":
            self.progress.speed = float(value.replace("x", ""))
