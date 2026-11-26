import { escapeHtml } from './utils.js';

/**
 * ชุดสีโทน Muji สำหรับเส้นกราฟและจุดข้อมูล (เรียบง่าย อบอุ่น แยกความแตกต่างได้ชัดเจน)
 */
export const MUJI_CHART_COLORS = [
    '#8C7A6B', // Warm Taupe (น้ำตาลไม้ Muji)
    '#6B7F75', // Sage Green (เขียวใบไม้หม่น)
    '#A86F5C', // Muted Terracotta (ดินเผาอ่อน)
    '#6E7F91', // Dusty Slate (ฟ้าเทาหม่น)
    '#B59A6B', // Warm Sand (ทรายอุ่น)
    '#7E6B7B'  // Ash Plum (ม่วงเทาหม่น)
];

/**
 * คำนวณระยะห่างแกนตัวเลขให้อ่านง่ายคล้าย Excel / Microsoft Word
 * @param {number} range
 * @param {number} targetTicks
 * @returns {number}
 */
function niceStep(range, targetTicks = 6) {
    if (!Number.isFinite(range) || range <= 0) return 1;
    const rough = range / targetTicks;
    const pow10 = Math.pow(10, Math.floor(Math.log10(rough)));
    const fraction = rough / pow10;
    let niceFraction;
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 2.5) niceFraction = 2.5;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
    return niceFraction * pow10;
}

/**
 * จัดรูปแบบตัวเลขบนแกนกราฟ (ใส่ลูกน้ำหลักพันและตัดทศนิยมส่วนเกิน)
 * @param {number} num
 * @returns {string}
 */
