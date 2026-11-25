import {
    auth,
    db,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    collection,
    doc,
    setDoc,
    getDocs,
    deleteDoc
} from './firebase-config.js';
import {
    compressImageToDataUrl,
    isSafeImageUrl,
    getEntryType,
    withTimeout,
    getLocalLabs,
    saveLocalLab,
    deleteLocalLab,
    mergeLabs
} from './utils.js';
import { renderPdfPreview, downloadLabPdf } from './pdf-export.js';
import { MUJI_CHART_COLORS, hasValidChartData, renderSmoothScatterSvg } from './chart-helper.js';
import { SAMPLE_LAB_DATA, SAMPLE_VISIT_DATA } from './sample-data.js';

const MAX_IMAGES = 3;
const MAX_CHART_SERIES = MUJI_CHART_COLORS.length;

let currentLabId = generateNewLabId();
let currentEntryType = 'lab';
let savedLabsMap = {};
let uploadedImages = [];
let imageCaptions = [];
let chartState = createDefaultChartState();
let flowStepCount = 0;
let saveTimeout = null;
let isPopulatingForm = false;

function createDefaultChartState() {
    return {
        title: '',
        xLabel: '',
        yLabel: '',
        seriesNames: ['ชุดข้อมูล 1', 'ชุดข้อมูล 2'],
        rows: [
            { x: '', values: ['', ''] },
            { x: '', values: ['', ''] },
            { x: '', values: ['', ''] },
            { x: '', values: ['', ''] }
        ]
    };
}

function generateNewLabId() {
    return `lab_${Date.now()}`;
}

function switchView(viewId) {
    document.querySelectorAll('.view-section').forEach((el) => el.classList.add('hidden'));
    const target = document.getElementById(viewId);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function setSaveStatus(text, isError = false) {
    const statusEl = document.getElementById('save-status');
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('save-status-error', isError);
}

function showActionFeedback(message, type = 'success') {
    const banner = document.getElementById('action-feedback');
    if (!banner) return;
    banner.textContent = message;
    banner.className = `feedback-banner feedback-${type}`;
}

// ==========================================
// 0. สลับประเภทผลงาน (ปฏิบัติการ vs บรรยาย/เยี่ยมชม)
// ==========================================
function setEntryType(type, shouldAutoSave = false) {
    currentEntryType = type === 'visit' ? 'visit' : 'lab';
    const isVisit = currentEntryType === 'visit';

    const btnLab = document.getElementById('btnTypeLab');
    const btnVisit = document.getElementById('btnTypeVisit');
    if (btnLab && btnVisit) {
        btnLab.classList.toggle('active', !isVisit);
        btnLab.setAttribute('aria-selected', String(!isVisit));
        btnVisit.classList.toggle('active', isVisit);
        btnVisit.setAttribute('aria-selected', String(isVisit));
    }

    document.getElementById('lab-only-fields')?.classList.toggle('hidden', isVisit);
    document.getElementById('visit-only-fields')?.classList.toggle('hidden', !isVisit);

    const heading = document.getElementById('formHeading');
    if (heading) {
        heading.textContent = isVisit ? 'บันทึกข้อมูลการบรรยาย / เยี่ยมชม' : 'บันทึกข้อมูลปฏิบัติการ';
    }

    const labelDate = document.getElementById('labelLabDate');
    if (labelDate) {
        labelDate.textContent = isVisit ? 'วันที่เข้าร่วมกิจกรรม' : 'วันที่ทำการทดลอง';
    }

    const labelTitle = document.getElementById('labelLabTitle');
    if (labelTitle) {
        labelTitle.textContent = isVisit ? 'หัวข้อการบรรยาย / ชื่อกิจกรรมเยี่ยมชม' : 'หัวข้อปฏิบัติการ';
    }

    const titleInput = document.getElementById('labTitle');
    if (titleInput) {
        titleInput.placeholder = isVisit
            ? 'เช่น ศึกษาดูงานสายการผลิตอัตโนมัติในโรงงานอุตสาหกรรม'
            : 'เช่น การหาประสิทธิภาพปั๊มน้ำ';
    }

    if (shouldAutoSave) {
        scheduleAutoSave();
    }
}

// ==========================================
// 1. จัดการรายการในฟอร์ม (Dynamic Fields)
// ==========================================
function addListItem(containerId, placeholder, value = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'flex-row mb-10';

    const bullet = document.createElement('span');
    bullet.className = 'list-bullet';
    bullet.textContent = '○';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'auto-save flex-1';
    input.placeholder = `${placeholder} ${container.children.length + 1}`;
    input.value = value;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-secondary btn-sm';
    removeBtn.textContent = '-';
    removeBtn.setAttribute('aria-label', 'ลบรายการ');
    removeBtn.addEventListener('click', () => {
        row.remove();
        scheduleAutoSave();
    });

    row.append(bullet, input, removeBtn);
    container.appendChild(row);
}

function addProblemPair(issue = '', solution = '') {
    const container = document.getElementById('problemList');
    if (!container) return;

    const num = container.children.length + 1;
    const card = document.createElement('div');
    card.className = 'problem-card';

    const issueRow = document.createElement('div');
    issueRow.className = 'flex-row mb-10';
    const issueBullet = document.createElement('span');
    issueBullet.className = 'list-bullet';
    issueBullet.textContent = '○';
    const issueInput = document.createElement('input');
    issueInput.type = 'text';
    issueInput.className = 'auto-save flex-1 problem-issue';
    issueInput.placeholder = `ปัญหาที่พบ ${num}`;
    issueInput.value = issue;
    issueRow.append(issueBullet, issueInput);

    const solRow = document.createElement('div');
    solRow.className = 'flex-row';
    const solBullet = document.createElement('span');
    solBullet.className = 'list-bullet';
    solBullet.textContent = '○';
    const solInput = document.createElement('input');
    solInput.type = 'text';
    solInput.className = 'auto-save flex-1 problem-solution';
    solInput.placeholder = `แนวทางการแก้ไข ${num}`;
    solInput.value = solution;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-secondary btn-sm';
    removeBtn.textContent = 'ลบ';
    removeBtn.addEventListener('click', () => {
        card.remove();
        scheduleAutoSave();
    });

    solRow.append(solBullet, solInput, removeBtn);
    card.append(issueRow, solRow);
    container.appendChild(card);
}

function addFlowchartStep(value = '') {
    const container = document.getElementById('flowchartSteps');
    if (!container) return;

    flowStepCount += 1;
    const stepDiv = document.createElement('div');
    stepDiv.id = `flow-step-${flowStepCount}`;
    stepDiv.className = 'flowchart-step-item';

    const box = document.createElement('div');
    box.className = 'flow-box';

    const label = document.createElement('div');
    label.textContent = `ขั้นตอนที่ ${flowStepCount}`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-100 mt-10 auto-save';
    input.placeholder = 'รายละเอียดขั้นตอน...';
    input.value = value;

    const arrow = document.createElement('div');
    arrow.className = 'flow-connector flow-connector-admin';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.innerHTML = '<span class="flow-connector-stem"></span><span class="flow-connector-head"></span>';

    box.append(label, input);
    stepDiv.append(box, arrow);
    container.appendChild(stepDiv);
}

function removeFlowchartStep() {
    if (flowStepCount <= 1) return;
    const stepEl = document.getElementById(`flow-step-${flowStepCount}`);
    if (stepEl) {
        stepEl.remove();
        flowStepCount -= 1;
        scheduleAutoSave();
    }
}

function ensureSelectOption(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select || !value) return;

    const exists = Array.from(select.options).some((opt) => opt.value === value);
    if (!exists) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.add(option);
    }
}

