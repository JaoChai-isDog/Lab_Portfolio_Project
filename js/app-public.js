import { db, collection, getDocs } from './firebase-config.js';
import {
    EXPERIMENTER_INFO,
    escapeHtml,
    isSafeImageUrl,
    formatThaiDate,
    withTimeout,
    getLocalLabs,
    mergeLabs
} from './utils.js';
import { hasValidChartData, renderSmoothScatterSvg } from './chart-helper.js';

let allLabsData = {};

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach((el) => el.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function updateUrlLabParam(labId) {
    const url = new URL(window.location.href);
    if (labId) {
        url.searchParams.set('lab', labId);
    } else {
        url.searchParams.delete('lab');
    }
    window.history.replaceState({}, '', url);
}

function renderLabList(labs) {
    const container = document.getElementById('public-lab-list');
    if (!container) return;

    container.innerHTML = '';

    if (labs.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-light text-center';
        emptyMsg.textContent = 'ยังไม่มีข้อมูลปฏิบัติการ';
        container.appendChild(emptyMsg);
        return;
    }

    labs.forEach(({ id, data }) => {
        const card = document.createElement('article');
        card.className = 'lab-card-wireframe';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        // รูปขนาดย่อด้านซ้ายตามแบบ Wireframe
        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'lab-card-thumb';
        const firstImg = Array.isArray(data.images) ? data.images.find(isSafeImageUrl) : null;
        if (firstImg) {
            const img = document.createElement('img');
            img.src = firstImg;
            img.alt = data.title || 'ภาพประกอบปฏิบัติการ';
            img.loading = 'lazy';
            thumbWrap.appendChild(img);
        } else {
            const placeholder = document.createElement('span');
            placeholder.textContent = 'รูปภาพ';
            thumbWrap.appendChild(placeholder);
        }

        // ข้อมูลด้านขวา: ชื่อปฏิบัติการ, วันที่, อาจารย์ที่ปรึกษา
        const infoWrap = document.createElement('div');
        infoWrap.className = 'lab-card-info';

        const titleEl = document.createElement('h3');
        titleEl.className = 'lab-card-title';
        titleEl.textContent = data.title || 'ไม่มีชื่อหัวข้อปฏิบัติการ';

        const dateEl = document.createElement('p');
        dateEl.className = 'lab-card-meta';
        dateEl.textContent = `วันที่: ${formatThaiDate(data.labDate || data.updatedAt)}`;

        const advisorEl = document.createElement('p');
        advisorEl.className = 'lab-card-meta';
        advisorEl.textContent = `อาจารย์ที่ปรึกษา: ${data.advisor || '-'}`;

        infoWrap.append(titleEl, dateEl, advisorEl);
        card.append(thumbWrap, infoWrap);

        const openLab = () => viewLabContent(id);
        card.addEventListener('click', openLab);
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openLab();
            }
        });

        container.appendChild(card);
    });
}

function renderGallery(images) {
    const mainBox = document.getElementById('web-gallery-main');
    const thumbsBox = document.getElementById('web-gallery-thumbs');
    if (!mainBox || !thumbsBox) return;

    mainBox.innerHTML = '';
    thumbsBox.innerHTML = '';

    const safeImages = Array.isArray(images) ? images.filter(isSafeImageUrl) : [];
    if (safeImages.length === 0) {
        mainBox.innerHTML = '<div class="detail-gallery-empty">ยังไม่มีภาพประกอบการทดลอง</div>';
        thumbsBox.classList.add('hidden');
        return;
    }

    const setMainImage = (src, activeIdx) => {
        mainBox.innerHTML = '';
        const mainImg = document.createElement('img');
        mainImg.src = src;
        mainImg.alt = `ภาพประกอบการทดลองที่ ${activeIdx + 1}`;
        mainBox.appendChild(mainImg);

        thumbsBox.querySelectorAll('.detail-thumb-btn').forEach((btn, idx) => {
            btn.classList.toggle('active', idx === activeIdx);
        });
    };

    thumbsBox.classList.remove('hidden');
    safeImages.forEach((src, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'detail-thumb-btn';
        btn.setAttribute('aria-label', `ดูภาพประกอบที่ ${idx + 1}`);

        const img = document.createElement('img');
        img.src = src;
        img.alt = `ภาพย่อที่ ${idx + 1}`;
        btn.appendChild(img);

        btn.addEventListener('click', () => setMainImage(src, idx));
        thumbsBox.appendChild(btn);
    });

    setMainImage(safeImages[0], 0);
}

