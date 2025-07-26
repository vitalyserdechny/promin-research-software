document.addEventListener("DOMContentLoaded", function () {
    const frameImage = document.getElementById("frame-image");
    const frameNumber = document.getElementById("frame-number");
    const loadingPanel = document.getElementById("loading-panel");
    const nextButton = document.getElementById("next-page");
    const prevButton = document.getElementById("prev-page");
    const pagesCounterSpan = document.getElementById("pages-counter");
    const saveProjectButton = document.getElementById("save-project-btn");
    const addBoundingBoxButton = document.getElementById("add-bounding-box-btn");
    const pasteBoundingBoxButton = document.getElementById("paste-bounding-box-btn");
    const closeProjectButton = document.getElementById("close-project-btn");
    const unsavedDataMsg = document.getElementById('unsaved-data-warning-msg')

    const compareFramesPanel = document.getElementById('compare-frames-panel');
    const closeCompareFramesPanelBtn = document.getElementById('close-compare-frames-panel-btn');

    const compareFrameWithModelsBtn = document.getElementById('compare-frame-with-models');
    const selectAllModelsCheckbox = document.getElementById('select_all_models');

    const cudaStatusBtn = document.getElementById('cuda_status_btn');

    const MAX_FRAMES_PER_PAGE = 50
    let allFrames = []
    let classesAndColors = null
    let currentPage = 1

    let annotationsDataChanged = false;

    let resizing = false;
    let currentAnnotation, startX, startY, startWidth, startHeight, startLeft, startTop, resizeDir;

    let bufferAnnotationsData = null;

    window.currentFrameIndex = 0

    cudaStatusBtn.addEventListener('click', function () {
        fetch(`/check-cuda`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    message = "CUDA status: " + data.cuda_available
                    message += "\nDevices: " + data.cuda_devices
                    alert(message)
                }
                else {
                    alert('CUDA status checking error!')
                }
            })
    })

    selectAllModelsCheckbox.addEventListener('click', function () {
        const modelCheckboxes = document.querySelectorAll('#model-selection input[name="model"]');
        modelCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllModelsCheckbox.checked;
        });
    })

    compareFrameWithModelsBtn.addEventListener('click', function () {
        // TODO
        // Получаем аннотации с сервера
        fetch(`/get-frame-annotations?frame_index=${currentFrameIndex}`)
            .then(response => response.json())
            .then(data => {
                // Создаем контейнер для всех вариантов
                const container = document.createElement('div');
                container.className = 'frame-comparison-container';
                container.id = 'frame-comparison-container';
                container.style.display = 'grid';
                container.style.gridTemplateColumns = 'repeat(2, 1fr)';
                container.style.gap = '3px';
                container.style.marginTop = '0'; // Убираем отступ сверху

                // Получаем список всех доступных моделей (ground truth + модели из analysis)
                const allModels = ['ground_truth', ...Object.keys(data.models)];

                // Создаем 4 варианта отображения
                for (let i = 0; i < 4; i++) {
                    const comparisonItem = document.createElement('div');
                    comparisonItem.className = 'comparison-item';

                    // Создаем выпадающий список для выбора модели
                    const select = document.createElement('select');
                    select.className = 'model-selector';
                    select.dataset.itemIndex = i;

                    // Заполняем опциями
                    allModels.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model;
                        option.textContent = model === 'ground_truth' ? 'Ground Truth' : model;
                        select.appendChild(option);
                    });

                    // Выбираем ground truth для первого элемента, остальные - модели
                    select.value = i === 0 ? 'ground_truth' : allModels[1] || 'ground_truth';

                    // Контейнер для изображения с аннотациями
                    const canvasContainer = document.createElement('div');
                    canvasContainer.className = 'canvas-container';
                    canvasContainer.style.position = 'relative';

                    const canvas = document.createElement('canvas');
                    canvas.className = 'annotation-canvas';
                    canvas.width = 620; // Настроить под ваши размеры
                    canvas.height = 320;

                    canvasContainer.appendChild(canvas);

                    comparisonItem.appendChild(select);
                    comparisonItem.appendChild(canvasContainer);
                    container.appendChild(comparisonItem);

                    // Отрисовываем начальные аннотации
                    drawAnnotations(canvas, currentFrameIndex, select.value, data);

                    // Обработчик изменения выбора модели
                    select.addEventListener('change', function () {
                        drawAnnotations(canvas, currentFrameIndex, this.value, data);
                    });
                }

                compareFramesPanel.appendChild(container);
                compareFramesPanel.classList.add('active');
            })
            .catch(error => {
                console.error('Error fetching annotations:', error);
                resultsDiv.innerHTML = '<p>Error loading annotations</p>';
            });


    })

    // Функция для отрисовки аннотаций на canvas
    function drawAnnotations(canvas, frameIndex, modelName, annotationsData) {
        const ctx = canvas.getContext('2d');

        // Очищаем canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Загружаем изображение кадра
        const img = new Image();
        img.src = allFrames[frameIndex].url;

        img.onload = function () {
            // Рисуем изображение
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Получаем аннотации для выбранной модели
            const annotations = modelName === 'ground_truth'
                ? annotationsData.ground_truth
                : annotationsData.models[modelName] || [];

            // Рисуем аннотации
            annotations.forEach(ann => {
                // Рассчитываем координаты в пикселях
                const x = ann.x * canvas.width;
                const y = ann.y * canvas.height;
                const width = ann.width * canvas.width;
                const height = ann.height * canvas.height;

                // Настройки стиля
                ctx.strokeStyle = modelName === 'ground_truth' ? '#00FF00' : '#FF0000';
                ctx.lineWidth = 2;
                ctx.font = '12px Arial';
                ctx.fillStyle = modelName === 'ground_truth' ? '#00FF00' : '#FF0000';

                // Рисуем bounding box
                ctx.strokeRect(x - width / 2, y - height / 2, width, height);

                // Подписываем класс и confidence
                const labelText = `${ann.label} ${ann.confidence.toFixed(2)}`;
                ctx.fillText(labelText, x - width / 2 + 5, y - height / 2 + 15);
            });
        };
    }

    closeCompareFramesPanelBtn.addEventListener('click', function () {
        const container = compareFramesPanel.querySelector('#frame-comparison-container');
        if (container) {
            container.remove();
        }
        compareFramesPanel.classList.remove('active'); // Скрываем панель
    });
    closeProjectButton.addEventListener("click", function () {
        if (annotationsDataChanged) {
            if (confirm("Are you sure you want to close the project without saving changes?")) {
                window.location.href = "/close-project";
            }
        }
        else {
            window.location.href = "/close-project";
        }
    });

    saveProjectButton.addEventListener("click", function () {
        let successfully = true;

        const dataToSend = allFrames.map(frame => ({
            frame_index: frame.frame_index,
            annotations: frame.annotations
        }));

        fetch("/save-annotations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dataToSend)
        })
            .then(response => {
                if (response.ok) {
                    console.log("Annotations saved successfully!");
                } else {
                    console.error("Error saving annotations");
                    successfully = false;
                }
            })
            .catch(error => console.error("Error saving annotations:", error));

        fetch("/save-project-data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                classes_and_colors: classesAndColors,
                last_frame_index: currentFrameIndex,
                page_number: currentPage
            })
        })
            .then(response => {
                if (response.ok) {
                    console.log("Project data saved successfully!");
                } else {
                    console.error("Error saving project data");
                    successfully = false;
                }
            })
            .catch(error => console.error("Error saving project data:", error));

        if (successfully) {
            alert("The project has been successfully saved!");
            annotationsDataChanged = false;
            unsavedDataMsg.style.opacity = 0
        }
        else {
            alert("An error occurred while saving. Please try again.");
        }
    });

    pasteBoundingBoxButton.addEventListener("click", function () {
        if (bufferAnnotationsData) {
            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);

            if (!frameData) return;

            const newAnnotation = JSON.parse(JSON.stringify(bufferAnnotationsData));
            frameData.annotations.push(newAnnotation);
            drawBoundingBoxes(frameData.annotations);
            updateBoundingBoxList(frameData.annotations);

            if (!annotationsDataChanged) {
                annotationsDataChanged = true;
                unsavedDataMsg.style.opacity = 1
            }
        }
    });

    addBoundingBoxButton.addEventListener("click", function () {
        const label = prompt("Enter the class name:");

        if (label !== null && label.trim() !== "") {
            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);

            if (!frameData) return;

            if (!classesAndColors[label.trim()]) {
                classesAndColors[label.trim()] = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
                displayClassesAndColors(classesAndColors);
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

            if (!annotationsDataChanged) {
                annotationsDataChanged = true;
                unsavedDataMsg.style.opacity = 1
            }
        }
    });

    nextButton.addEventListener("click", function () {
        if (currentPage < Math.ceil(allFrames.length / MAX_FRAMES_PER_PAGE)) {
            currentPage++;
            renderFramesPage(currentPage);
        }
    });

    prevButton.addEventListener("click", function () {
        if (currentPage > 1) {
            currentPage--;
            renderFramesPage(currentPage);
        }
    });

    function displayClassesAndColors(classesColors) {
        const classesList = document.getElementById('classes-and-colors-list');
        classesList.innerHTML = '';

        let mousedownHandler = function (event) {
            const colorPickerContainer = document.getElementById('color-picker-container');
            if (colorPickerContainer.style.display === 'block') {
                if (!isDescendant(colorPickerContainer, event.target)) {
                    colorPickerContainer.style.display = 'none';
                    document.removeEventListener('mousedown', mousedownHandler);
                }
            }
        };

        for (const className in classesColors) {
            if (classesColors.hasOwnProperty(className)) {
                const color = classesColors[className];
                const colorString = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

                const classCard = document.createElement('div');
                classCard.classList.add('class-card');
                classCard.innerHTML = `
                    <div class="color-preview" style="background-color: ${colorString};"></div>
                    <span class="class-name">${className}</span>
                `;

                classesList.appendChild(classCard);

                const colorPreview = classCard.querySelector('.color-preview');
                colorPreview.addEventListener('click', function () {
                    const colorPickerContainer = document.getElementById('color-picker-container');
                    colorPickerContainer.style.display = 'block';

                    const rect = colorPreview.getBoundingClientRect();
                    colorPickerContainer.style.left = `${rect.right + 5}px`;
                    colorPickerContainer.style.top = `${rect.top}px`;

                    colorPickerContainer.innerHTML = '';

                    const colorPicker = new iro.ColorPicker('#color-picker-container', {
                        width: 200,
                        color: colorString
                    });

                    // Удаляем обработчик, чтобы не закрывало при первом клике
                    document.removeEventListener('mousedown', mousedownHandler);

                    colorPicker.on('color:change', function (iroColor) {
                        const newColorRgb = iroColor.rgb;
                        classesColors[className] = [newColorRgb.r, newColorRgb.g, newColorRgb.b];
                        colorPreview.style.backgroundColor = `rgb(${newColorRgb.r}, ${newColorRgb.g}, ${newColorRgb.b})`;

                        drawBoundingBoxes(allFrames.find(f => f.frame_index === currentFrameIndex).annotations);
                        annotationsDataChanged = true;
                        unsavedDataMsg.style.opacity = 1
                    });

                    colorPicker.on('input:end', function () {
                        // Восстанавливаем обработчик только после завершения выбора цвета
                        document.addEventListener('mousedown', mousedownHandler);
                    });
                });
            }
        }
    }

    function isDescendant(parent, child) {
        let node = child.parentNode;
        while (node != null) {
            if (node == parent) {
                return true;
            }
            node = node.parentNode;
        }
        return false;
    }

    function renderFramesPage(page, frame = 0) {
        const start = (page - 1) * MAX_FRAMES_PER_PAGE;
        const end = start + MAX_FRAMES_PER_PAGE;
        const frames = allFrames.slice(start, end);
        const frameList = document.querySelector(".frames-list");

        frameList.classList.add("hidden");
        setTimeout(() => {
            pagesCounterSpan.textContent = `${page} / ${Math.ceil(allFrames.length / MAX_FRAMES_PER_PAGE)}`;
            frameList.innerHTML = "";

            frames.forEach((frameData) => {
                let img = document.createElement("img");
                img.src = frameData.url;
                img.alt = `Frame ${frameData.frame_index}`;
                img.dataset.index = frameData.frame_index;
                img.dataset.annotations = JSON.stringify(frameData.annotations);

                img.addEventListener("click", function () {
                    frameImage.src = frameData.url;
                    frameNumber.textContent = frameData.frame_index;

                    currentFrameIndex = frameData.frame_index;

                    document.querySelectorAll(".frames-list img").forEach(img => img.classList.remove("active"));
                    img.classList.add("active");

                    drawBoundingBoxes(frameData.annotations);  // Вызываем функцию с аннотациями
                    updateBoundingBoxList(frameData.annotations);
                });

                frameList.appendChild(img);
            });

            // Отображаем первый фрейм и его аннотации
            if (frames.length > 0) {
                frameImage.src = frames[frame].url;
                frameNumber.textContent = start;
                drawBoundingBoxes(frames[frame].annotations);
                updateBoundingBoxList(frames[frame].annotations);
                frameList.children[frame].classList.add("active");
            }

            frameList.classList.remove("hidden");
            frameList.scrollLeft = 0;
        }, 300);
    }

    function drawBoundingBoxes(annotations) {
        const boxesContainer = document.getElementById("bounding-boxes");
        boxesContainer.innerHTML = "";  // Очищаем контейнер для новых рамок

        const image = document.getElementById("frame-image");
        const imageWidth = image.width;
        const imageHeight = image.height;

        annotations.forEach((ann, index) => {
            let box = document.createElement("div");
            box.className = "bounding-box";
            box.dataset.index = index;

            console.log(box)

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
            if (classesAndColors && classesAndColors[ann.label]) {
                color = classesAndColors[ann.label];
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

        // Ограничение по границам изображения
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

        // Обновляем только те параметры, которые изменились
        if (resizeDir.includes("l") || resizeDir.includes("r")) {
            currentAnnotation.width = newWidth / image.width;
            currentAnnotation.x = (newLeft + newWidth / 2) / image.width;
        }
        if (resizeDir.includes("t") || resizeDir.includes("b")) {
            currentAnnotation.height = newHeight / image.height;
            currentAnnotation.y = (newTop + newHeight / 2) / image.height;
        }

        if (!annotationsDataChanged) {
            annotationsDataChanged = true;
            unsavedDataMsg.style.opacity = 1
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

    function updateBoundingBoxList(annotations) {
        const listContainer = document.getElementById("bounding-boxes-values");
        listContainer.innerHTML = "";  // Очищаем список

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

                if (confirm("Do you really want to delete this bounding box?", "Delete confirmation")) {

                    // Если в кадрах такой класс больше не встречается, удалить его из classesAndColors
                    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
                    const frameData = allFrames.find(f => f.frame_index === frameIndex);
                    const label = frameData.annotations[index].label;
                    const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === label).length;

                    if (labelOccurences === 1) {
                        delete classesAndColors[label];
                        displayClassesAndColors(classesAndColors);
                    }

                    annotations.splice(index, 1);
                    drawBoundingBoxes(annotations);
                    updateBoundingBoxList(annotations);

                    if (!annotationsDataChanged) {
                        annotationsDataChanged = true;
                        unsavedDataMsg.style.opacity = 1
                    }
                }
            })
        });

        document.querySelectorAll(".edit-label").forEach(btn => {
            btn.addEventListener("click", function () {
                const index = parseInt(btn.dataset.index);
                const newLabel = prompt("Enter a new class for this bounding box:", annotations[index].label);
                const oldLabel = annotations[index].label;

                if (newLabel !== null && newLabel.trim() !== "") {
                    annotations[index].label = newLabel.trim();  // Обновляем класс аннотации
                    drawBoundingBoxes(annotations);  // Перерисовываем рамки
                    updateBoundingBoxList(annotations);  // Обновляем список аннотаций

                    // Если после изменения у нас появился новый класс, которого раньше не было, добавить его в classesAndColors
                    if (!classesAndColors[newLabel]) {
                        classesAndColors[newLabel] = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
                        displayClassesAndColors(classesAndColors);
                    }

                    // Если в кадрах такой класс больше не встречается, удалить его из classesAndColors
                    const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === oldLabel).length;

                    if (labelOccurences === 1) {
                        delete classesAndColors[oldLabel];
                        displayClassesAndColors(classesAndColors);
                    }

                    if (!annotationsDataChanged) {
                        annotationsDataChanged = true;
                        unsavedDataMsg.style.opacity = 1
                    }
                }
            });
        });
    }

    fetch('/get-classes-colors')
        .then(response => response.json())
        .then(classesColors => {
            // Сохраняем classesColors в глобальной переменной или в состоянии компонента
            classesAndColors = classesColors;
            displayClassesAndColors(classesColors);

            fetch("/get-frames")
                .then(response => response.json())
                .then(frames => {
                    frames.forEach((frameData) => {
                        allFrames.push(frameData);
                    });

                    allFrames.sort((a, b) => a.frame_index - b.frame_index);
                    loadingPanel.classList.add("hidden");
                    renderFramesPage(currentPage)

                })
                .catch(error => console.error("Error loading frames:", error));
        });

    fetch('/get-last-frame-and-page-number')
        .then(response => response.json())
        .then(data => {
            currentFrameIndex = data.last_frame_index;
            currentPage = data.page_number;
            renderFramesPage(currentPage, currentFrameIndex);
        })
        .catch(error => console.error("Error loading last frame index and page number:", error));
});