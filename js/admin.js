// ==========================================
// CONFIGURACIÓN DE SUPABASE
// ==========================================
const SUPABASE_URL = 'https://lxlnauxfhljbfnbhinnh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fI8UXfrnZx0iQm__dCBzvg_nxDY05TO';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = 'propiedades';

const formatoPrecio = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
});

function escapeHTML(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// ==========================================
// 1. AUTENTICACIÓN (el panel solo se muestra con sesión)
// ==========================================
async function checkAuth() {
    const { data: { session } } = await sb.auth.getSession();
    const currentPage = window.location.pathname;

    if (currentPage.includes('admin.html')) {
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        document.body.classList.remove('admin-oculto');
        cargarCatalogoAdmin();
    }

    if (currentPage.includes('login.html') && session) {
        window.location.href = 'admin.html';
    }
}
checkAuth();

const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const { error } = await sb.auth.signInWithPassword({ email, password });

        if (error) {
            document.getElementById('errorMsg').innerText = "Credenciales incorrectas.";
        } else {
            window.location.href = 'admin.html';
        }
    });
}

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
        await sb.auth.signOut();
        window.location.href = 'login.html';
    });
}

// ==========================================
// 2. MAPA: capas (mapa, satélite, terreno)
// ==========================================
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

let map = null;
let marker = null;

const inputLat = document.getElementById('latitud');
const inputLng = document.getElementById('longitud');

function guardarCoordenadas(lat, lng) {
    inputLat.value = lat;
    inputLng.value = lng;
}

function colocarMarcador(lat, lng, centrar = false) {
    const pos = [lat, lng];

    if (marker) {
        marker.setLatLng(pos);
    } else {
        marker = L.marker(pos, { draggable: true }).addTo(map);
        marker.on('dragend', () => {
            const p = marker.getLatLng();
            guardarCoordenadas(p.lat, p.lng);
        });
    }

    guardarCoordenadas(lat, lng);

    if (centrar) {
        map.setView(pos, Math.max(map.getZoom(), 17));
    }
}

function initMap() {
    const contenedor = document.getElementById('map');
    if (!contenedor) return;

    if (typeof L === 'undefined') {
        contenedor.innerHTML = '<p class="mapa-error">No se pudo cargar el mapa. Revisa tu conexión a internet y recarga la página con Ctrl + F5.</p>';
        return;
    }

    const capas = crearCapasMapa();

    map = L.map('map', {
        center: [13.6391, -89.8166], // Sonsonate / Metalio
        zoom: 12,
        layers: [capas['Mapa']]
    });

    L.control.layers(capas, null, { position: 'topright' }).addTo(map);

    map.on('click', (e) => {
        colocarMarcador(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => map.invalidateSize(), 300);
}
initMap();

// ==========================================
// 3. BUSCADOR DE LUGARES (OpenStreetMap, solo El Salvador)
// ==========================================
const inputBuscar = document.getElementById('buscarLugar');
const listaResultados = document.getElementById('resultados');

function mostrarInfo(texto) {
    listaResultados.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'res-info';
    li.textContent = texto;
    listaResultados.appendChild(li);
}

async function buscarLugar() {
    const texto = inputBuscar.value.trim();
    if (!texto || !map) return;

    // Si escribes coordenadas, ej: 13.6391, -89.8166, va directo
    const coords = texto.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coords) {
        colocarMarcador(parseFloat(coords[1]), parseFloat(coords[2]), true);
        listaResultados.innerHTML = '';
        return;
    }

    mostrarInfo('Buscando...');

    try {
        const url = 'https://nominatim.openstreetmap.org/search'
            + '?format=json&limit=5&countrycodes=sv&accept-language=es'
            + '&q=' + encodeURIComponent(texto);

        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error('HTTP ' + respuesta.status);

        const lugares = await respuesta.json();

        if (lugares.length === 0) {
            mostrarInfo('No se encontró ese lugar. Prueba con otro nombre o con coordenadas.');
            return;
        }

        listaResultados.innerHTML = '';
        lugares.forEach(lugar => {
            const li = document.createElement('li');
            li.textContent = lugar.display_name;
            li.addEventListener('click', () => {
                colocarMarcador(parseFloat(lugar.lat), parseFloat(lugar.lon), true);
                listaResultados.innerHTML = '';
            });
            listaResultados.appendChild(li);
        });
    } catch (err) {
        console.error('Error en búsqueda:', err);
        mostrarInfo('Error al buscar. Revisa tu conexión e inténtalo de nuevo.');
    }
}

document.getElementById('btnBuscar').addEventListener('click', buscarLugar);

// Enter busca en vez de enviar el formulario
inputBuscar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        buscarLugar();
    }
});

