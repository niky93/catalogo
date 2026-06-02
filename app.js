const config = window.CATALOG_CONFIG || {};
const fallbackProducts = window.PRODUCTOS || [];
const hasSupabase =
  window.supabase &&
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !config.supabaseUrl.includes("TU-PROYECTO");
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

const state = { products: [] };
const elements = {
  categoryFilter: document.querySelector("#category-filter"),
  emptyState: document.querySelector("#empty-state"),
  headerWhatsapp: document.querySelector("#header-whatsapp"),
  imageDialog: document.querySelector("#image-dialog"),
  imagePreview: document.querySelector("#image-preview"),
  imagePreviewTitle: document.querySelector("#image-preview-title"),
  productGrid: document.querySelector("#product-grid"),
  resultCount: document.querySelector("#result-count"),
  searchInput: document.querySelector("#search-input"),
};

function formatPrice(price) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  }).format(price);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildWhatsappUrl(productName = "") {
  const phone = config.whatsapp || "";
  const message = productName
    ? `Hola, quiero consultar por el producto: ${productName}`
    : `Hola, quiero consultar el catalogo de ${config.negocio || "productos"}`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function normalizeProduct(product) {
  return {
    id: product.id || product.nombre,
    nombre: product.nombre || product.name,
    categoria: product.categoria || product.category || "",
    precio: Number(product.precio ?? product.price ?? 0),
    descripcion: product.descripcion || product.description || "",
    imagen: product.imagen || product.image_url || "",
  };
}

async function loadProducts() {
  if (!db) {
    state.products = fallbackProducts.map(normalizeProduct);
    renderCatalog();
    return;
  }

  const { data, error } = await db.from("catalog_products").select("*").eq("active", true).order("created_at", { ascending: false });
  state.products = error ? fallbackProducts.map(normalizeProduct) : data.map(normalizeProduct);
  renderCatalog();
}

function renderCatalog() {
  renderCategories();
  renderProducts();
}

function renderCategories() {
  const selected = elements.categoryFilter.value;
  const categories = [...new Set(state.products.map((product) => product.categoria).filter(Boolean))].sort();
  elements.categoryFilter.innerHTML =
    '<option value="">Todas</option>' +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  elements.categoryFilter.value = categories.includes(selected) ? selected : "";
}

function getFilteredProducts() {
  const search = elements.searchInput.value.trim().toLocaleLowerCase("es");
  const category = elements.categoryFilter.value;

  return state.products.filter((product) => {
    const matchesSearch =
      !search ||
      product.nombre.toLocaleLowerCase("es").includes(search) ||
      product.descripcion.toLocaleLowerCase("es").includes(search);
    return matchesSearch && (!category || product.categoria === category);
  });
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();
  elements.productGrid.innerHTML = filteredProducts
    .map(
      (product) => `
        <article class="product-card">
          <button class="product-image" type="button" data-image="${escapeHtml(product.imagen)}" data-name="${escapeHtml(product.nombre)}">
            <img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy" />
            <span>Ver foto grande</span>
          </button>
          <div class="product-body">
            <span class="category">${escapeHtml(product.categoria)}</span>
            <h3>${escapeHtml(product.nombre)}</h3>
            <p class="description">${escapeHtml(product.descripcion)}</p>
            <div class="price-row">
              <span class="price">${formatPrice(product.precio)}</span>
              <a class="button" href="${buildWhatsappUrl(product.nombre)}" target="_blank" rel="noreferrer">Consultar</a>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  elements.resultCount.textContent = `${filteredProducts.length} ${filteredProducts.length === 1 ? "producto" : "productos"}`;
  elements.emptyState.hidden = filteredProducts.length > 0;
}

function openImagePreview(button) {
  elements.imagePreview.src = button.dataset.image;
  elements.imagePreview.alt = button.dataset.name;
  elements.imagePreviewTitle.textContent = button.dataset.name;
  elements.imageDialog.showModal();
}

elements.headerWhatsapp.href = buildWhatsappUrl();
elements.searchInput.addEventListener("input", renderProducts);
elements.categoryFilter.addEventListener("change", renderProducts);
elements.productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-image]");
  if (button) openImagePreview(button);
});
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close());
});

loadProducts();
