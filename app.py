import atexit
import os
import threading
import time
from dataclasses import dataclass

from flask import Flask, jsonify, render_template, request

try:
    import RPi.GPIO as GPIO  # type: ignore
except Exception:  # pragma: no cover
    GPIO = None


app = Flask(__name__)


@dataclass
class RepeatTask:
    thread: threading.Thread
    stop_event: threading.Event
    interval: int


class RelayController:
    def __init__(self, channel_pins: list[int], active_low: bool = True) -> None:
        self.channel_pins = channel_pins
        self.active_low = active_low
        self.lock = threading.Lock()
        self.states: dict[int, bool] = {idx + 1: False for idx in range(len(channel_pins))}
        self.repeaters: dict[int, RepeatTask] = {}
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
        if task:
            task.stop_event.set()
            task.thread.join(timeout=1.5)

    def start_repeater(self, channel: int, interval: int) -> None:
        self.stop_repeater(channel)

        stop_event = threading.Event()

        def _loop() -> None:
            while not stop_event.wait(interval):
                self.toggle_channel(channel)

        thread = threading.Thread(target=_loop, daemon=True)
        thread.start()
        self.repeaters[channel] = RepeatTask(thread=thread, stop_event=stop_event, interval=interval)

    def get_repeaters(self) -> dict[int, int]:
        return {ch: task.interval for ch, task in self.repeaters.items()}

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


@app.route("/")
def index():
    return render_template("index.html", channel_count=len(CHANNEL_PINS))


@app.get("/api/status")
def status():
    return jsonify(
        {
            "ok": True,
            "channels": relay.get_states(),
            "repeat": relay.get_repeaters(),
            "simulation": relay.simulation_mode,
        }
    )


@app.post("/api/channels/<int:channel>")
def set_channel(channel: int):
    if channel not in relay.states:
        return error("Invalid channel", 404)

    payload = request.get_json(silent=True) or {}
    if "state" not in payload or not isinstance(payload["state"], bool):
        return error("Payload must include boolean 'state'")

    relay.set_channel(channel, payload["state"])
    return jsonify({"ok": True, "channel": channel, "state": payload["state"]})


@app.post("/api/repeat/<int:channel>/start")
def start_repeat(channel: int):
    if channel not in relay.states:
        return error("Invalid channel", 404)

    payload = request.get_json(silent=True) or {}
    minutes = payload.get("minutes", 0)
    seconds = payload.get("seconds", 0)

    if not isinstance(minutes, int) or not isinstance(seconds, int):
        return error("minutes and seconds must be integers")
    if minutes < 0 or seconds < 0 or seconds > 59:
        return error("Use minutes>=0 and 0<=seconds<=59")

    total = minutes * 60 + seconds
    if total <= 0:
        return error("Interval must be at least 1 second")

    relay.start_repeater(channel, total)
    return jsonify({"ok": True, "channel": channel, "interval": total})


@app.post("/api/repeat/<int:channel>/stop")
def stop_repeat(channel: int):
    if channel not in relay.states:
        return error("Invalid channel", 404)

    relay.stop_repeater(channel)
    return jsonify({"ok": True, "channel": channel})


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5001"))
    app.run(host="0.0.0.0", port=port, debug=False)
