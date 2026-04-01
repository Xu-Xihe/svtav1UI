from fastapi import APIRouter
from pathlib import Path

from src.models import Settings


PATH = Path(__file__).parent.parent / "cache" / "settings.json"


class SettingsManager:

    _settings: Settings = Settings()

    @classmethod
    async def init(cls) -> None:
        if PATH.exists():
            with open(PATH, "r", encoding="utf-8") as f:
                cls._settings = Settings.model_validate_json(f.read())

    @classmethod
    async def close(cls) -> None:
        with open(PATH, "w", encoding="utf-8") as f:
            f.write(cls._settings.model_dump_json(indent=4))


settings_router = APIRouter(prefix="/settings", tags=["Settings"])


@settings_router.get("", response_model=Settings)
async def get_settings():
    """
    Get the current settings.
    """
    return SettingsManager._settings


@settings_router.post("", response_model=Settings)
async def update_settings(settings: Settings):
    """
    Update the settings.
    """
    print(settings)
    SettingsManager._settings = settings
    return SettingsManager._settings
