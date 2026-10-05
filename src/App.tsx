import { lazy, Suspense, useMemo, type ReactNode } from 'react';
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
import { SessionProvider, useSession, useUnlockedData } from './session/SessionContext';
import { useAuth } from './firebase/AuthContext';
import { getFirebase } from './firebase/client';
import { FirestoreDocStore } from './firebase/firestoreDocStore';
import { RevisionedAdapter } from './storage/revisionedAdapter';
import { SignInPage } from './pages/SignInPage';
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

/** 로그인 후: 저장된 암호문 상태에 따라 설정/잠금 해제/본 화면. */
function VaultApp() {
  const { status } = useSession();
  const { signOut } = useAuth();
  switch (status) {
    case 'loading':
      return <div className="auth-wrapper" aria-busy="true" />;
    case 'forbidden':
      return (
        <AuthShell title="접근 권한이 없습니다">
          <div className="alert alert-danger">이 계정은 데이터를 읽거나 쓸 수 없습니다. 관리자 계정으로 다시 로그인하세요.</div>
          <button type="button" className="btn btn-primary w-100" onClick={() => void signOut()}>
            로그아웃
          </button>
        </AuthShell>
      );
    case 'unavailable':
      return (
        <AuthShell title="데이터를 불러올 수 없습니다">
          <div className="alert alert-danger">서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 새로고침하세요.</div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              새로고침
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => void signOut()}>
              로그아웃
            </button>
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

/** 로그인한 관리자 계정의 Firestore 문서(vaults/{uid})를 저장소로 쓴다. 계정이 바뀌면 세션을 새로 만든다. */
function SignedInApp({ uid }: { uid: string }) {
  const { signOut } = useAuth();
  const adapter = useMemo(() => new RevisionedAdapter(new FirestoreDocStore(getFirebase()!.db, uid)), [uid]);
  return (
    <SessionProvider adapter={adapter} onLock={() => void signOut()}>
      <VaultApp />
    </SessionProvider>
  );
}

export function App() {
  const { status, user } = useAuth();
  switch (status) {
    case 'config-missing':
      return (
        <AuthShell title="Firebase 설정이 필요합니다">
          <div className="alert alert-warning">
            이 배포본에는 Firebase 연결 설정이 들어 있지 않습니다. <code>docs/FIREBASE_SETUP.md</code> 순서대로 설정한 뒤 다시 배포하세요.
          </div>
        </AuthShell>
      );
    case 'loading':
      return <div className="auth-wrapper" aria-busy="true" />;
    case 'signed-out':
      return <SignInPage />;
    case 'signed-in':
      return <SignedInApp key={user!.uid} uid={user!.uid} />;
  }
}