function handleAddSelectOption(inputId, selectId) {
    const input = document.getElementById(inputId);
    const select = document.getElementById(selectId);
    if (!input || !select) return;

    const name = input.value.trim();
    if (!name) return;

    ensureSelectOption(selectId, name);
    select.value = name;
    input.value = '';
    scheduleAutoSave();
}

// ==========================================
// 2. จัดการตารางกราฟแบบ Microsoft Word + พรีวิวสด
// ==========================================
function normalizeChartState(rawChart) {
    if (!rawChart || !Array.isArray(rawChart.seriesNames) || rawChart.seriesNames.length === 0) {
        return createDefaultChartState();
    }
    const seriesNames = rawChart.seriesNames.slice(0, MAX_CHART_SERIES).map((n, idx) =>
        typeof n === 'string' && n.trim() ? n.trim() : `ชุดข้อมูล ${idx + 1}`
    );
    const seriesCount = seriesNames.length;
    const rawRows =
        Array.isArray(rawChart.rows) && rawChart.rows.length > 0
            ? rawChart.rows
            : [{ x: '', values: new Array(seriesCount).fill('') }];

    const rows = rawRows.map((r) => {
        const vals = Array.isArray(r?.values) ? r.values : [];
        return {
            x: r?.x !== undefined && r?.x !== null ? String(r.x) : '',
            values: Array.from({ length: seriesCount }, (_, i) =>
                vals[i] !== undefined && vals[i] !== null ? String(vals[i]) : ''
            )
        };
    });

    return {
        title: rawChart.title || '',
        xLabel: rawChart.xLabel || '',
        yLabel: rawChart.yLabel || '',
        seriesNames,
        rows
    };
}

function updateAdminChartPreview() {
    const previewEl = document.getElementById('adminChartPreview');
    if (!previewEl) return;

    const currentChart = {
        ...chartState,
        title: document.getElementById('chartTitle')?.value.trim() || '',
        xLabel: document.getElementById('chartXLabel')?.value.trim() || '',
        yLabel: document.getElementById('chartYLabel')?.value.trim() || ''
    };

    if (hasValidChartData(currentChart)) {
        previewEl.innerHTML = renderSmoothScatterSvg(currentChart, { width: 620, height: 290 });
    } else {
        previewEl.innerHTML =
            '<p class="text-light text-center chart-empty-hint">กรอกตัวเลขในตารางด้านบนเพื่อแสดงตัวอย่างกราฟเส้นเรียบโทน Muji</p>';
    }
}

