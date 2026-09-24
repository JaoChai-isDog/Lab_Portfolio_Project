// ฟังก์ชันสลับการแสดงผลหน้าจอ
function generatePreview() {
    // 1. ดึงข้อมูลจากฟอร์ม
    const data = {
        title: document.getElementById('labTitle').value,
        name: document.getElementById('studentName').value,
        faculty: document.getElementById('faculty').value,
        uni: document.getElementById('university').value,
        id: document.getElementById('studentId').value,
        group: document.getElementById('studyGroup').value,
        subject: document.getElementById('subject').value,
        objective: document.getElementById('objective').value,
        theory: document.getElementById('theory').value
    };

    // 2. ใส่ข้อมูลลงในหน้าเว็บ
    document.getElementById('web-title').innerText = data.title;
    document.getElementById('web-name').innerText = data.name;
    document.getElementById('web-faculty').innerText = data.faculty;
    document.getElementById('web-uni').innerText = data.uni;
    document.getElementById('web-objective').innerText = data.objective;
    document.getElementById('web-theory').innerText = data.theory;

    // 3. ใส่ข้อมูลลงในเอกสาร
    document.getElementById('doc-title').innerText = data.title;
    document.getElementById('doc-name').innerText = data.name;
    document.getElementById('doc-id').innerText = data.id;
    document.getElementById('doc-faculty').innerText = data.faculty;
    document.getElementById('doc-uni').innerText = data.uni;
    document.getElementById('doc-subject').innerText = data.subject;
    document.getElementById('doc-group').innerText = data.group;
    document.getElementById('doc-objective').innerText = data.objective;

    // 4. สลับหน้าจอไปที่ Web View
    document.getElementById('admin-view').classList.add('hidden');
    document.getElementById('web-showcase-view').classList.remove('hidden');
}

function backToForm() {
    document.getElementById('web-showcase-view').classList.add('hidden');
    document.getElementById('admin-view').classList.remove('hidden');
}

function showPrintView() {
    document.getElementById('web-showcase-view').classList.add('hidden');
    document.getElementById('print-document-view').classList.remove('hidden');

    // เรียกใช้ฟังก์ชันสร้าง QR Code (เดี๋ยวเราจะเขียนใน qrcode-helper.js)
    // ตรงนี้เราจะตั้งค่าให้ชี้ไปที่ URL เว็บหน้าแรกของเรา
    generateQR("https://your-github-username.github.io/Lab_Portfolio_Project/");
}

function backToWeb() {
    document.getElementById('print-document-view').classList.add('hidden');
    document.getElementById('web-showcase-view').classList.remove('hidden');
}