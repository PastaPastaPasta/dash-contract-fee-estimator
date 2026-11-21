import type { FeeEstimate, ParsedContract } from '../lib/types';
import { CREDITS_PER_DASH } from '../lib/types';
import { scheduleLabel } from '../lib/schedules';
import { EXAMPLES } from './examples';
import { BUNDLED_FEE_TABLE } from '../lib/constants';
import { feeBlobUrl } from '../lib/fee-source';
import { esc, number } from './formatter';
import { renderPlan } from './plan';

export type FeeSource = { version: string; ref: string; live: boolean; fetchedAt?: string };
export type Handoff = { href: string } | { reason: string };

const CALCULATION_URL = `https://github.com/dashpay/platform/blob/${BUNDLED_FEE_TABLE.tag}/packages/rs-dpp/src/data_contract/methods/registration_cost/v2/mod.rs`;
const UPDATE_COST_URL = `https://github.com/dashpay/platform/blob/${BUNDLED_FEE_TABLE.tag}/packages/rs-drive-abci/src/execution/types/execution_event/mod.rs`;
const DOCS_URL = 'https://docs.dash.org/projects/platform/en/stable/docs/explanations/fees.html';

export function describeSource(source: FeeSource): string {
  const table = `Fee table ${scheduleLabel(source.version)}`;
  if (source.live) return `${table} · read from Platform ${source.ref} at ${source.fetchedAt} UTC.`;
  return `${table} · bundled from Platform ${BUNDLED_FEE_TABLE.tag} (${BUNDLED_FEE_TABLE.revision.slice(0, 7)}, ${BUNDLED_FEE_TABLE.sourceDate}).`;
}

