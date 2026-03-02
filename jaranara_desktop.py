#!/usr/bin/env python3
import os
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen

URL = f"http://127.0.0.1:{os.getenv('PORT', '5001')}"


def ensure_service() -> None:
    subprocess.run(["systemctl", "is-active", "--quiet", "jaranara.service"], check=False)


def wait_server(timeout: float = 12.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            with urlopen(f"{URL}/api/status", timeout=1.2) as resp:
                if resp.status == 200:
                    return True
        except URLError:
            time.sleep(0.5)
    return False


def open_window() -> None:
    import webview  # type: ignore

    webview.create_window("자라나라 스마트팜", URL, fullscreen=True)
    webview.start()


if __name__ == "__main__":
    ensure_service()
    if not wait_server():
        print("서버 응답이 없습니다. 'sudo systemctl restart jaranara.service' 후 다시 시도하세요.")
        sys.exit(1)

    try:
        open_window()
    except Exception as exc:
        print("데스크톱 앱 실행 실패:", exc)
        print("해결: ~/jaranara/install_jaranara.sh 를 다시 실행하세요.")
        sys.exit(1)
