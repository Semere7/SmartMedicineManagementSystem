# Project Report — Smart Medicine Management System

**Course:** Embedded Software Development  
**Student:** Semere  
**Date:** 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Problem Statement](#2-problem-statement)
3. [System Requirements](#3-system-requirements)
4. [System Design and Architecture](#4-system-design-and-architecture)
5. [Hardware Implementation](#5-hardware-implementation)
6. [Software Implementation](#6-software-implementation)
7. [Serial Communication Protocol](#7-serial-communication-protocol)
8. [Testing and Results](#8-testing-and-results)
9. [Challenges and Solutions](#9-challenges-and-solutions)
10. [Conclusion](#10-conclusion)
11. [References](#11-references)

---

## 1. Introduction

_Provide a brief overview of the project: what it is, what it does, and why it was built. State that it combines an Arduino Uno hardware controller with a Python desktop dashboard connected via USB serial._

---

## 2. Problem Statement

_Describe the problem: patients — especially elderly or those managing chronic conditions — frequently miss medication doses. Manual pill organisers provide no reminders or automation. Explain how this system addresses that gap._

---

## 3. System Requirements

### Functional Requirements

- The system shall alert the user at scheduled medication times via a buzzer, LEDs, and a desktop notification.
- The system shall open the correct medication slot (servo) when a dose is due.
- The user shall be able to configure dose schedules (slot number and time) via the Python dashboard.
- The Arduino shall display current status on the LCD when commanded.
- The Arduino shall accept keypad input from the user on the device.

### Non-Functional Requirements

- The system shall require a PC connection to operate (no standalone mode in v1).
- All serial messages shall be plain ASCII text terminated by a newline.
- The Python dashboard shall run on Windows, macOS, and Linux.
- The serial baud rate shall be 9600.

---

## 4. System Design and Architecture

_Summarise the two-layer design described in `architecture.md`. The Python dashboard owns all scheduling and timekeeping using the PC system clock. The Arduino is a hardware executor: it receives commands and drives physical components, then reports back a status string._

_Include or reference the architecture diagram from `architecture.md`._

---

## 5. Hardware Implementation

_Describe each component, how it is wired, and its role in the system. Reference the Tinkercad circuit for the wiring diagram._

### Components Used

| Component | Quantity | Purpose |
|---|---|---|
| Arduino Uno | 1 | Main microcontroller |
| LCD 16x2 (I2C) | 1 | Displays slot status and confirmation messages |
| Servo SG90 | 1 | Opens the medication compartment for the active slot |
| LED — Red | 1 | Indicates a missed or cancelled dose |
| LED — Yellow | 1 | Indicates an active or pending dose |
| LED — Green | 1 | Indicates a successfully dispensed dose |
| Active Buzzer | 1 | Audible alert at dose time |
| 4x4 Keypad | 1 | Local user input on the device |

_Note: No RTC module is used. Timekeeping is handled entirely by the PC system clock._

### Pin Mapping

_Document the final pin assignments once confirmed in Tinkercad._

---

## 6. Software Implementation

### Arduino Firmware (`smart_medicine_box.ino`)

_Describe the firmware structure: setup routine, main loop, command parser, hardware handler, and status reporter. Explain how the Arduino waits for serial commands and responds with fixed status strings._

### Python Dashboard

_Describe each module and its role:_

- **`app.py`** — _Entry point. Initialises all modules and starts the GUI main loop._
- **`gui.py`** — _GUI window, schedule forms, and status display._
- **`serial_manager.py`** — _Opens serial port, sends commands, reads responses in a background thread._
- **`scheduler.py`** — _Stores dose schedules, compares times against PC clock, dispatches commands._

---

## 7. Serial Communication Protocol

_Document the full command and response set used between the dashboard and the Arduino._

### Commands (PC → Arduino)

| Command | Effect |
|---|---|
| `OPEN_SLOT_1` | Opens servo for slot 1, activates yellow LED, sounds buzzer |
| `OPEN_SLOT_2` | Opens servo for slot 2, activates yellow LED, sounds buzzer |
| `OPEN_SLOT_3` | Opens servo for slot 3, activates yellow LED, sounds buzzer |
| `CANCEL` | Stops active action, resets LEDs and buzzer |

### Responses (Arduino → PC)

| Response | Meaning |
|---|---|
| `CONFIRMED` | Command received and understood |
| `SLOT_OPENED` | Servo completed the open action for the requested slot |
| `CANCELLED` | Active action stopped successfully |

_Protocol: 9600 baud, newline-terminated ASCII, one response per command._

---

## 8. Testing and Results

_Describe how the system was tested, including Tinkercad simulation and physical hardware testing._

| Test Case | Expected Result | Actual Result | Pass / Fail |
|---|---|---|---|
| Dashboard sends `OPEN_SLOT_1` | Servo opens, yellow LED on, buzzer sounds | | |
| Arduino responds after slot open | `SLOT_OPENED` received by dashboard | | |
| Dashboard sends `CANCEL` | Buzzer off, LEDs reset | | |
| Dose time reached (scheduler) | Command dispatched automatically | | |
| Desktop notification shown | Notification appears at dose time | | |

---

## 9. Challenges and Solutions

_Describe technical difficulties encountered during the project and how each was resolved. Examples: serial timing issues, servo calibration, scheduler accuracy, GUI threading._

---

## 10. Conclusion

_Summarise what was built and demonstrated. Reflect on what was learned. Suggest potential improvements for a future version, such as standalone operation with an RTC, wireless communication, a mobile app, or support for more medication slots._

---

## 11. References

- Arduino Reference: https://www.arduino.cc/reference/en/
- pyserial Documentation: https://pyserial.readthedocs.io/
- schedule Library: https://schedule.readthedocs.io/
- Tinkercad Circuit Simulation: _(add link)_
