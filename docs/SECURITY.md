# 보안 점검 결과 (6단계 + Firebase 전환, 2026-10-05)

점검 목표: 사용자의 자산 데이터가 소스코드, 저장소, 콘솔 로그, URL, 에러 메시지, 서비스 워커 캐시에 노출되지 않는지 확인.

| 항목 | 점검 방법 | 결과 |
|---|---|---|
| 콘솔 로그 | `src` 전체에서 `console.`, `debugger` 검색 | 없음 |
| 외부 전송 | `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `http(s)://` 검색 + 빌드 결과 검색 | 외부 요청은 Firebase SDK의 로그인(identitytoolkit, securetoken)과 Firestore뿐. 배포본 CSP `connect-src`도 이 3개 주소만 허용, iframe 금지 |
| 저장 위치 | Firestore 문서 구조, 저장 코드, 테스트(RevisionedAdapter) | `vaults/{uid}` = `{ envelope(암호문 봉투), revision, updatedAt }`. 평문(상품명·금액) 없음. 브라우저에 사본 없음(Firestore Lite, 캐시 없음) |
| 접근 제어 | `firebase/firestore.rules.template` | 관리자 UID 1개 + 이메일/비밀번호 로그인만 허용. 목록 조회 금지, 다른 모든 경로 거부. 필드·크기·PBKDF2 반복 횟수 하한·revision +1·서버 시각 검사 |
| 계정 | 앱 코드 + 설정 절차 | 회원가입 코드 없음. 콘솔에서 가입 기능 끔(5번). 로그인 상태는 sessionStorage(탭 닫으면 사라짐), 잠금 = 로그아웃 |
| 설정값 | `.env.local`, GitHub 변수 | Firebase 웹 설정값은 공개돼도 되는 값이지만 저장소에 넣지 않음. 관리자 UID는 규칙 배포에만 쓰고 저장소·빌드에 넣지 않음. API 키는 도메인·API 3개로 제한 |
| localStorage | 사용처 검색 + 브라우저 확인 | 로그인·잠금 해제 실패 횟수/시각, 화면 설정(세후·세전, 금액 가리기, 테마, 큰 글씨)만. 자산 데이터·이메일·토큰 없음 |
| URL | 라우트·링크 검색 | 해시 경로에 자산/대출 id(무작위 UUID)와 유형(`type=deposit` 등)만. 금액·이름 없음 |
| 에러 메시지 | `throw new Error` 검색, `toUserMessage` | 고정 문구만. Firebase 오류는 코드별 고정 한국어 문구로 바꾸고 서버 원문은 보여주지 않음 |
| 백업 파일 | 단위 테스트 + 실제 내려받기 | 암호문 봉투만. 파일 이름에는 날짜·시각만 |
| 서비스 워커 캐시 | 브라우저에서 `caches` 내용 확인 | HTML·JS·CSS·폰트·아이콘·manifest만. IndexedDB 데이터는 네트워크를 거치지 않아 캐시 불가 |
| 저장소 | `.gitignore`, `git status` | 백업(`*.enc.json`, `*.backup.json`, `asset-tracker-backup*.json`, `backups/`), `.env*` 제외. 테스트 데이터는 모두 가상값 |
| 소스맵 | `vite.config.ts` | 배포본 소스맵 생성 안 함 |
| 검색 노출 | `index.html` | `noindex, nofollow`, `referrer: no-referrer` |

## 남은 위험(설계상 한계)

- Firestore 보안 규칙은 에뮬레이터(Java 필요)로 자동 테스트하지 못했습니다. 배포 시 Firebase가 문법을 검사하고, 앱의 실제 저장·불러오기로 동작을 확인해야 합니다.
- Firebase 콘솔에 들어갈 수 있는 Google 계정이 털리면 데이터 삭제는 가능합니다(내용은 암호화되어 읽을 수 없음). Google 계정 2단계 인증과 정기 백업으로 대비하세요.

- 잠금 해제된 상태에서는 복호화된 데이터가 브라우저 메모리에 있습니다. 공용 PC에서는 사용 후 바로 잠그세요(자동 잠금 기본 10분).
- 비밀번호 실패 지연은 localStorage 기반이라 사이트 데이터를 지우면 초기화됩니다. 실제 방어는 PBKDF2 600,000회 반복입니다. 약한 비밀번호는 백업 파일을 가진 사람이 오프라인으로 추측할 수 있으니 길고 복잡한 비밀번호를 쓰세요.
- 브라우저 확장 프로그램 등 같은 브라우저 안의 악성 코드는 막을 수 없습니다.
