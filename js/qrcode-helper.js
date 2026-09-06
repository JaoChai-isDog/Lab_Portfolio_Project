/**
 * QR Code Generator Helper for Lab Portfolio
 * Uses QRCode.js CDN library to render dynamic QR Codes for A4 Print View & Web View
 */

const QRCodeHelper = {
  webQrInstance: null,
  printQrInstance: null,

  init(webContainerId, printContainerId) {
    this.webContainer = document.getElementById(webContainerId);
    this.printContainer = document.getElementById(printContainerId);
  },

  update(url) {
    const targetUrl = url || window.location.href;

    // Clear existing contents
    if (this.webContainer) {
      this.webContainer.innerHTML = '';
      try {
        new QRCode(this.webContainer, {
          text: targetUrl,
          width: 120,
          height: 120,
          colorDark: "#0f172a",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.H
        });
      } catch (err) {
        console.warn("QRCode rendering error:", err);
      }
    }

    if (this.printContainer) {
      this.printContainer.innerHTML = '';
      try {
        new QRCode(this.printContainer, {
          text: targetUrl,
          width: 90,
          height: 90,
          colorDark: "#1e293b",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
      } catch (err) {
        console.warn("QRCode printing rendering error:", err);
      }
    }
  }
};