function renderChartTable() {
    const thead = document.getElementById('chartTableHead');
    const tbody = document.getElementById('chartTableBody');
    if (!thead || !tbody) return;

    thead.innerHTML = '';
    const headRow = document.createElement('tr');

    const thX = document.createElement('th');
    thX.className = 'chart-col-x';
    thX.textContent = 'ค่าแกน X';
    headRow.appendChild(thX);

    chartState.seriesNames.forEach((name, sIdx) => {
        const th = document.createElement('th');
        const wrap = document.createElement('div');
        wrap.className = 'chart-series-head';

        const dot = document.createElement('span');
        dot.className = 'series-color-dot';
        dot.style.backgroundColor = MUJI_CHART_COLORS[sIdx % MUJI_CHART_COLORS.length];

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'chart-head-input';
        nameInput.value = name;
        nameInput.placeholder = `ชุดข้อมูล ${sIdx + 1}`;
        nameInput.addEventListener('input', (e) => {
            chartState.seriesNames[sIdx] = e.target.value;
            updateAdminChartPreview();
            scheduleAutoSave();
        });

        wrap.append(dot, nameInput);

        if (chartState.seriesNames.length > 1) {
            const delSeriesBtn = document.createElement('button');
            delSeriesBtn.type = 'button';
            delSeriesBtn.className = 'chart-del-btn';
            delSeriesBtn.textContent = '✕';
            delSeriesBtn.title = 'ลบชุดข้อมูลนี้';
            delSeriesBtn.addEventListener('click', () => {
                chartState.seriesNames.splice(sIdx, 1);
                chartState.rows.forEach((r) => r.values.splice(sIdx, 1));
                renderChartTable();
                scheduleAutoSave();
            });
            wrap.appendChild(delSeriesBtn);
        }

        th.appendChild(wrap);
        headRow.appendChild(th);
    });

    const thAction = document.createElement('th');
    thAction.className = 'chart-col-action';
    thAction.textContent = '';
    headRow.appendChild(thAction);
    thead.appendChild(headRow);

    tbody.innerHTML = '';
    chartState.rows.forEach((row, rIdx) => {
        const tr = document.createElement('tr');

        const tdX = document.createElement('td');
        const inputX = document.createElement('input');
        inputX.type = 'number';
        inputX.step = 'any';
        inputX.className = 'chart-cell-input';
        inputX.placeholder = '0';
        inputX.value = row.x;
        inputX.addEventListener('input', (e) => {
            chartState.rows[rIdx].x = e.target.value;
            updateAdminChartPreview();
            scheduleAutoSave();
        });
        tdX.appendChild(inputX);
        tr.appendChild(tdX);

        chartState.seriesNames.forEach((_, sIdx) => {
            const tdY = document.createElement('td');
            const inputY = document.createElement('input');
            inputY.type = 'number';
            inputY.step = 'any';
            inputY.className = 'chart-cell-input';
            inputY.placeholder = '-';
            inputY.value = row.values[sIdx] ?? '';
            inputY.addEventListener('input', (e) => {
                chartState.rows[rIdx].values[sIdx] = e.target.value;
                updateAdminChartPreview();
                scheduleAutoSave();
            });
            tdY.appendChild(inputY);
            tr.appendChild(tdY);
        });

        const tdAction = document.createElement('td');
        tdAction.className = 'chart-col-action';
        if (chartState.rows.length > 1) {
            const delRowBtn = document.createElement('button');
            delRowBtn.type = 'button';
            delRowBtn.className = 'chart-del-btn';
            delRowBtn.textContent = '-';
            delRowBtn.title = 'ลบแถวนี้';
            delRowBtn.addEventListener('click', () => {
                chartState.rows.splice(rIdx, 1);
                renderChartTable();
                scheduleAutoSave();
            });
            tdAction.appendChild(delRowBtn);
        }
        tr.appendChild(tdAction);
        tbody.appendChild(tr);
    });

    updateAdminChartPreview();
}

function addChartRow() {
    chartState.rows.push({
        x: '',
        values: new Array(chartState.seriesNames.length).fill('')
    });
    renderChartTable();
    scheduleAutoSave();
}

function addChartSeries() {
    if (chartState.seriesNames.length >= MAX_CHART_SERIES) {
        alert(`เพิ่มชุดข้อมูลได้สูงสุด ${MAX_CHART_SERIES} เส้นกราฟครับ`);
        return;
    }
    chartState.seriesNames.push(`ชุดข้อมูล ${chartState.seriesNames.length + 1}`);
    chartState.rows.forEach((row) => row.values.push(''));
    renderChartTable();
    scheduleAutoSave();
}

