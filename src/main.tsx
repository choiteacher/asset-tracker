import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { App } from './App';
import { DisplayPrefsProvider } from './session/DisplayPrefs';
import { AuthProvider } from './firebase/AuthContext';
import './theme/scss/style.scss';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <DisplayPrefsProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </DisplayPrefsProvider>
    </HashRouter>
  </StrictMode>,
);

// PWA: 배포본에서만 서비스 워커 등록(화면 파일만 캐시, 자산 데이터는 캐시되지 않음)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}
