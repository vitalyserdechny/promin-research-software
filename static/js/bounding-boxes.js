/**
 * Модуль для отображения и управления рамками аннотаций (bounding boxes) на изображениях.
 * 
 * Функционал:
 * - Отрисовка рамок на изображении
 * - Обновление списка рамок
 * - Управление изменением размеров рамок
 * - Изменение классов рамок
 * - Удаление рамок
 * - Копирование рамок в буфер обмена
 * - Вставка рамок из буфера обмена
 * 
 * 
 * 
 * Автор: Сердечный Виталий ♥️
 */

let resizing = false;
let currentAnnotation, startX, startY, startWidth, startHeight, startLeft, startTop, resizeDir;

let isMoving = false;
let moveStartX, moveStartY;
let moveStartLeft, moveStartTop;

let bufferAnnotationsData = null;

let contextMenuTargetIndex = null;

function drawBoundingBoxes(annotations) {
    const boxesContainer = document.getElementById("bounding-boxes");
    boxesContainer.innerHTML = "";

    const image = document.getElementById("frame-image");
    const imageWidth = image.width;
    const imageHeight = image.height;

    annotations.forEach((ann, index) => {
        let box = document.createElement("div");
        box.className = "bounding-box";
        box.dataset.index = index;

        // Рассчитываем размеры и позицию рамки относительно изображения
        const boxLeft = (ann.x - ann.width / 2) * imageWidth;
        const boxTop = (ann.y - ann.height / 2) * imageHeight;
        const boxWidth = ann.width * imageWidth;
        const boxHeight = ann.height * imageHeight;
        let color = [0, 0, 0];

        // Устанавливаем стиль для рамки
        box.style.position = "absolute"; // Позиционируем относительно родительского контейнера
        box.style.left = `${boxLeft}px`;
        box.style.top = `${boxTop}px`;
        box.style.width = `${boxWidth}px`;
        box.style.height = `${boxHeight}px`;

        box.style.cursor = "move";
        box.addEventListener("mousedown", startMove);
        box.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            e.stopPropagation();

            contextMenuTargetIndex = index;
            showContextMenu(e.clientX, e.clientY);
        });

        // Устанавливаем цвет рамки на основе класса
        if (window.classesAndColors && window.classesAndColors[ann.label]) {
            color = window.classesAndColors[ann.label];
            box.style.borderColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            box.style.backgroundColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3)`;
        }

        let label = document.createElement("span");
        label.className = "label";
        label.innerText = ann.label;

        box.appendChild(label);

        // Добавляем 8 ручек (4 угловых, 4 боковых)
        ["tl", "tr", "bl", "br", "l", "r", "t", "b"].forEach(pos => {
            let handle = document.createElement("div");
            handle.className = `resize-handle handle-${pos}`;
            handle.classList.add("hidden-handle");
            handle.dataset.index = index;
            handle.dataset.pos = pos;
            handle.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
            box.appendChild(handle);

            handle.addEventListener("mousedown", startResize);
        });

        // Добавляем обработчики событий для появления/скрытия ручек
        box.addEventListener("mouseenter", function () {
            box.querySelectorAll(".resize-handle").forEach(handle => {
                handle.classList.remove("hidden-handle");
            });
        });

        box.addEventListener("mouseleave", function () {
            box.querySelectorAll(".resize-handle").forEach(handle => {
                handle.classList.add("hidden-handle");
            });
        });

        boxesContainer.appendChild(box);
    });
}

function updateBoundingBoxList(annotations) {
    const listContainer = document.getElementById("bounding-boxes-values");

    listContainer.innerHTML = "";

    annotations.forEach((ann, index) => {
        let item = document.createElement("div");
        item.className = "bounding-box-item";
        item.innerHTML = `
        <strong>Об'єкт #${index + 1}</strong>
        <span><strong>Клас:</strong> ${ann.label}</span>
        <span><strong>Позиція:</strong> x: ${ann.x.toFixed(4)}, y: ${ann.y.toFixed(4)}</span>
        <span><strong>Розмір:</strong> w: ${ann.width.toFixed(4)}, h: ${ann.height.toFixed(4)}</span>
        <span><strong>Впевненість:</strong> ${ann.confidence.toFixed(4)}</span>
    `;

        item.addEventListener("mouseenter", function () {
            drawBoundingBoxes([annotations[index]]);
        });

        item.addEventListener("mouseleave", function () {
            drawBoundingBoxes(annotations);
        });

        listContainer.appendChild(item);
    });
}

function startResize(e) {
    e.stopPropagation();
    resizing = true;
    const index = parseInt(e.target.dataset.index);
    resizeDir = e.target.dataset.pos;

    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);

    if (!frameData) return;

    currentAnnotation = frameData.annotations[index];

    const image = document.getElementById("frame-image");
    startX = e.clientX;
    startY = e.clientY;
    startWidth = currentAnnotation.width * image.width;
    startHeight = currentAnnotation.height * image.height;
    startLeft = (currentAnnotation.x - currentAnnotation.width / 2) * image.width;
    startTop = (currentAnnotation.y - currentAnnotation.height / 2) * image.height;

    window.addEventListener("mousemove", resizeBoundingBox);
    window.addEventListener("mouseup", stopResize);
}

function resizeBoundingBox(e) {
    if (!resizing) return;

    const currentScale = (window.transformState && window.transformState.scale) ? window.transformState.scale : 1;

    const image = document.getElementById("frame-image");

    const dx = (e.clientX - startX) / currentScale;
    const dy = (e.clientY - startY) / currentScale;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    if (resizeDir.includes("l")) { // Лево
        newWidth = Math.max(0.01, startWidth - dx);
        newLeft = startLeft + dx;
    }
    if (resizeDir.includes("r")) { // Право
        newWidth = Math.max(0.01, startWidth + dx);
    }
    if (resizeDir.includes("t")) { // Верх
        newHeight = Math.max(0.01, startHeight - dy);
        newTop = startTop + dy;
    }
    if (resizeDir.includes("b")) { // Низ
        newHeight = Math.max(0.01, startHeight + dy);
    }

    if (newLeft < 0) {
        newWidth += newLeft;
        newLeft = 0;
    }
    if (newTop < 0) {
        newHeight += newTop;
        newTop = 0;
    }
    if (newLeft + newWidth > image.width) {
        newWidth = image.width - newLeft;
    }
    if (newTop + newHeight > image.height) {
        newHeight = image.height - newTop;
    }

    if (resizeDir.includes("l") || resizeDir.includes("r")) {
        currentAnnotation.width = newWidth / image.width;
        currentAnnotation.x = (newLeft + newWidth / 2) / image.width;
    }
    if (resizeDir.includes("t") || resizeDir.includes("b")) {
        currentAnnotation.height = newHeight / image.height;
        currentAnnotation.y = (newTop + newHeight / 2) / image.height;
    }

    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);

    drawBoundingBoxes(frameData.annotations);
    updateBoundingBoxList(frameData.annotations);
}

function stopResize() {
    resizing = false;
    window.removeEventListener("mousemove", resizeBoundingBox);
    window.removeEventListener("mouseup", stopResize);
}

/*
==========================================================
ПЕРЕМЕЩЕНИЕ
==========================================================
*/

function startMove(e) {
    // 1. Если кликнули по ручке ресайза — выходим, пусть работает startResize
    if (e.target.classList.contains('resize-handle')) return;
    // 2. Останавливаем всплытие, чтобы не сработал Drag & Drop самой картинки (панорамирование)
    e.stopPropagation();

    isMoving = true;
    const index = parseInt(e.currentTarget.dataset.index); // e.currentTarget - это сам .bounding-box

    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);
    if (!frameData) return;

    currentAnnotation = frameData.annotations[index];

    const image = document.getElementById("frame-image");

    // Запоминаем, где нажали мышкой
    moveStartX = e.clientX;
    moveStartY = e.clientY;

    // Считаем текущую позицию левого верхнего угла в пикселях
    moveStartLeft = (currentAnnotation.x - currentAnnotation.width / 2) * image.width;
    moveStartTop = (currentAnnotation.y - currentAnnotation.height / 2) * image.height;

    // Вешаем глобальные слушатели
    window.addEventListener("mousemove", moveBoundingBox);
    window.addEventListener("mouseup", stopMove);
}

function moveBoundingBox(e) {
    if (!isMoving) return;

    // 1. Получаем текущий масштаб (как мы делали в ресайзе)
    const currentScale = (window.transformState && window.transformState.scale) ? window.transformState.scale : 1;

    const image = document.getElementById("frame-image");

    // 2. Считаем смещение с учетом зума!
    const dx = (e.clientX - moveStartX) / currentScale;
    const dy = (e.clientY - moveStartY) / currentScale;

    // Новые координаты левого верхнего угла
    let newLeft = moveStartLeft + dx;
    let newTop = moveStartTop + dy;

    // Текущие размеры бокса в пикселях (они не меняются при муве)
    const boxWidth = currentAnnotation.width * image.width;
    const boxHeight = currentAnnotation.height * image.height;

    // 3. Проверка границ (Boundary Check)
    // Не даем уйти влево за 0
    if (newLeft < 0) newLeft = 0;
    // Не даем уйти вправо за ширину картинки
    if (newLeft + boxWidth > image.width) newLeft = image.width - boxWidth;

    // Не даем уйти вверх за 0
    if (newTop < 0) newTop = 0;
    // Не даем уйти вниз за высоту картинки
    if (newTop + boxHeight > image.height) newTop = image.height - boxHeight;

    // 4. Обновляем модель данных (переводим пиксели обратно в нормализованные 0..1)
    // x = (left + half_width) / total_width
    currentAnnotation.x = (newLeft + boxWidth / 2) / image.width;
    currentAnnotation.y = (newTop + boxHeight / 2) / image.height;

    // 5. Перерисовываем
    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);

    // Оптимизация: вместо полной перерисовки можно менять style.left/top у e.target,
    // но drawBoundingBoxes надежнее обновляет всё, включая список справа
    drawBoundingBoxes(frameData.annotations);
    updateBoundingBoxList(frameData.annotations);
}

function stopMove() {
    isMoving = false;
    window.removeEventListener("mousemove", moveBoundingBox);
    window.removeEventListener("mouseup", stopMove);
}

/*
==========================================================
КОНТЕКСТНОЕ МЕНЮ
==========================================================
*/
const contextMenu = document.getElementById("context-menu-bb");

function showContextMenu(x, y) {
    contextMenu.style.display = "block";
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
}

function hideContextMenu() {
    contextMenu.style.display = "none";
    contextMenu.targetIndex = null;
}

document.addEventListener("click", hideContextMenu);
document.addEventListener("wheel", hideContextMenu);

document.addEventListener("DOMContentLoaded", function () {

    const addBoundingBoxButton = document.getElementById("add-bounding-box-btn");

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key === 'v')) {
            if (bufferAnnotationsData) {
                const frameIndex = parseInt(document.getElementById("frame-number").textContent);
                const frameData = allFrames.find(f => f.frame_index === frameIndex);

                if (!frameData) return;

                const newAnnotation = JSON.parse(JSON.stringify(bufferAnnotationsData));
                // Немного сдвигаем при вставке, чтобы было видно
                newAnnotation.x += 0.01;
                newAnnotation.y += 0.01;

                frameData.annotations.push(newAnnotation);
                drawBoundingBoxes(frameData.annotations);
                updateBoundingBoxList(frameData.annotations);
            }
        }
    });

    addBoundingBoxButton.addEventListener("click", function () {
        showPromptBox("Введіть клас нового об'єкта:", "", function (result) {
            if (result.confirmed) {
                const label = result.value.trim();
                if (label !== null && label.trim() !== "") {
                    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
                    const frameData = allFrames.find(f => f.frame_index === frameIndex);

                    if (!frameData) return;

                    if (!window.classesAndColors[label.trim()]) {
                        window.classesAndColors[label.trim()] = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
                        displayClassesAndColors(window.classesAndColors);
                    }

                    const newAnnotation = {
                        label: label.trim(),
                        x: 0.5,
                        y: 0.5,
                        width: 0.2,
                        height: 0.2,
                        confidence: 1.0
                    };

                    frameData.annotations.push(newAnnotation);
                    drawBoundingBoxes(frameData.annotations);
                    updateBoundingBoxList(frameData.annotations);
                }
            }
        });
    });


    // ==========================================================
    // ЛОГИКА КОНТЕКСТНОГО МЕНЮ (НОВОЕ)
    // ==========================================================

    // 1. ИЗМЕНИТЬ КЛАСС (Context Menu)
    const ctxChangeBtn = document.getElementById("ctx-bb-change-class");
    if (ctxChangeBtn) {
        ctxChangeBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;

            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);
            const currentAnnotation = frameData.annotations[contextMenuTargetIndex];
            const oldLabel = currentAnnotation.label;

            showPromptBox("Введіть назву нового класа об'єкта:", oldLabel, function (result) {
                if (result.confirmed) {
                    const newLabel = result.value.trim();

                    if (newLabel !== null && newLabel !== "") {
                        // Обновляем метку
                        currentAnnotation.label = newLabel;

                        // Логика цветов (добавить новый)
                        if (!window.classesAndColors[newLabel]) {
                            window.classesAndColors[newLabel] = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
                            displayClassesAndColors(window.classesAndColors);
                        }

                        // Логика цветов (удалить старый, если больше не используется)
                        const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === oldLabel).length;
                        if (labelOccurences === 0) { // Тут было 1, но мы уже изменили метку в памяти, так что теперь их 0
                            delete window.classesAndColors[oldLabel];
                            displayClassesAndColors(window.classesAndColors);
                        }

                        drawBoundingBoxes(frameData.annotations);
                        updateBoundingBoxList(frameData.annotations);
                    }
                }
                hideContextMenu();
            });
        });
    }

    // 2. ДУБЛИРОВАТЬ (Context Menu)
    const ctxDuplicateBtn = document.getElementById("ctx-bb-duplicate");
    if (ctxDuplicateBtn) {
        ctxDuplicateBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;

            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);

            // Глубокое копирование объекта
            const original = frameData.annotations[contextMenuTargetIndex];
            const duplicate = JSON.parse(JSON.stringify(original));

            // Смещаем дубликат, чтобы его было видно
            duplicate.x += 0.02;
            duplicate.y += 0.02;

            frameData.annotations.push(duplicate);
            drawBoundingBoxes(frameData.annotations);
            updateBoundingBoxList(frameData.annotations);
            hideContextMenu();
        });
    }

    // 3. КОПИРОВАТЬ (Context Menu)
    const ctxCopyBtn = document.getElementById("ctx-bb-copy");
    if (ctxCopyBtn) {
        ctxCopyBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;

            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);

            // Копируем в глобальный буфер
            bufferAnnotationsData = frameData.annotations[contextMenuTargetIndex];

            // Активируем кнопку вставки в UI
            pasteBoundingBoxButton.classList.remove("paste-bounding-box-btn-inactive");
            pasteBoundingBoxButton.classList.add("paste-bounding-box-btn-active");

            hideContextMenu();
        });
    }

    // 4. УДАЛИТЬ (Context Menu)
    const ctxDeleteBtn = document.getElementById("ctx-bb-delete");
    if (ctxDeleteBtn) {
        ctxDeleteBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;

            const index = contextMenuTargetIndex; // Сохраняем индекс, так как hideContextMenu обнулит его

            showConfirmBox("Ви дійсно хочете видалити цей об'єкт?", function (confirmed) {
                if (!confirmed) return;

                const frameIndex = parseInt(document.getElementById("frame-number").textContent);
                const frameData = allFrames.find(f => f.frame_index === frameIndex);

                const label = frameData.annotations[index].label;

                // Удаляем бокс из массива
                frameData.annotations.splice(index, 1);

                // Проверяем, нужно ли удалять цвет из легенды
                const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === label).length;
                if (labelOccurences === 0) {
                    delete window.classesAndColors[label];
                    displayClassesAndColors(window.classesAndColors);
                }

                drawBoundingBoxes(frameData.annotations);
                updateBoundingBoxList(frameData.annotations);
            });
            hideContextMenu();
        });
    }
});