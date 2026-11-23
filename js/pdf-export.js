import { escapeHtml, isSafeImageUrl, formatThaiDate, EXPERIMENTER_INFO } from './utils.js';
import { buildPublicLabUrl, renderQRCode } from './qrcode-helper.js';
import { hasValidChartData, renderSmoothScatterSvg } from './chart-helper.js';

/**
 * สร้างโครงหน้ากระดาษ A4 เปล่า 1 แผ่น (พร้อมป้ายเลขหน้าสำหรับพรีวิว)
 * @param {number} pageNumber
 * @returns {{ wrapper: HTMLDivElement, pageEl: HTMLDivElement }}
 */
function createA4PageShell(pageNumber) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page-wrapper';
    wrapper.dataset.page = String(pageNumber);

    const label = document.createElement('p');
    label.className = 'no-print a4-page-label';
    label.textContent = `ขนาดกระดาษ A4 หน้า ${pageNumber}`;

    const scrollWrap = document.createElement('div');
    scrollWrap.className = 'a4-scroll-wrapper';

    const frame = document.createElement('div');
    frame.className = 'a4-sheet-frame';

    const pageEl = document.createElement('div');
    pageEl.className = 'page-a4';

    frame.appendChild(pageEl);
    scrollWrap.appendChild(frame);
    wrapper.append(label, scrollWrap);

    return { wrapper, pageEl };
}

/**
 * สร้างเอกสารขนาด A4 แบบ 2 หน้าชัดเจน:
 * - หน้า 1: หัวข้อ, ข้อมูลผู้ทดลอง/คณะ-สาขา, อาจารย์, ความรับผิดชอบ, QR Code, วัตถุประสงค์, อุปกรณ์, Flowchart, ตารางปัญหา-แนวทาง
 * - หน้า 2: กราฟผลการทดลอง (เหนือสรุปผล), สรุปผล, ภาพประกอบ 1:1 จำนวน 3 ช่องพร้อมคำอธิบายใต้ภาพเฉพาะ PDF
 * @param {object} labData
 * @param {HTMLElement | null} pagesContainer
 * @param {string} labId
 */
