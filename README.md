# RICOS 3D VIEWER

Visor web 3D minimalista alojado en [GitHub Pages](https://serigrafiamdp-web.github.io/RICOS-3D-VIEWER/).

## Interfaz

- Visor 3D grande, sin paneles de configuración ni textos decorativos.
- Biblioteca lateral con los archivos 3D guardados en la carpeta `models/` de este mismo repositorio.
- Botón **Cargar modelo local**: abre un archivo `.glb`, `.obj` o `.stl` de tu equipo y lo muestra sin publicarlo.
- Después de cargar un modelo local, aparece arriba a la derecha un **ícono de guardar**. Desde allí se puede publicar el archivo en GitHub.
- Los modelos subidos a `models/` aparecen en la biblioteca de todos los visitantes, incluso si no hay una base de datos externa.
- Controles 3D: arrastrar para rotar, rueda para zoom y botón secundario para desplazar.

## Publicar un modelo desde la propia web

**Para este prototipo, solo el dueño del repositorio debe publicar archivos.** GitHub Pages es una web estática: no puede escribir archivos por sí sola. La aplicación utiliza la [GitHub Contents API](https://docs.github.com/en/rest/repos/contents#contents) para agregar modelos al repositorio.

1. Entrá a [GitHub > Fine-grained personal access tokens](https://github.com/settings/personal-access-tokens/new).
2. Seleccioná un **token de corta duración** (por ejemplo, 1 día), con acceso **solo a `serigrafiamdp-web/RICOS-3D-VIEWER`** y permiso **Repository permissions > Contents: Read and write**. No son necesarios permisos de administración ni Workflow.
3. Abrí la web, hacé clic en **Cargar modelo local** y elegí un archivo 3D.
4. Hacé clic en el ícono de guardar (arriba a la derecha del visor).
5. Poné un nombre y pegá el token en la ventana de publicación. Pulsá **Guardar modelo**.
6. El archivo se sube a `models/` de GitHub, mediante un commit a `main`. El listado público se actualizará automáticamente.
7. El token se borra del campo y **no se escribe en el repositorio, localStorage ni cookies**.

**Seguridad:** no compartas el token con nadie y no lo pegues en chats. Es un mecanismo de prueba orientado a un único editor. Para una aplicación abierta con varios usuarios, es preferible integrar un backend con autenticación y almacenamiento de objetos (por ejemplo, Supabase).

**Tamaño:** en este prototipo la publicación se limita a **50 MiB**. Para una galería grande o muchos archivos pesados, GitHub no es un sustituto apropiado del almacenamiento dedicado.

## Primer modelo Altec

El GLB correcto es `Meshy_AI_Altec_Speaker_Cabinet_1030194443_texture(1).glb`: **ya contiene la malla y texturas integradas**. El archivo `generate(2).glb` no es necesario.

Cuando se guarde desde la propia web con un nombre que incluya "Altec", se publicará en la ruta `models/altec-speaker.glb` (si está libre). Se mostrará automáticamente como vista inicial de los visitantes. La web **no puede abrir el archivo de este chat por sí sola**: primero es necesario subir el archivo al repositorio usando el botón de guardar descrito arriba.

La carpeta `models/` empieza vacía y la app muestra un ícono de cubo minimalista hasta que exista algún GLB, OBJ o STL publicado.

## Publicación

GitHub Pages: **Settings → Pages → Deploy from a branch → main → /(root)**.

No requiere compilación: HTML + CSS + JavaScript (Three.js importado como módulo desde CDN). Cada nuevo commit a `main` dispara un despliegue de Pages.

**Archivos principales:** `index.html`, `src/main.js`, `src/style.css`. El anterior `models.json` solo se usa como respaldo si falla la API de GitHub. Las configuraciones experimentales de Supabase quedaron en el repositorio pero ya **no se usan**.
