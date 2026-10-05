/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// 외부로 데이터를 보낼 통로를 막는 CSP. 개발 서버는 인라인 스크립트를 쓰므로 빌드 결과에만 넣는다.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspForBuild(): Plugin {
  return {
    name: 'inject-csp',
    apply: 'build',
    transformIndexHtml: (html) =>
      // 문자 인코딩 선언 바로 뒤에 넣는다.
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
  };
}

// GitHub Pages 배포 경로: https://<계정>.github.io/asset-tracker/
// 저장소 이름이 바뀌면 이 값도 함께 바꾼다.
export default defineConfig({
  base: '/asset-tracker/',
  plugins: [react(), cspForBuild()],
  css: {
    preprocessorOptions: {
      scss: {
        // 템플릿(DashboardKit)과 Bootstrap 5.3 SCSS는 @import 문법을 써서 최신 Sass가 경고를 낸다. 동작에는 영향 없음.
        quietDeps: true,
        silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
      },
    },
  },
  build: {
    // 배포본에서 원본 소스 노출을 줄이기 위해 소스맵은 만들지 않는다.
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // PBKDF2 600,000회 키 유도가 테스트마다 여러 번 일어나므로 여유를 둔다.
    testTimeout: 30_000,
  },
});
