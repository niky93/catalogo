const config = window.CATALOG_CONFIG || {};
const fallbackProducts = window.PRODUCTOS || [];
const hasSupabase =
  window.supabase &&
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !config.supabaseUrl.includes("TU-PROYECTO");
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

const state = { previewImages: [], products: [] };
const elements = {
  categoryFilter: document.querySelector("#category-filter"),
  emptyState: document.querySelector("#empty-state"),
  headerWhatsapp: document.querySelector("#header-whatsapp"),
  imageDialog: document.querySelector("#image-dialog"),
  imageGallery: document.querySelector("#image-gallery"),
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
  const imageUrls = Array.isArray(product.image_urls) ? product.image_urls.filter(Boolean) : [];
  const primaryImage = product.imagen || product.image_url || "";
  if (primaryImage && !imageUrls.includes(primaryImage)) imageUrls.unshift(primaryImage);

  return {
    id: product.id || product.nombre,
    nombre: product.nombre || product.name,
    categoria: product.categoria || product.category || "",
    precio: Number(product.precio ?? product.price ?? 0),
    descripcion: product.descripcion || product.description || "",
    imagen: imageUrls[0] || "",
    imagenes: imageUrls,
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
          <button class="product-image" type="button" data-product-id="${escapeHtml(product.id)}">
            <img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy" />
            <span>${product.imagenes.length > 1 ? `Ver ${product.imagenes.length} fotos` : "Ver foto grande"}</span>
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

function selectPreviewImage(index) {
  const imageUrl = state.previewImages[index];
  if (!imageUrl) return;
  elements.imagePreview.src = imageUrl;
  elements.imageGallery.querySelectorAll("[data-gallery-index]").forEach((button) => {
    button.classList.toggle("is-selected", Number(button.dataset.galleryIndex) === index);
  });
}

function openImagePreview(productId) {
  const product = state.products.find((item) => String(item.id) === productId);
  if (!product) return;
  state.previewImages = product.imagenes;
  elements.imagePreview.alt = product.nombre;
  elements.imagePreviewTitle.textContent = product.nombre;
  elements.imageGallery.innerHTML = product.imagenes
    .map(
      (imageUrl, index) => `
        <button type="button" data-gallery-index="${index}" aria-label="Ver foto ${index + 1}">
          <img src="${escapeHtml(imageUrl)}" alt="" />
        </button>
      `,
    )
    .join("");
  elements.imageGallery.hidden = product.imagenes.length <= 1;
  selectPreviewImage(0);
  elements.imageDialog.showModal();
}

elements.headerWhatsapp.href = buildWhatsappUrl();
elements.searchInput.addEventListener("input", renderProducts);
elements.categoryFilter.addEventListener("change", renderProducts);
elements.productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-product-id]");
  if (button) openImagePreview(button.dataset.productId);
});
elements.imageGallery.addEventListener("click", (event) => {
  const button = event.target.closest("[data-gallery-index]");
  if (button) selectPreviewImage(Number(button.dataset.galleryIndex));
});
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close());
});

loadProducts();
