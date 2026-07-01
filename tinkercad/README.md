# Tinkercad Circuit Simulation

This directory documents the Tinkercad circuit used to prototype and validate the Smart Medicine Management System wiring before physical assembly.

---

## Circuit Link

> **Add your Tinkercad simulation URL here once the circuit is created.**
>
> Format: `https://www.tinkercad.com/things/<your-project-id>`

---

## How to Open and Run

1. Open the link above in a browser (a free Tinkercad account is required).
2. Click **"Tinker this"** to open your own editable copy, or **"Simulate"** to run the original.
3. Use the **Serial Monitor** panel in the simulation to send and receive serial commands manually.

---

## Components in the Circuit

| Component | Quantity |
|---|---|
| Arduino Uno R3 | 1 |
| LCD 16x2 with I2C backpack (PCF8574) | 1 |
| Micro Servo (SG90) | 1 |
| LED — Red | 1 |
| LED — Yellow | 1 |
| LED — Green | 1 |
| Active Buzzer | 1 |
| 4x4 Keypad | 1 |
| Resistors (220Ω) | 3 |
| Breadboard | 1 |
| Jumper Wires | — |

> **Note:** No RTC module is included. Timekeeping is handled by the Python dashboard using the PC system clock.

---

## Pin Mapping

| Component | Arduino Pin |
|---|---|
| LCD SDA (I2C) | A4 |
| LCD SCL (I2C) | A5 |
| Servo Signal | D9 |
| LED — Red | D4 |
| LED — Yellow | D5 |
| LED — Green | D6 |
| Buzzer | D8 |
| Keypad — Row pins | D7, D6, D5, D4 _(confirm in circuit)_ |
| Keypad — Col pins | D3, D2, D1, D0 _(confirm in circuit)_ |

_Update the pin mapping above to match the final Tinkercad circuit once completed._

---

## Testing the Circuit in Simulation

1. Start the simulation.
2. Open the Serial Monitor.
3. Type a command (e.g. `OPEN_SLOT_1`) and press Send.
4. Verify that the servo moves, the correct LED turns on, and the LCD updates.
5. Type `CANCEL` and verify the buzzer and LEDs reset.

---

## Notes

- Tinkercad does not support all Arduino libraries. Test I2C LCD and servo behaviour on real hardware if simulation results differ.
- The keypad component in Tinkercad may require manual wiring — verify each row/column connection.
