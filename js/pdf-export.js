import { escapeHtml, isSafeImageUrl } from './utils.js';
import { buildPublicLabUrl, renderQRCode } from './qrcode-helper.js';

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
 * ตรวจสอบความสูงของหน้า 1:
 * หากชุดภาพประกอบ (และสรุปผล) ล้นความสูงกระดาษ A4 จนอาจถูกตัดข้ามหน้า
 * ให้ย้ายทั้งชุด "สรุปผล + ภาพประกอบ 3 อัน" ไปขึ้นหน้า 2 ทันที
 * @param {HTMLElement | null} pagesContainer
 */
export function paginatePdfPages(pagesContainer) {
    if (!pagesContainer) return;

    const page1Wrapper = pagesContainer.querySelector('.pdf-page-wrapper[data-page="1"]');
    const page1El = page1Wrapper?.querySelector('.page-a4');
    const summaryImagesGroup = pagesContainer.querySelector('.pdf-summary-images-group');
    if (!page1El || !summaryImagesGroup) return;

    // หากเคยย้ายไปหน้า 2 แล้ว ให้ย้ายกลับหน้า 1 ก่อนเพื่อวัดใหม่ให้แม่นยำ (เช่น หลังฟอนต์โหลดเสร็จ)
    const existingPage2 = pagesContainer.querySelector('.pdf-page-wrapper[data-page="2"]');
    if (existingPage2) {
        const page1Body = page1El.querySelector('.pdf-body');
        if (page1Body && summaryImagesGroup.parentElement !== page1Body) {
            page1Body.appendChild(summaryImagesGroup);
        }
        existingPage2.remove();
    }

    const pageWidthPx = page1El.offsetWidth;
    if (!pageWidthPx) return;

    // คำนวณความสูงกระดาษ A4 (297mm / 210mm) เทียบกับความกว้างจริงในหน่วย px
    const a4HeightPx = (pageWidthPx * 297) / 210;
    const paddingBottomPx = parseFloat(window.getComputedStyle(page1El).paddingBottom) || 0;
    const pageRect = page1El.getBoundingClientRect();
    const groupRect = summaryImagesGroup.getBoundingClientRect();
    const contentBottomPx = groupRect.bottom - pageRect.top + paddingBottomPx;

    // ถ้าความสูงเกิน 1 หน้า A4 -> ย้ายทั้ง "สรุปผล + ชุดภาพประกอบ 3 ภาพ" ไปหน้า 2 ทันที
    if (contentBottomPx > a4HeightPx + 1) {
        const { wrapper: page2Wrapper, pageEl: page2El } = createA4PageShell(2);
        const page2Body = document.createElement('div');
        page2Body.className = 'pdf-body';
        page2Body.appendChild(summaryImagesGroup);
        page2El.appendChild(page2Body);
        pagesContainer.appendChild(page2Wrapper);
    }
}

/**
 * สร้างเนื้อหาเอกสารขนาด A4 ตามแบบ Wireframe สำหรับพรีวิว ปริ้น และดาวน์โหลด PDF
 * @param {object} labData
 * @param {HTMLElement | null} pagesContainer
 * @param {string} labId
 */
export function renderPdfPreview(labData, pagesContainer, labId) {
    if (!pagesContainer) return;
    pagesContainer.innerHTML = '';

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

    // ช่องรูปภาพสัดส่วน 1:1 จำนวน 3 ช่องด้านล่างตามแบบ Wireframe
    const imageSlots = [];
    for (let i = 0; i < 3; i += 1) {
        if (images[i]) {
            imageSlots.push(`
                <div class="pdf-image-slot">
                    <img src="${escapeHtml(images[i])}" alt="ภาพประกอบปฏิบัติการที่ ${i + 1}">
                </div>
            `);
        } else {
            imageSlots.push('<div class="pdf-image-slot pdf-image-placeholder">ภาพประกอบ</div>');
        }
    }

    const { wrapper: page1Wrapper, pageEl: page1El } = createA4PageShell(1);
    page1El.innerHTML = `
        <div class="pdf-header">
            <div class="pdf-header-left">
                <h2>${escapeHtml(title)}</h2>
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

            <div class="pdf-summary-images-group pdf-avoid-break">
                <div class="pdf-block">
                    <h3 class="pdf-heading">สรุปผล</h3>
                    <p class="pdf-summary-text">${summaryHtml}</p>
                </div>

                <div class="pdf-images-grid">
                    ${imageSlots.join('')}
                </div>
            </div>
        </div>
    `;

    pagesContainer.appendChild(page1Wrapper);

    const qrBox = page1El.querySelector('.pdf-qr-box');
    renderQRCode(qrBox, buildPublicLabUrl(labId), 84);

    // วัดและแบ่งหน้าอัตโนมัติ (ทั้งทันทีและหลังฟอนต์/เฟรมเรนเดอร์เสร็จ)
    paginatePdfPages(pagesContainer);
    window.requestAnimationFrame(() => paginatePdfPages(pagesContainer));
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => paginatePdfPages(pagesContainer));
    }
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

    // ตรวจสอบการแบ่งหน้าล่าสุดก่อนสร้างไฟล์ PDF
    paginatePdfPages(pagesContainer);

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
