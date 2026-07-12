const path = require('path');
const puppeteer = require('puppeteer');

const BROWSER_URL = 'http://127.0.0.1:9222';
const SCREENSHOT_PATH = path.join(__dirname, 'tinkercad-serial-expanded.png');
const PROJECT_URL_MATCH = '8XVYPMMFUnn';
const PROJECT_TITLE_MATCH = 'Smooth Lappi-Duup';

const START_SIMULATION_SELECTORS = ['#SIMULATION_ID', '.js-toggleSimulation', '[data-event="simulate"]'];
const SERIAL_MONITOR_SELECTORS = ['#SERIAL_MONITOR_ID', '.js-toggle_serial_monitor', '[data-event="serial-monitor"]'];

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120000;

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

async function ensureSimulationRunning(page) {
  const initialLabel = await getSimulationLabel(page);
  console.log(`[bridge] Simulation button text: "${initialLabel}"`);

  if (initialLabel === 'Stop Simulation') {
    console.log('[bridge] Simulation is already running.');
    return true;
  }

  console.log('[bridge] About to click Start Simulation.');
  const usedSelector = await clickViaEvaluate(page, START_SIMULATION_SELECTORS);

  if (!usedSelector) {
    console.log(`[bridge] Could not find any selector for Start Simulation. Tried: ${START_SIMULATION_SELECTORS.join(', ')}`);
    return false;
  }

  console.log(`[bridge] Clicked Start Simulation using selector: ${usedSelector}`);
  console.log(`[bridge] Polling simulation button text every ${POLL_INTERVAL_MS}ms for up to ${POLL_TIMEOUT_MS}ms...`);

  const maxAttempts = Math.ceil(POLL_TIMEOUT_MS / POLL_INTERVAL_MS);
  let currentLabel = initialLabel;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await delay(POLL_INTERVAL_MS);
    currentLabel = await getSimulationLabel(page);
    console.log(`[bridge] Poll ${attempt}/${maxAttempts}: button text = "${currentLabel}"`);

    if (currentLabel === 'Stop Simulation') {
      console.log('[bridge] Simulation started.');
      return true;
    }
  }

  console.log(`[bridge] Simulation did not start. Final button text: "${currentLabel}"`);
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

function printControl(label, c) {
  if (!c) {
    console.log(`[bridge] ${label}: not found`);
    return;
  }
  console.log(
    `[bridge] ${label}: tag=${c.tag} id="${c.id}" class="${c.className}" placeholder="${c.placeholder}" aria-label="${c.ariaLabel}" disabled=${c.disabled}`
  );
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

  console.log('[bridge] Verifying simulation is running (will start it if needed, will not stop it)...');
  const running = await ensureSimulationRunning(tinkercadPage);

  if (!running) {
    console.log('[bridge] Simulation could not be confirmed running. Aborting without opening Serial Monitor.');
    browser.disconnect();
    console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');
    process.exitCode = 1;
    return;
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
      browser.disconnect();
      console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');
      process.exitCode = 1;
      return;
    }

    console.log(`[bridge] Clicked Serial Monitor toggle using selector: ${serialMonitorSelector}`);
    await delay(1000);

    controls = await tinkercadPage.evaluate(findVisibleSerialControls);
    serialInput = findSerialInputControl(controls);
    sendButton = findSendButtonControl(controls);
  }

  console.log('[bridge] Identified serial monitor controls:');
  printControl('Serial input field', serialInput);
  printControl('Send button', sendButton);

  if (!serialInput) {
    console.log('[bridge] Could not locate the Serial Monitor input box. Aborting.');
    browser.disconnect();
    console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');
    process.exitCode = 1;
    return;
  }

  if (!sendButton) {
    console.log('[bridge] Could not locate the Serial Monitor Send button. Aborting.');
    browser.disconnect();
    console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');
    process.exitCode = 1;
    return;
  }

  console.log('[bridge] Clearing and focusing the Serial Monitor input box...');
  const cleared = await tinkercadPage.evaluate(clearSerialInputElement);

  if (!cleared) {
    console.log('[bridge] Failed to clear/focus the Serial Monitor input box. Aborting.');
    browser.disconnect();
    console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');
    process.exitCode = 1;
    return;
  }

  console.log(`[bridge] Typing "${requestedCommand}" into the Serial Monitor input box...`);
  await tinkercadPage.keyboard.type(requestedCommand);

  console.log('[bridge] Clicking the Send button...');
  const sent = await tinkercadPage.evaluate(clickSerialSendButton);

  if (!sent) {
    console.log('[bridge] Failed to click the Send button. Aborting.');
    browser.disconnect();
    console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');
    process.exitCode = 1;
    return;
  }

  console.log(`[bridge] Sent "${requestedCommand}" to the Tinkercad Serial Monitor.`);

  console.log('[bridge] Waiting briefly for the Arduino response...');
  await delay(1500);

  console.log('[bridge] Inspecting Serial Monitor output...');
  const serialOutput = await tinkercadPage.evaluate(getSerialPanelText);
  const foundExpectedReply = serialOutput.includes(expectedReply);

  console.log('[bridge] Serial Monitor output:');
  console.log(serialOutput);
  console.log(`[bridge] ${expectedReply} found: ${foundExpectedReply}`);

  browser.disconnect();
  console.log('[bridge] Disconnected from Chrome. Chrome window remains open.');

  process.exitCode = foundExpectedReply ? 0 : 1;
}

main().catch((error) => {
  console.error('[bridge] Failed:', error);
  process.exitCode = 1;
});
