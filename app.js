let productData = [
  {
    id: "milka",
    name: "Milka",
    tag: "Хит",
    category: "Сладости",
    description: "Классическая плитка для быстрых заказов.",
    price: "",
    stock: 18,
    feature: "Быстрый заказ через Telegram Mini App",
  },
];

const presetComments = [
  "Позвонить за 10 минут",
  "Оставить у двери",
  "Написать в Telegram",
  "Доставить после 18:00",
];

const statusPresets = [
  { badge: "Новый", title: "Заказ принят", eta: "Ожидает подтверждения", updated: "только что", activeIndex: 0 },
  { badge: "Собирается", title: "Заказ подтвержден", eta: "Собираем заказ", updated: "1 минуту назад", activeIndex: 1 },
  { badge: "В маршруте", title: "Курьер уже едет", eta: "Ориентир: 10-20 минут", updated: "5 минут назад", activeIndex: 2 },
  { badge: "Доставлен", title: "Заказ завершен", eta: "Спасибо за заказ", updated: "завершено", activeIndex: 3 },
];

const timelineSteps = [
  { title: "Заказ получен", text: "Товар, количество и город сохранены.", time: "только что" },
  { title: "Подтвержден", text: "Администратор проверил заказ и наличие.", time: "после обработки" },
  { title: "В доставке", text: "Пользователь видит только статус, без внутреннего маршрута.", time: "когда курьер выезжает" },
  { title: "Доставлен", text: "Заказ закрыт и сохранен в истории пользователя.", time: "последний шаг" },
];

const state = {
  screen: "catalog",
  category: "Все",
  preview: null,
  statusIndex: 0,
  darkMode: false,
  latestOrder: null,
  initData: "",
  telegramReady: false,
};

const app = document.getElementById("app");
const categoryStrip = document.getElementById("categoryStrip");
const featureRail = document.getElementById("featureRail");
const productGrid = document.getElementById("productGrid");
const productInput = document.getElementById("productInput");
const quantityInput = document.getElementById("quantityInput");
const cityInput = document.getElementById("cityInput");
const contactInput = document.getElementById("contactInput");
const commentInput = document.getElementById("commentInput");
const previewOrder = document.getElementById("previewOrder");
const presetCommentsNode = document.getElementById("presetComments");
const timelineNode = document.getElementById("timeline");
const bottomNav = document.getElementById("bottomNav");
const statusBadge = document.getElementById("statusBadge");
const statusTitle = document.getElementById("statusTitle");
const statusEta = document.getElementById("statusEta");
const statusCity = document.getElementById("statusCity");
const statusItems = document.getElementById("statusItems");
const statusComment = document.getElementById("statusComment");
const statusUpdated = document.getElementById("statusUpdated");

function categories() {
  return ["Все", ...new Set(productData.map((item) => item.category || "Сладости"))];
}

function currentProducts() {
  if (state.category === "Все") {
    return productData;
  }
  return productData.filter((item) => (item.category || "Сладости") === state.category);
}

function showToast(text) {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.showAlert) {
    window.Telegram.WebApp.showAlert(text);
    return;
  }
  window.alert(text);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Ошибка запроса.");
  }
  return data;
}

function setScreen(target) {
  state.screen = target;

  document.querySelectorAll(".screen").forEach((node) => {
    node.classList.toggle("is-active", node.dataset.screen === target);
  });

  document.querySelectorAll(".bottom-nav__item").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.target === target);
  });

  syncTelegramMainButton();
}

function renderCategories() {
  categoryStrip.innerHTML = categories()
    .map(
      (category) => `
        <button class="quick-strip__item ${category === state.category ? "is-active" : ""}" data-category="${category}" type="button">
          ${category}
        </button>
      `
    )
    .join("");
}

function renderFeatures() {
  const featured = currentProducts().slice(0, 3);
  featureRail.innerHTML = featured
    .map(
      (item) => `
        <article class="feature-card">
          <span class="feature-card__label">${item.tag || "Подборка"}</span>
          <h4>${item.name}</h4>
          <p>${item.feature || "Быстрый заказ через Telegram Mini App"}</p>
        </article>
      `
    )
    .join("");
}

