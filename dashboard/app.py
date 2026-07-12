# Entry point for the Smart Medicine Management System dashboard.
# Serves the web frontend and exposes the API used by the dashboard page.

import sys
from pathlib import Path

# Ensure this file's own directory is importable regardless of how the
# app is launched (e.g. `uvicorn dashboard.app:app` from the repo root).
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from serial_manager import SerialManager
from bridge_runner import run_bridge_command, BridgeError

STATIC_DIR = Path(__file__).parent / "static"

SLOT_NAMES = {
    1: "Morning",
    2: "Noon",
    3: "Evening",
    4: "Night",
}

# Serial port the Arduino is connected to. Change this to match your machine.
SERIAL_PORT = "/dev/cu.usbmodem1101"
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

    command = f"OPEN_SLOT_{slot}"
    expected_reply = f"OK_SLOT_{slot}"

    try:
        output = run_bridge_command(command)
    except BridgeError as error:
        raise HTTPException(status_code=502, detail=f"Bridge failed: {error}")

    if expected_reply not in output:
        raise HTTPException(
            status_code=502,
            detail=f"Bridge ran but {expected_reply} was not confirmed by the Arduino.",
        )

    return {
        "status": "success",
        "slot": slot,
        "slot_name": SLOT_NAMES[slot],
        "message": f"Slot {slot} reminder triggered via Tinkercad bridge ({expected_reply} confirmed)",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
