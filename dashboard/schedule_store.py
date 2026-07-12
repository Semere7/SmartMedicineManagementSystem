# Persists per-slot medicine schedules to a local JSON file and provides
# thread-safe read/update helpers used by both the API and the background
# scheduler.

import json
import re
import threading
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
SCHEDULES_PATH = DATA_DIR / "schedules.json"

TIME_PATTERN = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

DEFAULT_TIMES = {1: "08:00", 2: "12:00", 3: "18:00", 4: "21:00"}

_lock = threading.Lock()


def is_valid_time(value: str) -> bool:
    return bool(TIME_PATTERN.match(value or ""))


def _default_schedule(slot: int) -> dict:
    return {
        "name": "",
        "time": DEFAULT_TIMES[slot],
        "enabled": False,
        "last_triggered_date": None,
    }


def _default_schedules() -> dict:
    return {str(slot): _default_schedule(slot) for slot in range(1, 5)}


def _ensure_file() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if not SCHEDULES_PATH.exists():
        SCHEDULES_PATH.write_text(json.dumps(_default_schedules(), indent=2))


def _write_schedules(schedules: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SCHEDULES_PATH.write_text(json.dumps(schedules, indent=2))


def _read_merged_unlocked() -> dict:
    _ensure_file()
    try:
        data = json.loads(SCHEDULES_PATH.read_text())
    except (json.JSONDecodeError, OSError):
        data = {}

    schedules = _default_schedules()
    for slot_str, defaults in schedules.items():
        if slot_str in data and isinstance(data[slot_str], dict):
            defaults.update(data[slot_str])
    return schedules


def load_schedules() -> dict:
    with _lock:
        return _read_merged_unlocked()


def save_schedule(slot: int, name: str, time: str, enabled: bool) -> dict:
    with _lock:
        schedules = _read_merged_unlocked()
        slot_str = str(slot)
        schedules[slot_str]["name"] = name
        schedules[slot_str]["time"] = time
        schedules[slot_str]["enabled"] = enabled
        # Saving a schedule represents fresh intent for when it should next
        # fire, so clear any previous trigger record — otherwise editing the
        # time (e.g. to retest later the same day) would stay silently
        # blocked by a trigger that already happened at the old time.
        schedules[slot_str]["last_triggered_date"] = None
        _write_schedules(schedules)
        return schedules[slot_str]


def mark_triggered(slot: int, date_str: str) -> None:
    with _lock:
        schedules = _read_merged_unlocked()
        schedules[str(slot)]["last_triggered_date"] = date_str
        _write_schedules(schedules)
