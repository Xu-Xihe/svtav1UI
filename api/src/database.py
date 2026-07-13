import sqlite3
import json

from pathlib import Path
from src.models import (
    ApiWaiting,
    TaskInfo,
    FileInfo,
    TranscodeInfo,
    GeneralSettings,
    FileETAInfo,
)
from src.logger import Lg

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
    "llm_waiting": {
        "uid": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "input": "TEXT NOT NULL",
        "output": "TEXT NOT NULL",
        "org_lang": "TEXT NOT NULL",
        "tran_lang": "TEXT NOT NULL",
    },
    "failed": {
        "uid": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "input": "TEXT NOT NULL",
        "output": "TEXT NOT NULL",
        "args": "TEXT NOT NULL",
        "settings": "TEXT",
        "error": "TEXT NOT NULL",
        "time": "TEXT NOT NULL",
    },
    "completed": {
        "input": "TEXT NOT NULL",
        "output": "TEXT NOT NULL",
        "total_consumed": "INTEGER NOT NULL",
        "finished_time": "TEXT NOT NULL",
    },
    "llm_completed": {
        "input": "TEXT NOT NULL",
        "output": "TEXT NOT NULL",
        "org_lang": "TEXT NOT NULL",
        "tran_lang": "TEXT NOT NULL",
        "finished_time": "TEXT NOT NULL",
    },
    "history": {
        "uid": "INTEGER PRIMARY KEY AUTOINCREMENT",
        "total_consumed": "INTEGER NOT NULL",
        "codec": "INTEGER NOT NULL",
        "pixel_count": "INTEGER NOT NULL",
        "frame_count": "INTEGER NOT NULL",
        "subtitle": "INTEGER NOT NULL",
        "preset": "INTEGER NOT NULL",
        "target_bit_rate": "INTEGER NOT NULL",
        "lookahead": "INTEGER NOT NULL",
        "keyint": "INTEGER NOT NULL",
        "scd": "INTEGER NOT NULL",
    },
    "settings": {
        "key": "TEXT PRIMARY KEY",
        "value": "TEXT",
    },
}


class Database:
    _database = None
    _cursor = None

    @classmethod
    def init(cls):
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)

        # Connect to the database
        cls._database = sqlite3.connect(str(DB_PATH.resolve()))
        cls._database.row_factory = sqlite3.Row
        cls._cursor = cls._database.cursor()

        # Create tables if not exist
        for table_name, columns in TABLES.items():
            row = cls.fetchone(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?;",
                table_name,
            )
            if row is None:
                cls.execute(
                    f"CREATE TABLE {table_name} ({', '.join(f'{name} {col_type}' for name, col_type in columns.items())});"
                )

        # Update the history table to v3 if needed
        cls.db_update_v2_v3()

        # Rerank waiting tasks based on sort value
        cls.execute(
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
    def fetchall(cls, sql: str, *args):
        if cls._cursor is None:
            raise Exception("Database not initialized")
        cls._cursor.execute(sql, args)
        return cls._cursor.fetchall()

    @classmethod
    def execute(cls, sql: str, *args):
        if cls._cursor is None or cls._database is None:
            raise Exception("Database not initialized")
        cls._cursor.execute(sql, args)
        cls._database.commit()

    @classmethod
    def fetchone(cls, sql: str, *args):
        if cls._cursor is None:
            raise Exception("Database not initialized")
        cls._cursor.execute(sql, args)
        return cls._cursor.fetchone()

    @classmethod
    def close(cls):
        if cls._database is not None:
            cls._database.commit()
            cls._database.close()
            cls._database = None
            cls._cursor = None

    @classmethod
    def fetch_data(cls, row) -> TaskInfo:
        return TaskInfo(
            uid=row["uid"],
            input=[FileInfo.model_validate(f) for f in json.loads(row["input"])],
            output=Path(row["output"]),
            args=TranscodeInfo.model_validate_json(row["args"]),
            settings=GeneralSettings.model_validate_json(row["settings"]),
        )

    @classmethod
    def fetch_ApiWaiting(cls, row) -> ApiWaiting:
        return ApiWaiting(
            **(cls.fetch_data(row)).model_dump(),
            has_retry=row["has_retry"],
            error=json.loads(row["error"]),
            sort=row["sort"],
            eta=FileETAInfo.model_validate_json(row["eta"]),
        )

    @classmethod
    def db_update_v2_v3(cls):
        # Check if v3
        rows = cls.fetchall("PRAGMA table_info(history);")
        if rows is not None:
            columns = [row["name"] for row in rows]
            if "subtitle" in columns and "pixels_per_second" not in columns:
                return
        else:
            raise Exception("Failed to fetch table info for 'history'.")

        # Update the history table to v3
        cls.execute("BEGIN TRANSACTION;")
        try:
            # Create a new table with the updated schema
            cls.execute(
                f"CREATE TABLE history_v3 ({', '.join(f'{name} {col_type}' for name, col_type in TABLES["history"].items())});"
            )
            # Copy data from the old table to the new table, setting subtitle to 0
            cls.execute("""
                    INSERT INTO history_v3 (
                        uid,
                        total_consumed,
                        codec,
                        pixel_count,
                        frame_count,
                        subtitle,
                        preset,
                        target_bit_rate,
                        lookahead,
                        keyint,
                        scd
                    )
                    SELECT
                        uid,
                        total_consumed,
                        codec,
                        pixel_count,
                        frame_count,
                        0,
                        preset,
                        target_bit_rate,
                        lookahead,
                        keyint,
                        scd
                    FROM history;
                """)
            # Delete the old table
            cls.execute("DROP TABLE history;")
            # Rename the new table to the original name
            cls.execute("ALTER TABLE history_v3 RENAME TO history;")
            # Delete the failed table if it exists
            cls.execute("DROP TABLE IF EXISTS failed;")
            # Create the failed table with the updated schema
            cls.execute(
                f"CREATE TABLE failed ({', '.join(f'{name} {col_type}' for name, col_type in TABLES["failed"].items())});"
            )
        except Exception as e:
            Lg.error(f"Failed to update database from v2 to v3: {e}")
            cls.execute("ROLLBACK;")
            raise e
        else:
            cls.execute("COMMIT;")
            Lg.info("Database updated from v2 to v3 successfully.")
