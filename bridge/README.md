# Tinkercad Puppeteer Bridge (Prototype)

Verifies whether Puppeteer can drive the Tinkercad browser UI, as a first step
toward automating the Tinkercad Serial Monitor. This prototype only opens the
project and lists the page's frames — it does not type into anything yet.

## Install

```
cd bridge
npm install
```

## Configure

```
cp .env.example .env
```

Edit `bridge/.env` and set `TINKERCAD_URL` to your Tinkercad project's editor
URL.

## Run

```
npm start
```

This launches a visible Chrome window using a persistent profile stored in
`bridge/browser-profile/`, so you only need to log in to Tinkercad once. The
script navigates to `TINKERCAD_URL`, waits for the page to load, prints every
frame's name and URL, then leaves the browser open for manual inspection.
Close the browser window (or Ctrl+C the script) to exit.

## Notes

- `bridge/browser-profile/` and `bridge/.env` are gitignored — never commit
  them, since the profile can contain your logged-in Tinkercad session.
- This is a prototype only. Typing into the Serial Monitor is a follow-up step.
