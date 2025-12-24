/**
 * Модуль классов и цветов + Custom Popover 🎨
 */

// Список красивых цветов для быстрого выбора
const PRESET_COLORS = [
    "#FF3B30", "#FF9500", "#FFCC00", "#4CD964", "#5AC8FA",
    "#007AFF", "#5856D6", "#FF2D55", "#A2845E", "#8E8E93",
    "#E91E63", "#9C27B0", "#673AB7", "#3F51B5", "#00BCD4",
    "#009688", "#795548", "#607D8B", "#000000", "#FFFFFF"
];

let activeClassForColorChange = null; // Запоминаем, какому классу меняем цвет

// ==========================================================
// INITIALIZATION
// ==========================================================
document.addEventListener("DOMContentLoaded", function () {
    initColorPopover(); // Инициализация палитры
    
    // Загрузка данных
    window.classesAndColors = {};
    fetch('/get-classes-colors')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error!`);
            return response.json();
        })
        .then(colors => {
            window.classesAndColors = colors;
            window.displayClassesAndColors(colors);
        })
        .catch(error => {
            console.error("Error loading classes:", error);
        });
});

// ==========================================================
// POPOVER LOGIC
// ==========================================================

function initColorPopover() {
    const popover = document.getElementById('color-picker-popover');
    const swatchesContainer = document.getElementById('color-swatches');
    const customInput = document.getElementById('custom-color-input');

    // 1. Генерируем квадратики (swatches)
    swatchesContainer.innerHTML = '';
    PRESET_COLORS.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        swatch.style.backgroundColor = color;
        swatch.onclick = () => {
            applyColor(color);
            hidePopover();
        };
        swatchesContainer.appendChild(swatch);
    });

    // 2. Обработка "Custom..." инпута
    customInput.onchange = (e) => {
        applyColor(e.target.value);
        hidePopover();
    };

    // 3. Закрытие при клике вне попапа
    document.addEventListener('click', (e) => {
        if (!popover.contains(e.target) && !e.target.classList.contains('color-edit-btn')) {
            hidePopover();
        }
    });
    
    // Закрытие при скролле (чтобы попап не улетал)
    window.addEventListener('scroll', hidePopover, true);
}

function showPopover(event, className) {
    activeClassForColorChange = className;
    const popover = document.getElementById('color-picker-popover');
    const btn = event.currentTarget; // Кнопка, на которую нажали

    // Получаем координаты кнопки
    const rect = btn.getBoundingClientRect();

    // Позиционируем попап
    // top: кнопка.низ + скролл + 5px отступа
    // left: кнопка.лево (выравниваем по левому краю)
    // Также добавим проверку, чтобы не вылезло за экран справа/снизу (упрощенно)
    
    let top = rect.bottom + 5;
    let left = rect.left;

    // Если попап слишком близко к правому краю, сдвигаем влево
    if (left + 220 > window.innerWidth) {
        left = window.innerWidth - 230;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    
    popover.classList.remove('hidden');
    popover.classList.add('visible');
}

function hidePopover() {
    const popover = document.getElementById('color-picker-popover');
    if (popover) {
        popover.classList.remove('visible');
        setTimeout(() => popover.classList.add('hidden'), 200); // Ждем конца анимации
    }
    activeClassForColorChange = null;
}

function applyColor(hexColor) {
    if (!activeClassForColorChange) return;
    const rgb = hexToRgb(hexColor);
    changeClassColor(activeClassForColorChange, rgb);
}

// ==========================================================
// HELPERS & CORE LOGIC
// ==========================================================

function rgbToHex(rgbArray) {
    if (!rgbArray || rgbArray.length < 3) return "#000000";
    return "#" + rgbArray.map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}

// --- ИЗМЕНЕНИЕ ЦВЕТА ---
function changeClassColor(className, newRgbArray) {
    window.classesAndColors[className] = newRgbArray;
    window.displayClassesAndColors(window.classesAndColors);

    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = window.allFrames.find(f => f.frame_index === frameIndex);
    
    if (frameData) {
        const needsRedraw = frameData.annotations.some(ann => ann.label === className);
        if (needsRedraw) {
            drawBoundingBoxes(frameData.annotations);
            updateBoundingBoxList(frameData.annotations);
        }
    }

    if (typeof AutoSaveManager !== 'undefined') {
        AutoSaveManager.saveMetadata();
    }
}

// Статистика (модалка)
window.openClassDetails = function(className, colorArray) {
    // ... (Твой код открытия модалки статистики, без изменений) ...
    // Вставь сюда код из прошлого сообщения для openClassDetails
    // ...
    const modal = document.getElementById('class-details-modal');
    const closeBtn = document.getElementById('close-class-details-btn');
    
    closeBtn.onclick = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.remove('visible'), 300);
    };

    const badgeContainer = document.getElementById('modal-class-badge');
    const r = colorArray[0], g = colorArray[1], b = colorArray[2];
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 125 ? '#000000' : '#ffffff';
    
    badgeContainer.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    badgeContainer.style.color = textColor;
    badgeContainer.innerHTML = `<span class="class-name">${className}</span>`;

    document.getElementById('modal-total-objects').textContent = '...';
    document.getElementById('modal-total-frames').textContent = '...';
    document.getElementById('class-frames-list').innerHTML = '<div class="loading-spinner" style="margin: 20px auto;"></div>';

    modal.classList.add('visible');
    setTimeout(() => modal.classList.add('active'), 10);

    fetch(`/get-class-stats?class_name=${encodeURIComponent(className)}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('modal-total-objects').textContent = data.total_objects;
            document.getElementById('modal-total-frames').textContent = data.frames.length;

            const listContainer = document.getElementById('class-frames-list');
            listContainer.innerHTML = '';

            if (data.frames.length === 0) {
                listContainer.innerHTML = '<p>No objects found.</p>';
                return;
            }

            data.frames.forEach(item => {
                const btn = document.createElement('div');
                btn.className = 'frame-jump-btn';
                btn.innerHTML = `
                    <span class="frame-jump-number">#${item.frame_index}</span>
                    <span class="frame-jump-count">(${item.count})</span>
                `;
                btn.onclick = () => {
                    jumpToFrame(item.frame_index);
                    closeBtn.click();
                };
                listContainer.appendChild(btn);
            });
        })
        .catch(err => {
            console.error(err);
            document.getElementById('class-frames-list').innerHTML = '<p style="color:red">Error loading stats</p>';
        });
};

