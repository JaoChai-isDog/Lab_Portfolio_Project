# Engineering Lab Portfolio Generator 🧪⚡

เว็บแอปพลิเคชันสำหรับจัดทำ **Portfolio รายงานการทดลองทางวิศวกรรม (Engineering Lab Report)** ที่รองรับการใช้งานซ้ำในหลายๆ Lab พร้อมระบบกรอกข้อมูล (Input Form Template), การแสดงผล 2 รูปแบบ (Dual Layouts), ระบบ QR Code อัตโนมัติในเอกสาร A4 และการส่งออกเป็น PDF ทันทีผ่าน `html2pdf.js`

---

## 🌟 ฟีเจอร์หลัก (Key Features)

1. **ระบบกรอกข้อมูล (Form Editor)**
   - เทมเพลตป้อนข้อมูลมาตรฐานครบถ้วน (ชื่อการทดลอง, รหัสวิชา, ทฤษฎี, รายการอุปกรณ์, ขั้นตอนการทดลอง, ตารางผลลัพธ์, สรุปผล)
   - รองรับการเพิ่ม/ลดรายการอุปกรณ์, ขั้นตอนทดลอง และแถบตารางข้อมูลแบบ Dynamic
   - ระบบ Auto-Save บันทึกข้อมูลอัตโนมัติลงใน `localStorage`
   - มาพร้อม **Lab Presets ตัวอย่างวิศวกรรม 3 สาขา** (วิศวกรรมไฟฟ้า, วิศวกรรมโยธา, วิศวกรรมเครื่องกล) กดโหลดทดลองได้ทันที 1-Click
   - รองรับการ **ส่งออก (Export JSON)** และ **นำเข้า (Import JSON)** สำหรับสำรองข้อมูลและแชร์กับเพื่อนในทีม

2. **การแสดงผล 2 รูปแบบ (Dual Layouts)**
   - **Modern Web Portfolio View:** ออกแบบสไตล์ Dark Glassmorphism ทันสมัย เหมาะกับการอ่านบนหน้าจอเบราว์เซอร์และสมาร์ทโฟน มี Interactive Cards, Timeline, ตารางข้อมูล และกราฟวิเคราะห์ (Chart.js)
   - **Academic A4 Document View:** จัดวางเป๊ะตามสัดส่วนกระดาษ A4 (210mm × 297mm) สไตล์รายงานวิชาการมาตรฐาน มี Header สถาบัน/คณะ, ตารางข้อมูลแบบทางการ และช่องลงลายเซ็นอาจารย์/ผู้ตรวจ

3. **ระบบ QR Code อัตโนมัติ (Auto QR Code)**
   - สร้าง QR Code บนเอกสาร A4 อัตโนมัติ ชี้ไปยัง URL ของหน้า Web Portfolio ประจำ Lab เพื่อให้ผู้ตรวจสแกนดูผลงานและกราฟ Interactive ออนไลน์ได้ทันที

4. **การส่งออกเป็น PDF (PDF Generator)**
   - ปุ่มดาวน์โหลด PDF ทันทีโดยใช้ไลบรารี `html2pdf.js` แปลงบล็อกเอกสาร A4 เป็นไฟล์ `.pdf` คุณภาพสูง ไม่ตัดขาดบรรทัด

---

## 🚀 การเปิดใช้งานและทดสอบในเครื่อง local (Local Development)

เนื่องจากเป็น Static Web App (Zero-Dependency) สามารถเปิดใช้งานได้ง่ายด้วย Web Server ทั่วไป:

### ใช้ Python (แนะนำ)
เปิด Terminal หรือ Command Prompt ในโฟลเดอร์นี้ แล้วรัน:
```bash
python -m http.server 8000
```
จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:8000`

---

## 🌐 การโฮสต์ผ่าน GitHub Pages (Deployment Guide)

สามารถนำไปโฮสต์ใช้งานบน **GitHub Pages** ได้ฟรี 100% ตามขั้นตอนดังนี้:

1. **สร้าง GitHub Repository:**
   - ไปที่ [GitHub](https://github.com/) -> New Repository
   - ตั้งชื่อคลัง เช่น `Lab-Portfolio` เลือกเป็น **Public**
   
2. **อัปโหลดไฟล์ขึ้น GitHub:**
   - Push หรือ Upload ไฟล์ทั้งหมด (`index.html`, โฟลเดอร์ `css/`, โฟลเดอร์ `js/`, `README.md`) ขึ้นสาขาหลัก `main`

3. **ตั้งค่า GitHub Pages:**
   - ในหน้า Repository ของคุณ ให้ไปที่เมนู **Settings** -> **Pages** (ทางซ้ายมือ)
   - ในหัวข้อ **Build and deployment**:
     - Source: เลือก **Deploy from a branch**
     - Branch: เลือก `main` และโฟลเดอร์ `/ (root)`
     - กด **Save**

4. **เริ่มใช้งาน:**
   - รอระบบ build ประมาณ 1 นาที คุณจะได้ URL เว็บไซต์ เช่น:
     `https://<your-username>.github.io/Lab-Portfolio/`
   - นำ URL นี้ไปใส่ในช่อง "URL หน้าเว็บ Portfolio" ใน Form Editor เพื่อให้ QR Code บนกระดาษ A4 ชี้มายังหน้าเว็บของคุณได้อย่างแม่นยำ!

---

## 🛠️ โครงสร้างไฟล์ (Project Structure)

```
Lab Portfolio/
├── index.html               # หน้าหลักเว็บแอปพลิเคชัน (Navbar, Form, Web View, A4 View)
├── css/
│   └── styles.css           # Styling ระบบ Design System, Glassmorphism & Academic Print
├── js/
│   ├── app.js               # Application logic, Dynamic Forms, View Switcher & Event Handlers
│   ├── qrcode-helper.js     # ระบบสร้าง QR Code อัตโนมัติ
│   ├── pdf-export.js        # ตัวจัดการส่งออกไฟล์ PDF ด้วย html2pdf.js
│   └── sample-data.js       # ข้อมูลตัวอย่าง Lab (Electrical, Civil, Mechanical)
└── README.md                # เอกสารประกอบและคู่มือการใช้งาน
```
