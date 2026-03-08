# 자라나라 스마트팜

라즈베리파이에서 2~4채널 릴레이를 제어하고, 분/초 반복 토글을 설정하는 제어 앱이다.

## 기능
- 채널별 ON/OFF 제어
- 채널별 반복 토글(분/초)
- 분/초 칸을 누를 때만 뜨는 팝업 숫자 키패드
- 시뮬레이션 모드(RPi.GPIO 미설치 환경)
- 원클릭 설치 + systemd 자동 재시작
- 30초 주기 healthcheck 타이머(응답 실패 시 자동 재시작)
- 선택형 데스크톱 UI(PyQt6 WebEngine)

---

## 설치 방법 (추천: 소스 설치)

### 1) 레포 가져오기
```bash
git clone https://github.com/catcatdo/jaranara.git
cd jaranara
chmod +x *.sh
```

### 2) 기본 설치 (웹 UI만)
```bash
./install_jaranara.sh
```

### 3) 데스크톱 UI까지 설치하려면
```bash
./install_jaranara.sh --with-desktop
```

### 4) 옵션 설치
```bash
./install_jaranara.sh --pins 17,27,22,23 --port 5001
./install_jaranara.sh --skip-locale
```

### 5) 상태 확인
```bash
sudo systemctl status jaranara.service
sudo systemctl status jaranara-healthcheck.timer
```

### 6) 웹 접속
- 로컬: `http://127.0.0.1:5001`
- 포트를 바꿨다면 해당 포트 사용

### 7) 데스크톱 UI 실행(설치한 경우)
```bash
cd ~/jaranara
.venv/bin/python3 jaranara_desktop.py
```

---

## 제거 방법
```bash
./install_jaranara.sh --uninstall
```

---

## 설정 변경
기본값은 `RELAY_PINS=17,27,22,23`, `PORT=5001` 이다.

`/etc/default/jaranara` 수정 후:
```bash
sudo systemctl restart jaranara.service
```

---

## 패키지(wheel)로 배포하기

초기단계부터 설치 편의성을 높이려면 wheel 배포를 같이 쓰는 걸 권장한다.

### 1) 빌드 도구 설치
```bash
python3 -m pip install --upgrade build
```

### 2) wheel 생성
```bash
python3 -m build
```
생성 파일: `dist/jaranara-0.1.0-py3-none-any.whl`

### 3) 라즈베리파이에서 설치
```bash
python3 -m venv .venv
. .venv/bin/activate
pip install dist/jaranara-0.1.0-py3-none-any.whl
```

### 4) 실행
```bash
jaranara-web
```

> 데스크톱 UI까지 wheel로 배포하려면:
```bash
pip install 'jaranara[desktop]'
```
(단, 시스템 패키지 `gir1.2-webkit2-4.1` 등은 별도 필요)

---

## 트러블슈팅
- 서비스가 죽으면 `journalctl -u jaranara.service -e --no-pager`로 로그 확인
- healthcheck 타이머는 30초마다 `/healthz`를 검사한다
- 포트 충돌 시 `--port`로 다른 포트 지정 후 재설치
