const demoProducts = [
  {
    name: "Milka",
    tag: "Хит",
    description: "Мягкая карточка товара с акцентом на наличие и быстрый выбор количества.",
    stock: 18,
  },
  {
    name: "Snickers",
    tag: "Энергия",
    description: "Карточка может показывать остаток, статус доступности и быструю кнопку заказа.",
    stock: 9,
  },
  {
    name: "Kinder",
    tag: "Семья",
    description: "Подходит для мини-витрины в Telegram, где важны скорость и чистый интерфейс.",
    stock: 14,
  },
  {
    name: "Ferrero Rocher",
    tag: "Премиум",
    description: "Хорошо смотрится как более дорогая позиция в отдельной категории.",
    stock: 6,
  },
];

const catalogGrid = document.getElementById("catalogGrid");
const productInput = document.getElementById("productInput");
const orderForm = document.getElementById("orderForm");
const previewCard = document.getElementById("previewCard");
const refreshButton = document.getElementById("refreshButton");
const statusButton = document.getElementById("statusButton");

function renderCatalog() {
  catalogGrid.innerHTML = demoProducts
    .map(
      (product) => `
        <article class="catalog-card">
          <div class="catalog-card__visual">
            <div class="catalog-card__swirl"></div>
          </div>
          <div class="catalog-card__meta">
            <span class="catalog-card__tag">${product.tag}</span>
            <span class="catalog-card__count">${product.stock} шт.</span>
          </div>
          <div>
            <h3 class="catalog-card__title">${product.name}</h3>
            <p class="catalog-card__desc">${product.description}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function renderProductOptions() {
  productInput.innerHTML = demoProducts
    .map((product) => `<option value="${product.name}">${product.name}</option>`)
    .join("");
}

function renderPreview(payload) {
  previewCard.innerHTML = `
    <div class="preview-card__order">
      <h3>Заказ • предпросмотр</h3>
      <div class="preview-card__line">
        <span>Товар</span>
        <strong>${payload.product}</strong>
      </div>
      <div class="preview-card__line">
        <span>Количество</span>
        <strong>${payload.quantity}</strong>
      </div>
      <div class="preview-card__line">
        <span>Город</span>
        <strong>${payload.city}</strong>
      </div>
      <div class="preview-card__line">
        <span>Комментарий</span>
        <strong>${payload.comment || "Без комментария"}</strong>
      </div>
    </div>
  `;
}

function bindEvents() {
  orderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = {
      product: productInput.value,
      quantity: document.getElementById("quantityInput").value,
      city: document.getElementById("cityInput").value,
      comment: document.getElementById("commentInput").value,
    };
    renderPreview(payload);
  });

  refreshButton.addEventListener("click", () => {
    renderCatalog();
  });

  statusButton.addEventListener("click", () => {
    renderPreview({
      product: "Milka",
      quantity: "2",
      city: "Hannover",
      comment: "Статус можно подтягивать из API бота",
    });
  });
}

function initTelegramWebApp() {
  if (!window.Telegram || !window.Telegram.WebApp) {
    return;
  }

  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();

  if (tg.themeParams?.bg_color) {
    document.documentElement.style.setProperty("--bg", tg.themeParams.bg_color);
  }
}

renderCatalog();
renderProductOptions();
bindEvents();
initTelegramWebApp();
