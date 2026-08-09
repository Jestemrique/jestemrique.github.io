// ══════════════════════════════════════════════════════════════════════════
// LA COLECCIÓN, TRAÍDA EN EL NAVEGADOR.
//
// Es el mismo trabajo que hace src/_data/discogs.js, pero movido del BUILD al
// RUNTIME. Dos momentos distintos de ejecución, mismo lenguaje:
//
//   · discogs.js   → corre una vez, en el runner de GitHub, al desplegar.
//   · este archivo → corre en cada visita, en el navegador de quien entra.
//
// Consecuencia buscada: al no participar el build, un disco añadido a Discogs
// aparece en la siguiente visita SIN desplegar nada.
//
// Consecuencia aceptada: sin JavaScript esta página está vacía, y si Discogs
// no responde no hay nada guardado que enseñar en su lugar.
//
// LOS TEXTOS NO ESTÁN AQUÍ. Vienen del <script type="application/json"> que
// escribe la plantilla, porque las traducciones ya viven en el sitio (en
// _data/soportes.js y en el propio .njk) y duplicarlas en el JS sería tener
// dos verdades. Este archivo es idéntico para /es/ y para /en/.
// ══════════════════════════════════════════════════════════════════════════

const app = document.getElementById("coleccion");
const cfg = JSON.parse(document.getElementById("coleccion-datos").textContent);

const API =
  `https://api.discogs.com/users/${cfg.usuario}/collection/folders/0/releases`;

// ─────────────────────────────────────────────────────────────────
// 1. LIMPIEZA — copiada de src/_data/discogs.js sin cambiar una coma.
//    Todo lo que hay aquí está MEDIDO contra los 224 discos reales.

const TIPOS = new Set([
  "LP", '12"', '10"', '7"', "Maxi-Single", "Single", "EP", "Mini-Album",
]);

const ARTICULOS = /^(the|la|el|los|las|le|les)\s+/i;

const limpiarArtista = (nombre) => nombre.replace(/\s*\(\d+\)$/, "");
const unirArtistas = (as) => as.map((a) => limpiarArtista(a.name)).join(" / ");
const claveOrden = (nombre) => nombre.replace(ARTICULOS, "").toLowerCase();

function elegirFormato(formatos) {
  const principal = formatos.find((f) => f.name === "Vinyl") ?? formatos[0] ?? {};
  const cantidad = Number.parseInt(principal.qty, 10) || 1;
  const tipo = formatos
    .flatMap((f) => f.descriptions ?? [])
    .find((d) => TIPOS.has(d));
  return { soporte: principal.name ?? null, cantidad, tipo: tipo ?? null };
}

function normalizar(release) {
  const b = release.basic_information;
  const artista = unirArtistas(b.artists);
  return {
    id: b.id,
    artista,
    clave: claveOrden(artista),
    titulo: b.title.trim(),
    anio: b.year || null,
    // `thumb` (150 px) y no `cover_image` (95 KB de media): enlazadas al CDN,
    // las grandes serían ~21 MB por visitante. Medido, no supuesto.
    thumb: b.thumb || null,
    ...elegirFormato(b.formats ?? []),
  };
}

// ─────────────────────────────────────────────────────────────────
// 2. PINTADO.
//
// Con createElement y textContent, NUNCA con innerHTML. Los títulos y los
// nombres de artista los escriben otros usuarios de Discogs: son datos ajenos
// que acaban en tu página. Con innerHTML, un título con "<img onerror=...>"
// se ejecutaría en el navegador de tu visitante.

