// ══════════════════════════════════════════════════════════════════════════
// LA FICHA DE UN DISCO.
//
// Una sola página en el sitio (/es/musica/disco/) que sirve para los 224: el
// disco se elige con ?id= en la URL. En un sitio estático no hay servidor que
// enrute, así que el parámetro es lo que hace de ruta.
//
// POR QUÉ NO 224 PÁGINAS GENERADAS EN EL BUILD. Cada ficha es una llamada a
// /releases/{id}, y sin token Discogs limita a 25 por minuto: 224 llamadas
// serían ~9 minutos de build. Pidiéndola al abrir es UNA llamada, y solo del
// disco que alguien mira de verdad. Además el tracklist lo edita la comunidad
// de Discogs y cambia: en vivo está más al día que congelado en un build.
// ══════════════════════════════════════════════════════════════════════════

const app = document.getElementById("ficha");
const cfg = JSON.parse(document.getElementById("ficha-datos").textContent);
const t = cfg.textos;

// DE DÓNDE SALE EL DISCO. Puede llegar de tres formas, y las tres valen:
//
//   1. La ruta bonita  /es/musica/disco/10000-maniacs-in-my-tribe-5877748/
//      Es la que se comparte. No existe como archivo: la sirve 404.html, que
//      la reenvía aquí en forma 2 (ver src/404.njk).
//   2. El parámetro    /es/musica/disco/?d=10000-maniacs-in-my-tribe-5877748
//   3. El id a secas   /es/musica/disco/?id=5877748
//
// La 3 era la forma original y puede estar en algún enlace ya compartido.
// Romper URLs que ya existen es de mala educación y aceptarla cuesta una línea.
//
// El id son los dígitos del FINAL, detrás del último guion. El último y no el
// primero porque un título puede acabar en número ("Autobahn 2").
const params = new URLSearchParams(location.search);

const trasLaBase = location.pathname.startsWith(cfg.fichaUrl)
  ? location.pathname.slice(cfg.fichaUrl.length).replace(/\/+$/, "")
  : "";

const slug = trasLaBase || params.get("d") || "";
const id = slug.match(/-(\d+)$/)?.[1] ?? params.get("id");

// DEVOLVER LA URL BONITA A LA BARRA DE DIRECCIONES.
//
// Quien llega por la ruta bonita ha pasado por 404.html, que lo mandó aquí con
// ?d=… — y esa fea es la que se quedaría a la vista, que es justo lo que
// queríamos evitar. replaceState la reescribe SIN recargar y SIN añadir una
// entrada al historial, así que "atrás" sigue llevando a la colección.
//
// Que la URL resultante no exista como archivo da igual: replaceState no pide
// nada al servidor. Y si alguien la copia y la abre, vuelve a entrar por
// 404.html, que es de donde venía.
// La comprobación de cfg.fichaUrl no sobra: si la plantilla se olvida de
// pasarlo, sin ella se escribiría la cadena "undefined" en la barra de
// direcciones y la URL quedaría rota EN SILENCIO, que es la peor clase de
// fallo. Pasó una vez. Sin el dato, se deja la URL como venga.
if (slug && typeof cfg.fichaUrl === "string" && cfg.fichaUrl.startsWith("/")) {
  const bonita = `${cfg.fichaUrl}${slug}/`;
  if (location.pathname + location.search !== bonita) {
    history.replaceState(null, "", bonita);
  }
}

// Igual que en coleccion.js: los datos los escriben otros usuarios de Discogs,
// así que todo entra por textContent y nunca por innerHTML.
const el = (tag, texto, clase) => {
  const n = document.createElement(tag);
  if (texto != null) n.textContent = texto;
  if (clase) n.className = clase;
  return n;
};

function error(texto) {
  const p = el("p", texto + " ");
  const a = el("a", t.enlaceDiscogs);
  a.href = id
    ? `https://www.discogs.com/release/${id}`
    : `https://www.discogs.com/user/${cfg.usuario}/collection`;
  p.append(a);
  app.replaceChildren(p);
}