// ==========================================
// 3. จัดการรูปภาพ (สูงสุด 3 ภาพ + ครอบ 1:1 + คำอธิบายใต้ภาพสำหรับ PDF)
// ==========================================
function renderImagePreview() {
    const container = document.getElementById('imagePreview');
    if (!container) return;
    container.innerHTML = '';

    uploadedImages.forEach((imgSrc, index) => {
        if (!isSafeImageUrl(imgSrc)) return;

        const card = document.createElement('div');
        card.className = 'img-preview-card';

        const thumbWrap = document.createElement('div');
        thumbWrap.className = 'img-preview-item';

        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = `ภาพประกอบที่ ${index + 1}`;
        img.className = 'img-thumb';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'img-remove-btn';
        removeBtn.textContent = '✕';
        removeBtn.setAttribute('aria-label', `ลบรูปภาพที่ ${index + 1}`);
        removeBtn.addEventListener('click', () => {
            uploadedImages.splice(index, 1);
            imageCaptions.splice(index, 1);
            renderImagePreview();
            scheduleAutoSave();
        });

        thumbWrap.append(img, removeBtn);

        const captionWrap = document.createElement('div');
        captionWrap.className = 'img-caption-wrap';

        const captionLabel = document.createElement('label');
        captionLabel.className = 'img-caption-label';
        captionLabel.textContent = `รูปที่ ${index + 1} (แสดงเฉพาะใน PDF)`;

        const captionInput = document.createElement('input');
        captionInput.type = 'text';
        captionInput.className = 'img-caption-input';
        captionInput.placeholder = 'เช่น ชุดทดสอบและเกจวัดความดัน';
        captionInput.value = imageCaptions[index] || '';
        captionInput.addEventListener('input', (e) => {
            imageCaptions[index] = e.target.value;
            scheduleAutoSave();
        });

        captionWrap.append(captionLabel, captionInput);
        card.append(thumbWrap, captionWrap);
        container.appendChild(card);
    });
}

async function handleImageFiles(files) {
    const imageFiles = files.filter((file) => file.type && file.type.startsWith('image/'));
    if (imageFiles.length !== files.length) {
        alert('กรุณาเลือกเฉพาะไฟล์รูปภาพเท่านั้น');
    }
    if (imageFiles.length === 0) return;

    if (uploadedImages.length + imageFiles.length > MAX_IMAGES) {
        alert(`สามารถอัปโหลดภาพประกอบได้สูงสุด ${MAX_IMAGES} ภาพเท่านั้น`);
        return;
    }

    setSaveStatus('(กำลังประมวลผลรูปภาพ...)');
    for (const file of imageFiles) {
        if (uploadedImages.length >= MAX_IMAGES) break;
        try {
            const compressedDataUrl = await compressImageToDataUrl(file, 600, 0.72);
            uploadedImages.push(compressedDataUrl);
            if (imageCaptions.length < uploadedImages.length) {
                imageCaptions.push('');
            }
            renderImagePreview();
        } catch (err) {
            console.error('Image processing failed:', err);
            alert(`ไม่สามารถประมวลผลไฟล์ ${file.name} ได้`);
        }
    }

    scheduleAutoSave();
}

// ==========================================
// 4. รวบรวมข้อมูล / โหลดข้อมูล / บันทึก (Local + Cloud)
// ==========================================
function collectFormData() {
    const getListValues = (containerId) =>
        Array.from(document.querySelectorAll(`#${containerId} input`))
            .map((input) => input.value.trim())
            .filter(Boolean);

    const baseData = {
        entryType: currentEntryType,
        labDate: document.getElementById('labDate')?.value.trim() || '',
        course: document.getElementById('courseSelect')?.value.trim() || '',
        title: document.getElementById('labTitle')?.value.trim() || '',
        images: [...uploadedImages],
        imageCaptions: uploadedImages.map((_, i) => (imageCaptions[i] || '').trim()),
        updatedAt: new Date().toISOString()
    };

    if (currentEntryType === 'visit') {
        return {
            ...baseData,
            visitCategory: document.getElementById('visitCategory')?.value.trim() || 'เข้าฟังการบรรยาย',
            visitSpeaker: document.getElementById('visitSpeakerSelect')?.value.trim() || '',
            visitLocation: document.getElementById('visitLocation')?.value.trim() || '',
            visitTopics: getListValues('visitTopicList'),
            visitKnowledge: getListValues('visitKnowledgeList'),
            visitApplication: document.getElementById('visitApplication')?.value.trim() || '',
            visitSummary: document.getElementById('visitSummary')?.value.trim() || ''
        };
    }

    const problems = [];
    const problemCards = document.querySelectorAll('#problemList .problem-card');
    problemCards.forEach((card) => {
        const issue = card.querySelector('.problem-issue')?.value.trim() || '';
        const solution = card.querySelector('.problem-solution')?.value.trim() || '';
        if (issue || solution) {
            problems.push({ issue, solution });
        }
    });

    const flowSteps = Array.from(document.querySelectorAll('#flowchartSteps input'))
        .map((input) => input.value.trim())
        .filter(Boolean);

    const chart = {
        title: document.getElementById('chartTitle')?.value.trim() || '',
        xLabel: document.getElementById('chartXLabel')?.value.trim() || '',
        yLabel: document.getElementById('chartYLabel')?.value.trim() || '',
        seriesNames: chartState.seriesNames.map((n, idx) => n.trim() || `ชุดข้อมูล ${idx + 1}`),
        rows: chartState.rows.map((r) => ({
            x: String(r.x ?? '').trim(),
            values: r.values.map((v) => String(v ?? '').trim())
        }))
    };

    return {
        ...baseData,
        advisor: document.getElementById('advisorSelect')?.value.trim() || '',
        responsibility: document.getElementById('responsibility')?.value.trim() || '',
        objectives: getListValues('objectiveList'),
        equipments: getListValues('equipmentList'),
        problems,
        chart,
        summary: document.getElementById('labSummary')?.value.trim() || '',
        flowSteps
    };
}

