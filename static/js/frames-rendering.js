/**
 * Модуль для отображения и управления кадрами 🖼️
 * Стиль: Классическая пагинация с подгрузкой (Clear & Load)
 */

// Глобальное состояние
window.allFrames = []; // В этом режиме храним кадры ТОЛЬКО ТЕКУЩЕЙ СТРАНИЦЫ
window.paginationInfo = {
    currentPage: 1,
    totalPages: 1, // Будет обновлено сервером
    perPage: 50,
    isLoading: false
};

// =========================================================
// 1. ОТРИСОВКА (RENDER)
// =========================================================

function showFrame(frameData) {
    const frameImage = document.getElementById("frame-image");
    const frameNumber = document.getElementById("frame-number");

    // Сброс src
    frameImage.src = ''; 
    
    frameImage.onload = () => {
        // Вызов функций отрисовки аннотаций (из другого модуля)
        if (typeof drawBoundingBoxes === 'function') drawBoundingBoxes(frameData.annotations);
        if (typeof updateBoundingBoxList === 'function') updateBoundingBoxList(frameData.annotations);
    };
    
    frameImage.src = frameData.url;
    frameNumber.textContent = frameData.frame_index;
    window.currentFrameIndex = frameData.frame_index;

    if (typeof AutoSaveManager !== 'undefined') {
        AutoSaveManager.saveMetadata();
    }
}

function markActiveImage(imgElement) {
    document.querySelectorAll(".frames-list img").forEach(img => img.classList.remove("active"));
    if (imgElement) imgElement.classList.add("active");
}

function renderCurrentPage(frames) {
    const frameList = document.querySelector(".frames-list");
    const pagesCounterSpan = document.getElementById("pages-counter");
    
    if (!frameList) return;

    // 1. ОЧИЩАЕМ предыдущие кадры (Классическая пагинация)
    frameList.innerHTML = ""; 
    frameList.classList.remove("hidden");

    // Убираем спиннер загрузки
    const loadingPanel = document.getElementById("loading-panel");
    if (loadingPanel) loadingPanel.classList.add("hidden");

    // 2. Обновляем счетчик страниц
    if (pagesCounterSpan) {
        pagesCounterSpan.textContent = `${window.paginationInfo.currentPage} / ${window.paginationInfo.totalPages}`;
    }

    // 3. Создаем картинки для текущей страницы
    frames.forEach((frameData) => {
        let img = document.createElement("img");
        img.src = frameData.url;
        img.alt = `Frame ${frameData.frame_index}`;
        img.dataset.index = frameData.frame_index;
        // Аннотации храним в атрибуте для быстрого доступа
        img.dataset.annotations = JSON.stringify(frameData.annotations);

        img.addEventListener("click", function () {
            showFrame(frameData);
            markActiveImage(img);
        });

        frameList.appendChild(img);
    });

    // Скролл ленты в начало при смене страницы
    frameList.scrollLeft = 0;
}

function updateButtonsState() {
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");

    // Блокируем кнопку "Назад", если мы на 1 странице
    if (prevButton) {
        prevButton.disabled = window.paginationInfo.currentPage <= 1;
        prevButton.style.opacity = window.paginationInfo.currentPage <= 1 ? "0.5" : "1";
    }

    // Блокируем кнопку "Вперед", если это последняя страница
    if (nextButton) {
        const isLast = window.paginationInfo.currentPage >= window.paginationInfo.totalPages;
        nextButton.disabled = isLast;
        nextButton.style.opacity = isLast ? "0.5" : "1";
    }
}

// =========================================================
// 2. ЛОГИКА ЗАГРУЗКИ (LOAD)
// =========================================================

async function loadPage(pageNumber) {
    if (window.paginationInfo.isLoading) return;
    
    window.paginationInfo.isLoading = true;
    console.log(`📡 Загрузка страницы ${pageNumber}...`);

    try {
        const response = await fetch(`/get-frames?page=${pageNumber}&per_page=${window.paginationInfo.perPage}`);
        if (!response.ok) throw new Error("Ошибка сети");
        
        const data = await response.json();
        
        const frames = data.frames || [];
        const meta = data.pagination || {};

        // Обновляем глобальные переменные
        // ВАЖНО: window.allFrames теперь хранит только ТЕКУЩУЮ страницу
        // Это безопасно для твоего сохранения, так как сервер обновляет файлы точечно
        window.allFrames = frames; 
        
        window.paginationInfo.currentPage = meta.current_page || pageNumber;
        window.paginationInfo.totalPages = meta.total_pages || 1;

        // Рисуем
        renderCurrentPage(frames);

        if (typeof AutoSaveManager !== 'undefined') {
            AutoSaveManager.saveMetadata();
        }
        
        // Обновляем состояние кнопок
        updateButtonsState();

        // Если есть кадры, покажем первый как активный (опционально)
        // или если мы вернулись на страницу, где был выбранный кадр
        if (frames.length > 0) {
             // Можно добавить логику восстановления выделения, если нужно
             // Пока просто не сбрасываем main view, если кадр не на этой странице
        }

    } catch (error) {
        console.error("Error loading page:", error);
    } finally {
        window.paginationInfo.isLoading = false;
    }
}

// Восстановление состояния при перезагрузке страницы
async function restoreState() {
    try {
        const response = await fetch('/get-last-frame-and-page-number');
        const data = await response.json();
        
        const savedPage = data.page_number || 1;
        const savedFrameIndex = data.last_frame_index || 0;

        // Грузим сохраненную страницу
        await loadPage(savedPage);

        // Пытаемся найти кадр и подсветить его
        const targetFrame = window.allFrames.find(f => f.frame_index === savedFrameIndex);
        if (targetFrame) {
            showFrame(targetFrame);
            setTimeout(() => {
                const img = document.querySelector(`.frames-list img[data-index="${savedFrameIndex}"]`);
                if (img) markActiveImage(img);
            }, 100);
        } else if (window.allFrames.length > 0) {
             // Если сохраненного кадра нет на этой странице (странно, но бывает), показываем первый
             showFrame(window.allFrames[0]);
             markActiveImage(document.querySelector(".frames-list img"));
        }

    } catch (error) {
        console.error("Error restoring state:", error);
        loadPage(1); // Фолбэк на 1 страницу
    }
}

// =========================================================
// 3. ИНИЦИАЛИЗАЦИЯ
// =========================================================

document.addEventListener("DOMContentLoaded", function () {
    // Настраиваем кнопки
    const nextButton = document.getElementById("next-page");
    const prevButton = document.getElementById("prev-page");

    if (nextButton) {
        nextButton.onclick = (e) => {
            e.preventDefault();
            if (window.paginationInfo.currentPage < window.paginationInfo.totalPages) {
                loadPage(window.paginationInfo.currentPage + 1);
            }
        };
    }

    if (prevButton) {
        // Убедимся, что кнопка видна (вдруг прошлая версия кода ее скрыла)
        prevButton.style.display = "inline-block"; 
        prevButton.onclick = (e) => {
            e.preventDefault();
            if (window.paginationInfo.currentPage > 1) {
                loadPage(window.paginationInfo.currentPage - 1);
            }
        };
    }

    // Запускаем процесс
    restoreState();
});

// =========================================================
// 4. АВТОСОХРАНЕНИЕ
// =========================================================
