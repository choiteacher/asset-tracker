import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { DateField, MoneyField, NumberField, SelectField, TextField } from '../components/FormFields';
import { MainCard } from '../components/MainCard';
import { TaxPresetBadge } from '../components/TaxPresetBadge';
import {
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
  DEFAULT_LIQUIDITY,
  isValid,
  LIQUIDITY_LABELS,
  monthsBetween,
  isValidIsoDate,
  TAX_TYPE_LABELS,
  TAX_TYPES,
  upsertAsset,
  validateAsset,
  type AssetType,
  type ValidationErrors,
} from '../data/assets';
import { assetToForm, emptyAssetForm, formToAsset, type AssetFormValues } from '../data/assetForm';
import { useSession, useUnlockedData } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';
import { formatRate } from '../utils/format';

function isAssetType(value: string | null): value is AssetType {
  return value !== null && (ASSET_TYPES as readonly string[]).includes(value);
}

const TYPE_OPTIONS = ASSET_TYPES.map((t) => ({ value: t, label: ASSET_TYPE_LABELS[t] }));

export function AssetFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const data = useUnlockedData();
  const existing = id ? data.assets.find((a) => a.id === id) : undefined;

  if (id && !existing) {
    return (
      <MainCard title="자산을 찾을 수 없습니다">
        <p className="text-muted">삭제되었거나 잘못된 주소입니다.</p>
        <Link to="/assets" className="btn btn-primary">
          자산 목록으로
        </Link>
      </MainCard>
    );
  }

  const typeParam = params.get('type');
  const initial = existing
    ? assetToForm(existing, new Date())
    : emptyAssetForm(isAssetType(typeParam) ? typeParam : 'deposit', new Date());
  return <AssetForm key={id ?? 'new'} initial={initial} existing={existing ? { id: existing.id, createdAt: existing.createdAt } : null} />;
}

