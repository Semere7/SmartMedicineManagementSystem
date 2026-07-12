require('dotenv').config();
const puppeteer = require('puppeteer');

const BROWSER_URL = 'http://127.0.0.1:9222';
// Identifies which open Tinkercad tab to drive. Override via .env for a
// different project; these defaults match this repo's reference circuit.
const PROJECT_URL_MATCH = process.env.TINKERCAD_PROJECT_ID || '8XVYPMMFUnn';
const PROJECT_TITLE_MATCH = process.env.TINKERCAD_PROJECT_TITLE || 'Smooth Lappi-Duup';

const START_SIMULATION_SELECTORS = ['#SIMULATION_ID', '.js-toggleSimulation', '[data-event="simulate"]'];
const SERIAL_MONITOR_SELECTORS = ['#SERIAL_MONITOR_ID', '.js-toggle_serial_monitor', '[data-event="serial-monitor"]'];

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

const DOSE_WAIT_TIMEOUT_MS = 120000;
const DOSE_POLL_INTERVAL_MS = 2000;

const VALID_COMMANDS = ['OPEN_SLOT_1', 'OPEN_SLOT_2', 'OPEN_SLOT_3', 'OPEN_SLOT_4'];
const requestedCommand = process.argv[2];

if (!VALID_COMMANDS.includes(requestedCommand)) {
  console.error(
    `[bridge] Invalid or missing command. Expected one of: ${VALID_COMMANDS.join(', ')}. Got: ${JSON.stringify(requestedCommand)}`
  );
  process.exit(1);
}

const expectedReply = requestedCommand.replace('OPEN_SLOT_', 'OK_SLOT_');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSimulationLabel(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.js-simulation-text');
    return el ? el.textContent.trim() : '';
  });
}

async function clickViaEvaluate(page, selectors) {
  return page.evaluate((sels) => {
    for (const selector of sels) {
      const el = document.querySelector(selector);
      if (el) {
        el.click();
        return selector;
      }
    }
    return null;
  }, selectors);
}

// Polls the simulation button text until it equals targetLabel or the
// timeout elapses. Used both when waiting for "Stop Simulation" after
// starting, and "Start Simulation" after stopping.
async function waitForSimulationLabel(page, targetLabel) {
  let currentLabel = await getSimulationLabel(page);

  if (currentLabel === targetLabel) {
    return true;
  }

  console.log(`[bridge] Polling simulation button text every ${POLL_INTERVAL_MS}ms for up to ${POLL_TIMEOUT_MS}ms (waiting for "${targetLabel}")...`);
  const maxAttempts = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await delay(POLL_INTERVAL_MS);
    currentLabel = await getSimulationLabel(page);
    console.log(`[bridge] Poll ${attempt}/${maxAttempts}: button text = "${currentLabel}"`);

    if (currentLabel === targetLabel) {
      return true;
    }
  }

  console.log(`[bridge] Timed out waiting for "${targetLabel}". Final button text: "${currentLabel}"`);
  return false;
}

