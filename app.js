const tg = window.Telegram?.WebApp;
if (tg) {
  tg.expand();
  tg.ready();
}

const state = {
  selectedProduct: null,
  quantity: 1,
  selectedPoint: null,
  selectedAddress: "",
  comment: "",
  currentScreen: "home",
};

const PRODUCTS = [
  { id: "milka", name: "Milka", emoji: "🍫", sub: "Молочный шоколад" },
  { id: "snickers", name: "Snickers", emoji: "🥜", sub: "Шоколадный батончик" },
  { id: "kinder", name: "Kinder", emoji: "🥛", sub: "Kinder chocolate" },
  { id: "ferrero", name: "Ferrero Rocher", emoji: "✨", sub: "Подарочный шоколад" },
  { id: "lindt", name: "Lindt", emoji: "🤎", sub: "Премиум шоколад" },
  { id: "classic", name: "Шоколад", emoji: "🍬", sub: "Классический вариант" },
];

const screens = {
  home: document.getElementById("screen-home"),
  catalog: document.getElementById("screen-catalog"),
  map: document.getElementById("screen-map"),
  confirm: document.getElementById("screen-confirm"),
  help: document.getElementById("screen-help"),
};

const productGrid = document.getElementById("productGrid");
const selectedProductText = document.getElementById("selectedProductText");
const qtyValue = document.getElementById("qtyValue");
const minusQtyBtn = document.getElementById("minusQtyBtn");
const plusQtyBtn = document.getElementById("plusQtyBtn");
const toMapBtn = document.getElementById("toMapBtn");

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const resultsBox = document.getElementById("resultsBox");
const locateBtn = document.getElementById("locateBtn");
const mapModeBtn = document.getElementById("mapModeBtn");
const satModeBtn = document.getElementById("satModeBtn");
const addressValue = document.getElementById("addressValue");
const toConfirmBtn = document.getElementById("toConfirmBtn");
const mapLoader = document.getElementById("mapLoader");
const floatingActions = document.getElementById("floatingActions");
const mapSheet = document.getElementById("mapSheet");

const confirmProduct = document.getElementById("confirmProduct");
const confirmQty = document.getElementById("confirmQty");
const confirmAddress = document.getElementById("confirmAddress");
const commentInput = document.getElementById("commentInput");
const submitOrderBtn = document.getElementById("submitOrderBtn");

const toast = document.getElementById("toast");

let map;
let streetLayer;
let satelliteLayer;
let currentLayer = "map";
let marker = null;
let searchAbortController = null;
let inputDebounce = null;
let keyboardOpen = false;

function showToast(text) {
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2000);
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => {
    node.classList.toggle("active", key === name);
  });
  state.currentScreen = name;

  if (name === "map") {
    setTimeout(() => {
      map?.invalidateSize();
    }, 120);
  }

  if (name === "confirm") {
    syncConfirmScreen();
  }
}

function renderProducts() {
  productGrid.innerHTML = "";

  PRODUCTS.forEach((product) => {
    const card = document.createElement("button");
    card.className = "product-card";
    card.type = "button";
    card.innerHTML = `
      <div>
        <div class="product-emoji">${product.emoji}</div>
        <div class="product-name">${product.name}</div>
      </div>
      <div class="product-sub">${product.sub}</div>
    `;

    card.addEventListener("click", () => {
      state.selectedProduct = product;
      renderProducts();
      syncCatalogSummary();
    });

    if (state.selectedProduct?.id === product.id) {
      card.classList.add("active");
    }

    productGrid.appendChild(card);
  });
}

function syncCatalogSummary() {
  selectedProductText.textContent = state.selectedProduct
    ? state.selectedProduct.name
    : "Ничего не выбрано";
  qtyValue.textContent = String(state.quantity);
  toMapBtn.disabled = !state.selectedProduct;
}

function syncConfirmScreen() {
  confirmProduct.textContent = state.selectedProduct?.name || "—";
  confirmQty.textContent = String(state.quantity || "—");
  confirmAddress.textContent = state.selectedAddress || "—";
  commentInput.value = state.comment || "";
}

