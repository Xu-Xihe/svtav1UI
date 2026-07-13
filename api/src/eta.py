import pandas as pd
from xgboost import XGBRegressor

from src.models import TaskInfo, FileETAInfo, HistoryTable, CODEC_ID, ApiWaiting
from src.database import Database as db
from src.logger import Lg


class ETA:
    model = None

    @classmethod
    async def init(cls):
        await cls.train_model()

    @classmethod
    async def get_eta(cls, data: FileETAInfo) -> int:
        if cls.model is None:
            return -1

        X = pd.DataFrame([data.model_dump()])
        Lg.debug(
            f"Predicting ETA: features: {data.model_dump()} -> {int(cls.model.predict(X)[0])}"
        )

        return int(cls.model.predict(X)[0])

    @classmethod
    async def get_eta_info(cls, file_info: TaskInfo) -> FileETAInfo:
        rtn = FileETAInfo(
            codec=CODEC_ID.get(file_info.input[0].codec, -1),
            pixel_count=file_info.input[0].width * file_info.input[0].height,
            frame_count=int(
                file_info.input[0].frame_rate * sum(f.duration for f in file_info.input)
            ),
            subtitle=file_info.args.subtitle is not None,
            preset=file_info.settings.preset,
            target_bit_rate=file_info.args.video_br,
            lookahead=file_info.settings.lookahead,
            keyint=int(file_info.settings.keyint.replace("s", ""))
            * int(file_info.input[0].frame_rate),
            scd=file_info.settings.scd,
        )
        Lg.debug(f"Extracted ETA {file_info.input[0].path}: {rtn.model_dump()}")
        return rtn

    @classmethod
    async def train_model(cls):
        record: list[HistoryTable] = []

        rows = db.fetchall("SELECT * FROM history;")
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
        Lg.info(f"Trained ETA model with {len(X)} samples.")

    @classmethod
    async def insert_history(cls, task: ApiWaiting, consumed_time: int):
        data = HistoryTable(
            total_consumed=consumed_time,
            **task.eta.model_dump(),
        ).model_dump(exclude={"uid"})

        db.execute(
            f"""
                    INSERT INTO history
                    ({", ".join(data.keys())})
                    VALUES ({", ".join("?" * len(data))});
                """,
            *data.values(),
        )
