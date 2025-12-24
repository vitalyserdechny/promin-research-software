/**
 * Модуль классов и цветов + Статистика 📊
 */

// Глобальная функция для открытия деталей
window.openClassDetails = function(className, colorArray) {
    const modal = document.getElementById('class-details-modal');
    const closeBtn = document.getElementById('close-class-details-btn');
    
    // Настраиваем кнопку закрытия
    closeBtn.onclick = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.classList.remove('visible'), 300);
    };

    // 1. Отображаем "красивый бейдж" в заголовке модалки
    const badgeContainer = document.getElementById('modal-class-badge');
    const r = colorArray[0], g = colorArray[1], b = colorArray[2];
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const textColor = brightness > 125 ? '#000000' : '#ffffff';
    
    badgeContainer.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    badgeContainer.style.color = textColor;
    badgeContainer.innerHTML = `<span class="class-name">${className}</span>`;

    // 2. Сбрасываем старые данные
    document.getElementById('modal-total-objects').textContent = '...';
    document.getElementById('modal-total-frames').textContent = '...';
    document.getElementById('class-frames-list').innerHTML = '<div class="loading-spinner" style="margin: 20px auto;"></div>';

    // 3. Открываем модалку
    modal.classList.add('visible');
    setTimeout(() => modal.classList.add('active'), 10);

    // 4. Запрашиваем данные с сервера
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
                
                // --- ЛОГИКА ПРЫЖКА К КАДРУ ---
                btn.onclick = () => {
                    jumpToFrame(item.frame_index);
                    // Закрываем модалку после выбора
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

// Функция "Умного прыжка" к кадру
function jumpToFrame(targetFrameIndex) {
    // 1. Вычисляем на какой странице находится кадр
    const perPage = window.paginationInfo.perPage || 50;
    const targetPage = Math.floor(targetFrameIndex / perPage) + 1;

    console.log(`🚀 Jumping to frame ${targetFrameIndex} on page ${targetPage}`);

    // 2. Если мы не на той странице - грузим её
    if (window.paginationInfo.currentPage !== targetPage) {
        // Вызываем глобальную функцию загрузки страницы (из frames-rendering.js)
        if (typeof loadPage === 'function') {
            loadPage(targetPage).then(() => {
                // После загрузки ищем и активируем кадр
                highlightFrame(targetFrameIndex);
            });
        }
    } else {
        // Мы уже на нужной странице, просто ищем кадр
        highlightFrame(targetFrameIndex);
    }
}

// Вспомогательная функция подсветки и скролла
function highlightFrame(frameIndex) {
    // Ищем данные кадра в памяти
    const frameData = window.allFrames.find(f => f.frame_index === frameIndex);
    if (frameData) {
        // Отображаем на главном канвасе
        if (typeof showFrame === 'function') showFrame(frameData);
        
        // Подсвечиваем в ленте
        setTimeout(() => {
            const img = document.querySelector(`.frames-list img[data-index="${frameIndex}"]`);
            if (img) {
                if (typeof markActiveImage === 'function') markActiveImage(img);
                img.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }, 200); // Небольшая задержка, чтобы DOM успел отрисоваться
    }
}

// Основная функция отрисовки списка классов
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
            
            // Левая часть (Кликабельная для статистики)
            const contentSpan = document.createElement('span');
            contentSpan.className = 'class-name';
            contentSpan.textContent = className;
            contentSpan.style.cursor = 'pointer';
            contentSpan.style.flexGrow = '1'; // Занимает все свободное место
            
            // Обработчик клика для открытия деталей
            contentSpan.onclick = () => window.openClassDetails(className, color);

            // Правая часть (Кнопка редактирования)
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'class-actions';
            
            const editBtn = document.createElement('button');
            editBtn.className = 'color-edit-btn';
            editBtn.innerHTML = '🎨';
            editBtn.title = 'Change Color';
            
            // Тут можно добавить логику смены цвета, если нужно отдельно
            // editBtn.onclick = (e) => { e.stopPropagation(); ... }

            actionsDiv.appendChild(editBtn);
            
            tag.appendChild(contentSpan);
            tag.appendChild(actionsDiv);

            grid.appendChild(tag);
        }
    }
    classesList.appendChild(grid);
}

document.addEventListener("DOMContentLoaded", function () {
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