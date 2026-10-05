# 보안 점검 결과 (6단계, 2026-10-05)

점검 목표: 사용자의 자산 데이터가 소스코드, 저장소, 콘솔 로그, URL, 에러 메시지, 서비스 워커 캐시에 노출되지 않는지 확인.

| 항목 | 점검 방법 | 결과 |
|---|---|---|
| 콘솔 로그 | `src` 전체에서 `console.`, `debugger` 검색 | 없음 |
| 외부 전송 | `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `http(s)://` 검색 + 빌드 결과 검색 | 앱 코드에 외부 요청 없음. 배포본 CSP `connect-src 'self'`로 외부 전송 차단 |
| 저장 위치 | IndexedDB 실제 저장값 확인(브라우저) | `format, version, kdf, cipher, ciphertext`만 저장. 평문(상품명·금액) 없음 |
| localStorage | 사용처 검색 | 로그인 실패 횟수/시각, 화면 설정(세후·세전, 금액 가리기, 테마, 큰 글씨)만. 자산 데이터 없음 |
| URL | 라우트·링크 검색 | 해시 경로에 자산/대출 id(무작위 UUID)와 유형(`type=deposit` 등)만. 금액·이름 없음 |
| 에러 메시지 | `throw new Error` 검색, `toUserMessage` | 고정 문구만. 알 수 없는 예외는 일반 문구로 바꿔 표시 |
| 백업 파일 | 단위 테스트 + 실제 내려받기 | 암호문 봉투만. 파일 이름에는 날짜·시각만 |
| 서비스 워커 캐시 | 브라우저에서 `caches` 내용 확인 | HTML·JS·CSS·폰트·아이콘·manifest만. IndexedDB 데이터는 네트워크를 거치지 않아 캐시 불가 |
| 저장소 | `.gitignore`, `git status` | 백업(`*.enc.json`, `*.backup.json`, `asset-tracker-backup*.json`, `backups/`), `.env*` 제외. 테스트 데이터는 모두 가상값 |
| 소스맵 | `vite.config.ts` | 배포본 소스맵 생성 안 함 |
| 검색 노출 | `index.html` | `noindex, nofollow`, `referrer: no-referrer` |

## 남은 위험(설계상 한계)

- 잠금 해제된 상태에서는 복호화된 데이터가 브라우저 메모리에 있습니다. 공용 PC에서는 사용 후 바로 잠그세요(자동 잠금 기본 10분).
- 비밀번호 실패 지연은 localStorage 기반이라 사이트 데이터를 지우면 초기화됩니다. 실제 방어는 PBKDF2 600,000회 반복입니다. 약한 비밀번호는 백업 파일을 가진 사람이 오프라인으로 추측할 수 있으니 길고 복잡한 비밀번호를 쓰세요.
- 브라우저 확장 프로그램 등 같은 브라우저 안의 악성 코드는 막을 수 없습니다.