// Runs inside the page context. Walks the DOM (including shadow roots)
// looking for visible input/textarea elements, contenteditable="true"
// elements, and the serial-send button.
function findVisibleSerialControls() {
  const results = [];

  function isVisible(el) {
    if (!el.getClientRects) return false;
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function isContentEditableTrue(el) {
    return !!(el.getAttribute && el.getAttribute('contenteditable') === 'true');
  }

  function isSendButton(el) {
    return !!(el.getAttribute && el.getAttribute('data-event') === 'serial-send');
  }

  function collect(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';

    if ((tag === 'input' || tag === 'textarea' || isContentEditableTrue(el) || isSendButton(el)) && isVisible(el)) {
      const className = typeof el.className === 'string' ? el.className : '';
      results.push({
        tag,
        id: el.id || '',
        className,
        placeholder: el.getAttribute ? el.getAttribute('placeholder') || '' : '',
        ariaLabel: el.getAttribute ? el.getAttribute('aria-label') || '' : '',
        dataEvent: el.getAttribute ? el.getAttribute('data-event') || '' : '',
        disabled: !!el.disabled || el.getAttribute('aria-disabled') === 'true' || className.includes('disabled'),
        insideSerialPanel: !!(el.closest && el.closest('.code_panel__serial')),
      });
    }

    const children = el.children ? Array.from(el.children) : [];
    for (const child of children) {
      collect(child);
    }

    if (el.shadowRoot) {
      const shadowChildren = Array.from(el.shadowRoot.children || []);
      for (const child of shadowChildren) {
        collect(child);
      }
    }
  }

  collect(document.documentElement);
  return results;
}

// Runs inside the page context. Finds the visible serial-monitor text
// input (excluding the send button) and focuses it.
function focusSerialInputElement() {
  function isVisible(el) {
    if (!el.getClientRects) return false;
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function isContentEditableTrue(el) {
    return !!(el.getAttribute && el.getAttribute('contenteditable') === 'true');
  }

  function search(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const isCandidateTag = tag === 'input' || tag === 'textarea' || isContentEditableTrue(el);
    const isSendButton = !!(el.getAttribute && el.getAttribute('data-event') === 'serial-send');
    const insideSerialPanel = !!(el.closest && el.closest('.code_panel__serial'));

    if (isCandidateTag && !isSendButton && insideSerialPanel && isVisible(el)) {
      el.focus();
      return true;
    }

    const children = el.children ? Array.from(el.children) : [];
    for (const child of children) {
      if (search(child)) return true;
    }

    if (el.shadowRoot) {
      const shadowChildren = Array.from(el.shadowRoot.children || []);
      for (const child of shadowChildren) {
        if (search(child)) return true;
      }
    }

    return false;
  }

  return search(document.documentElement);
}

// Runs inside the page context. Finds the visible serial-monitor send
// button and clicks it.
function clickSerialSendButton() {
  function isVisible(el) {
    if (!el.getClientRects) return false;
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function search(el) {
    const isSendButton = !!(el.getAttribute && el.getAttribute('data-event') === 'serial-send');

    if (isSendButton && isVisible(el)) {
      el.click();
      return true;
    }

    const children = el.children ? Array.from(el.children) : [];
    for (const child of children) {
      if (search(child)) return true;
    }

    if (el.shadowRoot) {
      const shadowChildren = Array.from(el.shadowRoot.children || []);
      for (const child of shadowChildren) {
        if (search(child)) return true;
      }
    }

    return false;
  }

  return search(document.documentElement);
}

// Runs inside the page context. Finds the visible serial-monitor text
// input (excluding the send button), clears any existing text, and
// focuses it so subsequent typing starts from an empty field.
function clearSerialInputElement() {
  function isVisible(el) {
    if (!el.getClientRects) return false;
    if (el.getClientRects().length === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) return false;
    return true;
  }

  function isContentEditableTrue(el) {
    return !!(el.getAttribute && el.getAttribute('contenteditable') === 'true');
  }

  function search(el) {
    const tag = el.tagName ? el.tagName.toLowerCase() : '';
    const isCandidateTag = tag === 'input' || tag === 'textarea' || isContentEditableTrue(el);
    const isSendButton = !!(el.getAttribute && el.getAttribute('data-event') === 'serial-send');
    const insideSerialPanel = !!(el.closest && el.closest('.code_panel__serial'));

    if (isCandidateTag && !isSendButton && insideSerialPanel && isVisible(el)) {
      if (tag === 'input' || tag === 'textarea') {
        const proto = tag === 'input' ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
        const nativeValueSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        nativeValueSetter.call(el, '');
      } else {
        el.textContent = '';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.focus();
      return true;
    }

    const children = el.children ? Array.from(el.children) : [];
    for (const child of children) {
      if (search(child)) return true;
    }

    if (el.shadowRoot) {
      const shadowChildren = Array.from(el.shadowRoot.children || []);
      for (const child of shadowChildren) {
        if (search(child)) return true;
      }
    }

    return false;
  }

  return search(document.documentElement);
}

// Runs inside the page context. Finds the serial monitor panel
// container and returns its rendered text (the log of sent/received
// lines), searching through shadow roots.
function getSerialPanelText() {
  function search(el) {
    const className = typeof el.className === 'string' ? el.className : '';
    const classList = className.split(/\s+/);

    if (classList.includes('code_panel__serial')) {
      return el.innerText || el.textContent || '';
    }

    const children = el.children ? Array.from(el.children) : [];
    for (const child of children) {
      const found = search(child);
      if (found !== null) return found;
    }

    if (el.shadowRoot) {
      const shadowChildren = Array.from(el.shadowRoot.children || []);
      for (const child of shadowChildren) {
        const found = search(child);
        if (found !== null) return found;
      }
    }

    return null;
  }

  return search(document.documentElement) || '';
}

async function findProjectPage(pages) {
  for (const page of pages) {
    if (page.url().includes(PROJECT_URL_MATCH)) {
      return page;
    }
  }
  for (const page of pages) {
    const title = await page.title();
    if (title.includes(PROJECT_TITLE_MATCH)) {
      return page;
    }
  }
  return null;
}

function findSerialInputControl(controls) {
  return controls.find(
    (c) => c.insideSerialPanel && (c.tag === 'input' || c.tag === 'textarea' || c.tag === undefined) && c.dataEvent !== 'serial-send'
  );
}

function findSendButtonControl(controls) {
  return controls.find((c) => c.dataEvent === 'serial-send');
}

// Clears the Serial Monitor input, waits 500ms, types the command, waits
// 300ms, then clicks Send. Returns false if any DOM step fails.
async function sendSerialCommand(page, command) {
  console.log('[bridge] Clearing the Serial Monitor input...');
  const cleared = await page.evaluate(clearSerialInputElement);

  if (!cleared) {
    console.log('[bridge] Failed to clear/focus the Serial Monitor input box.');
    return false;
  }

  console.log('[bridge] Waiting 500ms before typing...');
  await delay(500);

  // Re-focus in case the 500ms wait let focus drift away from the input
  // (observed to cause keystrokes to be typed nowhere).
  await page.evaluate(focusSerialInputElement);

  console.log(`[bridge] Typing "${command}" into the Serial Monitor input box...`);
  await page.keyboard.type(command);

  console.log('[bridge] Waiting 300ms before clicking Send...');
  await delay(300);

  console.log('[bridge] Clicking the Send button...');
  const sent = await page.evaluate(clickSerialSendButton);

  if (!sent) {
    console.log('[bridge] Failed to click the Send button.');
    return false;
  }

  console.log(`[bridge] Sent "${command}" to the Tinkercad Serial Monitor.`);
  return true;
}

async function main() {
  const browser = await puppeteer.connect({
    browserURL: BROWSER_URL,
    defaultViewport: null,
    protocolTimeout: 120000,
  });
  console.log(`[bridge] Connected to Chrome at ${BROWSER_URL}`);

  const pages = await browser.pages();
  const tinkercadPage = await findProjectPage(pages);

  if (!tinkercadPage) {
    console.log(`[bridge] No tab found matching url "${PROJECT_URL_MATCH}" or title "${PROJECT_TITLE_MATCH}". Open the project in the running Chrome window and re-run this script.`);
    browser.disconnect();
    process.exitCode = 1;
    return;
  }

  console.log(`[bridge] Opened Tinkercad project tab: ${tinkercadPage.url()}`);

  let startedSimulationByBridge = false;
  let retryNeeded = false;
  let foundExpectedReply = false;
  let finalStatus = null; // 'taken' | 'missed' | null (timeout or OK_SLOT_X never confirmed)
  let simulationStoppedAtEnd = false;

  try {
    console.log('[bridge] Checking simulation state...');
    const initialLabel = await getSimulationLabel(tinkercadPage);
    console.log(`[bridge] Simulation button text: "${initialLabel}"`);

    if (initialLabel === 'Start Simulation') {
      console.log('[bridge] Clicking Start Simulation...');
      const usedSelector = await clickViaEvaluate(tinkercadPage, START_SIMULATION_SELECTORS);

      if (!usedSelector) {
        console.log(`[bridge] Could not find any selector for Start Simulation. Tried: ${START_SIMULATION_SELECTORS.join(', ')}`);
        return;
      }

      startedSimulationByBridge = true;
      console.log(`[bridge] Clicked Start Simulation using selector: ${usedSelector}`);

      const running = await waitForSimulationLabel(tinkercadPage, 'Stop Simulation');

      if (!running) {
        console.log('[bridge] Simulation did not start. Aborting.');
        return;
      }

      console.log('[bridge] Simulation started by bridge. Waiting an additional 3000ms for Arduino initialization...');
      await delay(3000);
      console.log('[bridge] 3000ms initialization delay complete.');
    } else {
      console.log('[bridge] Simulation was already running before the bridge connected. Bridge will not start or stop it.');
    }

    console.log('[bridge] Checking whether the Serial Monitor is already open...');
    let controls = await tinkercadPage.evaluate(findVisibleSerialControls);
    let serialInput = findSerialInputControl(controls);
    let sendButton = findSendButtonControl(controls);

    if (serialInput && sendButton) {
      console.log('[bridge] Serial Monitor is already open. Not clicking the toggle.');
    } else {
      console.log('[bridge] Serial Monitor appears collapsed. Clicking the toggle to open it.');
      const serialMonitorSelector = await clickViaEvaluate(tinkercadPage, SERIAL_MONITOR_SELECTORS);

      if (!serialMonitorSelector) {
        console.log(`[bridge] Could not find any selector for Serial Monitor. Tried: ${SERIAL_MONITOR_SELECTORS.join(', ')}`);
        return;
      }

      console.log(`[bridge] Clicked Serial Monitor toggle using selector: ${serialMonitorSelector}`);
      await delay(1000);

      controls = await tinkercadPage.evaluate(findVisibleSerialControls);
      serialInput = findSerialInputControl(controls);
      sendButton = findSendButtonControl(controls);
    }

    if (!serialInput) {
      console.log('[bridge] Could not locate the Serial Monitor input box. Aborting.');
      return;
    }

    if (!sendButton) {
      console.log('[bridge] Could not locate the Serial Monitor Send button. Aborting.');
      return;
    }

    const beforeFirstSendText = await tinkercadPage.evaluate(getSerialPanelText);
    const firstSendOk = await sendSerialCommand(tinkercadPage, requestedCommand);

    if (!firstSendOk) {
      console.log('[bridge] Aborting: could not send the command.');
      return;
    }

    console.log('[bridge] Waiting 1500ms for the Arduino response...');
    await delay(1500);

    console.log('[bridge] Inspecting Serial Monitor output...');
    let fullOutput = await tinkercadPage.evaluate(getSerialPanelText);
    let newOutput = fullOutput.startsWith(beforeFirstSendText) ? fullOutput.slice(beforeFirstSendText.length) : fullOutput;
    foundExpectedReply = newOutput.includes(expectedReply);
    const foundUnknownCommand = newOutput.includes('UNKNOWN_COMMAND');

    console.log(`[bridge] ${expectedReply} found: ${foundExpectedReply}`);
    console.log(`[bridge] UNKNOWN_COMMAND found: ${foundUnknownCommand}`);

    if (!foundExpectedReply && foundUnknownCommand) {
      retryNeeded = true;
      console.log(
        `[bridge] Received UNKNOWN_COMMAND without ${expectedReply}. Waiting 1000ms before resending (retry 1 of 1)...`
      );
      await delay(1000);

      const beforeRetryText = fullOutput;

      console.log(`[bridge] Resending "${requestedCommand}"...`);
      const retrySendOk = await sendSerialCommand(tinkercadPage, requestedCommand);

      if (!retrySendOk) {
        console.log('[bridge] Retry send failed (could not clear/type/click).');
      } else {
        console.log('[bridge] Waiting 1500ms for the Arduino response to the retry...');
        await delay(1500);

        console.log('[bridge] Inspecting Serial Monitor output after retry...');
        fullOutput = await tinkercadPage.evaluate(getSerialPanelText);
        newOutput = fullOutput.startsWith(beforeRetryText) ? fullOutput.slice(beforeRetryText.length) : fullOutput;
        foundExpectedReply = newOutput.includes(expectedReply);

        console.log(`[bridge] ${expectedReply} found after retry: ${foundExpectedReply}`);

        if (foundExpectedReply) {
          console.log('[bridge] Retry succeeded — treating operation as success.');
        }
      }
    }

    if (!foundExpectedReply) {
      console.log(`[bridge] ${expectedReply} was never confirmed; skipping the DOSE_TAKEN/MISSED_DOSE wait.`);
    } else {
      console.log(
        `[bridge] ${expectedReply} confirmed. Waiting for DOSE_TAKEN or MISSED_DOSE (up to ${DOSE_WAIT_TIMEOUT_MS}ms)...`
      );

      const doseBaselineText = fullOutput;
      const doseWaitStart = Date.now();

      while (Date.now() - doseWaitStart < DOSE_WAIT_TIMEOUT_MS) {
        await delay(DOSE_POLL_INTERVAL_MS);

        const currentFullText = await tinkercadPage.evaluate(getSerialPanelText);
        const doseOutput = currentFullText.startsWith(doseBaselineText)
          ? currentFullText.slice(doseBaselineText.length)
          : currentFullText;

        if (doseOutput.includes('DOSE_TAKEN')) {
          finalStatus = 'taken';
          console.log(`[bridge] DOSE_TAKEN found after ${Date.now() - doseWaitStart}ms.`);
          break;
        }

        if (doseOutput.includes('MISSED_DOSE')) {
          finalStatus = 'missed';
          console.log(`[bridge] MISSED_DOSE found after ${Date.now() - doseWaitStart}ms.`);
          break;
        }
      }

      if (!finalStatus) {
        console.log(
          `[bridge] Timed out after ${DOSE_WAIT_TIMEOUT_MS}ms waiting for DOSE_TAKEN or MISSED_DOSE.`
        );
      }
    }
  } finally {
    if (startedSimulationByBridge) {
      console.log('[bridge] Bridge started the simulation; stopping it now...');
      const stopSelector = await clickViaEvaluate(tinkercadPage, START_SIMULATION_SELECTORS);

      if (!stopSelector) {
        console.log('[bridge] Could not find the simulation toggle to stop it.');
      } else {
        const stopped = await waitForSimulationLabel(tinkercadPage, 'Start Simulation');

        if (stopped) {
          simulationStoppedAtEnd = true;
          console.log('Simulation stopped by bridge');
        } else {
          console.log('[bridge] Simulation button did not revert to "Start Simulation" in time.');
        }
      }
    } else {
      console.log('[bridge] Simulation was already running before the bridge connected; leaving it running.');
    }

    console.log('[bridge] Summary:');
    console.log(`[bridge]   Bridge started the simulation: ${startedSimulationByBridge}`);
    console.log(`[bridge]   Retry needed: ${retryNeeded}`);
    console.log(`[bridge]   ${expectedReply} found: ${foundExpectedReply}`);
    console.log(`[bridge]   final_status: ${finalStatus === null ? 'timeout' : finalStatus}`);
    console.log(`[bridge]   Simulation stopped at end: ${simulationStoppedAtEnd}`);

    browser.disconnect();
    console.log('[bridge] Disconnected from Chrome.');
  }

  process.exitCode = foundExpectedReply && finalStatus !== null ? 0 : 1;
}

main().catch((error) => {
  console.error('[bridge] Failed:', error);
  process.exitCode = 1;
});
