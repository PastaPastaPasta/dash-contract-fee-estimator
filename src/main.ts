import { estimateContractFee } from './lib/estimator';
import { parseContractJson } from './lib/parser';
import { parseRustFeeConstants } from './lib/rust-parser';
import { DEFAULT_FEE_CONSTANTS, FEE_CONSTANTS_SOURCE_URL } from './lib/constants';
import type { FeeConstants } from './lib/types';
import { renderApp } from './ui/components';
import { EXAMPLES } from './ui/examples';

let activeFeeConstants: FeeConstants = DEFAULT_FEE_CONSTANTS;

const app = document.getElementById('app')!;
const ui = renderApp(app);

// Try to fetch latest fee constants from GitHub
fetchLatestFeeConstants();

// Wire up event handlers
ui.onEstimate(runEstimate);
ui.onExampleSelect((index) => {
  ui.setJsonInput(JSON.stringify(EXAMPLES[index].json, null, 2));
  runEstimate();
});

// Auto-estimate on input (debounced)
const jsonInput = app.querySelector<HTMLTextAreaElement>('#json-input')!;
let debounceTimer: ReturnType<typeof setTimeout>;
jsonInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (jsonInput.value.trim()) {
      runEstimate();
    } else {
      ui.clearResult();
    }
  }, 500);
});

function runEstimate() {
  const raw = ui.getJsonInput().trim();
  if (!raw) {
    ui.showError('Please paste a data contract JSON');
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    ui.showError('Invalid JSON: ' + (raw.length > 100 ? 'parse error' : 'check syntax'));
    return;
  }

  try {
    const parsed = parseContractJson(json);
    const estimate = estimateContractFee(parsed, activeFeeConstants);
    ui.showResult(estimate, parsed);
  } catch (e) {
    ui.showError(e instanceof Error ? e.message : 'Unknown error');
  }
}

async function fetchLatestFeeConstants() {
  try {
    const resp = await fetch(FEE_CONSTANTS_SOURCE_URL);
    if (!resp.ok) {
      ui.setFeeSource('bundled');
      return;
    }
    const source = await resp.text();
    activeFeeConstants = parseRustFeeConstants(source);
    ui.setFeeSource('live');
  } catch {
    // Silent fallback to bundled constants
    ui.setFeeSource('bundled');
  }
}
