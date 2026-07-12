# Background scheduler: checks configured medicine schedules against the
# local system clock and automatically triggers the Tinkercad bridge for
# any enabled slot whose time matches, once per calendar day.

import asyncio
import traceback
from datetime import datetime

import schedule_store
import event_log
from bridge_runner import trigger_slot_via_bridge, BridgeError

CHECK_INTERVAL_SECONDS = 15

SLOT_NAMES = {1: "Morning", 2: "Noon", 3: "Evening", 4: "Night"}


async def check_and_trigger_due_schedules(now: datetime = None) -> None:
    now = now or datetime.now()
    current_hhmm = now.strftime("%H:%M")
    today_str = now.strftime("%Y-%m-%d")

    print(f"[scheduler] Check at local time {now.isoformat(timespec='seconds')} (HH:MM={current_hhmm}, date={today_str})")

    schedules = schedule_store.load_schedules()

    for slot_str, entry in schedules.items():
        slot = int(slot_str)
        slot_name = SLOT_NAMES.get(slot, str(slot))
        enabled = entry.get("enabled")
        sched_time = entry.get("time")
        last_triggered = entry.get("last_triggered_date")

        print(
            f"[scheduler]   Slot {slot} ({slot_name}): enabled={enabled} time={sched_time} "
            f"last_triggered_date={last_triggered}"
        )

        if not enabled:
            continue

        matches = sched_time == current_hhmm
        print(f"[scheduler]     HH:MM match ({current_hhmm}): {matches}")
        if not matches:
            continue

        already_triggered = last_triggered == today_str
        print(f"[scheduler]     Already triggered today ({today_str}): {already_triggered}")
        if already_triggered:
            continue

        medicine_name = entry.get("name") or f"Slot {slot}"
        print(f"[scheduler]     Starting automatic trigger for Slot {slot} ({slot_name}, {medicine_name})...")

        try:
            result = await asyncio.to_thread(trigger_slot_via_bridge, slot)
        except BridgeError as error:
            print(f"[scheduler]     Automatic trigger FAILED before OK_SLOT_{slot} was confirmed: {error}")
            event_log.add_event(
                f"Automatic reminder FAILED for Slot {slot} ({slot_name}, {medicine_name}) "
                f"at {current_hhmm}: {error}"
            )
            # OK_SLOT_X was never confirmed, so do NOT mark this slot as
            # triggered today — allow another attempt on the next check
            # during the same minute.
            continue

        # trigger_slot_via_bridge only returns (rather than raising) once
        # OK_SLOT_X has been confirmed, so the automatic trigger has
        # "started successfully" and it's now safe to record it as done
        # for today — this happens after, never before, the bridge call.
        schedule_store.mark_triggered(slot, today_str)

        dose_status = result.get("dose_status")
        if dose_status == "taken":
            outcome_text = "DOSE_TAKEN"
        elif dose_status == "missed":
            outcome_text = "MISSED_DOSE"
        else:
            outcome_text = "no DOSE_TAKEN/MISSED_DOSE received (timed out)"

        print(f"[scheduler]     Automatic trigger SUCCEEDED for Slot {slot}. Outcome: {outcome_text}")

        event_log.add_event(
            f"Automatic reminder triggered for Slot {slot} ({slot_name}, {medicine_name}) "
            f"at {current_hhmm} — {result['expected_reply']} confirmed, outcome: {outcome_text}"
        )


async def scheduler_loop() -> None:
    print("[scheduler] Scheduler started.")
    event_log.add_event("Scheduler started")

    while True:
        try:
            await check_and_trigger_due_schedules()
        except Exception:
            trace = traceback.format_exc()
            print("[scheduler] Unhandled exception in scheduler iteration:")
            print(trace)
            event_log.add_event(f"Scheduler error: {trace}")

        await asyncio.sleep(CHECK_INTERVAL_SECONDS)
