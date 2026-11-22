const LOCAL_STORAGE_KEY = 'lab_portfolio_labs_v1';

/**
 * แปลงอักขระพิเศษของ HTML เพื่อป้องกันช่องโหว่ XSS
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * ตรวจสอบว่า URL รูปภาพปลอดภัยสำหรับนำมาแสดงใน <img src>
 * @param {unknown} url
 * @returns {boolean}
 */
export function isSafeImageUrl(url) {
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    return (
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('http://')
    );
}

/**
 * แปลงวันที่เป็นรูปแบบภาษาไทยอย่างปลอดภัย (รองรับ ISO string และ Firestore Timestamp)
 * @param {unknown} value
 * @returns {string}
 */
export function formatThaiDate(value) {
    if (!value) return '-';
    let date;
    if (typeof value === 'object' && typeof value.toDate === 'function') {
        date = value.toDate();
    } else {
        date = new Date(value);
    }
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * ตัดข้อความให้สั้นลงพร้อมเติม "..." เฉพาะเมื่อเกินความยาวที่กำหนด
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateText(text, maxLength = 100) {
    if (!text) return '';
    const trimmed = text.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return `${trimmed.slice(0, maxLength)}...`;
}

/**
 * กำหนดเวลาสูงสุดของ Promise เพื่อไม่ให้การเชื่อมต่อ Firebase ค้างหน้าจอ
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms = 6000) {
    let timerId;
    const timeoutPromise = new Promise((_, reject) => {
        timerId = setTimeout(() => {
            const err = new Error('เชื่อมต่อ Firebase เกินเวลาที่กำหนด (timeout)');
            err.code = 'timeout';
            reject(err);
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timerId));
}

/**
 * อ่านข้อมูล Lab ที่สำรองไว้ใน localStorage
 * @returns {Record<string, object>}
 */
export function getLocalLabs() {
    try {
        const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

/**
 * บันทึกข้อมูล Lab ลง localStorage เป็นข้อมูลสำรองทันที
 * @param {string} labId
 * @param {object} labData
 * @returns {boolean}
 */
export function saveLocalLab(labId, labData) {
    try {
        const all = getLocalLabs();
        all[labId] = labData;
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
        return true;
    } catch (err) {
        console.warn('localStorage save failed:', err);
        return false;
    }
}

/**
 * ลบข้อมูล Lab ออกจาก localStorage
 * @param {string} labId
 */
export function deleteLocalLab(labId) {
    try {
        const all = getLocalLabs();
        delete all[labId];
        window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
        console.warn('localStorage delete failed:', err);
    }
}

/**
 * รวมข้อมูล Lab จาก Cloud (Firestore) และ Local โดยเลือกฉบับที่อัปเดตล่าสุด
 * @param {Record<string, object>} cloudMap
 * @param {Record<string, object>} localMap
 * @returns {Record<string, object>}
 */
export function mergeLabs(cloudMap = {}, localMap = {}) {
    const merged = { ...localMap };
    Object.entries(cloudMap).forEach(([id, cloudData]) => {
        const localData = merged[id];
        if (!localData) {
            merged[id] = cloudData;
            return;
        }
        const cloudTime = cloudData?.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
        const localTime = localData?.updatedAt ? new Date(localData.updatedAt).getTime() : 0;
        if ((Number.isNaN(cloudTime) ? 0 : cloudTime) >= (Number.isNaN(localTime) ? 0 : localTime)) {
            merged[id] = cloudData;
        }
    });
    return merged;
}

/**
 * ครอบภาพกึ่งกลางเป็นสัดส่วน 1:1 และบีบอัดด้วย Canvas เพื่อลดขนาดก่อนเก็บลง Firestore
 * @param {File} file
 * @param {number} maxSize
 * @param {number} quality
 * @returns {Promise<string>}
 */
export function compressImageToDataUrl(file, maxSize = 800, quality = 0.78) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
        reader.onload = (event) => {
            const img = new Image();
            img.onerror = () => reject(new Error('ไฟล์รูปภาพไม่ถูกต้อง'));
            img.onload = () => {
                const { width, height } = img;
                const cropSize = Math.min(width, height);
                const sx = Math.round((width - cropSize) / 2);
                const sy = Math.round((height - cropSize) / 2);
                const outSize = Math.min(cropSize, maxSize);

                const canvas = document.createElement('canvas');
                canvas.width = outSize;
                canvas.height = outSize;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(event.target.result);
                    return;
                }
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, outSize, outSize);
                ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}
