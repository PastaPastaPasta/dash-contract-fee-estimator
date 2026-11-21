import './ui/styles.css';
import type {} from '../public/dashhq/dashhq-shell';
import { estimateContractFee } from './lib/estimator';
import { parseContractJson } from './lib/parser';
import { fetchFeeVersion, fetchVersionFiles, feeBlobUrl, latestStableRelease } from './lib/fee-source';
import { encodeContractHandoff, fetchContract } from './lib/contract-source';
import { BUNDLED_FEE_TABLE } from './lib/constants';
import type { FeeConstants } from './lib/types';
import { renderApp, type FeeSource, type Handoff } from './ui/components';
import { BUNDLED_SCHEDULES, readCurrentProtocol, scheduleForProtocol, scheduleLabel } from './lib/schedules';
import { EXAMPLES } from './ui/examples';
import { planState, restorePlan, type PlanState } from './ui/plan';

const DRAFT_KEY = 'fees-network-draft';
type Draft = { from: string; to: string; json: string; plan: PlanState };

window.dashhq.network.canonicalize();
const params = new URLSearchParams(location.search);
const network = window.dashhq.network.fromUrl();
const rawIdentity = params.get('identity') ?? params.get('identityId');
const identity = rawIdentity && /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(rawIdentity) ? rawIdentity : null;
const networkLabel = window.dashhq.network.label(network);
document.querySelector('dashhq-bar')!.setAttribute('network', network);

const app = document.getElementById('app')!;
const ui = renderApp(app, network, identity);

let protocol: number | null = null;
let protocolError = false;
let protocolReadAt = '';
let manual = '';
let versions = Object.keys(BUNDLED_SCHEDULES);
const live: Record<string, { constants: FeeConstants; source: FeeSource }> = {};

const current = () => (protocol === null ? null : scheduleForProtocol(protocol));
const selected = () => manual || current() || BUNDLED_FEE_TABLE.version;
const tableFor = (version: string) =>
  live[version] ?? { constants: BUNDLED_SCHEDULES[version], source: { version, ref: BUNDLED_FEE_TABLE.tag, live: false } };
const confirmed = () => !manual && !!current();

function refreshStatus() {
  const schedule = current();
  const [message, warn] = manual
    ? [`Hypothetical · ${scheduleLabel(manual)}, chosen by hand. ${schedule ? `${networkLabel} runs protocol ${protocol}, which uses ${scheduleLabel(schedule)}. ` : ''}Choose the automatic schedule before funding.`, true]
    : schedule
      ? [`${networkLabel} · protocol ${protocol} (read ${protocolReadAt} UTC) · current schedule ${scheduleLabel(schedule)}`, false]
      : protocolError
        ? [`Couldn’t check ${networkLabel}’s protocol, so ${scheduleLabel(selected())} is provisional. Refresh in Schedule and sources before funding.`, true]
        : protocol !== null
          ? [`${networkLabel} reports protocol ${protocol}, which has no confirmed schedule here. ${scheduleLabel(selected())} is provisional; choose a schedule in Schedule and sources for comparison.`, true]
          : [`Checking which protocol ${networkLabel} runs…`, false];
  ui.setStatus(message, warn);
  ui.setSource(tableFor(selected()).source);
  ui.setVersionOptions(versions, manual);
}

function handoff(json: string, totalCredits: number): Handoff {
  if (!confirmed()) return { reason: 'Continuing to Bridge needs the automatic schedule, confirmed from the network’s protocol. Choose it in Schedule and sources, and wait for the network check or refresh it.' };
  const encoded = encodeContractHandoff(json);
  if (encoded.length > 24000 || !(network === 'mainnet' || network === 'testnet')) {
    return { reason: 'This schema is too large for a link, or this network needs its own Bridge. Copy the JSON and import it in Bridge.' };
  }
  const who = identity ? `&identityId=${identity}&identity=${identity}` : '';
  return { href: window.dashhq.href('bridge', `/?mode=contract&from=fees&feeSchedule=${encodeURIComponent(selected())}&registrationCredits=${totalCredits}&contract=${encoded}${who}`, { network }) };
}

function runEstimate(): boolean {
  const raw = ui.getJsonInput().trim();
  if (!raw) {
    ui.showError('Paste a data contract JSON, load a contract, or choose an example.');
    return false;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    ui.showError('This JSON could not be read. Check commas and quotation marks, or choose an example.');
    return false;
  }
  try {
    const parsed = parseContractJson(json);
    const version = selected();
    const { constants, source } = tableFor(version);
    const estimate = estimateContractFee(parsed, constants);
    const meta = [
      confirmed() ? `${networkLabel} · protocol ${protocol}` : `Hypothetical on ${networkLabel}`,
      scheduleLabel(version),
      source.live ? `Platform ${source.ref}` : `Platform ${BUNDLED_FEE_TABLE.tag}`,
    ];
    const sourceUrl = feeBlobUrl(source.live ? source.ref : BUNDLED_FEE_TABLE.revision, version);
    ui.showResult(estimate, parsed, json as Record<string, unknown>, meta, sourceUrl, handoff(raw, estimate.totalCredits));
    return true;
  } catch (e) {
    ui.showError(e instanceof Error ? e.message : 'The estimate could not be calculated.');
    return false;
  }
}

