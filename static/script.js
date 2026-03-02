const channelCount = Number(document.getElementById("channels").dataset.channelCount);
const channelsRoot = document.getElementById("channels");
const modeText = document.getElementById("modeText");

const keypadTarget = document.getElementById("keypadTarget");
const keypadGrid = document.getElementById("keypadGrid");
const kpClear = document.getElementById("kpClear");
const kpBack = document.getElementById("kpBack");

let activeInput = null;

function setActiveInput(input, title) {
  activeInput = input;
  keypadTarget.textContent = `${title} 선택됨`;
}

function fillKeypad() {
  const values = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0"];
  values.forEach((v) => {
    const btn = document.createElement("button");
    btn.textContent = v;
    btn.addEventListener("click", () => {
      if (!activeInput) return;
      if (activeInput.value.length >= 4) return;
      activeInput.value += v;
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
    <h3>채널 ${channel}</h3>
    <div>상태: <span id="state-${channel}" class="state off">OFF</span></div>

    <div class="row">
      <button class="btn primary" id="on-${channel}">ON</button>
      <button class="btn off" id="off-${channel}">OFF</button>
    </div>

    <div class="row">
      <input id="min-${channel}" class="input" placeholder="분" readonly />
      <input id="sec-${channel}" class="input" placeholder="초" readonly />
    </div>

    <div class="row">
      <button class="btn" id="start-${channel}">반복 시작</button>
      <button class="btn" id="stop-${channel}">반복 정지</button>
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

  const minInput = card.querySelector(`#min-${channel}`);
  const secInput = card.querySelector(`#sec-${channel}`);

  minInput.addEventListener("click", () => setActiveInput(minInput, `채널 ${channel} 분 입력`));
  secInput.addEventListener("click", () => setActiveInput(secInput, `채널 ${channel} 초 입력`));

  card.querySelector(`#start-${channel}`).addEventListener("click", async () => {
    const minutes = Number(minInput.value || "0");
    const seconds = Number(secInput.value || "0");
    if (seconds > 59 || minutes < 0 || seconds < 0) {
      alert("분은 0 이상, 초는 0~59 범위로 입력하세요.");
      return;
    }
    const res = await api(`/api/repeat/${channel}/start`, "POST", { minutes, seconds });
    if (!res.ok) alert(res.error || "실패");
    await refresh();
  });

  card.querySelector(`#stop-${channel}`).addEventListener("click", async () => {
    await api(`/api/repeat/${channel}/stop`, "POST");
    await refresh();
  });

  channelsRoot.appendChild(card);
}

async function refresh() {
  const data = await api("/api/status");
  modeText.textContent = data.simulation
    ? "시뮬레이션 모드(RPi.GPIO 미감지)"
    : "라즈베리파이 GPIO 연결 모드";

  Object.entries(data.channels).forEach(([ch, state]) => {
    const el = document.getElementById(`state-${ch}`);
    el.textContent = state ? "ON" : "OFF";
    el.classList.toggle("on", state);
    el.classList.toggle("off", !state);
  });
}

kpClear.addEventListener("click", () => {
  if (activeInput) activeInput.value = "";
});

kpBack.addEventListener("click", () => {
  if (activeInput) activeInput.value = activeInput.value.slice(0, -1);
});

for (let ch = 1; ch <= channelCount; ch += 1) createChannelCard(ch);
fillKeypad();
refresh();
setInterval(refresh, 3000);
