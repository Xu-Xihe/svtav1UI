import asyncio
import psutil
import shlex

from src.audio import Audio, TaskInfo
from src.monitor import Monitor
from src.models import TranslatorSettings, ApiRunning
from src.logger import Lg


class Whisper:

    def __init__(self, task: TaskInfo, audio: Audio, config: TranslatorSettings):
        # init & validate task
        self.input = audio.output
        self.output = task.output.with_suffix(f".{task.args.subtitle}.srt")
        self.task = task
        self.config = config
        self.progress = ApiRunning.model_validate(task.model_dump())
        self.progress.state = "whisper"

        if not self.input.is_file() or self.input.suffix.lower() != ".wav":
            raise FileNotFoundError(
                f"Input file {self.input} is missing or not a WAV file."
            )

        # run command
        self.proc: asyncio.subprocess.Process
        self.monitor: Monitor

    @classmethod
    async def run(cls, task: TaskInfo, audio: Audio, config: TranslatorSettings):
        self = cls(TaskInfo.model_validate(task.model_dump()), audio, config)

        # run command
        self.proc = await asyncio.create_subprocess_exec(
            *self._command(),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
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
            self.input.unlink(missing_ok=True)
        except asyncio.CancelledError as e:
            await self.cancel(str(e))
            raise e

    def _command(self) -> list[str]:
        # Build the command to run Whisper on the audio file
        assert self.config.asr_model is not None
        assert self.task.args.subtitle is not None

        cmd = [
            "whisper-cli",
            "-m",
            str(self.config.asr_model),
            "-np",
            "-pp",
            "-tp",
            str(self.config.voice_temperature),
            "-osrt",
            "-l",
            self.task.args.subtitle,
            "-f",
            str(self.input),
            "-of",
            str(self.output.parent.resolve() / self.output.stem),
            "-ml",
            str(self.config.max_length_segment),
            "-sow",
            *(
                [
                    "--vad",
                    "-vm",
                    str(self.config.vad_model),
                    "-vmsd",
                    str(self.config.voice_speech_duration),
                    "-vsd",
                    str(self.config.voice_minimum_silence_duration),
                    "-vt",
                    str(self.config.voice_threshold),
                ]
                if self.config.vad_model is not None
                else []
            ),
        ]
        Lg.debug(
            f"Initialized Whisper task: input: {self.input}; output: {self.output}; cmd: {' '.join(shlex.quote(arg) for arg in cmd)}"
        )
        return cmd

    def _decoder(self, line: str) -> None:
        if "=" in line and "whisper_print_progress_callback" in line:
            *_, raw_value = line.split("=")
            value = int(raw_value.strip().split("%")[0])
            self.progress.progress = value
            Lg.debug(f"Whisper output: {line} -> {value}")
        else:
            self.progress.log.append(line)
            Lg.debug(f"Whisper output: {line}")
