/* ==========================================================================
   MI CASA — app.js
   Organización del archivo (cada bloque es un "módulo" independiente):
     1. Configuración / catálogo de categorías e imágenes
     2. Storage        -> leer y escribir en localStorage
     3. Productos      -> altas, bajas, modificaciones, consumo
     4. Vencimientos    -> cálculo de estado a partir de la fecha
     5. Compras        -> lista de compras
     6. Render         -> pintar cada vista en el DOM
     7. Búsqueda/Filtros
     8. Formularios    -> modal de agregar/editar y confirmación de borrado
     9. ConsumoModal   -> modal de consumir / agregar stock con stepper
     10. Navegación    -> cambio entre vistas
     11. Inicialización
   ========================================================================== */

/* ============================================================
   1. CONFIGURACIÓN: categorías e imágenes predeterminadas
   ============================================================ */

const CATEGORIAS = {
  lacteos: { label: "Lácteos", emoji: "🥛" },
  granos: { label: "Granos y pastas", emoji: "🍚" },
  bebidas: { label: "Bebidas", emoji: "🧃" },
  limpieza: { label: "Limpieza", emoji: "🧴" },
  higiene: { label: "Higiene", emoji: "🧻" },
  otros: { label: "Otros", emoji: "📦" },
};

// Imágenes seleccionables al crear/editar un producto, agrupadas por categoría.
const IMAGENES_POR_CATEGORIA = {
  lacteos: [
    { emoji: "🥛", nombre: "Leche" },
    { emoji: "🧀", nombre: "Queso" },
    { emoji: "🍦", nombre: "Yogur" },
    { emoji: "🧈", nombre: "Manteca" },
  ],
  granos: [
    { emoji: "🍚", nombre: "Arroz" },
    { emoji: "🍝", nombre: "Fideos" },
    { emoji: "🌾", nombre: "Harina" },
    { emoji: "🥫", nombre: "Legumbres" },
  ],
  bebidas: [
    { emoji: "🧃", nombre: "Jugo" },
    { emoji: "☕", nombre: "Café" },
    { emoji: "🍷", nombre: "Vino" },
    { emoji: "💧", nombre: "Agua" },
  ],
  limpieza: [
    { emoji: "🧴", nombre: "Detergente" },
    { emoji: "🧼", nombre: "Jabón" },
    { emoji: "🧽", nombre: "Esponja" },
    { emoji: "🪣", nombre: "Balde" },
  ],
  higiene: [
    { emoji: "🧻", nombre: "Papel" },
    { emoji: "🪥", nombre: "Cepillo" },
    { emoji: "🧷", nombre: "Varios" },
    { emoji: "🚿", nombre: "Shampoo" },
  ],
  otros: [
    { emoji: "📦", nombre: "Genérico" },
    { emoji: "🥫", nombre: "Conserva" },
    { emoji: "🍎", nombre: "Fruta" },
    { emoji: "🍞", nombre: "Pan" },
  ],
};

const CLAVE_PRODUCTOS = "almacen_productos";
const CLAVE_COMPRAS = "almacen_compras";

/* ============================================================
   2. STORAGE — única capa que toca localStorage directamente.
   ============================================================ */

const Storage = {
  cargarProductos() {
    const raw = localStorage.getItem(CLAVE_PRODUCTOS);
    return raw ? JSON.parse(raw) : [];
  },
  guardarProductos(lista) {
    localStorage.setItem(CLAVE_PRODUCTOS, JSON.stringify(lista));
  },
  cargarCompras() {
    const raw = localStorage.getItem(CLAVE_COMPRAS);
    return raw ? JSON.parse(raw) : [];
  },
  guardarCompras(lista) {
    localStorage.setItem(CLAVE_COMPRAS, JSON.stringify(lista));
  },
};

let productos = Storage.cargarProductos();
let compras = Storage.cargarCompras();

/* ============================================================
   3. PRODUCTOS
   ============================================================ */

const Productos = {
  generarId() {
    return "p" + Date.now() + Math.floor(Math.random() * 1000);
  },

  agregar(datos) {
    const nuevo = {
      id: this.generarId(),
      nombre: datos.nombre.trim(),
      categoria: datos.categoria,
      cantidad: Math.max(0, parseInt(datos.cantidad, 10) || 0),
      vencimiento: datos.vencimiento || null,
      imagen: datos.imagen || IMAGENES_POR_CATEGORIA[datos.categoria][0].emoji,
      codigoBarras: datos.codigoBarras || null,
    };
    productos.push(nuevo);
    Storage.guardarProductos(productos);
  },

  editar(id, datos) {
    const p = productos.find((x) => x.id === id);
    if (!p) return;
    p.nombre = datos.nombre.trim();
    p.categoria = datos.categoria;
    p.cantidad = Math.max(0, parseInt(datos.cantidad, 10) || 0);
    p.vencimiento = datos.vencimiento || null;
    p.imagen = datos.imagen || p.imagen;
    p.codigoBarras = datos.codigoBarras || p.codigoBarras || null;
    Storage.guardarProductos(productos);
  },

  eliminar(id) {
    productos = productos.filter((x) => x.id !== id);
    Storage.guardarProductos(productos);
    compras = compras.filter((c) => c.productoId !== id);
    Storage.guardarCompras(compras);
  },

  obtener(id) {
    return productos.find((x) => x.id === id);
  },

  // Descuenta "n" unidades (nunca queda negativo).
  consumirCantidad(id, n) {
    const p = this.obtener(id);
    if (!p) return;
    p.cantidad = Math.max(0, p.cantidad - n);
    Storage.guardarProductos(productos);
  },

  // Suma "n" unidades.
  sumarCantidad(id, n) {
    const p = this.obtener(id);
    if (!p) return;
    p.cantidad += n;
    Storage.guardarProductos(productos);
  },
};

