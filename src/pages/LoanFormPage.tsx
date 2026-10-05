import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { DateField, MoneyField, NumberField, SelectField, TextField } from '../components/FormFields';
import { MainCard } from '../components/MainCard';
import { Money } from '../components/Money';
import { isValid, toIsoDate, type ValidationErrors } from '../data/assets';
import { parseNumber } from '../data/assetForm';
import { REPAYMENT_LABELS, REPAYMENT_METHODS, upsertById, validateLoan, type Loan, type RepaymentMethod } from '../data/loans';
import { autoMonthlyPayment, paymentDates } from '../engine/loan';
import { useSession, useUnlockedData } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';

interface LoanFormValues {
  name: string;
  institution: string;
  memo: string;
  originalAmount: string;
  balance: string;
  balanceAsOf: string;
  annualRatePct: string;
  method: RepaymentMethod;
  monthlyPayment: string;
  paymentDay: string;
  startDate: string;
  maturityDate: string;
  prepaymentFeePct: string;
  feeWaiverDate: string;
  linkedCashId: string;
}

const won = (n: number) => (Number.isFinite(n) ? n.toLocaleString('ko-KR') : '');

function toForm(loan: Loan | undefined, today: Date): LoanFormValues {
  const iso = toIsoDate(today);
  if (!loan) {
    return {
      name: '',
      institution: '',
      memo: '',
      originalAmount: '',
      balance: '',
      balanceAsOf: iso,
      annualRatePct: '',
      method: 'annuity',
      monthlyPayment: '',
      paymentDay: String(today.getDate()),
      startDate: iso,
      maturityDate: '',
      prepaymentFeePct: '0',
      feeWaiverDate: '',
      linkedCashId: '',
    };
  }
  return {
    name: loan.name,
    institution: loan.institution,
    memo: loan.memo,
    originalAmount: won(loan.originalAmount),
    balance: won(loan.balance),
    balanceAsOf: loan.balanceAsOf,
    annualRatePct: String(loan.annualRatePct),
    method: loan.method,
    monthlyPayment: loan.monthlyPayment === null ? '' : won(loan.monthlyPayment),
    paymentDay: String(loan.paymentDay),
    startDate: loan.startDate,
    maturityDate: loan.maturityDate,
    prepaymentFeePct: String(loan.prepaymentFeePct),
    feeWaiverDate: loan.feeWaiverDate ?? '',
    linkedCashId: loan.linkedCashId ?? '',
  };
}

function toLoan(f: LoanFormValues, ids: { id: string; createdAt: string }): Loan {
  return {
    id: ids.id,
    createdAt: ids.createdAt,
    updatedAt: new Date().toISOString(),
    name: f.name.trim(),
    institution: f.institution.trim(),
    memo: f.memo.trim(),
    originalAmount: parseNumber(f.originalAmount),
    balance: parseNumber(f.balance),
    balanceAsOf: f.balanceAsOf,
    annualRatePct: parseNumber(f.annualRatePct),
    method: f.method,
    monthlyPayment: f.method === 'annuity' && f.monthlyPayment.trim() ? parseNumber(f.monthlyPayment) : null,
    paymentDay: parseNumber(f.paymentDay),
    startDate: f.startDate,
    maturityDate: f.maturityDate,
    prepaymentFeePct: f.prepaymentFeePct.trim() ? parseNumber(f.prepaymentFeePct) : 0,
    feeWaiverDate: f.feeWaiverDate || null,
    linkedCashId: f.linkedCashId || null,
  };
}

export function LoanFormPage() {
  const { id } = useParams();
  const data = useUnlockedData();
  const existing = id ? data.loans.find((l) => l.id === id) : undefined;
  if (id && !existing) {
    return (
      <MainCard title="대출을 찾을 수 없습니다">
        <Link to="/loans" className="btn btn-primary">
          대출 목록으로
        </Link>
      </MainCard>
    );
  }
  return <LoanForm key={id ?? 'new'} existing={existing} />;
}

