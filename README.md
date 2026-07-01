# Smart Medicine Management System

A university Embedded Software Development final project that combines an Arduino Uno hardware controller with a Python desktop dashboard to automate medication reminders and dispensing.

---

## Project Overview

The system uses an Arduino Uno to control physical hardware (LEDs, buzzer, servo motor) and a Python dashboard running on a PC to schedule reminders, monitor status, and communicate with the Arduino over USB serial.

---

## Repository Structure

```
SmartMedicineManagementSystem/
│
├── arduino/
│   └── smart_medicine_box.ino   # Arduino firmware
│
├── dashboard/
│   ├── app.py                   # Dashboard entry point
│   ├── gui.py                   # GUI layout and widgets
│   ├── serial_manager.py        # Arduino serial communication
│   ├── scheduler.py             # Medication reminder scheduler
│   └── requirements.txt         # Python dependencies
│
├── docs/
│   ├── report.md                # Written project report
│   ├── presentation.md          # Presentation outline
│   └── architecture.md          # System architecture
│
├── images/                      # Screenshots and diagrams
├── tinkercad/                   # Circuit simulation info
│   └── README.md
│
├── README.md
├── LICENSE
└── .gitignore
```

---

## Hardware Components

| Component | Purpose |
|---|---|
| Arduino Uno | Main microcontroller |
| Servo Motor | Dispenses medication compartment |
| LED (x3) | Visual reminder indicators |
| Buzzer | Audible alarm |
| LCD Display | Shows current time and status |
| RTC Module (DS1307) | Keeps real-time clock |

---

## Getting Started

### 1. Flash the Arduino

1. Open `arduino/smart_medicine_box.ino` in the Arduino IDE.
2. Connect the Arduino Uno via USB.
3. Select the correct board and port under **Tools**.
4. Click **Upload**.

### 2. Run the Python Dashboard

```bash
cd dashboard
pip install -r requirements.txt
python app.py
```

### 3. Tinkercad Simulation

See `tinkercad/README.md` for the circuit simulation link and instructions.

---

## Dependencies

- **Arduino IDE** 2.x
- **Python** 3.10+
- See `dashboard/requirements.txt` for Python packages

---

## Authors

- Semere

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
