import { CREDITS_PER_DASH, type ParsedContract } from '../lib/types';
import { estimateDocumentActivity, operationSource, wholeNumber } from '../lib/operations';
import { esc, number } from './formatter';

type Activity = { creates: string; updates: string; bytes: string };
const activity = new Map<string, Activity>();
let months = '3';
let manualReserve: string | null = null;

export type PlanState = { activity: [string, Activity][]; months: string; manualReserve: string | null };
export const planState = (): PlanState => ({ activity: [...activity], months, manualReserve });
export function restorePlan(state: PlanState) {
  for (const [name, values] of state.activity) activity.set(name, values);
  months = state.months;
  manualReserve = state.manualReserve;
}

const headline = (value: number) =>
  value > 0 && value < 0.001 ? '< 0.001' : value.toLocaleString('en-US', { maximumFractionDigits: 3 });

export function renderPlan(
  container: HTMLElement,
  parsed: ParsedContract,
  source: Record<string, unknown>,
  registrationDash: number,
  unit: string,
  action: HTMLElement,
): void {
  const schemas = (source.documentSchemas ?? source) as Record<string, { documentsMutable?: boolean }>;
  const config = source.config as { documentsMutableContractDefault?: boolean } | undefined;
  const types = parsed.documentTypes.map((type) => {
    const mutable = schemas[type.name]?.documentsMutable ?? config?.documentsMutableContractDefault ?? true;
    if (!activity.has(type.name)) {
      activity.set(type.name, { creates: '1000', updates: mutable ? '100' : '0', bytes: String(1024 + type.indexes.length * 64) });
    }
    return { name: type.name, mutable };
  });
  const fieldLabel = { creates: 'Creates / month', updates: 'Updates / month', bytes: 'Stored bytes / document' } as const;

  container.innerHTML = `
    <div class="fee-plan-summary" aria-live="polite">
      <h3 class="dh-h3">Registration + operating reserve</h3>
      <p class="fee-plan-total" id="plan-total"></p>
      <p class="fee-plan-exact" id="plan-exact" role="status"></p>
      <div id="plan-action"></div>
    </div>
    <div class="dh-section__head"><h2 class="dh-section__title" id="fee-activity-title">Plan your document activity</h2></div>
    <p>Set the monthly creates and updates for each document type in this contract.</p>
    ${types.length === 0 ? '<p>This contract has no document types. Token activity needs a separate budget; enter a manual reserve below.</p>' : ''}
    ${types.map(({ name, mutable }, i) => `
      <fieldset class="fee-activity" data-type="${i}">
        <legend>${esc(name)}</legend>
        <div class="fee-activity-fields">
          ${(['creates', 'updates', 'bytes'] as const).map((field) => `
            <div class="dh-field">
              <label class="dh-field__label" for="activity-${i}-${field}">${fieldLabel[field]}</label>
              <input id="activity-${i}-${field}" class="dh-input" data-field="${field}" type="number" min="${field === 'bytes' ? 1 : 0}" step="1" inputmode="numeric"
                value="${field === 'updates' && !mutable ? '0' : esc(activity.get(name)![field])}"${field === 'updates' && !mutable ? ' disabled' : ''}>
            </div>`).join('')}
        </div>
        ${mutable ? '' : '<p class="dh-field__help">This document type is immutable; updates are excluded.</p>'}
        <p class="fee-activity-result"></p>
      </fieldset>`).join('')}
    <div class="dh-field">
      <label class="dh-field__label" for="fee-months">Months to cover</label>
      <input id="fee-months" class="dh-input" type="number" min="1" step="1" inputmode="numeric" value="${esc(months)}">
    </div>
    <p class="dh-field__help">Assumes full-size writes at multiplier 1, no storage refunds, and a 25% reserve buffer.</p>
    <div id="plan-costs" aria-live="polite"></div>
    <div class="dh-field">
      <label class="dh-field__label" for="fee-reserve">Operating reserve (${unit}) · editable</label>
      <div class="dh-inline-form">
        <input id="fee-reserve" class="dh-input" type="number" min="0" step="any" inputmode="decimal" value="${esc(manualReserve ?? '')}">
        <button class="dh-btn" type="button" id="use-suggested" hidden>Use suggested reserve</button>
      </div>
    </div>
    <details class="dh-disclosure fee-details">
      <summary><span>Operating fee sources and calculation</span></summary>
      <p>Credits per write = max(100,000 minimum, stored bytes × (27,000 storage + 400 processing + 20 load) + 15,500 signature). Updates budget another full write. Monthly credits × months × 1.25 gives the suggested reserve.</p>
      <p>Stored bytes include indexes and default to 1 KiB plus 64 bytes per index; adjust to your expected size. Each write budgets perpetual storage and one ECDSA signature. Variable tree work, contested-name fees, token activity, identity creation and usernames are excluded. Review Bridge’s transition quote before funding.</p>
      <p class="dh-sources dh-meta">
        <span><a href="${operationSource('storage')}" target="_blank" rel="noopener">Storage constants ↗</a></span>
        <span><a href="${operationSource('signature')}" target="_blank" rel="noopener">Signature constants ↗</a></span>
        <span><a href="${operationSource('state_transition_min_fees')}" target="_blank" rel="noopener">Operation minimums ↗</a></span>
      </p>
    </details>`;
  container.querySelector('#plan-action')!.append(action);

  const reserveInput = container.querySelector<HTMLInputElement>('#fee-reserve')!;
  const useSuggested = container.querySelector<HTMLButtonElement>('#use-suggested')!;

  function update() {
    let monthly: number | null = types.length ? 0 : null;
    container.querySelectorAll<HTMLElement>('.fee-activity').forEach((fieldset, i) => {
      const { name, mutable } = types[i];
      const values = activity.get(name)!;
      const creates = wholeNumber(values.creates);
      const updates = mutable ? wholeNumber(values.updates) : 0;
      const bytes = wholeNumber(values.bytes, 1);
      const estimate = creates !== null && updates !== null && bytes !== null ? estimateDocumentActivity(bytes, creates, updates) : null;
      fieldset.querySelector('.fee-activity-result')!.textContent = estimate
        ? `Per create${mutable ? ' or update' : ''}: ≈ ${number(estimate.perWrite / CREDITS_PER_DASH)} ${unit}. Monthly: ≈ ${number(estimate.credits / CREDITS_PER_DASH)} ${unit} (${number(estimate.credits)} credits).`
        : 'Use whole counts of zero or more and a positive document size within the supported range.';
      monthly = estimate && monthly !== null ? monthly + estimate.credits : null;
    });
    const duration = wholeNumber(months, 1);
    const total = monthly !== null && duration !== null ? monthly * duration : null;
    const suggested = total !== null && Number.isSafeInteger(Math.ceil(total * 1.25)) ? Math.ceil(total * 1.25) : null;
    container.querySelector('#plan-costs')!.innerHTML = suggested !== null && monthly !== null && total !== null
      ? `<dl class="dh-kv dh-kv--grid" aria-label="Expected operating cost">
          <div><dt>Monthly operating cost</dt><dd>≈ ${number(monthly / CREDITS_PER_DASH)} ${unit}<small class="fee-item-note">${number(monthly)} credits</small></dd></div>
          <div><dt>Operating cost over ${esc(months)} months</dt><dd>≈ ${number(total / CREDITS_PER_DASH)} ${unit}<small class="fee-item-note">${number(total)} credits</small></dd></div>
          <div><dt>Suggested reserve · includes 25% buffer</dt><dd>${number(suggested / CREDITS_PER_DASH)} ${unit}</dd></div>
        </dl>`
      : '<p role="status">Enter valid activity and months to calculate an operating estimate.</p>';
    if (manualReserve === null) reserveInput.value = suggested === null ? '' : String(suggested / CREDITS_PER_DASH);
    useSuggested.hidden = manualReserve === null;
    const reserve = manualReserve === null
      ? suggested === null ? null : suggested / CREDITS_PER_DASH
      : manualReserve.trim() && Number.isFinite(Number(manualReserve)) && Number(manualReserve) >= 0 ? Number(manualReserve) : null;
    const ok = reserve !== null && Number.isFinite(registrationDash + reserve);
    container.querySelector('#plan-total')!.innerHTML = ok
      ? `≈ ${headline(registrationDash + reserve)} <span class="dh-unit">${unit}</span>`
      : 'Enter a valid operating reserve';
    container.querySelector('#plan-exact')!.textContent = ok
      ? `Planning balance: ${number(registrationDash + reserve)} ${unit} = ${number(registrationDash)} registration + ${number(reserve)} reserve${manualReserve === null ? ' (suggested, including 25% buffer)' : ' (manual)'}.`
      : 'Enter a reserve of zero or more.';
  }

  container.oninput = (event) => {
    const input = event.target as HTMLInputElement;
    const fieldset = input.closest<HTMLElement>('.fee-activity');
    if (fieldset) {
      const name = types[Number(fieldset.dataset.type)].name;
      activity.set(name, { ...activity.get(name)!, [input.dataset.field as keyof Activity]: input.value });
    } else if (input.id === 'fee-months') months = input.value;
    else if (input.id === 'fee-reserve') manualReserve = input.value;
    update();
  };
  useSuggested.addEventListener('click', () => {
    manualReserve = null;
    update();
    reserveInput.focus();
  });
  update();
}
