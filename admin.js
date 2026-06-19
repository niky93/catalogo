const config = window.CATALOG_CONFIG || {};
const hasSupabase =
  window.supabase &&
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !config.supabaseUrl.includes("TU-PROYECTO");
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

const state = { editingImages: [], products: [], session: null };
const elements = {
  adminError: document.querySelector("#admin-error"),
  adminEmptyState: document.querySelector("#admin-empty-state"),
  adminProductList: document.querySelector("#admin-product-list"),
  adminForm: document.querySelector("#admin-form"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
  currentImages: document.querySelector("#current-images"),
  currentImagesField: document.querySelector("#current-images-field"),
  loginError: document.querySelector("#login-error"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  managerError: document.querySelector("#manager-error"),
  productId: document.querySelector("#product-id"),
  productManager: document.querySelector("#product-manager"),
  productCategory: document.querySelector("#product-category"),
  productDescription: document.querySelector("#product-description"),
  productImage: document.querySelector("#product-image"),
  productName: document.querySelector("#product-name"),
  productPrice: document.querySelector("#product-price"),
  refreshProductsButton: document.querySelector("#refresh-products-button"),
  saveProductButton: document.querySelector("#save-product-button"),
};

function showError(target, message = "") {
  target.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(price) {
  return new Intl.NumberFormat("es-BO", {
    style: "currency",
    currency: "BOB",
    minimumFractionDigits: 2,
  }).format(Number(price || 0));
}

function getProductImages(product) {
  const images = Array.isArray(product?.image_urls) ? product.image_urls.filter(Boolean) : [];
  if (product?.image_url && !images.includes(product.image_url)) images.unshift(product.image_url);
  return images;
}

function renderCurrentImages() {
  elements.currentImages.innerHTML = state.editingImages
    .map(
      (imageUrl, index) => `
        <div class="current-image">
          <img src="${escapeHtml(imageUrl)}" alt="Foto ${index + 1}" />
          <button type="button" data-remove-image="${index}" aria-label="Quitar foto ${index + 1}">x</button>
        </div>
      `,
    )
    .join("");
  elements.currentImagesField.hidden = !elements.productId.value;
}

function setEditMode(product = null) {
  const isEditing = Boolean(product);
  state.editingImages = getProductImages(product);
  elements.productId.value = product?.id || "";
  elements.productName.value = product?.name || "";
  elements.productCategory.value = product?.category || "";
  elements.productPrice.value = product?.price ?? "";
  elements.productDescription.value = product?.description || "";
  elements.productImage.value = "";
  elements.productImage.required = !isEditing;
  elements.saveProductButton.textContent = isEditing ? "Guardar cambios" : "Guardar producto";
  elements.cancelEditButton.hidden = !isEditing;
  renderCurrentImages();
  showError(elements.adminError);
}

async function refreshSession() {
  if (!db) {
    showError(elements.loginError, "Falta configurar Supabase para subir fotos.");
    return;
  }
  const { data } = await db.auth.getSession();
  state.session = data.session;
  elements.loginForm.hidden = Boolean(state.session);
  elements.adminForm.hidden = !state.session;
  elements.productManager.hidden = !state.session;
  elements.logoutButton.hidden = !state.session;
  if (state.session) await loadProducts();
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

async function uploadImages(files) {
  return Promise.all(files.map(uploadImage));
}

function renderProducts() {
  elements.adminProductList.innerHTML = state.products
    .map(
      (product) => `
        <article class="admin-product-row ${product.active ? "" : "is-inactive"}">
          <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" />
          <div class="admin-product-info">
            <div class="admin-product-title">
              <h3>${escapeHtml(product.name)}</h3>
              <span class="status-pill ${product.active ? "" : "inactive-pill"}">${product.active ? "Activo" : "Inactivo"}</span>
            </div>
            <p>${escapeHtml(product.category)} &middot; ${formatPrice(product.price)}</p>
            <p>${getProductImages(product).length} ${getProductImages(product).length === 1 ? "foto" : "fotos"}</p>
            <p>${escapeHtml(product.description)}</p>
          </div>
          <div class="admin-row-actions">
            <button class="admin-button" type="button" data-edit-product="${escapeHtml(product.id)}">Editar</button>
            <button class="admin-button ${product.active ? "danger-button" : "success-button"}" type="button" data-toggle-product="${escapeHtml(product.id)}">
              ${product.active ? "Ocultar" : "Activar"}
            </button>
          </div>
        </article>
      `,
    )
    .join("");
  elements.adminEmptyState.hidden = state.products.length > 0;
}

async function loadProducts() {
  showError(elements.managerError);
  const { data, error } = await db
    .from("catalog_products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    showError(elements.managerError, error.message);
    return;
  }

  state.products = data || [];
  renderProducts();
}

function getProductFormValues(imageUrls) {
  return {
    name: elements.productName.value.trim(),
    category: elements.productCategory.value.trim(),
    description: elements.productDescription.value.trim(),
    price: Number(elements.productPrice.value),
    image_url: imageUrls[0],
    image_urls: imageUrls,
  };
}

async function handleSaveProduct(event) {
  event.preventDefault();
  showError(elements.adminError);

  if (!state.session) {
    showError(elements.adminError, "Debes iniciar sesion para subir productos.");
    return;
  }

  const productId = elements.productId.value;
  const isEditing = Boolean(productId);
  const imageFiles = [...elements.productImage.files];

  try {
    const uploadedImages = imageFiles.length ? await uploadImages(imageFiles) : [];
    const imageUrls = [...state.editingImages, ...uploadedImages];
    if (!imageUrls.length) {
      showError(elements.adminError, "Selecciona al menos una foto del producto.");
      return;
    }
    const values = getProductFormValues(imageUrls);
    const { error } = isEditing
      ? await db.from("catalog_products").update(values).eq("id", productId)
      : await db.from("catalog_products").insert(values);
    if (error) throw error;

    elements.adminForm.reset();
    setEditMode();
    await loadProducts();
    showError(elements.adminError, isEditing ? "Producto actualizado correctamente." : "Producto guardado correctamente.");
  } catch (error) {
    showError(elements.adminError, error.message);
  }
}

function handleEditProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;
  setEditMode(product);
  elements.adminForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleToggleProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  const nextActive = !product.active;
  const action = nextActive ? "activar" : "ocultar";
  const confirmed = window.confirm(`Quieres ${action} "${product.name}"?`);
  if (!confirmed) return;

  showError(elements.managerError);
  const { error } = await db.from("catalog_products").update({ active: nextActive }).eq("id", productId);
  if (error) {
    showError(elements.managerError, error.message);
    return;
  }

  if (elements.productId.value === productId) setEditMode();
  await loadProducts();
}

elements.loginForm.addEventListener("submit", handleLogin);
elements.adminForm.addEventListener("submit", handleSaveProduct);
elements.cancelEditButton.addEventListener("click", () => {
  elements.adminForm.reset();
  setEditMode();
});
elements.currentImages.addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove-image]");
  if (!removeButton) return;
  state.editingImages.splice(Number(removeButton.dataset.removeImage), 1);
  renderCurrentImages();
});
elements.refreshProductsButton.addEventListener("click", loadProducts);
elements.adminProductList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-product]");
  const toggleButton = event.target.closest("[data-toggle-product]");
  if (editButton) handleEditProduct(editButton.dataset.editProduct);
  if (toggleButton) handleToggleProduct(toggleButton.dataset.toggleProduct);
});
elements.logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  state.products = [];
  renderProducts();
  setEditMode();
  await refreshSession();
});

refreshSession();
