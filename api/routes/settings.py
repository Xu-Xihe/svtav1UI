import shutil
import json
from fastapi import APIRouter

from src.models import GeneralSettings, VERSION, TranslatorSettings
from src.logger import Lg
from src.database import Database


class SettingsManager:

    _general: GeneralSettings = GeneralSettings()
    _translator: TranslatorSettings = TranslatorSettings()

    @classmethod
    async def init(cls) -> None:
        res = dict(Database.fetchall("SELECT * FROM settings"))
        if res:
            for key in list(res.keys()):
                try:
                    res[key] = json.loads(res[key])
                except Exception:
                    res.pop(key, None)

            cls._general = GeneralSettings.model_validate(res)
            cls._translator = TranslatorSettings.model_validate(res)

        Lg.debug(f"General settings: {cls._general.model_dump()}")
        Lg.debug(f"Translator settings: {cls._translator.model_dump()}")

    @classmethod
    async def translator_check(cls) -> bool:
        if not shutil.which("whisper-cli"):
            return False
        if cls._translator.asr_model is None or cls._translator.llm_key is None:
            return False
        if cls._translator.asr_model.suffix != ".bin":
            return False
        return True

    @classmethod
    async def close(cls) -> None:
        data = cls._general.model_dump(mode="json") | cls._translator.model_dump(
            mode="json"
        )
        for key, value in data.items():
            Database.execute(
                """
                INSERT INTO settings (key, value)
                VALUES (?, ?)
                ON CONFLICT(key)
                DO UPDATE SET value = excluded.value;
                """,
                key,
                json.dumps(value, ensure_ascii=False),
            )


settings_router = APIRouter(prefix="/settings", tags=["Settings"])


@settings_router.get("/g", response_model=GeneralSettings)
async def get_settings():
    """
    Get the current settings.
    """
    return SettingsManager._general


@settings_router.post("/g", response_model=GeneralSettings)
async def update_settings(settings: GeneralSettings):
    """
    Update the settings.
    """
    SettingsManager._general = settings
    Lg.debug(f"Updated general settings: {SettingsManager._general.model_dump()}")
    return SettingsManager._general


@settings_router.get("/t", response_model=TranslatorSettings)
async def get_translator_settings():
    """
    Get the current translator settings.
    """
    return SettingsManager._translator


@settings_router.post("/t", response_model=TranslatorSettings)
async def update_translator_settings(patch: TranslatorSettings):
    """
    Update the translator settings.
    """
    SettingsManager._translator = patch
    Lg.debug(f"Updated translator settings: {SettingsManager._translator.model_dump()}")
    return SettingsManager._translator


@settings_router.get("/version", response_model=str)
async def get_version():
    """
    Get the current version of the API.
    """
    return VERSION


@settings_router.get("/translator", response_model=bool)
async def get_translator():
    """
    Check if the translator is available.
    """
    return await SettingsManager.translator_check()
