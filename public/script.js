const socket = io();
let configModalInstance;

// --- i18n ---
const i18n = {
    en: {
        subtitle: "High-Performance API Orchestration Layer",
        configBtn: "Config",
        statusOnline: "ONLINE",
        totalRequests: "Total Requests",
        successRate: "Success Rate",
        errors: "Errors",
        avgDaily: "Avg Daily (7d)",
        liveTraffic: "Live Traffic",
        manageKeys: "Manage Keys",
        addKeyLabel: "ADD GOOGLE AI STUDIO KEY",
        addBtn: "Add",
        keyNote: "Keys are automatically rotated. Valid keys are stored securely in <code>keys.json</code>.",
        reqHistory: "Request History (7 Days)",
        modelDist: "Model Distribution",
        keyPoolStatus: "Key Pool Status",
        thKeyHash: "Key Hash",
        thStatus: "Status",
        thUsage: "Usage (Session)",
        thErrors: "Errors (Session)",
        thTotalReq: "Total Req",
        thTotalErr: "Total Err",
        systemLogs: "System Logs",
        configTitle: "Configuration Export",
        configInstruct: "Add this to your <code>config.yaml</code> under <code>models:</code>",
        scanModels: "🔄 Scan Models",
        copyBtn: "Copy to Clipboard"
    },
    vi: {
        subtitle: "Lớp điều phối API hiệu năng cao",
        configBtn: "Cấu hình",
        statusOnline: "TRỰC TUYẾN",
        totalRequests: "Tổng Yêu cầu",
        successRate: "Tỷ lệ Thành công",
        errors: "Lỗi",
        avgDaily: "TB Hàng ngày (7 ngày)",
        liveTraffic: "Lưu lượng Trực tiếp",
        manageKeys: "Quản lý Key",
        addKeyLabel: "THÊM KEY GOOGLE AI STUDIO",
        addBtn: "Thêm",
        keyNote: "Key được xoay vòng tự động. Key hợp lệ được lưu an toàn trong <code>keys.json</code>.",
        reqHistory: "Lịch sử Yêu cầu (7 ngày)",
        modelDist: "Phân bổ Model",
        keyPoolStatus: "Trạng thái Key Pool",
        thKeyHash: "Mã Key",
        thStatus: "Trạng thái",
        thUsage: "Sử dụng (Phiên)",
        thErrors: "Lỗi (Phiên)",
        thTotalReq: "Tổng Req",
        thTotalErr: "Tổng Lỗi",
        systemLogs: "Nhật ký Hệ thống",
        configTitle: "Xuất Cấu hình",
        configInstruct: "Thêm nội dung này vào <code>config.yaml</code> dưới mục <code>models:</code>",
        scanModels: "🔄 Quét Model",
        copyBtn: "Sao chép vào Clipboard"
    }
};

let currentLang = localStorage.getItem('lang') || 'en';

const setLanguage = (lang) => {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (i18n[lang][key]) {
            el.innerHTML = i18n[lang][key];
        }
    });
    
    // Update specific chart labels if needed (reload charts)
    if (historicalRequestsChart) {
        historicalRequestsChart.data.datasets[0].label = lang === 'en' ? 'Daily Requests' : 'Yêu cầu Hàng ngày';
        historicalRequestsChart.update();
    }
    if (trafficChart) {
        trafficChart.data.datasets[0].label = lang === 'en' ? 'Requests' : 'Yêu cầu';
        trafficChart.update();
    }
};


// --- Theme Management ---
const getStoredTheme = () => localStorage.getItem('theme');
const setStoredTheme = theme => localStorage.setItem('theme', theme);

const getPreferredTheme = () => {
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const setTheme = theme => {
  if (theme === 'auto' || theme === 'system') {
    document.documentElement.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    localStorage.removeItem('theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
    setStoredTheme(theme);
  }
  updateChartColors();
};

// Initial Theme Setup
setTheme(getPreferredTheme());

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!getStoredTheme()) {
    setTheme('system');
  }
});


