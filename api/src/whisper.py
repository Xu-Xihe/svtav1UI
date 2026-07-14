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
        self.output.unlink(missing_ok=True)  # Remove existing output file if it exists

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
            await asyncio.to_thread(self._callback)
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
            "-nth",
            str(self.config.no_speech_threshold),
            "-et",
            str(self.config.entropy_thold),
            "-lpt",
            str(self.config.logprob_thold),
            "-mc",
            str(self.config.max_context),
            *(["-sns"] if self.config.suppress_nst else []),
            *(["-nf"] if self.config.no_fallback else []),
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
        else:
            self.progress.log.append(line)

    def _callback(self) -> None:
        self.progress.log.append(
            f"Whisper task completed. Reviewing the output file: {self.output}"
        )

        index = 1
        timesetp = ""
        content = ""
        temp_file = self.output.with_suffix(".temp")
        with self.output.open("r", encoding="utf-8", errors="replace") as fin:
            with temp_file.open("w", encoding="utf-8") as fout:
                for line in fin:
                    if line.strip().isdigit():
                        pass
                    elif "-->" in line:
                        timesetp = line.strip()
                    elif line.strip() == "":
                        pass
                    else:
                        if line.strip() != content:
                            content = line.strip()
                            if len(line.strip()) > 13:
                                best = self._find_repeat_block(line.strip())
                                if best:
                                    write = (
                                        best["prefix"]
                                        + best["block"]
                                        * min(
                                            3,
                                            max(
                                                1,
                                                13
                                                - len(best["prefix"] + best["suffix"])
                                                // len(best["block"]),
                                            ),
                                        )
                                        + best["suffix"]
                                    )
                                    self.progress.log.append(
                                        f"Fix subtitle: {line.strip()} --> {write}"
                                    )
                                else:
                                    write = line.strip()
                            else:
                                write = line.strip()

                            fout.write(f"{index}\n")
                            fout.write(f"{timesetp}\n")
                            fout.write(f"{write}\n\n")
                            index += 1

                        else:
                            self.progress.log.append(
                                f"Duplicate subtitle line detected and skipped: {timesetp} --> {line.strip()}"
                            )

        temp_file.replace(self.output)

    @staticmethod
    def _find_repeat_block(
        s: str,
        min_region_len: int = 3,
        max_block_len: int = 30,
    ):
        """
        Find:
            prefix + block * count + suffix

        Rules:
            1. Find the longest continuous repeated region.
            2. Inside the region, reduce to the smallest repeating unit.
            3. Ignore repeated regions shorter than min_region_len.

        Return:
            {
                "prefix": ...,
                "block": ...,
                "count": ...,
                "suffix": ...
            }
        """

        n = len(s)

        if n < min_region_len:
            return None

        best = None

        # Find the longest repeated region
        for start in range(n):

            for block_len in range(1, min(max_block_len, n - start) + 1):

                block = s[start : start + block_len]

                pos = start + block_len
                count = 1

                while pos + block_len <= n and s.startswith(block, pos):
                    count += 1
                    pos += block_len

                if count < 2:
                    continue

                region_len = pos - start

                if region_len < min_region_len:
                    continue

                if best is None or region_len > best["region_len"]:
                    best = {
                        "start": start,
                        "end": pos,
                        "region_len": region_len,
                    }

        if best is None:
            return None

        # Extract repeat region
        repeat_region = s[best["start"] : best["end"]]

        # Find smallest period
        block = repeat_region

        for size in range(1, len(repeat_region) + 1):

            if len(repeat_region) % size != 0:
                continue

            candidate = repeat_region[:size]

            if candidate * (len(repeat_region) // size) == repeat_region:
                block = candidate
                break

        return {
            "prefix": s[: best["start"]],
            "block": block,
            "count": len(repeat_region) // len(block),
            "suffix": s[best["end"] :],
        }
