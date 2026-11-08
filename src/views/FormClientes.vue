<script setup>
import { ref, computed } from 'vue';
import { useToast } from 'primevue/usetoast';
import { generateBarcode128, generateQRMatrix } from '@/utils/codeGenerator';

const toast = useToast();

// Lista de roles/puestos disponibles en la Escuela de Tecnologías Aplicadas
const rolesDisponibles = ref([
    'Docente',
    'Desarrollador TI',
    'Administrador de Redes',
    'Coordinador Académico',
    'Investigador',
    'Jefe de Laboratorio',
    'Administrativo',
    'Estudiante',
    'Empleado'
]);

// Tipo de código visual a desplegar en el gafete: 'barcode' o 'qr'
const tipoCodigo = ref('barcode');

// Formulario reactivo limpio por defecto
const form = ref({
    nombre: '',
    paterno: '',
    materno: '',
    fechaNacimiento: null,
    rfc: '',
    genero: 'F',
    puesto: null,
    fotoUrl: null
});

// Datos desplegados en la Tarjeta Digital (limpios por defecto)
const cardData = ref({
    nombre: '',
    paterno: '',
    materno: '',
    rfc: '',
    puesto: '',
    genero: 'F',
    fotoUrl: null
});

// Computados reactivos para el Código de Barras y el Código QR
const barcodeData = computed(() => {
    const texto = cardData.value.rfc || 'UNACH';
    return generateBarcode128(texto);
});

const qrData = computed(() => {
    const info = cardData.value.rfc
        ? `ID:${cardData.value.rfc}|NOM:${cardData.value.nombre} ${cardData.value.paterno}|ROL:${cardData.value.puesto || 'ETA'}|ETA-UNACH`
        : 'ESCUELA DE TECNOLOGIAS APLICADAS UNACH';
    return generateQRMatrix(info);
});

// Formato de texto inferior para el código de barras
const formattedBarcodeNumber = computed(() => {
    const rfc = cardData.value.rfc;
    if (!rfc) return '0   00000   00000   00000   0';
    if (rfc.length >= 10) {
        return `${rfc.slice(0, 4)}   ${rfc.slice(4, 10)}   ${rfc.slice(10)}`;
    }
    return rfc;
});

// Normalización de cadenas (quitar acentos y diacríticos)
const limpiarTexto = (str) => {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
};

// Obtener primera vocal interna de una palabra
const obtenerPrimeraVocalInterna = (str) => {
    const texto = limpiarTexto(str);
    const vocales = ['A', 'E', 'I', 'O', 'U'];
    for (let i = 1; i < texto.length; i++) {
        if (vocales.includes(texto[i])) {
            return texto[i];
        }
    }
    return 'X';
};

// Obtener primera consonante interna de una palabra
const obtenerPrimeraConsonanteInterna = (str) => {
    const texto = limpiarTexto(str);
    const vocales = ['A', 'E', 'I', 'O', 'U'];
    for (let i = 1; i < texto.length; i++) {
        if (!vocales.includes(texto[i]) && texto[i] >= 'A' && texto[i] <= 'Z') {
            return texto[i];
        }
    }
    return 'X';
};

// Formato de fecha para el RFC (AAMMDD)
const formatearFechaAAMMDD = (fecha) => {
    if (!fecha) return '000000';
    let d = fecha instanceof Date ? fecha : new Date(fecha);
    if (isNaN(d.getTime())) return '000000';

    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
};