function viewLabContent(labId) {
    const data = allLabsData[labId];
    if (!data) return;

    const topMetaEl = document.getElementById('web-top-meta');
    if (topMetaEl) {
        const labDateText = data.labDate ? formatThaiDate(data.labDate) : '-';
        const courseText = data.course?.trim() || '-';
        topMetaEl.innerHTML = `<span>วันที่ทำการทดลอง: ${escapeHtml(labDateText)}</span><span class="detail-meta-sep">|</span><span>รายวิชา: ${escapeHtml(courseText)}</span>`;
    }

    const titleEl = document.getElementById('web-title');
    if (titleEl) titleEl.textContent = data.title || 'ไม่มีชื่อหัวข้อปฏิบัติการ';

    const expEl = document.getElementById('web-experimenter');
    if (expEl) expEl.textContent = EXPERIMENTER_INFO.nameLine;

    const facultyEl = document.getElementById('web-faculty');
    if (facultyEl) facultyEl.textContent = EXPERIMENTER_INFO.facultyLine;

    const advisorEl = document.getElementById('web-advisor');
    if (advisorEl) advisorEl.textContent = `อาจารย์ที่ปรึกษา: ${data.advisor || '-'}`;

    const respEl = document.getElementById('web-responsibility');
    if (respEl) respEl.textContent = `ความรับผิดชอบ: ${data.responsibility || '-'}`;

    // วัตถุประสงค์
    const objContainer = document.getElementById('web-objectives');
    if (objContainer) {
        const objectives = Array.isArray(data.objectives) ? data.objectives.filter(Boolean) : [];
        objContainer.innerHTML = objectives.length
            ? objectives.map((o) => `<li>${escapeHtml(o)}</li>`).join('')
            : '<li>-</li>';
    }

    // อุปกรณ์ที่ใช้
    const eqContainer = document.getElementById('web-equipments');
    if (eqContainer) {
        const equipments = Array.isArray(data.equipments) ? data.equipments.filter(Boolean) : [];
        eqContainer.innerHTML = equipments.length
            ? equipments.map((e) => `<li>${escapeHtml(e)}</li>`).join('')
            : '<li>-</li>';
    }

    // ปัญหาที่พบและแนวทางการแก้ไข (แสดงเป็นรายการตาม Wireframe)
    const probContainer = document.getElementById('web-problems');
    if (probContainer) {
        const problems = Array.isArray(data.problems)
            ? data.problems.filter((p) => p && (p.issue || p.solution))
            : [];
        probContainer.innerHTML = problems.length
            ? problems
                  .map((p) => {
                      const issue = escapeHtml(p.issue || '-');
                      const solution = escapeHtml(p.solution || '-');
                      return `<li><strong>ปัญหา:</strong> ${issue} — <strong>แนวทางแก้ไข:</strong> ${solution}</li>`;
                  })
                  .join('')
            : '<li>-</li>';
    }

    // ขั้นตอนการทดลอง (Flowchart)
    const flowContainer = document.getElementById('web-flowchart');
    if (flowContainer) {
        const flowSteps = Array.isArray(data.flowSteps) ? data.flowSteps.filter(Boolean) : [];
        const arrowHtml =
            '<div class="flow-connector" aria-hidden="true"><span class="flow-connector-stem"></span><span class="flow-connector-head"></span></div>';
        const stepsHtml = flowSteps.length
            ? flowSteps
                  .map(
                      (step) => `
                        <div class="wf-flow-box">${escapeHtml(step)}</div>
                        ${arrowHtml}`
                  )
                  .join('')
            : `<div class="wf-flow-box">-</div>${arrowHtml}`;

        flowContainer.innerHTML = `
            <div class="wf-flow-pill">Start</div>
            ${arrowHtml}
            ${stepsHtml}
            <div class="wf-flow-pill">End</div>
        `;
    }

    // กราฟผลการทดลอง (วางเหนือสรุปผล)
    const chartSection = document.getElementById('web-chart-section');
    const chartBox = document.getElementById('web-chart');
    if (chartSection && chartBox) {
        if (hasValidChartData(data.chart)) {
            chartBox.innerHTML = renderSmoothScatterSvg(data.chart, { width: 640, height: 320 });
            chartSection.classList.remove('hidden');
        } else {
            chartBox.innerHTML = '';
            chartSection.classList.add('hidden');
        }
    }

    // สรุปผล
    const summaryEl = document.getElementById('web-summary');
    if (summaryEl) summaryEl.textContent = data.summary || '-';

    // แกลเลอรีภาพประกอบ (ภาพใหญ่ + แถบภาพย่อด้านล่างตาม Wireframe)
    renderGallery(data.images);

    updateUrlLabParam(labId);
    switchView('portfolio-detail-view');
}

window.addEventListener('DOMContentLoaded', async () => {
    const btnBack = document.getElementById('btnBackToList');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            updateUrlLabParam(null);
            switchView('portfolio-main-view');
        });
    }

    const container = document.getElementById('public-lab-list');
    if (!container) return;

    container.innerHTML = '<p class="text-light text-center">กำลังโหลดผลงาน...</p>';

    const localLabs = getLocalLabs();
    let cloudLabs = {};
    let cloudError = null;

    try {
        const querySnapshot = await withTimeout(getDocs(collection(db, 'labs')), 12000);
        querySnapshot.forEach((docSnap) => {
            cloudLabs[docSnap.id] = docSnap.data();
        });
    } catch (error) {
        cloudError = error;
        console.warn('Firestore load failed, using local data if available:', error);
    }

    allLabsData = mergeLabs(cloudLabs, localLabs);

    const labs = Object.entries(allLabsData)
        .map(([id, data]) => ({ id, data }))
        .sort((a, b) => {
            const timeA = a.data?.updatedAt ? new Date(a.data.updatedAt).getTime() : 0;
            const timeB = b.data?.updatedAt ? new Date(b.data.updatedAt).getTime() : 0;
            return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
        });

    if (labs.length === 0 && cloudError) {
        const errCode = escapeHtml(cloudError?.code || 'network');
        container.innerHTML =
            `<p class="alert-error text-center">ไม่สามารถดึงข้อมูลจาก Firebase ได้ในขณะนี้ (${errCode}) — กรุณาตรวจสอบการตั้งค่า Firestore Security Rules ให้เปิดสิทธิ์อ่านสาธารณะ</p>`;
        return;
    }

    renderLabList(labs);

    // รองรับลิงก์ตรงจาก QR Code (?lab=<labId>)
    const requestedLabId = new URLSearchParams(window.location.search).get('lab');
    if (requestedLabId && allLabsData[requestedLabId]) {
        viewLabContent(requestedLabId);
    }
});
