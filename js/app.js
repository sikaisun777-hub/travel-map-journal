const chart = echarts.init(document.getElementById("map"));

const backBtn = document.getElementById("backBtn");
const langBtn = document.getElementById("langBtn");
const breadcrumb = document.getElementById("breadcrumb");
const loading = document.getElementById("loading");
const statusText = document.getElementById("statusText");
const selectedTitle = document.getElementById("selectedTitle");
const selectedDesc = document.getElementById("selectedDesc");
const noteInput = document.getElementById("noteInput");
const saveNoteBtn = document.getElementById("saveNoteBtn");
const clearBtn = document.getElementById("clearBtn");
const notesList = document.getElementById("notesList");
const noteCount = document.getElementById("noteCount");

const PROVINCE_MAP = window.PROVINCE_MAP || {};
const PROVINCE_BASE_URL = "https://cdn.jsdelivr.net/npm/echarts@4.9.0/map/js/province";

let currentLevel = "country";
let currentTitle = "全国";
let selectedArea = "全国";
let currentLang = "cn";
let loadedProvinceFiles = {};
let notes = loadNotes();

const i18n = {
  cn: {
    title: "中国旅行日志地图",
    subtitle: "点击省份，进入城市地图，记录你的旅行足迹",
    back: "返回全国",
    mapMode: "地图模式",
    countryMode: "全国省级地图",
    loading: "地图加载中...",
    journal: "Travel Journal",
    selectHint: "选择一个地区",
    selectDesc: "点击地图上的省份或城市，开始记录你的旅行计划、回忆和路线。",
    quickNote: "快速旅行日志",
    saveNote: "保存日志",
    myNotes: "我的日志",
    clear: "清空",
    emptyNotes: "还没有日志",
    tipsTitle: "操作提示",
    tip1: "鼠标悬停地图区域可以查看名称。",
    tip2: "点击省份进入该省城市地图。",
    tip3: "点击“返回全国”回到中国地图。",
    tip4: "日志会自动保存在浏览器本地。",
    countryBreadcrumb: "全国 · China",
    countryStatus: "全国省级地图",
    provinceStatus: "市级 / 区县级地图",
    selectedDefaultTitle: "选择一个地区",
    selectedDefaultDesc: "点击地图上的省份或城市，开始记录你的旅行计划、回忆和路线。",
    notePlaceholder: "写下你想去的地方、美食、路线或回忆...",
    alertSelect: "请先选择一个地区。",
    alertEmpty: "请先写一点日志内容。",
    tooltipLevelCountry: "省级地图",
    tooltipLevelProvince: "城市 / 区县地图"
  },

  en: {
    title: "China Travel Map Journal",
    subtitle: "Click a province, explore cities, and record your travel memories",
    back: "Back to China",
    mapMode: "Map Mode",
    countryMode: "Province Map",
    loading: "Loading map...",
    journal: "Travel Journal",
    selectHint: "Select a Region",
    selectDesc: "Click a province or city to start recording your plans, memories and routes.",
    quickNote: "Quick Travel Note",
    saveNote: "Save Note",
    myNotes: "My Notes",
    clear: "Clear",
    emptyNotes: "No notes yet",
    tipsTitle: "Tips",
    tip1: "Hover over a region to see its name.",
    tip2: "Click a province to enter its city map.",
    tip3: "Click “Back to China” to return.",
    tip4: "Notes are saved locally in your browser.",
    countryBreadcrumb: "China · 全国",
    countryStatus: "China Province Map",
    provinceStatus: "City / District Map",
    selectedDefaultTitle: "Select a Region",
    selectedDefaultDesc: "Click a province or city to start recording your plans, memories and routes.",
    notePlaceholder: "Write places, food, routes or memories...",
    alertSelect: "Please select a region first.",
    alertEmpty: "Please write something first.",
    tooltipLevelCountry: "Province Map",
    tooltipLevelProvince: "City / District Map"
  }
};

function t(key) {
  return i18n[currentLang][key] || key;
}

function applyLanguage() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  noteInput.placeholder = t("notePlaceholder");
  langBtn.textContent = currentLang === "cn" ? "EN" : "中文";

  if (currentLevel === "country") {
    breadcrumb.textContent = t("countryBreadcrumb");
    statusText.textContent = t("countryStatus");
  } else {
    breadcrumb.textContent = currentTitle;
    statusText.textContent = `${currentTitle} · ${t("provinceStatus")}`;
  }

  if (selectedArea === "全国") {
    selectedTitle.textContent = t("selectedDefaultTitle");
    selectedDesc.textContent = t("selectedDefaultDesc");
  } else {
    selectedTitle.textContent = selectedArea;
    selectedDesc.textContent =
      currentLang === "cn"
        ? `你正在查看 ${selectedArea}。可以在这里写下旅行计划、城市印象、美食清单或路线。`
        : `You are viewing ${selectedArea}. Write down plans, impressions, food lists or routes here.`;
  }

  renderNotes();
}

function normalizeName(name) {
  if (!name) return "";

  return name
    .replace("省", "")
    .replace("市", "")
    .replace("自治区", "")
    .replace("壮族", "")
    .replace("回族", "")
    .replace("维吾尔", "")
    .replace("特别行政区", "")
    .trim();
}