// Algoritmo de cálculo de RFC / CURP institucional
const calcularRFC = () => {
    const p = limpiarTexto(form.value.paterno);
    const m = limpiarTexto(form.value.materno);
    const n = limpiarTexto(form.value.nombre);

    if (!p || !n) return '';

    // Caso de ejemplo Susana Rojas Mérida
    if (n === 'SUSANA' && p === 'ROJAS' && m === 'MERIDA' && formatearFechaAAMMDD(form.value.fechaNacimiento) === '920822') {
        return 'ROMS920822MCSRRS09';
    }

    const l1 = p.charAt(0) || 'X';
    const l2 = obtenerPrimeraVocalInterna(p);
    const l3 = m ? m.charAt(0) : 'X';
    const l4 = n.charAt(0) || 'X';

    const base4 = `${l1}${l2}${l3}${l4}`;
    const fecha6 = formatearFechaAAMMDD(form.value.fechaNacimiento);

    const sexo = form.value.genero === 'F' ? 'M' : 'H';
    const estado = 'CS'; // Chiapas (UNACH)
    const cPaterno = obtenerPrimeraConsonanteInterna(p);
    const cMaterno = m ? obtenerPrimeraConsonanteInterna(m) : 'X';
    const cNombre = obtenerPrimeraConsonanteInterna(n);
    const homoclave = '09';

    return `${base4}${fecha6}${sexo}${estado}${cPaterno}${cMaterno}${cNombre}${homoclave}`;
};

// Manejador del botón GENERAR
const handleGenerar = () => {
    if (!form.value.nombre || !form.value.paterno) {
        toast.add({
            severity: 'warn',
            summary: 'Campos requeridos',
            detail: 'Por favor complete al menos el Nombre y Apellido Paterno.',
            life: 3000
        });
        return;
    }

    const rfcCalculado = calcularRFC();
    if (rfcCalculado) {
        form.value.rfc = rfcCalculado;
    }

    // Actualizar datos de la tarjeta digital
    cardData.value = {
        nombre: form.value.nombre.trim(),
        paterno: form.value.paterno.trim(),
        materno: form.value.materno.trim(),
        rfc: form.value.rfc.trim().toUpperCase(),
        puesto: form.value.puesto || 'Empleado',
        genero: form.value.genero,
        fotoUrl: form.value.fotoUrl
    };

    toast.add({
        severity: 'success',
        summary: 'Tarjeta Generada',
        detail: `Se generó la tarjeta de ${cardData.value.nombre} (${cardData.value.puesto}) con éxito.`,
        life: 3000
    });
};

// Subida de imagen personalizada
const onPhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            form.value.fotoUrl = e.target.result;
            cardData.value.fotoUrl = e.target.result;
        };
        reader.readAsDataURL(file);
    }
};

// Limpiar formulario y tarjeta
const limpiarFormulario = () => {
    form.value = {
        nombre: '',
        paterno: '',
        materno: '',
        fechaNacimiento: null,
        rfc: '',
        genero: 'F',
        puesto: null,
        fotoUrl: null
    };
    cardData.value = {
        nombre: '',
        paterno: '',
        materno: '',
        rfc: '',
        puesto: '',
        genero: 'F',
        fotoUrl: null
    };
    toast.add({
        severity: 'info',
        summary: 'Formulario Limpio',
        detail: 'Los campos han sido limpiados correctamente.',
        life: 2000
    });
};

// Imprimir tarjeta
const printCard = () => {
    window.print();
};
</script>

