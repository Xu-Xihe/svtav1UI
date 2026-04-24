import asyncio
import logging
import traceback

from fastapi import FastAPI, Request, logger
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.concurrency import asynccontextmanager

from routes.task import TaskOprations, task_router
from routes.path import path_router
from routes.file import file_router
from routes.settings import settings_router, SettingsManager
from src.database import Database


class IgnoreHealthFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        msg = record.getMessage()
        if "/health" in msg or "/task/running" in msg:
            return False
        return True


@asynccontextmanager
async def lifespan(app: FastAPI):
    await Database.init()
    await SettingsManager.init()
    logger = logging.getLogger("uvicorn.access")
    logger.addFilter(IgnoreHealthFilter())
    queue = asyncio.create_task(TaskOprations.init())
    yield
    queue.cancel()
    try:
        await queue
    except asyncio.CancelledError:
        pass
    await Database.close()
    await SettingsManager.close()


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
    print("VALIDATION ERROR:")
    print(exc)
    return JSONResponse(
        status_code=422,
        content={
            "code": "VALIDATION_ERROR",
            "detail": str(exc),
        },
    )


@app.exception_handler(Exception)
async def all_exception_handler(request: Request, exc: Exception):
    traceback.print_exc()
    print(exc)
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


@app.get("/health")
async def health():
    return {"status": "ok"}
