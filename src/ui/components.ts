import type { FeeEstimate, ParsedContract } from '../lib/types';
import { creditsToDash, formatCredits } from './formatter';
import { EXAMPLES } from './examples';

export function renderApp(container: HTMLElement): {
  getJsonInput: () => string;
  setJsonInput: (val: string) => void;
  showResult: (estimate: FeeEstimate, parsed: ParsedContract) => void;
  showError: (msg: string) => void;
  clearResult: () => void;
  setFeeSource: (source: 'live' | 'bundled') => void;
  onEstimate: (handler: () => void) => void;
  onExampleSelect: (handler: (index: number) => void) => void;
} {
  container.innerHTML = `
    <header class="header">
      <h1>Dash Contract Fee Estimator</h1>
      <div class="fee-source">
        <span class="badge" id="fee-badge">bundled</span>
        <span class="fee-label">Fee constants: v2 (protocol 9)</span>
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
    </section>
  `;

  addStyles();

  const jsonInput = container.querySelector<HTMLTextAreaElement>('#json-input')!;
  const errorMsg = container.querySelector<HTMLSpanElement>('#error-msg')!;
  const resultSection = container.querySelector<HTMLElement>('#result-section')!;
  const feeTbody = container.querySelector<HTMLTableSectionElement>('#fee-tbody')!;
  const feeTfoot = container.querySelector<HTMLTableSectionElement>('#fee-tfoot')!;
  const summarySection = container.querySelector<HTMLElement>('#summary-section')!;
  const estimateBtn = container.querySelector<HTMLButtonElement>('#estimate-btn')!;
  const exampleSelect = container.querySelector<HTMLSelectElement>('#example-select')!;
  const feeBadge = container.querySelector<HTMLSpanElement>('#fee-badge')!;

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
              <span class="item-label">${item.label}</span>
              <span class="item-desc">${item.description}</span>
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
              ? ` (${parsed.documentTypes.map((d) => d.name).join(', ')})`
              : ''
          }</li>
          <li>${totalIndexes} index${totalIndexes !== 1 ? 'es' : ''}${indexParts ? ` (${indexParts})` : ''}</li>
          <li>${parsed.tokens.length} token${parsed.tokens.length !== 1 ? 's' : ''}</li>
          <li>${parsed.keywords.length} keyword${parsed.keywords.length !== 1 ? 's' : ''}${
            parsed.keywords.length > 0 ? ` (${parsed.keywords.join(', ')})` : ''
          }</li>
        </ul>
      `;
    },
    showError: (msg: string) => {
      errorMsg.textContent = msg;
      resultSection.classList.add('hidden');
    },
    clearResult: () => {
      resultSection.classList.add('hidden');
      errorMsg.textContent = '';
    },
    setFeeSource: (source: 'live' | 'bundled') => {
      feeBadge.textContent = source;
      feeBadge.className = `badge badge-${source}`;
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

    @media (max-width: 600px) {
      #app { padding: 1rem; }
      .header { flex-direction: column; align-items: flex-start; }
      .fee-table { font-size: 0.8rem; }
      .fee-table th, .fee-table td { padding: 0.4rem 0.5rem; }
    }
  `;
  document.head.appendChild(style);
}