/* ============================================================
   4. VENCIMIENTOS — el estado nunca se guarda: se calcula acá
      cada vez, a partir de la fecha del navegador.
   ============================================================ */

const Vencimientos = {
  diasRestantes(fechaISO) {
    if (!fechaISO) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const venc = new Date(fechaISO + "T00:00:00");
    const diffMs = venc - hoy;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  },

  calcularEstado(producto) {
    if (producto.cantidad === 0) {
      return { clave: "sin-stock", label: "Sin stock", tono: "danger" };
    }
    if (!producto.vencimiento) {
      return { clave: "sin-fecha", label: "Sin fecha", tono: "neutral" };
    }
    const dias = this.diasRestantes(producto.vencimiento);
    if (dias < 0) return { clave: "vencido", label: "Vencido", tono: "danger" };
    if (dias <= 2)
      return { clave: "vence-pronto", label: "Vence pronto", tono: "soon" };
    if (dias <= 7)
      return { clave: "proximo", label: "Próximo a vencer", tono: "warn" };
    return { clave: "normal", label: "Disponible", tono: "ok" };
  },

  textoDias(fechaISO) {
    const dias = this.diasRestantes(fechaISO);
    if (dias === null) return "Sin fecha";
    if (dias < 0)
      return `Venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? "" : "s"}`;
    if (dias === 0) return "Vence hoy";
    if (dias === 1) return "Vence mañana";
    return `Vence en ${dias} días`;
  },
};

/* ============================================================
   5-B. TOAST — feedback visual breve para confirmar acciones.
   ============================================================ */

const Toast = {
  iconos: {
    ok: "bi-check2-circle",
    info: "bi-info-circle",
    danger: "bi-exclamation-circle",
  },

  mostrar(mensaje, tipo = "ok") {
    const cont = document.getElementById("toastContainer");
    const el = document.createElement("div");
    el.className = `toast-item toast-${tipo}`;
    el.innerHTML = `<i class="bi ${this.iconos[tipo] || this.iconos.ok}"></i><span>${mensaje}</span>`;
    cont.appendChild(el);

    requestAnimationFrame(() => el.classList.add("show"));

    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 300);
    }, 2400);
  },
};

/* ============================================================
   5. COMPRAS — lista de compras, independiente del inventario.
      Un ítem se agrega solo cuando el usuario lo pide
      explícitamente (desde el dashboard o desde "Agregar producto"
      en la vista de compras), nunca en forma automática.
   ============================================================ */

const Compras = {
  agregarDesdeProducto(producto) {
    const yaExiste = compras.some((c) => c.productoId === producto.id);
    if (yaExiste) return;
    compras.push({
      id: "c" + Date.now(),
      productoId: producto.id,
      nombre: producto.nombre,
      emoji: producto.imagen,
    });
    Storage.guardarCompras(compras);
  },

  agregarManual(nombre) {
    compras.push({
      id: "c" + Date.now(),
      productoId: null,
      nombre: nombre.trim(),
      emoji: "🛒",
    });
    Storage.guardarCompras(compras);
  },

  // Al marcar como comprado, si el ítem está ligado a un producto del
  // inventario, le reponemos 1 unidad de stock automáticamente.
  marcarComprado(compraId) {
    const item = compras.find((c) => c.id === compraId);
    if (item && item.productoId) {
      Productos.sumarCantidad(item.productoId, 1);
    }
    compras = compras.filter((c) => c.id !== compraId);
    Storage.guardarCompras(compras);
  },

  marcarTodosComprados() {
    compras.forEach((item) => {
      if (item.productoId) Productos.sumarCantidad(item.productoId, 1);
    });
    compras = [];
    Storage.guardarCompras(compras);
  },
};

/* ============================================================
   6. RENDER
   ============================================================ */

