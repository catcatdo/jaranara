import atexit
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass

from flask import Flask, jsonify, render_template, request, session

try:
    import RPi.GPIO as GPIO  # type: ignore
except Exception:  # pragma: no cover
    GPIO = None

try:
    import Adafruit_DHT  # type: ignore
except Exception:  # pragma: no cover
    Adafruit_DHT = None


app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(16))

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "057303")
CHANNEL_NAMES_FILE = os.path.join(os.path.dirname(__file__), "channel_names.json")


@dataclass
class RepeatTask:
    thread: threading.Thread
    stop_event: threading.Event
    on_interval: int
    off_interval: int


class RelayController:
    def __init__(self, channel_pins: list[int], active_low: bool = True) -> None:
        self.channel_pins = channel_pins
        self.active_low = active_low
        self.lock = threading.Lock()
        self.states: dict[int, bool] = {idx + 1: False for idx in range(len(channel_pins))}
        self.repeaters: dict[int, RepeatTask] = {}
        self.next_toggle_at: dict[int, float] = {}
        self.simulation_mode = GPIO is None

        if not self.simulation_mode:
            GPIO.setmode(GPIO.BCM)
            GPIO.setwarnings(False)
            for pin in self.channel_pins:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.HIGH if self.active_low else GPIO.LOW)

    def _gpio_write(self, channel: int, state: bool) -> None:
        if self.simulation_mode:
            return
        pin = self.channel_pins[channel - 1]
        if self.active_low:
            GPIO.output(pin, GPIO.LOW if state else GPIO.HIGH)
        else:
            GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)

    def set_channel(self, channel: int, state: bool) -> None:
        with self.lock:
            self.states[channel] = state
            self._gpio_write(channel, state)

    def toggle_channel(self, channel: int) -> bool:
        with self.lock:
            new_state = not self.states[channel]
            self.states[channel] = new_state
            self._gpio_write(channel, new_state)
            return new_state

    def get_states(self) -> dict[int, bool]:
        with self.lock:
            return dict(self.states)

    def stop_repeater(self, channel: int) -> None:
        task = self.repeaters.pop(channel, None)
        self.next_toggle_at.pop(channel, None)
        if task:
            task.stop_event.set()
            task.thread.join(timeout=1.5)

    def start_repeater(self, channel: int, on_interval: int, off_interval: int) -> None:
        self.stop_repeater(channel)

        stop_event = threading.Event()

        def _current_wait_locked() -> int:
            # caller must hold self.lock
            current_on = self.states[channel]
            return on_interval if current_on else off_interval

        def _current_wait() -> int:
            with self.lock:
                return _current_wait_locked()

        with self.lock:
            self.next_toggle_at[channel] = time.monotonic() + _current_wait_locked()

        def _loop() -> None:
            while True:
                with self.lock:
                    wait_seconds = _current_wait_locked()
                    self.next_toggle_at[channel] = time.monotonic() + wait_seconds
                if stop_event.wait(wait_seconds):
                    break
                self.toggle_channel(channel)

        thread = threading.Thread(target=_loop, daemon=True)
        thread.start()
        self.repeaters[channel] = RepeatTask(
            thread=thread,
            stop_event=stop_event,
            on_interval=on_interval,
            off_interval=off_interval,
        )

    def get_repeaters(self) -> dict[int, dict[str, int]]:
        return {
            ch: {"on": task.on_interval, "off": task.off_interval}
            for ch, task in self.repeaters.items()
        }

    def get_repeat_remaining(self) -> dict[int, int]:
        now = time.monotonic()
        remaining: dict[int, int] = {}
        with self.lock:
            for ch, next_at in self.next_toggle_at.items():
                remain = int(max(0.0, next_at - now))
                remaining[ch] = remain
        return remaining

    def cleanup(self) -> None:
        for channel in list(self.repeaters.keys()):
            self.stop_repeater(channel)
        if not self.simulation_mode:
            for channel in self.states:
                self._gpio_write(channel, False)
            GPIO.cleanup()


def parse_channels(raw: str) -> list[int]:
    values = [item.strip() for item in raw.split(",") if item.strip()]
    pins = [int(v) for v in values]
    if not 2 <= len(pins) <= 4:
        raise ValueError("Relay channel count must be between 2 and 4")
    return pins


pins_env = os.getenv("RELAY_PINS", "17,27,22,23")
CHANNEL_PINS = parse_channels(pins_env)
relay = RelayController(CHANNEL_PINS, active_low=True)
atexit.register(relay.cleanup)


def error(message: str, code: int = 400):
    return jsonify({"ok": False, "error": message}), code


def is_admin() -> bool:
    return bool(session.get("is_admin"))


def default_channel_names() -> dict[int, str]:
    return {idx + 1: f"채널 {idx + 1}" for idx in range(len(CHANNEL_PINS))}


def load_channel_names() -> dict[int, str]:
    names = default_channel_names()
    if not os.path.exists(CHANNEL_NAMES_FILE):
        return names
    try:
        with open(CHANNEL_NAMES_FILE, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, dict):
            for key, value in raw.items():
                ch = int(key)
                if ch in names and isinstance(value, str) and value.strip():
                    names[ch] = value.strip()[:20]
    except Exception:
        return names
    return names


