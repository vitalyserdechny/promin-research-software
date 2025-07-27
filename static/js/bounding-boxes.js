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

let bufferAnnotationsData = null;

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
    const pasteBoundingBoxButton = document.getElementById("paste-bounding-box-btn");

    listContainer.innerHTML = "";

    annotations.forEach((ann, index) => {
        let item = document.createElement("div");
        item.className = "bounding-box-item";
        item.innerHTML = `
        <strong>Bounding Box #${index + 1}</strong>
        <span><strong>Label:</strong> ${ann.label}</span>
        <span><strong>Position:</strong> x: ${ann.x.toFixed(4)}, y: ${ann.y.toFixed(4)}</span>
        <span><strong>Size:</strong> w: ${ann.width.toFixed(4)}, h: ${ann.height.toFixed(4)}</span>
        <span><strong>Confidence:</strong> ${ann.confidence.toFixed(4)}</span>
        <div class="box-actions">
            <button class="edit-label" data-index="${index}">Change label ✏️</button>
            <button class="delete-box" data-index="${index}">Delete 🗑️</button>
            <button class="copy-box" data-index="${index}">Copy 📋</button>
        </div>
    `;

        item.addEventListener("mouseenter", function () {
            drawBoundingBoxes([annotations[index]]);
        });

        item.addEventListener("mouseleave", function () {
            drawBoundingBoxes(annotations);
        });

        listContainer.appendChild(item);
    });

    document.querySelectorAll(".copy-box").forEach(btn => {
        btn.addEventListener("click", function () {
            if (!bufferAnnotationsData) {
                pasteBoundingBoxButton.classList.remove("paste-bounding-box-btn-inactive");
                pasteBoundingBoxButton.classList.add("paste-bounding-box-btn-active");
            }
            const index = parseInt(btn.dataset.index);
            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);

            if (!frameData) return;

            bufferAnnotationsData = frameData.annotations[index];
        });
    });

    document.querySelectorAll(".delete-box").forEach(btn => {
        btn.addEventListener("click", function () {
            const index = parseInt(btn.dataset.index);

            showConfirmBox("Do you really want to delete this bounding box?", function (confirmed) {
                if (!confirmed) return;

                // Если в кадрах такой класс больше не встречается, удалить его из classesAndColors
                const frameIndex = parseInt(document.getElementById("frame-number").textContent);
                const frameData = allFrames.find(f => f.frame_index === frameIndex);
                const label = frameData.annotations[index].label;
                const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === label).length;

                if (labelOccurences === 1) {
                    delete window.classesAndColors[label];
                    displayClassesAndColors(window.classesAndColors);
                }

                annotations.splice(index, 1);
                drawBoundingBoxes(annotations);
                updateBoundingBoxList(annotations);
            });
        })
    });

    document.querySelectorAll(".edit-label").forEach(btn => {
        btn.addEventListener("click", function () {
            const index = parseInt(btn.dataset.index);
            showPromptBox("Enter a new class for this bounding box:", annotations[index].label, function (result) {
                if (result.confirmed) {
                    const newLabel = result.value.trim();
                    const oldLabel = annotations[index].label;

                    if (newLabel !== null && newLabel.trim() !== "") {
                        annotations[index].label = newLabel.trim();
                        drawBoundingBoxes(annotations);
                        updateBoundingBoxList(annotations);

                        // Если после изменения у нас появился новый класс, которого раньше не было, добавить его в classesAndColors
                        if (!window.classesAndColors[newLabel]) {
                            window.classesAndColors[newLabel] = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
                            displayClassesAndColors(window.classesAndColors);
                        }

                        // Если в кадрах такой класс больше не встречается, удалить его из classesAndColors
                        const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === oldLabel).length;

                        if (labelOccurences === 1) {
                            delete window.classesAndColors[oldLabel];
                            displayClassesAndColors(window.classesAndColors);
                        }
                    }
                }
            });
        });
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

    const image = document.getElementById("frame-image");
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

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


document.addEventListener("DOMContentLoaded", function () {

    const addBoundingBoxButton = document.getElementById("add-bounding-box-btn");
    const pasteBoundingBoxButton = document.getElementById("paste-bounding-box-btn");

    pasteBoundingBoxButton.addEventListener("click", function () {
        if (bufferAnnotationsData) {
            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);

            if (!frameData) return;

            const newAnnotation = JSON.parse(JSON.stringify(bufferAnnotationsData));
            frameData.annotations.push(newAnnotation);
            drawBoundingBoxes(frameData.annotations);
            updateBoundingBoxList(frameData.annotations);
        }
    });

    addBoundingBoxButton.addEventListener("click", function () {
        showPromptBox("Enter the class name for the new bounding box:", "", function (result) {
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
});