export function renderPdfPreview(labData, pagesContainer, labId) {
    if (!pagesContainer) return;
    pagesContainer.innerHTML = '';

    const labDateText = labData.labDate ? formatThaiDate(labData.labDate) : '-';
    const courseText = labData.course?.trim() || '-';
    const title = labData.title?.trim() || 'ไม่ได้ระบุหัวข้อปฏิบัติการ';
    const advisorText = `อาจารย์ที่ปรึกษา: ${labData.advisor?.trim() || '-'}`;
    const responsibilityText = `ความรับผิดชอบ: ${labData.responsibility?.trim() || '-'}`;

    const objectives = Array.isArray(labData.objectives) ? labData.objectives.filter(Boolean) : [];
    const equipments = Array.isArray(labData.equipments) ? labData.equipments.filter(Boolean) : [];
    const problems = Array.isArray(labData.problems)
        ? labData.problems.filter((p) => p && (p.issue || p.solution))
        : [];
    const flowSteps = Array.isArray(labData.flowSteps) ? labData.flowSteps.filter(Boolean) : [];
    const images = Array.isArray(labData.images) ? labData.images.filter(isSafeImageUrl).slice(0, 3) : [];
    const imageCaptions = Array.isArray(labData.imageCaptions) ? labData.imageCaptions : [];
    const summaryText = labData.summary?.trim() || '-';
    const summaryHtml = `\u00A0\u00A0\u00A0\u00A0${escapeHtml(summaryText)}`;

    const renderBulletItems = (items) => {
        const list = items.length ? items : ['-'];
        return list
            .map(
                (item) => `
                    <li class="pdf-list-item">
                        <span class="pdf-bullet">•</span>
                        <span class="pdf-list-text">${escapeHtml(item)}</span>
                    </li>`
            )
            .join('');
    };

    const objectivesHtml = renderBulletItems(objectives);
    const equipmentsHtml = renderBulletItems(equipments);

    const arrowHtml =
        '<div class="flow-connector" aria-hidden="true"><span class="flow-connector-stem"></span><span class="flow-connector-head"></span></div>';

    const flowStepsHtml = flowSteps.length
        ? flowSteps
              .map(
                  (step) => `
                    <div class="pdf-flow-box">${escapeHtml(step)}</div>
                    ${arrowHtml}`
              )
              .join('')
        : `<div class="pdf-flow-box">ขั้นตอนที่ 1</div>${arrowHtml}`;

    const problemsHtml = problems.length
        ? problems
              .map(
                  (p) => `
                    <tr>
                        <td>${escapeHtml(p.issue || '-')}</td>
                        <td>${escapeHtml(p.solution || '-')}</td>
                    </tr>`
              )
              .join('')
        : '<tr><td>-</td><td>-</td></tr>';

    // กราฟผลการทดลอง (วางเหนือสรุปผลในหน้า 2)
    const chartSectionHtml = hasValidChartData(labData.chart)
        ? `
            <div class="pdf-block pdf-avoid-break">
                <h3 class="pdf-heading">กราฟผลการทดลอง</h3>
                <div class="pdf-chart-box">
                    ${renderSmoothScatterSvg(labData.chart, { width: 660, height: 300 })}
                </div>
            </div>
        `
        : '';

    // ช่องรูปภาพสัดส่วน 1:1 จำนวน 3 ช่อง + คำอธิบายใต้ภาพเฉพาะใน PDF (รูปที่ 1 ...)
    const imageCells = [];
    for (let i = 0; i < 3; i += 1) {
        if (images[i]) {
            const rawCaption = (imageCaptions[i] || '').trim();
            const captionLabel = rawCaption
                ? `รูปที่ ${i + 1} ${escapeHtml(rawCaption)}`
                : `รูปที่ ${i + 1}`;
            imageCells.push(`
                <div class="pdf-image-cell">
                    <div class="pdf-image-slot">
                        <img src="${escapeHtml(images[i])}" alt="ภาพประกอบปฏิบัติการที่ ${i + 1}">
                    </div>
                    <p class="pdf-image-caption">${captionLabel}</p>
                </div>
            `);
        } else {
            imageCells.push(`
                <div class="pdf-image-cell">
                    <div class="pdf-image-slot pdf-image-placeholder">ภาพประกอบ</div>
                </div>
            `);
        }
    }

    // ---------- หน้า 1 ----------
    const { wrapper: page1Wrapper, pageEl: page1El } = createA4PageShell(1);
    page1El.innerHTML = `
        <div class="pdf-header">
            <div class="pdf-header-left">
                <p class="pdf-header-meta pdf-header-top-line">
                    <span>วันที่ทำการทดลอง: ${escapeHtml(labDateText)}</span>
                    <span class="pdf-header-sep">|</span>
                    <span>รายวิชา: ${escapeHtml(courseText)}</span>
                </p>
                <h2>${escapeHtml(title)}</h2>
                <p class="pdf-header-meta">${escapeHtml(EXPERIMENTER_INFO.nameLine)}</p>
                <p class="pdf-header-meta">${escapeHtml(EXPERIMENTER_INFO.facultyLine)}</p>
                <p class="pdf-header-meta">${escapeHtml(advisorText)}</p>
                <p class="pdf-header-meta">${escapeHtml(responsibilityText)}</p>
            </div>
            <div class="pdf-qr-box"></div>
        </div>
        <div class="pdf-body">
            <div class="pdf-two-col">
                <div class="pdf-col-left">
                    <div class="pdf-block">
                        <h3 class="pdf-heading">วัตถุประสงค์</h3>
                        <ul class="pdf-list">${objectivesHtml}</ul>
                    </div>
                    <div class="pdf-block">
                        <h3 class="pdf-heading">อุปกรณ์ที่ใช้</h3>
                        <ul class="pdf-list">${equipmentsHtml}</ul>
                    </div>
                </div>
                <div class="pdf-col-right">
                    <h3 class="pdf-heading text-center">ขั้นตอนการทดลอง</h3>
                    <div class="pdf-flowchart">
                        <div class="pdf-flow-pill">Start</div>
                        ${arrowHtml}
                        ${flowStepsHtml}
                        <div class="pdf-flow-pill">End</div>
                    </div>
                </div>
            </div>

            <div class="pdf-block pdf-avoid-break">
                <table class="pdf-table">
                    <thead>
                        <tr>
                            <th>ปัญหาที่พบ</th>
                            <th>แนวทางการแก้ไข</th>
                        </tr>
                    </thead>
                    <tbody>${problemsHtml}</tbody>
                </table>
            </div>
        </div>
    `;

    // ---------- หน้า 2 (กราฟ + สรุปผล + ภาพประกอบพร้อมคำอธิบายใต้ภาพ) ----------
    const { wrapper: page2Wrapper, pageEl: page2El } = createA4PageShell(2);
    page2El.innerHTML = `
        <div class="pdf-body">
            ${chartSectionHtml}

            <div class="pdf-block pdf-avoid-break">
                <h3 class="pdf-heading">สรุปผล</h3>
                <p class="pdf-summary-text">${summaryHtml}</p>
            </div>

            <div class="pdf-images-grid pdf-avoid-break">
                ${imageCells.join('')}
            </div>
        </div>
    `;

    pagesContainer.append(page1Wrapper, page2Wrapper);

    const qrBox = page1El.querySelector('.pdf-qr-box');
    renderQRCode(qrBox, buildPublicLabUrl(labId), 84);
}

