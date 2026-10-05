import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { DateField, MoneyField, TextField } from '../components/FormFields';
import { Icon } from '../components/Icon';
import { MainCard } from '../components/MainCard';
import { Money } from '../components/Money';
import { formatAmountInput, parseNumber } from '../data/assetForm';
import {
  createEmptyHousingPlan,
  ownFundsNeeded,
  PAYMENT_KIND_LABELS,
  paymentAmount,
  validateHousingPlan,
  type HousingPayment,
  type HousingPaymentKind,
  type HousingPlan,
} from '../data/housing';
import { useSession, useUnlockedData } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';

interface PaymentDraft {
  id: string;
  kind: HousingPaymentKind;
  label: string;
  date: string;
  mode: 'amount' | 'percent';
  value: string;
  loanCovered: string;
  linkedLoanId: string;
}

const won = (n: number) => (n ? n.toLocaleString('ko-KR') : '');

function toDrafts(plan: HousingPlan): PaymentDraft[] {
  return plan.payments.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label,
    date: p.date,
    mode: p.mode,
    value: p.mode === 'amount' ? won(p.value) : String(p.value),
    loanCovered: won(p.loanCovered),
    linkedLoanId: p.linkedLoanId ?? '',
  }));
}

function fromDrafts(drafts: PaymentDraft[]): HousingPayment[] {
  return drafts.map((d) => ({
    id: d.id,
    kind: d.kind,
    label: d.label.trim(),
    date: d.date,
    mode: d.mode,
    value: parseNumber(d.value),
    loanCovered: d.loanCovered.trim() ? parseNumber(d.loanCovered) : 0,
    linkedLoanId: d.linkedLoanId || null,
  }));
}

