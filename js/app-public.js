import { db, collection, getDocs } from './firebase-config.js';
import {
    EXPERIMENTER_INFO,
    getEntryType,
    escapeHtml,
    isSafeImageUrl,
    formatThaiDate,
    withTimeout,
    getLocalLabs,
    mergeLabs
} from './utils.js';
import { hasValidChartData, renderSmoothScatterSvg } from './chart-helper.js';

let allLabsData = {};
let sortedEntries = [];
let activeFilter = 'all';

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

function renderLabList() {
    const container = document.getElementById('public-lab-list');
    if (!container) return;

    container.innerHTML = '';

    const filtered = sortedEntries.filter(({ data }) => {
        if (activeFilter === 'all') return true;
        return getEntryType(data) === activeFilter;
    });

    if (filtered.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'text-light text-center';
        emptyMsg.textContent =
            activeFilter === 'visit'
                ? 'ยังไม่มีข้อมูลการเข้าฟังการบรรยายหรือเยี่ยมชม'
                : activeFilter === 'lab'
                  ? 'ยังไม่มีข้อมูลปฏิบัติการ'
                  : 'ยังไม่มีข้อมูลผลงาน';
        container.appendChild(emptyMsg);
        return;
    }

    filtered.forEach(({ id, data }) => {
        const isVisit = getEntryType(data) === 'visit';
        const card = document.createElement('article');
        card.className = 'lab-card-wireframe';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'lab-card-thumb';
        const firstImg = Array.isArray(data.images) ? data.images.find(isSafeImageUrl) : null;
        if (firstImg) {
            const img = document.createElement('img');
            img.src = firstImg;
            img.alt = data.title || 'ภาพประกอบผลงาน';
            img.loading = 'lazy';
            thumbWrap.appendChild(img);
        } else {
            const placeholder = document.createElement('span');
            placeholder.textContent = 'รูปภาพ';
            thumbWrap.appendChild(placeholder);
        }

        const infoWrap = document.createElement('div');
        infoWrap.className = 'lab-card-info';

        const badge = document.createElement('span');
        badge.className = `card-type-badge ${isVisit ? 'badge-visit' : 'badge-lab'}`;
        badge.textContent = isVisit ? data.visitCategory || 'บรรยาย / เยี่ยมชม' : 'ปฏิบัติการ';

        const titleEl = document.createElement('h3');
        titleEl.className = 'lab-card-title';
        titleEl.textContent = data.title || (isVisit ? 'ไม่มีชื่อกิจกรรม' : 'ไม่มีชื่อหัวข้อปฏิบัติการ');

        const dateEl = document.createElement('p');
        dateEl.className = 'lab-card-meta';
        dateEl.textContent = `วันที่: ${formatThaiDate(data.labDate || data.updatedAt)}`;

        const secondaryEl = document.createElement('p');
        secondaryEl.className = 'lab-card-meta';
        secondaryEl.textContent = isVisit
            ? `วิทยากร / หน่วยงาน: ${data.visitSpeaker || '-'}`
            : `อาจารย์ที่ปรึกษา: ${data.advisor || '-'}`;

        infoWrap.append(badge, titleEl, dateEl, secondaryEl);

        if (isVisit && data.visitLocation) {
            const locEl = document.createElement('p');
            locEl.className = 'lab-card-meta';
            locEl.textContent = `สถานที่: ${data.visitLocation}`;
            infoWrap.appendChild(locEl);
        }

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
        mainBox.innerHTML = '<div class="detail-gallery-empty">ยังไม่มีภาพประกอบ</div>';
        thumbsBox.classList.add('hidden');
        return;
    }

    const setMainImage = (src, activeIdx) => {
        mainBox.innerHTML = '';
        const mainImg = document.createElement('img');
        mainImg.src = src;
        mainImg.alt = `ภาพประกอบที่ ${activeIdx + 1}`;
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

function renderListItemsHtml(items) {
    const valid = Array.isArray(items) ? items.filter(Boolean) : [];
    return valid.length ? valid.map((item) => `<li>${escapeHtml(item)}</li>`).join('') : '<li>-</li>';
}

function viewLabContent(labId) {
    const data = allLabsData[labId];
    if (!data) return;

    const isVisit = getEntryType(data) === 'visit';

    const topMetaEl = document.getElementById('web-top-meta');
    if (topMetaEl) {
        const dateLabel = isVisit ? 'วันที่เข้าร่วมกิจกรรม' : 'วันที่ทำการทดลอง';
        const courseLabel = isVisit ? 'รายวิชา / โครงการ' : 'รายวิชา';
        const dateText = data.labDate ? formatThaiDate(data.labDate) : '-';
        const courseText = data.course?.trim() || '-';
        topMetaEl.innerHTML = `<span>${dateLabel}: ${escapeHtml(dateText)}</span><span class="detail-meta-sep">|</span><span>${courseLabel}: ${escapeHtml(courseText)}</span>`;
    }

    const titleEl = document.getElementById('web-title');
    if (titleEl) titleEl.textContent = data.title || (isVisit ? 'ไม่มีชื่อกิจกรรม' : 'ไม่มีชื่อหัวข้อปฏิบัติการ');

    const expEl = document.getElementById('web-experimenter');
    if (expEl) expEl.textContent = isVisit ? EXPERIMENTER_INFO.participantLine : EXPERIMENTER_INFO.nameLine;

    const facultyEl = document.getElementById('web-faculty');
    if (facultyEl) facultyEl.textContent = EXPERIMENTER_INFO.facultyLine;

    const meta1 = document.getElementById('web-detail-meta-1');
    const meta2 = document.getElementById('web-detail-meta-2');
    const meta3 = document.getElementById('web-detail-meta-3');

    const labSections = document.getElementById('web-lab-sections');
    const visitSections = document.getElementById('web-visit-sections');

    if (isVisit) {
        if (meta1) meta1.textContent = `รูปแบบกิจกรรม: ${data.visitCategory || 'เข้าฟังการบรรยาย / เยี่ยมชม'}`;
        if (meta2) meta2.textContent = `วิทยากร / หน่วยงาน: ${data.visitSpeaker || '-'}`;
        if (meta3) {
            meta3.textContent = `สถานที่: ${data.visitLocation || '-'}`;
            meta3.classList.remove('hidden');
        }

        labSections?.classList.add('hidden');
        visitSections?.classList.remove('hidden');

        const topicEl = document.getElementById('web-visit-topics');
        if (topicEl) topicEl.innerHTML = renderListItemsHtml(data.visitTopics);

        const knowledgeEl = document.getElementById('web-visit-knowledge');
        if (knowledgeEl) knowledgeEl.innerHTML = renderListItemsHtml(data.visitKnowledge);

        const appEl = document.getElementById('web-visit-application');
        if (appEl) appEl.textContent = data.visitApplication || '-';

        const visitSumEl = document.getElementById('web-visit-summary');
        if (visitSumEl) visitSumEl.textContent = data.visitSummary || '-';
    } else {
        if (meta1) meta1.textContent = `อาจารย์ที่ปรึกษา: ${data.advisor || '-'}`;
        if (meta2) meta2.textContent = `ความรับผิดชอบ: ${data.responsibility || '-'}`;
        if (meta3) {
            meta3.textContent = '';
            meta3.classList.add('hidden');
        }

        labSections?.classList.remove('hidden');
        visitSections?.classList.add('hidden');

        const objContainer = document.getElementById('web-objectives');
        if (objContainer) objContainer.innerHTML = renderListItemsHtml(data.objectives);

        const eqContainer = document.getElementById('web-equipments');
        if (eqContainer) eqContainer.innerHTML = renderListItemsHtml(data.equipments);

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

        const summaryEl = document.getElementById('web-summary');
        if (summaryEl) summaryEl.textContent = data.summary || '-';
    }

    renderGallery(data.images);

    updateUrlLabParam(labId);
    switchView('portfolio-detail-view');
}

function bindFilterTabs() {
    const tabsWrap = document.getElementById('public-filter-tabs');
    if (!tabsWrap) return;

    tabsWrap.querySelectorAll('.filter-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.filter || 'all';
            tabsWrap.querySelectorAll('.filter-tab').forEach((t) => {
                const isActive = t === btn;
                t.classList.toggle('active', isActive);
                t.setAttribute('aria-selected', String(isActive));
            });
            renderLabList();
        });
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    bindFilterTabs();

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

    sortedEntries = Object.entries(allLabsData)
        .map(([id, data]) => ({ id, data }))
        .sort((a, b) => {
            const timeA = a.data?.updatedAt ? new Date(a.data.updatedAt).getTime() : 0;
            const timeB = b.data?.updatedAt ? new Date(b.data.updatedAt).getTime() : 0;
            return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
        });

    if (sortedEntries.length === 0 && cloudError) {
        const errCode = escapeHtml(cloudError?.code || 'network');
        container.innerHTML = `<p class="alert-error text-center">ไม่สามารถดึงข้อมูลจาก Firebase ได้ในขณะนี้ (${errCode}) — กรุณาตรวจสอบการตั้งค่า Firestore Security Rules ให้เปิดสิทธิ์อ่านสาธารณะ</p>`;
        return;
    }

    renderLabList();

    const requestedLabId = new URLSearchParams(window.location.search).get('lab');
    if (requestedLabId && allLabsData[requestedLabId]) {
        viewLabContent(requestedLabId);
    }
});
