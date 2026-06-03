const config = window.CATALOG_CONFIG || {};
const hasSupabase =
  window.supabase &&
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !config.supabaseUrl.includes("TU-PROYECTO");
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

const state = { products: [], session: null };
const elements = {
  adminError: document.querySelector("#admin-error"),
  adminEmptyState: document.querySelector("#admin-empty-state"),
  adminProductList: document.querySelector("#admin-product-list"),
  adminForm: document.querySelector("#admin-form"),
  cancelEditButton: document.querySelector("#cancel-edit-button"),
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

function setEditMode(product = null) {
  const isEditing = Boolean(product);
  elements.productId.value = product?.id || "";
  elements.productName.value = product?.name || "";
  elements.productCategory.value = product?.category || "";
  elements.productPrice.value = product?.price ?? "";
  elements.productDescription.value = product?.description || "";
  elements.productImage.value = "";
  elements.productImage.required = !isEditing;
  elements.saveProductButton.textContent = isEditing ? "Guardar cambios" : "Guardar producto";
  elements.cancelEditButton.hidden = !isEditing;
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

function renderProducts() {
  elements.adminProductList.innerHTML = state.products
    .map(
      (product) => `
        <article class="admin-product-row">
          <img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" />
          <div class="admin-product-info">
            <h3>${escapeHtml(product.name)}</h3>
            <p>${escapeHtml(product.category)} &middot; ${formatPrice(product.price)}</p>
            <p>${escapeHtml(product.description)}</p>
          </div>
          <div class="admin-row-actions">
            <button class="admin-button" type="button" data-edit-product="${escapeHtml(product.id)}">Editar</button>
            <button class="admin-button danger-button" type="button" data-delete-product="${escapeHtml(product.id)}">Eliminar</button>
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
    .select("id,name,category,description,price,image_url,active,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    showError(elements.managerError, error.message);
    return;
  }

  state.products = data || [];
  renderProducts();
}

function getProductFormValues(imageUrl = "") {
  return {
    name: elements.productName.value.trim(),
    category: elements.productCategory.value.trim(),
    description: elements.productDescription.value.trim(),
    price: Number(elements.productPrice.value),
    ...(imageUrl ? { image_url: imageUrl } : {}),
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
  const imageFile = elements.productImage.files[0];
  if (!isEditing && !imageFile) {
    showError(elements.adminError, "Selecciona una foto del producto.");
    return;
  }

  try {
    const imageUrl = imageFile ? await uploadImage(imageFile) : "";
    const values = getProductFormValues(imageUrl);
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

async function handleDeleteProduct(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) return;

  const confirmed = window.confirm(`Eliminar "${product.name}"? Esta accion no se puede deshacer.`);
  if (!confirmed) return;

  showError(elements.managerError);
  const { error } = await db.from("catalog_products").delete().eq("id", productId);
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
elements.refreshProductsButton.addEventListener("click", loadProducts);
elements.adminProductList.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-product]");
  const deleteButton = event.target.closest("[data-delete-product]");
  if (editButton) handleEditProduct(editButton.dataset.editProduct);
  if (deleteButton) handleDeleteProduct(deleteButton.dataset.deleteProduct);
});
elements.logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  state.products = [];
  renderProducts();
  setEditMode();
  await refreshSession();
});

refreshSession();
