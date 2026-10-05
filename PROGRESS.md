# 진행 상황

> 상태 값: 미시작 / 진행중 / 완료(승인 대기) / 완료(승인됨)
> 이어서 진행할 때는 `CLAUDE.md` → `docs/STAGES.md` → 이 파일 순서로 읽는다.

## 단계별 상태

| 단계 | 제목 | 상태 | 비고 |
|---|---|---|---|
| 0 | 기획 파일 작성 | 완료(승인됨) | 2026-10-05 |
| 1 | 프로젝트 세팅 + 비밀번호 대문 + 암호화 저장 + 배포 | 완료(승인됨) | DashboardKit 템플릿 레이아웃 적용 |
| 2 | 자산 등록 (입력 화면) | 완료(승인됨) | |
| 3 | 이자·세금 계산 엔진 + 초 단위 실시간 메인 화면 | 완료 | 자동 진행(사용자 지시) |
| 4 | 대출 등록 + 상환 계산 + 금융 Tip | 완료 | 자동 진행 |
| 5 | 분양 D-day 대시보드 | 완료 | 자동 진행 |
| 6 | 기록·그래프·알림·마무리 | 완료 | 자동 진행 |
| 7 | Firebase 전환(로그인 + Firestore 저장) | 코드 완료(푸시됨), Firebase 설정 진행중 | 2026-10-05 사용자 요청 |

