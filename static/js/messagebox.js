/**
 * Модуль для работы с модальными окнами сообщений, подтверждений и ввода данных 🔥
 * 
 * Функционал:
 * - Показ сообщений в виде модальных окон с различными типами (информация, предупреждение, ошибка)
 * - Показ диалогов подтверждения с функцией обратного вызова
 * - Показ диалогов ввода данных с функцией обратного вызова
 * 
 * Автор: Сердечный Виталий ♥️
 */

// Показать сообщение в виде модального окна
// message - текст сообщения, type - тип сообщения (info, warning, error)
function showMessageBox(message, type = 'info') {
    const messageBox = document.getElementById('message-box');
    const messageText = document.querySelector('.message-text');
    const messageIcon = document.querySelector('.message-icon');

    messageText.innerText = '';
    messageText.innerHTML = message;

    if (type === 'info') {
        messageIcon.src = '../static/images/information.png'; // Иконка информации
    } else if (type === 'warning') {
        messageIcon.src = '../static/images/warning.png'; // Иконка предупреждения
    } else if (type === 'error') {
        messageIcon.src = '../static/images/error.png'; // Иконка ошибки
    }

    messageBox.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Показать диалог подтверждения
// message - текст сообщения, callback - функция обратного вызова
function showConfirmBox(message, callback) {
    const confirmBox = document.getElementById('confirm-box');
    const confirmText = document.getElementById('confirm-text');

    confirmText.innerHTML = message;
    confirmBox.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');

    function cleanup() {
        confirmBox.style.display = 'none';
        document.body.style.overflow = 'auto';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
    }

    function onOk() {
        cleanup();
        callback(true);
    }

    function onCancel() {
        cleanup();
        callback(false);
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
}

function showPromptBox(message, defaultValue = '', callback) {
    const promptBox = document.getElementById('prompt-box');
    const promptText = document.getElementById('prompt-text');
    const promptInput = document.getElementById('prompt-input');

    promptText.textContent = message;
    promptInput.value = defaultValue;

    promptBox.style.display = 'block';
    document.body.style.overflow = 'hidden';

    const okBtn = document.getElementById('prompt-ok-btn');
    const cancelBtn = document.getElementById('prompt-cancel-btn');

    function cleanup() {
        promptBox.style.display = 'none';
        document.body.style.overflow = 'auto';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
    }

    function onOk() {
        const value = promptInput.value;
        cleanup();
        callback({ confirmed: true, value });
    }

    function onCancel() {
        cleanup();
        callback({ confirmed: false, value: null });
    }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);

    promptInput.focus();
}

document.addEventListener("DOMContentLoaded", function () {
    const okBtn = document.getElementById('message-box-ok-btn');

    okBtn.addEventListener('click', function () {
        const messageBox = document.getElementById('message-box');
        messageBox.style.display = 'none';
        document.body.style.overflow = 'auto';
    });
});