#!/usr/bin/env python3
import os
import subprocess
import sys
import time
import webbrowser
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
    try:
        import webview  # type: ignore

        webview.create_window("자라나라 스마트팜", URL, width=1100, height=760)
        webview.start()
    except Exception:
        webbrowser.open(URL)


if __name__ == "__main__":
    ensure_service()
    if not wait_server():
        print("서버 응답이 없습니다. 'sudo systemctl restart jaranara.service' 후 다시 시도하세요.")
        sys.exit(1)
    open_window()
