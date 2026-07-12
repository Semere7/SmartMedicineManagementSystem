# Invokes the Puppeteer Tinkercad bridge script as a subprocess and reports
# whether the Arduino confirmed the requested slot command.

import subprocess
from pathlib import Path

BRIDGE_DIR = Path(__file__).parent.parent / "bridge"
BRIDGE_SCRIPT = BRIDGE_DIR / "tinkercad_bridge.js"
BRIDGE_TIMEOUT_SECONDS = 150

VALID_COMMANDS = {"OPEN_SLOT_1", "OPEN_SLOT_2", "OPEN_SLOT_3", "OPEN_SLOT_4"}


class BridgeError(Exception):
    pass


def run_bridge_command(command: str) -> str:
    if command not in VALID_COMMANDS:
        raise BridgeError(f"Invalid bridge command: {command}")

    try:
        result = subprocess.run(
            ["node", str(BRIDGE_SCRIPT), command],
            cwd=BRIDGE_DIR,
            capture_output=True,
            text=True,
            timeout=BRIDGE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as error:
        raise BridgeError(f"Bridge script timed out after {BRIDGE_TIMEOUT_SECONDS}s: {error}")
    except FileNotFoundError as error:
        raise BridgeError(f"Could not run bridge script: {error}")

    output = f"{result.stdout}\n{result.stderr}"

    if result.returncode != 0:
        raise BridgeError(f"Bridge script exited with code {result.returncode}:\n{output}")

    return output


def trigger_slot_via_bridge(slot: int) -> dict:
    command = f"OPEN_SLOT_{slot}"
    expected_reply = f"OK_SLOT_{slot}"

    output = run_bridge_command(command)

    if expected_reply not in output:
        raise BridgeError(f"Bridge ran but {expected_reply} was not confirmed by the Arduino.")

    if "DOSE_TAKEN" in output:
        dose_status = "taken"
    elif "MISSED_DOSE" in output:
        dose_status = "missed"
    else:
        dose_status = None

    return {"expected_reply": expected_reply, "output": output, "dose_status": dose_status}