function renderProducts() {
  productGrid.innerHTML = currentProducts()
    .map(
      (item) => `
        <article class="product-card">
          <div class="product-card__visual">
            <div class="product-card__wave"></div>
          </div>
          <div class="product-card__body">
            <div class="product-card__top">
              <span class="product-card__tag">${item.tag || "Товар"}</span>
              <span class="product-card__stock">${item.stock} шт. в наличии</span>
            </div>
            <h4>${item.name}</h4>
            <p>${item.description || item.name}</p>
            <div class="product-card__meta">
              <div class="product-card__price">
                <span>Наличие</span>
                <strong>${item.stock} шт.</strong>
              </div>
              <button class="product-card__button" data-product="${item.id}" type="button">Выбрать</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderProductOptions() {
  productInput.innerHTML = productData
    .map((item) => `<option value="${item.id}">${item.name}</option>`)
    .join("");
}

function renderPresetComments() {
  presetCommentsNode.innerHTML = presetComments
    .map((text) => `<button class="pill-button" data-comment="${text}" type="button">${text}</button>`)
    .join("");
}

function resolveProduct(productId) {
  return productData.find((item) => item.id === productId) || productData[0];
}

function buildPreviewState() {
  const product = resolveProduct(productInput.value);
  return {
    productId: product.id,
    product: product.name,
    quantity: Math.max(1, Number(quantityInput.value || 1)),
    city: cityInput.value.trim() || "Не указан",
    contact: contactInput.value.trim() || "Не указан",
    comment: commentInput.value.trim() || "Без комментария",
    eta: "Ориентир: 30-45 минут",
  };
}

function renderPreview() {
  if (!state.preview) {
    previewOrder.innerHTML = `
      <div class="preview-empty">
        Здесь появится аккуратная карточка заказа после выбора товара, количества и города.
      </div>
    `;
    return;
  }

  previewOrder.innerHTML = `
    <article class="preview-card">
      <div class="preview-card__title">
        <div>
          <p class="eyebrow">Подтверждение</p>
          <h5>Готово к отправке</h5>
        </div>
        <span class="preview-card__number">SweetFlow</span>
      </div>
      <div class="preview-list">
        <div class="preview-row"><span>Товар</span><strong>${state.preview.product}</strong></div>
        <div class="preview-row"><span>Количество</span><strong>${state.preview.quantity}</strong></div>
        <div class="preview-row"><span>Город</span><strong>${state.preview.city}</strong></div>
        <div class="preview-row"><span>Контакт</span><strong>${state.preview.contact}</strong></div>
        <div class="preview-row"><span>Комментарий</span><strong>${state.preview.comment}</strong></div>
      </div>
      <div class="preview-footnote">${state.preview.eta}. Когда всё готово, подтвердите заказ кнопкой Telegram внизу.</div>
    </article>
  `;
}

function statusIndexFromLabel(label) {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("достав")) {
    return 3;
  }
  if (normalized.includes("маршрут")) {
    return 2;
  }
  if (normalized.includes("собира")) {
    return 1;
  }
  return 0;
}

function renderTimeline() {
  timelineNode.innerHTML = timelineSteps
    .map((step, index) => {
      const currentIndex = state.latestOrder ? statusIndexFromLabel(state.latestOrder.status) : state.statusIndex;
      const isDone = index < currentIndex;
      const isActive = index === currentIndex;
      return `
        <article class="timeline__step ${isDone ? "is-done" : ""} ${isActive ? "is-active" : ""}">
          <strong>${step.title}</strong>
          <p>${step.text}</p>
          <small>${step.time}</small>
        </article>
      `;
    })
    .join("");
}

function renderStatus() {
  const order = state.latestOrder;
  const preset = order ? statusPresets[statusIndexFromLabel(order.status)] : statusPresets[state.statusIndex];

  statusBadge.textContent = order ? order.status : preset.badge;
  statusTitle.textContent = order ? `Заказ №${order.number}` : preset.title;
  statusEta.textContent = preset.eta;
  statusUpdated.textContent = order ? (order.date || "сейчас") : preset.updated;

  if (order) {
    statusCity.textContent = order.city || "Не указан";
    statusItems.textContent = `${order.product || "-"} × ${order.quantity || "-"}`;
    statusComment.textContent = order.comment || "Без комментария";
  } else if (state.preview) {
    statusCity.textContent = state.preview.city;
    statusItems.textContent = `${state.preview.product} × ${state.preview.quantity}`;
    statusComment.textContent = state.preview.comment;
  } else {
    statusCity.textContent = "Заказов пока нет";
    statusItems.textContent = "—";
    statusComment.textContent = "Оформите первый заказ";
  }

  renderTimeline();
}

function chooseProduct(productId) {
  productInput.value = productId;
  state.preview = buildPreviewState();
  renderPreview();
  setScreen("order");
}

function shuffleProducts() {
  if (productData.length > 1) {
    productData.push(productData.shift());
  }
  renderFeatures();
  renderProducts();
}

function updateQuantity(delta) {
  quantityInput.value = String(Math.max(1, Number(quantityInput.value || 1) + delta));
}

function fillDemoOrder() {
  const preferred = productData.find((item) => item.stock > 0) || productData[0];
  productInput.value = preferred.id;
  quantityInput.value = "2";
  cityInput.value = "Berlin";
  contactInput.value = "@sweet_customer";
  commentInput.value = "Позвонить за 10 минут";
  state.preview = buildPreviewState();
  renderPreview();
}

function cycleStatus() {
  state.latestOrder = null;
  state.statusIndex = (state.statusIndex + 1) % statusPresets.length;
  renderStatus();
  syncTelegramMainButton();
}

function toggleTheme() {
  state.darkMode = !state.darkMode;
  document.body.classList.toggle("theme-night", state.darkMode);
}

async function loadCatalog() {
  try {
    const data = await apiRequest("./api/catalog", { method: "GET", headers: {} });
    if (Array.isArray(data.items) && data.items.length) {
      productData = data.items;
    }
  } catch (error) {
    console.error(error);
  }

  renderCategories();
  renderFeatures();
  renderProducts();
  renderProductOptions();
}

async function loadLatestOrder() {
  if (!state.initData) {
    renderStatus();
    return;
  }

  try {
    const data = await apiRequest("./api/orders/latest", {
      method: "POST",
      body: JSON.stringify({ init_data: state.initData }),
    });
    state.latestOrder = data.latest || null;
    renderStatus();
  } catch (error) {
    console.error(error);
    renderStatus();
  }
}

async function createOrderFromMiniApp() {
  if (!state.preview) {
    state.preview = buildPreviewState();
    renderPreview();
  }

  if (!state.initData) {
    showToast("Откройте мини-приложение из Telegram, чтобы оформить реальный заказ.");
    return;
  }

  const order = {
    product: state.preview.product,
    quantity: state.preview.quantity,
    city: state.preview.city,
    contact: state.preview.contact,
    comment: state.preview.comment,
  };

  try {
    const data = await apiRequest("./api/orders/create", {
      method: "POST",
      body: JSON.stringify({
        init_data: state.initData,
        order,
      }),
    });

    state.latestOrder = data.order;
    setScreen("status");
    renderStatus();
    showToast(`Заказ №${data.order.number} создан`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Не удалось создать заказ.");
  }
}

function syncTelegramMainButton() {
  if (!window.Telegram || !window.Telegram.WebApp) {
    return;
  }

  const tg = window.Telegram.WebApp;
  tg.MainButton.offClick(mainButtonHandler);

  if (state.screen === "order") {
    tg.MainButton.setText("Подтвердить заказ");
    tg.MainButton.show();
    tg.MainButton.onClick(mainButtonHandler);
    return;
  }

  if (state.screen === "status") {
    tg.MainButton.setText("Обновить статус");
    tg.MainButton.show();
    tg.MainButton.onClick(mainButtonHandler);
    return;
  }

  tg.MainButton.hide();
}

function mainButtonHandler() {
  if (state.screen === "order") {
    createOrderFromMiniApp();
    return;
  }
  if (state.screen === "status") {
    loadLatestOrder();
  }
}

function bindEvents() {
  categoryStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) {
      return;
    }
    state.category = button.dataset.category;
    renderCategories();
    renderFeatures();
    renderProducts();
  });

  productGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-product]");
    if (!button) {
      return;
    }
    chooseProduct(button.dataset.product);
  });

  presetCommentsNode.addEventListener("click", (event) => {
    const button = event.target.closest("[data-comment]");
    if (!button) {
      return;
    }
    commentInput.value = button.dataset.comment;
  });

  bottomNav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-target]");
    if (!button) {
      return;
    }
    setScreen(button.dataset.target);
  });

  document.getElementById("orderForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.preview = buildPreviewState();
    renderPreview();
    renderStatus();
  });

  document.getElementById("shuffleProducts").addEventListener("click", shuffleProducts);
  document.getElementById("plusQty").addEventListener("click", () => updateQuantity(1));
  document.getElementById("minusQty").addEventListener("click", () => updateQuantity(-1));
  document.getElementById("fillDemoOrder").addEventListener("click", fillDemoOrder);
  document.getElementById("rotateStatus").addEventListener("click", cycleStatus);
  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
}

function initTelegramWebApp() {
  if (!window.Telegram || !window.Telegram.WebApp) {
    syncTelegramMainButton();
    return;
  }

  const tg = window.Telegram.WebApp;
  state.telegramReady = true;
  state.initData = tg.initData || "";

  tg.ready();
  tg.expand();

  if (tg.themeParams && tg.colorScheme === "dark") {
    document.body.classList.add("theme-night");
    state.darkMode = true;
  }

  syncTelegramMainButton();
}

async function init() {
  renderPresetComments();
  renderPreview();
  bindEvents();
  initTelegramWebApp();
  await loadCatalog();
  await loadLatestOrder();
}

init();
