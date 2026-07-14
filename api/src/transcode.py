import shlex
import asyncio
import os
import psutil

from datetime import timedelta

from src.models import ApiRunning, TaskInfo
from src.logger import Lg
from src.monitor import Monitor

# Environment variables for subprocess
ENV = os.environ.copy()
ENV["SVT_LOG"] = "2"


class Transcode:
    def __init__(self, task: TaskInfo):
        # init & validate task
        self.progress = ApiRunning.model_validate(task.model_dump())
        self.progress.state = "transcode"
        self.task = task
        self.total_duration = sum(f.duration for f in task.input)
        if task.args.video_br == -1:
            raise ValueError("Video bitrate is not set.")
        if (not task.settings.overwrite) and task.output.exists():
            raise FileExistsError(f"Output file {task.output} already exists.")

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
            env=ENV,
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
        self.task.output.unlink(missing_ok=True)

    async def wait(self):
        try:
            await self.monitor.wait()
        except asyncio.CancelledError as e:
            await self.cancel(str(e))
            raise e

    def _filter(self) -> list[str]:
        filters = []

        # scale fix
        if self.task.args.sar_fix:
            filters.append(self.task.args.sar_fix)
        elif self.task.input[0].width % 2 != 0 or self.task.input[0].height % 2 != 0:
            filters.append("pad=ceil(iw/2)*2:ceil(ih/2)*2")

        # rotate
        if self.task.args.rotate:
            if self.task.args.rotate in range(0, 4):
                filters.append(f"transpose={self.task.args.rotate}")
            elif self.task.args.rotate == 4:
                filters.append("hflip")
            elif self.task.args.rotate == 5:
                filters.append("hflip,transpose=2,transpose=2")
            elif self.task.args.rotate == 6:
                filters.append("transpose=2,transpose=2")

        # default filter
        filters.append("setsar=1")
        filters.append(self.task.args.zscale)
        filters.append(f"format={self.task.args.pix_fmt}")

        return [
            "-filter_complex",
            f"{''.join(f"[{i}:v:0][{i}:a:0]" for i in range(len(self.task.input)))}"
            f"concat=n={len(self.task.input)}:v=1:a=1[outv][outa];"
            f"[outv]{','.join(filters)}[v]",
            "-map",
            "[v]",
            "-map",
            "[outa]",
        ]

    def _command(self) -> list[str]:
        cmd = [
            "ffmpeg",
            "-v",
            "quiet",
            "-progress",
            "pipe:1",
            "-y" if self.task.settings.overwrite else "-n",
            *[arg for f in self.task.input for arg in ("-i", str(f.path.resolve()))],
            *self._filter(),
            "-c:v",
            "libsvtav1",
            "-b:v",
            str(
                min(
                    self.task.args.video_br,
                    self.task.settings.max_bitrate_mb * 1000 * 1000,
                )
            ),
            "-threads",
            "0",
            "-svtav1-params",
            f"rc=1:overshoot-pct={self.task.settings.overshoot_pct}"
            f":undershoot-pct={self.task.settings.undershoot_pct}"
            f":minsection-pct={self.task.settings.minsection_pct}"
            f":maxsection-pct={self.task.settings.maxsection_pct}"
            f":keyint={self.task.settings.keyint}"
            f":lookahead={self.task.settings.lookahead}"
            f":scd={int(self.task.settings.scd)}",
            "-preset",
            str(self.task.settings.preset),
            "-movflags",
            "+faststart",
            "-pix_fmt",
            self.task.args.pix_fmt,
            "-c:a",
            "aac",
            "-b:a",
            str(self.task.args.audio_br),
            str(self.task.output.resolve()),
        ]

        Lg.debug(
            f"Initialized Transcode task: cmd: {' '.join(shlex.quote(arg) for arg in cmd)}"
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
        elif key == "frame":
            self.progress.frame = int(value)
        elif key == "fps":
            self.progress.fps = float(value)
        elif key == "stream_0_0_q":
            self.progress.qp = float(value)
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
