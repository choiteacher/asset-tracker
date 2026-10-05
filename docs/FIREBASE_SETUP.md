# Firebase 설정 순서 (관리자 1명 전용, 보안 우선)

이 앱은 화면을 GitHub Pages에, **로그인(Firebase Authentication)** 과 **암호화된 데이터 저장(Cloud Firestore)** 을 Firebase에 둡니다.
무료 요금제(Spark)로 충분합니다. 콘솔 메뉴 이름은 화면 개편에 따라 조금 다를 수 있습니다(확인 필요).

> 순서대로 한 번만 하면 됩니다. 1~7은 웹 콘솔에서, 8~11은 PowerShell에서 합니다.

## 0. 먼저: Google 계정 보안
Firebase 콘솔에 들어갈 수 있으면 모든 설정을 바꿀 수 있으므로, Firebase를 만드는 Google 계정(umusic3767@gmail.com)에 **2단계 인증**을 켜 두세요.
Google 계정 관리 → 보안 → 2단계 인증.

## 1. 프로젝트 만들기
1. https://console.firebase.google.com 접속 → **프로젝트 만들기**
2. 이름: 예) `asset-tracker` (프로젝트 ID는 자동 생성, 메모해 두기)
3. **Google 애널리틱스: 사용 안 함** (분석 도구로 데이터가 나가지 않도록)

## 2. 웹 앱 등록 → 설정값 복사
1. 프로젝트 개요 → **웹(</>) 아이콘** → 앱 닉네임 `asset-tracker-web`
2. "Firebase 호스팅 설정"은 **체크하지 않음** (화면은 GitHub Pages 사용)
3. 화면에 나오는 `firebaseConfig`에서 아래 4개를 복사해 둡니다(8번에서 사용).
   - `apiKey`, `authDomain`, `projectId`, `appId`
   - 이 값들은 비밀번호가 아니라 공개돼도 되는 값입니다. 실제 보호는 5·6·7번이 합니다.

## 3. 로그인 방식: 이메일/비밀번호만
1. 빌드 → **Authentication** → 시작하기
2. 로그인 방법(Sign-in method) → **이메일/비밀번호** → 사용 설정
   - "이메일 링크(비밀번호 없는 로그인)"는 **끔**
3. 다른 로그인 방식(Google, 익명 등)은 **모두 사용 안 함**

## 4. 관리자 계정 1개 만들기
1. Authentication → **사용자(Users)** → **사용자 추가**
2. 이메일: 관리자 이메일, 비밀번호: **14자 이상의 새 비밀번호**(다른 곳에서 쓰지 않는 것)
3. 만들어진 사용자의 **사용자 UID**를 복사해 둡니다(8번에서 사용).

> 앱에는 회원가입 화면이 없습니다. 비밀번호를 바꾸거나 잊었을 때는 이 화면에서 "비밀번호 재설정"을 하세요.

## 5. 가입 막기·보안 설정 (Authentication → 설정)
1. **사용자 작업(User actions)**
   - "생성(가입) 사용 설정(Enable create (sign-up))" → **체크 해제** → 누구도 새 계정을 만들 수 없음
   - "삭제 사용 설정(Enable deletion)" → **체크 해제**
   - "이메일 열거 보호(Email enumeration protection)" → **사용**
   - 이 메뉴가 안 보이면 요금제/버전 차이일 수 있습니다(확인 필요). 없어도 6번 보안 규칙이 관리자 외 계정을 모두 막습니다.
2. **비밀번호 정책** (있으면): 최소 길이 12 이상, 대·소문자·숫자·특수문자 요구 → "적용(Require)"
3. **승인된 도메인(Authorized domains)**: `localhost`, `choiteacher.github.io`가 있는지 확인하고 없으면 추가

## 6. Firestore 만들기
1. 빌드 → **Firestore Database** → 데이터베이스 만들기
2. 위치: **asia-northeast3 (서울)** — 나중에 바꿀 수 없음
3. 시작 모드: **프로덕션 모드**(모든 접근 거부로 시작)
4. 실제 규칙은 9번에서 배포합니다(관리자 UID만 자기 문서 하나에 접근).

