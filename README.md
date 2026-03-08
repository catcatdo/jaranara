# 자라나라 스마트팜

라즈베리파이에서 2~4채널 릴레이를 제어하고, 분/초 반복 토글을 설정하는 제어 앱이다.

## 기능
- 채널별 ON/OFF 제어
- 채널별 반복 토글(분/초)
- 분/초 칸을 누를 때만 뜨는 팝업 숫자 키패드
- 시뮬레이션 모드(RPi.GPIO 미설치 환경)
- 원클릭 설치 + systemd 자동 재시작
- 선택형 데스크톱 UI(PyQt6 WebEngine)

## 빠른 설치(라즈베리파이)
```bash
git clone https://github.com/catcatdo/jaranara.git
cd jaranara
chmod +x *.sh
./install_jaranara.sh
```

> 웹만 쓸 경우 위 명령으로 충분하다.

### 데스크톱 UI까지 설치하려면
```bash
./install_jaranara.sh --with-desktop
```

### 옵션
```bash
./install_jaranara.sh --help
```
- `--with-desktop`: PyQt6 UI 의존성까지 설치
- `--skip-locale`: locale 설정 단계 생략

## 앱 실행

### 서비스(권장)
```bash
sudo systemctl status jaranara.service
sudo systemctl restart jaranara.service
sudo systemctl stop jaranara.service
```

### 점검용 웹 주소
`http://127.0.0.1:5001`

### 데스크톱 UI 실행(설치한 경우)
```bash
cd ~/jaranara
.venv/bin/python3 jaranara_desktop.py
```

## 핀/포트 변경
기본값은 `RELAY_PINS=17,27,22,23`, `PORT=5001` 이다.

`/etc/default/jaranara` 수정 후:
```bash
sudo systemctl restart jaranara.service
```