// --- Chart Instances ---
let trafficChart;
let historicalRequestsChart;
let modelUsageChart;

// --- Utility Functions ---
const getPastDates = (numDays) => {
  const dates = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
};

const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num;
};

const getChartColors = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    grid: isDark ? '#374151' : '#e5e7eb',
    text: isDark ? '#9ca3af' : '#6b7280',
    primary: '#6366f1',
    primaryFade: 'rgba(99, 102, 241, 0.1)',
    secondary: '#8b5cf6'
  };
};

// --- Chart Initialization & Update Functions ---
const updateChartColors = () => {
  const colors = getChartColors();
  
  if (trafficChart) {
    trafficChart.options.scales.y.grid.color = colors.grid;
    trafficChart.options.scales.y.ticks.color = colors.text;
    trafficChart.update('none');
  }
  if (historicalRequestsChart) {
    historicalRequestsChart.options.scales.x.grid.color = colors.grid;
    historicalRequestsChart.options.scales.y.grid.color = colors.grid;
    historicalRequestsChart.options.scales.x.ticks.color = colors.text;
    historicalRequestsChart.options.scales.y.ticks.color = colors.text;
    historicalRequestsChart.update('none');
  }
};

const initTrafficChart = () => {
  const ctx = document.getElementById("trafficChart").getContext("2d");
  const colors = getChartColors();

  trafficChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array(30).fill(""),
      datasets: [
        {
          label: currentLang === 'en' ? "Requests" : "Yêu cầu",
          data: Array(30).fill(0),
          borderColor: "#6366f1",
          backgroundColor: (context) => {
            const chartCtx = context.chart.ctx;
            const gradient = chartCtx.createLinearGradient(0, 0, 0, 300);
            gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
            gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
            return gradient;
          },
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { display: false },
        y: {
          beginAtZero: true,
          grid: { color: colors.grid, drawBorder: false },
          ticks: { color: colors.text, font: { family: "'Inter', sans-serif", size: 10 } },
          border: { display: false }
        },
      },
      animation: false,
      interaction: { mode: "nearest", intersect: false },
    },
  });

  setInterval(() => {
    const data = trafficChart.data.datasets[0].data;
    data.push(0);
    data.shift();
    trafficChart.update();
    updateTPS(data);
  }, 2000);
};

const initHistoricalRequestsChart = () => {
  const ctx = document.getElementById("historicalRequestsChart").getContext("2d");
  const colors = getChartColors();

  historicalRequestsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: getPastDates(7),
      datasets: [
        {
          label: currentLang === 'en' ? "Daily Requests" : "Yêu cầu Hàng ngày",
          data: Array(7).fill(0),
          backgroundColor: "#8b5cf6",
          borderRadius: 4,
          barThickness: 20,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { 
            ticks: { color: colors.text, font: { family: "'Inter', sans-serif", size: 10 } }, 
            grid: { display: false } 
        },
        y: {
          beginAtZero: true,
          ticks: { color: colors.text, font: { family: "'Inter', sans-serif", size: 10 } },
          grid: { color: colors.grid, drawBorder: false },
          border: { display: false }
        },
      },
    },
  });
};

const initModelUsageChart = () => {
  const ctx = document.getElementById("modelUsageChart").getContext("2d");
  modelUsageChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: [],
      datasets: [
        {
          data: [],
          backgroundColor: [
            "#6366f1",
            "#8b5cf6",
            "#ec4899",
            "#10b981",
            "#f59e0b",
            "#3b82f6",
          ],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: {
          position: 'right',
          labels: { 
              usePointStyle: true,
              boxWidth: 8,
              font: { family: "'Inter', sans-serif", size: 11 }
          },
        },
      },
    },
  });
};

const updateTPS = (data) => {
  const total = data.reduce((a, b) => a + b, 0);
  document.getElementById("tpsIndicator").innerText = `${total * 2} req/min`;
};

