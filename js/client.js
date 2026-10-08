// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://lxlnauxfhljbfnbhinnh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fI8UXfrnZx0iQm__dCBzvg_nxDY05TO';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const numeroWhatsApp = "50378373498";

let propiedades = [];
let mapaDetalle = null;

const formatoPrecio = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
});
const formatoFecha = new Intl.DateTimeFormat('es', {
    day: 'numeric', month: 'long', year: 'numeric'
});

function escapeHTML(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function urlWhatsApp(prop) {
    const precio = formatoPrecio.format(prop.precio);
    const mensaje = `Hola, me interesa la propiedad ${prop.titulo} publicada en ${precio}.`;
    return `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`;
}

function crearCapasMapa() {
    return {
        'Mapa': L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            subdomains: 'abcd',
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap &copy; CARTO'
        }),
        'Satélite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        }),
        'Terreno': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri'
        })
    };
}

// ==========================================
// 1. CATÁLOGO
// ==========================================
async function cargarCatalogo() {
    const grid = document.getElementById('propertyGrid');

    const { data, error } = await sb
        .from('propiedades')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al cargar:", error);
        grid.innerHTML = '<p class="empty-msg">Error cargando el catálogo.</p>';
        return;
    }

    propiedades = data || [];

    if (propiedades.length === 0) {
        grid.innerHTML = '<p class="empty-msg">Aún no hay propiedades publicadas.</p>';
        return;
    }

    grid.innerHTML = '';

    propiedades.forEach(prop => {
        const card = document.createElement('article');
        card.className = 'card';
        card.dataset.id = prop.id;
        card.innerHTML = `
            <div class="card-img">
                <span class="card-tag">${escapeHTML(prop.tipo)}</span>
                <img src="${escapeHTML(prop.imagen_url)}" alt="${escapeHTML(prop.titulo)}">
            </div>
            <div class="card-body">
                <h3>${escapeHTML(prop.titulo)}</h3>
                <p class="card-price">${formatoPrecio.format(prop.precio)}</p>
                <p class="card-meta">${escapeHTML(prop.tipo)} · ${prop.habitaciones} hab.</p>
                <p class="card-desc">${escapeHTML(prop.descripcion)}</p>
                <p class="card-ver">Toca para ver más detalles</p>
                <a class="btn-wa" target="_blank" href="${urlWhatsApp(prop)}">
                    Consultar por WhatsApp
                </a>
            </div>
        `;
        grid.appendChild(card);
    });
}

document.getElementById('propertyGrid').addEventListener('click', (e) => {
    if (e.target.closest('.btn-wa')) return;
    const card = e.target.closest('.card');
    if (!card) return;
    const prop = propiedades.find(p => String(p.id) === card.dataset.id);
    if (prop) abrirDetalle(prop);
});

// ==========================================
// 2. VENTANA DE DETALLE
// ==========================================
function abrirDetalle(prop) {
    const modal = document.getElementById('modal');

    document.getElementById('modalFoto').src = prop.imagen_url;
    document.getElementById('modalFoto').alt = prop.titulo;
    document.getElementById('modalTipo').textContent = prop.tipo;
    document.getElementById('modalTitulo').textContent = prop.titulo;
    document.getElementById('modalPrecio').textContent = formatoPrecio.format(prop.precio);
    document.getElementById('modalTipoDato').textContent = prop.tipo;
    document.getElementById('modalHab').textContent = prop.habitaciones > 0 ? prop.habitaciones : '—';
    document.getElementById('modalFecha').textContent = prop.created_at
        ? formatoFecha.format(new Date(prop.created_at))
        : '—';
    document.getElementById('modalDesc').textContent = prop.descripcion || 'Sin descripción.';
    document.getElementById('modalWa').href = urlWhatsApp(prop);

    modal.classList.add('abierto');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-abierto');

    const mapaBox = document.getElementById('modalMapaBox');
    if (prop.latitud != null && prop.longitud != null) {
        mapaBox.hidden = false;
        mostrarMapa(prop);
    } else {
        mapaBox.hidden = true;
    }
}

function mostrarMapa(prop) {
    if (mapaDetalle) {
        mapaDetalle.remove();
        mapaDetalle = null;
    }

    const contenedor = document.getElementById('modalMapa');

    if (typeof L === 'undefined') {
        contenedor.innerHTML = '<p class="mapa-error">No se pudo cargar el mapa. Revisa tu conexión a internet.</p>';
        return;
    }
    contenedor.innerHTML = '';

    const pos = [prop.latitud, prop.longitud];
    const capas = crearCapasMapa();

    mapaDetalle = L.map('modalMapa', {
        center: pos,
        zoom: 16,
        scrollWheelZoom: false,
        layers: [capas['Mapa']]
    });

    L.control.layers(capas, null, { position: 'topright' }).addTo(mapaDetalle);
    L.marker(pos).addTo(mapaDetalle).bindPopup(escapeHTML(prop.titulo));

    // Recalcula el tamaño ahora que la ventana ya está visible
    setTimeout(() => mapaDetalle && mapaDetalle.invalidateSize(), 150);
}

function cerrarDetalle() {
    const modal = document.getElementById('modal');
    modal.classList.remove('abierto');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-abierto');

    if (mapaDetalle) {
        mapaDetalle.remove();
        mapaDetalle = null;
    }
}

document.getElementById('modalCerrar').addEventListener('click', cerrarDetalle);
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') cerrarDetalle();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarDetalle();
});

cargarCatalogo();