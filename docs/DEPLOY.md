# 배포 방법 (GitHub Pages + GitHub Actions, PowerShell 기준)

배포 주소: `https://choiteacher.github.io/asset-tracker/`
`vite.config.ts`의 `base: '/asset-tracker/'`가 저장소 이름과 같아야 한다. 저장소 이름을 바꾸면 이 값도 바꾼다.

## 1. 로컬에서 실행·확인

```powershell
cd "$env:USERPROFILE\Desktop\Program\asset-tracker"
npm install          # 처음 한 번
npm test             # 단위 테스트
npm run dev          # 개발 서버 → 표시되는 주소(http://localhost:5173/asset-tracker/)를 브라우저로 연다
npm run build        # 배포용 빌드(dist 폴더)
npm run preview      # 빌드 결과를 로컬에서 확인
```

## 2. 저장소 연결 (최초 1회)

로컬 폴더는 이미 `git init` 되어 있고 `origin`이 `https://github.com/choiteacher/asset-tracker.git`로 연결되어 있다.
확인:

```powershell
git remote -v
```

다른 PC에서 새로 연결해야 한다면:

```powershell
git init -b main
git remote add origin https://github.com/choiteacher/asset-tracker.git
```

## 3. Pages Source를 GitHub Actions로 설정 (최초 1회)

1. 브라우저에서 저장소 → **Settings** → 왼쪽 **Pages**
2. **Build and deployment → Source** 를 **GitHub Actions** 로 선택 (저장 버튼 없이 바로 적용)

PowerShell에서 gh CLI로 하려면(둘 중 하나만 하면 된다):

```powershell
gh api -X POST repos/choiteacher/asset-tracker/pages -f build_type=workflow
```

## 4. 배포

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 자동으로 테스트 → 빌드 → 배포한다.

```powershell
git add .
git commit -m "커밋 메시지"
git push -u origin main
```

진행 상황: 저장소 → **Actions** 탭. 완료 후 1~2분 뒤 배포 주소에서 확인.
테스트가 실패하면 배포되지 않는다.

## 주의

- 자산 데이터는 각 브라우저의 IndexedDB에만 암호화되어 있다. 저장소·배포본에는 코드만 올라간다.
- 백업 파일(`*.enc.json`, `*.backup.json`)과 `.env`류는 `.gitignore`로 제외되어 있다. 백업 파일은 프로젝트 폴더 밖(예: 다운로드 폴더, USB)에 보관한다.
- 배포 주소를 바꾸거나(저장소 이름 변경 등) 다른 브라우저/PC에서 열면 데이터가 보이지 않는다. 브라우저 저장소는 주소(origin)별로 분리되기 때문이며, 이때는 백업 파일로 복구한다.
