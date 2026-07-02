#include <Adafruit_LiquidCrystal.h>
#include <Servo.h>

Adafruit_LiquidCrystal lcd(0);
Servo slotServo;

const int SERVO_PIN = 9;
const int SLOT_1_ANGLE = 0;
const int SLOT_2_ANGLE = 60;
const int SLOT_3_ANGLE = 120;
const int SLOT_4_ANGLE = 180;

void openSlot(int slotNumber) {
  int angle;

  switch (slotNumber) {
    case 1:
      angle = SLOT_1_ANGLE;
      break;
    case 2:
      angle = SLOT_2_ANGLE;
      break;
    case 3:
      angle = SLOT_3_ANGLE;
      break;
    case 4:
      angle = SLOT_4_ANGLE;
      break;
    default:
      return;
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Opening Slot ");
  lcd.print(slotNumber);

  slotServo.write(angle);
  delay(2000);

  slotServo.write(90);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("SYSTEM READY");
}

void setup() {
  lcd.begin(16, 2);
  lcd.setBacklight(1);
  lcd.print("SYSTEM READY");

  slotServo.attach(SERVO_PIN);
  slotServo.write(90);
}

void loop() {
  openSlot(1);
  delay(2000);

  openSlot(2);
  delay(2000);

  openSlot(3);
  delay(2000);

  openSlot(4);
  delay(2000);
}