const Render = {
  renderTodo() {
    this.renderDashboard();
    this.renderInventario();
    this.renderVencimientos();
    this.renderCompras();
    this.renderBadgeCompras();
  },

  pill(estado) {
    return `<span class="pill-estado pill-${estado.tono}">${estado.label}</span>`;
  },

  // ---------- Dashboard ----------
  renderDashboard() {
    const total = productos.length;
    const disponibles = productos.filter((p) => p.cantidad > 0).length;
    const porVencer = productos.filter((p) => {
      const e = Vencimientos.calcularEstado(p);
      return e.clave === "proximo" || e.clave === "vence-pronto";
    }).length;
    const vencidos = productos.filter(
      (p) => Vencimientos.calcularEstado(p).clave === "vencido",
    ).length;
    const paraComprar = productos.filter((p) => p.cantidad === 0).length;

    const stats = [
      {
        valor: total,
        label: "Productos registrados",
        tono: "neutral",
        icon: "bi-house-door",
      },
      {
        valor: disponibles,
        label: "Con stock disponible",
        tono: "ok",
        icon: "bi-check2",
      },
      {
        valor: porVencer,
        label: "Por vencer",
        tono: "warn",
        icon: "bi-clock-history",
      },
      {
        valor: vencidos,
        label: "Vencidos",
        tono: "danger",
        icon: "bi-exclamation-triangle-fill",
      },
      {
        valor: paraComprar,
        label: "Para comprar",
        tono: "pink",
        icon: "bi-cart3",
      },
    ];

    document.getElementById("statsGrid").innerHTML = stats
      .map(
        (s) => `
      <div class="stat-card tone-${s.tono}">
        <div class="stat-icon"><i class="bi ${s.icon}"></i></div>
        <div>
          <div class="stat-value">${s.valor}</div>
          <div class="stat-label">${s.label}</div>
        </div>
      </div>
    `,
      )
      .join("");

    const proximos = productos
      .filter((p) => p.cantidad > 0 && p.vencimiento)
      .map((p) => ({ p, dias: Vencimientos.diasRestantes(p.vencimiento) }))
      .filter((x) => x.dias >= 0 && x.dias <= 7)
      .sort((a, b) => a.dias - b.dias);

    const contProx = document.getElementById("listaVencimientosProximos");
    contProx.innerHTML = proximos.length
      ? proximos
          .map(
            ({ p }) => `
        <div class="mini-row">
          <div class="mini-left">
            <span class="mini-emoji">${p.imagen}</span>
            <div>
              <div class="mini-name">${p.nombre}</div>
              <div class="mini-sub">${Vencimientos.textoDias(p.vencimiento)}</div>
            </div>
          </div>
          ${this.pill(Vencimientos.calcularEstado(p))}
        </div>
      `,
          )
          .join("")
      : `<p class="empty-state">No hay productos por vencer en los próximos 7 días.</p>`;

    const sinStock = productos.filter((p) => p.cantidad === 0);
    const contComprar = document.getElementById("listaNecesitoComprar");
    contComprar.innerHTML = sinStock.length
      ? sinStock
          .map((p) => {
            const yaEnLista = compras.some((c) => c.productoId === p.id);
            return `
          <div class="mini-row">
            <div class="mini-left">
              <span class="mini-emoji">${p.imagen}</span>
              <div>
                <div class="mini-name">${p.nombre}</div>
                <div class="mini-sub">Stock: 0</div>
              </div>
            </div>
            ${
              yaEnLista
                ? `<span class="pill-estado pill-neutral">En la lista</span>`
                : `<button class="btn-mini" data-add-compra="${p.id}">Agregar a compras</button>`
            }
          </div>
        `;
          })
          .join("")
      : `<p class="empty-state">No falta reponer nada por ahora.</p>`;

    // Banner "todo en orden" / alerta, con la mascota.
    const titulo = vencidos > 0 ? "¡Atenti! 🐾" : "¡Todo en orden! 🐾";
    const sub = `Tenés ${disponibles} producto${disponibles === 1 ? "" : "s"} en stock y ${paraComprar} por comprar.`;
    document.getElementById("bannerTitle").textContent = titulo;
    document.getElementById("bannerSub").textContent = sub;
  },

  // Orden de urgencia para el inventario: lo que necesita atención
  // primero (vencido, por vencer) y lo que está sin fecha al final.
  ordenPorUrgencia(lista) {
    const prioridad = {
      vencido: 0,
      "vence-pronto": 1,
      proximo: 2,
      "sin-stock": 3,
      normal: 4,
      "sin-fecha": 5,
    };
    return lista.slice().sort((a, b) => {
      const pa = prioridad[Vencimientos.calcularEstado(a).clave] ?? 99;
      const pb = prioridad[Vencimientos.calcularEstado(b).clave] ?? 99;
      if (pa !== pb) return pa - pb;
      const da = Vencimientos.diasRestantes(a.vencimiento);
      const db = Vencimientos.diasRestantes(b.vencimiento);
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });
  },

  // ---------- Inventario ----------
  renderInventario() {
    const filtrados = this.ordenPorUrgencia(Filtros.aplicar(productos));
    const grid = document.getElementById("productsGrid");

    if (filtrados.length === 0) {
      const sinNingunProducto = productos.length === 0;
      grid.innerHTML = `
        <div class="empty-state-mascot">
          <img src="mascota.png" class="mascot mascot-md" alt="">
          <p class="empty-title">${sinNingunProducto ? "Todavía no tenés productos" : "No encontramos productos"}</p>
          <p class="empty-sub">${sinNingunProducto ? "Agregá el primero con el botón de arriba." : "Probá con otra búsqueda o filtro."}</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtrados
      .map((p) => {
        const estado = Vencimientos.calcularEstado(p);
        const cat = CATEGORIAS[p.categoria] || CATEGORIAS.otros;
        return `
        <div class="product-card">
          <span class="card-emoji">${p.imagen}</span>
          <div class="card-nombre">${p.nombre}</div>
          <div class="card-categoria">${cat.label}</div>
          <div class="card-stock">Stock: <b>${p.cantidad} unidad${p.cantidad === 1 ? "" : "es"}</b></div>
          <div class="card-venc">${p.vencimiento ? "Vence: " + this.formatearFecha(p.vencimiento) : "Sin vencimiento"}</div>
          ${this.pill(estado)}
          <div class="card-actions">
            ${
              p.cantidad > 0
                ? `<button class="btn-consumir" data-consumir="${p.id}"><i class="bi bi-dash-lg"></i> Consumir</button>`
                : `<button class="btn-agregarstock" data-consumir="${p.id}"><i class="bi bi-plus-lg"></i> Agregar</button>`
            }
            <button class="btn-editar" data-editar="${p.id}">Editar</button>
            <button class="btn-eliminar" data-eliminar="${p.id}"><i class="bi bi-trash3"></i></button>
          </div>
        </div>
      `;
      })
      .join("");
  },

  formatearFecha(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  },

  // ---------- Vencimientos (tabla con tabs) ----------
  renderVencimientos() {
    const tab = Filtros.tabVencimientos;
    let lista = productos.slice();

    if (tab === "proximos") {
      lista = lista.filter((p) => {
        const e = Vencimientos.calcularEstado(p);
        return e.clave === "proximo" || e.clave === "vence-pronto";
      });
    } else if (tab === "vencidos") {
      lista = lista.filter(
        (p) => Vencimientos.calcularEstado(p).clave === "vencido",
      );
    } else if (tab === "sin-fecha") {
      lista = lista.filter((p) => !p.vencimiento && p.cantidad > 0);
    }

    lista.sort((a, b) => {
      const da = Vencimientos.diasRestantes(a.vencimiento);
      const db = Vencimientos.diasRestantes(b.vencimiento);
      if (da === null) return 1;
      if (db === null) return -1;
      return da - db;
    });

    const body = document.getElementById("tablaVencimientosBody");

    if (lista.length === 0) {
      const mensajes = {
        todos: [
          "Todavía no tenés productos cargados",
          "Agregá el primero con el botón de arriba.",
        ],
        proximos: [
          "Nada por vencer pronto",
          "Por ahora no hay productos en esta categoría.",
        ],
        vencidos: [
          "Ningún producto vencido",
          "¡Buen trabajo manteniendo todo al día!",
        ],
        "sin-fecha": [
          "Todo tiene fecha cargada",
          "No hay productos sin vencimiento registrado.",
        ],
      };
      const [titulo, sub] = mensajes[tab] || mensajes["todos"];
      body.innerHTML = `
        <tr><td colspan="3">
          <div class="empty-state-mascot">
            <img src="mascota.png" class="mascot mascot-md" alt="">
            <p class="empty-title">${titulo}</p>
            <p class="empty-sub">${sub}</p>
          </div>
        </td></tr>
      `;
      return;
    }

    body.innerHTML = lista
      .map((p) => {
        const estado = Vencimientos.calcularEstado(p);
        return `
        <tr>
          <td>
            <div class="prod-cell">
              <span class="card-emoji">${p.imagen}</span>
              <span class="prod-nombre">${p.nombre}</span>
            </div>
          </td>
          <td>${p.vencimiento ? this.formatearFecha(p.vencimiento) : "—"}</td>
          <td>${this.pill(estado)}</td>
        </tr>
      `;
      })
      .join("");
  },

  // ---------- Compras ----------
  renderCompras() {
    const lista = document.getElementById("shoppingList");
    const empty = document.getElementById("emptyCompras");
    const btnTodos = document.getElementById("btnMarcarTodosComprados");

    if (compras.length === 0) {
      lista.innerHTML = "";
      empty.classList.remove("d-none");
      btnTodos.classList.add("d-none");
      return;
    }
    empty.classList.add("d-none");
    btnTodos.classList.remove("d-none");

    lista.innerHTML = compras
      .map(
        (c) => `
      <li>
        <input type="checkbox" data-comprado="${c.id}">
        <span class="mini-emoji">${c.emoji}</span>
        <span class="item-nombre">${c.nombre}</span>
        ${c.productoId ? `<span class="item-sub">Repone stock</span>` : ""}
      </li>
    `,
      )
      .join("");
  },

  renderBadgeCompras() {
    const n = compras.length;
    document
      .querySelectorAll("#badgeCompras, #badgeComprasMobile")
      .forEach((el) => {
        el.textContent = n;
        el.classList.toggle("show", n > 0);
      });
  },

  poblarSelectCategorias() {
    const selectFiltro = document.getElementById("filtroCategoria");
    const selectForm = document.getElementById("inputCategoria");
    const opciones = Object.entries(CATEGORIAS)
      .map(([clave, c]) => `<option value="${clave}">${c.label}</option>`)
      .join("");

    selectForm.innerHTML = opciones;
    selectFiltro.innerHTML =
      `<option value="todas">Todas las categorías</option>` + opciones;
  },
};

/* ============================================================
   7. BÚSQUEDA / FILTROS
   ============================================================ */

const Filtros = {
  texto: "",
  estado: "todos",
  categoria: "todas",
  tabVencimientos: "todos",

  aplicar(lista) {
    return lista.filter((p) => {
      const coincideTexto = p.nombre
        .toLowerCase()
        .includes(this.texto.toLowerCase());
      const coincideCategoria =
        this.categoria === "todas" || p.categoria === this.categoria;

      let coincideEstado = true;
      if (this.estado !== "todos") {
        const estado = Vencimientos.calcularEstado(p);
        if (this.estado === "disponible") coincideEstado = p.cantidad > 0;
        if (this.estado === "sin-stock") coincideEstado = p.cantidad === 0;
        if (this.estado === "por-vencer")
          coincideEstado =
            estado.clave === "proximo" || estado.clave === "vence-pronto";
        if (this.estado === "vencido")
          coincideEstado = estado.clave === "vencido";
      }
      return coincideTexto && coincideCategoria && coincideEstado;
    });
  },
};

/* ============================================================
   8. FORMULARIOS — modal de agregar/editar producto,
      selector de imagen, y confirmación de eliminación.
   ============================================================ */

const Formularios = {
  idEnEdicion: null,
  imagenSeleccionada: null,
  idParaEliminar: null,
  codigoBarrasPendiente: null,

  abrirParaAgregar(codigoBarras = null) {
    this.idEnEdicion = null;
    this.codigoBarrasPendiente = codigoBarras;
    document.getElementById("modalTitulo").textContent = "Agregar producto";
    document.getElementById("formProducto").reset();
    document.getElementById("productoId").value = "";
    document.getElementById("inputCantidad").value = 1;
    this.renderImagePicker(document.getElementById("inputCategoria").value);
    this.mostrarModal();
  },

  abrirParaEditar(id) {
    const p = Productos.obtener(id);
    if (!p) return;
    this.idEnEdicion = id;
    this.codigoBarrasPendiente = null;
    document.getElementById("modalTitulo").textContent = "Editar producto";
    document.getElementById("productoId").value = p.id;
    document.getElementById("inputNombre").value = p.nombre;
    document.getElementById("inputCategoria").value = p.categoria;
    document.getElementById("inputCantidad").value = p.cantidad;
    document.getElementById("inputVencimiento").value = p.vencimiento || "";
    this.imagenSeleccionada = p.imagen;
    this.renderImagePicker(p.categoria, p.imagen);
    this.mostrarModal();
  },

  renderImagePicker(categoria, seleccionada) {
    const opciones =
      IMAGENES_POR_CATEGORIA[categoria] || IMAGENES_POR_CATEGORIA.otros;
    if (!seleccionada) seleccionada = opciones[0].emoji;
    this.imagenSeleccionada = seleccionada;

    const cont = document.getElementById("imagePicker");
    cont.innerHTML = opciones
      .map(
        (op) => `
      <button type="button" class="img-opt ${op.emoji === seleccionada ? "selected" : ""}" data-imagen="${op.emoji}">
        <span class="img-emoji">${op.emoji}</span>
        <span class="img-nombre">${op.nombre}</span>
      </button>
    `,
      )
      .join("");
  },

  mostrarModal() {
    document.getElementById("modalOverlay").classList.remove("d-none");
  },
  ocultarModal() {
    document.getElementById("modalOverlay").classList.add("d-none");
  },

  guardar(e) {
    e.preventDefault();
    const datos = {
      nombre: document.getElementById("inputNombre").value,
      categoria: document.getElementById("inputCategoria").value,
      cantidad: document.getElementById("inputCantidad").value,
      vencimiento: document.getElementById("inputVencimiento").value,
      imagen: this.imagenSeleccionada,
      codigoBarras: this.codigoBarrasPendiente,
    };
    if (!datos.nombre) return;

    if (this.idEnEdicion) {
      Productos.editar(this.idEnEdicion, datos);
      Toast.mostrar(`"${datos.nombre}" actualizado`);
    } else {
      Productos.agregar(datos);
      Toast.mostrar(`"${datos.nombre}" agregado al inventario`);
    }
    this.ocultarModal();
    Render.renderTodo();
  },

  pedirConfirmacionEliminar(id) {
    this.idParaEliminar = id;
    document.getElementById("confirmOverlay").classList.remove("d-none");
  },
  cerrarConfirmacion() {
    this.idParaEliminar = null;
    document.getElementById("confirmOverlay").classList.add("d-none");
  },
  confirmarEliminar() {
    if (this.idParaEliminar) {
      const p = Productos.obtener(this.idParaEliminar);
      Productos.eliminar(this.idParaEliminar);
      if (p) Toast.mostrar(`"${p.nombre}" eliminado`, "danger");
    }
    this.cerrarConfirmacion();
    Render.renderTodo();
  },
};

/* ============================================================
   9. CONSUMO MODAL — consumir o agregar stock con stepper.
      La cantidad del stepper es "cuánto mover", no el stock total.
   ============================================================ */

const ConsumoModal = {
  productoId: null,
  cantidadMover: 1,

  abrir(id) {
    const p = Productos.obtener(id);
    if (!p) return;
    this.productoId = id;
    this.cantidadMover = 1;

    document.getElementById("consumoIcon").textContent = p.imagen;
    document.getElementById("consumoNombre").textContent = p.nombre;
    document.getElementById("consumoCategoria").textContent = (
      CATEGORIAS[p.categoria] || CATEGORIAS.otros
    ).label;
    document.getElementById("consumoStockActual").textContent =
      `${p.cantidad} unidad${p.cantidad === 1 ? "" : "es"}`;
    document.getElementById("consumoCantidad").textContent = this.cantidadMover;

    const btnConsumir = document.getElementById("consumoConfirmar");
    btnConsumir.disabled = p.cantidad === 0;
    btnConsumir.style.opacity = p.cantidad === 0 ? "0.5" : "1";

    document.getElementById("consumoOverlay").classList.remove("d-none");
  },

  cerrar() {
    document.getElementById("consumoOverlay").classList.add("d-none");
  },

  ajustar(delta) {
    const p = Productos.obtener(this.productoId);
    if (!p) return;
    const max = Math.max(p.cantidad, 1);
    this.cantidadMover = Math.min(max, Math.max(1, this.cantidadMover + delta));
    document.getElementById("consumoCantidad").textContent = this.cantidadMover;
  },

  confirmarConsumir() {
    if (!this.productoId) return;
    const p = Productos.obtener(this.productoId);
    Productos.consumirCantidad(this.productoId, this.cantidadMover);
    if (p) Toast.mostrar(`Consumiste ${this.cantidadMover} de "${p.nombre}"`);
    this.cerrar();
    Render.renderTodo();
  },

  confirmarAgregar() {
    if (!this.productoId) return;
    const p = Productos.obtener(this.productoId);
    Productos.sumarCantidad(this.productoId, this.cantidadMover);
    if (p) Toast.mostrar(`Agregaste ${this.cantidadMover} a "${p.nombre}"`);
    this.cerrar();
    Render.renderTodo();
  },
};

/* ============================================================
   10. SCANNER — lee códigos de barras con la cámara (vía
       html5-qrcode) y busca el producto en Open Food Facts,
       una base pública y gratuita. Si el código ya está
       registrado en el inventario, abre directamente el modal
       de consumir/sumar en vez del formulario de alta.
   ============================================================ */

const Scanner = {
  instancia: null,
  procesando: false,

  abrir() {
    document.getElementById("scannerError").classList.add("d-none");
    document.getElementById("scannerOverlay").classList.remove("d-none");
    this.procesando = false;

    if (typeof Html5Qrcode === "undefined") {
      this.mostrarError(
        "No se pudo cargar el lector de cámara. Revisá tu conexión a internet.",
      );
      return;
    }

    this.instancia = new Html5Qrcode("scannerReader");
    this.instancia
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 140 } },
        (codigoDetectado) => this.onDetectado(codigoDetectado),
        () => {}, // se llama en cada frame sin detección; lo ignoramos
      )
      .catch(() => {
        this.mostrarError(
          "No se pudo acceder a la cámara. Revisá los permisos del navegador.",
        );
      });
  },

  cerrar() {
    if (this.instancia) {
      this.instancia
        .stop()
        .then(() => this.instancia.clear())
        .catch(() => {});
      this.instancia = null;
    }
    document.getElementById("scannerOverlay").classList.add("d-none");
  },

  mostrarError(msg) {
    const el = document.getElementById("scannerError");
    el.textContent = msg;
    el.classList.remove("d-none");
  },

  onDetectado(codigo) {
    if (this.procesando) return;
    this.procesando = true;
    this.cerrar();
    this.procesarCodigo(codigo);
  },

  // Adivina una de nuestras categorías internas a partir del texto
  // de categorías/nombre que devuelve Open Food Facts.
  inferirCategoria(texto) {
    const s = (texto || "").toLowerCase();
    if (/(lact|leche|yogur|queso|dairy|milk)/.test(s)) return "lacteos";
    if (/(arroz|pasta|fideo|harina|cereal|legumbre|rice|noodle|grain)/.test(s))
      return "granos";
    if (
      /(bebida|jugo|agua|gaseosa|beverage|drink|water|soda|wine|vino|cerveza|beer)/.test(
        s,
      )
    )
      return "bebidas";
    if (/(limpieza|detergente|lavandina|cleaning|clean)/.test(s))
      return "limpieza";
    if (/(higiene|shampoo|jabón|jabon|papel|hygiene|deo)/.test(s))
      return "higiene";
    return "otros";
  },

  procesarCodigo(codigo) {
    // 1) ¿Ya tenemos este código en el inventario? -> abrir consumo directo.
    const existente = productos.find((p) => p.codigoBarras === codigo);
    if (existente) {
      Toast.mostrar(`Encontrado: "${existente.nombre}"`, "info");
      ConsumoModal.abrir(existente.id);
      return;
    }

    // 2) No lo tenemos: buscamos el nombre en Open Food Facts para
    //    precompletar el formulario de alta.
    Toast.mostrar("Buscando producto...", "info");

    fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(codigo)}.json`,
    )
      .then((r) => r.json())
      .then((data) => {
        let nombre = "";
        let categoriaSugerida = "otros";
        if (data && data.status === 1 && data.product) {
          nombre = data.product.product_name || data.product.generic_name || "";
          categoriaSugerida = this.inferirCategoria(
            (data.product.categories || "") + " " + nombre,
          );
        }

        Formularios.abrirParaAgregar(codigo);
        document.getElementById("inputNombre").value = nombre;
        document.getElementById("inputCategoria").value = categoriaSugerida;
        Formularios.renderImagePicker(categoriaSugerida);

        Toast.mostrar(
          nombre
            ? `Producto encontrado: "${nombre}"`
            : "No encontramos el producto, completá los datos",
          nombre ? "ok" : "info",
        );
      })
      .catch(() => {
        Formularios.abrirParaAgregar(codigo);
        Toast.mostrar(
          "Sin conexión para buscar el producto, completá los datos a mano",
          "info",
        );
      });
  },
};