function jumpToFrame(targetFrameIndex) {
    const perPage = window.paginationInfo.perPage || 50;
    const targetPage = Math.floor(targetFrameIndex / perPage) + 1;
    if (window.paginationInfo.currentPage !== targetPage) {
        if (typeof loadPage === 'function') {
            loadPage(targetPage).then(() => highlightFrame(targetFrameIndex));
        }
    } else {
        highlightFrame(targetFrameIndex);
    }
}

function highlightFrame(frameIndex) {
    const frameData = window.allFrames.find(f => f.frame_index === frameIndex);
    if (frameData) {
        if (typeof showFrame === 'function') showFrame(frameData);
        setTimeout(() => {
            const img = document.querySelector(`.frames-list img[data-index="${frameIndex}"]`);
            if (img) {
                if (typeof markActiveImage === 'function') markActiveImage(img);
                img.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }, 200);
    }
}

// Рендеринг списка
window.displayClassesAndColors = function(classesColors) {
    const classesList = document.getElementById('classes-and-colors-list');
    if (!classesList) return;

    classesList.innerHTML = '';

    if (!classesColors || Object.keys(classesColors).length === 0) {
        classesList.innerHTML = '<div class="empty-state">No classes defined yet</div>';
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'classes-grid';

    for (const className in classesColors) {
        if (classesColors.hasOwnProperty(className)) {
            const color = classesColors[className];
            if (!color || color.length < 3) continue;

            const r = color[0], g = color[1], b = color[2];
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            const textColor = brightness > 125 ? '#000000' : '#ffffff';

            const tag = document.createElement('div');
            tag.className = 'class-tag';
            tag.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
            tag.style.color = textColor;
            
            const contentSpan = document.createElement('span');
            contentSpan.className = 'class-name';
            contentSpan.textContent = className;
            contentSpan.style.cursor = 'pointer';
            contentSpan.style.flexGrow = '1'; 
            contentSpan.onclick = () => window.openClassDetails(className, color);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'class-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'color-edit-btn';
            editBtn.innerHTML = '🎨';
            editBtn.title = 'Change Color';
            
            // 🔥 ВОТ ТУТ ОТКРЫТИЕ ПОПАПА 🔥
            editBtn.onclick = (e) => {
                e.stopPropagation();
                showPopover(e, className); // Передаем событие и имя класса
            };

            actionsDiv.appendChild(editBtn);
            tag.appendChild(contentSpan);
            tag.appendChild(actionsDiv);
            grid.appendChild(tag);
        }
    }
    classesList.appendChild(grid);
}