## 7. API 키 사용처 제한 (Google Cloud 콘솔)
1. https://console.cloud.google.com → 상단에서 같은 프로젝트 선택
2. API 및 서비스 → **사용자 인증 정보** → "Browser key (auto created by Firebase)" 클릭
3. **애플리케이션 제한사항: 웹사이트** → 다음만 추가
   - `https://choiteacher.github.io/*`
   - `http://localhost:5173/*` (내 PC 개발용)
   - `http://localhost:4173/*` (내 PC 미리보기용)
4. **API 제한사항: 키 제한** → 다음 3개만 선택
   - Identity Toolkit API
   - Token Service API
   - Cloud Firestore API
5. 저장(적용까지 몇 분 걸릴 수 있음)

## 8. 내 PC에 설정 파일 만들기 (PowerShell)
```powershell
cd "$env:USERPROFILE\Desktop\Program\asset-tracker"
Copy-Item .env.example .env.local
notepad .env.local
```
메모장에서 2번의 4개 값과 4번의 사용자 UID를 채우고 저장합니다. `.env.local`은 저장소에 올라가지 않습니다.

## 9. 보안 규칙 배포
```powershell
npx firebase-tools login      # 브라우저가 열리면 Firebase 계정으로 로그인(처음 한 번)
npm run deploy:rules          # 관리자 UID를 넣은 규칙을 만들어 배포
```
"Deploy complete!"가 나오면 성공입니다. 규칙 원본은 `firebase/firestore.rules.template`에 있습니다.

## 10. GitHub에 설정값 등록 (배포 빌드용)
GitHub 저장소 → Settings → Secrets and variables → Actions → **Variables** 탭 → New repository variable 로 아래 4개를 등록합니다.
(UID는 등록하지 않습니다.)

| 이름 | 값 |
|---|---|
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_APP_ID` | appId |

PowerShell로 하려면(`.env.local`을 채운 뒤):
```powershell
Get-Content .env.local | Where-Object { $_ -match '^VITE_FIREBASE_[A-Z_]+=.+' } | ForEach-Object {
  $name, $value = $_ -split '=', 2
  gh variable set $name --body $value
}
```

## 11. 확인 후 배포
```powershell
npm run dev        # http://localhost:5173/asset-tracker/ 에서 로그인 → 잠금 해제 비밀번호 만들기
git push           # GitHub Actions가 테스트 → 빌드 → 배포
```

## 비밀번호 두 개
| 비밀번호 | 용도 | 잊었을 때 |
|---|---|---|
| 로그인 비밀번호 | Firebase 로그인(4번에서 만든 것) | Firebase 콘솔 → Authentication → 사용자 → 비밀번호 재설정 |
| 잠금 해제 비밀번호 | 데이터 암호화(앱 첫 화면에서 만드는 것). 어디에도 저장되지 않음 | **복구 불가.** 암호화 백업 파일과 그 백업의 비밀번호가 있으면 복구 가능 |

두 비밀번호는 **서로 다르게** 정하세요. 로그인 비밀번호가 새어도 데이터 내용은 잠금 해제 비밀번호 없이는 읽을 수 없습니다.

## (선택) 더 강하게
- **2단계 인증(TOTP)**: Firebase Authentication을 Identity Platform으로 업그레이드하면 관리자 로그인에 OTP를 걸 수 있습니다. 결제 계정 등록이 필요할 수 있어 기본 설계에서는 뺐습니다(확인 필요). 원하시면 앱에 OTP 입력 단계를 추가할 수 있습니다.
- **App Check(reCAPTCHA)**: 이 앱이 아닌 곳에서 오는 요청을 막는 기능입니다. Google 스크립트를 추가로 불러와야 해서 기본 설계에서는 뺐습니다. 지금 구조에서는 보안 규칙 + API 키 제한 + 데이터 암호화로 보호합니다.