/* ============================================================
   11. NAVEGACIÓN entre vistas
   ============================================================ */

const Navegacion = {
  irA(vista) {
    document
      .querySelectorAll(".view")
      .forEach((v) => v.classList.add("d-none"));
    document.getElementById("view-" + vista).classList.remove("d-none");

    document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === vista);
    });
  },
};

/* ============================================================
   12. DATOS INICIALES (solo si localStorage está vacío)
   ============================================================ */

function cargarDatosIniciales() {
  if (productos.length > 0) return;

  const hoy = new Date();
  const enDias = (n) => {
    const d = new Date(hoy);
    d.setDate(d.getDate() + n);
    return d.toISOString().split("T")[0];
  };

  productos = [
    {
      id: Productos.generarId(),
      nombre: "Leche",
      categoria: "lacteos",
      cantidad: 3,
      vencimiento: enDias(1),
      imagen: "🥛",
    },
    {
      id: Productos.generarId(),
      nombre: "Arroz",
      categoria: "granos",
      cantidad: 2,
      vencimiento: enDias(120),
      imagen: "🍚",
    },
    {
      id: Productos.generarId(),
      nombre: "Fideos",
      categoria: "granos",
      cantidad: 5,
      vencimiento: enDias(200),
      imagen: "🍝",
    },
    {
      id: Productos.generarId(),
      nombre: "Yogur",
      categoria: "lacteos",
      cantidad: 2,
      vencimiento: enDias(3),
      imagen: "🍦",
    },
    {
      id: Productos.generarId(),
      nombre: "Atún",
      categoria: "otros",
      cantidad: 0,
      vencimiento: enDias(300),
      imagen: "🥫",
    },
    {
      id: Productos.generarId(),
      nombre: "Detergente",
      categoria: "limpieza",
      cantidad: 1,
      vencimiento: null,
      imagen: "🧴",
    },
    {
      id: Productos.generarId(),
      nombre: "Papel higiénico",
      categoria: "higiene",
      cantidad: 0,
      vencimiento: null,
      imagen: "🧻",
    },
    {
      id: Productos.generarId(),
      nombre: "Queso",
      categoria: "lacteos",
      cantidad: 1,
      vencimiento: enDias(-1),
      imagen: "🧀",
    },
  ];
  Storage.guardarProductos(productos);
}