def save_channel_names() -> None:
    payload = {str(ch): name for ch, name in channel_names.items()}
    with open(CHANNEL_NAMES_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


channel_names = load_channel_names()


class ClimateSensor:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.connected = False
        self.temperature_c: float | None = None
        self.humidity: float | None = None
        self.last_error: str | None = "미연결"
        self.pin = int(os.getenv("DHT_PIN", "4"))
        self.sensor_name = os.getenv("DHT_TYPE", "DHT22").upper()

    def _sensor_const(self):
        if Adafruit_DHT is None:
            return None
        mapping = {
            "DHT11": Adafruit_DHT.DHT11,
            "DHT22": Adafruit_DHT.DHT22,
            "AM2302": Adafruit_DHT.AM2302,
        }
        return mapping.get(self.sensor_name, Adafruit_DHT.DHT22)

    def read_once(self) -> bool:
        with self.lock:
            if not self.connected:
                self.last_error = "미연결"
                return False
            sensor_const = self._sensor_const()
            if sensor_const is None:
                self.last_error = "Adafruit_DHT 라이브러리 없음"
                return False
            humidity, temperature = Adafruit_DHT.read_retry(sensor_const, self.pin)
            if humidity is None or temperature is None:
                self.last_error = "센서 읽기 실패"
                return False
            self.temperature_c = round(float(temperature), 1)
            self.humidity = round(float(humidity), 1)
            self.last_error = None
            return True

    def connect(self) -> bool:
        with self.lock:
            self.connected = True
            self.last_error = None
        return self.read_once()

    def get_status(self) -> dict[str, object]:
        with self.lock:
            return {
                "connected": self.connected,
                "temperature_c": self.temperature_c,
                "humidity": self.humidity,
                "error": self.last_error,
                "pin": self.pin,
                "sensor": self.sensor_name,
            }


climate = ClimateSensor()


@app.route("/")
def index():
    return render_template("index.html", channel_count=len(CHANNEL_PINS))


@app.post("/api/admin/login")
def admin_login():
    payload = request.get_json(silent=True) or {}
    password = payload.get("password")
    if not isinstance(password, str):
        return error("password is required")
    if len(password) != 6 or not password.isdigit():
        return error("password must be 6 digits")
    if password != ADMIN_PASSWORD:
        return error("Invalid credentials", 401)

    session["is_admin"] = True
    session["admin_user"] = "관리자"
    return jsonify({"ok": True, "logged_in": True, "username": "관리자"})


@app.post("/api/admin/logout")
def admin_logout():
    session.pop("is_admin", None)
    session.pop("admin_user", None)
    return jsonify({"ok": True, "logged_in": False})


@app.get("/api/status")
def status():
    if climate.connected:
        climate.read_once()
    return jsonify(
        {
            "ok": True,
            "channels": relay.get_states(),
            "repeat": relay.get_repeaters(),
            "repeat_remaining": relay.get_repeat_remaining(),
            "names": {str(ch): name for ch, name in channel_names.items()},
            "climate": climate.get_status(),
            "hardware": {
                "relay_pins": CHANNEL_PINS,
                "sensor_pin": climate.pin,
                "sensor_type": climate.sensor_name,
            },
            "simulation": relay.simulation_mode,
            "admin": {
                "logged_in": is_admin(),
                "username": session.get("admin_user") if is_admin() else None,
            },
        }
    )


@app.post("/api/sensor/connect")
def connect_sensor():
    if not is_admin():
        return error("Admin login required", 401)
    ok = climate.connect()
    data = climate.get_status()
    if not ok:
        return jsonify({"ok": False, "error": data.get("error"), "climate": data}), 400
    return jsonify({"ok": True, "climate": data})


@app.post("/api/channels/<int:channel>")
def set_channel(channel: int):
    if channel not in relay.states:
        return error("Invalid channel", 404)

    payload = request.get_json(silent=True) or {}
    if "state" not in payload or not isinstance(payload["state"], bool):
        return error("Payload must include boolean 'state'")

    new_state = payload["state"]
    relay.set_channel(channel, new_state)
    if not new_state:
        relay.stop_repeater(channel)
    return jsonify({"ok": True, "channel": channel, "state": new_state})


@app.post("/api/repeat/<int:channel>/start")
def start_repeat(channel: int):
    if channel not in relay.states:
        return error("Invalid channel", 404)

    payload = request.get_json(silent=True) or {}
    minutes = payload.get("minutes", 0)
    seconds = payload.get("seconds", 0)
    stop_minutes = payload.get("stop_minutes", minutes)
    stop_seconds = payload.get("stop_seconds", seconds)

    if not all(isinstance(v, int) for v in [minutes, seconds, stop_minutes, stop_seconds]):
        return error("minutes/seconds/stop_minutes/stop_seconds must be integers")
    if any(v < 0 or v > 60 for v in [minutes, seconds, stop_minutes, stop_seconds]):
        return error("Use 0<=minutes/seconds/stop_minutes/stop_seconds<=60")

    on_total = minutes * 60 + seconds
    off_total = stop_minutes * 60 + stop_seconds
    if on_total <= 0 or off_total <= 0:
        return error("Both on and off intervals must be at least 1 second")

    relay.start_repeater(channel, on_total, off_total)
    return jsonify({"ok": True, "channel": channel, "on_interval": on_total, "off_interval": off_total})


@app.post("/api/repeat/<int:channel>/stop")
def stop_repeat(channel: int):
    if channel not in relay.states:
        return error("Invalid channel", 404)

    relay.stop_repeater(channel)
    return jsonify({"ok": True, "channel": channel})


@app.post("/api/channels/<int:channel>/name")
def set_channel_name(channel: int):
    if not is_admin():
        return error("Admin login required", 401)
    if channel not in relay.states:
        return error("Invalid channel", 404)

    payload = request.get_json(silent=True) or {}
    name = payload.get("name")
    if not isinstance(name, str):
        return error("name is required")

    cleaned = name.strip()
    if not cleaned:
        return error("name cannot be empty")
    if len(cleaned) > 20:
        return error("name must be 20 characters or less")

    channel_names[channel] = cleaned
    save_channel_names()
    return jsonify({"ok": True, "channel": channel, "name": cleaned})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