## 마지막 완료 단계
- 6단계까지 완료(2026-10-05). 테스트 112개 통과, 빌드 성공.
- 커밋 `24a4157` push, Pages Source = GitHub Actions 설정, 배포 성공(https://choiteacher.github.io/asset-tracker/ 응답 200 확인).

## 결정 사항
- **진행 방식(2026-10-05 사용자 지시)**: 2단계 승인 후 3~6단계는 멈추지 않고 자동 진행. 판단이 애매한 부분은 [가안]으로 정하고 최종 보고에 모아서 알린다. 커밋·푸시·배포는 6단계 완성 후. 사용자 보고는 반드시 한국어.
- 프로젝트 폴더: `Desktop\Program\asset-tracker`, 저장소 `choiteacher/asset-tracker`(Public), 배포 `https://choiteacher.github.io/asset-tracker/`
- 라우터: `react-router` v8 `HashRouter`. 그래프: Recharts 3(그래프 화면은 지연 로딩)
- 암호화: PBKDF2-SHA256 600,000회(하한 300,000), AES-GCM 256, salt 16B, IV 12B(저장마다 새로), 키 extractable=false, 비밀번호 NFC 정규화
- 저장: IndexedDB `asset-tracker`/`vault`/`main`에 암호문 봉투 1개. **스키마 v3** (v1 설정·메타 → v2 자산·세율 → v3 대출·분양·스냅샷·변경내역·lastDataChangeAt)
- UI 템플릿: DashboardKit Free React v3.2.0(MIT) SCSS만 사용, 컴포넌트는 TS로 재작성. 아이콘은 번들 폰트에 있는 이름만
- 차트 색: dataviz 검증 팔레트(순자산 #2a78d6, 부채 #eb6834, 유동 #1baf7a, 동결 #eda100, 다크 모드 별도 값)

### 계산 규칙 ([가안] 표시는 사용자 확인 필요)
- 이자: 단리, 1년 365일 일할(밀리초 단위). 매 100ms마다 Date.now()로 처음부터 재계산
- 적금: 기준일까지 낸 회차(paidCount)는 일정대로 낸 것으로 보고, 기준일 이후 회차는 납입일이 지나면 자동 추가
- [가안] 청약저축: 기준일의 납입 총액에 기준일부터 이자 + 이후 매월(가입일의 일자) 월납입액 추가. 가입~기준일 사이 이자는 미반영
- [가안] 월이자지급식 예금: 받은 이자도 예금 평가액에 포함(만기일시와 같은 방식)
- 동결자산은 동결 해제(유동화) 예정일 또는 만기일이 지나면 유동으로 계산
- 대출: 잔액 기준일부터 스케줄(월 이율 = 연이율/12). 원리금균등 마지막 회차에 잔여 원금 정리. 상환일 이후 쌓인 이자는 "미납 누적 이자"(일할). 시작 전 대출은 부채 0
- 연결 현금: 현금 기준일 이후 상환액만큼 차감. 연결 없으면 경고 표시
- 중도상환 시뮬레이션: 오늘 잔액 기준, 월 상환액(원금균등은 월 원금) 유지·기간 단축 방식. 수수료 = 금액 × 수수료율(면제 시점 이후 0)
- Tip 기준: 면제 시점 90일 이내, 만기 60일 이내, 유동자산 < 다음 상환액 합계 × 3
- 분양: 지난 지급일은 낸 것으로 봄. 지급분마다 "활용 가능 유동자산(세후) − 앞선 자기 자금"과 비교, 부족액은 지급분별로(앞선 부족 중복 계산 안 함). 낸 분양 대금은 유동에서 빼고 순자산에는 분양권(취득 원가)으로 남김
- 알림 기간: 만기 60일, 대출 상환일 14일, 분양 지급일 90일
- 백업 권장: 백업 없음 / 30일 경과 / 마지막 백업 후 데이터 변경(스냅샷 자동 기록은 제외)
- 편집 모드: 메모리에만, 잠그면 보기 모드로. 관리 메뉴(자산·대출·분양 일정·설정)만 보호
- 화면 설정(세후/세전, 금액 가리기, 테마, 큰 글씨)은 localStorage(자산 데이터 아님)

### Firebase 전환 (2026-10-05 사용자 결정)
- 이유: 브라우저 저장만으로는 분실 위험·자동 저장 불편. 사용자가 Firebase 사용을 결정(원칙 변경, CLAUDE.md 반영)
- 결정: **암호화 유지**(Firestore엔 암호문만, 로그인 비밀번호와 잠금 해제 비밀번호 분리), **Firestore만 사용**(브라우저 사본 없음, Firestore Lite)
- 구조: `AuthProvider`(Firebase Auth, sessionStorage 유지) → `SessionProvider`(adapter = `RevisionedAdapter(FirestoreDocStore(db, uid))`, 잠금 시 로그아웃)
- 문서: `vaults/{uid}` = { envelope, revision, updatedAt }. 저장 시 revision 일치 확인(트랜잭션) → 불일치면 VaultConflictError
- 보안 규칙: `firebase/firestore.rules.template` → `npm run deploy:rules`가 .env.local의 FIREBASE_ADMIN_UID로 `firebase/firestore.rules`(gitignore) 생성 후 배포
- 설정값: `.env.local`(로컬), GitHub Actions Variables(배포). 없으면 "Firebase 설정 필요" 화면
- CSP connect-src: self + firestore/identitytoolkit/securetoken.googleapis.com, frame-src none
- 이전 버전 브라우저 데이터: 첫 설정 화면 "기존 데이터" 탭에서 서버로 옮기고 브라우저 사본 삭제
- 규칙 에뮬레이터 테스트는 Java가 없어 못 함(배포 시 서버 문법 검사 + 실사용 확인 필요)

### Firebase 콘솔 진행 상황 (2026-10-05 기준, 프로젝트 `my-webapp-552ba`)
- 완료: 1~2(프로젝트·웹 앱), 3(이메일/비밀번호 사용, 이메일 링크 끔), 6(Firestore default, 규칙 = 전부 거부)
- 미완료: 4(관리자 계정 — 사용자 0명), 5(사용자 작업: 가입·삭제 아직 켜져 있음 → 해제 필요, 비밀번호 정책, 승인된 도메인 확인), 7(API 키 제한), 8(.env.local의 FIREBASE_ADMIN_UID 비어 있음), 9(규칙 배포), 10(GitHub Variables 미등록)
- Firebase 코드는 2026-10-05 커밋·푸시됨. GitHub Variables가 없어서 배포본은 "Firebase 설정 필요" 화면이 뜸(10번 후 재배포하면 해결)
- 다른 PC에서 이어갈 때: `.env.local`은 저장소에 없으므로 `.env.example`을 복사해 Firebase 콘솔(프로젝트 설정 → 내 앱)의 값을 다시 넣는다. `npm install` 후 `npx firebase-tools login`

## 다음에 할 일
0. **사용자: `docs/FIREBASE_SETUP.md` 4·5·7~10번 진행** → 10번(GitHub Variables) 후 재배포(Actions 재실행 또는 push) → 로그인·잠금 해제 비밀번호 만들기 확인
1. 사용자 확인: [가안] 항목(청약저축 이자, 월이자지급식), 세율 예시값 수정
2. 실제 사용 중 발견되는 문제 수정
