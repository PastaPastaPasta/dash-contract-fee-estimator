import type { FeeEstimate, ParsedContract } from '../lib/types';
import { creditsToDash, formatCredits } from './formatter';
import { EXAMPLES } from './examples';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderApp(container: HTMLElement): {
  getJsonInput: () => string;
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
  container.innerHTML = `
    <div class="page-intro">
      <p class="tool-links"><a href="${window.dashhq.href('explorer')}">Explorer</a><span>/</span><span>Tools</span><a href="${window.dashhq.href('dapi')}">DAPI console →</a></p>
      <h1>Estimate contract fees</h1>
      <p>See what a data contract costs to register on Platform. Your JSON stays in this browser.</p>
    </div>
    <div class="fee-source">
      <p id="fee-source-description">Fee table: v2, bundled with this page.</p>
      <div class="fee-source-actions">
        <button id="refresh-fees" type="button">Use the latest from GitHub</button>
        <label for="version-select" class="visually-hidden">Fee table version</label>
        <select id="version-select" disabled><option value="">v2 (bundled)</option></select>
        <a id="fee-source-link" href="https://github.com/dashpay/platform/blob/master/packages/rs-platform-version/src/version/fee/data_contract_registration/v2.rs" target="_blank" rel="noopener">View source</a>
      </div>
      <p id="refresh-message" role="status"></p>
    </div>

    <section class="input-section">
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
        <button id="estimate-btn">Estimate fees</button>
        <span id="error-msg" class="error-msg" role="alert"></span>
      </div>
    </section>

    <section id="result-section" class="result-section hidden" tabindex="-1" aria-labelledby="result-title">
      <h2 id="result-title">Registration estimate</h2>
      <div id="estimate-total" class="estimate-total" role="status"></div>
      <p class="field-hint">Itemised registration fees in DASH.</p>
      <table class="fee-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Count</th>
            <th class="num">Unit (DASH)</th>
            <th class="num">Total (DASH)</th>
          </tr>
        </thead>
        <tbody id="fee-tbody"></tbody>
        <tfoot id="fee-tfoot"></tfoot>
      </table>

      <div id="summary-section" class="summary-section"></div>

      <div class="sources-section">
        <h3>Fee reference</h3>
        <table class="constants-table">
          <thead>
            <tr>
              <th>Fee type</th>
              <th class="num">Credits</th>
              <th class="num">DASH</th>
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
  const feeConstantsLink = document.querySelector<HTMLAnchorElement>('#fee-constants-link');

  return {
    getJsonInput: () => jsonInput.value,
    setJsonInput: (val: string) => { jsonInput.value = val; },
    showResult: (estimate: FeeEstimate, parsed: ParsedContract) => {
      errorMsg.textContent = '';
      jsonInput.removeAttribute('aria-invalid');
      resultSection.classList.remove('hidden');
      container.querySelector('#estimate-total')!.innerHTML = `<strong>${creditsToDash(estimate.totalCredits)} <span>DASH</span></strong><p>${formatCredits(estimate.totalCredits)} credits · registration only</p>`;

      feeTbody.innerHTML = estimate.lineItems
        .map((item) => `
          <tr>
            <td>
              <span class="item-label">${esc(item.label)}</span>
              <span class="item-desc">${esc(item.description)}</span>
            </td>
            <td class="num" data-label="Count">${item.count}</td>
            <td class="num" data-label="Unit · DASH">${creditsToDash(item.unitCostCredits)}</td>
            <td class="num" data-label="Total · DASH">${creditsToDash(item.totalCostCredits)}</td>
          </tr>
        `)
        .join('');

      feeTfoot.innerHTML = `
        <tr class="total-row">
          <td><strong>Total</strong></td>
          <td class="num"></td>
          <td class="num"></td>
          <td class="num">
            <strong>${creditsToDash(estimate.totalCredits)} DASH</strong>
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
      constantsTbody.innerHTML = constRows
        .map(([label, credits]) => `
          <tr>
            <td>${esc(label)}</td>
            <td class="num" data-label="Credits">${formatCredits(credits)}</td>
            <td class="num" data-label="DASH">${creditsToDash(credits)}</td>
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
      feeDescription.textContent = source === 'live'
        ? `Fee table: ${versionFile?.replace('.rs', '')}, fetched from GitHub.`
        : 'Fee table: v2, bundled with this page.';
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
          const label = v.replace('.rs', '');
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
      refreshBtn.textContent = loading ? 'Reading GitHub…' : 'Use the latest from GitHub';
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
