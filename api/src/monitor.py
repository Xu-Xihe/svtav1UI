import asyncio
from typing import Callable
from src.logger import Lg


class Monitor:
    def __init__(
        self,
        proc: asyncio.subprocess.Process,
        decoder: Callable[[str], None],
    ):
        self.proc = proc
        self.decoder = decoder
        self.updater = asyncio.create_task(self._update_progress())

    async def wait(self):
        try:
            await self.updater
            await self.proc.wait()
        except asyncio.CancelledError as e:
            self.updater.cancel(str(e))
            raise e

    async def cancel(self, sig: str):
        self.updater.cancel(sig)
        try:
            await self.updater
        except asyncio.CancelledError:
            pass

    async def _update_progress(self) -> None:
        while True:
            # Check if the process has finished or crashed
            if self.proc.returncode is not None:
                break

            # Read the progress output from the subprocess
            assert self.proc.stdout is not None
            try:
                raw_line = await asyncio.wait_for(
                    self.proc.stdout.readline(), timeout=0.3
                )
                self.decoder(raw_line.decode().strip())
            except Exception:
                continue

        await self._callback()

    async def _callback(self):
        # Check if the process has finished or crashed
        if self.proc.returncode is None:
            await self.proc.wait()

        # Check if the process exited with an error
        if self.proc.returncode != 0:
            if self.proc.stderr is None:
                error_message = "Unknown error occurred."
            else:
                error_message = (await self.proc.stderr.read()).decode()
            Lg.error(
                f"Process exited with code {self.proc.returncode}: {error_message}"
            )
            raise RuntimeError(f"Code {self.proc.returncode}: {error_message}")