function populateForm(data = {}) {
    isPopulatingForm = true;
    clearTimeout(saveTimeout);

    const type = data.entryType ? getEntryType(data) : currentEntryType;
    setEntryType(type, false);

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    // ฟิลด์ร่วม
    setVal('labDate', data.labDate);
    if (data.course) ensureSelectOption('courseSelect', data.course);
    setVal('courseSelect', data.course);
    setVal('labTitle', data.title);

    // ฟิลด์ Lab
    if (data.advisor) ensureSelectOption('advisorSelect', data.advisor);
    setVal('advisorSelect', data.advisor);
    setVal('responsibility', data.responsibility);
    setVal('labSummary', data.summary);

    chartState = normalizeChartState(data.chart);
    setVal('chartTitle', chartState.title);
    setVal('chartXLabel', chartState.xLabel);
    setVal('chartYLabel', chartState.yLabel);
    renderChartTable();

    const objContainer = document.getElementById('objectiveList');
    if (objContainer) {
        objContainer.innerHTML = '';
        const objectives = Array.isArray(data.objectives) && data.objectives.length ? data.objectives : [''];
        objectives.forEach((item) => addListItem('objectiveList', 'วัตถุประสงค์ข้อที่', item));
    }

    const eqContainer = document.getElementById('equipmentList');
    if (eqContainer) {
        eqContainer.innerHTML = '';
        const equipments = Array.isArray(data.equipments) && data.equipments.length ? data.equipments : [''];
        equipments.forEach((item) => addListItem('equipmentList', 'อุปกรณ์ชิ้นที่', item));
    }

    const probContainer = document.getElementById('problemList');
    if (probContainer) {
        probContainer.innerHTML = '';
        const problems =
            Array.isArray(data.problems) && data.problems.length ? data.problems : [{ issue: '', solution: '' }];
        problems.forEach((p) => addProblemPair(p.issue || '', p.solution || ''));
    }

    const flowContainer = document.getElementById('flowchartSteps');
    if (flowContainer) {
        flowContainer.innerHTML = '';
        flowStepCount = 0;
        const steps = Array.isArray(data.flowSteps) && data.flowSteps.length ? data.flowSteps : [''];
        steps.forEach((step) => addFlowchartStep(step));
    }

    // ฟิลด์ Visit / บรรยาย
    setVal('visitCategory', data.visitCategory || 'เข้าฟังการบรรยาย');
    if (data.visitSpeaker) ensureSelectOption('visitSpeakerSelect', data.visitSpeaker);
    setVal('visitSpeakerSelect', data.visitSpeaker);
    setVal('visitLocation', data.visitLocation);
    setVal('visitApplication', data.visitApplication);
    setVal('visitSummary', data.visitSummary);

    const topicContainer = document.getElementById('visitTopicList');
    if (topicContainer) {
        topicContainer.innerHTML = '';
        const topics = Array.isArray(data.visitTopics) && data.visitTopics.length ? data.visitTopics : [''];
        topics.forEach((item) => addListItem('visitTopicList', 'หัวข้อสำคัญข้อที่', item));
    }

    const knowledgeContainer = document.getElementById('visitKnowledgeList');
    if (knowledgeContainer) {
        knowledgeContainer.innerHTML = '';
        const knowledge =
            Array.isArray(data.visitKnowledge) && data.visitKnowledge.length ? data.visitKnowledge : [''];
        knowledge.forEach((item) => addListItem('visitKnowledgeList', 'ความรู้ที่ได้รับข้อที่', item));
    }

    // รูปภาพ + คำอธิบายใต้ภาพ
    uploadedImages = Array.isArray(data.images) ? data.images.filter(isSafeImageUrl).slice(0, MAX_IMAGES) : [];
    const savedCaptions = Array.isArray(data.imageCaptions) ? data.imageCaptions : [];
    imageCaptions = uploadedImages.map((_, i) => savedCaptions[i] || '');
    renderImagePreview();

    isPopulatingForm = false;
}

