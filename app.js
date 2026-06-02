const config = window.CATALOG_CONFIG || {};
const fallbackProducts = window.PRODUCTOS || [];
const hasSupabase =
  window.supabase &&
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !config.supabaseUrl.includes("TU-PROYECTO");
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

const state = { products: [], session: null };
const elements = {
  adminDialog: document.querySelector("#admin-dialog"),
  adminError: document.querySelector("#admin-error"),
  adminForm: document.querySelector("#admin-form"),
  adminOpenButton: document.querySelector("#admin-open-button"),
  categoryFilter: document.querySelector("#category-filter"),
  emptyState: document.querySelector("#empty-state"),
  headerWhatsapp: document.querySelector("#header-whatsapp"),
  imageDialog: document.querySelector("#image-dialog"),
  imagePreview: document.querySelector("#image-preview"),
  imagePreviewTitle: document.querySelector("#image-preview-title"),
  loginError: document.querySelector("#login-error"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  productCategory: document.querySelector("#product-category"),
  productDescription: document.querySelector("#product-description"),
  productGrid: document.querySelector("#product-grid"),
  productImage: document.querySelector("#product-image"),
  productName: document.querySelector("#product-name"),
  productPrice: document.querySelector("#product-price"),
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

function showError(target, message = "") {
  target.textContent = message;
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
  if (error) {
    state.products = fallbackProducts.map(normalizeProduct);
    renderCatalog();
    return;
  }

  state.products = data.map(normalizeProduct);
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

async function refreshSession() {
  if (!db) return;
  const { data } = await db.auth.getSession();
  state.session = data.session;
  elements.loginForm.hidden = Boolean(state.session);
  elements.adminForm.hidden = !state.session;
  elements.logoutButton.hidden = !state.session;
}

async function handleLogin(event) {
  event.preventDefault();
  showError(elements.loginError);
  const form = new FormData(event.currentTarget);
  const { error } = await db.auth.signInWithPassword({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (error) {
    showError(elements.loginError, "No se pudo iniciar sesion. Revisa correo y contrasena.");
    return;
  }
  await refreshSession();
}

async function uploadImage(file) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${extension}`;
  const { error } = await db.storage.from("catalog-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = db.storage.from("catalog-images").getPublicUrl(path);
  return data.publicUrl;
}

async function handleCreateProduct(event) {
  event.preventDefault();
  showError(elements.adminError);

  if (!db || !state.session) {
    showError(elements.adminError, "Debes iniciar sesion para subir productos.");
    return;
  }

  const imageFile = elements.productImage.files[0];
  if (!imageFile) {
    showError(elements.adminError, "Selecciona una foto del producto.");
    return;
  }

  try {
    const imageUrl = await uploadImage(imageFile);
    const { error } = await db.from("catalog_products").insert({
      name: elements.productName.value.trim(),
      category: elements.productCategory.value.trim(),
      description: elements.productDescription.value.trim(),
      price: Number(elements.productPrice.value),
      image_url: imageUrl,
    });
    if (error) throw error;

    elements.adminForm.reset();
    await loadProducts();
    elements.adminDialog.close();
  } catch (error) {
    showError(elements.adminError, error.message);
  }
}

elements.headerWhatsapp.href = buildWhatsappUrl();
elements.searchInput.addEventListener("input", renderProducts);
elements.categoryFilter.addEventListener("change", renderProducts);
elements.productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-image]");
  if (button) openImagePreview(button);
});
elements.adminOpenButton.addEventListener("click", async () => {
  if (!db) {
    elements.loginForm.hidden = false;
    elements.adminForm.hidden = true;
    elements.logoutButton.hidden = true;
    showError(elements.loginError, "Falta configurar Supabase para subir fotos.");
    elements.adminDialog.showModal();
    return;
  }
  await refreshSession();
  elements.adminDialog.showModal();
});
elements.loginForm.addEventListener("submit", handleLogin);
elements.adminForm.addEventListener("submit", handleCreateProduct);
elements.logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  await refreshSession();
});
document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.closeDialog}`).close());
});

loadProducts();
