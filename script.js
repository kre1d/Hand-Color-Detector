// Finger color mapping
const fingerColors = {
    0: { name: 'Red', hex: '#FF3D5C', gradient: 'linear-gradient(135deg, #FF3D5C, #FF6B7A)' },
    1: { name: 'Gold', hex: '#FFB800', gradient: 'linear-gradient(135deg, #FFB800, #FFC800)' },
    2: { name: 'Cyan', hex: '#00D9FF', gradient: 'linear-gradient(135deg, #00D9FF, #00F0FF)' },
    3: { name: 'Purple', hex: '#6B4EFF', gradient: 'linear-gradient(135deg, #6B4EFF, #9B7AFF)' },
    4: { name: 'Green', hex: '#00D166', gradient: 'linear-gradient(135deg, #00D166, #4AFF00)' }
};

const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
const gemElement = document.getElementById('gem');
const colorNameElement = document.getElementById('colorName');
const colorCodeElement = document.getElementById('colorCode');
const errorMessageElement = document.getElementById('errorMessage');
const fingerIndicators = document.querySelectorAll('.finger-dot');

let currentColor = 0;
let camera = null;
let hands = null;
let manualStreamActive = false;
let manualStream = null;
let currentFacing = 'user'; // default to front camera on phones

// Initialize Hands model
async function initializeHands() {
    hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`,
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.5
    });

    hands.onResults(onResults);
    console.log('Hands model initialized');
}

// Setup camera (accept optional facingMode)
async function setupCamera(facingMode = null) {
    const cameraOptions = {
        onFrame: async () => {
            if (hands) {
                await hands.send({ image: videoElement });
            }
        },
        width: 640,
        height: 480
    };
    if (facingMode) cameraOptions.facingMode = facingMode;
    camera = new Camera(videoElement, cameraOptions);
}

// Initialize camera and start detection
async function initializeCamera() {
    try {
        if (manualStreamActive) {
            // manual stream is already feeding video; don't reinitialize MediaPipe Camera
            console.log('Manual stream active - skipping MediaPipe Camera initialization');
            return;
        }
        await setupCamera(currentFacing);
        await camera.initialize();
        
        // Wait for camera to be ready
        await new Promise(resolve => {
            const checkReady = () => {
                if (videoElement.videoWidth > 0) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        });

        camera.start();
        console.log('Camera initialized and started');
    } catch (err) {
        showError('Camera access denied. Please allow camera permissions.');
        console.error('Camera initialization error:', err);
    }
}

// Start processing a MediaStream directly (used for mobile after user gesture)
async function startStreamProcessing(stream) {
    try {
        manualStreamActive = true;
        manualStream = stream;
        videoElement.srcObject = stream;
        await videoElement.play();

        // Process frames using MediaPipe Hands directly in a RAF loop
        async function processFrame() {
            try {
                if (hands && videoElement.readyState >= 2) {
                    await hands.send({ image: videoElement });
                }
            } catch (e) {
                console.error('Frame processing error:', e);
            }
            if (manualStreamActive) requestAnimationFrame(processFrame);
        }

        requestAnimationFrame(processFrame);
        console.log('Manual stream processing started');
    } catch (err) {
        console.error('startStreamProcessing error:', err);
        showError('Failed to start camera stream.');
    }
}

// Set canvas size
function resizeCanvasToDisplaySize() {
    const container = canvasElement.parentElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvasElement.width !== width || canvasElement.height !== height) {
        canvasElement.width = width;
        canvasElement.height = height;
    }
}

// Results handler
function onResults(results) {
    resizeCanvasToDisplaySize();
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        console.log('Hands detected:', results.multiHandLandmarks.length);
        const landmarks = results.multiHandLandmarks[0];
        const handedness = results.multiHandedness[0];

        // Draw hand connections
        drawHandConnections(landmarks);

        // Detect which fingers are raised
        detectRaisedFingers(landmarks);
    }
}

function drawHandConnections(landmarks) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],           // Thumb
        [0, 5], [5, 6], [6, 7], [7, 8],           // Index
        [0, 9], [9, 10], [10, 11], [11, 12],      // Middle
        [0, 13], [13, 14], [14, 15], [15, 16],    // Ring
        [0, 17], [17, 18], [18, 19], [19, 20]     // Pinky
    ];

    ctx.strokeStyle = 'rgba(107, 78, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw connections
    for (const connection of connections) {
        const start = landmarks[connection[0]];
        const end = landmarks[connection[1]];

        const startX = start.x * canvasElement.width;
        const startY = start.y * canvasElement.height;
        const endX = end.x * canvasElement.width;
        const endY = end.y * canvasElement.height;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }

    // Draw landmarks with gradient colors
    for (let i = 0; i < landmarks.length; i++) {
        const landmark = landmarks[i];
        const x = landmark.x * canvasElement.width;
        const y = landmark.y * canvasElement.height;

        // Different colors for different parts
        if (i < 4) ctx.fillStyle = 'rgba(255, 61, 92, 0.9)'; // Thumb - Red
        else if (i < 8) ctx.fillStyle = 'rgba(255, 184, 0, 0.9)'; // Index - Gold
        else if (i < 12) ctx.fillStyle = 'rgba(0, 217, 255, 0.9)'; // Middle - Cyan
        else if (i < 16) ctx.fillStyle = 'rgba(107, 78, 255, 0.9)'; // Ring - Purple
        else ctx.fillStyle = 'rgba(0, 209, 102, 0.9)'; // Pinky - Green

        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fill();

        // Outer ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    console.log('Landmarks drawn:', landmarks.length);
}

function detectRaisedFingers(landmarks) {
    // Finger tip indices: thumb=4, index=8, middle=12, ring=16, pinky=20
    // We check if the tip is higher than the PIP joint
    const fingerTips = [4, 8, 12, 16, 20];
    const fingerPIPs = [3, 6, 10, 14, 18];

    let raisedFingers = [];

    for (let i = 0; i < fingerTips.length; i++) {
        const tip = landmarks[fingerTips[i]];
        const pip = landmarks[fingerPIPs[i]];

        // Check if finger tip is higher (lower y value) than PIP joint
        if (tip.y < pip.y - 0.05) {
            raisedFingers.push(i);
        }
    }

    // Update gem color based on detected finger
    if (raisedFingers.length > 0) {
        const dominantFinger = raisedFingers[0];
        updateGemColor(dominantFinger);
        displayFingerIndicators(raisedFingers, landmarks);
    }
}

function updateGemColor(fingerIndex) {
    if (fingerIndex !== currentColor) {
        currentColor = fingerIndex;

        const color = fingerColors[fingerIndex];
        const gem = document.querySelector('#gem');

        // Update gem gradient
        gem.style.background = color.gradient;

        // Update color info
        colorNameElement.textContent = color.name;
        colorCodeElement.textContent = color.hex;
        colorCodeElement.style.color = color.hex;
        colorCodeElement.style.borderColor = color.hex;
        colorCodeElement.style.background = `${color.hex}15`;

        // Add animation
        gem.style.animation = 'none';
        setTimeout(() => {
            gem.style.animation = 'float 3s ease-in-out infinite';
        }, 10);
    }
}

function displayFingerIndicators(raisedFingers, landmarks) {
    const fingerTips = [4, 8, 12, 16, 20];

    // Reset all indicators first
    fingerIndicators.forEach(indicator => indicator.classList.remove('active'));

    raisedFingers.forEach(fingerIndex => {
        const tip = landmarks[fingerTips[fingerIndex]];
        const indicator = fingerIndicators[fingerIndex];

        // Position indicator relative to canvas
        const container = canvasElement.parentElement;
        const x = tip.x * container.clientWidth;
        const y = tip.y * container.clientHeight;

        indicator.style.left = (x - 7.5) + 'px';
        indicator.style.top = (y - 7.5) + 'px';
        indicator.classList.add('active');

        // Update indicator class for correct styling
        indicator.classList.remove('thumb', 'index', 'middle', 'ring', 'pinky');
        const fingerClasses = ['thumb', 'index', 'middle', 'ring', 'pinky'];
        indicator.classList.add(fingerClasses[fingerIndex]);
    });
}

function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.classList.add('show');

    setTimeout(() => {
        errorMessageElement.classList.remove('show');
    }, 5000);
}

document.addEventListener('touchmove', (e) => {
    if (e.target.closest('.video-container')) {
        e.preventDefault();
    }
}, { passive: false });

// Prevent zoom on double tap
document.addEventListener('dblclick', (e) => {
    e.preventDefault();
});

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Disable zoom on mobile
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        });

        await initializeHands();

        // Permissions API check - if camera permission already granted, auto-start
        let permissionGranted = false;
        if (navigator.permissions && navigator.permissions.query) {
            try {
                const status = await navigator.permissions.query({ name: 'camera' });
                if (status.state === 'granted') permissionGranted = true;
                // listen for change (optional)
                status.onchange = () => {
                    if (status.state === 'granted') {
                        initializeCamera();
                        const m = document.getElementById('mobileStart');
                        if (m) m.style.display = 'none';
                    }
                };
            } catch (e) {
                // Permissions API may not support 'camera' in all browsers
                console.log('Permissions API camera query not supported', e);
            }
        }

        const mobileStart = document.getElementById('mobileStart');
        if (permissionGranted) {
            // auto-start camera when permission already granted
            await initializeCamera();
            if (mobileStart) mobileStart.style.display = 'none';
        } else {
            // show mobile overlay if available - user must gesture to allow camera on many phones
            if (mobileStart) mobileStart.style.display = 'block';
        }

        // If we're inside a known in-app browser, show the notice immediately
        if (isInAppBrowser()) {
            showInAppNotice();
        }

        console.log('Application initialized successfully');
    } catch (err) {
        console.error('Initialization error:', err);
        showError('Failed to initialize application. Please refresh the page.');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (camera) {
        camera.stop();
    }
    if (manualStreamActive && manualStream) {
        manualStream.getTracks().forEach(t => t.stop());
    }
});

// Handle visibility change to pause/resume detection
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (camera) camera.stop();
        if (manualStreamActive && manualStream) {
            manualStream.getTracks().forEach(t => t.enabled = false);
            try { videoElement.pause(); } catch (e) {}
        }
    } else {
        if (camera) camera.start();
        if (manualStreamActive && manualStream) {
            manualStream.getTracks().forEach(t => t.enabled = true);
            try { videoElement.play(); } catch (e) {}
        }
    }
});

// Handle orientation change for mobile
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        resizeCanvasToDisplaySize();
    }, 100);
});

// Handle screen lock/unlock on mobile
window.addEventListener('resume', () => {
    if (camera) camera.start();
});

window.addEventListener('pause', () => {
    if (camera) camera.stop();
});

// Mobile start button: request camera permission on user gesture
const mobileStart = document.getElementById('mobileStart');
if (mobileStart) {
    mobileStart.addEventListener('click', async () => {
        try {
            mobileStart.textContent = 'Requesting...';

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                showError('Camera API not available on this device/browser.');
                mobileStart.textContent = 'Tap to enable camera';
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });

            // Start processing the granted stream directly
            if (!hands) await initializeHands();
            await startStreamProcessing(stream);

            mobileStart.style.display = 'none';
        } catch (err) {
            console.error('Permission error:', err);
            mobileStart.textContent = 'Tap to enable camera';
            showError('Camera permission denied or unavailable.');
            // If in-app browser, show the notice explaining to open in Safari
            if (isInAppBrowser()) {
                showInAppNotice();
            }
        }
    });
}

// Switch camera between 'user' and 'environment'
async function toggleCamera() {
    currentFacing = (currentFacing === 'user') ? 'environment' : 'user';
    console.log('Switching camera to', currentFacing);

    // If using manual stream, stop current and request a new one
    if (manualStreamActive && manualStream) {
        manualStream.getTracks().forEach(t => t.stop());
        manualStreamActive = false;
        manualStream = null;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacing } });
            await startStreamProcessing(stream);
        } catch (err) {
            console.error('Error switching manual stream:', err);
            showError('Failed to switch camera.');
        }
        return;
    }

    // If using MediaPipe Camera, reinitialize it with new facing mode
    try {
        if (camera) {
            camera.stop();
            camera = null;
        }
        await setupCamera(currentFacing);
        await camera.initialize();
        camera.start();
    } catch (err) {
        console.error('Error switching camera with MediaPipe Camera util:', err);
        showError('Failed to switch camera.');
    }
}

// Helper: detect common in-app browser user agents (Messenger, Instagram, FB, etc.)
function isInAppBrowser() {
    const ua = navigator.userAgent || '';
    // common markers: FBAN, FBAV, Instagram, Messenger, Line
    return /FBAN|FBAV|Instagram|Messenger|Line|Twitter|FB_IAB|FB4A|Instagram|WhatsApp/i.test(ua);
}

// Show/hide the in-app browser notice
function showInAppNotice() {
    const notice = document.getElementById('inAppNotice');
    if (!notice) return;
    notice.style.display = 'block';
    notice.setAttribute('aria-hidden', 'false');
}

function hideInAppNotice() {
    const notice = document.getElementById('inAppNotice');
    if (!notice) return;
    notice.style.display = 'none';
    notice.setAttribute('aria-hidden', 'true');
}

// Wire up in-app notice buttons
const openExternalBtn = document.getElementById('openExternal');
const dismissInAppBtn = document.getElementById('dismissInApp');
if (openExternalBtn) {
    openExternalBtn.addEventListener('click', () => {
        // Try to open in external browser/tab
        try {
            const opened = window.open(window.location.href, '_blank');
            if (!opened) {
                // popup blocked - copy URL to clipboard and instruct user
                throw new Error('popup-blocked');
            }
            return;
        } catch (e) {
            // fallback: copy URL to clipboard and explain how to open in Safari
            const url = window.location.href;
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url).then(() => {
                    alert('URL copied to clipboard. Open Safari, paste the link, and load it to enable camera access.');
                }).catch(() => {
                    alert('Copy failed. Please long-press the link and choose "Open in Safari" or copy the URL manually.');
                });
            } else {
                alert('Please open this page in Safari or your device browser for camera access.');
            }
        }
    });
}
if (dismissInAppBtn) {
    dismissInAppBtn.addEventListener('click', () => {
        hideInAppNotice();
    });
}

// Wire up camera toggle button
const cameraToggleBtn = document.getElementById('cameraToggle');
if (cameraToggleBtn) {
    cameraToggleBtn.addEventListener('click', async () => {
        try {
            await toggleCamera();
        } catch (e) {
            console.error('Toggle camera error:', e);
            showError('Unable to toggle camera.');
        }
    });
}
