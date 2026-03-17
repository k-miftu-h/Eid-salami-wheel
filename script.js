// Firebase imports (CORRECT)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, increment, setDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCiNVhCu43Vy14kVn4-TZvBuxALSNMP1AQ",
  authDomain: "eid-salami-wheel-25960.firebaseapp.com",
  projectId: "eid-salami-wheel-25960",
  storageBucket: "eid-salami-wheel-25960.firebasestorage.app",
  messagingSenderId: "990653700750",
  appId: "1:990653700750:web:c262807d65afd6aeea07df",
  measurementId: "G-058ZK6GEHG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore (THIS is what you actually need)
const db = getFirestore(app);

// --- APP STATE ---
let currentUser = null;
let isSpinning = false;
let currentRotation = 0; // Track total rotation for cumulative spins
const OPTIONS = [
    { label: "বেশি ক্লোজ", fullLabel: "বেশি ক্লোজ জুনিয়র", value: 20 },
    { label: "অল্প ক্লোজ", fullLabel: "অল্প ক্লোজ জুনিয়র", value: 10 },
    { label: "মেধাবী", fullLabel: "মেধাবী জুনিয়র", value: 2 },
    { label: "ভদ্র", fullLabel: "ভদ্র জুনিয়র", value: 5 },
    { label: "দেখা হলে সালাম", fullLabel: "দেখা হলে সালাম দেয় জুনিয়র", value: 9 },
    { label: "ইনবক্সে সালাম", fullLabel: "ইনবক্সে সালাম দেয় জুনিয়র", value: 6 },
    { label: "সালামির জন্য সালাম", fullLabel: "সালামি নেয়ার জন্য সালাম দেয় জুনিয়র", value: 0.5 },
    { label: "খোঁজখবর", fullLabel: "খোঁজখবর রাখা জুনিয়র", value: 30 },
    { label: "রুমে আসে", fullLabel: "রুমে আসা জুনিয়র", value: 15 },
    { label: "ক্লাব সাড়া", fullLabel: "ক্লাবের কাজে সাড়া দেয়া জুনিয়র", value: 22 }
];
const REWARDS = OPTIONS.map(opt => opt.value);

// --- DOM ELEMENTS ---
const loginScreen = document.getElementById('login-screen');
const wheelScreen = document.getElementById('wheel-screen');
const userIdInput = document.getElementById('user-id-input');
const startBtn = document.getElementById('start-btn');
const loginError = document.getElementById('login-error');
const loadingOverlay = document.getElementById('loading-overlay');

const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spin-btn');
const spinsLeftCount = document.getElementById('spins-left-count');
const totalSalamiText = document.getElementById('total-salami');

// Modal Elements
const modal = document.getElementById('result-modal');
const modalAmount = document.getElementById('modal-amount');
const modalMessage = document.getElementById('modal-message');
const closeModalBtn = document.getElementById('close-modal');
const wheelError = document.getElementById('wheel-error');

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    const savedId = sessionStorage.getItem('eid_user_id');
    if (savedId) {
        userIdInput.value = savedId;
        validateUser(savedId);
    }
});

// --- CORE FUNCTIONS ---

/**
 * Validates the User ID against Firestore
 * @param {string} userId 
 */
async function validateUser(userId) {
    if (!userId) {
        showError(loginError, "Please enter an ID");
        return;
    }

    showLoading(true);
    loginError.textContent = "";

    try {
        const userDocRef = doc(db, "users", userId.trim());
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
            showError(loginError, "Invalid ID. Access denied.");
            showLoading(false);
            return;
        }

        const data = userDoc.data();

        if (data.active === false) {
            showError(loginError, "This ID has been disabled.");
            showLoading(false);
            return;
        }

        // Success! Store user and switch screen
        currentUser = { id: userId.trim(), ...data };
        sessionStorage.setItem('eid_user_id', currentUser.id);
        
        showScreen('wheel-screen');
        setupWheelScreen();
    } catch (error) {
        console.error("Login error:", error);
        showError(loginError, "Connection error. Please try again.");
    } finally {
        showLoading(false);
    }
}

/**
 * Prepares the wheel screen with user data
 */
function setupWheelScreen() {
    renderWheel();
    updateUI();
}

/**
 * Renders wheel segments and dividers dynamically
 */
function renderWheel() {
    wheel.innerHTML = '';

    const total = OPTIONS.length;
    const angleStep = 360 / total;

    const rect = wheel.getBoundingClientRect();
    const baseRadius = (rect.width / 2 || 200);

    const valueRadius = baseRadius * 0.45; // moved further from center
    const labelRadius = baseRadius * 0.65; // slightly more outer

    OPTIONS.forEach((opt, i) => {
        const startAngle = i * angleStep;
        const centerAngle = startAngle + angleStep / 2;

        // --- DIVIDER ---
        const divider = document.createElement('div');
        divider.className = 'divider';
        divider.style.transform = `
            rotate(${startAngle}deg)
            translateY(-100%)
        `;
        wheel.appendChild(divider);

        // --- VALUE (INNER) ---
        const value = document.createElement('div');
        value.className = 'segment-value';

        value.style.transform = `
            rotate(${centerAngle}deg)
            translateY(-${valueRadius}px)
            translateY(8px)
        `;

        value.textContent = opt.value;

        // --- LABEL (OUTER) ---
        const label = document.createElement('div');
        label.className = 'segment-label';

        // Micro spread offset to prevent crowding
        const spreadOffset = (i % 2 === 0) ? 0 : 6;

        label.style.transform = `
            rotate(${centerAngle}deg)
            translateY(-${labelRadius + spreadOffset}px)
            translateY(6px)
        `;

        // Replace spaces with <br> to force one word per line
        label.innerHTML = opt.label.split(' ').join('<br>');

        wheel.appendChild(value);
        wheel.appendChild(label);
    });
}

