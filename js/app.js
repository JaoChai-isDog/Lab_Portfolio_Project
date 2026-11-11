import { auth, db, signInWithEmailAndPassword, doc, setDoc } from './firebase-config.js';

let currentLabId = "lab_" + new Date().getTime(); 
let flowStepCount = 0;

// ระบบสลับหน้า
window.switchView = (viewId) => {
    document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(viewId).classList.remove('hidden');
}

// 1. ระบบ Login
document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        switchView('admin-form-view');
        if(flowStepCount === 0) addFlowchartStep(); // สร้างกล่องแรกให้ตอนเข้าฟอร์ม
    } catch (error) {
        alert('เข้าสู่ระบบล้มเหลว กรุณาตรวจสอบอีเมลและรหัสผ่าน');
    }
});

// 2. ฟังก์ชันเพิ่มรายการตาม Wireframe (วงกลมข้างหน้า)
window.addListItem = (containerId, placeholder, type) => {
    const container = document.getElementById(containerId);
    const div = document.createElement('div');
    div.className = 'flex-row mb-10';
    div.innerHTML = `
        <span style="line-height: 40px;">○</span>
        <input type="text" class="auto-save" placeholder="${placeholder} ${container.children.length + 1}">
        <button class="btn-secondary" onclick="this.parentElement.remove()">-</button>
    `;
    container.appendChild(div);
}

// ฟังก์ชันเพิ่ม ปัญหา-แนวทาง (คู่กัน)
window.addProblemPair = () => {
    const container = document.getElementById('problemList');
    const num = container.children.length + 1;
    const div = document.createElement('div');
    div.style.border = '1px solid #dcdcdc'; div.style.padding = '10px'; div.style.marginBottom = '10px';
    div.innerHTML = `
        <div class="flex-row mb-10"><span style="line-height: 40px;">○</span><input type="text" class="auto-save" placeholder="ปัญหาที่พบ ${num}"></div>
        <div class="flex-row"><span style="line-height: 40px;">○</span><input type="text" class="auto-save" placeholder="แนวทางการแก้ไข ${num}">
        <button class="btn-secondary" onclick="this.parentElement.parentElement.remove()">ลบ</button></div>
    `;
    container.appendChild(div);
}

// 3. ระบบ Flowchart (+/- กล่องแนวตั้ง)
window.addFlowchartStep = () => {
    flowStepCount++;
    const container = document.getElementById('flowchartSteps');
    const div = document.createElement('div');
    div.id = `flow-step-${flowStepCount}`;
    div.innerHTML = `
        <div class="flow-box">
            ขั้นตอนที่ ${flowStepCount}
            <input type="text" class="w-100 mt-10 auto-save" placeholder="รายละเอียด...">
        </div>
        <div class="flow-arrow">↓</div>
    `;
    container.appendChild(div);
}

window.removeFlowchartStep = () => {
    if (flowStepCount > 1) {
        document.getElementById(`flow-step-${flowStepCount}`).remove();
        flowStepCount--;
    }
}

// 4. ระบบ Auto-save (ทำงานเมื่อคลาส auto-save มีการพิมพ์)
let saveTimeout;
document.addEventListener('input', (e) => {
    if(e.target.classList.contains('auto-save')) {
        const status = document.getElementById('save-status');
        status.innerText = "(กำลังบันทึก...)";
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const labData = {
                title: document.getElementById('labTitle').value,
                updatedAt: new Date().toISOString()
                // จะเขียนโค้ดดึงข้อมูลทั้งหมดลง DB ในสเต็ปถัดไป
            };
            try {
                await setDoc(doc(db, "labs", currentLabId), labData, { merge: true });
                status.innerText = "(บันทึกแล้ว)";
            } catch (err) { console.error(err); }
        }, 1000);
    }
});

// 5. ระบบแปลง PDF (แสดงชื่อหัวข้อ และสร้าง QR Code)
// ==========================================
// 1. ฟังก์ชันเพิ่มชื่ออาจารย์ลงใน Dropdown
// ==========================================
window.addAdvisor = () => {
    const input = document.getElementById('newAdvisor');
    const select = document.getElementById('advisorSelect');
    if (input.value.trim() !== '') {
        const option = document.createElement('option');
        option.value = input.value.trim();
        option.text = input.value.trim();
        select.add(option);
        select.value = input.value.trim(); // เลือกชื่อที่เพิ่งเพิ่มอัตโนมัติ
        input.value = ''; // ล้างช่องกรอก
    }
};

