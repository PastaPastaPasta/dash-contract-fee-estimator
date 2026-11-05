import './ui/styles.css';
import type {} from '../public/dashhq/dashhq-shell';
import { estimateContractFee } from './lib/estimator';
import { parseContractJson } from './lib/parser';
import { parseRustFeeConstants, findVersionFiles } from './lib/rust-parser';
import { DEFAULT_FEE_CONSTANTS, FEE_CONSTANTS_BASE_URL, FEE_CONSTANTS_BLOB_BASE_URL } from './lib/constants';
import type { FeeConstants } from './lib/types';
import { renderApp } from './ui/components';
import { EXAMPLES } from './ui/examples';

let activeFeeConstants: FeeConstants = DEFAULT_FEE_CONSTANTS;
const cachedVersionConstants: Record<string, FeeConstants> = {};

const app = document.getElementById('app')!;
const ui = renderApp(app);

ui.onRefresh(async () => {
  ui.setRefreshState(true);
  const loaded = await fetchAndSetupVersions();
  ui.setRefreshState(false, loaded ? 'Fee table updated from GitHub.' : 'Couldn’t update the fee table. The current table is still in use. Try again shortly.');
  if (ui.getJsonInput().trim()) runEstimate();
});

// Wire up event handlers
ui.onEstimate(() => { runEstimate(); ui.revealResult(); });
ui.onExampleSelect((index) => {
  ui.setJsonInput(JSON.stringify(EXAMPLES[index].json, null, 2));
  runEstimate();
  ui.revealResult();
});
ui.onVersionSelect(async (versionFile) => {
  ui.setRefreshState(true);
  const loaded = await loadVersion(versionFile);
  ui.setRefreshState(false, loaded ? '' : 'Couldn’t load that version. The previous fee table is still in use.');
  if (ui.getJsonInput().trim()) runEstimate();
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

async function fetchAndSetupVersions(): Promise<boolean> {
  try {
    const modResp = await fetch(`${FEE_CONSTANTS_BASE_URL}/mod.rs`);
    if (!modResp.ok) return false;
    const versions = findVersionFiles(await modResp.text());
    const latest = versions[versions.length - 1];
    if (!latest || !await loadVersion(latest)) return false;
    ui.setVersionOptions(versions, latest);
    return true;
  } catch {
    return false;
  }
}

async function loadVersion(versionFile: string): Promise<boolean> {
  const blobUrl = `${FEE_CONSTANTS_BLOB_BASE_URL}/${versionFile}`;
  try {
    if (!cachedVersionConstants[versionFile]) {
      const resp = await fetch(`${FEE_CONSTANTS_BASE_URL}/${versionFile}`);
      if (!resp.ok) return false;
      cachedVersionConstants[versionFile] = parseRustFeeConstants(await resp.text());
    }
    activeFeeConstants = cachedVersionConstants[versionFile];
    ui.setFeeSource('live', versionFile, blobUrl);
    return true;
  } catch {
    return false;
  }
}