// --- Data Rendering Functions ---
async function fetchAndRenderAllData() {
  try {
      // Fetch live key stats
      const liveKeysPromise = fetch("/api/keys").then((res) => res.json());
      // Fetch historical stats
      const historicalStatsPromise = fetch("/api/stats").then((res) => res.json());

      const [liveKeys, historicalStats] = await Promise.all([
        liveKeysPromise,
        historicalStatsPromise,
      ]);

      renderSummaryCards(historicalStats);
      renderHistoricalCharts(historicalStats);
      renderKeys(liveKeys, historicalStats.keyUsage);
  } catch (err) {
      console.error("Error fetching data:", err);
  }
}

function renderSummaryCards(stats) {
  const totalRequests = stats.totalRequests || 0;
  const totalErrors = stats.totalErrors || 0;
  const totalSuccess = stats.totalSuccess || 0;

  const successRate = totalRequests === 0
    ? 0
    : ((totalSuccess / totalRequests) * 100).toFixed(1);

  document.getElementById("totalRequests").innerText = formatNumber(totalRequests);
  document.getElementById("successRate").innerText = `${successRate}%`;
  document.getElementById("totalErrors").innerText = formatNumber(totalErrors);

  const past7Days = getPastDates(7);
  let last7DaysRequests = 0;
  past7Days.forEach(date => {
    if (stats.dailyStats[date]) {
      last7DaysRequests += stats.dailyStats[date].requests;
    }
  });
  const avgDailyRequests = past7Days.length > 0 ? (last7DaysRequests / past7Days.length).toFixed(0) : 0;
  document.getElementById("avgDailyRequests").innerText = formatNumber(avgDailyRequests);
}

function renderHistoricalCharts(stats) {
  // Historical Requests Chart
  const historicalLabels = getPastDates(7);
  const historicalData = historicalLabels.map(
    (date) => stats.dailyStats[date]?.requests || 0,
  );
  historicalRequestsChart.data.labels = historicalLabels.map(date => date.slice(5)); // Show MM-DD
  historicalRequestsChart.data.datasets[0].data = historicalData;
  historicalRequestsChart.update();

  // Model Usage Chart
  const modelLabels = Object.keys(stats.modelUsage);
  const modelData = Object.values(stats.modelUsage);
  modelUsageChart.data.labels = modelLabels;
  modelUsageChart.data.datasets[0].data = modelData;
  modelUsageChart.update();
}

function renderKeys(liveKeys, historicalKeyStats) {
  const tbody = document.getElementById("keyTableBody");
  tbody.innerHTML = liveKeys
    .map((k) => {
      const historical = historicalKeyStats[k.key] || { requests: 0, errors: 0 };
      const isError = k.errors > 0;
      const isActive = k.status === "active";
      
      return `
        <tr class="${!isActive ? 'opacity-50' : ''}">
            <td class="ps-4">
                <div class="d-flex align-items-center">
                    <div class="status-indicator ${isActive ? 'status-online' : 'status-offline'}"></div>
                    <span class="font-monospace small text-secondary">...${k.key.slice(-6)}</span>
                </div>
            </td>
            <td>
                <span class="badge ${isActive ? 'bg-success' : 'bg-danger'} bg-opacity-10 text-${isActive ? 'success' : 'danger'} border border-${isActive ? 'success' : 'danger'} border-opacity-25 fw-normal">
                    ${k.status.toUpperCase()}
                </span>
            </td>
            <td class="fw-bold">${k.usage}</td>
            <td class="${isError ? "text-danger fw-bold" : "text-muted"}">${k.errors}</td>
            <td class="text-secondary">${formatNumber(historical.requests)}</td>
            <td class="pe-4 text-secondary">${formatNumber(historical.errors)}</td>
        </tr>
    `;
    })
    .join("");
}