/**
 * บันทึกข้อมูลลงทั้ง localStorage (ทันที) และ Firestore (พร้อม timeout)
 * @param {boolean} showBanner
 */
async function saveLabNow(showBanner = false) {
    clearTimeout(saveTimeout);
    const labData = collectFormData();

    saveLocalLab(currentLabId, labData);
    savedLabsMap[currentLabId] = labData;
    renderLabSelector();

    if (!auth.currentUser) {
        setSaveStatus('(บันทึกในเครื่องแล้ว - ยังไม่ได้เข้าสู่ระบบ Firebase)', true);
        if (showBanner) {
            showActionFeedback(
                'บันทึกข้อมูลไว้ในเครื่องแล้ว แต่ยังไม่ได้เข้าสู่ระบบ Firebase จึงยังไม่ได้ซิงก์ขึ้น Cloud',
                'warning'
            );
        }
        return false;
    }

    setSaveStatus('(กำลังบันทึกขึ้น Cloud...)');
    try {
        const approxBytes = new Blob([JSON.stringify(labData)]).size;
        if (approxBytes > 950000) {
            throw Object.assign(new Error('ขนาดรูปภาพรวมใหญ่เกิน 1 MB'), { code: 'document-too-large' });
        }

        await withTimeout(setDoc(doc(db, 'labs', currentLabId), labData, { merge: true }), 15000);
        setSaveStatus('(บันทึกขึ้น Cloud แล้ว)');
        if (showBanner) {
            showActionFeedback(
                'บันทึกข้อมูลขึ้น Firebase Cloud เรียบร้อยแล้ว — ทุกคนที่เข้าเว็บ (รวมถึงมือถือ) สามารถเห็นข้อมูลนี้ได้ทันที',
                'success'
            );
        }
        return true;
    } catch (err) {
        console.error('Firestore save failed:', err);
        const code = err?.code || 'unknown';
        let hint = 'กรุณาตรวจสอบว่าสร้าง Firestore Database และตั้งค่า Security Rules แล้ว';
        if (code === 'permission-denied') {
            hint = 'สิทธิ์ถูกปฏิเสธ — กรุณาไปตั้งค่า Firestore Rules เป็น allow read: if true; allow write: if request.auth != null;';
        } else if (code === 'document-too-large') {
            hint = 'ขนาดรูปภาพรวมใหญ่เกินลิมิต 1 MB ของ Firestore — กรุณาลบรูปเก่าแล้วอัปโหลดใหม่อีกครั้ง';
        } else if (code === 'timeout' || code === 'unavailable') {
            hint = 'ไม่สามารถติดต่อ Firestore ได้ — กรุณาตรวจสอบว่าได้กด Create database ในเมนู Firestore Database ของ Firebase Console แล้ว';
        }

        setSaveStatus(`(บันทึกเฉพาะในเครื่อง / Cloud ผิดพลาด: ${code})`, true);
        showActionFeedback(
            `บันทึกเฉพาะในเครื่องนี้เท่านั้น (เครื่องอื่นจะยังไม่เห็น) เพราะส่งขึ้น Firebase ไม่สำเร็จ [${code}]: ${hint}`,
            'warning'
        );
        return false;
    }
}

function scheduleAutoSave() {
    if (isPopulatingForm) return;
    setSaveStatus('(กำลังบันทึก...)');
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveLabNow(false);
    }, 1000);
}

// ==========================================
// 5. จัดการรายการผลงานที่บันทึกไว้
// ==========================================
function renderLabSelector() {
    const selector = document.getElementById('labSelector');
    const deleteBtn = document.getElementById('btnDeleteLab');
    if (!selector) return;

    const entries = Object.entries(savedLabsMap).sort(([, a], [, b]) => {
        const timeA = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const timeB = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
    });

    selector.innerHTML = '';
    const newOpt = document.createElement('option');
    newOpt.value = '';
    newOpt.textContent = '-- สร้างรายการใหม่ --';
    selector.appendChild(newOpt);

    entries.forEach(([id, data]) => {
        const opt = document.createElement('option');
        opt.value = id;
        const typeTag = getEntryType(data) === 'visit' ? '[บรรยาย/เยี่ยมชม]' : '[ปฏิบัติการ]';
        opt.textContent = `${typeTag} ${data?.title || `(ไม่มีชื่อหัวข้อ - ${id})`}`;
        selector.appendChild(opt);
        if (data?.advisor) ensureSelectOption('advisorSelect', data.advisor);
        if (data?.course) ensureSelectOption('courseSelect', data.course);
        if (data?.visitSpeaker) ensureSelectOption('visitSpeakerSelect', data.visitSpeaker);
    });

    if (savedLabsMap[currentLabId]) {
        selector.value = currentLabId;
        if (deleteBtn) deleteBtn.classList.remove('hidden');
    } else {
        selector.value = '';
        if (deleteBtn) deleteBtn.classList.add('hidden');
    }
}

