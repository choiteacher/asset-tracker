// Firebase 웹 설정값. 이 값들은 비밀이 아니다(브라우저에 그대로 전달됨).
// 실제 보호는 Firestore 보안 규칙(관리자 UID만 허용)과 API 키의 도메인 제한이 맡는다.
// 저장소에 넣지 않고 빌드할 때 환경변수로 넣는다: 로컬 .env.local, 배포 GitHub Actions 변수.

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

type Env = Record<string, string | boolean | undefined>;

export function readFirebaseConfig(env: Env = import.meta.env): FirebaseWebConfig | null {
  const pick = (key: string) => {
    const v = env[key];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };
  const apiKey = pick('VITE_FIREBASE_API_KEY');
  const authDomain = pick('VITE_FIREBASE_AUTH_DOMAIN');
  const projectId = pick('VITE_FIREBASE_PROJECT_ID');
  const appId = pick('VITE_FIREBASE_APP_ID');
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return { apiKey, authDomain, projectId, appId };
}