const rerun = () => { if (ui.hasResult()) runEstimate(); };

async function syncProtocol() {
  try {
    protocol = await readCurrentProtocol(network);
    protocolError = false;
    protocolReadAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    protocol = null;
    protocolError = true;
  }
  refreshStatus();
}

async function loadLive(version: string, ref: string): Promise<void> {
  const constants = await fetchFeeVersion(version, ref);
  live[version] = { constants, source: { version, ref, live: true, fetchedAt: new Date().toISOString().replace('T', ' ').slice(11, 19) } };
}

ui.onRefresh(async () => {
  ui.setBusy(true, 'Reading the network and the newest stable Platform release…');
  await syncProtocol();
  let message: string;
  try {
    const ref = await latestStableRelease();
    versions = [...new Set([...Object.keys(BUNDLED_SCHEDULES), ...(await fetchVersionFiles(ref))])];
    await loadLive(selected(), ref);
    message = ref === BUNDLED_FEE_TABLE.tag
      ? `Fee table read from Platform ${ref}, the newest stable release and the one bundled here.`
      : `Fee table read from Platform ${ref}, the newest stable release, which is newer than the bundled ${BUNDLED_FEE_TABLE.tag}.`;
  } catch {
    const { source } = tableFor(selected());
    const inUse = source.live
      ? `The table read from Platform ${source.ref} at ${source.fetchedAt} UTC is still in use.`
      : `The bundled table from Platform ${BUNDLED_FEE_TABLE.tag} is still in use.`;
    message = `Couldn’t read the fee source from GitHub. ${inUse} Try again shortly.`;
  }
  refreshStatus();
  ui.setBusy(false, message);
  rerun();
});

ui.onVersionSelect(async (version) => {
  manual = version;
  if (version && !BUNDLED_SCHEDULES[version] && !live[version]) {
    ui.setBusy(true, 'Reading that schedule…');
    try {
      await loadLive(version, await latestStableRelease());
      ui.setBusy(false, '');
    } catch {
      manual = '';
      ui.setBusy(false, 'Couldn’t read that schedule. The automatic schedule is selected again.');
    }
  }
  refreshStatus();
  rerun();
});

ui.onEstimate(() => { if (runEstimate()) ui.revealResult(); });
ui.onExampleSelect((index) => {
  ui.setJsonInput(JSON.stringify(EXAMPLES[index].json, null, 2));
  ui.clearResult();
});
ui.onJsonEdit(() => ui.clearResult());

ui.contractForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = ui.contractInput.value.trim();
  const before = ui.getJsonInput();
  ui.contractButton.disabled = true;
  ui.setContractStatus('Reading the contract from Platform…');
  try {
    const contract = await fetchContract(id, network);
    const url = new URL(location.href);
    url.searchParams.set('contract', id);
    url.searchParams.delete('contractId');
    history.replaceState(null, '', url);
    if (ui.getJsonInput() !== before) throw new Error('Your JSON changed while the contract was loading. Your edits were kept. Load again to replace them.');
    ui.setJsonInput(JSON.stringify(contract, null, 2));
    ui.setExample(null);
    ui.setContractStatus('Contract loaded. This estimates a new registration of its schema; an update to it would pay the full registration fee again.');
    runEstimate();
  } catch (error) {
    ui.setContractStatus(error instanceof Error ? error.message : 'Couldn’t read the contract. Try again.');
  } finally {
    ui.contractButton.disabled = false;
  }
});

function keepDraft(to: string) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ from: network, to, json: ui.getJsonInput(), plan: planState() } satisfies Draft));
  } catch { /* storage unavailable: the switch still works, without the draft */ }
}
document.addEventListener('dashhq-network', (event) => keepDraft((event as CustomEvent<{ network: string }>).detail.network));

function takeDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    sessionStorage.removeItem(DRAFT_KEY);
    const draft = raw ? JSON.parse(raw) as Draft : null;
    return draft && draft.to === network && typeof draft.from === 'string' && draft.from !== network && typeof draft.json === 'string' ? draft : null;
  } catch {
    return null;
  }
}

const contractParam = params.get('contract') ?? params.get('contractId');
const draft = takeDraft();
refreshStatus();
if (draft) {
  ui.setJsonInput(draft.json);
  ui.setExample(null);
  restorePlan(draft.plan);
  ui.showNetworkNotice(() => {
    keepDraft(draft.from);
    location.assign(window.dashhq.network.withNetwork(location.href, draft.from as typeof network));
  });
} else if (contractParam) {
  ui.contractInput.value = contractParam;
  ui.contractDetails.open = true;
  ui.contractForm.requestSubmit();
} else {
  ui.setJsonInput(JSON.stringify(EXAMPLES[0].json, null, 2));
  ui.setExample(0);
}
void syncProtocol().then(rerun);
