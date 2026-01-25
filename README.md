# 🔍 Heavy-Duty QR Code Scanner

A powerful, high-sensitivity client-side QR code reader with a modern **Liquid Glass UI**, specifically optimized for difficult real-world condition photos like restaurant menus and textured surfaces.

![UI](https://github.com/inchinet/qrscanner/blob/main/qrscanner.png)

## 🚀 Advanced Features

*   **⚡️ Instant Camera Scan**: Automatically starts scanning with the back camera when the app loads.
*   **🛠️ Heavy-Duty Image Upload**: Enhanced sensitivity for uploaded photos that standard scanners usually fail on.
*   **🧠 Dual-Library Engine**: Uses both **jsQR** (for speed) and **ZXing** (for robustness) to maximize detection success.
*   **🧼 Texture & Shadow Crushing**: Advanced "Digital Bleach" preprocessing that clears away 3D shadows, restaurant menu textures, and moiré patterns from screens.
*   **📱 Responsive Liquid Glass UI**: Optimized for mobile devices with a high-end, premium aesthetic.
*   **🔗 Direct Link Opening**: Click scanned URLs to open directly in a new browser tab.

## 🛠️ Performance Engine

This scanner doesn't just "look" at the image; it tries **19+ different processing variations** if a code isn't immediately found:

1.  **Shadow-Crushing**: Bleaches the image at multiple thresholds (140, 180, 210) to delete 3D beveled shadows.
2.  **Texture-Crushing**: Aggressive downscaling (25%, 50%, 75%) to "melt" away background grain and grid noise.
3.  **Denoising & Blur**: Gaussian and Median filters to remove "speckle" noise from physical surfaces.
4.  **Try Harder Mode**: Enabled industry-standard ZXing heuristics for distorted/warped codes.

## 🚀 How to Use

1.  Open `index.html` in your web browser.
2.  Grant camera permissions.
3.  **Camera**: Point and scan instantly.
4.  **Image Upload**: If a photo fails elsewhere, upload it here. The scanner will run its multi-stage "Heavy-Duty" cycle to find the hidden code.

## 📦 Deployment

This is a **100% client-side** application.

1.  Upload the `qrscanner` folder to your server.
2.  Works on any static host like GitHub Pages, Vercel, or traditional Apache/Nginx servers.

## 📚 Powered By

*   [jsQR](https://github.com/cozmo/jsQR) (Fast Live Scanning)
*   [ZXing](https://github.com/zxing-js/library) (Heavy-Duty Robust Detection)
*   **Custom Image Preprocessing Engine** (Shadow & Texture Neutralization)