// El nombre de artista viene con el "(6)" que desambigua homónimos DENTRO de
// Discogs; en una web parece una errata. Misma limpieza que en coleccion.js.
const limpiar = (n) => n.replace(/\s*\(\d+\)$/, "");

function pintar(d) {
  const artista = d.artists.map((a) => limpiar(a.name)).join(" / ");

  // El <title> y el <h1> también, que es lo que se ve en la pestaña y en el
  // historial. Sin esto las 224 fichas se llamarían todas igual.
  document.title = `${artista} — ${d.title} · ${cfg.sitio}`;

  const frag = document.createDocumentFragment();

  // LA CABECERA VA EN SU PROPIA CAJA: portada + título + artista + datos.
  //
  // No es un envoltorio decorativo, es lo que permite la forma de dos
  // columnas sin colocar cada hijo a mano en la rejilla. La alternativa era
  // poner la rejilla en #ficha y darle a cada elemento su `grid-row`, y eso
  // se rompe con lo que aquí varía: la lista de datos puede traer dos filas
  // o una (hay discos sin año), así que las filas que ocupa la columna
  // derecha no se saben de antemano.
  //
  // Y deja el tracklist FUERA de la caja, que es justo lo que se quiere: al
  // no ser hijo de la rejilla cruza abajo a todo el ancho sin decírselo.
  const cabecera = el("div", null, "ficha-cabecera");

  // ── Portada. images[] trae las grandes (600×600); si el disco no tiene
  //    (los hay), se cae al thumb, y si tampoco, no se pinta nada.
  const portada = d.images?.find((i) => i.type === "primary") ?? d.images?.[0];
  if (portada?.uri || d.thumb) {
    const img = el("img");
    img.src = portada?.uri ?? d.thumb;
    img.alt = `${artista} — ${d.title}`;
    if (portada) { img.width = portada.width; img.height = portada.height; }
    img.className = "ficha-portada";
    cabecera.append(img);
  }

  // La columna derecha: título, artista y los datos, en su propia caja para
  // que los tres se apilen juntos al lado de la portada en vez de repartirse
  // por la rejilla como tres hijos sueltos.
  const texto = el("div", null, "ficha-texto");
  texto.append(el("h1", d.title), el("p", artista, "ficha-artista"));

  // ── Los datos de ficha: SOLO AÑO Y FORMATO.
  //
  //    Hubo cinco filas (año, sello con nº de catálogo, país, formato,
  //    géneros+estilos) y se recortó a dos a propósito: la página había
  //    acabado siendo un volcado de la ficha de Discogs, y para eso ya está
  //    el enlace del final. Lo que se queda responde a "¿qué disco es y en
  //    qué formato lo tengo?"; el resto es dato de catálogo, y quien lo
  //    quiera está a un clic de la fuente, que además lo tendrá más al día.
  //
  //    Solo se pintan las filas que traen algo: un <dt> "Año" con un guion
  //    al lado no informa de nada. Con dos filas esto importa MÁS que con
  //    cinco — hay discos sin año (por ejemplo el 10595616 de los mocks), y
  //    ahí la lista se queda en una sola fila sin que se descuadre.
  const filas = [
    [t.anio, d.year || d.released || null],
    [t.formato, (d.formats ?? []).map((f) =>
      [f.qty > 1 ? `${f.qty}×` : "", f.name, (f.descriptions ?? []).join(", ")]
        .filter(Boolean).join(" ")).join(" + ")],
  ].filter(([, v]) => v);

  if (filas.length) {
    const dl = el("dl", null, "ficha-datos");
    for (const [k, v] of filas) dl.append(el("dt", k), el("dd", String(v)));
    texto.append(dl);
  }

  cabecera.append(texto);
  frag.append(cabecera);

  // ── Tracklist. `position` puede venir vacío (los índices de un box set,
  //    o las cabeceras de sección), así que no se da por hecho.
  const pistas = (d.tracklist ?? []).filter((p) => p.title);
  if (pistas.length) {
    frag.append(el("h2", t.tracklist));
    const ol = el("ol", null, "ficha-tracklist");
    for (const p of pistas) {
      const li = el("li");
      li.append(
        el("span", p.position || "", "pista-pos"),
        el("span", p.title, "pista-titulo"),
        el("span", p.duration || "", "pista-dur")
      );
      ol.append(li);
    }
    frag.append(ol);
  }

  // Enlace a la ficha original: lo que se enseña aquí es un resumen, y el
  // trabajo es de la comunidad de Discogs. Corresponde poder ir a la fuente.
  const pie = el("p", null, "ficha-fuente");
  const a = el("a", t.enlaceDiscogs);
  a.href = d.uri ?? `https://www.discogs.com/release/${d.id}`;
  a.rel = "noopener";
  pie.append(a);
  frag.append(pie);

  app.replaceChildren(frag);
}

