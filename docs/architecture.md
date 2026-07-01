# System Architecture — Smart Medicine Management System

## Overview

The system is split into two layers: an **embedded layer** running on Arduino Uno, and an **application layer** running as a Python desktop dashboard on a PC. The two layers communicate over a USB serial link.

**The PC is required for operation.** In this version, the Arduino does not make any timing or scheduling decisions — all schedule and time logic lives in the Python dashboard. The Arduino is a pure hardware executor: it receives commands and drives physical components.

```
┌─────────────────────────────────────────────────────────┐
│                   PC (Python Dashboard)                  │
│                                                         │
│   ┌──────────┐   ┌─────────────────┐   ┌───────────┐  │
│   │   gui.py │   │ serial_manager  │   │ scheduler │  │
│   │  (UI)    │◄──│   .py (USB)     │──►│   .py     │  │
│   └──────────┘   └────────┬────────┘   └───────────┘  │
│                            │  ▲                         │
│              Commands ─────┘  └───── Status responses  │
└────────────────────────────┼────────────────────────────┘
                             │ USB Serial (9600 baud)
                             │
┌────────────────────────────┼────────────────────────────┐
│                   Arduino Uno                            │
│                            │                            │
│   ┌──────────────────────────────────────────────────┐  │
│   │              smart_medicine_box.ino              │  │
│   │                                                  │  │
│   │  ┌──────────────────┐   ┌──────────────────────┐ │  │
│   │  │  Command Parser  │   │   Hardware Handler   │ │  │
│   │  │  (Serial input)  │──►│  (LCD, Servo, LEDs,  │ │  │
│   │  └──────────────────┘   │   Buzzer, Keypad)    │ │  │
│   │                         └──────────────────────┘ │  │
│   └──────────────────────────────────────────────────┘  │
│                                                         │
│   [ LCD ]  [ Servo ]  [ LED x3 ]  [ Buzzer ]  [ Keypad ]│
└─────────────────────────────────────────────────────────┘
```

---

## 1. Arduino Responsibilities

The Arduino Uno is the **hardware execution layer**. It does not manage time or schedules. It waits for commands from the Python dashboard, executes the corresponding hardware action, and sends back a status response.

| Responsibility | Description |
|---|---|
| Command parsing | Reads incoming commands from the Python dashboard over USB serial |
| LCD display | Shows slot status or confirmation messages as directed |
| Servo control | Opens the specified medication slot when commanded |
| LED indication | Drives LEDs to reflect current slot or action state |
| Buzzer | Sounds an alert when directed by the dashboard |
| Keypad input | Reads user input from the physical keypad and reports it over serial |
| Status reporting | Sends `CONFIRMED`, `CANCELLED`, or `SLOT_OPENED` back to the dashboard |

The Arduino does **not** keep time, does not store schedules, and does not trigger any action on its own. It only acts on commands received from the PC.

---

## 2. Python Dashboard Responsibilities

The Python dashboard is the **brain of the system**. It owns all scheduling, timing, and decision logic.

| Responsibility | Description |
|---|---|
| Schedule management | Allows the user to set, edit, and delete medication schedules with dose times |
| Timekeeping | Uses the PC system clock to determine when a dose is due |
| Command dispatch | Sends slot commands (`OPEN_SLOT_1`, `OPEN_SLOT_2`, etc.) to the Arduino at the right time |
| Status monitoring | Reads and displays status responses from the Arduino (`CONFIRMED`, `SLOT_OPENED`, etc.) |
| Notifications | Shows a desktop notification when a dose time is reached |
| Logging | Records each scheduled and confirmed dose event |
| GUI | Provides the interface for schedule configuration and live status display |

---

## 3. Serial Communication

USB serial is the **only data path** between the two layers. The Arduino executes what it receives and responds with a fixed status string.

### Commands — PC → Arduino

| Command | Action triggered on Arduino |
|---|---|
| `OPEN_SLOT_1` | Opens servo for slot 1, activates corresponding LED |
| `OPEN_SLOT_2` | Opens servo for slot 2, activates corresponding LED |
| `OPEN_SLOT_3` | Opens servo for slot 3, activates corresponding LED |
| `CANCEL` | Stops any active action, resets LEDs and buzzer |

### Responses — Arduino → PC

| Response | Meaning |
|---|---|
| `CONFIRMED` | Command was received and understood |
| `SLOT_OPENED` | Servo has completed the open action for the requested slot |
| `CANCELLED` | Active action was stopped successfully |

**Protocol rules:**
- Baud rate: **9600**
- Line terminator: **`\n`** (newline)
- All messages are plain ASCII text
- The Arduino responds to every received command
- The Python serial manager reads responses asynchronously in a background thread

---

## 4. Hardware Components

| Component | Interface | Role |
|---|---|---|
| Arduino Uno | — | Main microcontroller |
| LCD Display (16x2) | I2C (via PCF8574 backpack) | Shows slot status and confirmation messages |
| Servo Motor (SG90) | PWM (Digital pin) | Opens the medication compartment for the active slot |
| LED — Red | Digital pin | Indicates a missed or cancelled dose |
| LED — Yellow | Digital pin | Indicates an active/pending dose |
| LED — Green | Digital pin | Indicates a successfully dispensed dose |
| Buzzer (active) | Digital pin | Audible alert when a dose action is triggered |
| Keypad (4x4) | Digital pins | Local user input on the device |

> **Note:** No RTC module is used in this version. All timekeeping is handled by the PC system clock via the Python dashboard.

---

## 5. Software Modules

### Arduino (`arduino/smart_medicine_box.ino`)

| Section | Role |
|---|---|
| Setup | Initialises serial port, LCD, servo, LEDs, buzzer, and keypad pins |
| Main loop | Polls for incoming serial commands and reads keypad input |
| Command parser | Parses command strings and routes to the correct hardware handler |
| Hardware handler | Executes the physical action (servo, LEDs, buzzer, LCD update) |
| Status reporter | Sends `CONFIRMED`, `SLOT_OPENED`, or `CANCELLED` back over serial |

### Python Dashboard (`dashboard/`)

| Module | Role |
|---|---|
| `app.py` | Entry point; initialises all modules and starts the GUI main loop |
| `gui.py` | Builds the window, schedule forms, and status display; connects UI events to logic |
| `serial_manager.py` | Opens the serial port, sends commands, reads responses in a background thread |
| `scheduler.py` | Stores the medication schedule; compares dose times to the PC clock; dispatches commands |

---

## Data Flow — Typical Dose Cycle

```
1. User sets a dose schedule (slot + time) in gui.py
        │
        ▼
2. scheduler.py stores the entry and polls the PC system clock
        │
        ▼
3. At dose time, scheduler.py calls serial_manager.py
        │
        ▼
4. serial_manager.py sends "OPEN_SLOT_1\n" to Arduino over USB
        │
        ▼
5. Arduino command parser receives the command
        │
        ▼
6. Hardware handler: servo opens slot 1, yellow LED on, buzzer sounds, LCD updates
        │
        ▼
7. Arduino sends "SLOT_OPENED\n" back over serial
        │
        ▼
8. serial_manager.py receives response → notifies gui.py
        │
        ▼
9. gui.py updates status display; desktop notification shown
        │
        ▼
10. scheduler.py logs the event with timestamp
```
