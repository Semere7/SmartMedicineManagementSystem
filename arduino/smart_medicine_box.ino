#include <Adafruit_LiquidCrystal.h>
#include <Servo.h>
#include <Keypad.h>

Adafruit_LiquidCrystal lcd(0);
Servo slotServo;

const int SERVO_PIN = 9;
const int SLOT_1_ANGLE = 0;
const int SLOT_2_ANGLE = 60;
const int SLOT_3_ANGLE = 120;
const int SLOT_4_ANGLE = 180;

// Keypad setup (4x4)
const byte KEYPAD_ROWS = 4;
const byte KEYPAD_COLS = 4;

char keys[KEYPAD_ROWS][KEYPAD_COLS] = {
  {'1', '2', '3', 'A'},
  {'4', '5', '6', 'B'},
  {'7', '8', '9', 'C'},
  {'*', '0', '#', 'D'}
};

byte rowPins[KEYPAD_ROWS] = {10, 11, 12, 13};
byte colPins[KEYPAD_COLS] = {A0, A1, A2, A3};

Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, KEYPAD_ROWS, KEYPAD_COLS);

// PIN authentication state
const char CORRECT_PIN[5] = "1234";
const int PIN_LENGTH = 4;

char enteredPin[PIN_LENGTH + 1];
int pinIndex = 0;

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

// Shows the PIN entry prompt on the LCD
void showEnterPinScreen() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ENTER PIN");
}

// Clears the entered PIN buffer and returns to the entry screen
void resetPinInput() {
  pinIndex = 0;
  enteredPin[0] = '\0';
  showEnterPinScreen();
}

// Compares the entered PIN against the correct PIN and shows the result
void checkPin() {
  lcd.clear();
  lcd.setCursor(0, 0);

  if (strcmp(enteredPin, CORRECT_PIN) == 0) {
    lcd.print("ACCESS");
    lcd.setCursor(0, 1);
    lcd.print("GRANTED");
    delay(1000);

    openSlot(1);
  } else {
    lcd.print("WRONG PIN");
    delay(2000);
  }

  resetPinInput();
}

// Reads keypad presses and builds up the entered PIN one digit at a time
void handleKeypadInput() {
  char key = keypad.getKey();

  if (key == NO_KEY) {
    return;
  }

  // Only accept digit keys for the PIN
  if (key < '0' || key > '9') {
    return;
  }

  enteredPin[pinIndex] = key;
  pinIndex++;
  enteredPin[pinIndex] = '\0';

  // Show one "*" per digit typed so far
  lcd.setCursor(pinIndex - 1, 1);
  lcd.print("*");

  if (pinIndex == PIN_LENGTH) {
    checkPin();
  }
}

void setup() {
  lcd.begin(16, 2);
  lcd.setBacklight(1);

  slotServo.attach(SERVO_PIN);
  slotServo.write(90);

  resetPinInput();
}

void loop() {
  handleKeypadInput();
}