/**
 * Handles the wheel spinning logic
 */
async function spinWheel() {
    if (isSpinning || !currentUser) return;

    // 1. Fetch latest data from Firestore (Source of Truth)
    showLoading(true);
    wheelError.textContent = "";
    
    try {
        const userDocRef = doc(db, "users", currentUser.id);
        const userDoc = await getDoc(userDocRef);
        const data = userDoc.data();

        if (data.spins >= (data.maxSpins || 3)) {
            showError(wheelError, "No spins left!");
            spinBtn.disabled = true;
            showLoading(false);
            return;
        }

        showLoading(false);
        isSpinning = true;
        spinBtn.disabled = true;

        // 2. Select Reward Index FIRST
        const rewardIndex = Math.floor(Math.random() * REWARDS.length);
        const rewardValue = REWARDS[rewardIndex];
        
        // 3. Calculate Rotation (CUMULATIVE)
        const anglePerSegment = 360 / REWARDS.length;
        const extraSpins = 360 * 5; // At least 5 full rotations
        
        // The angle needed to land on the rewardIndex segment starting from 0
        // (360 - offset) puts the segment at the top (0deg)
        const targetAngle = (360 - (rewardIndex * anglePerSegment) - (anglePerSegment / 2));
        
        // Add to current rotation to keep it spinning forward
        // We calculate how much we need to add to reach the next 'targetAngle' position
        const rotationToNextTarget = extraSpins + (targetAngle - (currentRotation % 360) + 360) % 360;
        currentRotation += (rotationToNextTarget === 0 ? extraSpins : rotationToNextTarget);

        wheel.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
        wheel.style.transform = `rotate(${currentRotation}deg)`;

        // 4. Update Firestore after animation starts
        // The requirement says "After animation: Update Firestore".
        setTimeout(async () => {
            // Update local state FIRST so UI functions see the new data
            currentUser.spins = (data.spins || 0) + 1;
            currentUser.lastReward = rewardValue;

            // 5. Final UI Update
            displayResult(OPTIONS[rewardIndex]);
            showResultModal(OPTIONS[rewardIndex]);

            try {
                // 6. Update Firestore (Source of Truth)
                await setDoc(userDocRef, {
                    spins: currentUser.spins,
                    lastReward: currentUser.lastReward
                }, { merge: true });

                isSpinning = false;
                
                if (currentUser.spins < (data.maxSpins || 3)) {
                    spinBtn.disabled = false;
                }
            } catch (err) {
                console.error("Update error:", err);
                showError(wheelError, "Error saving result. Contact Admin.");
                // Re-enable button on error so user can try again or at least not be stuck
                isSpinning = false;
                spinBtn.disabled = false;
            }
        }, 5100); // slightly longer than the 5s transition

    } catch (error) {
        console.error("Spin error:", error);
        showError(wheelError, "Network error. Try again.");
        showLoading(false);
    }
}

// --- UI HELPERS ---

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function updateUI() {
    const max = currentUser.maxSpins || 3;
    const remaining = Math.max(0, max - currentUser.spins);
    
    spinsLeftCount.textContent = remaining;
    
    if (remaining <= 0) {
        spinBtn.disabled = true;
        totalSalamiText.textContent = `Last Reward: ${currentUser.lastReward || 0} tk Salami`;
    } else {
        spinBtn.disabled = false;
        if (currentUser.lastReward) {
            totalSalamiText.textContent = `Last Reward: ${currentUser.lastReward} tk Salami`;
        }
    }
}

function displayResult(option) {
    totalSalamiText.textContent = `Last Reward: ${option.value} tk Salami`;
    updateUI();
}

function showError(element, message) {
    element.textContent = message;
    setTimeout(() => {
        element.textContent = "";
    }, 5000);
}

/**
 * Displays the result in a modal
 */
function showResultModal(option) {
    modalAmount.textContent = `+${option.value} টাকা`;
    modalMessage.textContent = option.fullLabel;
    
    // Slight delay to allow wheel to stop fully
    setTimeout(() => {
        modal.classList.add('active');
    }, 200);
}

function showLoading(isLoading) {
    if (isLoading) {
        loadingOverlay.classList.add('active');
    } else {
        loadingOverlay.classList.remove('active');
    }
}

// --- EVENT LISTENERS ---

startBtn.addEventListener('click', () => {
    validateUser(userIdInput.value);
});

userIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') validateUser(userIdInput.value);
});

spinBtn.addEventListener('click', spinWheel);

// Close Modal
closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
});

// Close modal on background click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});