function setupCatalogActions() {
  minusQtyBtn.addEventListener("click", () => {
    state.quantity = Math.max(1, state.quantity - 1);
    syncCatalogSummary();
  });

  plusQtyBtn.addEventListener("click", () => {
    state.quantity = Math.min(999, state.quantity + 1);
    syncCatalogSummary();
  });

  toMapBtn.addEventListener("click", () => {
    if (!state.selectedProduct) return;
    showScreen("map");
  });
}

function initMap() {
  map = L.map("map", {
    zoomControl: false,
    preferCanvas: true,
  }).setView([51.831711, 9.447659], 11);

  streetLayer = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: "&copy; OpenStreetMap &copy; CARTO" }
  );

  satelliteLayer = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: "Tiles &copy; Esri" }
  );

  streetLayer.addTo(map);

  map.on("click", async (e) => {
    clearResults();
    await applyPoint(e.latlng.lat, e.latlng.lng, false);
  });
}

function setLoading(stateLoading) {
  mapLoader.classList.toggle("show", !!stateLoading);
}

function updateModeButtons() {
  mapModeBtn.classList.toggle("active", currentLayer === "map");
  satModeBtn.classList.toggle("active", currentLayer === "sat");
}

function switchToMap() {
  if (currentLayer === "map") return;
  map.removeLayer(satelliteLayer);
  streetLayer.addTo(map);
  currentLayer = "map";
  updateModeButtons();
}

function switchToSatellite() {
  if (currentLayer === "sat") return;
  map.removeLayer(streetLayer);
  satelliteLayer.addTo(map);
  currentLayer = "sat";
  updateModeButtons();
}

function createMarker(lat, lon) {
  const icon = L.divIcon({
    className: "",
    html: '<div class="custom-marker"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

  marker = L.marker([lat, lon], { icon }).addTo(map);
}

function setMarker(lat, lon) {
  state.selectedPoint = { lat, lon };
  toConfirmBtn.disabled = false;

  if (marker) {
    marker.setLatLng([lat, lon]);
  } else {
    createMarker(lat, lon);
  }
}

async function reverseGeocode(lat, lon) {
  try {
    setLoading(true);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "ru,en" },
    });
    const data = await res.json();
    const label = data.display_name || "Точка выбрана";
    state.selectedAddress = label;
    addressValue.textContent = label;
  } catch {
    state.selectedAddress = "Точка выбрана";
    addressValue.textContent = state.selectedAddress;
  } finally {
    setLoading(false);
  }
}

async function applyPoint(lat, lon, zoom = true) {
  setMarker(lat, lon);

  if (zoom) {
    map.setView([lat, lon], 16, { animate: true });
  }

  await reverseGeocode(lat, lon);
}

function clearResults() {
  resultsBox.innerHTML = "";
  resultsBox.classList.remove("show");
}

function renderResults(items) {
  resultsBox.innerHTML = "";

  if (!items.length) {
    clearResults();
    return;
  }

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "result-item";
    div.innerHTML = `
      <div class="result-title">${item.display_name}</div>
      <div class="result-sub">Нажмите, чтобы выбрать</div>
    `;

    div.addEventListener("click", async () => {
      clearResults();
      searchInput.value = item.display_name;
      await applyPoint(Number(item.lat), Number(item.lon), true);
      searchInput.blur();
    });

    resultsBox.appendChild(div);
  });

  resultsBox.classList.add("show");
}

