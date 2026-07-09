# THE-O CORPORATION 해외 거래처용 제품 소개 웹사이트

이 프로젝트는 두 부분으로 구성되어 있습니다.

1. **웹사이트** (`index.html`, `style.css`, `app.js`, `config.js`, `products_data.js`) — GitHub Pages/Netlify 등 정적 호스팅에 그대로 올리면 됩니다.
2. **회원가입 승인 백엔드** (`google-apps-script/Code.gs`) — Google Apps Script + Google Sheet로 실제 이메일 발송/승인 처리를 담당합니다.

---

## 1. 로고

`assets/logo.png`에 보내주신 로고를 적용했습니다. 헤더와 푸터의 어두운 초록 배경 위에서도 잘 보이도록 흰색 배경 칩(chip) 안에 넣어두었습니다. 로고가 바뀌면 이 파일만 같은 이름으로 교체하시면 됩니다.

---

## 2. 회원가입 + 로그인 승인 시스템 설정 (Google Apps Script)

이번 업데이트로 사이트 접속 시 제품이 바로 보이지 않고, **로그인 후에만 카탈로그가 보이도록** 변경되었습니다.
- 신규 거래처: "Become a buyer" 탭에서 회사 정보 + 이메일 + **비밀번호**를 입력해 신청
- 승인되면: 신청 시 입력한 **이메일 = 아이디, 비밀번호 = 그대로 로그인 비밀번호**로 로그인 가능
- 기존 거래처: "Log in" 탭에서 이메일/비밀번호 입력 후 로그인

> ⚠️ **중요 — 보안 수준에 대한 안내**
> 이 로그인 기능은 방문자가 목록을 손쉽게 열람하지 못하도록 막는 "1차 차단막" 수준입니다. 비밀번호는 브라우저에서 SHA-256으로 해시된 값만 서버로 전송/저장되어 평문 비밀번호가 노출되지는 않지만, 사이트가 정적 파일(GitHub Pages)로 서비스되는 구조상 `products_data.js` 파일 자체는 인터넷에 공개되어 있어, 이 파일 경로를 직접 알고 접근하는 사람은 로그인 없이도 데이터를 볼 수 있습니다. 진짜 계정별 접근 제어가 필요하시면(예: 거래처별로 다른 가격 노출 등) 별도의 서버 기반 시스템으로 전환하는 것을 권장드립니다. 지금 구조는 "검색엔진/불특정 다수에게 카탈로그를 바로 노출하지 않는" 용도로는 충분합니다.

### 2-1. Google Sheet 생성
1. [sheets.google.com](https://sheets.google.com)에서 새 스프레드시트를 만듭니다. (예: "THE-O 바이어 신청 관리")

### 2-2. Apps Script 붙여넣기
1. 시트 상단 메뉴에서 **확장 프로그램 > Apps Script** 클릭
2. 기본으로 열려있는 `Code.gs` 내용을 전부 지우고, 이 프로젝트의 `google-apps-script/Code.gs` 내용을 그대로 붙여넣기
3. 저장 (Ctrl+S / Cmd+S)

### 2-3. 웹앱으로 배포 (또는 기존 배포 업데이트)

**처음 배포하는 경우:**
1. 우측 상단 **배포 > 새 배포**
2. 유형 선택에서 톱니바퀴 클릭 → **웹앱** 선택
3. 설정: 다음 사용자 권한으로 실행 = **나**, 액세스 권한 = **모든 사용자**
4. **배포** 클릭 → 권한 승인 (Google이 "확인되지 않은 앱" 경고를 띄우면 **Advanced → Go to [프로젝트명] (unsafe) → Allow**)
5. 웹앱 URL 복사

**이미 배포했었고 코드만 업데이트한 경우 (이번처럼 로그인 기능 추가 시):**
1. 우측 상단 **배포 > 배포 관리**
2. 기존 배포 옆 연필(✏️) 아이콘 클릭
3. **버전**을 "새 버전"으로 선택 → **배포**
4. 이렇게 하면 **URL이 그대로 유지**되어 `config.js`를 다시 수정할 필요가 없습니다. (반대로 "새 배포"를 다시 만들면 URL이 바뀌므로 config.js도 다시 수정해야 합니다.)

### 2-4. 웹사이트에 연결 (URL이 바뀐 경우에만)
`config.js`의 `window.APPS_SCRIPT_URL` 값을 웹앱 URL로 교체합니다. (위 "새 버전"으로 업데이트했다면 이 단계는 건너뛰어도 됩니다.)

### 2-5. 동작 확인
1. 사이트에서 "Become a buyer" 탭으로 신청서 제출 (이메일 + 비밀번호 입력)
2. `ychung0426@gmail.com`으로 승인 메일 도착 → Approve 클릭
3. 사이트 "Log in" 탭에서 방금 등록한 이메일/비밀번호로 로그인 → 카탈로그 표시 확인
4. "Log out" 버튼으로 다시 잠금 상태로 전환되는지 확인

> Google Sheet의 "Applications" 탭에 `Password Hash` 열이 추가되었습니다 — 비밀번호 원문이 아닌 해시값만 저장됩니다.

---

## 3. 웹사이트 배포 (GitHub Pages 기준)

1. GitHub에 새 저장소 생성 (예: `theo-corp-catalog`)
2. 이 프로젝트 폴더의 파일들(`index.html`, `style.css`, `app.js`, `config.js`, `products_data.js`)을 저장소 루트에 업로드
3. 저장소 **Settings > Pages**에서 Branch를 `main`(또는 `master`), 폴더는 `/root`로 설정 후 저장
4. 몇 분 후 `https://[본인계정].github.io/theo-corp-catalog/` 주소로 접속 가능

Netlify를 쓰실 경우, 위 5개 파일이 든 폴더를 그대로 드래그 앤 드롭하면 즉시 배포됩니다.

---

## 4. 파일 구성

```
index.html            메인 페이지 (카탈로그 + 회원가입 폼)
style.css              전체 디자인
app.js                 필터링/검색/폼 제출 로직
config.js              Apps Script 웹앱 URL 설정 (배포 후 수정 필요)
products_data.js       엑셀에서 추출한 34개 제품 데이터 (사진 포함, 자동 생성됨)
assets/logo.png        회사 로고
google-apps-script/
  Code.gs              회원가입 승인 백엔드 (Google Apps Script)
```

## 5. 제품 데이터 갱신

카탈로그에는 현재 세 가지 데이터 소스가 통합되어 있습니다:
- 한국산 간식 (`snack_information_korea.xlsx`) — 34개
- 태국산 간식 (`Snack_Information_thailand.xlsx`) — 52개
- 국내산 Dry Food, 강아지/고양이 (`dry_food_information.xlsx`) — 39개 제품군 (사이즈별 가격 옵션 포함)

엑셀 파일이 업데이트되면 `products_data.js`를 다시 생성해야 이미지/URL이 반영됩니다. 업데이트된 엑셀 파일을 다시 보내주시면 재생성해 드리겠습니다.

## 6. 히어로 배너 이미지 교체

메인 화면 상단 배너는 `assets/hero.png` 파일입니다. 다른 이미지로 교체하려면 같은 파일명으로 덮어쓰면 됩니다 (권장 비율 약 2.4:1, 가로 1500px 이상).
