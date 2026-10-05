// Firestore 보안 규칙 배포.
// .env.local 의 VITE_FIREBASE_PROJECT_ID, FIREBASE_ADMIN_UID 로 규칙 파일을 만든 뒤 Firebase CLI로 배포한다.
// 실행: npm run deploy:rules   (처음 한 번 npx firebase-tools login 필요)
// 생성되는 firebase/firestore.rules 는 관리자 UID가 들어 있어 저장소에 올리지 않는다(.gitignore).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = { ...readEnvFile('.env.local'), ...process.env };
const projectId = env.VITE_FIREBASE_PROJECT_ID;
const adminUid = env.FIREBASE_ADMIN_UID;

if (!projectId || !adminUid) {
  console.error('.env.local 에 VITE_FIREBASE_PROJECT_ID 와 FIREBASE_ADMIN_UID 를 넣어 주세요. (docs/FIREBASE_SETUP.md 참고)');
  process.exit(1);
}
if (!/^[A-Za-z0-9]{20,128}$/.test(adminUid)) {
  console.error('FIREBASE_ADMIN_UID 형식이 올바르지 않습니다. Firebase 콘솔 > Authentication > 사용자의 "사용자 UID"를 복사하세요.');
  process.exit(1);
}

const template = readFileSync('firebase/firestore.rules.template', 'utf8');
writeFileSync('firebase/firestore.rules', template.replaceAll('__ADMIN_UID__', adminUid));
console.log('규칙 파일 생성: firebase/firestore.rules');

const dryRun = process.argv.includes('--dry-run');
if (dryRun) process.exit(0);

execFileSync('npx', ['--yes', 'firebase-tools@latest', 'deploy', '--only', 'firestore:rules', '--project', projectId], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
