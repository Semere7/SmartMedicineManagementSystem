# Manages the USB serial connection to the Arduino.
# Sends commands and reads status responses in a background thread.

import serial


class SerialManager:
    def __init__(self):
        self._serial = None

    def connect(self, port, baudrate=9600):
        self._serial = serial.Serial(port, baudrate, timeout=1)

    def disconnect(self):
        if self._serial is not None and self._serial.is_open:
            self._serial.close()
        self._serial = None

    def send_command(self, command):
        if not self.is_connected():
            raise ConnectionError("Serial port is not connected")
        self._serial.write(f"{command}\n".encode())

    def is_connected(self):
        return self._serial is not None and self._serial.is_open