export function HousingFormPage() {
  const data = useUnlockedData();
  const { updateData } = useSession();
  const navigate = useNavigate();
  const initial = data.housing ?? createEmptyHousingPlan(new Date());
  const [complexName, setComplexName] = useState(initial.complexName);
  const [price, setPrice] = useState(won(initial.price));
  const [expectedDate, setExpectedDate] = useState(initial.expectedDate);
  const [memo, setMemo] = useState(initial.memo);
  const [drafts, setDrafts] = useState(() => toDrafts(initial));
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const plan: HousingPlan = { complexName: complexName.trim(), price: parseNumber(price || '0'), expectedDate, memo: memo.trim(), payments: fromDrafts(drafts) };
  const v = validateHousingPlan(plan);
  const shown = submitted ? v : { plan: {}, payments: {} as Record<string, Record<string, string | undefined>> };
  const ok = Object.keys(v.plan).length === 0 && Object.keys(v.payments).length === 0;

  function addPayment(kind: HousingPaymentKind) {
    const count = drafts.filter((d) => d.kind === kind).length;
    const label = kind === 'middle' ? `중도금 ${count + 1}회차` : PAYMENT_KIND_LABELS[kind];
    setDrafts((list) => [
      ...list,
      { id: crypto.randomUUID(), kind, label, date: expectedDate, mode: 'percent', value: '10', loanCovered: '', linkedLoanId: '' },
    ]);
  }

  function update(id: string, patch: Partial<PaymentDraft>) {
    setDrafts((list) => list.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!ok) return;
    setError('');
    try {
      await updateData((d) => ({ ...d, housing: plan }), { kind: 'housing', action: data.housing ? 'update' : 'create', label: plan.complexName || '분양 일정' });
      navigate('/housing');
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  const sorted = [...drafts].sort((a, b) => a.date.localeCompare(b.date));
  const totalAmount = plan.payments.reduce((s, p) => s + (Number.isFinite(p.value) ? paymentAmount(plan, p) : 0), 0);
  const totalOwn = plan.payments.reduce((s, p) => s + (Number.isFinite(p.value) ? ownFundsNeeded(plan, p) : 0), 0);

  return (
    <form onSubmit={onSubmit} noValidate>
      <MainCard title="분양 정보">
        <div className="row">
          <TextField label="단지명(선택)" value={complexName} onChange={setComplexName} error={shown.plan.complexName} />
          <MoneyField label="분양가" value={price} onChange={setPrice} error={shown.plan.price} />
          <DateField label="분양(입주) 예정일" value={expectedDate} onChange={setExpectedDate} error={shown.plan.expectedDate} hint="기본값은 내년 4월 1일입니다." />
          <TextField label="메모" value={memo} onChange={setMemo} maxLength={500} placeholder="예: 청약 조건, 확인할 서류 등" />
        </div>
        <p className="text-muted small mb-0">
          청약저축 사용 여부 등 분양 제도 조건은 앱이 판단하지 않습니다. 자산 관리에서 각 자산의 &quot;분양 시점 활용 가능&quot; 여부와 &quot;동결 해제(유동화)
          예정일&quot;을 직접 입력하세요.
        </p>
      </MainCard>

      <MainCard
        title="지급 일정"
        bodyClassName="p-0"
        action={
          <div className="d-flex gap-1 flex-wrap">
            {(['contract', 'middle', 'balance'] as const).map((k) => (
              <button key={k} type="button" className="btn btn-sm btn-light-primary" onClick={() => addPayment(k)}>
                <Icon name="add_circle" className="app-btn-icon me-1" />
                {PAYMENT_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        }
      >
        {sorted.length === 0 ? (
          <p className="text-muted p-3 mb-0">오른쪽 위 버튼으로 계약금·중도금·잔금을 추가하세요.</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 app-payment-table">
              <thead>
                <tr>
                  <th>구분 / 이름</th>
                  <th>지급일</th>
                  <th>금액 입력 방식</th>
                  <th>금액 또는 비율</th>
                  <th>대출로 충당</th>
                  <th className="text-end">자기 자금</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => {
                  const e = shown.payments[d.id] ?? {};
                  const p = plan.payments.find((x) => x.id === d.id)!;
                  const own = Number.isFinite(p.value) ? ownFundsNeeded(plan, p) : 0;
                  return (
                    <tr key={d.id}>
                      <td>
                        <span className="badge bg-light-primary mb-1">{PAYMENT_KIND_LABELS[d.kind]}</span>
                        <input className={`form-control form-control-sm${e.label ? ' is-invalid' : ''}`} aria-label="이름" value={d.label} maxLength={50} onChange={(ev) => update(d.id, { label: ev.target.value })} />
                      </td>
                      <td>
                        <input type="date" className={`form-control form-control-sm${e.date ? ' is-invalid' : ''}`} aria-label={`${d.label} 지급일`} value={d.date} onChange={(ev) => update(d.id, { date: ev.target.value })} />
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          aria-label={`${d.label} 입력 방식`}
                          value={d.mode}
                          onChange={(ev) => update(d.id, { mode: ev.target.value as 'amount' | 'percent', value: '' })}
                        >
                          <option value="percent">분양가 대비 %</option>
                          <option value="amount">금액(원)</option>
                        </select>
                      </td>
                      <td>
                        <div className="input-group input-group-sm">
                          <input
                            className={`form-control text-end app-num${e.value ? ' is-invalid' : ''}`}
                            aria-label={`${d.label} 금액 또는 비율`}
                            inputMode={d.mode === 'amount' ? 'numeric' : 'decimal'}
                            value={d.value}
                            onChange={(ev) => update(d.id, { value: d.mode === 'amount' ? formatAmountInput(ev.target.value) : ev.target.value.replace(/[^\d.]/g, '') })}
                          />
                          <span className="input-group-text">{d.mode === 'amount' ? '원' : '%'}</span>
                        </div>
                        {d.mode === 'percent' && Number.isFinite(p.value) && (
                          <small className="text-muted">
                            = <Money value={paymentAmount(plan, p)} />
                          </small>
                        )}
                        {e.value && <div className="invalid-feedback d-block">{e.value}</div>}
                      </td>
                      <td>
                        <div className="input-group input-group-sm mb-1">
                          <input
                            className={`form-control text-end app-num${e.loanCovered ? ' is-invalid' : ''}`}
                            aria-label={`${d.label} 대출 충당액`}
                            inputMode="numeric"
                            value={d.loanCovered}
                            onChange={(ev) => update(d.id, { loanCovered: formatAmountInput(ev.target.value) })}
                          />
                          <span className="input-group-text">원</span>
                        </div>
                        <select className="form-select form-select-sm" aria-label={`${d.label} 연결 대출`} value={d.linkedLoanId} onChange={(ev) => update(d.id, { linkedLoanId: ev.target.value })}>
                          <option value="">연결 대출 없음</option>
                          {data.loans.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.name}
                            </option>
                          ))}
                        </select>
                        {e.loanCovered && <div className="invalid-feedback d-block">{e.loanCovered}</div>}
                      </td>
                      <td className="text-end text-nowrap">
                        <Money value={own} />
                      </td>
                      <td>
                        <button type="button" className="btn btn-sm btn-light-danger" aria-label={`${d.label} 삭제`} onClick={() => setDrafts((list) => list.filter((x) => x.id !== d.id))}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="fw-semibold">
                  <td colSpan={3}>합계</td>
                  <td className="text-end">
                    <Money value={totalAmount} />
                  </td>
                  <td />
                  <td className="text-end">
                    <Money value={totalOwn} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="px-3 py-2 small text-muted">
          중도금 대출처럼 금융기관이 직접 내주는 금액은 &quot;대출로 충당&quot;에 적으세요. 그 대출은 대출 관리에 시작일을 미래로 등록해 연결하면, 시작일부터 부채로 잡힙니다.
          {shown.plan.payments && <div className="text-danger">{shown.plan.payments}</div>}
        </div>
      </MainCard>

      {submitted && !ok && <div className="alert alert-danger">입력값을 확인해 주세요.</div>}
      {error && <div className="alert alert-danger">{error}</div>}
      <div className="d-flex gap-2 mb-4">
        <button type="submit" className="btn btn-primary">
          저장
        </button>
        <Link to="/housing" className="btn btn-outline-secondary">
          취소
        </Link>
      </div>
    </form>
  );
}
