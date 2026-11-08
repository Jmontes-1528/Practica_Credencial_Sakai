/**
 * Generador de Código de Barras (Code 128) y Código QR dinámicos
 * Implementación nativa en JavaScript sin dependencias externas.
 */

// Patrones Code 128 (Subset B)
// Cada elemento representa el grosor alternado de barras y espacios (1 a 4 módulos)
const CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

/**
 * Genera la estructura vectorial de barras para Code 128
 * @param {string} text Cadena a codificar (RFC o identificador)
 * @returns {{ totalWidth: number, bars: Array<{ x: number, width: number }> }}
 */
export function generateBarcode128(text) {
    const raw = (text || 'UNACH2026').trim().toUpperCase();
    // Validar rango ASCII de 32 a 126
    const clean = raw.split('').filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126).join('') || 'UNACH';

    const codes = [104]; // Código de inicio B (Start B)
    let checksum = 104;

    for (let i = 0; i < clean.length; i++) {
        const val = clean.charCodeAt(i) - 32;
        codes.push(val);
        checksum += val * (i + 1);
    }

    codes.push(checksum % 103);
    codes.push(106); // Stop

    const bars = [];
    let currentX = 0;

    for (const c of codes) {
        const pattern = CODE128_PATTERNS[c] || '212222';
        for (let j = 0; j < pattern.length; j++) {
            const width = parseInt(pattern[j], 10);
            if (j % 2 === 0) {
                // Barra negra
                bars.push({ x: currentX, width });
            }
            currentX += width;
        }
    }

    return {
        totalWidth: currentX,
        bars
    };
}

/**
 * Generador de Matriz de Código QR (Versión simplificada estándar)
 * @param {string} text Contenido a codificar en el QR
 * @returns {{ size: number, modules: boolean[][] }}
 */
export function generateQRMatrix(text) {
    const str = (text || 'UNACH').trim();
    const size = 25; // Matriz 25x25 (QR Versión 2)
    const modules = Array(size).fill(false).map(() => Array(size).fill(false));
    const isFunction = Array(size).fill(false).map(() => Array(size).fill(false));

    // Función para dibujar un patrón de búsqueda (Finder Pattern) 7x7
    function drawFinder(r0, c0) {
        for (let r = 0; r < 7; r++) {
            for (let c = 0; c < 7; c++) {
                const isBorder = (r === 0 || r === 6 || c === 0 || c === 6);
                const isCenter = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                modules[r0 + r][c0 + c] = (isBorder || isCenter);
                isFunction[r0 + r][c0 + c] = true;
            }
        }
        // Separador blanco
        for (let r = -1; r <= 7; r++) {
            for (let c = -1; c <= 7; c++) {
                const rr = r0 + r;
                const cc = c0 + c;
                if (rr >= 0 && rr < size && cc >= 0 && cc < size && !isFunction[rr][cc]) {
                    modules[rr][cc] = false;
                    isFunction[rr][cc] = true;
                }
            }
        }
    }

    // Dibujar 3 Finder Patterns (Esquinas superior izq, superior der, inferior izq)
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // Patrón de alineación en versión 2 (5x5 en fila 16, columna 16)
    const ar0 = 16;
    const ac0 = 16;
    for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
            const isBorder = (Math.abs(r) === 2 || Math.abs(c) === 2);
            const isCenter = (r === 0 && c === 0);
            modules[ar0 + r][ac0 + c] = (isBorder || isCenter);
            isFunction[ar0 + r][ac0 + c] = true;
        }
    }

    // Patrones de sincronización (Timing Patterns: fila 6 y columna 6)
    for (let i = 8; i < size - 8; i++) {
        modules[6][i] = (i % 2 === 0);
        isFunction[6][i] = true;
        modules[i][6] = (i % 2 === 0);
        isFunction[i][6] = true;
    }

    // Módulo oscuro fijo
    modules[size - 8][8] = true;
    isFunction[size - 8][8] = true;

    // Rellenar datos a partir de hash/bits del texto del usuario
    let bitIndex = 0;
    const bitStream = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        for (let b = 7; b >= 0; b--) {
            bitStream.push((code >> b) & 1);
        }
    }
    // Relleno cíclico
    while (bitStream.length < 400) {
        bitStream.push(bitStream[bitIndex % bitStream.length]);
        bitIndex++;
    }

    let streamIdx = 0;
    for (let c = size - 1; c > 0; c -= 2) {
        if (c === 6) c--; // Saltar columna de temporización
        for (let r = 0; r < size; r++) {
            const actualR = ((c + 1) / 2) % 2 === 0 ? r : (size - 1 - r);
            for (let colOffset = 0; colOffset < 2; colOffset++) {
                const actualC = c - colOffset;
                if (!isFunction[actualR][actualC]) {
                    const bit = bitStream[streamIdx % bitStream.length];
                    // Máscara (fila + columna) % 2 === 0
                    const mask = (actualR + actualC) % 2 === 0;
                    modules[actualR][actualC] = (bit === 1) ? !mask : mask;
                    streamIdx++;
                }
            }
        }
    }

    return {
        size,
        modules
    };
}