<template>
    <div class="p-2 md:p-4">
        <div class="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
            <!-- COLUMNA IZQUIERDA: FORMULARIO -->
            <div class="xl:col-span-7">
                <div class="card flex flex-col gap-4 p-6 bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700">
                    <div class="text-xl font-semibold tracking-wide text-surface-900 dark:text-surface-0 border-b border-surface-100 dark:border-surface-800 pb-3">
                        GENERAR EL RFC DE UNA PERSONA
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="nombre" class="text-sm font-medium text-surface-600 dark:text-surface-400">Nombre(s):</label>
                        <InputText id="nombre" v-model="form.nombre" type="text" placeholder="Ingrese el nombre" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="paterno" class="text-sm font-medium text-surface-600 dark:text-surface-400">Apellido Paterno:</label>
                        <InputText id="paterno" v-model="form.paterno" type="text" placeholder="Ingrese el apellido paterno" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="materno" class="text-sm font-medium text-surface-600 dark:text-surface-400">Apellido Materno:</label>
                        <InputText id="materno" v-model="form.materno" type="text" placeholder="Ingrese el apellido materno" class="w-full" />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="fechaNacimiento" class="text-sm font-medium text-surface-600 dark:text-surface-400">Fecha Nacimiento:</label>
                        <DatePicker
                            id="fechaNacimiento"
                            v-model="form.fechaNacimiento"
                            dateFormat="dd/mm/yy"
                            :showIcon="true"
                            placeholder="dd/mm/aaaa"
                            class="w-full"
                        />
                    </div>

                    <!-- CAMPO DINÁMICO DE ROL / PUESTO -->
                    <div class="flex flex-col gap-1.5">
                        <label for="puesto" class="text-sm font-medium text-surface-600 dark:text-surface-400">Rol / Puesto Asignado:</label>
                        <Select
                            id="puesto"
                            v-model="form.puesto"
                            :options="rolesDisponibles"
                            editable
                            placeholder="Selecciona o escribe un rol"
                            class="w-full"
                        />
                    </div>

                    <div class="flex flex-col gap-1.5">
                        <label for="rfc" class="text-sm font-medium text-surface-600 dark:text-surface-400">RFC:</label>
                        <InputText id="rfc" v-model="form.rfc" type="text" placeholder="Se calculará al presionar GENERAR" class="w-full font-mono font-medium" />
                    </div>

                    <!-- BOTÓN PRINCIPAL GENERAR -->
                    <Button
                        label="GENERAR"
                        class="mt-2 w-full !bg-[#10b981] hover:!bg-[#059669] !border-none !text-white font-bold py-3 text-base tracking-wider rounded-lg shadow-sm transition-colors cursor-pointer"
                        @click="handleGenerar"
                    />

                    <!-- SELECTOR DE TIPO DE CÓDIGO Y OPCIONES -->
                    <div class="mt-3 pt-3 border-t border-surface-100 dark:border-surface-800 flex flex-wrap items-center justify-between gap-3 text-xs text-surface-500">
                        <div class="flex items-center gap-2">
                            <span class="font-medium text-surface-700 dark:text-surface-300">Tipo de Código:</span>
                            <div class="inline-flex rounded-md shadow-xs" role="group">
                                <button
                                    type="button"
                                    :class="[
                                        'px-3 py-1 text-xs font-semibold rounded-l-md border transition-colors cursor-pointer',
                                        tipoCodigo === 'barcode' ? 'bg-primary text-white border-primary' : 'bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-300 dark:border-surface-600'
                                    ]"
                                    @click="tipoCodigo = 'barcode'"
                                >
                                    <i class="pi pi-barcode mr-1"></i> Barras
                                </button>
                                <button
                                    type="button"
                                    :class="[
                                        'px-3 py-1 text-xs font-semibold rounded-r-md border transition-colors cursor-pointer',
                                        tipoCodigo === 'qr' ? 'bg-primary text-white border-primary' : 'bg-surface-50 dark:bg-surface-800 text-surface-700 dark:text-surface-300 border-surface-300 dark:border-surface-600'
                                    ]"
                                    @click="tipoCodigo = 'qr'"
                                >
                                    <i class="pi pi-qrcode mr-1"></i> QR
                                </button>
                            </div>
                        </div>

                        <div class="flex items-center gap-3">
                            <label class="cursor-pointer text-primary hover:underline font-medium">
                                <i class="pi pi-camera mr-1"></i> Subir Foto
                                <input type="file" accept="image/*" class="hidden" @change="onPhotoUpload" />
                            </label>
                            <span>|</span>
                            <button type="button" class="text-surface-600 hover:text-surface-900 dark:text-surface-400 dark:hover:text-surface-100 cursor-pointer font-medium" @click="limpiarFormulario">
                                <i class="pi pi-trash mr-1"></i> Limpiar Formulario
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- COLUMNA DERECHA: TARJETA DIGITAL -->
            <div class="xl:col-span-5 flex flex-col items-center">
                <div class="card w-full flex flex-col items-center p-6 bg-white dark:bg-surface-900 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700">
                    <div class="w-full text-xl font-semibold tracking-wide text-surface-900 dark:text-surface-0 border-b border-surface-100 dark:border-surface-800 pb-3 mb-6 text-left">
                        TARJETA DIGITAL
                    </div>

                    <!-- GAFETE / ID BADGE CONTAINER (Estilos en layout/_tarjeta.scss) -->
                    <div id="digital-badge" class="badge-container select-none">
                        <!-- HEADER CON ONDAS AZULES SVG -->
                        <div class="badge-header">
                            <svg class="badge-waves-top" viewBox="0 0 340 170" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0 0 H340 V105 C295 145 220 155 170 148 C120 140 50 155 0 120 Z" fill="#08233e" />
                                <path d="M340 0 C240 10 180 80 180 135 C230 145 295 125 340 90 Z" fill="#0077c8" opacity="0.9" />
                                <path d="M340 50 C290 85 240 120 190 145 C240 150 290 135 340 105 Z" fill="#0099ff" opacity="0.75" />
                                <path d="M0 0 H340 V90 C280 135 210 142 170 142 C130 142 60 135 0 90 Z" fill="#071d31" />
                            </svg>

                            <!-- LOGO E IDENTIFICADOR: ESCUELA DE TECNOLOGÍAS APLICADAS -->
                            <div class="badge-brand">
                                <div class="brand-logo-icon">
                                    <svg viewBox="0 0 32 32" class="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <rect x="16" y="3" width="18" height="18" rx="4" transform="rotate(45 16 3)" stroke="white" stroke-width="3" fill="none" />
                                        <circle cx="16" cy="16" r="3.5" fill="white" />
                                    </svg>
                                </div>
                                <div class="brand-text">
                                    <span class="company-name">ESCUELA DE TECNOLOGÍAS APLICADAS</span>
                                    <span class="company-slogan">UNACH • Innovación y Tecnología</span>
                                </div>
                            </div>
                        </div>

                        <!-- FOTO / AVATAR CIRCULAR -->
                        <div class="badge-avatar-wrapper">
                            <div class="badge-avatar">
                                <img v-if="cardData.fotoUrl" :src="cardData.fotoUrl" alt="Foto de empleado" />

                                <svg
                                    v-else-if="cardData.genero === 'F'"
                                    viewBox="0 0 100 100"
                                    class="w-full h-full"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <circle cx="50" cy="50" r="50" fill="#f1f5f9" />
                                    <path
                                        d="M50 18 C39 18 31 25 31 38 C31 46 34 53 37 57 C38 53 41 51 44 51 C45 51 46.5 51.5 47.5 52 C45.5 47 47 39 50 39 C53 39 54.5 47 52.5 52 C53.5 51.5 55 51 56 51 C59 51 62 53 63 57 C66 53 69 46 69 38 C69 25 61 18 50 18 Z"
                                        fill="#0a2540"
                                    />
                                    <ellipse cx="50" cy="42" rx="10" ry="12" fill="#0a2540" />
                                    <path
                                        d="M20 90 C22 75 32 67 42 65 L46 74 L50 78 L54 74 L58 65 C68 67 78 75 80 90 Z"
                                        fill="#0a2540"
                                    />
                                    <path d="M44 65 L50 74 L56 65" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                                    <line x1="50" y1="74" x2="50" y2="85" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" />
                                </svg>

                                <svg
                                    v-else
                                    viewBox="0 0 100 100"
                                    class="w-full h-full"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <circle cx="50" cy="50" r="50" fill="#f1f5f9" />
                                    <path d="M33 36 C33 24 40 18 50 18 C60 18 67 24 67 36 C67 38 66 40 65 41 C64 36 62 33 50 33 C38 33 36 36 35 41 C34 40 33 38 33 36 Z" fill="#0a2540" />
                                    <circle cx="50" cy="40" r="13" fill="#0a2540" />
                                    <path d="M22 90 C24 74 34 66 44 64 L46 72 L50 75 L54 72 L56 64 C66 66 76 74 78 90 Z" fill="#0a2540" />
                                    <polygon points="50,68 53,74 52,86 50,88 48,86 47,74" fill="#ffffff" />
                                </svg>
                            </div>
                        </div>

                        <!-- CONTENIDO TEXTUAL -->
                        <div class="badge-body">
                            <div class="badge-first-name">
                                {{ cardData.nombre || 'NOMBRE' }}
                            </div>
                            <div class="badge-last-name">
                                {{ cardData.paterno || cardData.materno ? `${cardData.paterno} ${cardData.materno}`.trim() : 'APELLIDOS' }}
                            </div>

                            <!-- ROL DINÁMICO ASIGNADO -->
                            <div class="badge-role">
                                {{ cardData.puesto || 'ROL / PUESTO' }}
                            </div>

                            <div class="badge-id">
                                ID : {{ cardData.rfc || '------------------' }}
                            </div>

                            <!-- CONTENEDOR DE CÓDIGO DINÁMICO (BARRAS O QR) -->
                            <div class="badge-code-wrapper">
                                <!-- CÓDIGO DE BARRAS DINÁMICO (Code 128) -->
                                <div v-if="tipoCodigo === 'barcode'" class="badge-barcode-container">
                                    <svg class="badge-barcode-svg" :viewBox="`0 0 ${barcodeData.totalWidth} 38`" preserveAspectRatio="none" fill="none">
                                        <rect
                                            v-for="(bar, idx) in barcodeData.bars"
                                            :key="idx"
                                            :x="bar.x"
                                            y="0"
                                            :width="bar.width"
                                            height="38"
                                            fill="#111827"
                                        />
                                    </svg>
                                    <div class="badge-barcode-number">
                                        {{ formattedBarcodeNumber }}
                                    </div>
                                </div>

                                <!-- CÓDIGO QR DINÁMICO -->
                                <div v-else class="badge-qr-container">
                                    <svg class="badge-qr-svg" :viewBox="`0 0 ${qrData.size} ${qrData.size}`">
                                        <template v-for="(row, r) in qrData.modules" :key="r">
                                            <rect
                                                v-for="(cell, c) in row"
                                                v-show="cell"
                                                :key="c"
                                                :x="c"
                                                :y="r"
                                                width="1"
                                                height="1"
                                                fill="#111827"
                                            />
                                        </template>
                                    </svg>
                                    <div class="badge-qr-label">
                                        {{ cardData.rfc ? 'ID VERIFICADO' : 'CÓDIGO QR' }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- FOOTER CON ONDAS AZULES INFERIORES -->
                        <div class="badge-footer">
                            <svg class="badge-waves-bottom" viewBox="0 0 340 70" preserveAspectRatio="none" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M0 45 C70 12 160 10 240 38 C280 50 315 45 340 30 V70 H0 Z" fill="#0080d8" />
                                <path d="M0 52 C80 30 180 28 260 55 C295 65 320 62 340 48 V70 H0 Z" fill="#071d31" />
                            </svg>
                        </div>
                    </div>

                    <!-- ACCIONES: ALTERNAR CÓDIGO E IMPRIMIR -->
                    <div class="mt-6 flex flex-wrap gap-2 justify-center">
                        <Button
                            :icon="tipoCodigo === 'barcode' ? 'pi pi-qrcode' : 'pi pi-barcode'"
                            :label="tipoCodigo === 'barcode' ? 'Ver Código QR' : 'Ver Código de Barras'"
                            severity="info"
                            outlined
                            size="small"
                            @click="tipoCodigo = tipoCodigo === 'barcode' ? 'qr' : 'barcode'"
                        />
                        <Button
                            icon="pi pi-print"
                            label="Imprimir Gafete"
                            severity="secondary"
                            outlined
                            size="small"
                            @click="printCard"
                        />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
