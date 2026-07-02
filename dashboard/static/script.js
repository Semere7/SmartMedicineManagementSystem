const timeElement = document.getElementById("current-time");
const statusElement = document.getElementById("system-status");
const eventLog = document.getElementById("event-log");

function updateClock() {
  const now = new Date();
  timeElement.textContent = now.toLocaleTimeString();
}

function logEvent(message) {
  const entry = document.createElement("li");
  const timestamp = new Date().toLocaleTimeString();
  entry.textContent = `[${timestamp}] ${message}`;
  eventLog.appendChild(entry);
  eventLog.scrollTop = eventLog.scrollHeight;
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

updateClock();
setInterval(updateClock, 1000);

refreshStatus();
