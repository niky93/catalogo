# Anzuelo & Llama

Catalogo publico para Anzuelo & Llama.

Lema: Pasion por el rio, calor de hogar.

## Configurar Supabase para subir fotos

1. Crea un proyecto en Supabase.
2. En `SQL Editor`, ejecuta el contenido de `catalogo-schema.sql`.
3. En `Authentication` > `Users`, crea tu usuario administrador.
4. En `Project Settings` > `Data API`, copia la URL del proyecto.
5. En `Project Settings` > `API Keys`, copia la clave publica `publishable`.
6. Pega esos datos en `productos.js`.

La clave publica puede estar en el navegador. No uses una clave `secret` ni `service_role`.

## Vistas

- `index.html`: catalogo publico. No muestra boton de administracion.
- `admin.html`: panel privado para iniciar sesion y subir productos con foto.

## Editar configuracion

Actualiza el numero de WhatsApp en `productos.js`:

```js
window.CATALOG_CONFIG = {
  whatsapp: "59170000000",
  negocio: "Mi catalogo",
  supabaseUrl: "https://TU-PROYECTO.supabase.co",
  supabasePublishableKey: "TU-CLAVE-PUBLICA",
};
```

El numero debe incluir codigo de pais, sin `+`, espacios ni guiones.

Si Supabase no esta configurado, la pagina mostrara los productos de ejemplo que estan en `productos.js`.

## Habilitar varias fotos por producto

Si la base de datos ya existia antes de esta funcionalidad, ejecuta una vez el contenido de
`catalogo-multimagen.sql` en `Supabase` > `SQL Editor`.

Los productos existentes conservaran su foto actual. Desde `admin.html` se podran agregar o
quitar varias fotos al editar un producto.
