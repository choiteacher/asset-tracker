import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { AuthShell } from './components/AuthShell';
import { Layout } from './components/Layout';
import { AssetFormPage } from './pages/AssetFormPage';
import { AssetsPage } from './pages/AssetsPage';
import { DashboardPage } from './pages/DashboardPage';
import { HousingFormPage } from './pages/HousingFormPage';
import { LoanFormPage } from './pages/LoanFormPage';
import { LoansPage } from './pages/LoansPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { UnlockPage } from './pages/UnlockPage';
import { EditGate, EditModeProvider } from './session/EditMode';
import { useSession, useUnlockedData } from './session/SessionContext';
import { useDailySnapshot } from './session/useDailySnapshot';
import { useIdleLock } from './session/useIdleLock';

// 그래프(Recharts)가 있는 화면은 처음 열 때 따로 불러와 첫 화면 로딩을 가볍게 한다.
const HousingPage = lazy(() => import('./pages/HousingPage').then((m) => ({ default: m.HousingPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const LoanDetailPage = lazy(() => import('./pages/LoanDetailPage').then((m) => ({ default: m.LoanDetailPage })));

function Loading() {
  return <p className="text-muted">불러오는 중…</p>;
}

/** 열람 화면. */
function view(title: string, element: ReactNode) {
  return (
    <Layout title={title}>
      <Suspense fallback={<Loading />}>{element}</Suspense>
    </Layout>
  );
}

/** 등록·수정 화면: 편집 모드에서만 연다. */
function edit(title: string, element: ReactNode) {
  return (
    <Layout title={title}>
      <EditGate>{element}</EditGate>
    </Layout>
  );
}

function UnlockedApp() {
  const data = useUnlockedData();
  const { lock } = useSession();
  useIdleLock(data.settings.autoLockMinutes, lock);
  useDailySnapshot();
  return (
    // 잠그면 이 컴포넌트가 내려가므로 편집 모드도 자동으로 풀린다.
    <EditModeProvider>
      <Routes>
        <Route path="/" element={view('대시보드', <DashboardPage />)} />
        <Route path="/housing" element={view('분양 D-day', <HousingPage />)} />
        <Route path="/history" element={view('자산 기록', <HistoryPage />)} />
        <Route path="/loans/:id" element={view('대출 상세', <LoanDetailPage />)} />
        <Route path="/assets" element={edit('자산 관리', <AssetsPage />)} />
        <Route path="/assets/new" element={edit('자산 등록', <AssetFormPage />)} />
        <Route path="/assets/:id/edit" element={edit('자산 수정', <AssetFormPage />)} />
        <Route path="/loans" element={edit('대출 관리', <LoansPage />)} />
        <Route path="/loans/new" element={edit('대출 등록', <LoanFormPage />)} />
        <Route path="/loans/:id/edit" element={edit('대출 수정', <LoanFormPage />)} />
        <Route path="/housing/edit" element={edit('분양 일정', <HousingFormPage />)} />
        <Route path="/settings" element={edit('설정', <SettingsPage />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </EditModeProvider>
  );
}

export function App() {
  const { status } = useSession();
  switch (status) {
    case 'loading':
      return <div className="auth-wrapper" aria-busy="true" />;
    case 'unavailable':
      return (
        <AuthShell title="저장소를 열 수 없습니다">
          <div className="alert alert-danger">
            이 브라우저에서 IndexedDB를 사용할 수 없습니다. 사생활 보호(시크릿) 모드이거나 사이트 데이터 저장이 막혀 있는지
            확인하세요.
          </div>
        </AuthShell>
      );
    case 'setup':
      return <SetupPage />;
    case 'locked':
      return <UnlockPage />;
    case 'unlocked':
      return <UnlockedApp />;
  }
}
