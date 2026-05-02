import logging
import sys
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

from fastapi import logger


class Lg:

    _log = None

    @classmethod
    def init(cls) -> None:
        # Get logger
        cls._log = logging.getLogger("main_log")
        cls._log.setLevel(logging.DEBUG)

        # Make log dir
        log_path = Path(__file__).resolve().parent.parent / "cache" / "main.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # File Handler
        file_handler = TimedRotatingFileHandler(
            log_path, when="midnight", interval=1, backupCount=7, encoding="utf-8"
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(
            logging.Formatter(
                "{asctime}-{levelname:^7}-{filename}-{lineno} : {message}",
                style="{",
                datefmt=r"%Y-%m-%d %H:%M:%S",
            )
        )
        cls._log.addHandler(file_handler)

        # Stderr handler
        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setLevel(logging.ERROR)
        stderr_handler.setFormatter(
            logging.Formatter("{levelname:^7}:     {message}", style="{")
        )
        cls._log.addHandler(stderr_handler)

        # Stdout handler
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setLevel(logging.INFO)
        stdout_handler.setFormatter(
            logging.Formatter("{levelname:^7}:     {message}", style="{")
        )
        cls._log.addHandler(stdout_handler)

    @classmethod
    def info(cls, msg: str) -> None:
        if cls._log is None:
            print(msg)
        else:
            cls._log.info(msg)

    @classmethod
    def error(cls, msg: str) -> None:
        if cls._log is None:
            print(msg, file=sys.stderr)
        else:
            cls._log.error(msg)

    @classmethod
    def debug(cls, msg: str) -> None:
        if cls._log is None:
            print(msg)
        else:
            cls._log.debug(msg)
