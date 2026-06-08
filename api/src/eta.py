import shlex
import ulid
import asyncio
import pandas as pd

from pathlib import Path
from xgboost import XGBRegressor

from src.models import TaskInfo, FileETAInfo, HistoryTable, CODEC_ID
from src.database import Database as db
from src.logger import Lg

ETA_PATH = Path(__file__).parent.parent / "cache" / "eta"
ETA_PATH.mkdir(parents=True, exist_ok=True)



class ETA:
    vca_on = False
    vca_available = False
    model = None

    @classmethod
    async def init(cls):
        # Check VCA availability
        try:
            proc = await asyncio.create_subprocess_exec(
                "vca",
                "--help",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.wait()
        except FileNotFoundError:
            Lg.info("VCA: not found")
        else:
            cls.vca_available = True
            Lg.info(f"VCA: {'enabled' if cls.vca_on else 'disabled'}")

        await cls.train_model()

    @classmethod
    async def get_eta(cls, data: FileETAInfo) -> int:
        if cls.model is None:
            return -1

        X = pd.DataFrame([data.model_dump()])

        float_cols = [
            "E_mean",
            "E_p95",
            "E_diff_mean",
            "h_mean",
            "h_diff_mean",
            "epsilon_mean",
            "epsilon_diff_mean",
        ]
        X[float_cols] = X[float_cols].astype("float32")

        Lg.debug(
            f"Predicting ETA with features: {data.model_dump()} : {int(cls.model.predict(X)[0])}\n"
        )

        return int(cls.model.predict(X)[0])

    @classmethod
    async def get_eta_info(
        cls,
        file_info: TaskInfo,
        quick: bool = False,
    ) -> FileETAInfo:
        rtn = FileETAInfo(
            codec=CODEC_ID.get(file_info.input[0].codec, -1),
            pixel_count=file_info.input[0].width * file_info.input[0].height,
            pixels_per_second=(
                file_info.input[0].width
                * file_info.input[0].height
                * file_info.input[0].frame_rate
            ),
            frame_count=int(
                file_info.input[0].frame_rate * sum(f.duration for f in file_info.input)
            ),
            preset=file_info.settings.preset,
            target_bit_rate=file_info.args.video_br,
            lookahead=file_info.settings.lookahead,
            keyint=int(file_info.settings.keyint.replace("s", ""))
            * int(file_info.input[0].frame_rate),
            scd=file_info.settings.scd,
        )

        if cls.vca_available and cls.vca_on and not quick:
            session_id = str(ulid.new())
            y4m_path = ETA_PATH / f"{session_id}.y4m"
            csv_path = ETA_PATH / f"{session_id}.csv"

            test_duration = 8 * 60 / len(file_info.input)

            filter_complex = (
                ";".join(
                    f"[{i}:v]trim=end={test_duration},setpts=PTS-STARTPTS,"
                    f"scale=320:576,fps=18,format=yuv420p[v{i}]"
                    for i in range(len(file_info.input))
                )
                + ";"
                + "".join(f"[v{i}]" for i in range(len(file_info.input)))
                + f"concat=n={len(file_info.input)}:v=1:a=0[outv]"
            )

            cmd = [
                "ffmpeg",
                *[
                    arg
                    for f in file_info.input
                    for arg in ("-i", str(f.path.resolve()))
                ],
                "-filter_complex",
                filter_complex,
                "-map",
                "[outv]",
                "-f",
                "yuv4mpegpipe",
                str(y4m_path.resolve()),
            ]
            Lg.debug(f"Running command: {" ".join(shlex.quote(arg) for arg in cmd)}")
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.wait()
            if proc.returncode != 0 or not y4m_path.is_file():
                raise Exception(
                    f"Failed to generate test video for ETA prediction: {await proc.stderr.read() if proc.stderr else 'Unknown error'}"
                )

            cmd = [
                "vca",
                "--input",
                str(y4m_path.resolve()),
                "--segment-feature-csv",
                str(csv_path.resolve()),
            ]
            Lg.debug(f"Running command: {" ".join(shlex.quote(arg) for arg in cmd)}")
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.wait()
            if proc.returncode != 0 or not csv_path.is_file():
                raise Exception(
                    f"Failed to generate test video for ETA prediction: {await proc.stderr.read() if proc.stderr else 'Unknown error'}"
                )

            df = pd.read_csv(
                csv_path,
                skipinitialspace=True,
                usecols=range(9),
            )

            rtn.E_mean = df["E"].mean()
            rtn.E_p95 = df["E"].quantile(0.95)
            rtn.E_diff_mean = df["E"].diff().abs().mean()
            rtn.h_mean = df["h"].mean()
            rtn.h_diff_mean = df["h"].diff().abs().mean()
            rtn.epsilon_mean = df["epsilon"].mean()
            rtn.epsilon_diff_mean = df["epsilon"].diff().abs().mean()

            y4m_path.unlink(missing_ok=True)
            csv_path.unlink(missing_ok=True)

            Lg.debug(f"ETA features extracted: {rtn.model_dump()}\n\n")

        return rtn

    @classmethod
    async def eta_update(cls, uid: int, info: TaskInfo):
        if not cls.vca_on:
            return

        eta = await cls.get_eta_info(file_info=info, quick=False)
        await db.execute(
            """
            UPDATE waiting
            SET eta = ?
            WHERE uid = ?;
            """,
            eta.model_dump_json(),
            uid,
        )

    @classmethod
    async def train_model(cls):
        record: list[HistoryTable] = []

        rows = await db.fetch("SELECT * FROM history;")
        if len(rows) <= 8:
            Lg.error("Not enough data to train ETA model.")
            return
        for row in rows:
            record.append(HistoryTable.model_validate(dict(row)))

        df = pd.DataFrame([r.model_dump() for r in record])
        df["codec"] = df["codec"].map(CODEC_ID)
        X = df.drop(columns=["total_consumed"])
        y = df["total_consumed"]

        if len(X) < 888:
            cls.model = XGBRegressor(
                objective="reg:squarederror",
                eval_metric="mape",
                n_jobs=-1,
                n_estimators=64,
                max_depth=4,
                learning_rate=0.15,
                subsample=0.9,
                colsample_bytree=0.9,
                tree_method="hist",
                min_child_weight=2,
                reg_lambda=1.0,
                random_state=42,
            )
        else:
            cls.model = XGBRegressor(
                objective="reg:squarederror",
                eval_metric="mape",
                n_jobs=-1,
                n_estimators=300,
                max_depth=6,
                learning_rate=0.05,
                subsample=0.8,
                colsample_bytree=0.8,
                tree_method="hist",
                random_state=42,
            )
        cls.model.fit(X, y)
        Lg.info("ETA model trained.")
