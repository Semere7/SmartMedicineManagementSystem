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
const int SERVO_REST_ANGLE = 90;

const int LED_SLOT_1_PIN = 2;
const int LED_SLOT_2_PIN = 3;
const int LED_SLOT_3_PIN = 4;
const int LED_SLOT_4_PIN = 5;

const int BUZZER_PIN = 8;

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

const char CORRECT_PIN[5] = "1234";
const int PIN_LENGTH = 4;

char enteredPin[PIN_LENGTH + 1];
int pinIndex = 0;

const int MAX_PIN_ATTEMPTS = 3;
int failedAttempts = 0;

const unsigned long CONFIRMATION_TIMEOUT_MS = 10000;
unsigned long confirmationStartTime = 0;

enum SystemState {
  STATE_IDLE,
  STATE_REMINDER,
  STATE_WAITING_FOR_PIN,
  STATE_OPENING_SLOT,
  STATE_WAITING_CONFIRMATION
};

SystemState currentState = STATE_IDLE;
bool idleScreenShown = false;

int currentSlot = 1;

void turnOffAllLeds() {
  digitalWrite(LED_SLOT_1_PIN, LOW);
  digitalWrite(LED_SLOT_2_PIN, LOW);
  digitalWrite(LED_SLOT_3_PIN, LOW);
  digitalWrite(LED_SLOT_4_PIN, LOW);
}

void showActiveSlotLed(int slotNumber) {
  turnOffAllLeds();

  switch (slotNumber) {
    case 1:
      digitalWrite(LED_SLOT_1_PIN, HIGH);
      break;
    case 2:
      digitalWrite(LED_SLOT_2_PIN, HIGH);
      break;
    case 3:
      digitalWrite(LED_SLOT_3_PIN, HIGH);
      break;
    case 4:
      digitalWrite(LED_SLOT_4_PIN, HIGH);
      break;
  }
}

void playReminderSound() {
  for (int i = 0; i < 3; i++) {
    tone(BUZZER_PIN, 1200, 150);
    delay(200);
  }
  noTone(BUZZER_PIN);
}

void showEnterPinScreen() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ENTER PIN");
  lcd.setCursor(0, 1);
  lcd.print("----");
}

void resetPinInput() {
  pinIndex = 0;
  enteredPin[0] = '\0';
  showEnterPinScreen();
}

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
      angle = SLOT_1_ANGLE;
      break;
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Opening Slot ");
  lcd.print(slotNumber);

  showActiveSlotLed(slotNumber);

  slotServo.write(angle);
  delay(2000);

  slotServo.write(SERVO_REST_ANGLE);
}

void checkPin() {
  lcd.clear();

  if (strcmp(enteredPin, CORRECT_PIN) == 0) {
    lcd.setCursor(0, 0);
    lcd.print("ACCESS");
    lcd.setCursor(0, 1);
    lcd.print("GRANTED");
    delay(1000);

    failedAttempts = 0;
    currentState = STATE_OPENING_SLOT;
  } else {
    failedAttempts++;

    lcd.setCursor(0, 0);
    lcd.print("WRONG PIN");
    lcd.setCursor(0, 1);
    lcd.print("ATTEMPT ");
    lcd.print(failedAttempts);
    lcd.print("/3");
    delay(2000);

    if (failedAttempts >= MAX_PIN_ATTEMPTS) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("SYSTEM LOCKED");
      lcd.setCursor(0, 1);
      lcd.print("WAIT 10 SEC");
      delay(10000);

      failedAttempts = 0;
    }

    resetPinInput();
  }
}

void handleIdleState() {
  if (!idleScreenShown) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("SYSTEM READY");
    idleScreenShown = true;
  }

  delay(1000);
  currentState = STATE_REMINDER;
  idleScreenShown = false;
}

void handleReminderState() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("TIME FOR");
  lcd.setCursor(0, 1);
  lcd.print("MEDICINE");
  delay(2000);

  playReminderSound();

  resetPinInput();
  currentState = STATE_WAITING_FOR_PIN;
}

void handlePinState() {
  char key = keypad.getKey();

  if (key == NO_KEY) {
    return;
  }

  if (key < '0' || key > '9') {
    return;
  }

  if (pinIndex >= PIN_LENGTH) {
    return;
  }

  enteredPin[pinIndex] = key;
  pinIndex++;
  enteredPin[pinIndex] = '\0';

  lcd.setCursor(pinIndex - 1, 1);
  lcd.print("*");

  if (pinIndex == PIN_LENGTH) {
    checkPin();
  }
}

void handleOpeningState() {
  openSlot(currentSlot);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("PRESS #");

  confirmationStartTime = millis();
  currentState = STATE_WAITING_CONFIRMATION;
}

void handleConfirmationState() {
  char key = keypad.getKey();

  if (key == '#') {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("THANK YOU");
    delay(2000);

    turnOffAllLeds();
    currentSlot = (currentSlot % 4) + 1;
    currentState = STATE_IDLE;
    return;
  }

  if (millis() - confirmationStartTime >= CONFIRMATION_TIMEOUT_MS) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("MISSED DOSE");
    delay(2000);

    turnOffAllLeds();
    currentSlot = (currentSlot % 4) + 1;
    currentState = STATE_IDLE;
  }
}

void setup() {
  lcd.begin(16, 2);
  lcd.setBacklight(1);

  slotServo.attach(SERVO_PIN);
  slotServo.write(SERVO_REST_ANGLE);

  pinMode(LED_SLOT_1_PIN, OUTPUT);
  pinMode(LED_SLOT_2_PIN, OUTPUT);
  pinMode(LED_SLOT_3_PIN, OUTPUT);
  pinMode(LED_SLOT_4_PIN, OUTPUT);

  pinMode(BUZZER_PIN, OUTPUT);

  turnOffAllLeds();

  currentState = STATE_IDLE;
}

void loop() {
  switch (currentState) {
    case STATE_IDLE:
      handleIdleState();
      break;

    case STATE_REMINDER:
      handleReminderState();
      break;

    case STATE_WAITING_FOR_PIN:
      handlePinState();
      break;

    case STATE_OPENING_SLOT:
      handleOpeningState();
      break;

    case STATE_WAITING_CONFIRMATION:
      handleConfirmationState();
      break;
  }
}
