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
     */
    function scanImageFile() {
        const file = fileInput.files[0];
        if (!file) return;

        stopScanning();
        updateUIForScanning(); // Show loading message while processing image
        loadingMessage.innerText = "Processing image...";

        const reader = new FileReader();
        reader.onload = e => {
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, img.width, img.height);
                const imageData = ctx.getImageData(0, 0, img.width, img.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'attemptBoth'
                });

                if (code) {
                    updateUIWithResult(code.data);
                } else {
                    alert('No QR code found in the image.');
                    startScanning();
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
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