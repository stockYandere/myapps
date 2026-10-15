# myapps

직접 만든 Android 앱의 배포 저장소이자 다운로드 사이트입니다.
사이트는 GitHub Pages로 이 저장소의 `main` 브랜치 루트를 그대로 보여 줍니다(빌드 과정 없음).

## 구성

| 경로 | 내용 |
|---|---|
| `index.html`, `assets/` | 사이트 (앱 목록, 앱별 상세 정보·사용법·업데이트 기록) |
| `apps.json` | 앱 소개: 이름, 핵심 문구, 기능, 사용법, 알아두세요. **직접 편집** |
| `apps/<앱>/latest.json` | 최신 버전 정보(APK 주소, 크기, SHA-256, 변경 내용). 앱 내 업데이트가 이 파일을 읽음. **자동 생성** |
| `apps/<앱>/history.json` | 최근 버전 기록(최대 30개). **자동 생성** |
| Releases | APK 파일. 태그 형식 `<앱>-v<버전>` (예: `nai-pocket-v0.11.40r`) |

## NAI Pocket 자동 배포

비공개 저장소 `naiPocket`의 Release 워크플로가 버전 태그(예: `v0.11.41r`)를 받으면
빌드·테스트 후 이 저장소에 릴리스를 만들고 `apps/nai-pocket/latest.json`, `history.json`을 갱신합니다.
앱은 `https://raw.githubusercontent.com/stockYandere/myapps/main/apps/nai-pocket/latest.json`을 확인해 새 버전을 알립니다.

## 앱 추가하기

1. `apps.json`의 `apps` 배열에 항목을 추가합니다. `accent`, `accent2`는 카드 색입니다.
2. 자동 배포가 없는 앱은 `release`에 버전·날짜·크기·APK 주소를 직접 적습니다. `apkUrl`이 비어 있으면 "APK 준비 중"으로 표시됩니다.
   ```json
   "release": { "versionName": "0.1.37", "publishedAt": "2026-10-14", "sizeLabel": "92.7 KB", "apkUrl": "https://github.com/stockYandere/myapps/releases/download/arca-inspect-v0.1.37/Arca-Inspect-0.1.37.apk" }
   ```
3. 자동 배포가 있는 앱은 `manifest`, `history`에 `apps/<앱>/latest.json`, `history.json` 경로를 적습니다.
