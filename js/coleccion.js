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

// SIN ACENTOS Y EN MINÚSCULAS, que es como se compara texto que ha escrito
// gente distinta. NFD separa la letra de su tilde y el rango \u0300-\u036f la
// borra: Björk pasa a bjork, que es lo que teclea quien la busca.
//
// El archivo ya hacía esto a mano en dos sitios (el slug de la URL y la inicial
// del índice). No se han tocado: los dos siguen con su propia copia porque
// además hacen otras cosas, y unificarlos ahora sería reescribir código
// probado dentro de una feature que no va de eso.
const sinAcentos = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function celda(d) {
  const li = document.createElement("li");
  li.className = "disco";

  // EL HENO DE LA BÚSQUEDA, guardado en la celda y no recalculado en cada
  // tecla. Artista Y título, porque quien busca "tribe" no distingue si es de
  // uno o del otro.
  //
  // Aquí y no en `normalizar()` a propósito: lo que sale de normalizar() se
  // guarda en sessionStorage, y una pestaña con caché de ANTES de este cambio
  // devolvería objetos sin el campo. Puesto al pintar, se calcula siempre,
  // venga el disco de la red o de la caché.
  li.dataset.busqueda = sinAcentos(`${d.artista} ${d.titulo}`);

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

// ░░░ EL ÍNDICE ALFABÉTICO — las separatas de la tienda de discos ░░░
//
// Los 224 se reparten en 22 letras con contenido, ninguna de más de 20 discos.
// Ese reparto tan parejo es lo que hace útil el índice: cada letra es un bocado
// cómodo. Si una acumulara 80, saltar a ella no resolvería nada.

// LA INICIAL SE CALCULA SOBRE `clave`, que es la misma cadena por la que se
// ORDENA (el artista sin artículo, en minúsculas). Si el índice usara otra —el
// nombre tal cual, por ejemplo— The Beatles saldría bajo la T y estaría
// colocado entre las B: el encabezado diría una cosa y el orden otra.
//
// Los acentos se quitan con el mismo truco que en los slugs: NFD separa la
// letra de su tilde y el rango \u0300-\u036f borra la tilde. Así Ángel va con
// la A, que es donde lo buscaría cualquiera.
//
// Todo lo que no acabe en A-Z —números, símbolos, alfabetos no latinos— cae en
// "#", exactamente igual que en las separatas de una tienda. La comparación
// `>= "A" && <= "Z"` funciona porque es un solo carácter ya en mayúscula; una
// cadena vacía da `undefined`, y `undefined >= "A"` es false, que es justo lo
// que queremos (a "#").
const INICIALES = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

function inicial(clave) {
  const c = clave
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")[0]
    ?.toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

// AGRUPAR. El Map se crea de antemano con las 27 entradas, así que el resultado
// SIEMPRE las trae todas, vacías incluidas: es lo que permite pintar la Q
// apagada sin volver a preguntar por ella. No se reordena nada — cada grupo
// hereda el orden que ya traía la colección entera.
function agrupar(discos) {
  const grupos = new Map(INICIALES.map((letra) => [letra, []]));
  for (const d of discos) grupos.get(inicial(d.clave)).push(d);
  return grupos;
}

// El ancla de cada letra. "#" no puede ir tal cual en un id: el enlace sería
// href="#letra-#" y el navegador corta el fragmento en la segunda almohadilla.
const anclaId = (letra) => `letra-${letra === "#" ? "num" : letra.toLowerCase()}`;

function barraLetras(grupos) {
  const nav = document.createElement("nav");
  nav.className = "indice-letras";
  // Un <nav> con nombre: es un landmark, y quien navega por landmarks quiere
  // poder saltar a él. El texto viene del JSON de la plantilla, como todos.
  nav.setAttribute("aria-label", cfg.textos.indice);

  nav.append(enlaceTodos());

  for (const [letra, discos] of grupos) {
    // CON DISCOS, UN ENLACE; SIN DISCOS, UN <span>. La diferencia no es
    // estética: un enlace que no lleva a ninguna parte es una trampa para quien
    // navega con teclado (el tabulador para en él para nada) y para un lector
    // de pantalla (lo anuncia como enlace). Y el aria-hidden del vacío tampoco
    // es capricho: "Q, W, X, Y, Z" dicho en voz alta entre 22 saltos es ruido;
    // la letra apagada informa a la VISTA, que es a quien va dirigida.
    const el = document.createElement(discos.length ? "a" : "span");
    if (discos.length) {
      el.href = `#${anclaId(letra)}`;
    } else {
      el.className = "indice-vacia";
      el.setAttribute("aria-hidden", "true");
    }
    el.textContent = letra;
    nav.append(el);
  }

  // EL CLIC LO LLEVAMOS NOSOTROS, y la razón es el ORDEN. Un <a href="#letra-l">
  // hace dos cosas en el navegador, en este orden: salta al ancla y DESPUÉS
  // dispara `hashchange`. O sea que salta con la página todavía entera y solo
  // entonces el filtro la encoge, con lo que el sitio al que había saltado ya no
  // existe y el navegador te deja donde puede: al final del documento nuevo.
  // Medido en 1280px: pasa por scrollY 12.214 (página de 22.272) y acaba en
  // 1.041, que es exactamente el fondo de la página de 1.841 que queda. En un
  // móvil de 390px el salto intermedio es de 47.087.
  //
  // Filtrando ANTES de colocar el scroll, el salto desaparece. Sigue siendo un
  // <a> de verdad: el href, el foco, el teclado, «abrir en otra pestaña» y el
  // historial no se tocan. Lo único que se sustituye es el desplazamiento.
  //
  // Un solo manejador en el <nav> y no uno por letra: son 27, y además el nav se
  // reconstruye entero en cada `pintar`, así que el manejador se va con él y no
  // hay nada que desenganchar.
  nav.addEventListener("click", pulsarLetra);

  return nav;
}

// LA BARRA HORIZONTAL TAPA EL RÓTULO AL QUE SALTAS (de 768px para arriba, donde
// el índice se coloca arriba y pegado), y `scroll-margin-top` es lo que lo
// arregla: le dice al rótulo «cuando el navegador se desplace hasta ti, deja
// este hueco por arriba». El hueco es el alto de la barra, que NO es un número
// fijo —27 letras se reparten en más o menos filas según el ancho—, así que se
// mide aquí y se publica como variable CSS para que el CSS pueda usarlo.
//
// Con un ResizeObserver y no midiendo una sola vez: al girar el aparato o
// redimensionar la ventana la barra cambia de filas, y el hueco tiene que
// seguirla. `offsetHeight` y no `contentRect`, que se deja fuera el relleno.
const medirBarra = new ResizeObserver(([entrada]) => {
  app.style.setProperty("--indice-h", `${entrada.target.offsetHeight}px`);
});

// ░░░ LAS PESTAÑAS: el índice no salta, FILTRA ░░░
//
// Se ve una letra cada vez, y el enlace "todos" devuelve la colección entera.
// Decidido el 9-ago-2026 con el prototipo delante, y el número que lo decidió
// está medido: en un móvil de 390px la página pasa de 87.158px de alto a 7.587
// con una letra abierta. Once veces más corta.
//
// LO QUE CUESTA, y hay que saberlo: con una letra abierta, el BUSCADOR DEL
// NAVEGADOR (Ctrl+F) solo encuentra esa letra. `hidden` retira la sección del
// árbol de accesibilidad y también de la búsqueda. Ese agujero LO TAPA EL
// BUSCADOR de aquí abajo, que por eso busca SIEMPRE en los 224 aunque haya una
// letra abierta: si respetara la pestaña, dejaría el agujero igual de abierto.
//
// Todo lo que hacía falta ya estaba: los discos vienen agrupados en un Map y cada letra
// es una <section>, así que esto solo pone y quita el atributo `hidden`.
//
// EL ESTADO VIVE EN EL HASH DE LA URL, y no en una variable. Eso da tres cosas
// gratis: compartir un enlace a una letra, que "atrás" deshaga el cambio de
// pestaña, y que las anclas #letra-l que ya existen sigan valiendo — la misma
// URL que hoy salta, aquí abre. Por eso son <a> de verdad y no botones: el
// teclado, el "abrir en otra pestaña" y el historial los da el navegador.
//
// `hidden` y no una clase con display:none: retira la sección del árbol de
// accesibilidad Y del buscador del navegador, que es exactamente lo que hay que
// entender antes de decidir esto — con las pestañas puestas, Ctrl+F deja de
// encontrar los 224 discos y solo ve la letra abierta.
const TODOS = "todos";
let TOTAL = 0;

// LO QUE HAY ESCRITO EN EL BUSCADOR, ya sin acentos y en minúsculas. Esta SÍ es
// una variable y no vive en la URL, al revés que la letra, y la diferencia es
// de naturaleza: una letra es un SITIO de la colección —se enlaza, se comparte,
// el botón atrás vuelve a él—, mientras que una búsqueda es una ACCIÓN EN CURSO.
// Además, meterla en la URL obligaría a decidir qué hacer con el historial en
// cada tecla: o se llena de entradas basura o hay que ir con replaceState.
let CONSULTA = "";
// Y lo tecleado TAL CUAL, con sus acentos y sus mayúsculas. Hacen falta las dos:
// con la de arriba se compara, y con esta se repone el campo cuando `pintar`
// vuelve a correr con los datos frescos y se lleva por delante el <input>
// anterior. Devolverle la versión sin acentos sería corregirle lo que escribió.
let TECLEADO = "";

function letraDelHash() {
  const h = location.hash.slice(1);
  return h.startsWith("letra-") || h === TODOS ? h : TODOS;
}

// EL ÚNICO SITIO QUE DECIDE QUÉ SE VE, y por eso los dos filtros están juntos en
// una función y no en dos: si cada uno pusiera y quitara `hidden` por su cuenta,
// el último en correr borraría el trabajo del otro.
//
// MANDA LA BÚSQUEDA. Con algo escrito se busca en los 224 y la pestaña se
// ignora: ese es el trabajo del buscador —tapar el agujero de Ctrl+F— y
// respetar la letra abierta lo dejaría sin tapar. Borrar el campo devuelve el
// mando a la pestaña, que sigue donde estaba porque vive en la URL.
function aplicarFiltros() {
  const activa = letraDelHash();
  const buscando = CONSULTA !== "";
  let visibles = 0;

  for (const seccion of document.querySelectorAll(".coleccion-tramos section")) {
    let enEstaLetra = 0;
    for (const disco of seccion.querySelectorAll(".disco")) {
      // Sin búsqueda TODOS los discos vuelven a verse. Es lo que deshace el
      // filtro anterior: si solo se ocultaran los que no casan, los ocultos de
      // la búsqueda de antes se quedarían ocultos para siempre.
      const casa = !buscando || disco.dataset.busqueda.includes(CONSULTA);
      disco.hidden = !casa;
      if (casa) enEstaLetra++;
    }
    // Buscando, una letra sin resultados sobra: dejarla dejaría un rótulo "K"
    // con nada debajo. Sin buscar, mandan las pestañas.
    seccion.hidden = buscando
      ? enEstaLetra === 0
      : activa !== TODOS && seccion.querySelector("h2").id !== activa;
    if (!seccion.hidden) visibles += enEstaLetra;
  }

  for (const enlace of document.querySelectorAll(".indice-letras a")) {
    // `aria-current` y no una clase: dice CUÁL de los enlaces es el sitio donde
    // estás, y el lector de pantalla lo anuncia. La clase solo pintaría.
    // Buscando no lo lleva NINGUNO: no estás en ninguna letra, y marcar una
    // sería mentir sobre dónde estás.
    const suyo = !buscando && enlace.getAttribute("href").slice(1) === activa;
    if (suyo) enlace.setAttribute("aria-current", "true");
    else enlace.removeAttribute("aria-current");
  }

  const p = document.querySelector(".coleccion-estado");
  if (p) {
    // El singular no es un detalle de estilo: hasta ahora ninguna letra tenía un
    // solo disco y "1 discos" no llegaba a verse nunca, pero buscando aparece a
    // poco que afines la palabra. Se pide el singular al JSON de la plantilla
    // como todo lo demás, que es lo que mantiene el módulo idéntico en los dos
    // idiomas (y un plural en inglés no siempre es añadir una ese).
    const nombre = visibles === 1 ? cfg.textos.disco : cfg.textos.discos;
    p.textContent = !buscando && activa === TODOS
      ? `${visibles} ${nombre}.`
      : `${visibles} ${nombre} ${cfg.textos.de} ${TOTAL}.`;
  }

  // El aviso de "nada encontrado" solo con búsqueda: sin ella, cero discos
  // significa que la colección está vacía o que falló la carga, y para eso ya
  // hay otros mensajes.
  const vacio = document.querySelector(".coleccion-sin-resultados");
  if (vacio) vacio.hidden = !(buscando && visibles === 0);
}

function pulsarLetra(evento) {
  const enlace = evento.target.closest(".indice-letras a[href^='#']");
  if (!enlace) return;

  // Ctrl/Cmd/Shift/Alt y el botón central abren en otra pestaña o ventana. Ahí
  // no hay que estorbar: quien hace eso no está filtrando ESTA página, y
  // robarle el gesto es de las cosas que más molestan de un sitio.
  const otroSitio = evento.button !== 0 || evento.metaKey || evento.ctrlKey
    || evento.shiftKey || evento.altKey;
  if (otroSitio) return;

  evento.preventDefault();

  // Pulsar la letra que ya está abierta no hace nada, y sobre todo no deja una
  // entrada repetida en el historial: si no, «atrás» tendría que pulsarse tantas
  // veces como clics diste y parecería roto.
  const destino = enlace.getAttribute("href");
  if (destino === location.hash) return;

  // pushState y NO `location.hash = …`: escribir el hash provoca otra vez el
  // salto nativo, que es justo lo que estamos quitando. pushState cambia la URL
  // sin desplazar y deja su entrada, así que «atrás» sigue deshaciendo.
  history.pushState(null, "", destino);
  // ELEGIR UNA LETRA BORRA LA BÚSQUEDA. Son dos maneras de recorrer la misma
  // colección y has cambiado de una a la otra; dejar el texto escrito daría una
  // letra que no enseña lo que dice su rótulo, porque la búsqueda manda.
  vaciarBuscador();
  // pushState no dispara `hashchange`, así que el filtro se llama a mano. El
  // oyente de hashchange sigue haciendo falta para «atrás» y para quien escriba
  // el fragmento en la barra de direcciones.
  aplicarFiltros();
  colocarScroll();
}

// ░░░ EL BUSCADOR ░░░
//
// Cierra la segunda mitad del punto 6 y tapa el agujero que abrieron las
// pestañas: con una letra abierta, Ctrl+F solo encuentra esa letra. Este busca
// siempre en los 224.
//
// FILTRA SEGÚN SE ESCRIBE, sin botón. No hay nada que enviar a ningún sitio: los
// 224 discos ya están en la página, así que el resultado puede aparecer mientras
// tecleas. Por eso tampoco es un <form>: no hay envío, y un <form> aquí solo
// serviría para que Enter recargara la página.
//
// <search> es el elemento de HTML para esto —el landmark de búsqueda, lo que
// antes se escribía role="search"—, y un lector de pantalla puede saltar a él
// como salta a un <nav>.
const ID_BUSCADOR = "buscar-coleccion";

function buscador() {
  const caja = document.createElement("search");
  caja.className = "coleccion-buscador";

  // UN <label> DE VERDAD, oculto a la vista pero presente. El placeholder NO es
  // una etiqueta: desaparece en cuanto escribes —justo cuando querrías
  // comprobar qué te estaban pidiendo— y no todos los lectores de pantalla lo
  // anuncian. La etiqueta dice QUÉ es el campo; el placeholder, un ejemplo de
  // qué escribir. Son dos cosas distintas y aquí están las dos.
  const etiqueta = document.createElement("label");
  etiqueta.className = "visually-hidden";
  etiqueta.htmlFor = ID_BUSCADOR;
  etiqueta.textContent = cfg.textos.buscar;

  const campo = document.createElement("input");
  campo.type = "search";        // trae la ✕ de borrar del navegador y, en el
                                // móvil, un teclado con tecla de buscar
  campo.id = ID_BUSCADOR;
  campo.placeholder = cfg.textos.buscarEjemplo;
  // Nombres propios de gente de medio mundo: el corrector y el autocompletado
  // solo estorban, y la mayúscula automática del móvil no pinta nada en un
  // campo que compara en minúsculas.
  campo.autocomplete = "off";
  campo.spellcheck = false;
  campo.setAttribute("autocapitalize", "none");

  campo.addEventListener("input", () => {
    TECLEADO = campo.value;
    CONSULTA = sinAcentos(campo.value.trim());
    aplicarFiltros();
  });

  caja.append(etiqueta, campo);
  return caja;
}

// LA LUPA DE LA BARRA INFERIOR la pinta base.njk, no este archivo: vive fuera
// de #coleccion y sobrevive a los repintados. Aquí solo se le añade lo que el
// ancla no puede dar por sí sola — EL FOCO —, porque saltar hasta un campo y
// dejarte que lo toques otra vez para escribir es media función.
//
// preventDefault y focus() en vez de dejar que salte: `focus()` ya desplaza lo
// justo para que el campo se vea, y así no queda una entrada nueva en el
// historial cada vez que pulsas la lupa (el ancla la dejaría, y «atrás»
// pasaría a deshacer «he pulsado la lupa», que no es un sitio donde estuviste).
//
// Se engancha UNA vez al cargar el módulo y no en cada `pintar`: el enlace no
// se repinta, así que enganchar allí acumularía manejadores.
document.querySelector(".mobile-buscar")?.addEventListener("click", (evento) => {
  const campo = document.getElementById(ID_BUSCADOR);
  if (!campo) return;   // aún cargando: que el ancla haga su trabajo
  evento.preventDefault();
  campo.focus();
});

function vaciarBuscador() {
  const campo = document.getElementById(ID_BUSCADOR);
  if (campo) campo.value = "";
  CONSULTA = "";
  TECLEADO = "";
}

// EL SCROLL SE COLOCA DESPUÉS DE FILTRAR, con la página ya en su alto nuevo, y
// SOLO SI HACE FALTA:
//
//   · Si estás por encima del principio de la colección —el caso normal, con el
//     índice a la vista— no se mueve nada. Cambia la lista de debajo y ya.
//   · Si estabas metido dentro de la lista, te lleva al principio de la letra.
//     Sin esto la página encogería bajo tus pies y el navegador te dejaría en
//     un sitio arbitrario (el fondo, casi siempre).
//
// scrollIntoView() y no un scrollTo con números: respeta el `scroll-margin-top`
// del rótulo, que es donde ya vive el hueco de la barra pegada (--indice-h).
// Repetir aquí ese cálculo sería tener el mismo número en dos sitios.
function colocarScroll() {
  const activa = letraDelHash();
  const destino = document.getElementById(activa)
    ?? document.querySelector(".coleccion-tramos");
  if (!destino) return;

  const principio = destino.getBoundingClientRect().top + window.scrollY;
  if (window.scrollY > principio) destino.scrollIntoView();
}

// El enlace "todos": sin él no habría forma de volver a ver la colección entera. Va con un glifo y no con la palabra porque
// en móvil comparte un carril de 32px con las letras; el nombre de verdad lo da
// el texto oculto, que es lo que oye un lector de pantalla y lo que dice quien
// maneja el sitio por voz.
function enlaceTodos() {
  const a = document.createElement("a");
  a.href = `#${TODOS}`;

  const glifo = document.createElement("span");
  glifo.textContent = "≡";
  glifo.setAttribute("aria-hidden", "true");

  const nombre = document.createElement("span");
  nombre.className = "visually-hidden";
  nombre.textContent = cfg.textos.todos;

  a.append(glifo, nombre);
  return a;
}

function seccionLetra(letra, discos) {
  const seccion = document.createElement("section");

  // El <h2> es el ancla Y el encabezado visible: un solo elemento hace los dos
  // trabajos. Además da estructura de verdad al documento —un lector de
  // pantalla puede recorrer la colección saltando de titular en titular—, que
  // es algo que la rejilla plana de antes no ofrecía.
  const h2 = document.createElement("h2");
  h2.className = "letra-titulo";
  h2.id = anclaId(letra);
  h2.textContent = letra;

  const ul = document.createElement("ul");
  ul.className = "discos";
  const frag = document.createDocumentFragment();
  for (const d of discos) frag.append(celda(d));
  ul.append(frag);

  seccion.append(h2, ul);
  return seccion;
}

// ─────────────────────────────────────────────────────────────────
// 3. TRAER Y MOSTRAR.

// LA COLECCIÓN ENLATADA, para no gastar el cupo de Discogs mientras se trabaja.
// Cada carga de esta página son 3 de las 25 peticiones por minuto que permite
// la API, así que unas pocas recargas seguidas la dejan sin cupo y la página
// aparece vacía —que es exactamente lo que parece un fallo del código y no lo
// es—. Con ?mock en la URL los datos salen de mocks/, que son esas mismas tres
// respuestas guardadas tal cual.
//
// Se exige `cfg.mockBase` ADEMÁS del parámetro: en producción la plantilla lo
// deja en null y la carpeta ni se publica, así que escribir ?mock allí no hace
// nada. Un interruptor de desarrollo tiene que ser inofensivo fuera de él.
const MOCK =
  Boolean(cfg.mockBase) && new URLSearchParams(location.search).has("mock");

async function pedirPagina(p) {
  if (MOCK) {
    const r = await fetch(`${cfg.mockBase}coleccion-${p}.json`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }
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
  const grupos = agrupar(discos);

  // Un DocumentFragment: las 224 celdas se montan fuera del documento y entran
  // de una vez. Añadiéndolas una a una el navegador recalcularía la rejilla 224
  // veces. Ahora envuelve el índice entero —barra y secciones— por lo mismo.
  const frag = document.createDocumentFragment();
  const barra = barraLetras(grupos);

  // LA CABECERA: el contador a la izquierda, el buscador a la derecha. Van
  // juntos porque se responden — al filtrar, el contador es quien dice cuánto
  // ha encontrado («13 discos de 224»), así que el resultado se lee al lado del
  // campo donde acabas de escribir y no en otra parte de la página.
  const cabecera = document.createElement("div");
  cabecera.className = "coleccion-cabecera";
  // Mismo texto que escribía la plantilla antes: «224 discos.»
  const contador = mensaje(`${discos.length} ${cfg.textos.discos}.`);
  // UNA REGIÓN VIVA, y es lo que hace usable un filtro que no se envía: al
  // teclear, el cambio ocurre lejos del foco y en silencio. `polite` espera a
  // que el lector de pantalla termine la palabra en curso en vez de cortarla,
  // que es lo correcto para un contador que cambia en cada tecla.
  contador.setAttribute("aria-live", "polite");
  cabecera.append(contador, buscador());
  frag.append(cabecera);

  // El aviso de "ningún disco coincide". Se crea siempre y se enseña o se
  // esconde con `hidden`; creado y destruido al vuelo no habría dónde anunciar
  // nada, porque una región viva tiene que estar en la página ANTES de cambiar
  // para que el lector de pantalla la vigile.
  const vacio = document.createElement("p");
  vacio.className = "coleccion-sin-resultados";
  vacio.textContent = cfg.textos.sinResultados;
  vacio.hidden = true;
  frag.append(vacio);

  // Se vuelve a observar en cada pintado: al repintar, la barra de antes ya no
  // está en el documento y un ResizeObserver colgado de un elemento muerto no
  // vuelve a disparar. `disconnect` primero para no acumular observaciones.
  medirBarra.disconnect();
  medirBarra.observe(barra);

  // UNA REJILLA POR LETRA, y no una sola con encabezados intercalados: cada
  // sección se reparte sus columnas y la ÚLTIMA FILA DE CADA LETRA queda
  // irregular. Eso no es un fallo pendiente de arreglar, es exactamente cómo se
  // ven las separatas de una tienda de discos.
  //
  // DOS ENVOLTORIOS, y cada uno se gana el suyo:
  //
  //   .coleccion-cuerpo — la caja que en vertical se convierte en una FILA con
  //     el carril a un lado y los discos al otro. Tiene que contener exactamente
  //     esas dos cosas y nada más: cuando el mensaje «224 discos.» estaba
  //     dentro, el carril se le colocaba AL LADO en la misma línea (el margen
  //     negativo le dejaba hueco justo) en vez de bajar a la siguiente.
  //
  //   .coleccion-tramos — las 22 secciones juntas, para que sean UNA caja
  //     frente al carril. Sueltas habría que colocar cada una en su columna.
  const cuerpo = document.createElement("div");
  cuerpo.className = "coleccion-cuerpo";

  const tramos = document.createElement("div");
  tramos.className = "coleccion-tramos";
  for (const [letra, delGrupo] of grupos) {
    if (delGrupo.length) tramos.append(seccionLetra(letra, delGrupo));
  }

  cuerpo.append(barra, tramos);
  frag.append(cuerpo);

  app.replaceChildren(frag);

  // Va DESPUÉS del replaceChildren y no antes: aplicarFiltros busca las
  // secciones EN EL DOCUMENTO, y hasta esta línea solo existían dentro del
  // fragmento. El hashchange es quien reacciona a pulsar una letra: eso solo
  // cambia la URL y el navegador no recarga nada. Se desengancha antes de
  // enganchar porque `pintar` corre dos veces (caché y datos frescos) y si no
  // se acumularían manejadores.
  TOTAL = discos.length;
  // `pintar` corre DOS veces (lo guardado primero, los datos frescos después) y
  // la segunda tira el campo con lo que hubiera escrito. Si alguien estaba
  // tecleando, se le devuelve lo suyo al campo nuevo y se vuelve a filtrar; sin
  // esto, la respuesta de la red le borraría la búsqueda a media palabra.
  const campo = document.getElementById(ID_BUSCADOR);
  if (campo && CONSULTA) campo.value = TECLEADO;
  aplicarFiltros();
  window.removeEventListener("hashchange", aplicarFiltros);
  window.addEventListener("hashchange", aplicarFiltros);
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

// Clave distinta con ?mock: si no, lo enlatado y lo real se pisarían en la
// misma caché y una carga normal empezaría pintando datos del mock.
const CLAVE_CACHE = MOCK ? "coleccion-mock" : "coleccion";

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
