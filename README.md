# Lab Portfolio Project

เว็บแอปพลิเคชันสำหรับจัดเก็บและแสดงผลงานปฏิบัติการวิศวกรรม พร้อมระบบจัดการหลังบ้าน (Admin Workspace), Auto-save ลง Firebase Firestore, แนบภาพประกอบ, สร้าง QR Code และส่งออกเอกสาร PDF ขนาด A4

## โครงสร้างโปรเจกต์

- `index.html` + `js/app-public.js` — หน้าเว็บไซต์สาธารณะ แสดงรายการผลงานและรายละเอียดปฏิบัติการ (รองรับลิงก์ตรงผ่าน `?lab=<labId>`)
- `admin.html` + `js/app-admin.js` — หน้าจัดการผลงานสำหรับผู้ดูแลระบบ (Login/Logout, Auto-save, แก้ไข/ลบผลงาน, พรีวิวและส่งออก PDF)
- `js/firebase-config.js` — การตั้งค่าและส่งออก Firebase Auth & Firestore
- `js/pdf-export.js` — สร้างพรีวิว A4 และส่งออก PDF ด้วย `html2pdf.js`
- `js/qrcode-helper.js` — สร้าง QR Code ชี้ไปยังหน้าสาธารณะของปฏิบัติการนั้นๆ
- `js/utils.js` — ฟังก์ชันช่วย (ป้องกัน XSS, จัดรูปแบบวันที่ไทย, บีบอัดรูปภาพด้วย Canvas)
- `js/sample-data.js` — ชุดข้อมูลตัวอย่างสำหรับทดสอบในหน้า Admin
- `css/styles.css` — สไตล์ธีม Muji พร้อมรองรับ Responsive และการพิมพ์ A4
- `images/default-profile.svg` — รูปโปรไฟล์เริ่มต้น (สามารถนำไฟล์รูปจริงมาแทนที่ได้)

## วิธีรันในเครื่อง (Local Server)

เนื่องจากโปรเจกต์ใช้ ES Modules (`<script type="module">`) ต้องเปิดผ่าน HTTP Server (ไม่ควรดับเบิลคลิกเปิดแบบ `file://`):

```powershell
# ตัวอย่างด้วย Python
python -m http.server 8080
```

จากนั้นเปิดเบราว์เซอร์ที่:
- หน้าสาธารณะ: `http://localhost:8080/index.html`
- หน้า Admin: `http://localhost:8080/admin.html`

## การตั้งค่า Firebase Security Rules (แนะนำ)

เพื่อความปลอดภัยของข้อมูล ควรตั้งค่า Firestore Security Rules ใน Firebase Console ดังนี้:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /labs/{labId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```
