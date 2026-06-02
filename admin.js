const config = window.CATALOG_CONFIG || {};
const hasSupabase =
  window.supabase &&
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !config.supabaseUrl.includes("TU-PROYECTO");
const db = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey) : null;

const state = { session: null };
const elements = {
  adminError: document.querySelector("#admin-error"),
  adminForm: document.querySelector("#admin-form"),
  loginError: document.querySelector("#login-error"),
  loginForm: document.querySelector("#login-form"),
  logoutButton: document.querySelector("#logout-button"),
  productCategory: document.querySelector("#product-category"),
  productDescription: document.querySelector("#product-description"),
  productImage: document.querySelector("#product-image"),
  productName: document.querySelector("#product-name"),
  productPrice: document.querySelector("#product-price"),
};

function showError(target, message = "") {
  target.textContent = message;
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

  if (!state.session) {
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
    showError(elements.adminError, "Producto guardado correctamente.");
  } catch (error) {
    showError(elements.adminError, error.message);
  }
}

elements.loginForm.addEventListener("submit", handleLogin);
elements.adminForm.addEventListener("submit", handleCreateProduct);
elements.logoutButton.addEventListener("click", async () => {
  await db.auth.signOut();
  await refreshSession();
});

refreshSession();
