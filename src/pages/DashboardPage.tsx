import { Link } from 'react-router';
import { BackupReminderBanner } from '../components/BackupReminderBanner';
import { Icon } from '../components/Icon';
import { MainCard } from '../components/MainCard';
import { Money } from '../components/Money';
import { ASSET_TYPE_LABELS, hasMaturity, TAX_TYPE_LABELS, TAX_TYPES } from '../data/assets';
import { maturityPayout, type AssetValuation } from '../engine/interest';
import { computeNetWorth, type NetWorth } from '../engine/networth';
import { buildTips, type Tip } from '../engine/tips';
import { buildAlerts, type DdayAlert } from '../engine/alerts';
import { REPAYMENT_LABELS } from '../data/loans';
import { DAY_MS, daysUntil } from '../engine/time';
import { useDisplayPrefs, type TaxView } from '../session/DisplayPrefs';
import { useUnlockedData } from '../session/SessionContext';
import { useNow } from '../session/useNow';
import { formatDate } from '../utils/format';

export function DashboardPage() {
  const data = useUnlockedData();
  const now = useNow(100);
  const { taxView, setTaxView } = useDisplayPrefs();
  const rates = data.settings.taxRates;
  const nw = computeNetWorth({ assets: data.assets, loans: data.loans, taxRates: rates }, now);
  const p = nw.portfolio;
  const pick = (a: { gross: number; net: number }) => (taxView === 'net' ? a.net : a.gross);
  const debt = nw.debt.total;
  const perMs = pick(nw.perMs);
  const tips = buildTips(nw, rates, now);

  return (
    <>
      <BackupReminderBanner lastBackupAt={data.meta.lastBackupAt} lastDataChangeAt={data.meta.lastDataChangeAt} />
      <DdayAlerts alerts={buildAlerts({ assets: data.assets, loans: data.loans, housing: data.housing }, now)} />

      <div className="card app-hero">
        <div className="card-body">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <p className="mb-1 app-hero-label">현재 순자산 ({taxView === 'net' ? '세후' : '세전'})</p>
            <TaxViewToggle value={taxView} onChange={setTaxView} />
          </div>
          <h2 className="mb-2 app-hero-value">
            <Money value={pick(p.total) - debt} decimals={1} />
          </h2>
          <div className="d-flex flex-wrap gap-4 app-hero-note">
            <span>
              초당 <Money value={perMs * 1000} decimals={2} signed />
            </span>
            <span>
              하루 <Money value={perMs * DAY_MS} decimals={0} signed />
            </span>
            <span>예적금 이자 − 대출 이자 기준</span>
          </div>
        </div>
      </div>

      <div className="row">
        <StatCard title="유동자산" value={pick(p.liquid)} icon="payments" tone="success" note="바로 쓸 수 있는 돈 + 만기·해제된 자산" />
        <StatCard title="동결자산" value={pick(p.frozen)} icon="ac_unit" tone="primary" note="만기·해지 제한이 있는 자산" />
        <StatCard title="부채" value={debt} icon="credit_card" tone="danger" note="대출 잔액 + 미납 누적 이자" />
      </div>

      <ProductTable items={p.items} now={now} taxView={taxView} />

      <div className="row">
        <div className="col-xl-5">
          <MainCard title="세금 현황 (누적)">
            <dl className="row mb-2">
              <dt className="col-6 fw-normal text-muted">누적 이자(세전)</dt>
              <dd className="col-6 text-end">
                <Money value={p.interest.gross} decimals={1} />
              </dd>
              <dt className="col-6 fw-normal text-muted">이자소득세</dt>
              <dd className="col-6 text-end text-danger">
                <Money value={p.interest.tax} decimals={1} />
              </dd>
              <dt className="col-6 fw-normal text-muted">세후 이자</dt>
              <dd className="col-6 text-end fw-semibold">
                <Money value={p.interest.net} decimals={1} />
              </dd>
            </dl>
            <table className="table table-sm mb-0 small">
              <thead>
                <tr>
                  <th>과세유형</th>
                  <th className="text-end">세전 이자</th>
                  <th className="text-end">세금</th>
                </tr>
              </thead>
              <tbody>
                {TAX_TYPES.map((t) => (
                  <tr key={t}>
                    <td>
                      {TAX_TYPE_LABELS[t]}
                      <span className="text-muted"> ({rates[t].ratePct}%)</span>
                      {!rates[t].confirmed && <span className="badge bg-light-warning ms-1">확인 필요</span>}
                    </td>
                    <td className="text-end">
                      <Money value={p.byTax[t].interest} />
                    </td>
                    <td className="text-end">
                      <Money value={p.byTax[t].tax} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </MainCard>
        </div>
        <div className="col-xl-7">
          {nw.loans.length > 0 && <RepaymentCard nw={nw} />}
          <TipsCard tips={tips} />
        </div>
      </div>
    </>
  );
}

function TaxViewToggle({ value, onChange }: { value: TaxView; onChange: (v: TaxView) => void }) {
  return (
    <div className="btn-group btn-group-sm app-hero-toggle" role="group" aria-label="세후/세전 표시">
      {(['net', 'gross'] as const).map((v) => (
        <button key={v} type="button" className={`btn ${value === v ? 'btn-light' : 'btn-outline-light'}`} aria-pressed={value === v} onClick={() => onChange(v)}>
          {v === 'net' ? '세후' : '세전'}
        </button>
      ))}
    </div>
  );
}

function StatCard({ title, value, icon, tone, note }: { title: string; value: number; icon: string; tone: string; note?: string }) {
  return (
    <div className="col-md-4">
      <div className="card app-stat-card">
        <div className="card-body d-flex align-items-center gap-3">
          <div className={`avatar avatar-s rounded-3 bg-light-${tone} app-stat-icon`}>
            <Icon name={icon} />
          </div>
          <div className="min-w-0">
            <p className="text-muted mb-1">{title}</p>
            <h4 className="mb-0">
              <Money value={value} decimals={1} />
            </h4>
            {note && <small className="text-muted">{note}</small>}
          </div>
        </div>
      </div>
    </div>
  );
}

function DDay({ days }: { days: number }) {
  if (days > 0) return <span className={`badge ${days <= 30 ? 'bg-light-warning' : 'bg-light-secondary'}`}>D-{days}</span>;
  if (days === 0) return <span className="badge bg-light-danger">D-Day</span>;
  return <span className="badge bg-light-success">만기 도래</span>;
}

function ProductTable({ items, now, taxView }: { items: AssetValuation[]; now: number; taxView: TaxView }) {
  const data = useUnlockedData();
  return (
    <MainCard
      title="상품별 현황"
      bodyClassName="p-0"
      action={
        <Link to="/assets" className="btn btn-sm btn-light-primary">
          자산 관리
        </Link>
      }
    >
      {items.length === 0 ? (
        <div className="text-center py-5">
          <p className="text-muted">아직 등록된 자산이 없습니다.</p>
          <Link to="/assets/new" className="btn btn-primary btn-sm">
            자산 등록하기
          </Link>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 app-asset-table">
            <thead>
              <tr>
                <th>상품</th>
                <th className="text-end">현재 평가액({taxView === 'net' ? '세후' : '세전'})</th>
                <th className="text-end">이자 세전 / 세후</th>
                <th>만기</th>
                <th className="text-end">만기 예상 수령(세후)</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => {
                const a = v.asset;
                const payout = maturityPayout(a, data.settings.taxRates);
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="fw-semibold">{a.name}</div>
                      <small className="text-muted">
                        {ASSET_TYPE_LABELS[a.type]} · {v.liquid ? '유동' : '동결'}
                      </small>
                    </td>
                    <td className="text-end text-nowrap">
                      <Money value={taxView === 'net' ? v.valueNet : v.valueGross} decimals={1} />
                    </td>
                    <td className="text-end text-nowrap small">
                      {v.interestGross > 0 ? (
                        <>
                          <Money value={v.interestGross} decimals={1} />
                          <div className="text-muted">
                            <Money value={v.interestNet} decimals={1} />
                          </div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-nowrap">
                      {hasMaturity(a) ? (
                        <>
                          {formatDate(a.maturityDate)} <DDay days={daysUntil(a.maturityDate, now)} />
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-end text-nowrap">{payout ? <Money value={payout.valueNet} /> : <span className="text-muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </MainCard>
  );
}

function RepaymentCard({ nw }: { nw: NetWorth }) {
  return (
    <MainCard
      title="상환 현황"
      bodyClassName="p-0"
      action={
        <Link to="/loans" className="btn btn-sm btn-light-primary">
          대출 관리
        </Link>
      }
    >
      {nw.loans.length === 0 ? (
        <p className="text-muted p-3 mb-0">등록된 대출이 없습니다.</p>
      ) : (
        <ul className="list-group list-group-flush">
          {nw.loans.map(({ loan, state }) => (
            <li key={loan.id} className="list-group-item">
              <div className="d-flex justify-content-between flex-wrap gap-2">
                <Link to={`/loans/${loan.id}`} className="fw-semibold">
                  {loan.name}
                </Link>
                <span>
                  잔액 <Money value={state.balance} />
                </span>
              </div>
              <small className="text-muted d-block">
                {REPAYMENT_LABELS[loan.method]} · 미납 이자 <Money value={state.accruedInterest} decimals={1} />
                {state.next && (
                  <>
                    {' '}
                    · 다음 상환 {formatDate(state.next.date)} <Money value={state.next.payment} />
                  </>
                )}
                {state.payoff && ` · 완전 상환 ${state.payoff.date.slice(0, 4)}년 ${Number(state.payoff.date.slice(5, 7))}월(남은 ${state.remainingMonths}개월)`}
              </small>
              {!loan.linkedCashId && <small className="text-warning d-block">월 상환액이 현금에서 빠지지 않는 설정</small>}
            </li>
          ))}
        </ul>
      )}
    </MainCard>
  );
}

function TipsCard({ tips }: { tips: Tip[] }) {
  return (
    <MainCard title="금융 Tip">
      {tips.length === 0 ? (
        <p className="text-muted mb-0">지금은 해당하는 Tip이 없습니다.</p>
      ) : (
        <div className="d-grid gap-2">
          {tips.map((tip) => (
            <div key={tip.id} className={`border rounded p-2 app-tip app-tip-${tip.level}`}>
              <div className="fw-semibold">
                {tip.level === 'warn' ? '⚠ ' : ''}
                {tip.title}
              </div>
              <div className="small">{tip.body}</div>
              <details className="small mt-1">
                <summary className="text-muted">계산 근거 보기</summary>
                <ul className="mb-0 ps-3">
                  {tip.basis.map((b) => (
                    <li key={b}>
                      <MaskedText text={b} />
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}
      <p className="text-muted small mt-2 mb-0">투자 자문이 아닌 참고용입니다. 실제 결정 전 금융기관 안내를 확인하세요.</p>
    </MainCard>
  );
}

/** 근거 문장 속 금액(…원)을 금액 가리기 설정에 맞춰 가린다. */
function MaskedText({ text }: { text: string }) {
  const { masked } = useDisplayPrefs();
  return <>{masked ? text.replace(/[d,.]+원/g, '••••원') : text}</>;
}

const ALERT_LABEL: Record<DdayAlert['kind'], string> = { maturity: '만기', loan: '상환', housing: '분양' };

function DdayAlerts({ alerts }: { alerts: DdayAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="card app-alerts">
      <div className="card-body py-2 d-flex flex-wrap align-items-center gap-2">
        <span className="fw-semibold me-1 d-inline-flex align-items-center">
          <Icon name="notifications" className="app-btn-icon me-1" />
          다가오는 일정
        </span>
        {alerts.map((a) => (
          <Link key={a.id} to={a.link} className="app-alert-chip">
            <span className={`badge ${a.days <= 7 ? 'bg-light-danger' : 'bg-light-warning'}`}>{a.days === 0 ? 'D-Day' : `D-${a.days}`}</span>
            <span className="text-muted small">{ALERT_LABEL[a.kind]}</span>
            {a.title}
            <span className="text-muted small">{formatDate(a.date)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
