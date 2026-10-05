import { useState } from 'react';
import { Link } from 'react-router';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_PROPS, GRID_PROPS, MoneyTooltip, SERIES, useMoneyTick } from '../components/charts';
import { MoneyField } from '../components/FormFields';
import { MainCard } from '../components/MainCard';
import { Money } from '../components/Money';
import { parseNumber } from '../data/assetForm';
import { PAYMENT_KIND_LABELS } from '../data/housing';
import { forecastMonths, monthlyForecast, summarizeHousing, type WhatIf } from '../engine/forecast';
import { useUnlockedData } from '../session/SessionContext';
import { useNow } from '../session/useNow';
import { formatDate } from '../utils/format';

const LINES = [
  { key: 'net', name: '순자산', color: SERIES.net },
  { key: 'debt', name: '부채', color: SERIES.debt },
  { key: 'liquid', name: '유동자산', color: SERIES.liquid },
  { key: 'frozen', name: '동결자산', color: SERIES.frozen },
] as const;

export function HousingPage() {
  const data = useUnlockedData();
  const moneyTick = useMoneyTick();
  const now = useNow(60_000);
  const [extra, setExtra] = useState('');
  const [expense, setExpense] = useState('');
  const plan = data.housing;

  if (!plan) {
    return (
      <MainCard title="분양 일정이 아직 없습니다">
        <p className="text-muted">분양가와 계약금·중도금·잔금 일정을 입력하면, 지급일마다 자금이 충분한지 예측해 보여줍니다.</p>
        <Link to="/housing/edit" className="btn btn-primary">
          분양 일정 입력
        </Link>
      </MainCard>
    );
  }

  const whatIf: WhatIf = { monthlyExtraSaving: parseNumber(extra) || 0, monthlyExtraExpense: parseNumber(expense) || 0 };
  const input = { assets: data.assets, loans: data.loans, taxRates: data.settings.taxRates };
  const summary = summarizeHousing(input, plan, now, whatIf);
  const points = monthlyForecast(input, plan, now, forecastMonths(plan, now), whatIf);
  const short = summary.checks.filter((c) => c.status === 'short');
  const whatIfOn = whatIf.monthlyExtraSaving !== 0 || whatIf.monthlyExtraExpense !== 0;

  return (
    <>
      <div className="alert alert-secondary small">
        현재 입력한 데이터로 계산한 추정입니다. 주식·펀드는 현재 평가금액 그대로라고 가정하고, 적금은 매월 납입·대출은 스케줄대로 상환한다고 봅니다. 분양 제도 조건(청약저축 사용
        등)은 자산별 &quot;분양 시점 활용 가능&quot; 입력을 따릅니다.
      </div>

      <div className="card app-hero">
        <div className="card-body">
          <div className="d-flex justify-content-between flex-wrap gap-2">
            <p className="mb-1 app-hero-label">
              {plan.complexName || '분양'} · 예정일 {formatDate(plan.expectedDate)}
            </p>
            <Link to="/housing/edit" className="btn btn-sm btn-light">
              일정 수정
            </Link>
          </div>
          <h2 className="app-hero-value mb-2">{summary.daysLeft >= 0 ? `D-${summary.daysLeft}` : `D+${-summary.daysLeft}`}</h2>
          <div className="d-flex flex-wrap gap-4 app-hero-note">
            <span>
              분양 시점 예상 순자산 <Money value={summary.netAtExpected} />
            </span>
            <span>
              남은 자기 자금 필요액 <Money value={summary.totalOwnRemaining} />
            </span>
            <span>
              {summary.tightestMargin === null ? (
                '남은 지급 일정 없음'
              ) : summary.tightestMargin >= 0 ? (
                <>
                  가장 빠듯한 시점에도 여유 <Money value={summary.tightestMargin} />
                </>
              ) : (
                <>
                  부족 예상 <Money value={-summary.tightestMargin} /> ({summary.tightest?.payment.label})
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {short.length > 0 && (
        <div className="alert alert-danger" role="alert">
          <strong>자금 부족 경고:</strong>{' '}
          {short.map((c, i) => (
            <span key={c.payment.id}>
              {i > 0 && ', '}
              {c.payment.label}({formatDate(c.payment.date)}) <Money value={c.shortfall} /> 부족
            </span>
          ))}
        </div>
      )}

      <div className="row">
        <div className="col-xl-8">
          <MainCard title="월별 예상 자산 추이">
            <div className="app-chart-legend" aria-hidden="true">
              {LINES.map((l) => (
                <span key={l.key} className="d-inline-flex align-items-center gap-1">
                  <span className="app-chart-swatch" style={{ background: l.color }} />
                  {l.name}
                </span>
              ))}
              <span className="d-inline-flex align-items-center gap-1">
                <span className="app-chart-swatch app-chart-swatch-ref" /> 지급일
              </span>
            </div>
            <div style={{ height: 320 }} role="img" aria-label="월별 예상 자산 추이 그래프(순자산·부채·유동·동결, 점선은 지급일). 지급일별 금액은 아래 표에 있습니다.">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 24, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={(d: string) => d.slice(2, 7).replace('-', '.')} minTickGap={20} />
                  <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={60} axisLine={false} />
                  <Tooltip content={<MoneyTooltip labelFormatter={(l) => formatDate(String(l))} />} />
                  {summary.checks.map((c) => {
                    const at = points.find((p) => p.date >= c.payment.date)?.date;
                    return at ? (
                      <ReferenceLine
                        key={c.payment.id}
                        x={at}
                        stroke="var(--chart-axis)"
                        strokeDasharray="4 4"
                        label={{ value: c.payment.label, position: 'top', fill: 'var(--chart-text)', fontSize: 11 }}
                      />
                    ) : null;
                  })}
                  {LINES.map((l) => (
                    <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-muted small mt-2 mb-0">
              점선은 지급일이 속한 달입니다. 분양 대금으로 낸 자기 자금은 유동자산에서 빠지지만, 분양권(취득 원가)으로 남는다고 보고 순자산에서는 빼지 않았습니다.
            </p>
          </MainCard>
        </div>
        <div className="col-xl-4">
          <MainCard title="만약에 (저장하지 않음)">
            <div className="row">
              <MoneyField label="매월 추가로 모을 돈" value={extra} onChange={setExtra} className="col-12" />
              <MoneyField label="매월 늘어날 지출" value={expense} onChange={setExpense} className="col-12" hint="지출이 줄어들면 비워 두고 위 칸에 더하세요." />
            </div>
            {whatIfOn ? (
              <p className="small mb-0">
                월 <Money value={whatIf.monthlyExtraSaving - whatIf.monthlyExtraExpense} signed /> 기준으로 지급 판정과 그래프에 반영 중입니다.{' '}
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => {
                    setExtra('');
                    setExpense('');
                  }}
                >
                  초기화
                </button>
              </p>
            ) : (
              <p className="text-muted small mb-0">입력하면 아래 판정과 그래프가 바로 바뀝니다. 이 값은 저장되지 않습니다.</p>
            )}
          </MainCard>
        </div>
      </div>

      <MainCard title="지급일별 자금 확인" bodyClassName="p-0">
        {summary.checks.length === 0 ? (
          <p className="text-muted p-3 mb-0">
            지급 일정이 없습니다. <Link to="/housing/edit">일정 입력</Link>
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 app-asset-table">
              <thead>
                <tr>
                  <th>지급</th>
                  <th>지급일</th>
                  <th className="text-end">금액</th>
                  <th className="text-end">대출 충당</th>
                  <th className="text-end">자기 자금 필요</th>
                  <th className="text-end">예상 활용 가능 유동자산</th>
                  <th className="text-end">여유 / 부족</th>
                </tr>
              </thead>
              <tbody>
                {summary.checks.map((c) => (
                  <tr key={c.payment.id} className={c.status === 'paid' ? 'text-muted' : ''}>
                    <td>
                      <span className="badge bg-light-primary me-1">{PAYMENT_KIND_LABELS[c.payment.kind]}</span>
                      {c.payment.label}
                    </td>
                    <td className="text-nowrap">{formatDate(c.payment.date)}</td>
                    <td className="text-end">
                      <Money value={c.amount} />
                    </td>
                    <td className="text-end">
                      <Money value={c.loanCovered} />
                    </td>
                    <td className="text-end">
                      <Money value={c.own} />
                    </td>
                    <td className="text-end">{c.status === 'paid' ? '—' : <Money value={c.available} />}</td>
                    <td className="text-end text-nowrap">
                      {c.status === 'paid' ? (
                        <span className="badge bg-light-secondary">지난 일정</span>
                      ) : c.status === 'ok' ? (
                        <span className="text-success">
                          여유 <Money value={c.margin} />
                        </span>
                      ) : (
                        <span className="text-danger fw-semibold">
                          ⚠ 부족 <Money value={c.shortfall} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-muted small px-3 py-2 mb-0">
          &quot;예상 활용 가능 유동자산&quot;은 그 날짜에 유동이면서 분양 시점 활용 가능으로 표시된 자산(세후)에서 앞선 지급일에 낸 자기 자금을 뺀 값입니다.
        </p>
      </MainCard>
    </>
  );
}