function formatAxisNumber(num) {
    if (!Number.isFinite(num)) return '0';
    const rounded = Math.abs(num) < 1e-9 ? 0 : Number(num.toPrecision(10));
    return rounded.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * สร้าง SVG Path เส้นโค้งเรียบแบบ Monotone Cubic Spline (คล้ายเส้นเรียบใน Excel/Word ไม่ดีดเกินจุด)
 * @param {{ px: number, py: number }[]} pts
 * @returns {string}
 */
function buildSmoothPath(pts) {
    if (pts.length === 0) return '';
    if (pts.length === 1) return '';
    if (pts.length === 2) {
        return `M ${pts[0].px.toFixed(2)} ${pts[0].py.toFixed(2)} L ${pts[1].px.toFixed(2)} ${pts[1].py.toFixed(2)}`;
    }

    const n = pts.length;
    const dx = [];
    const dy = [];
    const slopes = [];

    for (let i = 0; i < n - 1; i += 1) {
        const dxi = pts[i + 1].px - pts[i].px;
        const dyi = pts[i + 1].py - pts[i].py;
        dx.push(dxi);
        dy.push(dyi);
        slopes.push(Math.abs(dxi) < 1e-6 ? 0 : dyi / dxi);
    }

    const tangents = new Array(n).fill(0);
    tangents[0] = slopes[0];
    tangents[n - 1] = slopes[n - 2];

    for (let i = 1; i < n - 1; i += 1) {
        if (slopes[i - 1] * slopes[i] <= 0) {
            tangents[i] = 0;
        } else {
            tangents[i] = (slopes[i - 1] + slopes[i]) / 2;
        }
    }

    // Fritsch-Carlson clamping เพื่อไม่ให้เส้นโค้งแกว่งเกินค่าจริง
    for (let i = 0; i < n - 1; i += 1) {
        if (Math.abs(slopes[i]) < 1e-9) {
            tangents[i] = 0;
            tangents[i + 1] = 0;
        } else {
            const a = tangents[i] / slopes[i];
            const b = tangents[i + 1] / slopes[i];
            const sumSq = a * a + b * b;
            if (sumSq > 9) {
                const tau = 3 / Math.sqrt(sumSq);
                tangents[i] = tau * a * slopes[i];
                tangents[i + 1] = tau * b * slopes[i];
            }
        }
    }

    let d = `M ${pts[0].px.toFixed(2)} ${pts[0].py.toFixed(2)}`;
    for (let i = 0; i < n - 1; i += 1) {
        const segX = dx[i] / 3;
        const cp1x = pts[i].px + segX;
        const cp1y = pts[i].py + tangents[i] * segX;
        const cp2x = pts[i + 1].px - segX;
        const cp2y = pts[i + 1].py - tangents[i + 1] * segX;
        d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${pts[i + 1].px.toFixed(2)} ${pts[i + 1].py.toFixed(2)}`;
    }
    return d;
}

/**
 * แปลงข้อมูลกราฟจากฟอร์มเป็นชุดข้อมูลจุด (x, y) ที่พร้อมวาด
 * @param {object} chartData
 */
function extractSeriesPoints(chartData) {
    if (!chartData || !Array.isArray(chartData.rows) || !Array.isArray(chartData.seriesNames)) {
        return [];
    }

    return chartData.seriesNames.map((name, sIdx) => {
        const points = [];
        chartData.rows.forEach((row) => {
            if (!row) return;
            const rawX = row.x;
            const rawY = Array.isArray(row.values) ? row.values[sIdx] : '';
            if (rawX === '' || rawX === null || rawX === undefined) return;
            if (rawY === '' || rawY === null || rawY === undefined) return;

            const x = Number(rawX);
            const y = Number(rawY);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                points.push({ x, y });
            }
        });

        // เรียงตามแกน X จากน้อยไปมากเพื่อให้เส้นเรียบต่อเนื่องถูกต้อง
        points.sort((a, b) => a.x - b.x);

        return {
            name: (name || `ชุดข้อมูล ${sIdx + 1}`).trim(),
            color: MUJI_CHART_COLORS[sIdx % MUJI_CHART_COLORS.length],
            points
        };
    }).filter((s) => s.points.length > 0);
}

/**
 * ตรวจสอบว่ามีจุดข้อมูลตัวเลขอย่างน้อย 1 จุดสำหรับวาดกราฟหรือไม่
 * @param {object} chartData
 * @returns {boolean}
 */
export function hasValidChartData(chartData) {
    return extractSeriesPoints(chartData).length > 0;
}

/**
 * คำนวณขอบเขตแกนอัตโนมัติ:
 * - หากข้อมูลมีช่วงแคบและอยู่ห่างจาก 0 (เช่น อุณหภูมิ 30.8–34.6 °C) จะซูมเข้าสู่ช่วงข้อมูลจริง
 *   พร้อมเว้นขอบบน-ล่างอย่างเหมาะสม เพื่อให้เห็นแนวโน้มเส้นกราฟชัดเจนไม่แบนเป็นเส้นตรง
 * - หากข้อมูลใกล้ 0 หรือเริ่มจาก 0 อยู่แล้ว จะเริ่มแกนที่ 0 ตามปกติ
 * @param {number[]} values
 * @param {number} targetTicks
 * @param {boolean} isYAxis
 * @returns {{ axisMin: number, axisMax: number, step: number }}
 */
function computeAutoAxisBounds(values, targetTicks, isYAxis = false) {
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin;

    if (span === 0) {
        const margin = rawMin === 0 ? 5 : Math.max(Math.abs(rawMin) * 0.1, 1);
        const step = niceStep(margin * 2, targetTicks);
        const axisMin = Math.floor((rawMin - margin) / step) * step;
        const axisMax = Math.ceil((rawMax + margin) / step) * step;
        return { axisMin, axisMax, step };
    }

    const shouldStartAtZero = rawMin >= 0 && rawMin <= span * 0.5;

    let paddedMin;
    let paddedMax;
    if (shouldStartAtZero) {
        paddedMin = 0;
        paddedMax = isYAxis ? rawMax + span * 0.1 : rawMax;
    } else {
        const padRatio = isYAxis ? 0.15 : 0.05;
        paddedMin = rawMin - span * padRatio;
        if (rawMin >= 0 && paddedMin < 0) paddedMin = 0;
        paddedMax = rawMax + span * padRatio;
    }

    const step = niceStep(paddedMax - paddedMin, targetTicks);
    const axisMin = Math.floor((paddedMin + step * 1e-9) / step) * step;
    let axisMax = Math.ceil((paddedMax - step * 1e-9) / step) * step;
    if (axisMax <= axisMin) axisMax = axisMin + step;

    return { axisMin, axisMax, step };
}

/**
 * วาดกราฟแผนภูมิกระจายที่มีเส้นเรียบและตัวแสดงข้อมูล (Smooth Scatter with Markers) โทนสี Muji เป็น SVG
 * @param {object} chartData
 * @param {{ width?: number, height?: number, fontFamily?: string }} options
 * @returns {string}
 */
export function renderSmoothScatterSvg(
    chartData,
    { width = 660, height = 310, fontFamily = 'inherit' } = {}
) {
    const seriesList = extractSeriesPoints(chartData);
    if (seriesList.length === 0) {
        return '';
    }

    const title = chartData.title?.trim() || '';
    const xLabel = chartData.xLabel?.trim() || 'แกน X';
    const yLabel = chartData.yLabel?.trim() || 'แกน Y';

    const allX = seriesList.flatMap((s) => s.points.map((p) => p.x));
    const allY = seriesList.flatMap((s) => s.points.map((p) => p.y));

    const { axisMin: axisMinX, axisMax: axisMaxX, step: xStep } = computeAutoAxisBounds(allX, 6, false);
    const { axisMin: axisMinY, axisMax: axisMaxY, step: yStep } = computeAutoAxisBounds(allY, 5, true);

    // จัดวาง Legend ด้านบนเหนือพื้นที่กราฟ เพื่อไม่ให้ทับจุดข้อมูลหรือเส้นกราฟ
    const maxItemsPerRow = 3;
    const legendRows = [];
    for (let i = 0; i < seriesList.length; i += maxItemsPerRow) {
        legendRows.push(seriesList.slice(i, i + maxItemsPerRow));
    }

    const titleHeight = title ? 26 : 6;
    const legendRowHeight = 20;
    const legendTotalHeight = legendRows.length * legendRowHeight + 6;
    const padTop = titleHeight + legendTotalHeight + 10;
    const padRight = 24;
    const padBottom = 50;
    const padLeft = 66;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const mapX = (x) => padLeft + ((x - axisMinX) / (axisMaxX - axisMinX)) * plotW;
    const mapY = (y) => padTop + plotH - ((y - axisMinY) / (axisMaxY - axisMinY)) * plotH;

    // สร้างเส้นกริดและตัวเลขแกน X
    const xTicks = [];
    for (let v = axisMinX; v <= axisMaxX + xStep * 0.001; v += xStep) {
        xTicks.push(Number(v.toPrecision(10)));
    }
    const yTicks = [];
    for (let v = axisMinY; v <= axisMaxY + yStep * 0.001; v += yStep) {
        yTicks.push(Number(v.toPrecision(10)));
    }

    const gridLinesSvg = [
        ...xTicks.map((v) => {
            const x = mapX(v);
            return `
                <line x1="${x.toFixed(2)}" y1="${padTop}" x2="${x.toFixed(2)}" y2="${padTop + plotH}" stroke="#E5E1D8" stroke-width="1" />
                <text x="${x.toFixed(2)}" y="${padTop + plotH + 18}" text-anchor="middle" fill="#6B6760" font-size="11.5">${escapeHtml(formatAxisNumber(v))}</text>
            `;
        }),
        ...yTicks.map((v) => {
            const y = mapY(v);
            return `
                <line x1="${padLeft}" y1="${y.toFixed(2)}" x2="${padLeft + plotW}" y2="${y.toFixed(2)}" stroke="#E5E1D8" stroke-width="1" />
                <text x="${padLeft - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end" fill="#6B6760" font-size="11.5">${escapeHtml(formatAxisNumber(v))}</text>
            `;
        })
    ].join('');

    // เส้นแกนหลัก (ซ้ายและล่าง)
    const axesSvg = `
        <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + plotH}" stroke="#C7C1B6" stroke-width="1.2" />
        <line x1="${padLeft}" y1="${padTop + plotH}" x2="${padLeft + plotW}" y2="${padTop + plotH}" stroke="#C7C1B6" stroke-width="1.2" />
    `;

    // วาดเส้นโค้งเรียบ + จุดข้อมูล (Smooth Scatter with Markers)
    const seriesSvg = seriesList
        .map((series) => {
            const plotted = series.points.map((p) => ({ px: mapX(p.x), py: mapY(p.y) }));
            const pathD = buildSmoothPath(plotted);
            const pathEl = pathD
                ? `<path d="${pathD}" fill="none" stroke="${series.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />`
                : '';
            const dotsEl = plotted
                .map(
                    (pt) =>
                        `<circle cx="${pt.px.toFixed(2)}" cy="${pt.py.toFixed(2)}" r="4.2" fill="${series.color}" stroke="#FFFFFF" stroke-width="1.2" />`
                )
                .join('');
            return `<g>${pathEl}${dotsEl}</g>`;
        })
        .join('');

    // Legend จัดกึ่งกลางด้านบนเหนือกรอบกราฟ ไม่บังข้อมูล
    const legendSvg = legendRows
        .map((rowItems, rIdx) => {
            const cy = titleHeight + 14 + rIdx * legendRowHeight;
            const itemWidths = rowItems.map((s) => Math.max(90, s.name.length * 6.8 + 38));
            const totalW = itemWidths.reduce((sum, w) => sum + w, 0) + (rowItems.length - 1) * 14;
            let cursorX = Math.max(padLeft, (width - totalW) / 2);

            return rowItems
                .map((s, i) => {
                    const startX = cursorX;
                    cursorX += itemWidths[i] + 14;
                    return `
                        <line x1="${startX.toFixed(1)}" y1="${cy}" x2="${(startX + 18).toFixed(1)}" y2="${cy}" stroke="${s.color}" stroke-width="2.2" />
                        <circle cx="${(startX + 9).toFixed(1)}" cy="${cy}" r="3.6" fill="${s.color}" />
                        <text x="${(startX + 24).toFixed(1)}" y="${cy + 4}" fill="#4A4A4A" font-size="11.5">${escapeHtml(s.name)}</text>
                    `;
                })
                .join('');
        })
        .join('');

    const titleSvg = title
        ? `<text x="${width / 2}" y="20" text-anchor="middle" fill="#2C2C2C" font-size="13.5" font-weight="600">${escapeHtml(title)}</text>`
        : '';

    const axisTitlesSvg = `
        <text x="${padLeft + plotW / 2}" y="${height - 10}" text-anchor="middle" fill="#55524C" font-size="12.5" font-weight="500">${escapeHtml(xLabel)}</text>
        <text x="18" y="${padTop + plotH / 2}" text-anchor="middle" fill="#55524C" font-size="12.5" font-weight="500" transform="rotate(-90 18 ${padTop + plotH / 2})">${escapeHtml(yLabel)}</text>
    `;

    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" class="muji-chart-svg" style="font-family: ${escapeHtml(fontFamily)};" role="img" aria-label="${escapeHtml(title || 'กราฟผลการทดลอง')}">
            <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" rx="4" fill="#FFFFFF" stroke="#E5E1D8" stroke-width="1" />
            ${titleSvg}
            <g>${legendSvg}</g>
            ${gridLinesSvg}
            ${axesSvg}
            ${seriesSvg}
            ${axisTitlesSvg}
        </svg>
    `;
}
