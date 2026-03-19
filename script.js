// Firebase imports (only used for JNR spin tracking)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCiNVhCu43Vy14kVn4-TZvBuxALSNMP1AQ",
    authDomain: "eid-salami-wheel-25960.firebaseapp.com",
    projectId: "eid-salami-wheel-25960",
    storageBucket: "eid-salami-wheel-25960.firebasestorage.app",
    messagingSenderId: "990653700750",
    appId: "1:990653700750:web:c262807d65afd6aeea07df",
    measurementId: "G-058ZK6GEHG"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ─── APP STATE ───────────────────────────────────────────────────────────────
let isSpinning = false;
let currentRotation = 0;
let isUnlimitedUser = false;
let spinsUsed = 0;
const MAX_SPINS = 3;

const OPTIONS = [
    { label: "বেশি ক্লোজ", fullLabel: "বেশি ক্লোজ জুনিয়র", value: 20 },
    { label: "অল্প ক্লোজ", fullLabel: "অল্প ক্লোজ জুনিয়র", value: 10 },
    { label: "মেধাবী", fullLabel: "মেধাবী জুনিয়র", value: 2 },
    { label: "ভদ্র", fullLabel: "ভদ্র জুনিয়র", value: 5 },
    { label: "দেখা হলে সালাম", fullLabel: "দেখা হলে সালাম দেয় জুনিয়র", value: 9 },
    { label: "ইনবক্সে সালাম", fullLabel: "ইনবক্সে সালাম দেয় জুনিয়র", value: 6 },
    { label: "সালামির জন্য সালাম", fullLabel: "সালামি নেয়ার জন্য সালাম দেয় জুনিয়র", value: 0.5 },
    { label: "খোঁজখবর", fullLabel: "খোঁজখবর রাখা জুনিয়র", value: 30 },
    { label: "রুমে আসে", fullLabel: "রুমে আসা জুনিয়র", value: 15 },
    { label: "ক্লাব সাড়া", fullLabel: "ক্লাবের কাজে সাড়া দেয়া জুনিয়র", value: 22 }
];
const REWARDS = OPTIONS.map(o => o.value);

// ─── URL HELPERS ─────────────────────────────────────────────────────────────

/** Returns ?bk= number or null */
function getBkashNumber() {
    const bk = new URLSearchParams(window.location.search).get("bk");
    return (bk && /^\d{10,15}$/.test(bk)) ? bk : null;
}

/** Parses SALAMI-XXXXX-ROLE format, returns role or null */
function getUserRole(code) {
    if (!code) return null;
    const parts = code.split("-");
    if (parts.length < 3 || parts[0].toUpperCase() !== "SALAMI") return null;
    return parts[parts.length - 1].toUpperCase(); // JNR / SNR / BTC
}

// ─── DOM ─────────────────────────────────────────────────────────────────────
const loginScreen = document.getElementById('login-screen');
const wheelScreen = document.getElementById('wheel-screen');
const messageScreen = document.getElementById('message-screen');

const codeInput = document.getElementById('code-input');
const loginBtn = document.getElementById('login-btn');
const errorText = document.getElementById('error-text');
const loadingOverlay = document.getElementById('loading-overlay');

const wheel = document.getElementById('wheel');
const spinBtn = document.getElementById('spin-btn');
const spinsLeftCount = document.getElementById('spins-left-count');
const totalSalamiTxt = document.getElementById('total-salami');
const wheelError = document.getElementById('wheel-error');

const modal = document.getElementById('result-modal');
const modalAmount = document.getElementById('modal-amount');
const modalMessage = document.getElementById('modal-message');
const modalBkash = document.getElementById('modal-bkash');
const closeModalBtn = document.getElementById('close-modal');

const messageEmoji = document.getElementById('message-emoji');
const messageTitle = document.getElementById('message-title');
const messageBody = document.getElementById('message-body');

// ─── INIT ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const isPublic = new URLSearchParams(window.location.search).get("mode") === "public";
    if (isPublic) {
        isUnlimitedUser = true;
        showScreen('wheel-screen');
        setupWheelScreen();
    }
    // else: login screen is already active by default
});

// ─── LOGIN HANDLER ────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', handleLogin);
codeInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });

function handleLogin() {
    const code = codeInput.value.trim();
    const role = getUserRole(code);

    if (!role) {
        errorText.textContent = "⚠️ Invalid code!";
        codeInput.style.borderColor = "#d32f2f";
        setTimeout(() => {
            errorText.textContent = "";
            codeInput.style.borderColor = "";
        }, 3000);
        return;
    }

    handleUser(role);
}

