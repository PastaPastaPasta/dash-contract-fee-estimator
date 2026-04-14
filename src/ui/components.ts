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
  onEstimate: (handler: () => void) => void;
  onExampleSelect: (handler: (index: number) => void) => void;
  onVersionSelect: (handler: (versionFile: string) => void) => void;
} {
  container.innerHTML = `
    <header class="header">
      <h1>Dash Contract Fee Estimator</h1>
      <div class="fee-source">
        <span class="badge badge-bundled" id="fee-badge" title="Using fee constants bundled at build time. Fetching latest from GitHub...">bundled</span>
        <select id="version-select" class="version-select" title="Select fee constant version" disabled>
          <option value="">loading...</option>
        </select>
        <a class="fee-label" id="fee-source-link" href="https://github.com/dashpay/platform/blob/master/packages/rs-platform-version/src/version/fee/data_contract_registration/v2.rs" target="_blank" rel="noopener">view source</a>
      </div>
    </header>

    <section class="input-section">
      <div class="input-header">
        <label for="json-input">Paste your data contract JSON:</label>
        <div class="input-actions">
          <select id="example-select">
            <option value="">Load Example...</option>
            ${EXAMPLES.map((e, i) => `<option value="${i}">${e.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <textarea id="json-input" spellcheck="false" placeholder='{
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
      <div class="input-footer">
        <button id="estimate-btn">Estimate Fees</button>
        <span id="error-msg" class="error-msg"></span>
      </div>
    </section>

    <section id="result-section" class="result-section hidden">
      <h2>Fee Breakdown</h2>
      <table class="fee-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Count</th>
            <th class="num">Unit (Dash)</th>
            <th class="num">Total (Dash)</th>
          </tr>
        </thead>
        <tbody id="fee-tbody"></tbody>
        <tfoot id="fee-tfoot"></tfoot>
      </table>

      <div id="summary-section" class="summary-section"></div>

      <div class="sources-section">
        <h3>Fee Reference</h3>
        <table class="constants-table">
          <thead>
            <tr>
              <th>Fee Type</th>
              <th class="num">Credits</th>
              <th class="num">Dash</th>
            </tr>
          </thead>
          <tbody id="constants-tbody"></tbody>
        </table>
        <div class="source-links">
          <span>Sources:</span>
          <a id="fee-constants-link" href="https://github.com/dashpay/platform/blob/master/packages/rs-platform-version/src/version/fee/data_contract_registration/v2.rs" target="_blank" rel="noopener">Fee Constants (v2.rs)</a>
          <a href="https://github.com/dashpay/platform/blob/master/packages/rs-dpp/src/data_contract/methods/registration_cost/v1/mod.rs" target="_blank" rel="noopener">Calculation Logic (rs-dpp)</a>
          <a href="https://docs.dash.org/projects/platform/en/stable/docs/explanations/fees.html" target="_blank" rel="noopener">Fee Documentation</a>
        </div>
      </div>
    </section>
  `;

  addStyles();

  const jsonInput = container.querySelector<HTMLTextAreaElement>('#json-input')!;
  const errorMsg = container.querySelector<HTMLSpanElement>('#error-msg')!;
  const resultSection = container.querySelector<HTMLElement>('#result-section')!;
  const feeTbody = container.querySelector<HTMLTableSectionElement>('#fee-tbody')!;
  const feeTfoot = container.querySelector<HTMLTableSectionElement>('#fee-tfoot')!;
  const summarySection = container.querySelector<HTMLElement>('#summary-section')!;
  const constantsTbody = container.querySelector<HTMLTableSectionElement>('#constants-tbody')!;
  const estimateBtn = container.querySelector<HTMLButtonElement>('#estimate-btn')!;
  const exampleSelect = container.querySelector<HTMLSelectElement>('#example-select')!;
  const feeBadge = container.querySelector<HTMLSpanElement>('#fee-badge')!;
  const versionSelect = container.querySelector<HTMLSelectElement>('#version-select')!;
  const feeSourceLink = container.querySelector<HTMLAnchorElement>('#fee-source-link')!;
  const feeConstantsLink = container.querySelector<HTMLAnchorElement>('#fee-constants-link');

  return {
    getJsonInput: () => jsonInput.value,
    setJsonInput: (val: string) => { jsonInput.value = val; },
    showResult: (estimate: FeeEstimate, parsed: ParsedContract) => {
      errorMsg.textContent = '';
      resultSection.classList.remove('hidden');

      feeTbody.innerHTML = estimate.lineItems
        .map((item) => `
          <tr>
            <td>
              <span class="item-label">${esc(item.label)}</span>
              <span class="item-desc">${esc(item.description)}</span>
            </td>
            <td class="num">${item.count}</td>
            <td class="num">${creditsToDash(item.unitCostCredits)}</td>
            <td class="num">${creditsToDash(item.totalCostCredits)}</td>
          </tr>
        `)
        .join('');

      feeTfoot.innerHTML = `
        <tr class="total-row">
          <td><strong>Total</strong></td>
          <td class="num"></td>
          <td class="num"></td>
          <td class="num">
            <strong>${creditsToDash(estimate.totalCredits)} Dash</strong>
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
        <h3>Contract Summary</h3>
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
            <td class="num">${formatCredits(credits)}</td>
            <td class="num">${creditsToDash(credits)}</td>
          </tr>
        `)
        .join('');
    },
    showError: (msg: string) => {
      errorMsg.textContent = msg;
      resultSection.classList.add('hidden');
    },
    clearResult: () => {
      resultSection.classList.add('hidden');
      errorMsg.textContent = '';
    },
    setFeeSource: (source: 'live' | 'bundled', versionFile?: string, sourceUrl?: string) => {
      feeBadge.textContent = source;
      feeBadge.className = `badge badge-${source}`;
      feeBadge.title = source === 'live'
        ? `Fee constants fetched live from ${versionFile || 'DPP source'} on GitHub`
        : 'Using fee constants bundled at build time (GitHub fetch failed or pending)';
      if (source === 'bundled' && versionSelect.querySelector('option[value=""]')) {
        versionSelect.innerHTML = '<option value="">bundled</option>';
        versionSelect.disabled = true;
      }
      if (sourceUrl) {
        feeSourceLink.href = sourceUrl;
      }
      if (versionFile && feeConstantsLink) {
        feeConstantsLink.textContent = `Fee Constants (${versionFile})`;
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

function addStyles() {
  if (document.getElementById('fee-estimator-styles')) return;
  const style = document.createElement('style');
  style.id = 'fee-estimator-styles';
  style.textContent = `
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .fee-source {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }
    .badge {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-bundled {
      background: rgba(245, 158, 11, 0.15);
      color: var(--warning);
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .badge-live {
      background: rgba(34, 197, 94, 0.15);
      color: var(--success);
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .input-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .input-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }
    .input-header label {
      font-weight: 500;
      color: var(--text-primary);
    }
    .input-actions select {
      background: var(--bg-tertiary);
      color: var(--text-secondary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.35rem 0.75rem;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .input-actions select:hover {
      border-color: var(--accent);
    }

    #json-input {
      width: 100%;
      min-height: 220px;
      background: var(--bg-primary);
      color: var(--text-primary);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      line-height: 1.5;
      resize: vertical;
      tab-size: 2;
    }
    #json-input:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 2px rgba(0, 141, 228, 0.2);
    }
    #json-input::placeholder {
      color: var(--text-muted);
    }

    .input-footer {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-top: 0.75rem;
    }
    #estimate-btn {
      background: var(--accent);
      color: white;
      border: none;
      border-radius: 6px;
      padding: 0.6rem 1.5rem;
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    #estimate-btn:hover {
      background: var(--accent-hover);
    }
    .error-msg {
      color: var(--error);
      font-size: 0.85rem;
    }

    .result-section {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .result-section.hidden {
      display: none;
    }
    .result-section h2 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--text-primary);
    }

    .fee-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }
    .fee-table th {
      text-align: left;
      padding: 0.6rem 0.75rem;
      border-bottom: 2px solid var(--border);
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .fee-table th.num,
    .fee-table td.num {
      text-align: right;
    }
    .fee-table td {
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid rgba(42, 53, 80, 0.5);
      color: var(--text-primary);
    }
    .item-label {
      display: block;
      font-weight: 500;
    }
    .item-desc {
      display: block;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .total-row td {
      border-bottom: none;
      border-top: 2px solid var(--border);
      padding-top: 0.8rem;
    }
    .credits-display {
      display: block;
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: 0.2rem;
    }

    .summary-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    .summary-section h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-primary);
    }
    .summary-section ul {
      list-style: none;
      padding: 0;
    }
    .summary-section li {
      padding: 0.25rem 0;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }
    .summary-section li::before {
      content: "\\2022";
      color: var(--accent);
      font-weight: bold;
      margin-right: 0.5rem;
    }

    .sources-section {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
    }
    .sources-section h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--text-primary);
    }
    .constants-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      margin-bottom: 1rem;
    }
    .constants-table th {
      text-align: left;
      padding: 0.4rem 0.6rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-muted);
      font-weight: 500;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .constants-table th.num,
    .constants-table td.num {
      text-align: right;
    }
    .constants-table td {
      padding: 0.35rem 0.6rem;
      border-bottom: 1px solid rgba(42, 53, 80, 0.3);
      color: var(--text-secondary);
    }
    .source-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .source-links span {
      margin-right: 0.25rem;
    }
    .source-links a {
      color: var(--accent);
      text-decoration: none;
    }
    .source-links a:hover {
      text-decoration: underline;
      color: var(--accent-hover);
    }
    .source-links a:not(:last-child)::after {
      content: "\\00b7";
      margin-left: 0.5rem;
      color: var(--text-muted);
    }
    .version-select {
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 0.2rem 0.5rem;
      font-size: 0.8rem;
      cursor: pointer;
      font-family: var(--font-mono);
    }
    .version-select:hover {
      border-color: var(--accent);
    }
    .fee-label {
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.8rem;
    }
    .fee-label:hover {
      color: var(--accent);
      text-decoration: underline;
    }

    @media (max-width: 600px) {
      #app { padding: 1rem; }
      .header { flex-direction: column; align-items: flex-start; }
      .fee-table { font-size: 0.8rem; }
      .fee-table th, .fee-table td { padding: 0.4rem 0.5rem; }
    }
  `;
  document.head.appendChild(style);
}
