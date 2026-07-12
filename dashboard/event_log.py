# In-memory server-side event log for events not initiated directly by the
# requesting client (e.g. automatic scheduler triggers). Polled by the
# frontend and merged into the on-page Event Log.

import threading
from datetime import datetime

_MAX_EVENTS = 200
_events = []
_lock = threading.Lock()


def add_event(message: str) -> None:
    with _lock:
        _events.append({
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "message": message,
        })
        if len(_events) > _MAX_EVENTS:
            del _events[: len(_events) - _MAX_EVENTS]


def get_events_since(count: int) -> list:
    with _lock:
        return list(_events[count:])


def total_events() -> int:
    with _lock:
        return len(_events)