/* ============================================================
   13. EVENTOS
   ============================================================ */

function inicializarEventos() {
  // --- Navegación (sidebar + bottom nav) ---
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => Navegacion.irA(btn.dataset.view));
  });

  // --- Abrir modal de agregar ---
  document
    .getElementById("btnAddSidebar")
    .addEventListener("click", () => Formularios.abrirParaAgregar());
  document
    .getElementById("btnAddFab")
    .addEventListener("click", () => Formularios.abrirParaAgregar());

  // --- Escáner de código de barras ---
  document.getElementById("btnEscanear").addEventListener("click", () => {
    Formularios.ocultarModal();
    Scanner.abrir();
  });
  document
    .getElementById("scannerClose")
    .addEventListener("click", () => Scanner.cerrar());
  document.getElementById("scannerOverlay").addEventListener("click", (e) => {
    if (e.target.id === "scannerOverlay") Scanner.cerrar();
  });

  // --- Modal producto: cerrar ---
  document
    .getElementById("modalClose")
    .addEventListener("click", () => Formularios.ocultarModal());
  document
    .getElementById("btnCancelarForm")
    .addEventListener("click", () => Formularios.ocultarModal());
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") Formularios.ocultarModal();
  });

  document.getElementById("inputCategoria").addEventListener("change", (e) => {
    Formularios.renderImagePicker(e.target.value);
  });

  document.getElementById("imagePicker").addEventListener("click", (e) => {
    const btn = e.target.closest(".img-opt");
    if (!btn) return;
    Formularios.imagenSeleccionada = btn.dataset.imagen;
    document
      .querySelectorAll(".img-opt")
      .forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
  });

  document
    .getElementById("formProducto")
    .addEventListener("submit", (e) => Formularios.guardar(e));

  // --- Confirmación de eliminación ---
  document
    .getElementById("btnCancelarEliminar")
    .addEventListener("click", () => Formularios.cerrarConfirmacion());
  document
    .getElementById("btnConfirmarEliminar")
    .addEventListener("click", () => Formularios.confirmarEliminar());
  document.getElementById("confirmOverlay").addEventListener("click", (e) => {
    if (e.target.id === "confirmOverlay") Formularios.cerrarConfirmacion();
  });

  // --- Modal de consumo ---
  document
    .getElementById("consumoClose")
    .addEventListener("click", () => ConsumoModal.cerrar());
  document.getElementById("consumoOverlay").addEventListener("click", (e) => {
    if (e.target.id === "consumoOverlay") ConsumoModal.cerrar();
  });
  document
    .getElementById("consumoMenos")
    .addEventListener("click", () => ConsumoModal.ajustar(-1));
  document
    .getElementById("consumoMas")
    .addEventListener("click", () => ConsumoModal.ajustar(1));
  document
    .getElementById("consumoConfirmar")
    .addEventListener("click", () => ConsumoModal.confirmarConsumir());
  document
    .getElementById("consumoAgregarStock")
    .addEventListener("click", () => ConsumoModal.confirmarAgregar());

  // --- Búsqueda ---
  document.getElementById("inputBuscar").addEventListener("input", (e) => {
    Filtros.texto = e.target.value;
    Render.renderInventario();
  });

  // --- Chips de filtro por estado (inventario) ---
  document.getElementById("filtrosEstado").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document
      .querySelectorAll("#filtrosEstado .chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    Filtros.estado = chip.dataset.filter;
    Render.renderInventario();
  });

  // --- Filtro por categoría ---
  document.getElementById("filtroCategoria").addEventListener("change", (e) => {
    Filtros.categoria = e.target.value;
    Render.renderInventario();
  });

  // --- Tabs de vencimientos ---
  document.getElementById("tabsVencimientos").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document
      .querySelectorAll("#tabsVencimientos .chip")
      .forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    Filtros.tabVencimientos = chip.dataset.tabVenc;
    Render.renderVencimientos();
  });

  // --- Acciones sobre tarjetas de producto (delegado en el grid) ---
  document.getElementById("productsGrid").addEventListener("click", (e) => {
    const consumir = e.target.closest("[data-consumir]");
    const editar = e.target.closest("[data-editar]");
    const eliminar = e.target.closest("[data-eliminar]");

    if (consumir) ConsumoModal.abrir(consumir.dataset.consumir);
    if (editar) Formularios.abrirParaEditar(editar.dataset.editar);
    if (eliminar)
      Formularios.pedirConfirmacionEliminar(eliminar.dataset.eliminar);
  });

  // --- "Agregar a compras" desde el dashboard ---
  document
    .getElementById("listaNecesitoComprar")
    .addEventListener("click", (e) => {
      const btn = e.target.closest("[data-add-compra]");
      if (!btn) return;
      const p = Productos.obtener(btn.dataset.addCompra);
      if (p) {
        Compras.agregarDesdeProducto(p);
        Toast.mostrar(`"${p.nombre}" agregado a la lista de compras`, "info");
        Render.renderTodo();
      }
    });

  // --- Lista de compras: marcar como comprado ---
  document.getElementById("shoppingList").addEventListener("change", (e) => {
    const check = e.target.closest("[data-comprado]");
    if (!check) return;
    Compras.marcarComprado(check.dataset.comprado);
    Toast.mostrar("Comprado ✔️");
    Render.renderTodo();
  });

  // --- Marcar todos como comprados ---
  document
    .getElementById("btnMarcarTodosComprados")
    .addEventListener("click", () => {
      Compras.marcarTodosComprados();
      Toast.mostrar("Lista de compras vaciada");
      Render.renderTodo();
    });

  // --- Modal: agregar item manual a la lista de compras ---
  document
    .getElementById("btnAbrirAgregarCompra")
    .addEventListener("click", () => {
      document.getElementById("formCompraItem").reset();
      document.getElementById("compraItemOverlay").classList.remove("d-none");
    });
  document.getElementById("compraItemClose").addEventListener("click", () => {
    document.getElementById("compraItemOverlay").classList.add("d-none");
  });
  document
    .getElementById("btnCancelarCompraItem")
    .addEventListener("click", () => {
      document.getElementById("compraItemOverlay").classList.add("d-none");
    });
  document
    .getElementById("compraItemOverlay")
    .addEventListener("click", (e) => {
      if (e.target.id === "compraItemOverlay")
        document.getElementById("compraItemOverlay").classList.add("d-none");
    });
  document.getElementById("formCompraItem").addEventListener("submit", (e) => {
    e.preventDefault();
    const nombre = document.getElementById("inputCompraNombre").value.trim();
    if (!nombre) return;
    Compras.agregarManual(nombre);
    Toast.mostrar(`"${nombre}" agregado a la lista`, "info");
    document.getElementById("compraItemOverlay").classList.add("d-none");
    Render.renderTodo();
  });
}

/* ============================================================
   14. INICIALIZACIÓN
   ============================================================ */

function iniciar() {
  cargarDatosIniciales();
  Render.poblarSelectCategorias();
  inicializarEventos();
  Render.renderTodo();
}

document.addEventListener("DOMContentLoaded", iniciar);