export function renderApp(container: HTMLElement, network: string, identity: string | null) {
  const unit = network === 'mainnet' ? 'DASH' : network === 'testnet' ? 'tDASH' : 'devnet DASH';
  const networkLabel = network === 'testnet' ? 'Testnet' : network === 'mainnet' ? 'Mainnet' : network;
  const family = network === 'mainnet' || network === 'testnet' ? { network: network as 'mainnet' | 'testnet' } : undefined;

  container.innerHTML = `
    <div class="platform-band fee-form-band">
      <header class="dh-page-header">
        <p class="dh-page-header__kicker">Platform tools</p>
        <h1 class="dh-page-header__title">Fee estimator</h1>
        <p class="dh-page-header__lede">See what a data contract costs to register on Platform, plan the reserve its documents need, then take the schema to Bridge.</p>
        ${identity ? `<p><a class="dh-link" href="${esc(window.dashhq.href('explorer', '/identity/?id=' + identity, family))}">Return to your identity in Explorer →</a></p>` : ''}
      </header>
      <div id="network-notice" class="dh-notice dh-notice--info" role="status" hidden>
        <p>Switched to ${esc(networkLabel)}. Your JSON, activity and reserve are kept; estimate again for this network.</p>
        <button class="dh-btn" type="button" id="undo-network">Undo network change</button>
      </div>
      <form id="estimate-form" class="dh-form" novalidate>
        <div class="dh-field">
          <label class="dh-field__label" for="example-select">Start with an example</label>
          <select class="dh-select" id="example-select">
            <option value="">Your own contract</option>
            ${EXAMPLES.map((e, i) => `<option value="${i}">${esc(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="dh-field">
          <label class="dh-field__label" for="json-input">Data contract JSON</label>
          <textarea class="dh-textarea dh-input--mono" id="json-input" rows="9" spellcheck="false" aria-describedby="json-hint error-msg" placeholder='{ "documentSchemas": { "note": { "type": "object", "properties": { "text": { "type": "string" } } } } }'></textarea>
          <p id="json-hint" class="dh-field__help">Paste a contract or choose an example. JSON is processed in this browser.</p>
        </div>
        <div class="dh-actions">
          <button class="dh-btn dh-btn--primary" id="estimate-btn" type="submit">Estimate fees</button>
          <p class="dh-field__help" id="protocol-status" role="status">Checking which protocol ${esc(networkLabel)} runs…</p>
        </div>
        <div class="dh-field__error" id="error-msg" role="alert"></div>
      </form>
    </div>

    <details class="dh-disclosure fee-details" id="contract-details">
      <summary><span>Load an existing contract</span></summary>
      <form id="load-contract-form" class="dh-field">
        <label class="dh-field__label" for="contract-id">Contract ID on ${esc(networkLabel)}</label>
        <div class="dh-inline-form"><input class="dh-input dh-input--mono" aria-describedby="contract-status" id="contract-id" autocomplete="off" spellcheck="false" required placeholder="Base58 contract ID"><button class="dh-btn" id="load-contract" type="submit">Load contract</button></div>
        <p id="contract-status" role="status" class="dh-field__help">Reads the public schema from ${esc(networkLabel)} and puts it in the JSON field.</p>
      </form>
    </details>

    <details class="dh-disclosure fee-details" id="source-details">
      <summary><span>Schedule, sources and historical estimates</span></summary>
      <p id="fee-source-description"></p>
      <p id="schedule-status" role="status"></p>
      <div class="dh-field">
        <label class="dh-field__label" for="version-select">Fee schedule</label>
        <select class="dh-select" id="version-select"></select>
        <p class="dh-field__help">Bundled tables come from Platform ${BUNDLED_FEE_TABLE.tag}. Refresh to check for a newer stable release. Historical schedules are comparisons, not current funding quotes.</p>
      </div>
      <div class="dh-actions">
        <button class="dh-btn" id="refresh-fees" type="button">Refresh protocol and fee source</button>
        <a id="fee-source-link" target="_blank" rel="noopener">Fee constants ↗</a>
      </div>
      <p id="refresh-message" role="status"></p>
      <p class="dh-sources dh-meta">
        <span><a href="${CALCULATION_URL}" target="_blank" rel="noopener">Calculation logic ↗</a></span>
        <span><a href="${DOCS_URL}" target="_blank" rel="noopener">Fee documentation ↗</a></span>
      </p>
    </details>

    <section id="result-section" class="fee-result dh-section" tabindex="-1" aria-labelledby="result-title" hidden>
      <div class="dh-section__head"><h2 class="dh-section__title" id="result-title">Registration estimate</h2></div>
      <div id="estimate-total" class="dh-stat dh-stat--key"></div>
      <p class="fee-scope">Registration fee only: storage and processing fees for the transition are extra. A contract update pays the full registration fee of the updated contract again. <a href="${UPDATE_COST_URL}" target="_blank" rel="noopener">Why ↗</a></p>
      <p class="dh-sources dh-meta" id="estimate-meta"></p>
      <div class="fee-items">
        <h3 class="dh-h3">Registration itemisation</h3>
        <div class="fee-cost-bar" id="cost-bar" role="img" aria-label="Registration cost breakdown; exact amounts follow in the table"></div>
        <table class="dh-table dh-table--stack">
          <caption class="dh-sr">Itemised registration costs</caption>
          <thead><tr><th>Item</th><th class="num">Operations</th><th class="num">Credits</th><th class="num">${unit}</th></tr></thead>
          <tbody id="fee-tbody"></tbody>
        </table>
        <p class="dh-field__help" id="contract-summary"></p>
      </div>
      <div id="plan" class="dh-section" aria-labelledby="fee-activity-title"></div>
      <details class="dh-disclosure fee-details">
        <summary><span>Full fee reference</span></summary>
        <table class="dh-table dh-table--stack">
          <thead><tr><th>Fee type</th><th class="num">Credits</th><th class="num">${unit}</th></tr></thead>
          <tbody id="constants-tbody"></tbody>
        </table>
      </details>
    </section>
    <p class="dh-elsewhere"><a href="${esc(window.dashhq.href('explorer', '/', family))}">Explorer</a><span>·</span><a href="${esc(window.dashhq.href('dapi', '/', family))}">DAPI console →</a></p>
  `;
  document.querySelector('dashhq-footer')!.innerHTML = `<div class="source-links">
      <span>Sources:</span>
      <a id="fee-constants-link" target="_blank" rel="noopener"></a>
      <a href="${CALCULATION_URL}" target="_blank" rel="noopener">Calculation logic (rs-dpp)</a>
      <a href="${DOCS_URL}" target="_blank" rel="noopener">Fee documentation</a>
    </div>`;

  const $ = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const jsonInput = $<HTMLTextAreaElement>('#json-input');
  const errorMsg = $('#error-msg');
  const resultSection = $('#result-section');
  const estimateBtn = $<HTMLButtonElement>('#estimate-btn');
  const exampleSelect = $<HTMLSelectElement>('#example-select');
  const refreshBtn = $<HTMLButtonElement>('#refresh-fees');
  const versionSelect = $<HTMLSelectElement>('#version-select');
  const feeConstantsLink = document.querySelector<HTMLAnchorElement>('#fee-constants-link')!;

  const hideResult = () => {
    resultSection.hidden = true;
    estimateBtn.classList.add('dh-btn--primary');
  };

  return {
    contractForm: $<HTMLFormElement>('#load-contract-form'),
    contractInput: $<HTMLInputElement>('#contract-id'),
    contractButton: $<HTMLButtonElement>('#load-contract'),
    contractDetails: $<HTMLDetailsElement>('#contract-details'),
    setContractStatus: (message: string) => { $('#contract-status').textContent = message; },
    showNetworkNotice: (undo: () => void) => {
      $('#network-notice').hidden = false;
      $('#undo-network').addEventListener('click', undo);
    },
    hasResult: () => !resultSection.hidden,
    getJsonInput: () => jsonInput.value,
    setJsonInput: (value: string) => { jsonInput.value = value; },
    setStatus: (message: string, warn: boolean) => {
      $('#protocol-status').textContent = message;
      $('#schedule-status').textContent = message;
      $('#protocol-status').classList.toggle('fee-warn', warn);
    },
    setSource: (source: FeeSource) => {
      const url = feeBlobUrl(source.live ? source.ref : BUNDLED_FEE_TABLE.revision, source.version);
      $('#fee-source-description').textContent = describeSource(source);
      $<HTMLAnchorElement>('#fee-source-link').href = url;
      feeConstantsLink.href = url;
      feeConstantsLink.textContent = `Fee constants (${source.version})`;
    },
    setVersionOptions: (versions: string[], selected: string) => {
      versionSelect.innerHTML = `<option value="">Current network schedule (automatic)</option>` +
        versions.map((v) => `<option value="${esc(v)}">${esc(scheduleLabel(v))}</option>`).join('');
      versionSelect.value = selected;
    },
    setBusy: (busy: boolean, message?: string) => {
      refreshBtn.disabled = busy;
      versionSelect.disabled = busy;
      refreshBtn.setAttribute('aria-busy', String(busy));
      refreshBtn.textContent = busy ? 'Reading GitHub…' : 'Refresh protocol and fee source';
      if (message !== undefined) $('#refresh-message').textContent = message;
    },
    showError: (message: string) => {
      errorMsg.textContent = message;
      jsonInput.setAttribute('aria-invalid', 'true');
      hideResult();
    },
    clearResult: () => {
      errorMsg.textContent = '';
      jsonInput.removeAttribute('aria-invalid');
      hideResult();
    },
    showResult: (estimate: FeeEstimate, parsed: ParsedContract, source: Record<string, unknown>, meta: string[], sourceUrl: string, handoff: Handoff) => {
      errorMsg.textContent = '';
      jsonInput.removeAttribute('aria-invalid');
      resultSection.hidden = false;
      estimateBtn.classList.remove('dh-btn--primary');
      $('#estimate-total').innerHTML = `<strong class="dh-stat__value">${number(estimate.totalDash)} <span class="dh-unit">${unit}</span></strong><p class="dh-stat__note">${number(estimate.totalCredits)} credits · registration only</p>`;
      $('#estimate-meta').innerHTML = meta.map((m) => `<span>${esc(m)}</span>`).join('') +
        `<span><a href="${esc(sourceUrl)}" target="_blank" rel="noopener">Source ↗</a></span>`;
      const ramp = (i: number) => `var(--dh-ramp-${(i % 5) + 1})`;
      $('#cost-bar').innerHTML = estimate.lineItems
        .map((item, i) => item.totalCostCredits > 0
          ? `<span style="flex-grow:${(item.totalCostCredits / estimate.totalCredits) * 100};background:${ramp(i)}" title="${esc(item.label)}: ${number(item.totalCostCredits)} credits"></span>`
          : '')
        .join('');
      $('#fee-tbody').innerHTML = estimate.lineItems.map((item, i) => `
        <tr>
          <td class="dh-rc-title" data-label="Item"><span class="fee-cost-key" aria-hidden="true" style="background:${ramp(i)}"></span>${esc(item.label)}
            <small class="fee-item-note">${esc(item.description)} · ${number(item.unitCostCredits)} credits per operation</small></td>
          <td class="num" data-label="Operations">${number(item.count)}</td>
          <td class="num" data-label="Credits">${number(item.totalCostCredits)}</td>
          <td class="num" data-label="${unit}">${number(item.totalCostCredits / CREDITS_PER_DASH)}</td>
        </tr>`).join('');
      const indexes = parsed.documentTypes.reduce((sum, type) => sum + type.indexes.length, 0);
      const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
      $('#contract-summary').textContent = [
        plural(parsed.documentTypes.length, 'document type', 'document types'),
        plural(indexes, 'index', 'indexes'),
        plural(parsed.tokens.length, 'token', 'tokens'),
        plural(parsed.keywords.length, 'keyword', 'keywords'),
      ].join(' · ');

      const action = document.createElement('div');
      action.className = 'fee-handoff';
      action.innerHTML = 'href' in handoff
        ? `<p>Import this schema into Bridge to review its current transition quote.</p><a id="register-contract" class="dh-btn dh-btn--primary" href="${esc(handoff.href)}">Continue to Bridge on ${esc(networkLabel)} →</a>`
        : `<p class="dh-notice dh-notice--info" id="register-contract">${esc(handoff.reason)}</p>`;
      renderPlan($('#plan'), parsed, source, estimate.totalDash, unit, action);

      const c = estimate.constants;
      const rows: [string, number | undefined][] = [
        ['Base contract registration', c.baseContractRegistrationFee],
        ['Document type registration', c.documentTypeRegistrationFee],
        ['Non-unique index', c.documentTypeBaseNonUniqueIndexRegistrationFee],
        ['Unique index', c.documentTypeBaseUniqueIndexRegistrationFee],
        ['Contested index', c.documentTypeBaseContestedIndexRegistrationFee],
        ['Token registration', c.tokenRegistrationFee],
        ['Perpetual distribution', c.tokenUsesPerpetualDistributionFee],
        ['Pre-programmed distribution', c.tokenUsesPreProgrammedDistributionFee],
        ['Once-per-identity distribution', c.tokenUsesOncePerIdentityDistributionFee],
        ['Search keyword', c.searchKeywordFee],
      ];
      $('#constants-tbody').innerHTML = rows
        .filter((row): row is [string, number] => row[1] !== undefined)
        .map(([label, credits]) => `
          <tr>
            <td data-label="Fee type" class="dh-rc-title">${esc(label)}</td>
            <td class="num" data-label="Credits">${number(credits)}</td>
            <td class="num" data-label="${unit}">${number(credits / CREDITS_PER_DASH)}</td>
          </tr>`)
        .join('');
    },
    revealResult: () => {
      if (resultSection.hidden) { jsonInput.focus(); return; }
      resultSection.focus({ preventScroll: true });
      resultSection.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    },
    onEstimate: (handler: () => void) => {
      $('#estimate-form').addEventListener('submit', (event) => { event.preventDefault(); handler(); });
    },
    onExampleSelect: (handler: (index: number) => void) => {
      exampleSelect.addEventListener('change', () => { if (exampleSelect.value !== '') handler(Number(exampleSelect.value)); });
    },
    onJsonEdit: (handler: () => void) => {
      jsonInput.addEventListener('input', () => { exampleSelect.value = ''; handler(); });
    },
    setExample: (index: number | null) => { exampleSelect.value = index === null ? '' : String(index); },
    onVersionSelect: (handler: (versionFile: string) => void) => {
      versionSelect.addEventListener('change', () => handler(versionSelect.value));
    },
    onRefresh: (handler: () => void) => { refreshBtn.addEventListener('click', handler); },
  };
}

export type Ui = ReturnType<typeof renderApp>;
