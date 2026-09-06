/**
 * PDF Export Helper for Lab Portfolio
 * Leverages html2pdf.js to capture the A4 Academic Document layout and convert to PDF
 */

const PDFExporter = {
  exportToPDF(elementId, filename = "Engineering_Lab_Report.pdf") {
    const element = document.getElementById(elementId);
    if (!element) {
      alert("ไม่พบบล็อกเอกสารสำหรับส่งออก PDF");
      return;
    }

    // Show loading state or feedback
    const btn = document.getElementById("btn-export-pdf");
    const originalText = btn ? btn.innerHTML : "";
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังสร้างไฟล์ PDF...`;
      btn.disabled = true;
    }

    const opt = {
      margin: [10, 10, 10, 10], // top, left, bottom, right in mm
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      })
      .catch((err) => {
        console.error("PDF Export error:", err);
        alert("เกิดข้อผิดพลาดในการสร้างไฟล์ PDF: " + err.message);
        if (btn) {
          btn.innerHTML = originalText;
          btn.disabled = false;
        }
      });
  }
};