/**
 * แปลงทุกหน้ากระดาษ A4 ในพรีวิวเป็นไฟล์ PDF ด้วย html-to-image + jsPDF
 * @param {HTMLElement | null} pagesContainer
 * @param {string} title
 * @returns {Promise<boolean>}
 */
export async function downloadLabPdf(pagesContainer, title = 'Portfolio') {
    if (!pagesContainer) return false;

    const htmlToImage = window.htmlToImage;
    const JsPDF = window.jspdf?.jsPDF;

    if (!htmlToImage || !JsPDF) {
        const usePrint = window.confirm(
            'ไม่สามารถโหลดไลบรารีสร้าง PDF ได้ ต้องการใช้คำสั่งพิมพ์ของเบราว์เซอร์ (Save as PDF) แทนหรือไม่?'
        );
        if (usePrint) window.print();
        return false;
    }

    const safeName =
        (title || 'Portfolio')
            .trim()
            .replace(/[\\/:*?"<>|]+/g, '_')
            .slice(0, 60) || 'Portfolio';

    if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
    }

    const pageEls = Array.from(pagesContainer.querySelectorAll('.page-a4'));
    if (pageEls.length === 0) return false;

    try {
        const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pageWidth = 210;
        const pageHeight = 297;
        let isFirstPdfPage = true;

        for (const pageEl of pageEls) {
            pageEl.classList.add('pdf-exporting');
            const width = pageEl.offsetWidth;
            const a4HeightPx = Math.round((width * 297) / 210);
            const height = Math.max(pageEl.scrollHeight, a4HeightPx);

            let canvas;
            try {
                canvas = await htmlToImage.toCanvas(pageEl, {
                    pixelRatio: 2,
                    backgroundColor: '#FFFFFF',
                    preferredFontFormat: 'woff2',
                    width,
                    height,
                    style: {
                        margin: '0',
                        transform: 'none'
                    }
                });
            } finally {
                pageEl.classList.remove('pdf-exporting');
            }

            const imgData = canvas.toDataURL('image/jpeg', 0.96);
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            if (!isFirstPdfPage) {
                pdf.addPage();
            }
            isFirstPdfPage = false;

            if (imgHeight <= pageHeight + 6) {
                const finalHeight = Math.min(imgHeight, pageHeight);
                const finalWidth = (canvas.width * finalHeight) / canvas.height;
                const offsetX = (pageWidth - finalWidth) / 2;
                pdf.addImage(imgData, 'JPEG', offsetX, 0, finalWidth, finalHeight);
            } else {
                let heightLeft = imgHeight;
                let position = 0;
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                while (heightLeft > 2) {
                    position -= pageHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }
            }
        }

        pdf.save(`${safeName}.pdf`);
        return true;
    } catch (err) {
        console.error('PDF export failed:', err);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF คุณสามารถกดปุ่ม "พิมพ์เอกสาร (Print)" แล้วเลือก Save as PDF แทนได้ครับ');
        return false;
    }
}
