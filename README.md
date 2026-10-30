# RICOS 3D VIEWER

Galería web 3D minimalista. Permite **previsualizar GLB, OBJ y STL**, girar/acercar/alejar y compartir modelos **públicos**. Con Supabase conectado, un **administrador autorizado** puede publicar y eliminar modelos y todos los visitantes ven la misma colección.

## 1. Publicar la web con GitHub Pages

1. Abrí **Settings > Pages** del repositorio.
2. En **Build and deployment**, elegí **Deploy from a branch**.
3. Seleccioná **main** y carpeta **/(root)**. Guardá los cambios.
4. El enlace previsto es `https://serigrafiamdp-web.github.io/RICOS-3D-VIEWER/` **una vez que Pages esté activado**.

Esta web no necesita build: son archivos HTML, CSS y JavaScript estáticos. No subas claves privadas al repositorio.

## 2. Primer modelo Altec (sin Supabase)

El modelo exportado por Meshy que debés usar es **`Meshy_AI_Altec_Speaker_Cabinet_1030194443_texture(1).glb`** (24,5 MB). Contiene geometría + tres imágenes JPEG embebidas. **No hace falta** subir el archivo `generate(2).glb`.

1. En GitHub, abrí **Add file > Upload files** en el repositorio y cargá el GLB renombrado **`altec-speaker.glb`** **dentro de la carpeta `models/`**.
2. Ya está creado `models.json` con ese nombre y ruta. No tenés que modificarlo.
3. La web comprueba que el archivo exista y lo agrega al catálogo. Antes de que esté alojado, el visor muestra un ejemplo geométrico para probar sus controles.

GitHub acepta por navegador archivos de hasta 25 MiB. El GLB de ejemplo pesa aproximadamente 23,33 MiB, por debajo del límite. Para compartir muchos modelos o permitir cargarlos desde la propia web, usá Supabase como se explica a continuación.

> Si solo querés probar el GLB sin publicarlo, tocá **Abrir un modelo local** y seleccioná el archivo. Eso no lo comparte con visitantes.

## 3. Publicación desde la propia web: Supabase

**Configuración pendiente de realizar desde tu cuenta Supabase:**

1. Creá un proyecto gratuito en [supabase.com](https://supabase.com).
2. En **SQL Editor**, ejecutá el archivo [supabase/setup.sql](./supabase/setup.sql). Crea la tabla de modelos, los permisos y el bucket público `model-files` para archivos de hasta 50 MiB.
3. En **Project Settings > API**, copiá la **Project URL** y la clave **publishable/anon** y completá **config.js**. **Nunca uses la clave `service_role` ni una secret key en el navegador.**
4. En **Authentication > URL Configuration**, fijá **Site URL** en la dirección de GitHub Pages y añadí esa misma dirección a **Redirect URLs**. Confirmá que el proveedor email esté activo.
5. En la web, tocá **Administrar** e iniciá sesión con tu correo, usando el enlace recibido.
6. En Supabase **SQL Editor**, asigná ese usuario como administrador (reemplazá el correo):
   ```sql
   insert into public.app_admins(user_id)
   select id from auth.users where email = 'tu-correo@ejemplo.com'
   on conflict do nothing;
   ```
7. Actualizá la web. Se habilita **Subir modelo**. Cada publicación se guarda en **Storage** y en la tabla **models**. Alguien que visite la página verá los modelos inmediatamente (o al recargar si ya estaba viendo el catálogo).

**Permisos:** cualquiera puede ver la biblioteca. Solo los usuarios que aparezcan en `app_admins` pueden subir y borrar. Las políticas RLS se aplican en el servidor de Supabase; ocultar el botón por sí solo no sería una protección suficiente.

## Formatos admitidos

- **GLB**: recomendado. Un único archivo puede contener malla, materiales y texturas, como el Altec.
- **OBJ**: se interpreta la geometría; este prototipo no sube archivos auxiliares `.mtl` y texturas por separado.
- **STL**: geometría sin texturas (se usa un material neutral).
- Tamaño máximo configurado: **50 MiB** para Supabase.

## Estructura

```
index.html           Interfaz de galería
src/main.js          Visor Three.js, biblioteca, administrador
src/style.css        Diseño responsive
config.js            URL y clave publicable Supabase
models.json          Modelos estáticos servidos desde GitHub Pages
supabase/setup.sql   Base de datos, bucket y reglas de seguridad
```

## Estado del prototipo

- ✅ Código de la web y visor en el repositorio.
- ✅ Ficha Altec preparada en el manifiesto; el modelo aparece cuando existe el archivo real.
- ✅ Vista previa de archivos locales sin backend.
- ✅ Subida/borrado público listos para habilitar tras configurar Supabase.
- ⏳ Requiere activar GitHub Pages en Settings si no está habilitado.
- ⏳ Requiere subir `models/altec-speaker.glb` o conectar Supabase para alojar los GLB remotamente.
