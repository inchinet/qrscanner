# 💡 Lightweight QR Code Scanner

A super lightweight, client-side QR code reader with a modern liquid glass UI, designed for mobile use.

## ✨ Features

*   **Instant Camera Scan**: Automatically starts scanning with the back camera when the app loads or returns to the foreground.
*   **Image File Scan**: Option to upload a QR code image from your device.
*   **Responsive Design**: Optimized for mobile devices.
*   **Liquid Glass UI**: Modern and visually appealing user interface.
*   **Direct Link Opening**: Scanned URLs are displayed and can be clicked to open in a new browser tab.
*   **Clear Feedback**: Provides visual cues and a "Scan Again" button after a successful scan.

## 🚀 How to Use (Local Development)

1.  Open `index.html` in your web browser.
2.  Grant camera permissions when prompted.
3.  Point your device's camera at a QR code, or use the "Scan from Image" button to upload a file.

## 🌐 Deployment

This application is entirely client-side (HTML, CSS, JavaScript) and requires no backend server logic for its core functionality.

To deploy:

1.  Upload the entire `qrscanner` folder to your web server's document root (e.g., `/var/www/html/qrscanner/` for Apache/Nginx).
2.  Access the application via your server's URL (e.g., `http://yourdomain.com/qrscanner/index.html`).

## 🛠️ Technologies Used

*   HTML5
*   CSS3 (with Liquid Glass UI effects)
*   JavaScript (ES6+)
*   [jsQR](https://github.com/cozmo/jsQR) for QR code detection.
