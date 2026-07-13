import logging
import traceback
import shutil
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.concurrency import asynccontextmanager

from src.database import Database
from src.logger import Lg
from src.eta import ETA
from src.queue import Queue

from routes.task import task_router
from routes.path import path_router
from routes.file import file_router
from routes.settings import settings_router, SettingsManager
from routes.plan import plan_router


class IgnoreHealthFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # msg = record.getMessage()

        # if "/plan/status" in msg and "POST" in msg:
        #    return True

        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Check ffmpeg
    print("[1/6] Checking ffmpeg...")
    if not shutil.which("ffmpeg"):
        raise FileNotFoundError("ffmpeg not found in PATH. Please install ffmpeg.")

    # Initialize Components
    print("[2/6] Initializing Logger...")
    Lg.init()
    logger = logging.getLogger("uvicorn.access")
    logger.addFilter(IgnoreHealthFilter())
    print("[3/6] Initializing Database...")
    Database.init()
    print("[4/6] Loading Configuration...")
    await SettingsManager.init()
    print("[5/6] Training ETA Model...")
    await ETA.init()

    # Create a task queue for processing tasks
    print("[6/6] Initializing Task Queue...")
    app.state.queue = Queue()
    print(
        "All components initialized successfully. Server is ready to accept requests.\n"
    )

    yield
    print("Shutting down server...")
    # Cancel the task queue and wait for it to finish
    print("[1/3] Waiting the task loop to exist...")
    await app.state.queue.cancel("system")
    print("[2/3] Saving configuration...")
    await SettingsManager.close()
    print("[3/3] Closing database...")
    Database.close()
    shutil.rmtree(Path(__file__).parent / "cache" / "temp", ignore_errors=True)
    Lg.debug("Server shutdown complete.\n\n\n")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: Exception):
    Lg.error(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "detail": str(exc),
        },
    )


@app.exception_handler(Exception)
async def all_exception_handler(request: Request, exc: Exception):
    Lg.error(f"Internal error: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "code": "INTERNAL_ERROR",
            "detail": str(exc),
        },
    )


app.include_router(path_router)
app.include_router(file_router)
app.include_router(task_router)
app.include_router(settings_router)
app.include_router(plan_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
