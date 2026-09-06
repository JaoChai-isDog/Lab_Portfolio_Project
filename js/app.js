/**
 * Application Controller - Engineering Lab Portfolio
 * Manages State, Form Editing, Live Rendering, Chart.js, LocalStorage, and View Navigation
 */

document.addEventListener("DOMContentLoaded", () => {
  // Main State
  let labData = null;
  let chartInstance = null;
  const LOCAL_STORAGE_KEY = "eng_lab_portfolio_current_data";

  // --- Initial Load ---
  function initApp() {
    loadSavedDataOrPreset();
    setupEventListeners();
    setupViewSwitcher();
    renderAllViews();
  }

  // Load from localStorage or fall back to Electrical Engineering Preset
  function loadSavedDataOrPreset() {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      try {
        labData = JSON.parse(saved);
        console.log("Loaded lab data from localStorage");
        return;
      } catch (e) {
        console.warn("Failed to parse saved data, loading default preset.");
      }
    }
    // Fallback to electrical sample lab
    labData = JSON.parse(JSON.stringify(SAMPLE_LABS.electrical));
  }

  function saveDataToLocalStorage() {
    if (labData) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(labData));
    }
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Preset Selector
    const presetSelect = document.getElementById("select-preset");
    if (presetSelect) {
      presetSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (SAMPLE_LABS[val]) {
          labData = JSON.parse(JSON.stringify(SAMPLE_LABS[val]));
          saveDataToLocalStorage();
          renderAllViews();
        }
      });
    }

    // New Lab Button
    const btnNew = document.getElementById("btn-new-lab");
    if (btnNew) {
      btnNew.addEventListener("click", () => {
        if (confirm("คุณต้องการสร้าง Lab ใหม่ใช่หรือไม่? (ข้อมูลเดิมจะถูกรีเซ็ต)")) {
          createNewBlankLab();
          renderAllViews();
        }
      });
    }

    // Export JSON Button
    const btnExportJson = document.getElementById("btn-export-json");
    if (btnExportJson) {
      btnExportJson.addEventListener("click", exportLabAsJSON);
    }

    // Import JSON File
    const fileImport = document.getElementById("file-import-json");
    if (fileImport) {
      fileImport.addEventListener("change", handleImportJSON);
    }

    // PDF Export Button
    const btnPdf = document.getElementById("btn-export-pdf");
    if (btnPdf) {
      btnPdf.addEventListener("click", () => {
        // Switch to A4 view before exporting to ensure accurate capture
        switchView("a4");
        setTimeout(() => {
          const filename = `${labData.general.labCode || 'Lab_Report'}_${labData.general.labTitle || 'Portfolio'}.pdf`.replace(/[^a-zA-Z0-9_\-\.\u0E00-\u0E7F]/g, "_");
          PDFExporter.exportToPDF("a4-document-content", filename);
        }, 200);
      });
    }

    // Add Dynamic Buttons
    document.getElementById("btn-add-equip")?.addEventListener("click", addEquipRow);
    document.getElementById("btn-add-step")?.addEventListener("click", addProcedureRow);
    document.getElementById("btn-add-result-row")?.addEventListener("click", addResultRow);

    // Form inputs real-time binding
    setupFormInputsBinding();
  }

  // --- View Switcher ---
  function setupViewSwitcher() {
    const buttons = document.querySelectorAll(".view-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const viewName = btn.dataset.view;
        switchView(viewName);
      });
    });
  }

  function switchView(viewName) {
    document.querySelectorAll(".view-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view-section").forEach(s => s.classList.remove("active"));

    const targetBtn = document.querySelector(`.view-btn[data-view="${viewName}"]`);
    const targetSec = document.getElementById(`view-${viewName}`);

    if (targetBtn) targetBtn.classList.add("active");
    if (targetSec) targetSec.classList.add("active");

    if (viewName === "web" || viewName === "a4") {
      renderAllViews();
    }
  }

  // --- Form Inputs Real-time Binding ---
  function setupFormInputsBinding() {
    const bindInput = (id, pathString) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", (e) => {
        setNestedValue(labData, pathString, e.target.value);
        saveDataToLocalStorage();
        renderWebAndA4Views();
      });
    };

    bindInput("inp-lab-title", "general.labTitle");
    bindInput("inp-lab-code", "general.labCode");
    bindInput("inp-subject", "general.subjectName");
    bindInput("inp-institution", "general.institution");
    bindInput("inp-department", "general.department");
    bindInput("inp-student-name", "general.studentName");
    bindInput("inp-student-id", "general.studentId");
    bindInput("inp-group", "general.groupNo");
    bindInput("inp-instructor", "general.instructor");
    bindInput("inp-date", "general.date");
    bindInput("inp-location", "general.location");

    bindInput("inp-objective", "objective");
    bindInput("inp-theory", "theory");
    bindInput("inp-conclusion", "conclusion");
    bindInput("inp-web-url", "webUrl");
  }

  function setNestedValue(obj, path, value) {
    const keys = path.split(".");
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) current[keys[i]] = {};
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  // --- Blank Lab Creation ---
  function createNewBlankLab() {
    labData = {
      id: "lab_" + Date.now(),
      general: {
        labTitle: "ชื่อการทดลองใหม่ (New Engineering Experiment)",
        labCode: "ENG-101",
        subjectName: "วิชาปฏิบัติการวิศวกรรม",
        institution: "คณะวิศวกรรมศาสตร์ มหาวิทยาลัย",
        department: "ภาควิชาวิศวกรรม",
        studentName: "ชื่อ-นามสกุล ผู้ทดลอง",
        studentId: "65000000",
        groupNo: "กลุ่มที่ 1",
        instructor: "อาจารย์ผู้ตรวจ",
        date: new Date().toISOString().split("T")[0],
        location: "ห้องปฏิบัติการ"
      },
      objective: "1. ระบุวัตถุประสงค์ข้อที่ 1\n2. ระบุวัตถุประสงค์ข้อที่ 2",
      theory: "พิมพ์ทฤษฎีหรือหลักการของการทดลองที่นี่...",
      equipments: [
        { name: "ชื่ออุปกรณ์ 1", spec: "รุ่น / คุณสมบัติ", qty: "1 ชุด", note: "หมายเหตุ" }
      ],
      procedures: [
        { step: 1, title: "ขั้นตอนที่ 1", detail: "รายละเอียดวิธีการทดลอง..." }
      ],
      resultsTable: {
        headers: ["รายการ / ค่าที่ปรับ", "ผลการทดสอบ A", "ผลการทดสอบ B"],
        rows: [
          ["ทดสอบครั้งที่ 1", "10", "20"],
          ["ทดสอบครั้งที่ 2", "15", "25"]
        ]
      },
      chartData: {
        labels: ["ครั้งที่ 1", "ครั้งที่ 2"],
        datasetLabel: "ค่าผลลัพธ์",
        values: [10, 15],
        xAxisLabel: "การทดสอบ",
        yAxisLabel: "ค่าที่วัดได้"
      },
      conclusion: "สรุปผลการทดลองและการวิเคราะห์...",
      webUrl: window.location.href
    };
    saveDataToLocalStorage();
  }

  // --- Render Functions ---
  function renderAllViews() {
    renderFormEditor();
    renderWebAndA4Views();
  }

  function renderFormEditor() {
    if (!labData) return;

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };

    setVal("inp-lab-title", labData.general?.labTitle);
    setVal("inp-lab-code", labData.general?.labCode);
    setVal("inp-subject", labData.general?.subjectName);
    setVal("inp-institution", labData.general?.institution);
    setVal("inp-department", labData.general?.department);
    setVal("inp-student-name", labData.general?.studentName);
    setVal("inp-student-id", labData.general?.studentId);
    setVal("inp-group", labData.general?.groupNo);
    setVal("inp-instructor", labData.general?.instructor);
    setVal("inp-date", labData.general?.date);
    setVal("inp-location", labData.general?.location);

    setVal("inp-objective", labData.objective);
    setVal("inp-theory", labData.theory);
    setVal("inp-conclusion", labData.conclusion);
    setVal("inp-web-url", labData.webUrl || window.location.href);

    // Render Dynamic Items in Form
    renderFormEquipments();
    renderFormProcedures();
    renderFormResultsTable();
  }

  // Dynamic Equipment Rows in Form
  function renderFormEquipments() {
    const container = document.getElementById("form-equip-container");
    if (!container) return;
    container.innerHTML = "";

    (labData.equipments || []).forEach((eq, index) => {
      const div = document.createElement("div");
      div.className = "dynamic-item";
      div.innerHTML = `
        <div class="item-header">
          <span class="item-index">อุปกรณ์ #${index + 1}</span>
          <button type="button" class="btn btn-danger btn-sm" onclick="removeEquipRow(${index})">
            <i class="fa-solid fa-trash-can"></i> ลบ
          </button>
        </div>
        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">ชื่ออุปกรณ์</label>
            <input type="text" class="form-control" value="${eq.name || ''}" oninput="updateEquipData(${index}, 'name', this.value)">
          </div>
          <div class="form-group">
            <label class="form-label">สเปก / รุ่น</label>
            <input type="text" class="form-control" value="${eq.spec || ''}" oninput="updateEquipData(${index}, 'spec', this.value)">
          </div>
          <div class="form-group">
            <label class="form-label">จำนวน</label>
            <input type="text" class="form-control" value="${eq.qty || ''}" oninput="updateEquipData(${index}, 'qty', this.value)">
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  }

  window.updateEquipData = (index, field, value) => {
    if (labData.equipments[index]) {
      labData.equipments[index][field] = value;
      saveDataToLocalStorage();
      renderWebAndA4Views();
    }
  };

  window.removeEquipRow = (index) => {
    labData.equipments.splice(index, 1);
    saveDataToLocalStorage();
    renderFormEquipments();
    renderWebAndA4Views();
  };

  function addEquipRow() {
    if (!labData.equipments) labData.equipments = [];
    labData.equipments.push({ name: "", spec: "", qty: "1", note: "" });
    saveDataToLocalStorage();
    renderFormEquipments();
    renderWebAndA4Views();
  }

  // Dynamic Procedure Steps in Form
  function renderFormProcedures() {
    const container = document.getElementById("form-steps-container");
    if (!container) return;
    container.innerHTML = "";

    (labData.procedures || []).forEach((proc, index) => {
      const div = document.createElement("div");
      div.className = "dynamic-item";
      div.innerHTML = `
        <div class="item-header">
          <span class="item-index">ขั้นตอน #${index + 1}</span>
          <button type="button" class="btn btn-danger btn-sm" onclick="removeProcedureRow(${index})">
            <i class="fa-solid fa-trash-can"></i> ลบ
          </button>
        </div>
        <div class="form-group">
          <label class="form-label">หัวข้อขั้นตอน</label>
          <input type="text" class="form-control" value="${proc.title || ''}" oninput="updateProcData(${index}, 'title', this.value)">
        </div>
        <div class="form-group">
          <label class="form-label">รายละเอียดวิธีทำ</label>
          <textarea class="form-control" style="min-height:60px" oninput="updateProcData(${index}, 'detail', this.value)">${proc.detail || ''}</textarea>
        </div>
      `;
      container.appendChild(div);
    });
  }

  window.updateProcData = (index, field, value) => {
    if (labData.procedures[index]) {
      labData.procedures[index][field] = value;
      saveDataToLocalStorage();
      renderWebAndA4Views();
    }
  };

  window.removeProcedureRow = (index) => {
    labData.procedures.splice(index, 1);
    saveDataToLocalStorage();
    renderFormProcedures();
    renderWebAndA4Views();
  };

  function addProcedureRow() {
    if (!labData.procedures) labData.procedures = [];
    labData.procedures.push({ step: labData.procedures.length + 1, title: "", detail: "" });
    saveDataToLocalStorage();
    renderFormProcedures();
    renderWebAndA4Views();
  }

  // Dynamic Results Table Editor in Form
  function renderFormResultsTable() {
    const container = document.getElementById("form-results-table-container");
    if (!container || !labData.resultsTable) return;

    let html = `<table class="editor-table"><thead><tr>`;
    labData.resultsTable.headers.forEach((h, colIdx) => {
      html += `<th><input type="text" value="${h}" oninput="updateTableHead(${colIdx}, this.value)"></th>`;
    });
    html += `</tr></thead><tbody>`;

    labData.resultsTable.rows.forEach((row, rowIdx) => {
      html += `<tr>`;
      row.forEach((cell, colIdx) => {
        html += `<td><input type="text" value="${cell}" oninput="updateTableCell(${rowIdx}, ${colIdx}, this.value)"></td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table>`;

    container.innerHTML = html;
  }

  window.updateTableHead = (colIdx, val) => {
    labData.resultsTable.headers[colIdx] = val;
    saveDataToLocalStorage();
    renderWebAndA4Views();
  };

  window.updateTableCell = (rowIdx, colIdx, val) => {
    labData.resultsTable.rows[rowIdx][colIdx] = val;
    saveDataToLocalStorage();
    renderWebAndA4Views();
  };

  function addResultRow() {
    if (!labData.resultsTable) {
      labData.resultsTable = { headers: ["คอลัมน์ 1", "คอลัมน์ 2"], rows: [] };
    }
    const emptyRow = labData.resultsTable.headers.map(() => "");
    labData.resultsTable.rows.push(emptyRow);
    saveDataToLocalStorage();
    renderFormResultsTable();
    renderWebAndA4Views();
  }

  // --- Render Both Web Portfolio View and A4 Document View ---
  function renderWebAndA4Views() {
    if (!labData) return;

    renderWebPortfolioView();
    renderA4DocumentView();
    QRCodeHelper.init("web-qr-code", "a4-qr-code");
    QRCodeHelper.update(labData.webUrl || window.location.href);
  }

  // --- 1. Render Modern Web Portfolio View ---
  function renderWebPortfolioView() {
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text || "-";
    };

    setText("web-lab-title", labData.general.labTitle);
    setText("web-lab-code", labData.general.labCode);
    setText("web-subject", labData.general.subjectName);
    setText("web-institution", labData.general.institution);
    setText("web-department", labData.general.department);
    setText("web-student-name", labData.general.studentName);
    setText("web-student-id", labData.general.studentId);
    setText("web-group", labData.general.groupNo);
    setText("web-instructor", labData.general.instructor);
    setText("web-date", labData.general.date);
    setText("web-location", labData.general.location);

    setText("web-objective", labData.objective);
    setText("web-theory", labData.theory);
    setText("web-conclusion", labData.conclusion);
    setText("web-url-text", labData.webUrl || window.location.href);

    // Equipment Cards
    const equipContainer = document.getElementById("web-equip-grid");
    if (equipContainer) {
      equipContainer.innerHTML = "";
      (labData.equipments || []).forEach(eq => {
        const card = document.createElement("div");
        card.className = "equip-card";
        card.innerHTML = `
          <div class="equip-name">
            <i class="fa-solid fa-microchip" style="color:var(--cyan-accent)"></i>
            ${eq.name || 'อุปกรณ์'}
          </div>
          <div class="equip-spec">${eq.spec || ''}</div>
          <div class="equip-meta">
            <span>จำนวน: <strong>${eq.qty || '1'}</strong></span>
            <span>${eq.note || ''}</span>
          </div>
        `;
        equipContainer.appendChild(card);
      });
    }

    // Procedure Steps Timeline
    const procContainer = document.getElementById("web-steps-list");
    if (procContainer) {
      procContainer.innerHTML = "";
      (labData.procedures || []).forEach((proc, idx) => {
        const item = document.createElement("div");
        item.className = "timeline-item";
        item.innerHTML = `
          <div class="timeline-badge">${idx + 1}</div>
          <div class="timeline-content">
            <div class="timeline-step-title">${proc.title || 'ขั้นตอนที่ ' + (idx + 1)}</div>
            <div class="text-content" style="font-size:0.9rem">${proc.detail || ''}</div>
          </div>
        `;
        procContainer.appendChild(item);
      });
    }

    // Web Data Table
    const tableContainer = document.getElementById("web-table-container");
    if (tableContainer && labData.resultsTable) {
      let html = `<table class="portfolio-table"><thead><tr>`;
      labData.resultsTable.headers.forEach(h => html += `<th>${h}</th>`);
      html += `</tr></thead><tbody>`;
      labData.resultsTable.rows.forEach(r => {
        html += `<tr>`;
        r.forEach(cell => html += `<td>${cell}</td>`);
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      tableContainer.innerHTML = html;
    }

    // Web Chart rendering
    renderWebChart();
  }

  function renderWebChart() {
    const canvas = document.getElementById("webChartCanvas");
    if (!canvas || !labData.chartData) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const ctx = canvas.getContext("2d");
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labData.chartData.labels,
        datasets: [{
          label: labData.chartData.datasetLabel || 'ค่าจากการทดลอง',
          data: labData.chartData.values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          borderWidth: 3,
          pointBackgroundColor: '#06b6d4',
          pointRadius: 5,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Prompt' } }
          }
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8', font: { family: 'Sarabun' } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            title: { display: true, text: labData.chartData.xAxisLabel || '', color: '#cbd5e1' }
          },
          y: {
            ticks: { color: '#94a3b8', font: { family: 'Sarabun' } },
            grid: { color: 'rgba(255,255,255,0.05)' },
            title: { display: true, text: labData.chartData.yAxisLabel || '', color: '#cbd5e1' }
          }
        }
      }
    });
  }

  // --- 2. Render Academic A4 Document View ---
  function renderA4DocumentView() {
    const setText = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text || "-";
    };

    setText("a4-inst-name", labData.general.institution);
    setText("a4-dept-name", `${labData.general.department || ''} | ${labData.general.subjectName || ''}`);
    setText("a4-lab-code", labData.general.labCode);
    setText("a4-lab-title", labData.general.labTitle);

    setText("a4-student-name", labData.general.studentName);
    setText("a4-student-id", labData.general.studentId);
    setText("a4-group", labData.general.groupNo);
    setText("a4-instructor", labData.general.instructor);
    setText("a4-date", labData.general.date);
    setText("a4-location", labData.general.location);

    setText("a4-objective", labData.objective);
    setText("a4-theory", labData.theory);
    setText("a4-conclusion", labData.conclusion);

    // Equipments list in A4
    const equipContainer = document.getElementById("a4-equip-list");
    if (equipContainer) {
      equipContainer.innerHTML = "";
      (labData.equipments || []).forEach(eq => {
        const item = document.createElement("div");
        item.className = "a4-equip-item";
        item.innerHTML = `<strong>${eq.name || ''}</strong> (${eq.spec || ''}) - ${eq.qty || '1'}`;
        equipContainer.appendChild(item);
      });
    }

    // Steps list in A4
    const procContainer = document.getElementById("a4-steps-list");
    if (procContainer) {
      procContainer.innerHTML = "";
      (labData.procedures || []).forEach((proc, idx) => {
        const item = document.createElement("div");
        item.className = "a4-step-item";
        item.innerHTML = `<span class="a4-step-no">ขั้นตอนที่ ${idx + 1}: ${proc.title || ''}</span> - ${proc.detail || ''}`;
        procContainer.appendChild(item);
      });
    }

    // Results table in A4
    const tableContainer = document.getElementById("a4-table-container");
    if (tableContainer && labData.resultsTable) {
      let html = `<table class="a4-table"><thead><tr>`;
      labData.resultsTable.headers.forEach(h => html += `<th>${h}</th>`);
      html += `</tr></thead><tbody>`;
      labData.resultsTable.rows.forEach(r => {
        html += `<tr>`;
        r.forEach(cell => html += `<td>${cell}</td>`);
        html += `</tr>`;
      });
      html += `</tbody></table>`;
      tableContainer.innerHTML = html;
    }
  }

  // --- Export JSON ---
  function exportLabAsJSON() {
    if (!labData) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(labData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${labData.general.labCode || 'Lab'}_Portfolio.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  // --- Import JSON ---
  function handleImportJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (imported.general && imported.labTitle !== undefined) {
          labData = imported;
          saveDataToLocalStorage();
          renderAllViews();
          alert("นำเข้าข้อมูล Lab สำเร็จแล้ว!");
        } else {
          alert("รูปแบบไฟล์ JSON ไม่ถูกต้อง");
        }
      } catch (err) {
        alert("เกิดข้อผิดพลาดในการอ่านไฟล์ JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  // Initialize
  initApp();
});
