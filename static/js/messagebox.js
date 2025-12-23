/**
 * Module for Modal Dialogs (Alerts, Confirms, Prompts)
 * Styled with "Cute Science" aesthetic.
 * Author: Vitalii Serdechnyi 💜
 */

// --- INTERNAL HELPERS (Renamed to avoid conflict) ---

function msgBoxOpen(element) {
    element.style.display = 'block';
    element.style.zIndex = '2147483647'; // Force on top
    // Small delay to allow CSS display change to register before opacity transition
    requestAnimationFrame(() => {
        element.classList.add('active');
    });
    // Optional: document.body.style.overflow = 'hidden'; 
}

function msgBoxClose(element) {
    element.classList.remove('active');
    setTimeout(() => {
        element.style.display = 'none';
        // document.body.style.overflow = 'auto'; 
    }, 300); // Match CSS transition duration
}

// Helper: Set Icon (Handles switching from img to text/emoji)
function setModalIcon(container, iconEmoji) {
    // 1. Пытаемся найти существующую иконку
    let iconEl = container.querySelector('.message-icon');
    
    // 2. Если ее нет (в HTML ты ее не добавил), создаем её на лету
    if (!iconEl) {
        iconEl = document.createElement('div');
        iconEl.className = 'message-icon';
        // Вставляем в начало контента
        container.prepend(iconEl);
    }
    
    // 3. Если это старый IMG тег, меняем на DIV
    if (iconEl.tagName === 'IMG') {
        const newIcon = document.createElement('div');
        newIcon.className = 'message-icon';
        iconEl.parentNode.replaceChild(newIcon, iconEl);
        iconEl = newIcon;
    }

    iconEl.innerText = iconEmoji;
}

// ==========================================
// 1. MESSAGE BOX (Info/Warning/Error)
// ==========================================
function showMessageBox(message, type = 'info') {
    const messageBox = document.getElementById('message-box');
    if (!messageBox) return console.error("Message box HTML missing");

    const messageText = messageBox.querySelector('.message-text');
    const messageContent = messageBox.querySelector('.message-content');

    messageText.innerHTML = message;

    // Select Emoji based on type
    let emoji = 'ℹ️';
    if (type === 'warning') emoji = '⚠️';
    if (type === 'error') emoji = '🛑';
    if (type === 'success') emoji = '✅';

    setModalIcon(messageContent, emoji);
    msgBoxOpen(messageBox); // Используем новое имя
}

// ==========================================
// 2. CONFIRM BOX (Yes/No)
// ==========================================
function showConfirmBox(message, callback) {
    const confirmBox = document.getElementById('confirm-box');
    if (!confirmBox) return;

    const confirmText = document.getElementById('confirm-text');
    const confirmContent = confirmBox.querySelector('.message-content');

    confirmText.innerHTML = message;
    setModalIcon(confirmContent, '❓'); 

    msgBoxOpen(confirmBox); // Используем новое имя

    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    // Удаляем старые листенеры (клонированием), чтобы не множить их
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', () => {
        msgBoxClose(confirmBox);
        callback(true);
    });

    newCancel.addEventListener('click', () => {
        msgBoxClose(confirmBox);
        callback(false);
    });
}

// ==========================================
// 3. PROMPT BOX (Input)
// ==========================================
function showPromptBox(message, defaultValue = '', callback) {
    const promptBox = document.getElementById('prompt-box');
    if (!promptBox) return;

    const promptText = document.getElementById('prompt-text');
    const promptInput = document.getElementById('prompt-input');
    const promptContent = promptBox.querySelector('.message-content');

    promptText.textContent = message;
    promptInput.value = defaultValue;
    setModalIcon(promptContent, '✏️'); 

    msgBoxOpen(promptBox); // Используем новое имя

    const okBtn = document.getElementById('prompt-ok-btn');
    const cancelBtn = document.getElementById('prompt-cancel-btn');

    // Чистим листенеры
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    const newInput = promptInput.cloneNode(true); // Input тоже клонируем, чтобы убрать onKey
    
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    promptInput.parentNode.replaceChild(newInput, promptInput);

    const finalize = (result) => {
        msgBoxClose(promptBox);
        callback(result);
    };

    newOk.addEventListener('click', () => finalize({ confirmed: true, value: newInput.value }));
    newCancel.addEventListener('click', () => finalize({ confirmed: false, value: null }));
    
    newInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finalize({ confirmed: true, value: newInput.value });
        if (e.key === 'Escape') finalize({ confirmed: false, value: null });
    });

    setTimeout(() => newInput.focus(), 100);
}

// Initialize Global Close Button for simple Message Box
document.addEventListener("DOMContentLoaded", function () {
    const okBtn = document.getElementById('message-box-ok-btn');
    if (okBtn) {
        okBtn.addEventListener('click', function () {
            const messageBox = document.getElementById('message-box');
            msgBoxClose(messageBox);
        });
    }
});