// ==========================================
// 2. ฟังก์ชันดึงข้อมูลจาก Form ไปสร้างหน้า PDF
// ==========================================
window.preparePreview = () => {
    // ดึงชื่อหัวข้อมาแสดงบน Header ของ PDF
    const title = document.getElementById('labTitle').value || 'ไม่ได้ระบุหัวข้อปฏิบัติการ';
    document.getElementById('pdf-title').innerText = title;
    
    // สร้าง QR Code ชี้ไปที่เว็บหน้าหลัก
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
        text: window.location.href, 
        width: 80, height: 80
    });

    // --- กวาดข้อมูลจากฟอร์ม ---
    const advisor = document.getElementById('advisorSelect').value || '-';
    const responsibility = document.getElementById('responsibility').value || '-';
    const summary = document.getElementById('labSummary').value || '-';

    // ฟังก์ชันช่วยดึงข้อมูลจากรายการที่มีหลายข้อ (วัตถุประสงค์, อุปกรณ์)
    const getListValues = (containerId) => {
        return Array.from(document.querySelectorAll(`#${containerId} input`))
            .map(input => input.value.trim())
            .filter(val => val !== '');
    };
    const objectives = getListValues('objectiveList');
    const equipments = getListValues('equipmentList');

    // ดึงข้อมูล ปัญหาและแนวทางแก้ไข (มาเป็นคู่)
    const problems = [];
    const problemPairs = document.getElementById('problemList').children;
    for (let i = 0; i < problemPairs.length; i++) {
        const inputs = problemPairs[i].querySelectorAll('input');
        if (inputs.length === 2 && (inputs[0].value.trim() || inputs[1].value.trim())) {
            problems.push({ issue: inputs[0].value.trim(), solution: inputs[1].value.trim() });
        }
    }

    // ดึงข้อมูลขั้นตอน Flowchart
    const flowSteps = Array.from(document.querySelectorAll('#flowchartSteps input'))
        .map(input => input.value.trim() || '...');

    // --- สร้าง HTML สำหรับแสดงผลใน PDF ---
    let htmlContent = `
        <div style="margin-bottom: 15px; font-size: 0.95rem;">
            <p><strong>อาจารย์ที่ปรึกษาประจำปฏิบัติการ:</strong> ${advisor}</p>
            <p style="margin-top: 5px;"><strong>ความรับผิดชอบ:</strong> ${responsibility}</p>
        </div>

        <div style="margin-bottom: 15px; font-size: 0.95rem;">
            <strong>วัตถุประสงค์:</strong>
            <ul style="padding-left: 20px; margin-top: 5px;">
                ${objectives.length ? objectives.map(o => `<li>${o}</li>`).join('') : '<li>-</li>'}
            </ul>
        </div>

        <div style="margin-bottom: 15px; font-size: 0.95rem;">
            <strong>เครื่องมือและอุปกรณ์ที่ใช้ในปฏิบัติการ:</strong>
            <ul style="padding-left: 20px; margin-top: 5px;">
                ${equipments.length ? equipments.map(e => `<li>${e}</li>`).join('') : '<li>-</li>'}
            </ul>
        </div>

        <div style="margin-bottom: 15px; font-size: 0.95rem;">
            <strong>ปัญหาที่พบ และ แนวทางการแก้ไข:</strong>
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; border: 1px solid #333;">
                <tr style="background-color: #f5f5f5;">
                    <th style="border: 1px solid #333; padding: 8px; text-align: left; width: 50%;">ปัญหาที่พบ</th>
                    <th style="border: 1px solid #333; padding: 8px; text-align: left; width: 50%;">แนวทางการแก้ไข</th>
                </tr>
                ${problems.length ? problems.map(p => `
                    <tr>
                        <td style="border: 1px solid #333; padding: 8px;">${p.issue || '-'}</td>
                        <td style="border: 1px solid #333; padding: 8px;">${p.solution || '-'}</td>
                    </tr>
                `).join('') : '<tr><td style="border: 1px solid #333; padding: 8px;">-</td><td style="border: 1px solid #333; padding: 8px;">-</td></tr>'}
            </table>
        </div>

        <div style="margin-bottom: 15px; font-size: 0.95rem;">
            <strong>สรุปผลการทดลอง:</strong>
            <p style="margin-top: 5px; white-space: pre-wrap; background: #fafafa; padding: 10px; border: 1px solid #e0e0e0;">${summary}</p>
        </div>

        <div style="margin-bottom: 20px; font-size: 0.95rem;">
            <strong>อัปโหลดภาพประกอบปฏิบัติการ:</strong>
            <div id="pdf-images-container" class="flex-row mt-10" style="gap: 10px;">
                <!-- ระบบดึงรูปภาพจะถูกนำมาแทรกตรงนี้ในขั้นตอนถัดไป -->
                <div style="width: 30%; height: 120px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; border: 1px dashed #ccc; color: #999;">รออัปโหลดรูปภาพ</div>
            </div>
        </div>

        <div style="margin-bottom: 15px; font-size: 0.95rem; page-break-inside: avoid;">
            <strong>ขั้นตอนการทดลอง:</strong>
            <div style="text-align: center; margin-top: 15px;">
                <div style="border: 2px solid #333; padding: 5px 20px; display: inline-block; border-radius: 20px; background: white;">Start</div>
                <div style="margin: 5px 0; font-weight: bold;">↓</div>
                ${flowSteps.map(step => `
                    <div style="border: 1px solid #333; padding: 10px 20px; display: inline-block; min-width: 150px; background: #fafafa; border-radius: 4px;">${step}</div>
                    <div style="margin: 5px 0; font-weight: bold;">↓</div>
                `).join('')}
                <div style="border: 2px solid #333; padding: 5px 20px; display: inline-block; border-radius: 20px; background: white;">End</div>
            </div>
        </div>
    `;

    // ยัด HTML ที่สร้างเสร็จแล้วลงไปในโครงสร้าง PDF
    document.getElementById('pdf-body').innerHTML = htmlContent;

    // สลับหน้าจอเพื่อแสดงผลพรีวิว
    switchView('preview-view');
}