function addLog(log) {
  const container = document.getElementById("logContainer");
  const entry = document.createElement("div");

  let colorClass = ""; // Default inherits
  if (log.type === "error") colorClass = "text-danger";
  if (log.type === "success") colorClass = "text-success";
  if (log.type === "info") colorClass = "text-info";

  entry.className = `log-entry ${colorClass}`;
  entry.innerHTML = `<span class="text-secondary me-2" style="font-size:0.75rem">[${log.timestamp}]</span>${log.message}`;

  container.appendChild(entry);
  container.scrollTop = container.scrollHeight;

  if (container.children.length > 200) {
    container.removeChild(container.firstChild);
  }
}

async function showConfigModal() {
  if (!configModalInstance) {
    configModalInstance = new bootstrap.Modal(
      document.getElementById("configModal"),
    );
  }

  const output = document.getElementById("configOutput");
  output.value = "Loading models from server...";
  configModalInstance.show();

  try {
    const res = await fetch("/api/config-template");
    const models = await res.json();
    renderConfigYAML(models);
  } catch (e) {
    output.value = "Error connecting to server.";
  }
}

async function refreshModels() {
  const btn = document.getElementById("btnRefresh");
  const originalText = btn.innerHTML;
  // btn.innerHTML = "Scanning..."; // Don't override HTML to keep i18n structure if possible, but here we just block interaction
  btn.disabled = true;

  try {
    const res = await fetch("/api/refresh-models", { method: "POST" });
    const models = await res.json();
    renderConfigYAML(models);
    // alert(`Scan complete! Found ${models.length} models.`); // Removed annoying alert
  } catch (e) {
    alert("Scan failed.");
  } finally {
    // btn.innerHTML = originalText; 
    btn.disabled = false;
  }
}

function renderConfigYAML(models) {
  const header = `name: Gemini Proxy Config\nversion: 1.0.0\nschema: v1\nmodels:`;

  const body = models
    .map(
      (m) =>
        `  - name: "⚡ ${m}"\n    model: "${m}"\n    provider: openai\n    apiBase: "http://localhost:13337/v1"\n    apiKey: "sk-local-proxy"\n    contextLength: 128000`,
    )
    .join("\n");

  document.getElementById("configOutput").value = `${header}\n${body}`;
  document.getElementById("modelCount").innerText = `Total available models: ${models.length}`;
}

function copyConfig() {
  const text = document.getElementById("configOutput");
  text.select();
  navigator.clipboard.writeText(text.value);
  
  // Subtle feedback instead of button text change
  const btn = document.querySelector("#configModal .btn-primary-custom");
  const originalText = btn.innerText;
  btn.innerText = "COPIED! ✅";
  setTimeout(() => (btn.innerText = originalText), 2000);
}

async function addKey() {
  const input = document.getElementById("newKeyInput");
  const key = input.value.trim();
  if (!key) return;

  try {
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();

    if (data.success) {
      input.value = "";
      const originalPlaceholder = input.placeholder;
      input.placeholder = "Added successfully!";
      setTimeout(() => (input.placeholder = originalPlaceholder), 2000);
    } else {
      alert(data.error);
    }
  } catch (e) {
    console.error(e);
  }
}

// --- Event Listeners ---
socket.on("connect", () => {
  console.log("Socket connected!");
  fetchAndRenderAllData(); // Initial data load
});
socket.on("stats_update", (keys) => {
  // This event only carries live key data, refresh full dashboard
  fetchAndRenderAllData();
});
socket.on("log", (log) => {
  addLog(log);
});
socket.on("traffic_update", () => {
  const data = trafficChart.data.datasets[0].data;
  data[data.length - 1] += 1;
  trafficChart.update();
  updateTPS(data);
});

// --- Initialize on DOM Content Load ---
document.addEventListener("DOMContentLoaded", () => {
  setLanguage(currentLang); // Apply saved language
  initTrafficChart();
  initHistoricalRequestsChart();
  initModelUsageChart();
  // Initial data fetched via socket.on("connect")
});