async function loadExistingLabs() {
    const localLabs = getLocalLabs();
    let cloudLabs = {};
    try {
        const snapshot = await withTimeout(getDocs(collection(db, 'labs')), 12000);
        snapshot.forEach((docSnap) => {
            cloudLabs[docSnap.id] = docSnap.data();
        });
    } catch (err) {
        console.warn('Failed to load existing labs from Firestore, using local cache:', err);
    }
    savedLabsMap = mergeLabs(cloudLabs, localLabs);
    renderLabSelector();
}

function startNewLab() {
    currentLabId = generateNewLabId();
    populateForm({ entryType: currentEntryType });
    renderLabSelector();
    setSaveStatus('พร้อมสร้างรายการใหม่');
    const banner = document.getElementById('action-feedback');
    if (banner) banner.classList.add('hidden');
}

async function deleteCurrentLab() {
    if (!savedLabsMap[currentLabId]) return;
    const confirmed = window.confirm('ต้องการลบผลงานนี้ออกจากระบบถาวรหรือไม่?');
    if (!confirmed) return;

    deleteLocalLab(currentLabId);
    delete savedLabsMap[currentLabId];

    try {
        if (auth.currentUser) {
            await withTimeout(deleteDoc(doc(db, 'labs', currentLabId)), 6000);
        }
        startNewLab();
        setSaveStatus('(ลบข้อมูลเรียบร้อยแล้ว)');
    } catch (err) {
        console.error('Cloud delete failed:', err);
        startNewLab();
        setSaveStatus('(ลบจากเครื่องแล้ว แต่ลบจาก Cloud ไม่สำเร็จ)', true);
    }
}

async function triggerDownloadPdf(triggerBtn) {
    const pagesContainer = document.getElementById('pdf-pages-container');
    const title = document.getElementById('labTitle')?.value || 'Portfolio';
    const originalText = triggerBtn?.textContent || 'Download PDF';

    if (triggerBtn) {
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'กำลังสร้างไฟล์ PDF...';
    }
    try {
        await downloadLabPdf(pagesContainer, title);
    } finally {
        if (triggerBtn) {
            triggerBtn.disabled = false;
            triggerBtn.textContent = originalText;
        }
    }
}