function showLoading(show) {
  if (show) {
    loading.classList.add("show");
  } else {
    loading.classList.remove("show");
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const oldScript = document.querySelector(`script[src="${src}"]`);

    if (oldScript) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

function createMapData(names) {
  return names.map((name, index) => ({
    name,
    value: index + 1
  }));
}

/*
  读取已经注册到 ECharts 里的地图区域名称。

  例如：
  加载 guangdong.js 后，ECharts 内部会注册“广东”地图。
  这个函数会从“广东”地图里自动读取：
  广州市、深圳市、珠海市、佛山市、东莞市……
*/
function getRegisteredMapRegionNames(mapName) {
  const mapInfo = echarts.getMap(mapName);

  if (!mapInfo || !mapInfo.geoJson || !mapInfo.geoJson.features) {
    return [];
  }

  return mapInfo.geoJson.features
    .map(feature => {
      const properties = feature.properties || {};
      return properties.name;
    })
    .filter(Boolean);
}

function renderMap(mapName, title, names) {
  const data = createMapData(names);

  const option = {
    backgroundColor: "transparent",

    tooltip: {
      trigger: "item",
      formatter: function (params) {
        const levelText =
          currentLevel === "country"
            ? t("tooltipLevelCountry")
            : t("tooltipLevelProvince");

        return `
          <div style="font-size:14px; line-height:1.8;">
            <strong>${params.name || ""}</strong><br/>
            ${levelText}
          </div>
        `;
      },
      backgroundColor: "rgba(9, 12, 18, 0.96)",
      borderColor: "rgba(216,180,106,0.35)",
      textStyle: {
        color: "#f6f0e8"
      }
    },

    visualMap: {
      show: false,
      min: 0,
      max: 40,
      inRange: {
        color: ["#23364f", "#315f8f", "#d8b46a"]
      }
    },

    series: [
      {
        name: title,
        type: "map",
        map: mapName,
        roam: true,
        zoom: currentLevel === "country" ? 1.16 : 1.08,
        selectedMode: false,

        label: {
          show: true,
          color: "#f8f1e6",
          fontSize: currentLevel === "country" ? 11 : 12
        },

        itemStyle: {
          areaColor: "#28496e",
          borderColor: "rgba(255,255,255,0.75)",
          borderWidth: 1,
          shadowColor: "rgba(216,180,106,0.28)",
          shadowBlur: 12
        },

        emphasis: {
          label: {
            show: true,
            color: "#111",
            fontWeight: "bold"
          },
          itemStyle: {
            areaColor: "#d8b46a",
            borderColor: "#fff5d7",
            borderWidth: 1.8,
            shadowColor: "rgba(216,180,106,0.56)",
            shadowBlur: 22
          }
        },

        data
      }
    ]
  };

  chart.clear();
  chart.setOption(option, true);

  setTimeout(() => {
    chart.resize();
  }, 80);
}

function loadChina() {
  currentLevel = "country";
  currentTitle = "全国";
  selectedArea = "全国";

  backBtn.disabled = true;

  const provinceNames = Object.keys(PROVINCE_MAP);

  renderMap("china", "全国", provinceNames);

  applyLanguage();
}

async function loadProvince(rawName) {
  const shortName = normalizeName(rawName);
  const province = PROVINCE_MAP[shortName];

  if (!province) {
    return;
  }

  try {
    showLoading(true);

    currentLevel = "province";
    currentTitle = province.mapName;
    selectedArea = province.mapName;

    backBtn.disabled = false;

    const url = `${PROVINCE_BASE_URL}/${province.file}.js`;

    if (!loadedProvinceFiles[province.file]) {
      await loadScript(url);
      loadedProvinceFiles[province.file] = true;
    }

    /*
      关键修复：
      不再传空数组 []。
      而是从已经加载好的省份地图里，自动读取市级 / 区县级名称。
    */
    const cityNames = getRegisteredMapRegionNames(province.mapName);

    renderMap(province.mapName, province.mapName, cityNames);

    applyLanguage();
  } catch (error) {
    console.error(error);
    alert(`${shortName} 地图加载失败。`);
  } finally {
    showLoading(false);
  }
}

function selectArea(name) {
  if (!name) return;

  selectedArea = name;
  selectedTitle.textContent = name;

  selectedDesc.textContent =
    currentLang === "cn"
      ? `你正在查看 ${name}。可以在这里写下旅行计划、城市印象、美食清单或路线。`
      : `You are viewing ${name}. Write down plans, impressions, food lists or routes here.`;
}

function loadNotes() {
  const raw = localStorage.getItem("travel-map-notes");

  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveNotes() {
  localStorage.setItem("travel-map-notes", JSON.stringify(notes));
}

function addNote() {
  const text = noteInput.value.trim();

  if (!selectedArea || selectedArea === "全国") {
    alert(t("alertSelect"));
    return;
  }

  if (!text) {
    alert(t("alertEmpty"));
    return;
  }

  const note = {
    id: Date.now(),
    area: selectedArea,
    text,
    time: new Date().toLocaleString()
  };

  notes.unshift(note);
  saveNotes();

  noteInput.value = "";
  renderNotes();
}

function clearNotes() {
  notes = [];
  saveNotes();
  renderNotes();
}

function renderNotes() {
  noteCount.textContent = notes.length;

  if (!notes.length) {
    notesList.innerHTML = `<div class="empty">${t("emptyNotes")}</div>`;
    return;
  }

  notesList.innerHTML = notes.map(note => {
    return `
      <div class="note-item">
        <div class="note-area">${note.area}</div>
        <div class="note-text">${escapeHtml(note.text)}</div>
        <div class="note-time">${note.time}</div>
      </div>
    `;
  }).join("");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function (char) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return map[char];
  });
}

chart.on("click", function (params) {
  if (!params || !params.name) return;

  selectArea(params.name);

  if (currentLevel === "country") {
    loadProvince(params.name);
  }
});

backBtn.addEventListener("click", loadChina);

langBtn.addEventListener("click", function () {
  currentLang = currentLang === "cn" ? "en" : "cn";
  applyLanguage();
});

saveNoteBtn.addEventListener("click", addNote);
clearBtn.addEventListener("click", clearNotes);

window.addEventListener("resize", function () {
  chart.resize();
});

loadChina();
renderNotes();
