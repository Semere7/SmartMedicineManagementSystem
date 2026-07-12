# Entry point for the Smart Medicine Management System dashboard.
# Serves the web frontend and exposes the API used by the dashboard page.

import asyncio
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Ensure this file's own directory is importable regardless of how the
# app is launched (e.g. `uvicorn dashboard.app:app` from the repo root).
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from serial_manager import SerialManager
from bridge_runner import trigger_slot_via_bridge, BridgeError
import schedule_store
import event_log
from scheduler import scheduler_loop

STATIC_DIR = Path(__file__).parent / "static"

SLOT_NAMES = {
    1: "Morning",
    2: "Noon",
    3: "Evening",
    4: "Night",
}


class ScheduleUpdate(BaseModel):
    name: str = ""
    time: str
    enabled: bool = False


def _compute_next_schedule(schedules: dict, now: datetime):
    best = None

    for slot_str, entry in schedules.items():
        if not entry.get("enabled"):
            continue
        if not schedule_store.is_valid_time(entry.get("time", "")):
            continue

        hour, minute = (int(part) for part in entry["time"].split(":"))
        candidate = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= now:
            candidate += timedelta(days=1)

        if best is None or candidate < best["at"]:
            slot = int(slot_str)
            best = {
                "slot": slot,
                "slot_name": SLOT_NAMES.get(slot, str(slot)),
                "name": entry.get("name", ""),
                "time": entry["time"],
                "at": candidate,
            }

    if best is None:
        return None

    return {
        "slot": best["slot"],
        "slot_name": best["slot_name"],
        "name": best["name"],
        "time": best["time"],
        "seconds_remaining": int((best["at"] - now).total_seconds()),
    }

# Serial port the Arduino is connected to. Override with ARDUINO_SERIAL_PORT
# if your machine uses a different device path.
SERIAL_PORT = os.environ.get("ARDUINO_SERIAL_PORT", "/dev/cu.usbmodem1101")
BAUD_RATE = 9600

app = FastAPI(title="Smart Medicine Management System")

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

serial_manager = SerialManager()


@app.on_event("startup")
def connect_on_startup():
    # Best-effort auto-connect. It's fine if the Arduino isn't plugged in
    # yet — /api/connect can be used to connect later.
    try:
        serial_manager.connect(SERIAL_PORT, BAUD_RATE)
    except Exception:
        pass


@app.on_event("startup")
async def start_scheduler():
    app.state.scheduler_task = asyncio.create_task(scheduler_loop())


@app.on_event("shutdown")
async def stop_scheduler():
    task = getattr(app.state, "scheduler_task", None)
    if task is not None:
        task.cancel()


@app.get("/")
def read_index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/status")
def get_status():
    return {
        "connected": serial_manager.is_connected(),
        "port": SERIAL_PORT,
    }


@app.post("/api/connect")
def connect_serial():
    try:
        serial_manager.connect(SERIAL_PORT, BAUD_RATE)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Could not connect: {error}")

    return {"status": "success", "message": f"Connected to {SERIAL_PORT}"}


@app.post("/api/disconnect")
def disconnect_serial():
    serial_manager.disconnect()
    return {"status": "success", "message": "Disconnected"}


@app.post("/api/trigger/{slot}")
def trigger_slot(slot: int):
    if slot not in SLOT_NAMES:
        raise HTTPException(status_code=404, detail="Unknown slot")

    try:
        result = trigger_slot_via_bridge(slot)
    except BridgeError as error:
        raise HTTPException(status_code=502, detail=f"Bridge failed: {error}")

    expected_reply = result["expected_reply"]

    return {
        "status": "success",
        "slot": slot,
        "slot_name": SLOT_NAMES[slot],
        "message": f"Slot {slot} reminder triggered via Tinkercad bridge ({expected_reply} confirmed)",
    }


@app.get("/api/schedules")
def get_schedules():
    schedules = schedule_store.load_schedules()
    next_schedule = _compute_next_schedule(schedules, datetime.now())
    return {"schedules": schedules, "next": next_schedule}


@app.put("/api/schedules/{slot}")
def update_schedule(slot: int, payload: ScheduleUpdate):
    if slot not in SLOT_NAMES:
        raise HTTPException(status_code=404, detail="Unknown slot")

    if not schedule_store.is_valid_time(payload.time):
        raise HTTPException(status_code=400, detail="Time must be in 24-hour HH:MM format")

    name = payload.name.strip()
    if payload.enabled and not name:
        raise HTTPException(status_code=400, detail="Medicine name is required when the schedule is enabled")

    updated = schedule_store.save_schedule(slot, name, payload.time, payload.enabled)

    return {
        "status": "success",
        "slot": slot,
        "schedule": updated,
        "message": f"Schedule saved for Slot {slot} ({SLOT_NAMES[slot]})",
    }


@app.get("/api/events")
def get_events(since: int = 0):
    return {"events": event_log.get_events_since(since), "count": event_log.total_events()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
