import { useState } from 'react';
import { Link } from 'react-router';
import { Icon } from '../components/Icon';
import { MainCard } from '../components/MainCard';
import { Money } from '../components/Money';
import { REPAYMENT_LABELS, removeById } from '../data/loans';
import { computeNetWorth } from '../engine/networth';
import { useSession, useUnlockedData } from '../session/SessionContext';
import { useNow } from '../session/useNow';
import { toUserMessage } from '../utils/errors';
import { formatDate, formatRate } from '../utils/format';
import { particle } from '../utils/josa';

export function LoansPage() {
  const data = useUnlockedData();
  const { updateData } = useSession();
  const now = useNow(1000);
  const [error, setError] = useState('');
  const nw = computeNetWorth({ assets: data.assets, loans: data.loans, taxRates: data.settings.taxRates }, now);

  async function onDelete(id: string, name: string) {
    if (!window.confirm(`"${name}"${particle(name, '을/를')} 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setError('');
    try {
      await updateData(
        (d) => ({
          ...d,
          loans: removeById(d.loans, id),
          housing: d.housing
            ? { ...d.housing, payments: d.housing.payments.map((p) => (p.linkedLoanId === id ? { ...p, linkedLoanId: null } : p)) }
            : null,
        }),
        { kind: 'loan', action: 'delete', label: name },
      );
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  return (
    <>
      <div className="row">
        <div className="col-md-4">
          <div className="card app-stat-card">
            <div className="card-body">
              <p className="text-muted mb-1">대출 잔액 합계</p>
              <h4 className="mb-0">
                <Money value={nw.debt.principal} />
              </h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card app-stat-card">
            <div className="card-body">
              <p className="text-muted mb-1">미납 누적 이자(지난 상환일 이후)</p>
              <h4 className="mb-0">
                <Money value={nw.debt.accrued} decimals={1} />
              </h4>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card app-stat-card">
            <div className="card-body">
              <p className="text-muted mb-1">다음 달 상환 예정액 합계</p>
              <h4 className="mb-0">
                <Money value={nw.loans.reduce((s, l) => s + (l.state.next?.payment ?? 0), 0)} />
              </h4>
            </div>
          </div>
        </div>
      </div>

      <MainCard
        title="대출 목록"
        bodyClassName="p-0"
        action={
          <Link to="/loans/new" className="btn btn-primary btn-sm d-inline-flex align-items-center">
            <Icon name="add_circle" className="app-btn-icon me-1" />
            대출 추가
          </Link>
        }
      >
        {error && <div className="alert alert-danger m-3">{error}</div>}
        {nw.loans.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted">등록된 대출이 없습니다.</p>
            <Link to="/loans/new" className="btn btn-outline-primary btn-sm">
              대출 등록하기
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 app-asset-table">
              <thead>
                <tr>
                  <th>대출</th>
                  <th>상환방식</th>
                  <th className="text-end">현재 잔액</th>
                  <th className="text-end">연이율</th>
                  <th>다음 상환</th>
                  <th>완전 상환 예정</th>
                  <th className="text-end">관리</th>
                </tr>
              </thead>
              <tbody>
                {nw.loans.map(({ loan, state }) => (
                  <tr key={loan.id}>
                    <td>
                      <Link to={`/loans/${loan.id}`} className="fw-semibold">
                        {loan.name}
                      </Link>
                      <small className="d-block text-muted">{loan.institution || '—'}</small>
                      {!loan.linkedCashId && <small className="d-block text-warning">월 상환액이 현금에서 빠지지 않는 설정</small>}
                    </td>
                    <td>{REPAYMENT_LABELS[loan.method]}</td>
                    <td className="text-end text-nowrap">
                      <Money value={state.balance} />
                    </td>
                    <td className="text-end app-num">{formatRate(loan.annualRatePct)}</td>
                    <td className="text-nowrap">
                      {state.next ? (
                        <>
                          {formatDate(state.next.date)}
                          <small className="d-block text-muted">
                            <Money value={state.next.payment} />
                          </small>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="text-nowrap">
                      {state.payoff ? (
                        <>
                          {state.payoff.date.slice(0, 7).replace('-', '년 ')}월
                          <small className="d-block text-muted">남은 {state.remainingMonths}개월</small>
                        </>
                      ) : (
                        '상환 완료'
                      )}
                    </td>
                    <td className="text-end text-nowrap">
                      <Link to={`/loans/${loan.id}`} className="btn btn-sm btn-light-secondary me-1">
                        상세
                      </Link>
                      <Link to={`/loans/${loan.id}/edit`} className="btn btn-sm btn-light-primary me-1" aria-label={`${loan.name} 수정`}>
                        수정
                      </Link>
                      <button type="button" className="btn btn-sm btn-light-danger" onClick={() => onDelete(loan.id, loan.name)} aria-label={`${loan.name} 삭제`}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MainCard>
    </>
  );
}
