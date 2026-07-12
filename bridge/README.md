# Tinkercad Puppeteer Bridge

Drives the Tinkercad Serial Monitor to trigger and confirm medicine-slot
reminders on the simulated Arduino, invoked by the dashboard backend
(`dashboard/bridge_runner.py`) or directly from the command line.

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
URL. `TINKERCAD_PROJECT_ID` / `TINKERCAD_PROJECT_TITLE` are optional overrides
for which open tab the bridge selects; leave them unset to use this repo's
reference circuit.

## Run

```
node tinkercad_bridge.js OPEN_SLOT_1
```

(or `OPEN_SLOT_2` / `OPEN_SLOT_3` / `OPEN_SLOT_4`)

This launches/reuses a visible Chrome window (via a persistent profile in
`bridge/browser-profile/`, so you only need to log in to Tinkercad once),
selects the matching project tab, starts the simulation if it isn't already
running, opens the Serial Monitor, sends the command, waits for the matching
`OK_SLOT_X` confirmation (retrying once on `UNKNOWN_COMMAND`), then waits up
to 120 seconds for `DOSE_TAKEN` or `MISSED_DOSE`. If the bridge itself started
the simulation, it stops it again at the end; if the simulation was already
running, it's left running.

## Notes

- `bridge/browser-profile/` and `bridge/.env` are gitignored — never commit
  them, since the profile can contain your logged-in Tinkercad session.
