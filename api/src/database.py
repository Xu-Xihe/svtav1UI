import sqlite3
import json

from pathlib import Path
from src.models import ApiWaiting, TaskInfo, FileInfo, TranscodeInfo, Settings

DB_PATH = Path(__file__).parent.parent / "cache" / "config.db"

TABLES = {
    "waiting": {
        "uid": "INTEGER PRIMARY KEY AUTOINCREMENT",
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
            cls._database.close()
            cls._database = None
            cls._cursor = None

    @classmethod
    async def insert_task(cls, task: ApiWaiting | TaskInfo) -> None:
        if not all(f.path.is_file() for f in task.input):
            raise Exception("Input file not found.")

        if task.output.is_dir():
            task.output = task.output / f"{task.input[0].path.stem}.mp4"

        await cls.execute(
            f"INSERT INTO waiting ({'uid,' if task.uid else ''}input, output, args, settings, has_retry, error) VALUES ({str(task.uid) + ',' if task.uid else ''}?, ?, ?, ?, ?, ?);",
            json.dumps(
                [f.model_dump(mode="json") for f in task.input], ensure_ascii=False
            ),
            str(task.output.resolve()),
            task.args.model_dump_json(),
            task.settings.model_dump_json(),
            task.has_retry if isinstance(task, ApiWaiting) else 0,
            json.dumps(
                task.error if isinstance(task, ApiWaiting) else [], ensure_ascii=False
            ),
        )

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
        )