// ==========================================
// 4. FOTOS: reducir y subir a Supabase Storage
// ==========================================
function reducirImagen(archivo, maxLado = 1600) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(archivo);
        const img = new Image();

        img.onload = () => {
            const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(url);
                if (blob) resolve(blob);
                else reject(new Error('No se pudo procesar la imagen.'));
            }, 'image/jpeg', 0.85);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('El archivo no es una imagen válida.'));
        };
        img.src = url;
    });
}

async function subirImagen(archivo) {
    const blob = await reducirImagen(archivo);
    const ruta = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

    const { error } = await sb.storage.from(BUCKET).upload(ruta, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600'
    });
    if (error) throw error;

    const { data } = sb.storage.from(BUCKET).getPublicUrl(ruta);
    return { url: data.publicUrl, ruta };
}

function rutaDesdeUrl(url) {
    const partes = String(url).split(`/${BUCKET}/`);
    return partes.length > 1 ? decodeURIComponent(partes[1]) : null;
}

// ==========================================
// 5. FORMULARIO: publicar propiedad
// ==========================================
const addPropertyForm = document.getElementById('addPropertyForm');
const inputImagen = document.getElementById('imagen');
const preview = document.getElementById('preview');

if (inputImagen) {
    inputImagen.addEventListener('change', () => {
        const archivo = inputImagen.files[0];
        if (archivo) {
            preview.src = URL.createObjectURL(archivo);
            preview.hidden = false;
        } else {
            preview.hidden = true;
        }
    });
}

function limpiarMapa() {
    if (marker) {
        marker.remove();
        marker = null;
    }
    guardarCoordenadas('', '');
    listaResultados.innerHTML = '';
    inputBuscar.value = '';
}

if (addPropertyForm) {
    addPropertyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const archivo = inputImagen.files[0];
        const btn = document.getElementById('btnPublicar');

        if (!archivo) {
            alert("Selecciona una foto de la propiedad.");
            return;
        }
        if (!inputLat.value || !inputLng.value) {
            alert("Marca la ubicación en el mapa antes de publicar.");
            return;
        }

        btn.disabled = true;
        btn.textContent = 'Publicando...';

        let imagenSubida = null;
        try {
            imagenSubida = await subirImagen(archivo);

            const nuevaPropiedad = {
                titulo: document.getElementById('titulo').value,
                precio: parseFloat(document.getElementById('precio').value),
                tipo: document.getElementById('tipo').value,
                habitaciones: parseInt(document.getElementById('habitaciones').value),
                imagen_url: imagenSubida.url,
                descripcion: document.getElementById('descripcion').value,
                latitud: parseFloat(inputLat.value),
                longitud: parseFloat(inputLng.value)
            };

            const { error } = await sb.from('propiedades').insert([nuevaPropiedad]);
            if (error) throw error;

            alert("¡Propiedad publicada con éxito! Ya es visible para los clientes.");

            addPropertyForm.reset();
            preview.hidden = true;
            preview.removeAttribute('src');
            limpiarMapa();

            await cargarCatalogoAdmin();
        } catch (err) {
            if (imagenSubida) {
                await sb.storage.from(BUCKET).remove([imagenSubida.ruta]);
            }
            alert("Error al guardar: " + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Publicar en Catálogo';
        }
    });
}

// ==========================================
// 6. CATÁLOGO EN EL ADMIN
// ==========================================
async function cargarCatalogoAdmin() {
    const grid = document.getElementById('adminGrid');
    if (!grid) return;

    const { data: propiedades, error } = await sb
        .from('propiedades')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error al cargar:", error);
        grid.innerHTML = '<p class="empty-msg">Error cargando propiedades.</p>';
        return;
    }

    if (!propiedades || propiedades.length === 0) {
        grid.innerHTML = '<p class="empty-msg">Aún no hay propiedades publicadas.</p>';
        return;
    }

    grid.innerHTML = '';

    propiedades.forEach(prop => {
        const card = document.createElement('article');
        card.className = 'card';
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
                <button class="btn-delete" data-id="${escapeHTML(prop.id)}" data-img="${escapeHTML(prop.imagen_url)}">
                    Eliminar
                </button>
            </div>
        `;
        grid.appendChild(card);
    });
}

const adminGrid = document.getElementById('adminGrid');
if (adminGrid) {
    adminGrid.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-delete');
        if (!btn) return;

        if (!confirm("¿Eliminar esta propiedad? Esta acción no se puede deshacer.")) return;

        btn.disabled = true;

        const { error } = await sb.from('propiedades').delete().eq('id', btn.dataset.id);
        if (error) {
            alert("Error al eliminar: " + error.message);
            btn.disabled = false;
            return;
        }

        const ruta = rutaDesdeUrl(btn.dataset.img);
        if (ruta) {
            await sb.storage.from(BUCKET).remove([ruta]);
        }

        await cargarCatalogoAdmin();
    });
}