// ==========================================
// 6. ผูก Events และจัดการ Auth State
// ==========================================
function bindEvents() {
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const btnLogin = document.getElementById('btnLogin');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('adminEmail')?.value.trim() || '';
            const password = document.getElementById('adminPassword')?.value || '';

            if (loginError) loginError.classList.add('hidden');
            if (btnLogin) {
                btnLogin.disabled = true;
                btnLogin.textContent = 'กำลังเข้าสู่ระบบ...';
            }

            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                console.error('Login error:', error);
                if (loginError) {
                    loginError.textContent = 'เข้าสู่ระบบล้มเหลว กรุณาตรวจสอบอีเมลและรหัสผ่าน';
                    loginError.classList.remove('hidden');
                }
            } finally {
                if (btnLogin) {
                    btnLogin.disabled = false;
                    btnLogin.textContent = 'เข้าสู่ระบบ';
                }
            }
        });
    }

    document.getElementById('btnLogout')?.addEventListener('click', async () => {
        clearTimeout(saveTimeout);
        await signOut(auth);
    });

    // สลับประเภทผลงาน (ปฏิบัติการ / เข้าฟังการบรรยาย-เยี่ยมชม)
    document.getElementById('btnTypeLab')?.addEventListener('click', () => {
        setEntryType('lab', Boolean(savedLabsMap[currentLabId]));
    });
    document.getElementById('btnTypeVisit')?.addEventListener('click', () => {
        setEntryType('visit', Boolean(savedLabsMap[currentLabId]));
    });

    document.getElementById('labSelector')?.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (!selectedId) {
            startNewLab();
            return;
        }
        currentLabId = selectedId;
        populateForm(savedLabsMap[selectedId] || {});
        renderLabSelector();
        setSaveStatus('โหลดข้อมูลเรียบร้อย');
    });

    document.getElementById('btnNewLab')?.addEventListener('click', startNewLab);
    document.getElementById('btnDeleteLab')?.addEventListener('click', deleteCurrentLab);
    document.getElementById('btnLoadSample')?.addEventListener('click', () => {
        const sample = currentEntryType === 'visit' ? SAMPLE_VISIT_DATA : SAMPLE_LAB_DATA;
        populateForm(sample);
        showActionFeedback(
            'กรอกข้อมูลตัวอย่างลงฟอร์มแล้ว สามารถกด "บันทึกข้อมูลทันที" หรือ "สร้างเอกสาร PDF" ได้เลย',
            'success'
        );
        scheduleAutoSave();
    });

    // ปุ่มเพิ่มรายการใน Dropdown (รายวิชา, อาจารย์, วิทยากร/หน่วยงาน)
    document.getElementById('btnAddCourse')?.addEventListener('click', () => {
        handleAddSelectOption('newCourse', 'courseSelect');
    });
    document.getElementById('newCourse')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSelectOption('newCourse', 'courseSelect');
        }
    });

    document.getElementById('btnAddAdvisor')?.addEventListener('click', () => {
        handleAddSelectOption('newAdvisor', 'advisorSelect');
    });
    document.getElementById('newAdvisor')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSelectOption('newAdvisor', 'advisorSelect');
        }
    });

    document.getElementById('btnAddVisitSpeaker')?.addEventListener('click', () => {
        handleAddSelectOption('newVisitSpeaker', 'visitSpeakerSelect');
    });
    document.getElementById('newVisitSpeaker')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSelectOption('newVisitSpeaker', 'visitSpeakerSelect');
        }
    });

    // รายการ dynamic (Lab)
    document.getElementById('btnAddObjective')?.addEventListener('click', () => {
        addListItem('objectiveList', 'วัตถุประสงค์ข้อที่');
    });
    document.getElementById('btnAddEquipment')?.addEventListener('click', () => {
        addListItem('equipmentList', 'อุปกรณ์ชิ้นที่');
    });
    document.getElementById('btnAddProblem')?.addEventListener('click', () => {
        addProblemPair();
    });
    document.getElementById('btnAddFlowStep')?.addEventListener('click', () => {
        addFlowchartStep();
    });
    document.getElementById('btnRemoveFlowStep')?.addEventListener('click', removeFlowchartStep);

    // รายการ dynamic (Visit / บรรยาย)
    document.getElementById('btnAddVisitTopic')?.addEventListener('click', () => {
        addListItem('visitTopicList', 'หัวข้อสำคัญข้อที่');
    });
    document.getElementById('btnAddVisitKnowledge')?.addEventListener('click', () => {
        addListItem('visitKnowledgeList', 'ความรู้ที่ได้รับข้อที่');
    });

    // กราฟ
    document.getElementById('btnAddChartRow')?.addEventListener('click', addChartRow);
    document.getElementById('btnAddChartSeries')?.addEventListener('click', addChartSeries);
    ['chartTitle', 'chartXLabel', 'chartYLabel'].forEach((id) => {
        document.getElementById(id)?.addEventListener('input', () => {
            updateAdminChartPreview();
        });
    });

    // อัปโหลดรูปภาพ
    const uploadBox = document.getElementById('uploadBox');
    const imageUpload = document.getElementById('imageUpload');
    if (uploadBox && imageUpload) {
        uploadBox.addEventListener('click', () => imageUpload.click());
        uploadBox.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                imageUpload.click();
            }
        });
        imageUpload.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            e.target.value = '';
            await handleImageFiles(files);
        });
    }

    document.addEventListener('input', (e) => {
        if (e.target instanceof HTMLElement && e.target.classList.contains('auto-save')) {
            scheduleAutoSave();
        }
    });
    document.addEventListener('change', (e) => {
        if (e.target instanceof HTMLElement && e.target.classList.contains('auto-save')) {
            scheduleAutoSave();
        }
    });

    const btnSaveNow = document.getElementById('btnSaveNow');
    btnSaveNow?.addEventListener('click', async () => {
        btnSaveNow.disabled = true;
        btnSaveNow.textContent = 'กำลังบันทึก...';
        try {
            await saveLabNow(true);
        } finally {
            btnSaveNow.disabled = false;
            btnSaveNow.textContent = 'บันทึกข้อมูลทันที';
        }
    });

    document.getElementById('btnPreviewPdf')?.addEventListener('click', () => {
        const labData = collectFormData();
        switchView('preview-view');
        renderPdfPreview(labData, document.getElementById('pdf-pages-container'), currentLabId);
        saveLabNow(false);
    });

    document.getElementById('btnBackToForm')?.addEventListener('click', () => {
        switchView('admin-form-view');
    });

    document.getElementById('btnPrintPdf')?.addEventListener('click', () => {
        window.print();
    });

    const btnDownloadTop = document.getElementById('btnDownloadPdfTop');
    btnDownloadTop?.addEventListener('click', () => triggerDownloadPdf(btnDownloadTop));

    const btnDownloadBottom = document.getElementById('btnDownloadPdf');
    btnDownloadBottom?.addEventListener('click', () => triggerDownloadPdf(btnDownloadBottom));
}

window.addEventListener('DOMContentLoaded', () => {
    bindEvents();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadExistingLabs();
            if (flowStepCount === 0) {
                populateForm({ entryType: currentEntryType });
            }
            switchView('admin-form-view');
        } else {
            switchView('login-view');
        }
    });
});