// LA URL DE LA FICHA: slug legible + el id al final.
//
//   /es/musica/disco/10000-maniacs-in-my-tribe-5877748/
//
// Esa ruta NO EXISTE como archivo. GitHub Pages responde con 404.html, y ese
// archivo la reconoce y la reenvía a la página que sabe pintarla (ver
// src/404.njk, que explica por qué hace falta el rodeo).
//
// El slug es para quien LEE la URL (al compartirla, al verla en el historial);
// el id del final es para el CÓDIGO, que se lo lleva de ahí y pide esa ficha
// con una sola llamada.
//
// POR QUÉ NO UN SLUG A SECAS. Sin el id habría que resolver «qué disco es este
// texto», y eso obliga a traerse las tres páginas de la colección ANTES de
// poder pedir la ficha: 4 peticiones en vez de 1. Además dos ediciones del
// mismo disco darían el mismo slug, y un título corregido en Discogs rompería
// los enlaces que ya hubieras compartido. Con el id delante de nada de eso.
//
// POR QUÉ NO UNA RUTA de verdad (…/disco/in-my-tribe/). Haría falta una página
// por disco, y generarlas es justo lo que quitamos del build. GitHub Pages no
// reescribe rutas, así que el parámetro es lo que hay.
const trozoUrl = (s) =>
  s.normalize("NFD")               // separa la letra de su acento…
    .replace(/[\u0300-\u036f]/g, "") // …y tira el acento: café → cafe
    .toLowerCase()
    // Los apóstrofos y las comas se BORRAN, no se convierten en guion: van
    // DENTRO de la palabra y partirla la hace ilegible. "Blind Man's Zoo" da
    // blind-mans-zoo y no blind-man-s-zoo; "10,000" da 10000 y no 10-000.
    .replace(/['’´,]/g, "")
    .replace(/[^a-z0-9]+/g, "-")   // el resto de la puntuación sí separa
    .replace(/^-+|-+$/g, "");      // sin guiones sueltos en los extremos

// EL SLUG SE RECORTA. Sin límite salen monstruos de 130 caracteres (la banda
// sonora de Sonrisas y lágrimas, con sus cinco artistas acreditados). El slug
// es una PISTA legible de qué disco es, no el título completo: quien identifica
// es el id que va detrás, y por eso recortar no rompe ningún enlace.
//
// Se corta por el último guion que quepa, para no partir una palabra por la
// mitad. Si no hubiera ningún guion antes del límite (una sola palabra larguísima)
// se deja entera: mejor una URL larga que una palabra mutilada.
const LARGO_MAX = 60;

function recortar(slug) {
  if (slug.length <= LARGO_MAX) return slug;
  const corte = slug.lastIndexOf("-", LARGO_MAX);
  return corte > 0 ? slug.slice(0, corte) : slug;
}

const urlFicha = (d) =>
  `${cfg.fichaUrl}${recortar(trozoUrl(`${d.artista} ${d.titulo}`))}-${d.id}/`;

function celda(d) {
  const li = document.createElement("li");
  li.className = "disco";

  // TODA la celda es el enlace, no solo el título: en una rejilla el objetivo
  // que el dedo busca es la portada. El <a> va DENTRO del <li> y envuelve el
  // contenido, que es lo que permite que la lista siga siendo una lista.
  const a = document.createElement("a");
  a.href = urlFicha(d);
  li.append(a);

  if (d.thumb) {
    const img = document.createElement("img");
    img.src = d.thumb;
    img.alt = `${d.artista} — ${d.titulo}`;
    img.width = 150;
    img.height = 150;
    // Igual que en la versión del build: solo bajan las que se acercan a la
    // pantalla. Con 224 celdas es la diferencia entre 0,7 MB y unos pocos KB
    // para quien no baja del primer scroll.
    img.loading = "lazy";
    img.decoding = "async";
    a.append(img);
  }

  const datos = [
    cfg.soportes[d.soporte]?.[cfg.lang] ?? d.soporte,
    d.tipo && `${d.cantidad > 1 ? d.cantidad + "×" : ""}${d.tipo}`,
    d.anio,
  ].filter(Boolean).join(" · ");

  for (const [clase, texto] of [
    ["disco-artista", d.artista],
    ["disco-titulo", d.titulo],
    ["disco-datos", datos],
  ]) {
    const span = document.createElement("span");
    span.className = clase;
    span.textContent = texto;
    a.append(span);
  }

  return li;
}

// ─────────────────────────────────────────────────────────────────
// 3. TRAER Y MOSTRAR.

async function pedirPagina(p) {
  // Sin token: la colección es pública. Y sin cabecera User-Agent, porque el
  // navegador manda la suya y JavaScript tiene PROHIBIDO tocar esa cabecera.
  //
  // `cache: "no-store"` NO es adorno. Discogs no manda Cache-Control, ni
  // Expires, ni ETag (comprobado), y ante una respuesta sin instrucciones el
  // navegador aplica una CACHÉ HEURÍSTICA: decide él cuánto vale. Eso pondría
  // en manos del navegador justo lo único que esta página promete —enseñar la
  // colección al día—, y un disco recién comprado podría no aparecer.
  // Con no-store la respuesta ni se guarda ni se reutiliza: siempre fresca.
  const r = await fetch(`${API}?per_page=100&page=${p}&sort=artist`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function mensaje(texto, conEnlace = false) {
  const p = document.createElement("p");
  p.className = "coleccion-estado";
  p.textContent = texto;
  if (conEnlace) {
    const a = document.createElement("a");
    a.href = `https://www.discogs.com/user/${cfg.usuario}/collection`;
    a.textContent = cfg.textos.enlaceDiscogs;
    p.append(" ", a);
  }
  return p;
}

async function traerColeccion() {
  const primera = await pedirPagina(1);
  // La página 1 dice cuántas hay; el resto se piden EN PARALELO. En serie
  // serían tres viajes encadenados y se notaría.
  const resto = await Promise.all(
    Array.from({ length: primera.pagination.pages - 1 }, (_, i) =>
      pedirPagina(i + 2))
  );

  const discos = [primera, ...resto].flatMap((p) => p.releases).map(normalizar);

  // Orden de tienda de discos: por artista sin artículo, y dentro de un
  // artista del más antiguo al más nuevo. localeCompare y no `<` porque el
  // orden por defecto manda los acentos detrás de la Z.
  return discos.sort(
    (a, b) =>
      a.clave.localeCompare(b.clave, cfg.lang) ||
      (a.anio ?? 0) - (b.anio ?? 0) ||
      a.titulo.localeCompare(b.titulo, cfg.lang)
  );
}

function pintar(discos) {
  const ul = document.createElement("ul");
  ul.className = "discos";
  // Un DocumentFragment: los 224 <li> se montan fuera del documento y se
  // insertan de una vez. Añadiéndolos uno a uno el navegador recalcularía
  // la rejilla 224 veces.
  const frag = document.createDocumentFragment();
  for (const d of discos) frag.append(celda(d));
  ul.append(frag);

  // Mismo texto que escribía la plantilla antes: «224 discos.»
  app.replaceChildren(mensaje(`${discos.length} ${cfg.textos.discos}.`), ul);
}

// ─────────────────────────────────────────────────────────────────
// 4. LA CACHÉ DE LA PESTAÑA — para que el botón «atrás» sea instantáneo.
//
// Al volver de una ficha, el navegador vuelve a ejecutar este archivo y se
// pedían otra vez los 224. Con sessionStorage la vuelta es instantánea.
//
// sessionStorage y NO localStorage: se borra al cerrar la pestaña. Guardar la
// colección "para siempre" en el disco de un visitante sería quedarse con algo
// que no nos han pedido guardar, y además chocaría con lo único que esta
// página promete, que es enseñarla al día.
//
// Y NO sustituye a la petición: se pinta lo guardado para que haya algo YA, y
// mientras tanto se piden los datos frescos. Si han cambiado, se repinta. Es
// el patrón "enseña lo viejo mientras revalidas".

const CLAVE_CACHE = "coleccion";

function leerCache() {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE_CACHE));
    return Array.isArray(guardado) && guardado.length ? guardado : null;
  } catch {
    return null; // JSON corrupto de una versión anterior: da igual, se repide
  }
}

function guardarCache(discos) {
  // En modo privado de algunos navegadores sessionStorage existe pero lanza al
  // escribir. Que no se pueda guardar no es motivo para romper la página.
  try {
    sessionStorage.setItem(CLAVE_CACHE, JSON.stringify(discos));
  } catch {}
}

const mismos = (a, b) =>
  a.length === b.length && a.every((d, i) => d.id === b[i].id);

async function arrancar() {
  const cache = leerCache();
  if (cache) pintar(cache);
  else app.replaceChildren(mensaje(cfg.textos.cargando));

  let discos;
  try {
    discos = await traerColeccion();
  } catch (e) {
    // Si hay algo en pantalla desde la caché, se deja: es viejo de minutos y
    // vale mucho más que un mensaje de error. Solo se avisa si no hay nada.
    if (!cache) {
      app.replaceChildren(mensaje(`${cfg.textos.error} (${e.message}).`, true));
    }
    return;
  }

  guardarCache(discos);

  // Repintar solo si la colección ha cambiado. Sin esta comprobación, cada
  // vuelta atrás reconstruiría 224 celdas para dejarlas exactamente igual, y
  // se perdería el sitio donde estabas mirando.
  if (!cache || !mismos(cache, discos)) pintar(discos);
}

arrancar();
