# myapps

직접 만든 Android 앱의 배포 저장소이자 다운로드 사이트입니다.
사이트는 GitHub Pages로 이 저장소의 `main` 브랜치 루트를 그대로 보여 줍니다(빌드 과정 없음).

## 구성

| 경로 | 내용 |
|---|---|
| `index.html`, `assets/` | 사이트. 한 화면 구성(모바일에서 스크롤 없음): 상단 번호 탭(1, 2, 3…)으로 앱 선택, 앱마다 소개·사용법·기능·업데이트를 ←/→ 페이지로 표시 |
| `apps.json` | 앱 소개: 이름, 핵심 문구, 핵심 기능(`core`), 기능, 사용법, 알아두세요. **직접 편집** |
| `apps/<앱>/latest.json` | 최신 버전 정보(APK 주소, 크기, SHA-256, 변경 내용). 앱 내 업데이트가 이 파일을 읽음. **자동 생성** |
| `apps/<앱>/history.json` | 최근 버전 기록(최대 30개). **자동 생성** |
| `apps/event-game-editor/sounds.json` | 에디터 기본 소리 목록(이름·길이·출처, 파일은 에디터 저장소 링크). **자동 생성** |
| `apps/event-game-editor/fx/` | 사건 게임 에디터의 연출 예시(움직이는 WebP 86개)와 `effects.json`. **자동 생성**: 에디터 저장소에서 `node make-fx-gallery.cjs <이 폴더>` |
| Releases | APK 파일. 태그 형식 `<앱>-v<버전>` (예: `nai-pocket-v0.11.40r`) |

## NAI Pocket 자동 배포

비공개 저장소 `naiPocket`의 Release 워크플로가 버전 태그(예: `v0.11.41r`)를 받으면
빌드·테스트 후 이 저장소에 릴리스를 만들고 `apps/nai-pocket/latest.json`, `history.json`을 갱신합니다.
앱은 `https://raw.githubusercontent.com/stockYandere/myapps/main/apps/nai-pocket/latest.json`을 확인해 새 버전을 알립니다.

## 앱 추가하기

1. `apps.json`의 `apps` 배열에 항목을 추가합니다. 배열 순서대로 상단 탭 번호(1, 2, 3…)가 붙고, 키보드 숫자 키로도 고를 수 있습니다. `accent`, `accent2`는 카드 색입니다.
   - `core`: 첫 화면(소개)에 보일 핵심 기능 3~4개. 짧게 적어야 모바일 한 화면에 들어갑니다. 없으면 `featureGroups` 각 묶음의 첫 항목을 씁니다.
   - `usage`: 사용법 단계. 한 단계가 한 페이지(1, 2, 3…)이고, `notes`(알아두세요)는 마지막 `!` 페이지로 붙습니다.
2. 자동 배포가 없는 앱은 `release`에 버전·날짜·크기·APK 주소를 직접 적습니다. `apkUrl`이 비어 있으면 "APK 준비 중"으로 표시됩니다.
   ```json
   "release": { "versionName": "0.1.37", "publishedAt": "2026-10-14", "sizeLabel": "92.7 KB", "apkUrl": "https://github.com/stockYandere/myapps/releases/download/arca-inspect-v0.1.37/Arca-Inspect-0.1.37.apk" }
   ```
3. 자동 배포가 있는 앱은 `manifest`, `history`에 `apps/<앱>/latest.json`, `history.json` 경로를 적습니다.
4. 움직이는 예시 모음이 있는 앱은 `effects`에 `effects.json` 경로를 적습니다. 그러면 기능 다음에 **연출** 탭이 생깁니다(종류 버튼 8개 · 한 쪽에 예시 4개, 낮은 화면은 2개 · 누르면 크게 보기, 옆으로 밀어 다음 효과, 뒤로가기로 닫기).
   ```json
   [{ "id": "mood", "title": "분위기", "desc": "한 줄 설명", "items": [{ "name": "밤", "file": "mood-night.webp" }] }]
   ```
5. `manifest`는 다른 저장소의 주소도 됩니다. 사건 게임 에디터는 에디터 저장소의 `release/update.json`(앱 자동 업데이트가 읽는 파일, `apkUrl`·`publishedAt` 포함)을 그대로 읽습니다.
6. `sounds`에 `sounds.json` 경로를 적으면 **연출** 탭 위에 [연출 예시 | 기본 소리] 전환이 생겨, 줄을 눌러 바로 들을 수 있습니다(효과음·환경음·배경음악, 화면 높이에 맞춰 쪽 넘기기). 연출 예시 중 소리가 나는 효과는 카드의 스피커 버튼과 크게 보기의 **소리 듣기**로 애니메이션을 기다리지 않고 바로 들을 수 있습니다. 소리 파일은 에디터 저장소에서 바로 재생하므로 늘 에디터와 같습니다. 만들기: 에디터 저장소에서 `python3 make-sound-library.py --site <이 폴더>/apps/event-game-editor`, 연출 소리 연결은 `node make-fx-gallery.cjs <fx 폴더> --json-only`.
