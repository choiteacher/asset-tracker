import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_PROPS, GRID_PROPS, MoneyTooltip, SERIES, useMoneyTick } from '../components/charts';
import { MoneyField } from '../components/FormFields';
import { MainCard } from '../components/MainCard';
import { Money } from '../components/Money';
import { toIsoDate } from '../data/assets';
import { parseNumber } from '../data/assetForm';
import { REPAYMENT_LABELS } from '../data/loans';
import { buildSchedule, loanStateAt, prepaymentFee, rebaseLoanAt, simulate } from '../engine/loan';
import { useUnlockedData } from '../session/SessionContext';
import { useNow } from '../session/useNow';
import { formatDate, formatRate } from '../utils/format';

export function LoanDetailPage() {
  const { id } = useParams();
  const data = useUnlockedData();
  const now = useNow(1000);
  const [showAll, setShowAll] = useState(false);
  const moneyTick = useMoneyTick();
  const loan = data.loans.find((l) => l.id === id);
  if (!loan) {
    return (
      <MainCard title="대출을 찾을 수 없습니다">
        <Link to="/loans" className="btn btn-primary">
          대출 목록으로
        </Link>
      </MainCard>
    );
  }
  const schedule = buildSchedule(loan);
  const state = loanStateAt(loan, now, schedule);
  const linkedCash = data.assets.find((a) => a.id === loan.linkedCashId);
  const chartData = [
    { date: loan.balanceAsOf, balance: loan.balance },
    ...schedule.map((r) => ({ date: r.date, balance: Math.round(r.balance) })),
  ];
  const today = toIsoDate(new Date(now));
  const rows = showAll ? schedule : schedule.filter((r) => r.dateMs > now).slice(0, 12);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h4 className="mb-0">{loan.name}</h4>
          <small className="text-muted">
            {loan.institution || '—'} · {REPAYMENT_LABELS[loan.method]} · 연 {formatRate(loan.annualRatePct)}
          </small>
        </div>
        <Link to={`/loans/${loan.id}/edit`} className="btn btn-sm btn-light-primary">
          수정
        </Link>
      </div>

      {!loan.linkedCashId && (
        <div className="alert alert-warning">
          월 상환액이 현금에서 빠지지 않는 설정입니다. 상환할수록 순자산이 실제보다 크게 보일 수 있으니, 수정 화면에서 상환 통장(현금 항목)을 연결하세요.
        </div>
      )}

      <div className="row">
        {[
          { label: '현재 잔액', value: <Money value={state.balance} /> },
          { label: '미납 누적 이자', value: <Money value={state.accruedInterest} decimals={1} /> },
          { label: `납부한 이자(${formatDate(loan.balanceAsOf)} 이후)`, value: <Money value={state.paidInterest} /> },
          { label: '남은 이자 총액', value: <Money value={state.remainingInterest} /> },
        ].map((c) => (
          <div className="col-6 col-xl-3" key={c.label}>
            <div className="card app-stat-card">
              <div className="card-body">
                <p className="text-muted mb-1 small">{c.label}</p>
                <h5 className="mb-0">{c.value}</h5>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="col-xl-7">
          <MainCard title="잔액 추이">
            <p className="text-muted small mb-2">
              완전 상환 예정: <strong>{state.payoff ? `${state.payoff.date.slice(0, 4)}년 ${Number(state.payoff.date.slice(5, 7))}월` : '상환 완료'}</strong>
              {state.payoff && ` (남은 ${state.remainingMonths}개월)`}
              {linkedCash && ` · 상환 통장: ${linkedCash.name}`}
            </p>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={(d: string) => d.slice(2, 7).replace('-', '.')} minTickGap={24} />
                  <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={56} axisLine={false} />
                  <Tooltip content={<MoneyTooltip labelFormatter={(l) => formatDate(String(l))} />} />
                  <ReferenceLine x={chartData.find((d) => d.date >= today)?.date} stroke="var(--chart-axis)" strokeDasharray="4 4" label={{ value: '오늘', fill: 'var(--chart-text)', fontSize: 11, position: 'top' }} />
                  <Line type="stepAfter" dataKey="balance" name="잔액" stroke={SERIES.debt} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </MainCard>
        </div>
        <div className="col-xl-5">
          <Simulation loanId={loan.id} now={now} />
        </div>
      </div>

      <MainCard
        title="상환 스케줄"
        bodyClassName="p-0"
        action={
          <button type="button" className="btn btn-sm btn-light-secondary" onClick={() => setShowAll((v) => !v)}>
            {showAll ? '앞으로 12회만' : `전체 ${schedule.length}회 보기`}
          </button>
        }
      >
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0 app-asset-table">
            <thead>
              <tr>
                <th>회차</th>
                <th>상환일</th>
                <th className="text-end">상환액</th>
                <th className="text-end">원금</th>
                <th className="text-end">이자</th>
                <th className="text-end">상환 후 잔액</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.index} className={r.dateMs <= now ? 'text-muted' : ''}>
                  <td>{r.index}</td>
                  <td>
                    {formatDate(r.date)}
                    {r.dateMs <= now && <span className="badge bg-light-secondary ms-1">완료</span>}
                  </td>
                  <td className="text-end">
                    <Money value={r.payment} />
                  </td>
                  <td className="text-end">
                    <Money value={r.principal} />
                  </td>
                  <td className="text-end">
                    <Money value={r.interest} />
                  </td>
                  <td className="text-end">
                    <Money value={r.balance} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    남은 상환 일정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-muted small px-3 py-2 mb-0">
          월 이율 = 연이율 ÷ 12로 계산한 추정 스케줄입니다. 실제 은행 계산(일할, 원 단위 절사 등)과 차이가 있을 수 있습니다.
        </p>
      </MainCard>
    </>
  );
}

function Simulation({ loanId, now }: { loanId: string; now: number }) {
  const data = useUnlockedData();
  const [extra, setExtra] = useState('');
  const [prepay, setPrepay] = useState('');
  const original = data.loans.find((l) => l.id === loanId)!;
  // 시뮬레이션은 오늘 시점의 잔액에서 출발한다.
  const loan = rebaseLoanAt(original, now, toIsoDate(new Date(now)));
  const extraN = parseNumber(extra);
  const prepayN = Math.min(parseNumber(prepay), loan.balance);
  const extraResult = extraN > 0 ? simulate(loan, { extraMonthly: extraN }, now) : null;
  const prepayResult = prepayN > 0 ? simulate(loan, { prepayNow: prepayN }, now) : null;

  return (
    <MainCard title="상환 시뮬레이션">
      <div className="row">
        <MoneyField label="월 상환액을 더 늘리면" value={extra} onChange={setExtra} className="col-12" />
      </div>
      {extraResult && (
        <div className="alert alert-primary py-2 small">
          월 <Money value={extraN} /> 더 내면 <strong>{extraResult.monthsSaved}개월</strong> 단축, 이자{' '}
          <strong>
            <Money value={extraResult.interestSaved} />
          </strong>{' '}
          절감 (완전 상환 {extraResult.newPayoffDate ? formatDate(extraResult.newPayoffDate) : '-'})
        </div>
      )}
      <div className="row">
        <MoneyField
          label="지금 중도상환하면"
          value={prepay}
          onChange={setPrepay}
          className="col-12"
          hint={`현재 잔액 기준. 수수료율 ${formatRate(original.prepaymentFeePct)}${original.feeWaiverDate ? `, 면제 시점 ${formatDate(original.feeWaiverDate)}` : ''}`}
        />
      </div>
      {prepayResult && (
        <div className="alert alert-primary py-2 small mb-0">
          <Money value={prepayN} /> 중도상환 시 <strong>{prepayResult.monthsSaved}개월</strong> 단축, 이자 <Money value={prepayResult.interestSaved} /> 절감 − 수수료{' '}
          <Money value={prepaymentFee(original, prepayN, now)} /> ={' '}
          <strong>
            순절감 <Money value={prepayResult.netSaving} />
          </strong>
          <div className="text-muted mt-1">중도상환 후에도 월 상환액(원금균등은 월 원금)은 그대로 두고 기간이 줄어드는 방식으로 계산했습니다.</div>
        </div>
      )}
      <p className="text-muted small mt-3 mb-0">투자 자문이 아닌 참고용 추정치입니다. 비상자금과 분양 대금 일정을 먼저 확인하세요.</p>
    </MainCard>
  );
}
