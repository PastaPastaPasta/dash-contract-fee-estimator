import type { FeeEstimate, ParsedContract } from '../lib/types';
import { creditsToDash, formatCredits } from './formatter';
import { scheduleLabel } from '../lib/schedules';
import { EXAMPLES } from './examples';
import { BUNDLED_FEE_TABLE } from '../lib/constants';
import { encodeContractHandoff } from '../lib/contract-source';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderApp(container: HTMLElement): {
  getJsonInput: () => string;
  setProtocolStatus: (message: string) => void;
  setJsonInput: (val: string) => void;
  showResult: (estimate: FeeEstimate, parsed: ParsedContract) => void;
  showError: (msg: string) => void;
  clearResult: () => void;
  setFeeSource: (source: 'live' | 'bundled', versionFile?: string, sourceUrl?: string) => void;
  setVersionOptions: (versions: string[], selected: string) => void;
  onRefresh: (handler: () => void) => void;
  setRefreshState: (loading: boolean, message?: string) => void;
  revealResult: () => void;
  onEstimate: (handler: () => void) => void;
  onExampleSelect: (handler: (index: number) => void) => void;
  onVersionSelect: (handler: (versionFile: string) => void) => void;
} {
  const params = new URLSearchParams(window.location.search);
  const network = params.get('network') ?? 'mainnet';
  const rawIdentity = params.get('identity');
  const identity = rawIdentity && /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(rawIdentity) ? rawIdentity : null;
  const unit = network === 'mainnet' ? 'DASH' : network === 'testnet' ? 'tDASH' : 'devnet DASH';
  const networkLabel = network === 'testnet' ? 'Testnet' : network === 'mainnet' ? 'Mainnet' : network;
  const bundledSource = `https://github.com/dashpay/platform/blob/${BUNDLED_FEE_TABLE.revision}/packages/rs-platform-version/src/version/fee/data_contract_registration/v2.rs`;
  const sourceDescription = `Fee table: v2 · protocols 9–13 · bundled source ${BUNDLED_FEE_TABLE.sourceDate} (${BUNDLED_FEE_TABLE.revision.slice(0, 7)}).`;
  container.innerHTML = `
    <div class="page-intro">
      <p class="tool-links"><a href="${window.dashhq.href('explorer', '/', { network: network as 'mainnet' | 'testnet' })}">Explorer</a><span>·</span><a href="${window.dashhq.href('dapi', '/', { network: network as 'mainnet' | 'testnet' })}">DAPI console →</a></p>
      <h1>Estimate contract fees</h1>
      <p>See what a data contract costs to register on Platform. JSON is processed here; Continue to Bridge carries it to the registration flow.</p>
      ${identity ? `<p class="field-hint">Continue from <a href="${esc(window.dashhq.href('explorer', '/identity/?id=' + identity, { network: network as 'mainnet' | 'testnet' }))}">your identity in Explorer →</a>. Estimate registration, plan a reserve, then review in Bridge.</p>` : ''}
    </div>
    <div class="fee-source">
      <p id="fee-source-description">${sourceDescription}</p>
      <p id="protocol-status" role="status">Reading current protocol…</p>
      <div class="fee-source-actions">
        <button class="dh-btn" id="refresh-fees" type="button">Refresh protocol and fee source</button>
        <label for="version-select" class="visually-hidden">Fee table version</label>
        <select id="version-select" disabled><option value="v2.rs">v2 · protocols 9–13</option></select>
        <a id="fee-source-link" href="${bundledSource}" target="_blank" rel="noopener">View source ↗</a>
      </div>
      <p id="refresh-message" role="status"></p>
    </div>

    <section class="input-section">
      <form id="load-contract-form" class="contract-loader">
        <label for="contract-id">Existing contract ID (base58)</label>
        <div><input id="contract-id" autocomplete="off" spellcheck="false" required placeholder="Paste a contract ID from Explorer"><button class="dh-btn" id="load-contract" type="submit">Load contract</button></div>
        <p id="contract-status" role="status" class="field-hint">Optional: load a public schema from ${esc(networkLabel)}, or paste JSON below.</p>
      </form>
      <div class="input-header">
        <label for="json-input">Data contract JSON</label>
        <div class="input-actions">
          <select id="example-select" aria-label="Load an example">
            <option value="">Load an example…</option>
            ${EXAMPLES.map((e, i) => `<option value="${i}">${e.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <textarea id="json-input" rows="16" spellcheck="false" aria-describedby="json-hint error-msg" placeholder='{
  "documentSchemas": {
    "myDocument": {
      "type": "object",
      "indices": [
        { "name": "byField", "properties": [{ "field": "asc" }], "unique": true }
      ],
      "properties": {
        "field": { "type": "string" }
      }
    }
  }
}'></textarea>
      <p id="json-hint" class="field-hint">Paste a contract or choose an example. Estimates cover registration fees; processing and storage costs are additional.</p>
      <div class="input-footer">
        <button class="dh-btn dh-btn--primary" id="estimate-btn">Estimate fees</button>
        <span id="error-msg" class="error-msg" role="alert"></span>
      </div>
    </section>

    <section id="result-section" class="result-section hidden" tabindex="-1" aria-labelledby="result-title">
      <h2 id="result-title">Registration estimate</h2>
      <div id="estimate-total" class="estimate-total" role="status"></div>
      <p id="estimate-protocol" class="field-hint"></p>
      <p id="estimate-source" class="field-hint">${sourceDescription}</p>
      <p class="field-hint">Itemised registration fees in ${unit}.</p>
      <table class="fee-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Count</th>
            <th class="num">Unit (${unit})</th>
            <th class="num">Total (${unit})</th>
          </tr>
        </thead>
        <tbody id="fee-tbody"></tbody>
        <tfoot id="fee-tfoot"></tfoot>
      </table>

      <div id="summary-section" class="summary-section"></div>
      <div class="budget-section">
        <h3>Plan the funding</h3>
        <p>The registration estimate is the minimum component. Processing depends on the final transition and signatures; storage depends on bytes and retention. Later document writes, tokens and name contests cost extra. An existing contract’s original registration is already paid.</p>
        <label for="planned-reserve">Your additional reserve (${unit})</label>
        <input id="planned-reserve" type="number" min="0" step="0.0001" inputmode="decimal" placeholder="Choose a reserve">
        <p id="funding-plan" class="field-hint" role="status">Choose a reserve for processing, storage and future writes. This is a planning allowance, not a fee quote.</p>
        <p class="field-hint">Next: import this schema into Bridge, choose your identity, then request its current transition estimate before funding or signing. Budget for that quote plus the writes your app will make; there is no universal reserve. ${network === 'mainnet' ? 'Mainnet · real DASH.' : 'Testnet · practice funds have no monetary value.'}</p>
        <a id="register-contract" class="dh-btn continue-link">Continue to Bridge on ${esc(networkLabel)} →</a>
      </div>

      <div class="sources-section">
        <h3>Fee reference</h3>
        <table class="constants-table">
          <thead>
            <tr>
              <th>Fee type</th>
              <th class="num">Credits</th>
              <th class="num">${unit}</th>
            </tr>
          </thead>
          <tbody id="constants-tbody"></tbody>
        </table>

      </div>
    </section>
  `;
  document.querySelector('dashhq-footer')!.innerHTML = `        <div class="source-links">
          <span>Sources:</span>
          <a id="fee-constants-link" href="https://github.com/dashpay/platform/blob/master/packages/rs-platform-version/src/version/fee/data_contract_registration/v2.rs" target="_blank" rel="noopener">Fee constants (v2.rs)</a>
          <a href="https://github.com/dashpay/platform/blob/master/packages/rs-dpp/src/data_contract/methods/registration_cost/v1/mod.rs" target="_blank" rel="noopener">Calculation logic (rs-dpp)</a>
          <a href="https://docs.dash.org/projects/platform/en/stable/docs/explanations/fees.html" target="_blank" rel="noopener">Fee documentation</a>
        </div>`;


  const jsonInput = container.querySelector<HTMLTextAreaElement>('#json-input')!;
  const errorMsg = container.querySelector<HTMLSpanElement>('#error-msg')!;
  const resultSection = container.querySelector<HTMLElement>('#result-section')!;
  const feeTbody = container.querySelector<HTMLTableSectionElement>('#fee-tbody')!;
  const feeTfoot = container.querySelector<HTMLTableSectionElement>('#fee-tfoot')!;
  const summarySection = container.querySelector<HTMLElement>('#summary-section')!;
  const constantsTbody = container.querySelector<HTMLTableSectionElement>('#constants-tbody')!;
  const estimateBtn = container.querySelector<HTMLButtonElement>('#estimate-btn')!;
  const exampleSelect = container.querySelector<HTMLSelectElement>('#example-select')!;
  const feeDescription = container.querySelector<HTMLElement>('#fee-source-description')!;
  const refreshBtn = container.querySelector<HTMLButtonElement>('#refresh-fees')!;
  const refreshMessage = container.querySelector<HTMLElement>('#refresh-message')!;
  const versionSelect = container.querySelector<HTMLSelectElement>('#version-select')!;
  const feeSourceLink = container.querySelector<HTMLAnchorElement>('#fee-source-link')!;
  versionSelect.dataset.activeVersion = 'v2.rs';
  const feeConstantsLink = document.querySelector<HTMLAnchorElement>('#fee-constants-link');
  if (feeConstantsLink) { feeConstantsLink.href = bundledSource; feeConstantsLink.textContent = 'Fee constants (v2.rs)'; }
  let registrationDash = 0;
  const reserve = container.querySelector<HTMLInputElement>('#planned-reserve')!;
  reserve.addEventListener('input', () => {
    const amount = Number(reserve.value);
    container.querySelector('#funding-plan')!.textContent = reserve.value && Number.isFinite(amount) && amount >= 0
      ? `Planned funding: ${(registrationDash + amount).toLocaleString('en-US', { maximumFractionDigits: 8 })} ${unit} = registration + your ${amount} ${unit} reserve. Actual transaction costs may differ.`
      : 'Choose a reserve for processing, storage and future writes. This is a planning allowance, not a fee quote.';
  });

  return {
    setProtocolStatus: (message: string) => { container.querySelector('#protocol-status')!.textContent = message; container.querySelector('#estimate-protocol')!.textContent = message; },
    getJsonInput: () => jsonInput.value,
    setJsonInput: (val: string) => { jsonInput.value = val; },
    showResult: (estimate: FeeEstimate, parsed: ParsedContract) => {
      errorMsg.textContent = '';
      jsonInput.removeAttribute('aria-invalid');
      resultSection.classList.remove('hidden');
      registrationDash = estimate.totalDash;
      reserve.dispatchEvent(new Event('input'));
      const bridgeLink = container.querySelector<HTMLAnchorElement>('#register-contract')!;
      const encoded = encodeContractHandoff(jsonInput.value);
      if (encoded.length <= 24000 && (network === 'mainnet' || network === 'testnet')) {
        bridgeLink.href = window.dashhq.href('bridge', '/?mode=contract&from=fees&feeSchedule=' + encodeURIComponent(versionSelect.dataset.activeVersion ?? '') + '&registrationCredits=' + estimate.totalCredits + '&contract=' + encoded + (identity ? '&identity=' + encodeURIComponent(identity) : ''), { network });
        bridgeLink.textContent = `Continue to Bridge on ${networkLabel} →`;
      } else {
        bridgeLink.removeAttribute('href');
        bridgeLink.textContent = 'Open Bridge from the family menu and paste this schema. It is too large for a link, or this network needs its own Bridge.';
      }
      container.querySelector('#estimate-total')!.innerHTML = `<strong>${creditsToDash(estimate.totalCredits)} <span>${unit}</span></strong><p>${formatCredits(estimate.totalCredits)} credits · registration only</p>`;

      feeTbody.innerHTML = estimate.lineItems
        .map((item) => `
          <tr>
            <td>
              <span class="item-label">${esc(item.label)}</span>
              <span class="item-desc">${esc(item.description)}</span>
            </td>
            <td class="num" data-label="Count">${item.count}</td>
            <td class="num" data-label="Unit · ${unit}">${creditsToDash(item.unitCostCredits)}</td>
            <td class="num" data-label="Total · ${unit}">${creditsToDash(item.totalCostCredits)}</td>
          </tr>
        `)
        .join('');

      feeTfoot.innerHTML = `
        <tr class="total-row">
          <td><strong>Total</strong></td>
          <td class="num"></td>
          <td class="num"></td>
          <td class="num">
            <strong>${creditsToDash(estimate.totalCredits)} ${unit}</strong>
            <span class="credits-display">${formatCredits(estimate.totalCredits)} credits</span>
          </td>
        </tr>
      `;

      const uniqueCount = parsed.documentTypes.reduce(
        (sum, dt) => sum + dt.indexes.filter((i) => i.unique && !i.contested).length, 0,
      );
      const nonUniqueCount = parsed.documentTypes.reduce(
        (sum, dt) => sum + dt.indexes.filter((i) => !i.unique && !i.contested).length, 0,
      );
      const contestedCount = parsed.documentTypes.reduce(
        (sum, dt) => sum + dt.indexes.filter((i) => i.contested).length, 0,
      );
      const totalIndexes = uniqueCount + nonUniqueCount + contestedCount;

      const indexParts = [
        uniqueCount > 0 ? `${uniqueCount} unique` : '',
        nonUniqueCount > 0 ? `${nonUniqueCount} non-unique` : '',
        contestedCount > 0 ? `${contestedCount} contested` : '',
      ].filter(Boolean).join(', ');

      summarySection.innerHTML = `
        <h3>Contract summary</h3>
        <ul>
          <li>${parsed.documentTypes.length} document type${parsed.documentTypes.length !== 1 ? 's' : ''}${
            parsed.documentTypes.length > 0
              ? ` (${parsed.documentTypes.map((d) => esc(d.name)).join(', ')})`
              : ''
          }</li>
          <li>${totalIndexes} index${totalIndexes !== 1 ? 'es' : ''}${indexParts ? ` (${indexParts})` : ''}</li>
          <li>${parsed.tokens.length} token${parsed.tokens.length !== 1 ? 's' : ''}</li>
          <li>${parsed.keywords.length} keyword${parsed.keywords.length !== 1 ? 's' : ''}${
            parsed.keywords.length > 0 ? ` (${parsed.keywords.map((k) => esc(k)).join(', ')})` : ''
          }</li>
        </ul>
      `;

      const c = estimate.constants;
      const constRows: [string, number][] = [
        ['Base contract registration', c.baseContractRegistrationFee],
        ['Document type registration', c.documentTypeRegistrationFee],
        ['Non-unique index', c.documentTypeBaseNonUniqueIndexRegistrationFee],
        ['Unique index', c.documentTypeBaseUniqueIndexRegistrationFee],
        ['Contested index', c.documentTypeBaseContestedIndexRegistrationFee],
        ['Token registration', c.tokenRegistrationFee],
        ['Perpetual distribution', c.tokenUsesPerpetualDistributionFee],
        ['Pre-programmed distribution', c.tokenUsesPreProgrammedDistributionFee],
        ['Search keyword', c.searchKeywordFee],
      ];
      if (c.tokenUsesOncePerIdentityDistributionFee !== undefined) constRows.push(['Once-per-identity distribution', c.tokenUsesOncePerIdentityDistributionFee]);
      constantsTbody.innerHTML = constRows
        .map(([label, credits]) => `
          <tr>
            <td>${esc(label)}</td>
            <td class="num" data-label="Credits">${formatCredits(credits)}</td>
            <td class="num" data-label="${unit}">${creditsToDash(credits)}</td>
          </tr>
        `)
        .join('');
    },
    showError: (msg: string) => {
      errorMsg.textContent = msg;
      jsonInput.setAttribute('aria-invalid', 'true');
      resultSection.classList.add('hidden');
    },
    clearResult: () => {
      resultSection.classList.add('hidden');
      errorMsg.textContent = '';
      jsonInput.removeAttribute('aria-invalid');
    },
    setFeeSource: (source: 'live' | 'bundled', versionFile?: string, sourceUrl?: string) => {
      versionSelect.dataset.activeVersion = versionFile ?? '';
      versionSelect.value = versionFile ?? '';
      const pinned = `https://github.com/dashpay/platform/blob/${BUNDLED_FEE_TABLE.revision}/packages/rs-platform-version/src/version/fee/data_contract_registration/${versionFile}`;
      if (source === 'bundled') sourceUrl = pinned;
      feeDescription.textContent = source === 'live'
        ? `Fee table: ${scheduleLabel(versionFile ?? '')} · source ref master · fetched ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC.`
        : `Fee table: ${scheduleLabel(versionFile ?? '')} · bundled source ${BUNDLED_FEE_TABLE.sourceDate} (${BUNDLED_FEE_TABLE.revision.slice(0, 7)}).`;
      container.querySelector('#estimate-source')!.textContent = feeDescription.textContent;
      if (sourceUrl) {
        feeSourceLink.href = sourceUrl;
      }
      if (versionFile && feeConstantsLink) {
        feeConstantsLink.textContent = `Fee constants (${versionFile})`;
        if (sourceUrl) feeConstantsLink.href = sourceUrl;
      }
    },
    setVersionOptions: (versions: string[], selected: string) => {
      versionSelect.innerHTML = versions
        .map((v) => {
          const label = scheduleLabel(v);
          const isSelected = v === selected ? ' selected' : '';
          return `<option value="${esc(v)}"${isSelected}>${esc(label)}</option>`;
        })
        .join('');
      versionSelect.disabled = false;
    },
    onRefresh: (handler: () => void) => { refreshBtn.addEventListener('click', handler); },
    setRefreshState: (loading: boolean, message = '') => {
      refreshBtn.disabled = loading;
      if (!loading) versionSelect.value = versionSelect.dataset.activeVersion ?? '';
      versionSelect.disabled = loading || !versionSelect.querySelector('option[value$=".rs"]');
      refreshBtn.textContent = loading ? 'Reading GitHub…' : 'Refresh protocol and fee source';
      refreshMessage.textContent = message;
    },
    revealResult: () => {
      if (!resultSection.classList.contains('hidden')) {
        resultSection.focus({ preventScroll: true });
        resultSection.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
      } else jsonInput.focus();
    },
    onEstimate: (handler: () => void) => {
      estimateBtn.addEventListener('click', handler);
    },
    onExampleSelect: (handler: (index: number) => void) => {
      exampleSelect.addEventListener('change', () => {
        const val = exampleSelect.value;
        if (val !== '') {
          handler(Number(val));
          exampleSelect.value = '';
        }
      });
    },
    onVersionSelect: (handler: (versionFile: string) => void) => {
      versionSelect.addEventListener('change', () => {
        const val = versionSelect.value;
        if (val) handler(val);
      });
    },
  };
}