async function searchAddress(live = false) {
  const q = searchInput.value.trim();

  if (!q || q.length < 3) {
    clearResults();
    return;
  }

  try {
    if (searchAbortController) {
      searchAbortController.abort();
    }

    searchAbortController = new AbortController();

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=6`;
    const res = await fetch(url, {
      signal: searchAbortController.signal,
      headers: { "Accept-Language": "ru,en" },
    });

    const data = await res.json();
    renderResults(data);
  } catch (e) {
    if (e.name !== "AbortError") {
      clearResults();
    }
  }
}

function setupMapActions() {
  mapModeBtn.addEventListener("click", switchToMap);
  satModeBtn.addEventListener("click", switchToSatellite);

  locateBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showToast("Геолокация не поддерживается");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        clearResults();
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        await applyPoint(lat, lon, true);
      },
      () => {
        showToast("Не удалось определить местоположение");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });

  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearResults();
    searchInput.focus();
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      searchAddress(false);
    }
  });

  searchInput.addEventListener("input", () => {
    clearTimeout(inputDebounce);

    if (!searchInput.value.trim()) {
      clearResults();
      return;
    }

    inputDebounce = setTimeout(() => {
      searchAddress(true);
    }, 260);
  });

  searchInput.addEventListener("focus", () => {
    setKeyboardOpen(true);
  });

  searchInput.addEventListener("blur", () => {
    setTimeout(() => {
      setKeyboardOpen(false);
    }, 120);
  });

  toConfirmBtn.addEventListener("click", () => {
    if (!state.selectedPoint) return;
    showScreen("confirm");
  });
}

function setupHelpAndNavigation() {
  document.getElementById("goCatalogBtn").addEventListener("click", () => {
    showScreen("catalog");
  });

  document.getElementById("goHelpBtn").addEventListener("click", () => {
    showScreen("help");
  });

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-back");
      showScreen(target);
    });
  });
}

function setupConfirm() {
  commentInput.addEventListener("input", () => {
    state.comment = commentInput.value.trim();
  });

  commentInput.addEventListener("focus", () => {
    setKeyboardOpen(true);
  });

  commentInput.addEventListener("blur", () => {
    setTimeout(() => {
      setKeyboardOpen(false);
    }, 120);
  });

  submitOrderBtn.addEventListener("click", () => {
    if (!state.selectedProduct || !state.selectedPoint || !state.selectedAddress) {
      showToast("Не хватает данных заказа");
      return;
    }

    const payload = {
      product: state.selectedProduct.name,
      quantity: state.quantity,
      lat: state.selectedPoint.lat,
      lon: state.selectedPoint.lon,
      address: state.selectedAddress,
      comment: state.comment || "",
    };

    if (tg?.sendData) {
      tg.sendData(JSON.stringify(payload));
      tg.close();
    } else {
      console.log("WebApp payload:", payload);
      showToast("Тестовый режим: данные в консоли");
    }
  });
}

function setKeyboardOpen(isOpen) {
  keyboardOpen = isOpen;
  document.body.classList.toggle("keyboard-open", isOpen);

  if (isOpen) {
    floatingActions.style.display = "none";
    clearResults();
  } else {
    floatingActions.style.display = "";
  }

  setTimeout(() => {
    map?.invalidateSize();
  }, 80);
}

function bindVisualViewport() {
  if (!window.visualViewport) return;

  const handler = () => {
    const heightDiff = window.innerHeight - window.visualViewport.height;
    const looksLikeKeyboard = heightDiff > 140;

    if (state.currentScreen === "map" || state.currentScreen === "confirm") {
      setKeyboardOpen(looksLikeKeyboard);
    }
  };

  visualViewport.addEventListener("resize", handler);
  visualViewport.addEventListener("scroll", handler);
}

function bindOutsideClicks() {
  document.addEventListener("click", (e) => {
    const clickedInsideResults = resultsBox.contains(e.target);
    const clickedInput = e.target === searchInput;
    const clickedSearchBtn = e.target === clearSearchBtn;

    if (!clickedInsideResults && !clickedInput && !clickedSearchBtn) {
      clearResults();
    }
  });
}

function init() {
  renderProducts();
  syncCatalogSummary();
  initMap();
  setupCatalogActions();
  setupMapActions();
  setupHelpAndNavigation();
  setupConfirm();
  bindVisualViewport();
  bindOutsideClicks();
}

init();