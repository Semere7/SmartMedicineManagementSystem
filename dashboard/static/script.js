const timeElement = document.getElementById("current-time");
const statusElement = document.getElementById("system-status");
const eventLog = document.getElementById("event-log");
const nextScheduleElement = document.getElementById("next-schedule");

const SCHEDULE_POLL_MS = 15000;
const EVENT_POLL_MS = 5000;

let lastEventCount = 0;
let nextSchedule = null; // { slot, slot_name, name, time, seconds_remaining } or null

function updateClock() {
  const now = new Date();
  timeElement.textContent = now.toLocaleTimeString();

  if (nextSchedule) {
    nextSchedule.seconds_remaining = Math.max(0, nextSchedule.seconds_remaining - 1);
    renderNextSchedule();
  }
}

function logEvent(message) {
  const entry = document.createElement("li");
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  eventLog.appendChild(entry);
  eventLog.scrollTop = eventLog.scrollHeight;
}

function formatRemaining(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function renderNextSchedule() {
  if (!nextSchedule) {
    nextScheduleElement.textContent = "Next scheduled medicine: none";
    return;
  }

  const label = nextSchedule.name ? nextSchedule.name : "(unnamed)";
  nextScheduleElement.textContent =
    `Next scheduled medicine: Slot ${nextSchedule.slot} (${nextSchedule.slot_name}) — ${label} ` +
    `at ${nextSchedule.time} — in ${formatRemaining(nextSchedule.seconds_remaining)}`;
}

function renderScheduleCard(slot, schedule) {
  const nameInput = document.querySelector(`.schedule-name[data-slot="${slot}"]`);
  const timeInput = document.querySelector(`.schedule-time[data-slot="${slot}"]`);
  const enabledInput = document.querySelector(`.schedule-enabled[data-slot="${slot}"]`);
  const currentDisplay = document.querySelector(`.schedule-current[data-slot="${slot}"]`);

  nameInput.value = schedule.name || "";
  timeInput.value = schedule.time || "";
  enabledInput.checked = !!schedule.enabled;

  if (schedule.name && schedule.time) {
    currentDisplay.textContent = `Saved: ${schedule.name} at ${schedule.time} (${schedule.enabled ? "Enabled" : "Disabled"})`;
  } else {
    currentDisplay.textContent = "No schedule saved";
  }
}

async function refreshStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    statusElement.textContent = data.connected
      ? `Status: Connected to ${data.port}`
      : `Status: Not connected (${data.port})`;
  } catch (error) {
    statusElement.textContent = "Status: Unable to reach server";
  }
}

async function refreshSchedules() {
  try {
    const response = await fetch("/api/schedules");
    const data = await response.json();

    Object.entries(data.schedules).forEach(([slot, schedule]) => {
      renderScheduleCard(slot, schedule);
    });

    nextSchedule = data.next;
    renderNextSchedule();
  } catch (error) {
    // Leave existing schedule display as-is if the server is unreachable.
  }
}

async function saveSchedule(slot) {
  const nameInput = document.querySelector(`.schedule-name[data-slot="${slot}"]`);
  const timeInput = document.querySelector(`.schedule-time[data-slot="${slot}"]`);
  const enabledInput = document.querySelector(`.schedule-enabled[data-slot="${slot}"]`);

  const payload = {
    name: nameInput.value,
    time: timeInput.value,
    enabled: enabledInput.checked,
  };

  try {
    const response = await fetch(`/api/schedules/${slot}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (response.ok) {
      renderScheduleCard(slot, data.schedule);
      logEvent(data.message);
      await refreshSchedules();
    } else {
      const errorMessage = data.detail || "Unknown error";
      logEvent(`Error saving schedule for slot ${slot}: ${errorMessage}`);
    }
  } catch (error) {
    logEvent(`Failed to save schedule for slot ${slot}`);
  }
}

async function pollEvents() {
  try {
    const response = await fetch(`/api/events?since=${lastEventCount}`);
    const data = await response.json();

    data.events.forEach((event) => logEvent(event.message));
    lastEventCount = data.count;
  } catch (error) {
    // Ignore transient polling failures.
  }
}

async function triggerSlot(slot) {
  try {
    const response = await fetch(`/api/trigger/${slot}`, { method: "POST" });
    const data = await response.json();

    if (response.ok) {
      statusElement.textContent = `Status: ${data.message}`;
      logEvent(data.message);
    } else {
      const errorMessage = data.detail || "Unknown error";
      statusElement.textContent = `Status: Error - ${errorMessage}`;
      logEvent(`Error triggering slot ${slot}: ${errorMessage}`);
    }
  } catch (error) {
    statusElement.textContent = "Status: Error contacting server";
    logEvent(`Failed to trigger slot ${slot}`);
  }
}

document.querySelectorAll(".trigger-button").forEach((button) => {
  button.addEventListener("click", () => {
    const slot = button.dataset.slot;
    triggerSlot(slot);
  });
});

document.querySelectorAll(".schedule-save-button").forEach((button) => {
  button.addEventListener("click", () => {
    const slot = button.dataset.slot;
    saveSchedule(slot);
  });
});

updateClock();
setInterval(updateClock, 1000);

refreshStatus();
refreshSchedules();

setInterval(refreshSchedules, SCHEDULE_POLL_MS);
setInterval(pollEvents, EVENT_POLL_MS);
