import { estimateContractFee } from './lib/estimator';
import { parseContractJson } from './lib/parser';
import { parseRustFeeConstants, findVersionFiles } from './lib/rust-parser';
import { DEFAULT_FEE_CONSTANTS, FEE_CONSTANTS_BASE_URL, FEE_CONSTANTS_BLOB_BASE_URL } from './lib/constants';
import type { FeeConstants } from './lib/types';
import { renderApp } from './ui/components';
import { EXAMPLES } from './ui/examples';

let activeFeeConstants: FeeConstants = DEFAULT_FEE_CONSTANTS;
let cachedVersionConstants: Record<string, FeeConstants> = {};

const app = document.getElementById('app')!;
const ui = renderApp(app);

// Try to fetch latest fee constants from GitHub
fetchAndSetupVersions();

// Wire up event handlers
ui.onEstimate(runEstimate);
ui.onExampleSelect((index) => {
  ui.setJsonInput(JSON.stringify(EXAMPLES[index].json, null, 2));
  runEstimate();
});
ui.onVersionSelect(async (versionFile) => {
  await loadVersion(versionFile);
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

async function fetchAndSetupVersions() {
  try {
    const modResp = await fetch(`${FEE_CONSTANTS_BASE_URL}/mod.rs`);
    if (!modResp.ok) {
      ui.setFeeSource('bundled');
      return;
    }
    const modSource = await modResp.text();
    const versions = findVersionFiles(modSource);
    const latest = versions[versions.length - 1];

    ui.setVersionOptions(versions, latest);
    await loadVersion(latest);
  } catch {
    ui.setFeeSource('bundled');
  }
}

async function loadVersion(versionFile: string) {
  const blobUrl = `${FEE_CONSTANTS_BLOB_BASE_URL}/${versionFile}`;

  if (cachedVersionConstants[versionFile]) {
    activeFeeConstants = cachedVersionConstants[versionFile];
    ui.setFeeSource('live', versionFile, blobUrl);
    return;
  }

  try {
    const resp = await fetch(`${FEE_CONSTANTS_BASE_URL}/${versionFile}`);
    if (!resp.ok) {
      ui.setFeeSource('bundled');
      return;
    }
    const source = await resp.text();
    const constants = parseRustFeeConstants(source);
    cachedVersionConstants[versionFile] = constants;
    activeFeeConstants = constants;
    ui.setFeeSource('live', versionFile, blobUrl);
  } catch {
    ui.setFeeSource('bundled');
  }
}
