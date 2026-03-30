const historyDateInput = document.getElementById("historyDate");
const loadHistoryBtn = document.getElementById("loadHistoryBtn");
const avgTemp = document.getElementById("avgTemp");
const tempRange = document.getElementById("tempRange");
const avgHumidity = document.getElementById("avgHumidity");
const humidityRange = document.getElementById("humidityRange");
const tempChartMeta = document.getElementById("tempChartMeta");
const humidityChartMeta = document.getElementById("humidityChartMeta");
const tempChart = document.getElementById("tempChart");
const humidityChart = document.getElementById("humidityChart");
const channelRuntime = document.getElementById("channelRuntime");
const channelTimeline = document.getElementById("channelTimeline");

function todayLocalIso() {
  const now = new Date();
  const tzAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return tzAdjusted.toISOString().slice(0, 10);
}

function fmtValue(value, suffix) {
  return Number.isFinite(value) ? `${Number(value).toFixed(1)}${suffix}` : `--.-${suffix}`;
}

function fmtRange(minValue, maxValue, suffix) {
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
    return `--.- ~ --.-${suffix}`;
  }
  return `${Number(minValue).toFixed(1)} ~ ${Number(maxValue).toFixed(1)}${suffix}`;
}

function drawLineChart(container, points, key, color, suffix) {
  if (!Array.isArray(points) || points.length === 0) {
    container.innerHTML = `<div class="empty-state">기록이 없습니다.</div>`;
    return;
  }

  const values = points
    .map((point) => Number(point[key]))
    .filter((value) => Number.isFinite(value));

  if (!values.length) {
    container.innerHTML = `<div class="empty-state">기록이 없습니다.</div>`;
    return;
  }

  const width = 640;
  const height = 220;
  const paddingX = 16;
  const paddingY = 20;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);

  const validPoints = points
    .map((point, index) => ({ index, value: Number(point[key]), time: point.time }))
    .filter((point) => Number.isFinite(point.value));

  const polyline = validPoints
    .map((point) => {
      const x = paddingX + ((width - paddingX * 2) * point.index) / Math.max(1, points.length - 1);
      const y = height - paddingY - ((point.value - minValue) / range) * (height - paddingY * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const lastPoint = validPoints[validPoints.length - 1];
  const firstTime = points[0]?.time || "--:--";
  const lastTime = points[points.length - 1]?.time || "--:--";

  container.innerHTML = `
    <svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${key} line chart">
      <line x1="${paddingX}" y1="${height - paddingY}" x2="${width - paddingX}" y2="${height - paddingY}" class="chart-axis"></line>
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"></polyline>
      <circle cx="${paddingX + ((width - paddingX * 2) * lastPoint.index) / Math.max(1, points.length - 1)}" cy="${height - paddingY - ((lastPoint.value - minValue) / range) * (height - paddingY * 2)}" r="5" fill="${color}"></circle>
      <text x="${paddingX}" y="${height - 2}" class="chart-label">${firstTime}</text>
      <text x="${width - paddingX}" y="${height - 2}" text-anchor="end" class="chart-label">${lastTime}</text>
      <text x="${paddingX}" y="${paddingY}" class="chart-value">${maxValue.toFixed(1)}${suffix}</text>
      <text x="${paddingX}" y="${height - paddingY - 6}" class="chart-value">${minValue.toFixed(1)}${suffix}</text>
    </svg>
  `;
}

function renderRuntime(channels) {
  channelRuntime.innerHTML = "";
  channels.forEach((channel) => {
    const runtimePercent = Math.min(100, (Number(channel.active_hours || 0) / 24) * 100);
    const item = document.createElement("article");
    item.className = "runtime-item";
    item.innerHTML = `
      <div class="runtime-head">
        <strong>${channel.name}</strong>
        <span>${Number(channel.active_hours || 0).toFixed(2)}시간</span>
      </div>
      <div class="runtime-bar">
        <div class="runtime-fill" style="width:${runtimePercent}%"></div>
      </div>
    `;
    channelRuntime.appendChild(item);
  });
}

function renderTimeline(channels) {
  channelTimeline.innerHTML = "";
  channels.forEach((channel) => {
    const item = document.createElement("article");
    item.className = "timeline-item";
    const segments = Array.isArray(channel.segments) ? channel.segments : [];
    const segmentHtml = segments.length
      ? segments
          .map((segment) => {
            const start = Math.max(0, Number(segment.start_minute || 0));
            const end = Math.max(start, Number(segment.end_minute || 0));
            const left = (start / 1440) * 100;
            const width = ((end - start) / 1440) * 100;
            return `<div class="timeline-segment" style="left:${left}%; width:${width}%"></div>`;
          })
          .join("")
      : `<div class="timeline-empty">기록 없음</div>`;
    const events = Array.isArray(channel.events) && channel.events.length
      ? channel.events
          .slice(-4)
          .map((event) => `${event.time} ${event.state ? "켜짐" : "꺼짐"}`)
          .join(" · ")
      : "동작 기록 없음";

    item.innerHTML = `
      <div class="runtime-head">
        <strong>${channel.name}</strong>
        <span>${events}</span>
      </div>
      <div class="timeline-track">
        ${segmentHtml}
      </div>
      <div class="timeline-scale">
        <span>00:00</span>
        <span>12:00</span>
        <span>24:00</span>
      </div>
    `;
    channelTimeline.appendChild(item);
  });
}

async function loadHistory() {
  const date = historyDateInput.value || todayLocalIso();
  const res = await fetch(`/api/history?date=${encodeURIComponent(date)}`);
  const data = await res.json();
  if (!data.ok) {
    tempChart.innerHTML = `<div class="empty-state">${data.error || "기록을 불러오지 못했습니다."}</div>`;
    humidityChart.innerHTML = `<div class="empty-state">${data.error || "기록을 불러오지 못했습니다."}</div>`;
    return;
  }

  avgTemp.textContent = fmtValue(data.sensor_summary?.temperature_avg, "℃");
  tempRange.textContent = fmtRange(data.sensor_summary?.temperature_min, data.sensor_summary?.temperature_max, "℃");
  avgHumidity.textContent = fmtValue(data.sensor_summary?.humidity_avg, "%");
  humidityRange.textContent = fmtRange(data.sensor_summary?.humidity_min, data.sensor_summary?.humidity_max, "%");

  const points = Array.isArray(data.sensor_points) ? data.sensor_points : [];
  tempChartMeta.textContent = `${points.length}개 측정값`;
  humidityChartMeta.textContent = `${points.length}개 측정값`;

  drawLineChart(tempChart, points, "temperature_c", "#d95b43", "℃");
  drawLineChart(humidityChart, points, "humidity", "#3189a7", "%");
  renderRuntime(Array.isArray(data.channels) ? data.channels : []);
  renderTimeline(Array.isArray(data.channels) ? data.channels : []);
}

historyDateInput.value = todayLocalIso();
loadHistoryBtn.addEventListener("click", loadHistory);
historyDateInput.addEventListener("change", loadHistory);
loadHistory();