// ─── ROLE-BASED ROUTING ───────────────────────────────────────────────────────
function handleUser(role) {
    const bkash = getBkashNumber();
    const bkDisplay = bkash || "017XXXXXXXX";

    showScreen(null); // hide all

    if (role === "JNR") {
        isUnlimitedUser = true;
        showScreen('wheel-screen');
        setupWheelScreen();
    }
    else if (role === "BTC") {
        showMessage(
            "বন্ধুত্বের Token Of Appreciation জানাও এই Number এ-",
            `📱 bKash: <strong>${bkDisplay}</strong>`
        );
    }
    else if (role === "SNR") {
        showMessage(
            "আসসালামু আলাইকুম প্রিয় সিনিয়র ভাই, সালামি Please👉👈",
            `📱 bKash: <strong>${bkDisplay}</strong>`
        );
    }
    else {
        errorText.textContent = "⚠️ Unknown role!";
        showScreen('login-screen');
    }
}

// ─── WHEEL SETUP ──────────────────────────────────────────────────────────────
function setupWheelScreen() {
    renderWheel();
    updateSpinsUI();
}

function renderWheel() {
    wheel.innerHTML = '';

    const baseRadius = (wheel.getBoundingClientRect().width / 2) || 200;
    const valueRadius = baseRadius * 0.42;
    const labelRadius = baseRadius * 0.68;
    const angleStep = 360 / OPTIONS.length;

    OPTIONS.forEach((opt, i) => {
        const startAngle = i * angleStep;
        const centerAngle = startAngle + angleStep / 2;

        // Divider line
        const divider = document.createElement('div');
        divider.className = 'divider';
        divider.style.transform = `rotate(${startAngle}deg) translateY(-100%)`;
        wheel.appendChild(divider);

        // Value — radial (rotated 90° to follow slice)
        const value = document.createElement('div');
        value.className = 'segment-value';
        value.style.transform = `rotate(${centerAngle}deg) translateY(-${valueRadius}px) rotate(90deg)`;
        value.textContent = opt.value;
        wheel.appendChild(value);

        // Label — radial
        const label = document.createElement('div');
        label.className = 'segment-label';
        const spreadOffset = (i % 2 === 0) ? 0 : 5;
        label.style.transform = `rotate(${centerAngle}deg) translateY(-${labelRadius + spreadOffset}px) rotate(90deg)`;
        label.innerHTML = opt.label.split(' ').join('<br>');
        wheel.appendChild(label);
    });
}

// ─── SPIN LOGIC ───────────────────────────────────────────────────────────────
spinBtn.addEventListener('click', spinWheel);

async function spinWheel() {
    if (isSpinning) return;

    // Enforce spin limit for limited users
    if (!isUnlimitedUser) {
        if (spinsUsed >= MAX_SPINS) {
            showError(wheelError, "কোনো spin বাকি নেই!");
            spinBtn.disabled = true;
            return;
        }
    }

    isSpinning = true;
    spinBtn.disabled = true;
    wheelError.textContent = "";

    const rewardIndex = Math.floor(Math.random() * REWARDS.length);
    const anglePerSeg = 360 / REWARDS.length;
    const extraSpins = 360 * 5;
    const targetAngle = 360 - (rewardIndex * anglePerSeg) - (anglePerSeg / 2);
    const delta = extraSpins + (targetAngle - (currentRotation % 360) + 360) % 360;
    currentRotation += delta || extraSpins;

    wheel.style.transition = 'transform 5s cubic-bezier(0.15, 0, 0.15, 1)';
    wheel.style.transform = `rotate(${currentRotation}deg)`;

    setTimeout(() => {
        spinsUsed++;
        const opt = OPTIONS[rewardIndex];
        totalSalamiTxt.textContent = `Last Reward: ${opt.value} tk Salami`;
        showResultModal(opt);
        updateSpinsUI();

        isSpinning = false;
        if (isUnlimitedUser || spinsUsed < MAX_SPINS) {
            spinBtn.disabled = false;
        }
    }, 5100);
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
}

function showMessage(title, htmlBody) {
    messageEmoji.style.display = 'none';
    messageTitle.textContent = title;
    messageBody.innerHTML = htmlBody;
    showScreen('message-screen');
}

function updateSpinsUI() {
    if (isUnlimitedUser) {
        spinsLeftCount.textContent = '∞';
    } else {
        spinsLeftCount.textContent = Math.max(0, MAX_SPINS - spinsUsed);
        if (spinsUsed >= MAX_SPINS) spinBtn.disabled = true;
    }
}

function showResultModal(opt) {
    const bkash = getBkashNumber();
    modalAmount.textContent = `+${opt.value} টাকা`;
    modalMessage.textContent = opt.fullLabel;

    modalBkash.style.display = 'none';

    setTimeout(() => modal.classList.add('active'), 200);
}

function showError(el, msg) {
    el.textContent = msg;
    setTimeout(() => { el.textContent = ""; }, 4000);
}

function showLoading(on) {
    loadingOverlay.classList.toggle('active', on);
}

// Modal close
closeModalBtn.addEventListener('click', () => modal.classList.remove('active'));
modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });

// Go Back (message screen)
window.goBack = () => location.reload();
