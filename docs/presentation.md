# Presentation Outline — Smart Medicine Management System

**Course:** Embedded Software Development  
**Student:** Semere  
**Suggested Duration:** ~10 minutes

---

## Slide 1 — Title

- Project title: Smart Medicine Management System
- Student name, course, academic year

---

## Slide 2 — Problem Statement

- Patients frequently miss medication doses, especially without reminders.
- Elderly and chronic-illness patients are most at risk.
- Manual pill organisers provide no automation or alerts.

---

## Slide 3 — Proposed Solution

- Automated medication slot system controlled by Arduino Uno.
- Python desktop dashboard manages schedules using the PC system clock.
- USB serial link connects the hardware and software layers.
- User interacts via both the dashboard GUI and an on-device keypad.

---

## Slide 4 — System Architecture

- Two-layer design: Python dashboard (brain) + Arduino (hardware executor).
- Arduino does not make any timing decisions — it only executes commands.
- Include architecture diagram from `docs/architecture.md`.

---

## Slide 5 — Hardware Components

- Arduino Uno, LCD 16x2 (I2C), Servo SG90, 3x LEDs, Buzzer, 4x4 Keypad.
- Show Tinkercad circuit screenshot or wiring diagram.
- Note: no RTC module — timekeeping is handled by the PC.

---

## Slide 6 — Arduino Firmware

- Waits for serial commands from the dashboard.
- Parses command string and executes the hardware action.
- Sends back `CONFIRMED`, `SLOT_OPENED`, or `CANCELLED`.
- Does not initiate any action on its own.

---

## Slide 7 — Python Dashboard

- `scheduler.py` watches the PC clock and dispatches commands at dose time.
- `serial_manager.py` handles USB communication in a background thread.
- `gui.py` displays schedule and live Arduino status.
- Desktop notification shown to the user when a dose is due.

---

## Slide 8 — Serial Communication Protocol

- Baud rate: 9600, plain ASCII, newline-terminated.
- Commands: `OPEN_SLOT_1`, `OPEN_SLOT_2`, `OPEN_SLOT_3`, `CANCEL`.
- Responses: `CONFIRMED`, `SLOT_OPENED`, `CANCELLED`.
- Show a brief example of a full command-response exchange.

---

## Slide 9 — Tinkercad Simulation

- Show screenshot of the Tinkercad circuit.
- Demonstrate or describe the simulation run.
- Highlight any behaviour validated in simulation before hardware testing.

---

## Slide 10 — Testing and Results

- List test cases and outcomes (from `docs/report.md` §8).
- Highlight pass/fail results.
- Note any deviations from expected behaviour and how they were resolved.

---

## Slide 11 — Challenges and Lessons Learned

- Describe one or two key technical challenges encountered.
- Explain how each was solved.
- Reflect briefly on what was learned about embedded systems development.

---

## Slide 12 — Conclusion and Future Work

- Summary: what was built, demonstrated, and verified.
- Future improvements: standalone RTC mode, wireless communication, mobile app, more slots.

---

## Slide 13 — Q&A

- Thank the audience.
- Invite questions.