function LoanForm({ existing }: { existing: Loan | undefined }) {
  const data = useUnlockedData();
  const { updateData } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => toForm(existing, new Date()));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const ids = useMemo(
    () => (existing ? { id: existing.id, createdAt: existing.createdAt } : { id: crypto.randomUUID(), createdAt: new Date().toISOString() }),
    [existing],
  );
  const cashAssets = data.assets.filter((a) => a.type === 'cash');
  const candidate = toLoan(form, ids);
  const errors: ValidationErrors = submitted ? validateLoan(candidate, cashAssets.map((a) => a.id)) : {};
  const set = <K extends keyof LoanFormValues>(key: K, value: LoanFormValues[K]) => setForm((f) => ({ ...f, [key]: value }));

  // 원리금균등 자동 계산값(입력이 갖춰졌을 때만)
  const quickErrors = validateLoan({ ...candidate, monthlyPayment: null, linkedCashId: null });
  const auto = isValid(quickErrors) && candidate.method === 'annuity' ? autoMonthlyPayment(candidate) : null;
  const months = isValid(quickErrors) ? paymentDates(candidate).length : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const loan = toLoan(form, ids);
    if (!isValid(validateLoan(loan, cashAssets.map((a) => a.id)))) return;
    setBusy(true);
    setSaveError('');
    try {
      await updateData((d) => ({ ...d, loans: upsertById(d.loans, loan) }), {
        kind: 'loan',
        action: existing ? 'update' : 'create',
        label: loan.name,
      });
      navigate(`/loans/${loan.id}`);
    } catch (e) {
      setSaveError(toUserMessage(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="row">
        <div className="col-xl-8">
          <MainCard title={existing ? '대출 수정' : '대출 등록'}>
            <div className="row">
              <TextField label="대출명" value={form.name} onChange={(v) => set('name', v)} error={errors.name} placeholder="예: 주택담보대출" />
              <TextField label="금융기관" value={form.institution} onChange={(v) => set('institution', v)} error={errors.institution} />
              <MoneyField label="최초 대출금" value={form.originalAmount} onChange={(v) => set('originalAmount', v)} error={errors.originalAmount} />
              <NumberField label="연이율" suffix="%" decimal value={form.annualRatePct} onChange={(v) => set('annualRatePct', v)} error={errors.annualRatePct} />
              <MoneyField label="현재 잔액" value={form.balance} onChange={(v) => set('balance', v)} error={errors.balance} />
              <DateField label="잔액 기준일" value={form.balanceAsOf} onChange={(v) => set('balanceAsOf', v)} error={errors.balanceAsOf} hint="잔액을 확인한 날짜. 이후 상환일마다 스케줄대로 줄어듭니다." />
              <DateField label="대출 시작일" value={form.startDate} onChange={(v) => set('startDate', v)} error={errors.startDate} />
              <DateField label="만기일" value={form.maturityDate} onChange={(v) => set('maturityDate', v)} error={errors.maturityDate} />
            </div>

            <h6 className="mt-2 mb-3 text-primary">상환</h6>
            <div className="row">
              <SelectField
                label="상환방식"
                value={form.method}
                options={REPAYMENT_METHODS.map((m) => ({ value: m, label: REPAYMENT_LABELS[m] }))}
                onChange={(v) => set('method', v)}
                error={errors.method}
              />
              <NumberField label="매월 상환일" suffix="일" value={form.paymentDay} onChange={(v) => set('paymentDay', v)} error={errors.paymentDay} />
              {form.method === 'annuity' && (
                <MoneyField
                  label="월 상환액(선택)"
                  value={form.monthlyPayment}
                  onChange={(v) => set('monthlyPayment', v)}
                  error={errors.monthlyPayment}
                  hint={
                    auto !== null ? (
                      <>
                        자동 계산값: <Money value={auto} />
                        {months !== null && ` (남은 ${months}회)`}. 은행 안내 금액과 다르면 직접 입력하세요.
                        {candidate.monthlyPayment !== null && Number.isFinite(candidate.monthlyPayment) && (
                          <>
                            {' '}
                            차이: <Money value={candidate.monthlyPayment - auto} signed />
                          </>
                        )}
                      </>
                    ) : (
                      '비워 두면 자동 계산값을 씁니다.'
                    )
                  }
                />
              )}
              <SelectField
                label="월 상환액을 차감할 현금 항목(선택)"
                value={form.linkedCashId}
                options={[{ value: '', label: '연결 안 함' }, ...cashAssets.map((a) => ({ value: a.id, label: a.name }))]}
                onChange={(v) => set('linkedCashId', v)}
                error={errors.linkedCashId}
                hint={
                  form.linkedCashId
                    ? '상환일마다 이 현금 항목에서 상환액이 자동으로 빠집니다.'
                    : '연결하지 않으면 상환해도 현금이 줄지 않아 순자산이 실제보다 크게 보일 수 있습니다.'
                }
              />
            </div>
          </MainCard>
        </div>
        <div className="col-xl-4">
          <MainCard title="중도상환수수료">
            <div className="row">
              <NumberField
                label="수수료율"
                suffix="%"
                decimal
                value={form.prepaymentFeePct}
                onChange={(v) => set('prepaymentFeePct', v)}
                error={errors.prepaymentFeePct}
                className="col-12"
                hint="대출 약정서 기준으로 입력하세요(확인 필요)."
              />
              <DateField label="수수료 면제 시점(선택)" value={form.feeWaiverDate} onChange={(v) => set('feeWaiverDate', v)} error={errors.feeWaiverDate} className="col-12" />
            </div>
          </MainCard>
          <MainCard title="메모">
            <textarea className="form-control" rows={4} maxLength={2000} aria-label="메모" value={form.memo} onChange={(e) => set('memo', e.target.value)} />
          </MainCard>
        </div>
      </div>
      {submitted && !isValid(errors) && (
        <div className="alert alert-danger" role="alert">
          입력값을 확인해 주세요. 빨간색으로 표시된 항목이 있습니다.
        </div>
      )}
      {saveError && <div className="alert alert-danger">{saveError}</div>}
      <div className="d-flex gap-2 mb-4">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? '암호화해서 저장하는 중…' : existing ? '수정 저장' : '등록'}
        </button>
        <Link to={existing ? `/loans/${existing.id}` : '/loans'} className="btn btn-outline-secondary">
          취소
        </Link>
      </div>
    </form>
  );
}
