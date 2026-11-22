/**
 * สร้าง URL หน้าสาธารณะ (index.html) ที่ชี้ตรงไปยัง Lab ที่ต้องการ
 * @param {string} labId
 * @returns {string}
 */
export function buildPublicLabUrl(labId) {
    const url = new URL('index.html', window.location.href);
    if (labId) {
        url.searchParams.set('lab', labId);
    }
    return url.href;
}

/**
 * สร้าง QR Code ลงใน container ที่กำหนด
 * @param {HTMLElement | null} container
 * @param {string} text
 * @param {number} size
 */
export function renderQRCode(container, text, size = 80) {
    if (!container) return;
    container.innerHTML = '';

    if (typeof window.QRCode !== 'function') {
        container.textContent = 'QR ไม่พร้อมใช้งาน';
        return;
    }

    new window.QRCode(container, {
        text,
        width: size,
        height: size,
        correctLevel: window.QRCode.CorrectLevel?.M ?? 0
    });
}
