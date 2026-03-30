const channelCount = Number(document.getElementById("channels").dataset.channelCount);
const channelsRoot = document.getElementById("channels");
const modeText = document.getElementById("modeText");
const exitBtn = document.getElementById("exitBtn");
const adminBtn = document.getElementById("adminBtn");
const sensorBtn = document.getElementById("sensorBtn");
const tempValue = document.getElementById("tempValue");
const humidValue = document.getElementById("humidValue");
const sensorState = document.getElementById("sensorState");
const wiringGuide = document.getElementById("wiringGuide");
const relayWiringText = document.getElementById("relayWiringText");
const sensorWiringText = document.getElementById("sensorWiringText");

const keypadModal = document.getElementById("keypadModal");
const keypadTarget = document.getElementById("keypadTarget");
const keypadValue = document.getElementById("keypadValue");
const keypadGrid = document.getElementById("keypadGrid");
const kpClear = document.getElementById("kpClear");
const kpBack = document.getElementById("kpBack");
const kpDone = document.getElementById("kpDone");
const adminModal = document.getElementById("adminModal");
const adminPass = document.getElementById("adminPass");
const adminCancel = document.getElementById("adminCancel");
const adminSubmit = document.getElementById("adminSubmit");
const adminHelp = document.getElementById("adminHelp");
const TIME_DRAFTS_KEY = "jaranara_time_drafts_v1";

let activeInput = null;
let adminLoggedIn = false;
const repeatOnByChannel = {};
const repeatOffByChannel = {};
const repeatRemainingByChannel = {};
const channelStateByChannel = {};
const channelVisibleByChannel = {};
const timeDrafts = loadTimeDrafts();

