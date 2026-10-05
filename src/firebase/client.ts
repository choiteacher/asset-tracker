// Firebase 초기화. 로그인(Auth)과 저장(Firestore)만 쓰고, 분석·광고 등 다른 서비스는 쓰지 않는다.

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { browserSessionPersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore/lite';
import { readFirebaseConfig } from './config';

export interface FirebaseClient {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let client: FirebaseClient | null | undefined;

/** 설정값이 없으면 null(앱은 "Firebase 설정 필요" 화면을 보여준다). */
export function getFirebase(): FirebaseClient | null {
  if (client !== undefined) return client;
  const config = readFirebaseConfig();
  if (!config) {
    client = null;
    return client;
  }
  const app = initializeApp(config);
  // - 로그인 상태는 탭을 닫으면 사라지는 sessionStorage에만 둔다(로컬 영구 저장 안 함).
  // - 팝업/리디렉트 로그인을 쓰지 않으므로 해당 기능(외부 iframe 로딩)을 넣지 않는다.
  const auth = initializeAuth(app, { persistence: browserSessionPersistence });
  auth.languageCode = 'ko';
  // Firestore Lite: 단순 요청/응답(REST)만 쓰고 브라우저에 캐시를 남기지 않는다(오프라인 사본 없음).
  const db = getFirestore(app);
  client = { app, auth, db };
  return client;
}
