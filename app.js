const products = window.PRODUCTOS || [];
const config = window.CATALOG_CONFIG || {};
const elements = {
  categoryFilter: document.querySelector("#category-filter"),
  emptyState: document.querySelector("#empty-state"),
  headerWhatsapp: document.querySelector("#header-whatsapp"),
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

function renderCategories() {
  const categories = [...new Set(products.map((product) => product.categoria))].sort();
  elements.categoryFilter.innerHTML =
    '<option value="">Todas</option>' +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
}

function getFilteredProducts() {
  const search = elements.searchInput.value.trim().toLocaleLowerCase("es");
  const category = elements.categoryFilter.value;

  return products.filter((product) => {
    const matchesSearch =
      !search ||
      product.nombre.toLocaleLowerCase("es").includes(search) ||
      product.descripcion.toLocaleLowerCase("es").includes(search);
    const matchesCategory = !category || product.categoria === category;
    return matchesSearch && matchesCategory;
  });
}

function renderProducts() {
  const filteredProducts = getFilteredProducts();
  elements.productGrid.innerHTML = filteredProducts
    .map(
      (product) => `
        <article class="product-card">
          <div class="product-image">
            <img src="${escapeHtml(product.imagen)}" alt="${escapeHtml(product.nombre)}" loading="lazy" />
          </div>
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

elements.headerWhatsapp.href = buildWhatsappUrl();
elements.searchInput.addEventListener("input", renderProducts);
elements.categoryFilter.addEventListener("change", renderProducts);

renderCategories();
renderProducts();
