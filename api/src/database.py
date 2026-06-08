import sqlite3
import json

from pathlib import Path
from src.models import (
    ApiWaiting,
    TaskInfo,
    FileInfo,
    TranscodeInfo,
    Settings,
    FileETAInfo,
)

DB_PATH = Path(__file__).parent.parent / "cache" / "config.db"

TABLES = {
    "waiting": {
        "uid": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "sort": "REAL NOT NULL",
        "eta": "TEXT NOT NULL",
        "input": "TEXT NOT NULL",
        "output": "TEXT NOT NULL",
        "args": "TEXT NOT NULL",
        "settings": "TEXT NOT NULL",
        "has_retry": "INTEGER NOT NULL DEFAULT 0",
        "error": "TEXT",
    },
    "failed": {
        "uid": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "input": "TEXT NOT NULL",
        "output": "TEXT NOT NULL",
        "args": "TEXT NOT NULL",
        "settings": "TEXT NOT NULL",
        "error": "TEXT NOT NULL",
    },
    "completed": {
        "input": "TEXT NOT NULL",
        "output": "TEXT NOT NULL",
        "total_consumed": "INTEGER NOT NULL",
        "finished_time": "TEXT NOT NULL",
    },
    "history": {
        "uid": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "total_consumed": "INTEGER NOT NULL",
        "codec": "INTEGER NOT NULL",
        "pixel_count": "INTEGER NOT NULL",
        "pixels_per_second": "REAL NOT NULL",
        "frame_count": "INTEGER NOT NULL",
        "preset": "INTEGER NOT NULL",
        "target_bit_rate": "INTEGER NOT NULL",
        "lookahead": "INTEGER NOT NULL",
        "keyint": "INTEGER NOT NULL",
        "scd": "INTEGER NOT NULL",
        "E_mean": "REAL",
        "E_p95": "REAL",
        "E_diff_mean": "REAL",
        "h_mean": "REAL",
        "h_diff_mean": "REAL",
        "epsilon_mean": "REAL",
        "epsilon_diff_mean": "REAL",
    },
}


class Database:
    _database = None
    _cursor = None

    @classmethod
    async def init(cls):
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Connect to the database
        cls._database = sqlite3.connect(str(DB_PATH.resolve()))
        cls._database.row_factory = sqlite3.Row
        cls._cursor = cls._database.cursor()

        # Create tables if not exist
        for table_name, columns in TABLES.items():
            cls._cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
                (table_name,),
            )
            if cls._cursor.fetchone() is None:
                cls._cursor.execute(
                    f"CREATE TABLE {table_name} ({', '.join(f'{name} {col_type}' for name, col_type in columns.items())});"
                )

        # Rerank waiting tasks based on sort value
        await cls.execute(
            """
                WITH ranked AS (
                    SELECT
                        uid,
                        ROW_NUMBER() OVER (ORDER BY sort, uid) * 1000 AS new_sort
                    FROM waiting
                )
                UPDATE waiting
                SET sort = (
                    SELECT new_sort
                    FROM ranked
                    WHERE ranked.uid = waiting.uid
                );
            """,
        )

        # Commit changes
        cls._database.commit()

    @classmethod
    async def fetch(cls, sql: str, *args):
        if cls._cursor is None:
            raise Exception("Database not initialized")
        cls._cursor.execute(sql, args)
        return cls._cursor.fetchall()

    @classmethod
    async def execute(cls, sql: str, *args):
        if cls._cursor is None or cls._database is None:
            raise Exception("Database not initialized")
        cls._cursor.execute(sql, args)
        cls._database.commit()

    @classmethod
    async def fetchone(cls, sql: str, *args):
        if cls._cursor is None:
            raise Exception("Database not initialized")
        cls._cursor.execute(sql, args)
        return cls._cursor.fetchone()

    @classmethod
    async def close(cls):
        if cls._database is not None:
            cls._database.commit()
            cls._database.close()
            cls._database = None
            cls._cursor = None

    @classmethod
    async def fetch_data(cls, row) -> TaskInfo:
        return TaskInfo(
            uid=row["uid"],
            input=[FileInfo.model_validate(f) for f in json.loads(row["input"])],
            output=Path(row["output"]),
            args=TranscodeInfo.model_validate(json.loads(row["args"])),
            settings=Settings.model_validate(json.loads(row["settings"])),
        )

    @classmethod
    async def fetch_ApiWaiting(cls, row) -> ApiWaiting:
        return ApiWaiting(
            **(await cls.fetch_data(row)).model_dump(),
            has_retry=row["has_retry"],
            error=json.loads(row["error"]),
            sort=row["sort"],
            eta=FileETAInfo.model_validate_json(row["eta"]),
        )