function loadTimeDrafts() {
  try {
    const raw = localStorage.getItem(TIME_DRAFTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    return {};
  }
}

function saveTimeDrafts() {
  try {
    localStorage.setItem(TIME_DRAFTS_KEY, JSON.stringify(timeDrafts));
  } catch (_) {
    // ignore
  }
}

function setTimeDraft(channel, field, value) {
  const key = String(channel);
  if (!timeDrafts[key]) timeDrafts[key] = {};
  timeDrafts[key][field] = String(value || "");
  saveTimeDrafts();
}

function getTimeDraft(channel, field) {
  return timeDrafts?.[String(channel)]?.[field] || "";
}

function syncActiveInputDraft() {
  if (!activeInput) return;
  const channel = activeInput.dataset.channel;
  const field = activeInput.dataset.field;
  if (!channel || !field) return;
  setTimeDraft(channel, field, activeInput.value || "");
}

function formatInterval(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function sanitizeTimeValue(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 2);
  if (!digits) return "";
  const value = Math.min(60, Number(digits));
  return String(value);
}

function renderChannelStatus(channel) {
  const state = Boolean(channelStateByChannel[channel]);
  const onSec = Number(repeatOnByChannel[channel] || 0);
  const offSec = Number(repeatOffByChannel[channel] || 0);
  const active = onSec > 0 && offSec > 0;
  const remainSec = Number(repeatRemainingByChannel[channel] || 0);
  const phaseSec = state ? onSec : offSec;

  const stateEl = document.getElementById(`state-${channel}`);
  if (stateEl) {
    stateEl.textContent = state ? "ON" : "OFF";
    stateEl.classList.toggle("on", state);
    stateEl.classList.toggle("off", !state);
  }

  const repeatEl = document.getElementById(`repeat-${channel}`);
  if (repeatEl) {
    if (active) {
      repeatEl.textContent = `${state ? "동작중" : "정지중"} · ${formatInterval(remainSec)} 남음`;
      repeatEl.classList.add("active");
    } else {
      repeatEl.textContent = "반복 대기";
      repeatEl.classList.remove("active");
    }
  }

  const ringEl = document.getElementById(`ring-progress-${channel}`);
  const ringLabelEl = document.getElementById(`ring-label-${channel}`);
  if (ringEl && ringLabelEl) {
    const circumference = 138.23;
    if (active && phaseSec > 0) {
      const progress = Math.min(1, Math.max(0, (phaseSec - remainSec) / phaseSec));
      ringEl.style.strokeDasharray = String(circumference);
      ringEl.style.strokeDashoffset = String(circumference * (1 - progress));
      ringEl.classList.toggle("on", state);
      ringLabelEl.textContent = formatInterval(remainSec);
    } else {
      ringEl.style.strokeDasharray = String(circumference);
      ringEl.style.strokeDashoffset = String(circumference);
      ringEl.classList.remove("on");
      ringLabelEl.textContent = "--:--";
    }
  }

  const cardEl = stateEl?.closest(".card");
  if (cardEl) {
    cardEl.classList.toggle("live", Boolean(state || active));
    const visible = channelVisibleByChannel[channel] !== false;
    cardEl.classList.toggle("hidden-card", !visible && !adminLoggedIn);
    cardEl.classList.toggle("editor-hidden", !visible && adminLoggedIn);
  }
}

function tickCountdown() {
  for (let ch = 1; ch <= channelCount; ch += 1) {
    if (Number(repeatOnByChannel[ch] || 0) > 0 && Number(repeatOffByChannel[ch] || 0) > 0) {
      repeatRemainingByChannel[ch] = Math.max(0, Number(repeatRemainingByChannel[ch] || 0) - 1);
    } else {
      repeatRemainingByChannel[ch] = 0;
    }
    renderChannelStatus(ch);
  }
}

function openKeypad(input, title) {
  activeInput = input;
  keypadTarget.textContent = title;
  keypadValue.textContent = input.value || "--";
  keypadModal.classList.remove("hidden");
}

function closeKeypad() {
  keypadModal.classList.add("hidden");
  keypadValue.textContent = "--";
  activeInput = null;
}

function openAdminModal() {
  adminHelp.textContent = "에디터 모드 진입을 위해 관리자 비밀번호를 입력하세요.";
  adminPass.value = "";
  adminModal.classList.remove("hidden");
  adminPass.focus();
}

function closeAdminModal() {
  adminModal.classList.add("hidden");
}

function updateAdminButton() {
  if (adminLoggedIn) {
    adminBtn.textContent = "에디터 모드 종료";
    adminBtn.classList.remove("primary");
    adminBtn.classList.add("off");
    sensorBtn.classList.remove("hidden");
    wiringGuide.classList.remove("hidden");
  } else {
    adminBtn.textContent = "에디터 모드";
    adminBtn.classList.add("primary");
    adminBtn.classList.remove("off");
    sensorBtn.classList.add("hidden");
    wiringGuide.classList.add("hidden");
  }
}

function updateChannelVisibilityNotice(channel) {
  const visible = channelVisibleByChannel[channel] !== false;
  const noticeEl = document.getElementById(`visibility-note-${channel}`);
  const toggleBtn = document.getElementById(`toggle-visibility-${channel}`);
  if (noticeEl) {
    noticeEl.textContent = visible ? "현재 화면에 표시 중" : "현재 메인 화면에서 숨김";
  }
  if (toggleBtn) {
    toggleBtn.textContent = visible ? "이 채널 숨기기" : "이 채널 다시 보이기";
    toggleBtn.classList.toggle("secondary-alert", visible);
  }
}

function fillKeypad() {
  const values = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"];
  values.forEach((v) => {
    const btn = document.createElement("button");
    btn.textContent = v;
    btn.addEventListener("click", () => {
      if (!activeInput) return;
      const candidate = `${activeInput.value}${v}`;
      activeInput.value = sanitizeTimeValue(candidate);
      syncActiveInputDraft();
      keypadValue.textContent = activeInput.value || "--";
    });
    keypadGrid.appendChild(btn);
  });
}

async function api(path, method = "GET", body) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

function createChannelCard(channel) {
  const card = document.createElement("article");
  card.className = "card";
  card.innerHTML = `
    <div class="card-head">
      <h3 id="name-${channel}">채널 ${channel}</h3>
      <div class="ring-wrap">
        <svg class="ring" viewBox="0 0 52 52" aria-hidden="true">
          <circle class="ring-bg" cx="26" cy="26" r="22"></circle>
          <circle id="ring-progress-${channel}" class="ring-progress" cx="26" cy="26" r="22"></circle>
        </svg>
        <div class="ring-icon">⏱</div>
        <div id="ring-label-${channel}" class="ring-label">--:--</div>
      </div>
      <div class="chips">
        <span id="state-${channel}" class="chip state off">OFF</span>
        <span id="repeat-${channel}" class="chip repeat">반복 대기</span>
      </div>
    </div>
    <div id="editor-${channel}" class="row hidden">
      <input id="name-input-${channel}" class="input text-input" maxlength="20" placeholder="채널 이름(최대 20자)" />
      <button class="btn primary" id="save-name-${channel}">이름 저장</button>
    </div>
    <div id="visibility-row-${channel}" class="editor-tools hidden">
      <div id="visibility-note-${channel}" class="editor-note">현재 화면에 표시 중</div>
      <button class="btn subtle" id="toggle-visibility-${channel}">이 채널 숨기기</button>
    </div>

    <div class="row">
      <button class="btn on-btn" id="on-${channel}">바로 켜기</button>
      <button class="btn off-btn" id="off-${channel}">바로 끄기</button>
    </div>

    <div class="time-block on">
      <div class="time-title">켜짐 시간</div>
      <div class="row">
        <input id="on-min-${channel}" class="input" placeholder="분" readonly />
        <input id="on-sec-${channel}" class="input" placeholder="초" readonly />
      </div>
    </div>

    <div class="time-block off">
      <div class="time-title">꺼짐 시간</div>
      <div class="row">
        <input id="off-min-${channel}" class="input" placeholder="분" readonly />
        <input id="off-sec-${channel}" class="input" placeholder="초" readonly />
      </div>
    </div>

    <div class="row">
      <button class="btn" id="start-${channel}">자동 반복 시작</button>
      <button class="btn" id="stop-${channel}">자동 반복 중지</button>
    </div>
  `;

  card.querySelector(`#on-${channel}`).addEventListener("click", async () => {
    await api(`/api/channels/${channel}`, "POST", { state: true });
    await refresh();
  });

  card.querySelector(`#off-${channel}`).addEventListener("click", async () => {
    await api(`/api/channels/${channel}`, "POST", { state: false });
    await refresh();
  });

  const onMinInput = card.querySelector(`#on-min-${channel}`);
  const onSecInput = card.querySelector(`#on-sec-${channel}`);
  const offMinInput = card.querySelector(`#off-min-${channel}`);
  const offSecInput = card.querySelector(`#off-sec-${channel}`);
  onMinInput.dataset.channel = String(channel);
  onSecInput.dataset.channel = String(channel);
  offMinInput.dataset.channel = String(channel);
  offSecInput.dataset.channel = String(channel);
  onMinInput.dataset.field = "onMin";
  onSecInput.dataset.field = "onSec";
  offMinInput.dataset.field = "offMin";
  offSecInput.dataset.field = "offSec";

  onMinInput.value = getTimeDraft(channel, "onMin");
  onSecInput.value = getTimeDraft(channel, "onSec");
  offMinInput.value = getTimeDraft(channel, "offMin");
  offSecInput.value = getTimeDraft(channel, "offSec");

  onMinInput.addEventListener("click", () => openKeypad(onMinInput, `채널 ${channel} 동작 분 입력`));
  onSecInput.addEventListener("click", () => openKeypad(onSecInput, `채널 ${channel} 동작 초 입력`));
  offMinInput.addEventListener("click", () => openKeypad(offMinInput, `채널 ${channel} 정지 분 입력`));
  offSecInput.addEventListener("click", () => openKeypad(offSecInput, `채널 ${channel} 정지 초 입력`));

  card.querySelector(`#start-${channel}`).addEventListener("click", async () => {
    onMinInput.value = sanitizeTimeValue(onMinInput.value);
    onSecInput.value = sanitizeTimeValue(onSecInput.value);
    offMinInput.value = sanitizeTimeValue(offMinInput.value);
    offSecInput.value = sanitizeTimeValue(offSecInput.value);
    setTimeDraft(channel, "onMin", onMinInput.value);
    setTimeDraft(channel, "onSec", onSecInput.value);
    setTimeDraft(channel, "offMin", offMinInput.value);
    setTimeDraft(channel, "offSec", offSecInput.value);

    const minutes = Number(onMinInput.value || "0");
    const seconds = Number(onSecInput.value || "0");
    const stop_minutes = Number(offMinInput.value || "0");
    const stop_seconds = Number(offSecInput.value || "0");
    if ([minutes, seconds, stop_minutes, stop_seconds].some((v) => v < 0 || v > 60)) {
      alert("동작/정지 분초는 모두 0~60 범위로 입력하세요.");
      return;
    }
    const res = await api(`/api/repeat/${channel}/start`, "POST", {
      minutes,
      seconds,
      stop_minutes,
      stop_seconds,
    });
    if (!res.ok) alert(res.error || "실패");
    await refresh();
  });

  card.querySelector(`#stop-${channel}`).addEventListener("click", async () => {
    await api(`/api/repeat/${channel}/stop`, "POST");
    await refresh();
  });

  card.querySelector(`#save-name-${channel}`).addEventListener("click", async () => {
    if (!adminLoggedIn) {
      openAdminModal();
      return;
    }
    const input = card.querySelector(`#name-input-${channel}`);
    const name = input.value.trim();
    const res = await api(`/api/channels/${channel}/name`, "POST", { name });
    if (!res.ok) {
      alert(res.error || "이름 저장 실패");
      return;
    }
    await refresh();
  });

  card.querySelector(`#toggle-visibility-${channel}`).addEventListener("click", async () => {
    if (!adminLoggedIn) {
      openAdminModal();
      return;
    }
    const currentVisible = channelVisibleByChannel[channel] !== false;
    const res = await api(`/api/channels/${channel}/visibility`, "POST", { visible: !currentVisible });
    if (!res.ok) {
      alert(res.error || "표시 설정 변경 실패");
      return;
    }
    await refresh();
  });

  channelsRoot.appendChild(card);
}

async function refresh() {
  const data = await api("/api/status");
  adminLoggedIn = Boolean(data?.admin?.logged_in);
  updateAdminButton();
  const baseMode = data.simulation
    ? "시뮬레이션 모드(RPi.GPIO 미감지)"
    : "라즈베리파이 GPIO 연결 모드";
  modeText.textContent = adminLoggedIn ? `${baseMode} | 에디터 모드 ON` : baseMode;
  const climate = data?.climate || {};
  const hw = data?.hardware || {};
  const temp = climate?.temperature_c;
  const humid = climate?.humidity;
  tempValue.textContent = Number.isFinite(temp) ? `${temp.toFixed(1)}℃` : "--.-℃";
  humidValue.textContent = Number.isFinite(humid) ? `${humid.toFixed(1)}%` : "--.-%";
  sensorState.textContent = climate?.connected ? "연결됨" : "미연결";
  const relayPins = Array.isArray(hw?.relay_pins) ? hw.relay_pins.join(", ") : "17, 27, 22, 23";
  relayWiringText.textContent = `릴레이 IN1~IN4를 GPIO ${relayPins}에 연결하고, GND/VCC를 같이 연결하세요.`;
  sensorWiringText.textContent = `센서(${hw?.sensor_type || "DHT22"}) DATA를 GPIO ${hw?.sensor_pin ?? 4}에 연결하세요. VCC 3.3V, GND 공통 연결.`;

  Object.entries(data.channels).forEach(([ch, state]) => {
    channelStateByChannel[ch] = Boolean(state);
    channelVisibleByChannel[ch] = data?.visibility?.[ch] !== false;
    const repeatCfg = data?.repeat?.[ch];
    repeatOnByChannel[ch] = Number(repeatCfg?.on || 0);
    repeatOffByChannel[ch] = Number(repeatCfg?.off || 0);
    repeatRemainingByChannel[ch] = Number(data?.repeat_remaining?.[ch] ?? 0);
    renderChannelStatus(ch);

    const nameEl = document.getElementById(`name-${ch}`);
    const inputEl = document.getElementById(`name-input-${ch}`);
    const editorEl = document.getElementById(`editor-${ch}`);
    const visibilityRowEl = document.getElementById(`visibility-row-${ch}`);
    const currentName = data?.names?.[ch] || `채널 ${ch}`;
    if (nameEl) nameEl.textContent = currentName;
    if (inputEl && document.activeElement !== inputEl) inputEl.value = currentName;
    if (editorEl) editorEl.classList.toggle("hidden", !adminLoggedIn);
    if (visibilityRowEl) visibilityRowEl.classList.toggle("hidden", !adminLoggedIn);
    updateChannelVisibilityNotice(ch);
  });
}

kpClear.addEventListener("click", () => {
  if (activeInput) {
    activeInput.value = "";
    syncActiveInputDraft();
    keypadValue.textContent = "--";
  }
});

kpBack.addEventListener("click", () => {
  if (activeInput) {
    activeInput.value = sanitizeTimeValue(activeInput.value.slice(0, -1));
    syncActiveInputDraft();
    keypadValue.textContent = activeInput.value || "--";
  }
});

kpDone.addEventListener("click", closeKeypad);
keypadModal.addEventListener("click", (e) => {
  if (e.target === keypadModal) closeKeypad();
});

exitBtn.addEventListener("click", () => {
  window.close();
});

adminBtn.addEventListener("click", async () => {
  if (adminLoggedIn) {
    await api("/api/admin/logout", "POST");
    await refresh();
    return;
  }
  openAdminModal();
});

sensorBtn.addEventListener("click", async () => {
  const res = await api("/api/sensor/connect", "POST");
  if (!res.ok) {
    alert(res.error || "센서 연결 실패");
  } else {
    alert("온습도 센서 연결 완료");
  }
  await refresh();
});

adminCancel.addEventListener("click", closeAdminModal);
adminSubmit.addEventListener("click", async () => {
  const password = adminPass.value.trim();
  if (!/^\d{6}$/.test(password)) {
    adminHelp.textContent = "비밀번호는 숫자 6자리여야 합니다.";
    return;
  }
  const res = await api("/api/admin/login", "POST", { password });
  if (!res.ok) {
    adminHelp.textContent = res.error || "로그인 실패";
    adminPass.value = "";
    return;
  }
  closeAdminModal();
  await refresh();
});

adminModal.addEventListener("click", (e) => {
  if (e.target === adminModal) closeAdminModal();
});

for (let ch = 1; ch <= channelCount; ch += 1) createChannelCard(ch);
fillKeypad();
refresh();
setInterval(tickCountdown, 1000);
setInterval(refresh, 3000);