// EL SELECTOR DE IDIOMA PIERDE EL ?id=, y hay que devolvérselo.
//
// base.njk pinta los enlaces de idioma desde `localeLinks` del front matter,
// que es un valor fijo del build: "/en/music/record/". No puede saber qué
// disco estás mirando, porque eso vive en la URL del navegador. Sin esto,
// cambiar de idioma en una ficha te deja en la página sin disco.
//
// Son dos enlaces (la barra lateral y la del móvil), de ahí querySelectorAll.
// El href del build es la BASE del otro idioma ("/en/music/record/"), así que
// basta con pegarle el mismo slug detrás para tener su URL bonita.
function arreglarEnlacesDeIdioma() {
  const cola = slug ? `${slug}/` : `?id=${id}`;
  for (const a of document.querySelectorAll("a[hreflang]")) {
    a.href = a.getAttribute("href") + cola;
  }
}

// LAS FICHAS ENLATADAS, para no gastar el cupo de Discogs mientras se trabaja.
//
// AQUÍ DUELE MÁS QUE EN LA COLECCIÓN, y por dos motivos: esta página NO
// guarda nada en sessionStorage —el tracklist lo edita la comunidad y se
// quiere al día—, así que CADA RECARGA es una petición de las 25 por minuto
// que permite la API sin token. Y cuando se agota, lo que se ve es "no se ha
// podido cargar la ficha", que en mitad de un trabajo de maquetación parece
// un fallo de lo que estás tocando y no lo es.
//
// Se exige `cfg.mockBase` ADEMÁS del parámetro, igual que en coleccion.js: en
// producción la plantilla lo deja en null y la carpeta ni se publica.
//
// SOLO ESTÁN ENLATADOS UNOS POCOS DISCOS, y elegidos a propósito para que
// estresen la maquetación por sitios distintos (ver docs/plan.md): del de 4
// canciones al de 40, uno sin año, uno sin notas, uno con tres artistas, uno
// con un título de 104 caracteres. Con ?mock, un disco que no esté en la
// lista da un 404 — y el mensaje de error lo dice, para no confundirlo con
// un fallo de la página.
const MOCK =
  Boolean(cfg.mockBase) && new URLSearchParams(location.search).has("mock");

async function arrancar() {
  if (!id || !/^\d+$/.test(id)) {
    error(t.sinId);
    return;
  }

  arreglarEnlacesDeIdioma();
  app.replaceChildren(el("p", t.cargando));

  try {
    // no-store por lo mismo que en coleccion.js: Discogs no manda cabeceras de
    // caché y no queremos que el navegador decida por su cuenta.
    const r = MOCK
      ? await fetch(`${cfg.mockBase}release-${id}.json`)
      : await fetch(`https://api.discogs.com/releases/${id}`, { cache: "no-store" });
    if (!r.ok) throw new Error(MOCK ? `HTTP ${r.status} — ¿ese disco está enlatado?` : `HTTP ${r.status}`);
    pintar(await r.json());
  } catch (e) {
    error(`${t.error} (${e.message}).`);
  }
}

arrancar();
