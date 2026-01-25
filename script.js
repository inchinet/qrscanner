document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const video = document.getElementById('qr-video');
    const canvas = document.getElementById('qr-canvas');
    const resultLink = document.getElementById('qr-result');
    const loadingMessage = document.getElementById('loadingMessage');
    const fileInput = document.getElementById('file-input');
    const resultContainer = document.querySelector('.result-container');
    const scanLine = document.querySelector('.scan-line');
    const scanAgainButton = document.getElementById('scan-again-button');
    const scanLabel = document.getElementById('scan-label');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let currentStream;
    let animationFrameId;

    // --- Core Functions ---

    /**
     * Stops the current camera stream and scanning animation.
     */
    function stopScanning() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    /**
     * Main function to start the camera and QR scanning process.
     */
    function startScanning() {
        stopScanning();
        updateUIForScanning();

        // Standard camera constraints
        const constraints = {
            video: {
                facingMode: 'environment' // Prefer the rear camera
            }
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(handleStream)
            .catch(err => {
                console.warn('Failed to get environment camera, trying any camera...', err);
                // Fallback to any available camera if the rear one fails
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then(handleStream)
                    .catch(handleStreamError);
            });
    }

    /**
     * Handles the camera stream once acquired.
     * @param {MediaStream} stream The camera stream.
     */
    function handleStream(stream) {
        currentStream = stream;
        video.srcObject = stream;
        // Mute video to avoid potential feedback loops and comply with autoplay policies
        video.muted = true;
        video.setAttribute('playsinline', 'true');

        video.play().then(() => {
            loadingMessage.style.display = 'none';
            scanLine.classList.remove('hidden');
            // Start the scanning loop
            animationFrameId = requestAnimationFrame(tick);
        }).catch(playError => {
            console.error("Video play failed:", playError);
            loadingMessage.innerText = 'Could not start video. Please tap the screen.';
        });
    }

    /**
     * Handles errors during camera stream acquisition.
     * @param {Error} err The error object.
     */
    function handleStreamError(err) {
        console.error('Camera access error:', err);
        loadingMessage.innerText = 'Camera access is required to scan QR codes.';
        if (err.name === 'NotAllowedError') {
            loadingMessage.innerText = 'Camera permission was denied. Please enable it in your browser settings.';
        }
    }

    /**
     * The main scanning loop, called on each animation frame.
     */
    function tick() {
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            canvas.width = videoWidth;
            canvas.height = videoHeight;

            ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
            const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: 'dontInvert'
            });

            if (code) {
                stopScanning();
                updateUIWithResult(code.data);
                return; // Exit loop once code is found
            }
        }
        // Continue loop if no code is found
        animationFrameId = requestAnimationFrame(tick);
    }

    /**
     * Handles scanning a QR code from a user-selected image file.
     * Uses dual-library approach: ZXing (robust) first, then jsQR (with preprocessing) as fallback.
     */
    async function scanImageFile() {
        const file = fileInput.files[0];
        if (!file) return;

        stopScanning();
        updateUIForScanning(); // Show loading message while processing image
        loadingMessage.innerText = "Processing image...";

        const reader = new FileReader();
        reader.onload = async (e) => {
            const img = new Image();
            img.onload = async () => {
                console.log('Image loaded, trying detection...');

                // PHASE 1: Try ZXing (Industry Standard - Robust)
                loadingMessage.innerText = "Trying Heavy-Duty ZXing...";

                try {
                    // Enable "Try Harder" mode for distorted/noisy restaurant codes
                    const hints = new Map();
                    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
                    const zxingReader = new ZXing.BrowserMultiFormatReader(hints);

                    // Try direct and multiple scales
                    const scales = [1.0, 0.75, 0.5, 1.5, 2.0];
                    for (const scale of scales) {
                        try {
                            const tempCanvas = document.createElement('canvas');
                            const tempCtx = tempCanvas.getContext('2d');
                            tempCanvas.width = Math.floor(img.width * scale);
                            tempCanvas.height = Math.floor(img.height * scale);
                            tempCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

                            const result = await zxingReader.decodeFromImageElement(tempCanvas);
                            if (result && result.text) {
                                updateUIWithResult(result.text);
                                return;
                            }
                        } catch (e) { }
                    }
                } catch (zxingError) {
                    console.error('ZXing setup failed:', zxingError);
                }

                // PHASE 2: Fall back to Shadow-Crushing (jsQR with fixed binarization)
                loadingMessage.innerText = "Crushing shadows...";
                const result = tryMultipleDetectionMethods(img);

                if (result) {
                    console.log('??jsQR succeeded!');
                    updateUIWithResult(result);
                } else {
                    console.log('??All detection methods failed');
                    alert('No QR code found in the image.\n\nTips:\n??Ensure the QR code is clear and well-lit\n??Try retaking the photo with better focus\n??Upload to https://zxing.org/w/decode.jspx for server-side processing');
                    startScanning();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * Applies multiple preprocessing and detection methods to find QR codes.
     * Consolidates the best "Texture-Defeating" logic.
     */
    function tryMultipleDetectionMethods(img) {
        console.log('Starting QR detection on image:', img.width, 'x', img.height);

        const methods = [
            // Basic
            { name: 'Original', fn: () => scanWithPreprocessing(img, false, false, false, false, false, 1.0) },

            // Shadow-Crushers (Fixed Thresholds)
            // This "bleaches" the image to kill shadows and restaurant textures
            { name: 'Shadow Crusher (Bright - 180)', fn: () => scanWithFixedThreshold(img, 180, 1.0) },
            { name: 'Shadow Crusher (Super Bright - 210)', fn: () => scanWithFixedThreshold(img, 210, 1.0) },
            { name: 'Shadow Crusher (Dark - 140)', fn: () => scanWithFixedThreshold(img, 140, 1.0) },

            // Texture-Crushing via Downscaling (Best for restaurant codes/screen moiré)
            // Shrinking the image naturally "melts" background noise away
            { name: 'Crush Texture (Scale 50%)', fn: () => scanWithPreprocessing(img, true, true, false, false, false, 0.5) },
            { name: 'Crush Texture (Scale 25%)', fn: () => scanWithPreprocessing(img, true, true, false, false, false, 0.25) },
            { name: 'Crush Texture (Scale 75%)', fn: () => scanWithPreprocessing(img, true, true, false, false, false, 0.75) },

            // Denoising methods
            { name: 'Denoise (Blur) + Otsu', fn: () => scanWithDenoise(img, 1.0) },
            { name: 'Median Filter (Grain Removal)', fn: () => scanWithMedian(img, 1.0) },

            // Standard Enhancements
            { name: 'Otsu Threshold', fn: () => scanWithOtsuThreshold(img, 1.0) },
            { name: 'Histogram Equalization', fn: () => scanWithHistogramEqualization(img, 1.0) },

            // Upscaling (For very small codes)
            { name: 'Upscale 150%', fn: () => scanWithPreprocessing(img, true, true, false, false, false, 1.5) },
            { name: 'Upscale 200%', fn: () => scanWithPreprocessing(img, true, true, false, false, false, 2.0) }
        ];

        for (let i = 0; i < methods.length; i++) {
            loadingMessage.innerText = `Processing image... (Attempt ${i + 1}/${methods.length})`;
            console.log(`Method ${i + 1}: ${methods[i].name}`);

            try {
                const result = methods[i].fn();
                if (result) {
                    console.log(`✓ Success! Method: ${methods[i].name}`);
                    return result;
                }
            } catch (error) {
                console.error(`Method ${methods[i].name} failed:`, error);
            }
        }

        return null;
    }

    /**
     * Scans an image with various preprocessing options.
     * @param {Image} img The source image
     * @param {boolean} grayscale Convert to grayscale
     * @param {boolean} enhanceContrast Enhance contrast
     * @param {boolean} sharpen Apply sharpening filter
     * @param {boolean} bilateralFilter Apply bilateral filter for noise reduction
     * @param {boolean} detectEdges Apply edge detection
     * @param {number} scale Scale factor for the image
     * @returns {string|null} The decoded QR code data or null
     */
    function scanWithPreprocessing(img, grayscale, enhanceContrast, sharpen, bilateralFilter, detectEdges, scale) {
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let imageData = ctx.getImageData(0, 0, width, height);

        if (grayscale) {
            imageData = convertToGrayscale(imageData);
        }

        if (bilateralFilter) {
            imageData = applyBilateralFilter(imageData);
        }

        if (enhanceContrast) {
            imageData = enhanceImageContrast(imageData);
        }

        if (sharpen) {
            imageData = sharpenImage(imageData);
        }

        if (detectEdges) {
            imageData = applySobelEdgeDetection(imageData);
        }

        // Put processed image back to canvas for debugging if needed
        ctx.putImageData(imageData, 0, 0);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });

        return code ? code.data : null;
    }

    /**
     * Applies adaptive thresholding for binary conversion.
     * @param {Image} img The source image
     * @param {number} scale Optional scale factor (default 1.0)
     * @returns {string|null} The decoded QR code data or null
     */
    function scanWithAdaptiveThreshold(img, scale = 1.0) {
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let imageData = ctx.getImageData(0, 0, width, height);
        imageData = convertToGrayscale(imageData);
        imageData = applyAdaptiveThreshold(imageData);

        ctx.putImageData(imageData, 0, 0);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });

        return code ? code.data : null;
    }

    /**
     * Converts image to grayscale.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function convertToGrayscale(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
        return imageData;
    }

    /**
     * Enhances image contrast.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function enhanceImageContrast(imageData) {
        const data = imageData.data;
        const factor = 1.5; // Contrast enhancement factor

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
            data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
            data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
        }
        return imageData;
    }

    /**
     * Applies sharpening filter to the image.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function sharpenImage(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);

        // Sharpening kernel
        const kernel = [
            0, -1, 0,
            -1, 5, -1,
            0, -1, 0
        ];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            sum += data[idx] * kernel[kernelIdx];
                        }
                    }
                    output[(y * width + x) * 4 + c] = Math.min(255, Math.max(0, sum));
                }
            }
        }

        for (let i = 0; i < data.length; i++) {
            data[i] = output[i];
        }

        return imageData;
    }

    /**
     * Applies adaptive thresholding for better QR code detection.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function applyAdaptiveThreshold(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const blockSize = 11; // Reduced from 15 for better performance
        const C = 8; // Constant subtracted from mean

        // Create output array
        const output = new Uint8ClampedArray(data.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let sum = 0;
                let count = 0;

                // Calculate local mean in a smaller neighborhood for performance
                const yStart = Math.max(0, y - blockSize);
                const yEnd = Math.min(height - 1, y + blockSize);
                const xStart = Math.max(0, x - blockSize);
                const xEnd = Math.min(width - 1, x + blockSize);

                for (let dy = yStart; dy <= yEnd; dy++) {
                    for (let dx = xStart; dx <= xEnd; dx++) {
                        const idx = (dy * width + dx) * 4;
                        sum += data[idx]; // Already grayscale, so R=G=B
                        count++;
                    }
                }

                const mean = sum / count;
                const idx = (y * width + x) * 4;
                const value = data[idx] > (mean - C) ? 255 : 0;

                output[idx] = value;
                output[idx + 1] = value;
                output[idx + 2] = value;
                output[idx + 3] = data[idx + 3]; // Preserve alpha
            }
        }

        // Copy output back to original data
        for (let i = 0; i < data.length; i++) {
            data[i] = output[i];
        }

        return imageData;
    }


    /**
     * Scans with Otsu's automatic thresholding method.
     * @param {Image} img The source image
     * @param {number} scale Optional scale factor (default 1.0)
     * @returns {string|null} The decoded QR code data or null
     */
    function scanWithOtsuThreshold(img, scale = 1.0) {
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let imageData = ctx.getImageData(0, 0, width, height);
        imageData = convertToGrayscale(imageData);
        imageData = applyOtsuThreshold(imageData);

        ctx.putImageData(imageData, 0, 0);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });

        return code ? code.data : null;
    }

    /**
     * Scans with histogram equalization for better contrast.
     * @param {Image} img The source image
     * @param {number} scale Optional scale factor (default 1.0)
     * @returns {string|null} The decoded QR code data or null
     */
    function scanWithHistogramEqualization(img, scale = 1.0) {
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let imageData = ctx.getImageData(0, 0, width, height);
        imageData = convertToGrayscale(imageData);
        imageData = applyHistogramEqualization(imageData);

        ctx.putImageData(imageData, 0, 0);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });

        return code ? code.data : null;
    }

    /**
     * Applies Otsu's automatic thresholding algorithm.
     * Automatically finds the optimal threshold value.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function applyOtsuThreshold(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // Calculate histogram
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            histogram[data[i]]++;
        }

        // Calculate total number of pixels
        const total = width * height;

        // Calculate the optimal threshold using Otsu's method
        let sum = 0;
        for (let i = 0; i < 256; i++) {
            sum += i * histogram[i];
        }

        let sumB = 0;
        let wB = 0;
        let wF = 0;
        let maxVariance = 0;
        let threshold = 0;

        for (let t = 0; t < 256; t++) {
            wB += histogram[t];
            if (wB === 0) continue;

            wF = total - wB;
            if (wF === 0) break;

            sumB += t * histogram[t];

            const mB = sumB / wB;
            const mF = (sum - sumB) / wF;

            const variance = wB * wF * (mB - mF) * (mB - mF);

            if (variance > maxVariance) {
                maxVariance = variance;
                threshold = t;
            }
        }

        // Apply threshold
        for (let i = 0; i < data.length; i += 4) {
            const value = data[i] > threshold ? 255 : 0;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
        }

        return imageData;
    }

    /**
     * Applies histogram equalization to improve contrast.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function applyHistogramEqualization(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const total = width * height;

        // Calculate histogram
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < data.length; i += 4) {
            histogram[data[i]]++;
        }

        // Calculate cumulative distribution function (CDF)
        const cdf = new Array(256);
        cdf[0] = histogram[0];
        for (let i = 1; i < 256; i++) {
            cdf[i] = cdf[i - 1] + histogram[i];
        }

        // Find minimum non-zero CDF value
        let cdfMin = cdf[0];
        for (let i = 0; i < 256; i++) {
            if (cdf[i] > 0) {
                cdfMin = cdf[i];
                break;
            }
        }

        // Create lookup table for equalization
        const lookupTable = new Array(256);
        for (let i = 0; i < 256; i++) {
            lookupTable[i] = Math.round(((cdf[i] - cdfMin) / (total - cdfMin)) * 255);
        }

        // Apply equalization
        for (let i = 0; i < data.length; i += 4) {
            const value = lookupTable[data[i]];
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
        }

        return imageData;
    }

    /**
     * Applies bilateral filter for noise reduction while preserving edges.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function applyBilateralFilter(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);

        const diameter = 5;
        const sigmaColor = 50;
        const sigmaSpace = 50;
        const radius = Math.floor(diameter / 2);

        // Precompute spatial Gaussian weights
        const spatialWeights = [];
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = dx * dx + dy * dy;
                spatialWeights.push(Math.exp(-dist / (2 * sigmaSpace * sigmaSpace)));
            }
        }

        for (let y = radius; y < height - radius; y++) {
            for (let x = radius; x < width - radius; x++) {
                const centerIdx = (y * width + x) * 4;
                const centerValue = data[centerIdx];

                let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0;
                let weightIdx = 0;

                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
                        const neighborValue = data[neighborIdx];

                        const colorDiff = neighborValue - centerValue;
                        const colorWeight = Math.exp(-(colorDiff * colorDiff) / (2 * sigmaColor * sigmaColor));

                        const weight = spatialWeights[weightIdx++] * colorWeight;

                        sumR += data[neighborIdx] * weight;
                        sumG += data[neighborIdx + 1] * weight;
                        sumB += data[neighborIdx + 2] * weight;
                        sumWeight += weight;
                    }
                }

                if (sumWeight > 0) {
                    output[centerIdx] = sumR / sumWeight;
                    output[centerIdx + 1] = sumG / sumWeight;
                    output[centerIdx + 2] = sumB / sumWeight;
                }
            }
        }

        for (let i = 0; i < data.length; i++) {
            data[i] = output[i];
        }

        return imageData;
    }

    /**
     * Applies Sobel edge detection.
     * @param {ImageData} imageData The image data to process
     * @returns {ImageData} Processed image data
     */
    function applySobelEdgeDetection(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data.length);

        // Sobel kernels
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let gx = 0, gy = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const kernelIdx = (ky + 1) * 3 + (kx + 1);

                        gx += data[idx] * sobelX[kernelIdx];
                        gy += data[idx] * sobelY[kernelIdx];
                    }
                }

                const magnitude = Math.sqrt(gx * gx + gy * gy);
                const idx = (y * width + x) * 4;

                output[idx] = magnitude;
                output[idx + 1] = magnitude;
                output[idx + 2] = magnitude;
                output[idx + 3] = 255;
            }
        }

        for (let i = 0; i < data.length; i++) {
            data[i] = output[i];
        }

        return imageData;
    }

    /**
     * Denoises the image using a blur filter before detection.
     * Helps with textured backgrounds (like grids on restaurant menus).
     */
    function scanWithDenoise(img, scale = 1.0) {
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let imageData = ctx.getImageData(0, 0, width, height);
        imageData = convertToGrayscale(imageData);
        imageData = applyGaussianBlur(imageData); // Smooths the texture
        imageData = applyOtsuThreshold(imageData); // Converts to binary

        ctx.putImageData(imageData, 0, 0);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });

        return code ? code.data : null;
    }

    /**
     * Applies a Median filter to remove speckle noise.
     */
    function scanWithMedian(img, scale = 1.0) {
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let imageData = ctx.getImageData(0, 0, width, height);
        imageData = convertToGrayscale(imageData);
        imageData = applyMedianFilter(imageData); // Removes high-frequency noise

        ctx.putImageData(imageData, 0, 0);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });

        return code ? code.data : null;
    }

    /**
     * Helper: Simple Gaussian Blur
     */
    function applyGaussianBlur(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);
        const kernel = [
            1, 2, 1,
            2, 4, 2,
            1, 2, 1
        ];
        const kernelSum = 16;

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let r = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = ((y + ky) * width + (x + kx)) * 4;
                        const weight = kernel[(ky + 1) * 3 + (kx + 1)];
                        r += data[idx] * weight;
                    }
                }
                const resIdx = (y * width + x) * 4;
                const val = r / kernelSum;
                output[resIdx] = output[resIdx + 1] = output[resIdx + 2] = val;
                output[resIdx + 3] = 255;
            }
        }
        data.set(output);
        return imageData;
    }

    /**
     * Helper: Median Filter (3x3)
     */
    function applyMedianFilter(imageData) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;
        const output = new Uint8ClampedArray(data);

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const values = [];
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        values.push(data[((y + ky) * width + (x + kx)) * 4]);
                    }
                }
                values.sort((a, b) => a - b);
                const median = values[4];
                const resIdx = (y * width + x) * 4;
                output[resIdx] = output[resIdx + 1] = output[resIdx + 2] = median;
                output[resIdx + 3] = 255;
            }
        }
        data.set(output);
        return imageData;
    }

    /**
     * Highly aggressive binarization at a fixed threshold.
     * Bleaches out stylized shadows (3D effects).
     */
    function scanWithFixedThreshold(img, threshold, scale = 1.0) {
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        let imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const val = gray > threshold ? 255 : 0; // Pure Black or Pure White
            data[i] = data[i + 1] = data[i + 2] = val;
            data[i + 3] = 255;
        }

        ctx.putImageData(imageData, 0, 0);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
        });

        return code ? code.data : null;
    }

    // --- UI Update Functions ---

    /**
     * Resets the UI to the default scanning state.
     */
    function updateUIForScanning() {
        resultContainer.classList.remove('found');
        scanLabel.style.display = 'none';
        resultLink.textContent = '';
        resultLink.href = '#';
        scanAgainButton.style.display = 'none';
        loadingMessage.style.display = 'block';
        loadingMessage.innerText = "Loading camera...";
        scanLine.classList.remove('hidden');
    }

    /**
     * Updates the UI to display the found QR code result.
     * @param {string} url The URL found in the QR code.
     */
    function updateUIWithResult(url) {
        loadingMessage.style.display = 'none';
        scanLine.classList.add('hidden');
        resultContainer.classList.add('found');
        scanLabel.style.display = 'inline';
        resultLink.textContent = url;
        resultLink.href = url;
        scanAgainButton.style.display = 'inline-block';
    }


    // --- Event Listeners ---

    scanAgainButton.addEventListener('click', startScanning);
    fileInput.addEventListener('change', scanImageFile);

    // Start the scanner when the page loads
    startScanning();
});