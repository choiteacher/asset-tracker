import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_PROPS, GRID_PROPS, MoneyTooltip, SERIES, useMoneyTick } from '../components/charts';
import { MainCard } from '../components/MainCard';
import { Money } from '../components/Money';
import { aggregateSnapshots, CHANGE_ACTION_LABELS, CHANGE_KIND_LABELS, type Period } from '../data/history';
import { useUnlockedData } from '../session/SessionContext';
import { formatDate, formatDateTime } from '../utils/format';

const PERIOD_LABEL: Record<Period, string> = { week: '주별', month: '월별' };
const ACTION_BADGE = { create: 'bg-light-success', update: 'bg-light-primary', delete: 'bg-light-danger' } as const;

export function HistoryPage() {
  const data = useUnlockedData();
  const moneyTick = useMoneyTick();
  const [period, setPeriod] = useState<Period>('week');
  const points = aggregateSnapshots(data.snapshots, period);
  const tick = (key: string) => (period === 'month' ? key.slice(2).replace('-', '.') : key.slice(5).replace('-', '/'));
  const log = [...data.changeLog].reverse();

  return (
    <>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <p className="text-muted small mb-0">
          잠금 해제할 때 하루 한 번 순자산·유동·동결·부채를 기록합니다(세후 기준). 기록은 암호화 데이터 안에만 저장됩니다.
        </p>
        <div className="btn-group btn-group-sm" role="group" aria-label="기간 단위">
          {(['week', 'month'] as const).map((p) => (
            <button key={p} type="button" className={`btn ${period === p ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      {points.length < 2 ? (
        <MainCard title="기록이 쌓이는 중입니다">
          <p className="text-muted mb-0">
            지금까지 기록 {data.snapshots.length}일. 서로 다른 {PERIOD_LABEL[period] === '주별' ? '주' : '달'}의 기록이 2개 이상 모이면 그래프가 표시됩니다.
          </p>
        </MainCard>
      ) : (
        <div className="row">
          <div className="col-xl-6">
            <MainCard title={`${PERIOD_LABEL[period]} 순자산 추이`}>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="key" {...AXIS_PROPS} tickFormatter={tick} minTickGap={16} />
                    <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={60} axisLine={false} />
                    <Tooltip content={<MoneyTooltip labelFormatter={(l) => `${PERIOD_LABEL[period]} ${String(l)}`} />} />
                    <Line type="monotone" dataKey="net" name="순자산" stroke={SERIES.net} strokeWidth={2} dot={points.length < 20} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </MainCard>
          </div>
          <div className="col-xl-6">
            <MainCard title="유동 / 동결 구성 변화">
              <div className="app-chart-legend" aria-hidden="true">
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="app-chart-swatch" style={{ background: SERIES.liquid }} /> 유동자산
                </span>
                <span className="d-inline-flex align-items-center gap-1">
                  <span className="app-chart-swatch" style={{ background: SERIES.frozen }} /> 동결자산
                </span>
              </div>
              <div style={{ height: 236 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                    <CartesianGrid {...GRID_PROPS} />
                    <XAxis dataKey="key" {...AXIS_PROPS} tickFormatter={tick} minTickGap={16} />
                    <YAxis {...AXIS_PROPS} tickFormatter={moneyTick} width={60} axisLine={false} />
                    <Tooltip content={<MoneyTooltip labelFormatter={(l) => `${PERIOD_LABEL[period]} ${String(l)}`} />} />
                    <Area type="monotone" dataKey="liquid" name="유동자산" stackId="a" stroke={SERIES.liquid} fill={SERIES.liquid} fillOpacity={0.35} strokeWidth={2} />
                    <Area type="monotone" dataKey="frozen" name="동결자산" stackId="a" stroke={SERIES.frozen} fill={SERIES.frozen} fillOpacity={0.35} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </MainCard>
          </div>
        </div>
      )}

      {data.snapshots.length > 0 && (
        <MainCard title="일별 기록 (표)" bodyClassName="p-0">
          <details>
            <summary className="px-3 py-2 text-muted small">펼쳐 보기 ({data.snapshots.length}일)</summary>
            <div className="table-responsive" style={{ maxHeight: 360 }}>
              <table className="table table-sm mb-0 app-asset-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th className="text-end">순자산</th>
                    <th className="text-end">유동</th>
                    <th className="text-end">동결</th>
                    <th className="text-end">부채</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.snapshots].reverse().map((s) => (
                    <tr key={s.date}>
                      <td>{formatDate(s.date)}</td>
                      <td className="text-end">
                        <Money value={s.net} />
                      </td>
                      <td className="text-end">
                        <Money value={s.liquid} />
                      </td>
                      <td className="text-end">
                        <Money value={s.frozen} />
                      </td>
                      <td className="text-end">
                        <Money value={s.debt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </MainCard>
      )}

      <MainCard title="변경 내역">
        {log.length === 0 ? (
          <p className="text-muted mb-0">아직 변경 내역이 없습니다. 자산·대출·분양 일정·설정을 바꾸면 여기에 기록됩니다.</p>
        ) : (
          <ol className="app-timeline">
            {log.slice(0, 200).map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className="app-timeline-time">{formatDateTime(e.at)}</span>
                <span className={`badge ${ACTION_BADGE[e.action]}`}>
                  {CHANGE_KIND_LABELS[e.kind]} {CHANGE_ACTION_LABELS[e.action]}
                </span>
                <span>{e.label}</span>
              </li>
            ))}
          </ol>
        )}
        {log.length > 200 && <p className="text-muted small mb-0">최근 200건만 표시합니다(보관 최대 2,000건).</p>}
      </MainCard>
    </>
  );
}