function AssetForm({ initial, existing }: { initial: AssetFormValues; existing: { id: string; createdAt: string } | null }) {
  const data = useUnlockedData();
  const { updateData } = useSession();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');

  const ids = useMemo(() => existing ?? { id: crypto.randomUUID(), createdAt: new Date().toISOString() }, [existing]);
  const candidate = formToAsset(form, ids, new Date());
  const errors: ValidationErrors = submitted ? validateAsset(candidate) : {};

  function set<K extends keyof AssetFormValues>(key: K, value: AssetFormValues[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  /** 새로 등록할 때 유형을 바꾸면 유동/동결 기본값도 그 유형 기준으로 다시 제안한다. */
  function changeType(type: AssetType) {
    setForm((f) => ({ ...f, type, liquidity: DEFAULT_LIQUIDITY[type] }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    const asset = formToAsset(form, ids, new Date());
    if (!isValid(validateAsset(asset))) return;
    setBusy(true);
    setSaveError('');
    try {
      await updateData((d) => ({ ...d, assets: upsertAsset(d.assets, asset) }), {
        kind: 'asset',
        action: existing ? 'update' : 'create',
        label: `${ASSET_TYPE_LABELS[asset.type]} · ${asset.name}`,
      });
      navigate(`/assets?type=${asset.type}`);
    } catch (e) {
      setSaveError(toUserMessage(e));
      setBusy(false);
    }
  }

  const type = form.type;
  const interest = type === 'deposit' || type === 'savings' || type === 'subscription';
  const maturity = type === 'deposit' || type === 'savings';
  const preset = data.settings.taxRates[form.taxType];
  const maxCount =
    type === 'savings' && isValidIsoDate(form.startDate) && isValidIsoDate(form.maturityDate)
      ? Math.max(1, monthsBetween(form.startDate, form.maturityDate))
      : null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="row">
        <div className="col-xl-8">
          <MainCard title={existing ? `${ASSET_TYPE_LABELS[type]} 수정` : '자산 등록'}>
            <div className="row">
              <SelectField
                label="자산 유형"
                value={type}
                options={TYPE_OPTIONS}
                onChange={changeType}
                disabled={Boolean(existing)}
                hint={existing ? '등록 후에는 유형을 바꿀 수 없습니다. 삭제 후 새로 등록하세요.' : undefined}
              />
              <TextField label="상품명" value={form.name} onChange={(v) => set('name', v)} error={errors.name} placeholder="예: OO 정기예금" />
              <TextField
                label={type === 'cash' ? '금융기관명(선택)' : '금융기관명'}
                value={form.institution}
                onChange={(v) => set('institution', v)}
                error={errors.institution}
              />
              <DateField
                label={type === 'stock' || type === 'fund' ? '평가 기준일' : '기준일'}
                value={form.asOfDate}
                onChange={(v) => set('asOfDate', v)}
                error={errors.asOfDate}
                hint="금액을 확인한 날짜"
              />
            </div>

            <h6 className="mt-2 mb-3 text-primary">상품 정보</h6>
            <div className="row">
              {type === 'deposit' && (
                <>
                  <MoneyField label="예치원금" value={form.principal} onChange={(v) => set('principal', v)} error={errors.principal} />
                  <SelectField
                    label="이자 지급방식"
                    value={form.interestPayout}
                    options={[
                      { value: 'atMaturity', label: '만기일시지급' },
                      { value: 'monthly', label: '월이자지급' },
                    ]}
                    onChange={(v) => set('interestPayout', v)}
                    error={errors.interestPayout}
                  />
                </>
              )}
              {type === 'savings' && (
                <>
                  <MoneyField label="월납입액" value={form.monthlyAmount} onChange={(v) => set('monthlyAmount', v)} error={errors.monthlyAmount} />
                  <NumberField label="납입일(매월)" suffix="일" value={form.paymentDay} onChange={(v) => set('paymentDay', v)} error={errors.paymentDay} className="col-md-3" />
                  <NumberField
                    label="지금까지 납입 회차"
                    suffix="회"
                    value={form.paidCount}
                    onChange={(v) => set('paidCount', v)}
                    error={errors.paidCount}
                    hint={maxCount ? `최대 ${maxCount}회` : undefined}
                    className="col-md-3"
                  />
                </>
              )}
              {type === 'subscription' && (
                <>
                  <MoneyField label="현재 납입 총액" value={form.totalPaid} onChange={(v) => set('totalPaid', v)} error={errors.totalPaid} />
                  <MoneyField label="월납입액" value={form.monthlyAmount} onChange={(v) => set('monthlyAmount', v)} error={errors.monthlyAmount} />
                </>
              )}
              {(type === 'stock' || type === 'fund') && (
                <MoneyField
                  label="평가금액"
                  value={form.valuation}
                  onChange={(v) => set('valuation', v)}
                  error={errors.valuation}
                  hint="증권사 앱 등에서 확인한 금액을 직접 입력합니다."
                />
              )}
              {type === 'cash' && <MoneyField label="금액" value={form.amount} onChange={(v) => set('amount', v)} error={errors.amount} />}

              {interest && (
                <>
                  <NumberField
                    label="연이율"
                    suffix="%"
                    decimal
                    value={form.annualRatePct}
                    onChange={(v) => set('annualRatePct', v)}
                    error={errors.annualRatePct}
                    hint="세전 약정 금리"
                  />
                  <DateField label="가입일" value={form.startDate} onChange={(v) => set('startDate', v)} error={errors.startDate} />
                  {maturity && <DateField label="만기일" value={form.maturityDate} onChange={(v) => set('maturityDate', v)} error={errors.maturityDate} />}
                </>
              )}
            </div>

            {interest && (
              <>
                <h6 className="mt-2 mb-3 text-primary">과세</h6>
                <div className="row">
                  <SelectField
                    label="과세유형"
                    value={form.taxType}
                    options={TAX_TYPES.map((t) => ({ value: t, label: TAX_TYPE_LABELS[t] }))}
                    onChange={(v) => set('taxType', v)}
                    error={errors.taxType}
                    hint={
                      <>
                        설정의 세율 프리셋: <strong>{formatRate(preset.ratePct)}</strong> <TaxPresetBadge confirmed={preset.confirmed} />
                        {type === 'subscription' && <div className="mt-1">청약저축의 과세 여부는 가입 조건에 따라 다를 수 있습니다(확인 필요).</div>}
                      </>
                    }
                  />
                  {form.taxType === 'mutualPreferential' && (
                    <TextField
                      label="세율/한도 메모"
                      value={form.taxNote}
                      onChange={(v) => set('taxNote', v)}
                      error={errors.taxNote}
                      maxLength={500}
                      placeholder="예: 조합원 가입, 1인당 한도 등"
                      hint="2금융권 세금우대는 금융기관명과 함께 적용 조건을 메모해 두세요."
                    />
                  )}
                </div>
              </>
            )}
          </MainCard>
        </div>

        <div className="col-xl-4">
          <MainCard title="유동 / 동결">
            <div className="d-flex gap-3 mb-2" role="radiogroup" aria-label="유동/동결 구분">
              {(['liquid', 'frozen'] as const).map((value) => (
                <div className="form-check" key={value}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="liquidity"
                    id={`liq-${value}`}
                    checked={form.liquidity === value}
                    onChange={() => set('liquidity', value)}
                  />
                  <label className="form-check-label" htmlFor={`liq-${value}`}>
                    {LIQUIDITY_LABELS[value]}자산
                  </label>
                </div>
              ))}
            </div>
            <p className="form-text mt-0">
              {ASSET_TYPE_LABELS[type]} 기본값: <strong>{LIQUIDITY_LABELS[DEFAULT_LIQUIDITY[type]]}</strong>. 바로 쓸 수 있는 돈이면 유동,
              만기·해지 제한이 있으면 동결로 두세요.
            </p>
            <div className="row">
              <DateField
                label="동결 해제(유동화) 예정일(선택)"
                value={form.unfreezeDate}
                onChange={(v) => set('unfreezeDate', v)}
                error={errors.unfreezeDate}
                className="col-12"
                hint="이 날짜부터 유동자산으로 계산합니다(예: 청약저축 해지 예정일). 예적금은 만기일이 지나면 자동으로 유동이 됩니다."
              />
            </div>
            <div className="form-check">
              <input
                className="form-check-input"
                type="checkbox"
                id="housing-usable"
                checked={form.housingUsable}
                onChange={(e) => set('housingUsable', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="housing-usable">
                분양 시점 활용 가능
              </label>
              <div className="form-text mt-0">분양 대금으로 쓸 수 있는 자산인지 직접 판단해 체크하세요. 분양 D-day 예측에 쓰입니다.</div>
            </div>
          </MainCard>

          <MainCard title="메모">
            <textarea
              className={`form-control${errors.memo ? ' is-invalid' : ''}`}
              rows={4}
              maxLength={2000}
              aria-label="메모"
              value={form.memo}
              onChange={(e) => set('memo', e.target.value)}
            />
            {errors.memo && <div className="invalid-feedback">{errors.memo}</div>}
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
        <Link to={`/assets?type=${type}`} className="btn btn-outline-secondary">
          취소
        </Link>
      </div>
    </form>
  );
}