window.downloadPDF = () => {
    const element = document.getElementById('pdf-content');
    html2pdf().from(element).set({
        margin: 0, filename: 'Portfolio.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
}

// ==========================================
// 3. ระบบอัปโหลดและแสดงพรีวิวรูปภาพ (สูงสุด 3 รูป)
// ==========================================
let uploadedImages = []; // ตัวแปรเก็บรูปภาพ

document.getElementById('imageUpload').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    
    // เช็คว่าถ้ารวมกับรูปเดิมแล้วเกิน 3 รูปหรือไม่
    if (uploadedImages.length + files.length > 3) {
        alert('สามารถอัปโหลดภาพประกอบได้สูงสุด 3 ภาพเท่านั้นครับ');
        this.value = ''; // ล้างค่า input
        return;
    }

    files.forEach(file => {
        if (uploadedImages.length < 3) {
            const reader = new FileReader();
            reader.onload = function(event) {
                uploadedImages.push(event.target.result);
                renderImagePreview();
            };
            reader.readAsDataURL(file); // แปลงรูปเป็น Base64
        }
    });
    this.value = ''; // ล้างค่า input ให้สามารถเลือกไฟล์เดิมซ้ำได้ในกรณีที่ลบออก
});

// ฟังก์ชันสร้างหน้าตาพรีวิวรูปภาพใต้ปุ่มอัปโหลด
window.renderImagePreview = () => {
    const container = document.getElementById('imagePreview');
    container.innerHTML = '';
    
    uploadedImages.forEach((imgSrc, index) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.innerHTML = `
            <img src="${imgSrc}" class="img-thumb" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; border: 1px solid #dcdcdc;">
            <button onclick="removeImage(${index})" style="position: absolute; top: -8px; right: -8px; background: #ff4d4f; color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center;">✕</button>
        `;
        container.appendChild(div);
    });
};

// ฟังก์ชันลบรูปภาพ
window.removeImage = (index) => {
    uploadedImages.splice(index, 1);
    renderImagePreview();
};