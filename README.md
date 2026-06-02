# Catálogo

Página estática para mostrar productos con búsqueda, filtros por categoría y enlace de consulta por WhatsApp.

## Editar productos

Los productos se editan en `productos.js`.

Actualiza también el número de WhatsApp en:

```js
window.CATALOG_CONFIG = {
  whatsapp: "59170000000",
  negocio: "Mi catálogo",
};
```

El número debe incluir código de país, sin `+`, espacios ni guiones.

## Publicar

Este sitio no necesita instalación ni compilación. Puede publicarse en Cloudflare Pages, Cloudflare Workers Static Assets, GitHub Pages o Netlify.
