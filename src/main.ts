import './ui/styles.css';
import type {} from '../public/dashhq/dashhq-shell';
import { estimateContractFee } from './lib/estimator';
import { parseContractJson } from './lib/parser';
import { findVersionFiles } from './lib/rust-parser';
import { fetchFeeVersion } from './lib/fee-source';
import { fetchContract } from './lib/contract-source';
import { FEE_CONSTANTS_BASE_URL, FEE_CONSTANTS_BLOB_BASE_URL } from './lib/constants';
import type { FeeConstants } from './lib/types';
import { renderApp } from './ui/components';
import { BUNDLED_SCHEDULES, readCurrentProtocol, scheduleForProtocol } from './lib/schedules';
import { EXAMPLES } from './ui/examples';

let activeVersion = 'v2.rs';
let activeFeeConstants: FeeConstants = BUNDLED_SCHEDULES[activeVersion];
let protocol: number | null = null;
let manualVersion = false;
let protocolReadAt = '';
const network = new URLSearchParams(location.search).get('network') ?? 'mainnet';

const app = document.getElementById('app')!;
const ui = renderApp(app);
const params = new URLSearchParams(window.location.search);
document.querySelector('dashhq-bar')!.setAttribute('network', network);
ui.setVersionOptions(Object.keys(BUNDLED_SCHEDULES), activeVersion);
ui.setFeeSource('bundled', activeVersion);
updateProtocolLabel('Reading the selected network’s current protocol…');
void syncProtocol();
const contractInput = app.querySelector<HTMLInputElement>('#contract-id')!;
const contractStatus = app.querySelector<HTMLElement>('#contract-status')!;
const loadContractButton = app.querySelector<HTMLButtonElement>('#load-contract')!;
contractInput.value = params.get('contract') ?? '';
app.querySelector('#load-contract-form')!.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = contractInput.value.trim();
  const previousJson = ui.getJsonInput();
  loadContractButton.disabled = true;
  contractStatus.textContent = 'Reading contract from Platform…';
  try {
    const contract = await fetchContract(id, params.get('network') ?? 'mainnet');
    const url = new URL(window.location.href);
    url.searchParams.set('contract', id);
    window.history.replaceState(null, '', url);
    if (ui.getJsonInput() !== previousJson) throw new Error('Your JSON changed while the contract was loading. Your edits were kept. Load again to replace them.');
    ui.setJsonInput(JSON.stringify(contract, null, 2));
    contractStatus.textContent = 'Contract loaded. Edit the JSON to estimate a new deployment.';
    runEstimate();
  } catch (error) {
    contractStatus.textContent = error instanceof Error ? error.message : 'Couldn’t read the contract. Try again.';
  } finally { loadContractButton.disabled = false; }
});
if (contractInput.value) app.querySelector<HTMLFormElement>('#load-contract-form')!.requestSubmit();

ui.onRefresh(async () => {
  ui.setRefreshState(true);
  await syncProtocol();
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
  manualVersion = true;
  ui.setRefreshState(true);
  const loaded = await loadVersion(versionFile);
  ui.setRefreshState(false, loaded ? '' : 'Couldn’t load that version. The previous fee table is still in use.');
  updateProtocolLabel();
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
    const modResp = await fetch(`${FEE_CONSTANTS_BASE_URL}/mod.rs`, { signal: AbortSignal.timeout(12000) });
    if (!modResp.ok) return false;
    const versions = findVersionFiles(await modResp.text());
    if (!versions.includes(activeVersion) || !await loadVersion(activeVersion, true)) return false;
    ui.setVersionOptions([...new Set([...Object.keys(BUNDLED_SCHEDULES), ...versions])], activeVersion);
    return true;
  } catch {
    return false;
  }
}

async function loadVersion(versionFile: string, refresh = false): Promise<boolean> {
  if (!refresh && BUNDLED_SCHEDULES[versionFile]) {
    activeVersion = versionFile;
    activeFeeConstants = BUNDLED_SCHEDULES[versionFile];
    ui.setFeeSource('bundled', versionFile);
    return true;
  }
  const blobUrl = `${FEE_CONSTANTS_BLOB_BASE_URL}/${versionFile}`;
  try {
    const constants = await fetchFeeVersion(versionFile);
    activeVersion = versionFile;
    activeFeeConstants = constants;
    ui.setFeeSource('live', versionFile, blobUrl);
    return true;
  } catch {
    return false;
  }
}

function updateProtocolLabel(message?: string) {
  const expected = protocol === null ? null : scheduleForProtocol(protocol);
  const text = message ?? (protocol === null
    ? `${network}: current protocol unconfirmed. Selected schedule ${activeVersion.replace('.rs','')} is provisional; retry the network check before funding.`
    : `${network}: Platform reports protocol ${protocol} (read ${protocolReadAt} UTC). ${expected === activeVersion ? 'The selected schedule applies to this protocol.' : 'Hypothetical estimate: the selected schedule is not confirmed for this network. Choose the current schedule before funding.'}`);
  ui.setProtocolStatus(text);
}

async function syncProtocol() {
  try {
    protocol = await readCurrentProtocol(network);
    protocolReadAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const version = scheduleForProtocol(protocol);
    if (!manualVersion && version) {
      await loadVersion(version);
      ui.setVersionOptions(Object.keys(BUNDLED_SCHEDULES), version);
    }
  } catch { protocol = null; }
  updateProtocolLabel();
  if (ui.getJsonInput().trim()) runEstimate();
}
