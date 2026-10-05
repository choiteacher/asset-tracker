import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Icon } from '../components/Icon';
import { MainCard } from '../components/MainCard';
import {
  ASSET_TYPE_LABELS,
  ASSET_TYPES,
  countByType,
  hasMaturity,
  isInterestBearing,
  LIQUIDITY_LABELS,
  principalAmount,
  removeAsset,
  sumPrincipalByLiquidity,
  TAX_TYPE_LABELS,
  type Asset,
  type AssetType,
} from '../data/assets';
import { useSession, useUnlockedData } from '../session/SessionContext';
import { toUserMessage } from '../utils/errors';
import { josa, particle } from '../utils/josa';
import { formatDate, formatRate } from '../utils/format';
import { Money } from '../components/Money';

type Filter = AssetType | 'all';

function isFilter(value: string | null): value is Filter {
  return value === 'all' || (value !== null && (ASSET_TYPES as readonly string[]).includes(value));
}

export function AssetsPage() {
  const data = useUnlockedData();
  const { updateData } = useSession();
  const [params, setParams] = useSearchParams();
  const [error, setError] = useState('');
  const typeParam = params.get('type');
  const filter: Filter = isFilter(typeParam) ? typeParam : 'all';

  const counts = countByType(data.assets);
  const totals = sumPrincipalByLiquidity(data.assets);
  const visible = filter === 'all' ? data.assets : data.assets.filter((a) => a.type === filter);

  async function onDelete(asset: Asset) {
    if (!window.confirm(`"${asset.name}"${particle(asset.name, '을/를')} 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setError('');
    try {
      // 이 현금 항목에 연결된 대출이 있으면 연결을 끊는다.
      await updateData(
        (d) => ({
          ...d,
          assets: removeAsset(d.assets, asset.id),
          loans: d.loans.map((l) => (l.linkedCashId === asset.id ? { ...l, linkedCashId: null } : l)),
        }),
        {
        kind: 'asset',
        action: 'delete',
          label: `${ASSET_TYPE_LABELS[asset.type]} · ${asset.name}`,
        },
      );
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  const newLink = `/assets/new${filter === 'all' ? '' : `?type=${filter}`}`;

  return (
    <>
      <div className="row">
        <SummaryCard title="유동자산 합계" value={totals.liquid} icon="payments" tone="success" />
        <SummaryCard title="동결자산 합계" value={totals.frozen} icon="ac_unit" tone="primary" />
        <SummaryCard title="합계" value={totals.total} icon="account_balance" tone="info" />
      </div>
      <p className="text-muted small mt-n2 mb-3">
        합계는 원금(납입액·평가금액) 기준이며 이자는 포함하지 않습니다. 적금은 &quot;월납입액 × 납입 회차&quot;로 계산합니다.
      </p>

      <MainCard
        title="자산 목록"
        bodyClassName="p-0"
        action={
          <Link to={newLink} className="btn btn-primary btn-sm d-inline-flex align-items-center">
            <Icon name="add_circle" className="app-btn-icon me-1" />
            자산 추가
          </Link>
        }
      >
        <ul className="nav nav-tabs app-tabs px-3 pt-2" role="tablist">
          {(['all', ...ASSET_TYPES] as Filter[]).map((t) => (
            <li className="nav-item" key={t}>
              <button
                type="button"
                role="tab"
                aria-selected={filter === t}
                className={`nav-link${filter === t ? ' active' : ''}`}
                onClick={() => setParams(t === 'all' ? {} : { type: t }, { replace: true })}
              >
                {t === 'all' ? '전체' : ASSET_TYPE_LABELS[t]}
                <span className="badge bg-light-secondary ms-1">{t === 'all' ? data.assets.length : counts[t]}</span>
              </button>
            </li>
          ))}
        </ul>

        {error && <div className="alert alert-danger m-3">{error}</div>}

        {visible.length === 0 ? (
          <div className="text-center py-5 px-3">
            <Icon name="folder_open" className="app-empty-icon" />
            <p className="text-muted mt-2">
              {filter === 'all' ? '아직 등록된 자산이 없습니다.' : `등록된 ${josa(ASSET_TYPE_LABELS[filter], '이/가')} 없습니다.`}
            </p>
            <Link to={newLink} className="btn btn-outline-primary btn-sm">
              첫 자산 등록하기
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 app-asset-table">
              <thead>
                <tr>
                  <th>상품</th>
                  <th>유형</th>
                  <th>구분</th>
                  <th className="text-end">금액(원금 기준)</th>
                  <th className="text-end">연이율</th>
                  <th>만기 / 기준일</th>
                  <th className="text-end">관리</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((asset) => (
                  <AssetRow key={asset.id} asset={asset} onDelete={() => onDelete(asset)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </MainCard>
    </>
  );
}

function SummaryCard({ title, value, icon, tone }: { title: string; value: number; icon: string; tone: string }) {
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
              <Money value={value} />
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssetRow({ asset, onDelete }: { asset: Asset; onDelete: () => void }) {
  return (
    <tr>
      <td>
        <div className="fw-semibold">{asset.name}</div>
        <small className="text-muted">
          {asset.institution || '—'}
          {isInterestBearing(asset) && ` · ${TAX_TYPE_LABELS[asset.taxType]}`}
        </small>
      </td>
      <td className="text-nowrap">{ASSET_TYPE_LABELS[asset.type]}</td>
      <td>
        <span className={`badge ${asset.liquidity === 'liquid' ? 'bg-light-success' : 'bg-light-primary'}`}>
          {LIQUIDITY_LABELS[asset.liquidity]}
        </span>
        {asset.unfreezeDate && <small className="d-block text-muted">해제 {formatDate(asset.unfreezeDate)}</small>}
      </td>
      <td className="text-end app-num text-nowrap">
        <Money value={principalAmount(asset)} />
        {asset.type === 'savings' && (
          <small className="d-block text-muted">
            월 <Money value={asset.monthlyAmount} /> × {asset.paidCount}회
          </small>
        )}
      </td>
      <td className="text-end app-num">{isInterestBearing(asset) ? formatRate(asset.annualRatePct) : '—'}</td>
      <td className="text-nowrap">
        {hasMaturity(asset) ? (
          <>
            만기 {formatDate(asset.maturityDate)}
            <small className="d-block text-muted">가입 {formatDate(asset.startDate)}</small>
          </>
        ) : (
          <>기준 {formatDate(asset.asOfDate)}</>
        )}
      </td>
      <td className="text-end text-nowrap">
        <Link to={`/assets/${asset.id}/edit`} className="btn btn-sm btn-light-primary me-1" aria-label={`${asset.name} 수정`}>
          수정
        </Link>
        <button type="button" className="btn btn-sm btn-light-danger" onClick={onDelete} aria-label={`${asset.name} 삭제`}>
          삭제
        </button>
      </td>
    </tr>
  );
}
