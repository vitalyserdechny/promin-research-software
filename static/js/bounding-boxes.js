/**
 * Module for displaying and managing bounding boxes.
 * * Features:
 * - Render boxes on the image
 * - Update the sidebar list (UI)
 * - Resize handles logic
 * - Drag and drop logic
 * - Context menu (Right click)
 * - Clipboard operations (Copy/Paste)
 * * Refactored for PROMIN (English + New UI)
 */

let resizing = false;
let currentAnnotation, startX, startY, startWidth, startHeight, startLeft, startTop, resizeDir;

let isMoving = false;
let moveStartX, moveStartY;
let moveStartLeft, moveStartTop;

let bufferAnnotationsData = null;
let contextMenuTargetIndex = null;

// ==========================================================
// RENDER ON CANVAS (IMAGE)
// ==========================================================

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

        // Расчет координат
        const boxLeft = (ann.x - ann.width / 2) * imageWidth;
        const boxTop = (ann.y - ann.height / 2) * imageHeight;
        const boxWidth = ann.width * imageWidth;
        const boxHeight = ann.height * imageHeight;
        
        let color = [255, 94, 87];

        box.style.position = "absolute";
        box.style.left = `${boxLeft}px`;
        box.style.top = `${boxTop}px`;
        box.style.width = `${boxWidth}px`;
        box.style.height = `${boxHeight}px`;
        box.style.cursor = "move";

        if (window.classesAndColors && window.classesAndColors[ann.label]) {
            color = window.classesAndColors[ann.label];
        }

        box.style.borderColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        box.style.backgroundColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.2)`;

        let labelSpan = document.createElement("span");
        labelSpan.className = "label";
        const percent = ann.confidence ? Math.round(ann.confidence * 100) : 100;
        labelSpan.innerText = `${ann.label} ${percent}%`;
        labelSpan.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        
        box.appendChild(labelSpan);
        // ----------------------------------------

        box.addEventListener("mousedown", startMove);
        box.addEventListener("contextmenu", function (e) {
            e.preventDefault();
            e.stopPropagation();
            contextMenuTargetIndex = index;
            showContextMenu(e.clientX, e.clientY);
        });

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

        box.addEventListener("mouseenter", function () {
            box.querySelectorAll(".resize-handle").forEach(h => h.classList.remove("hidden-handle"));
            box.style.zIndex = 50; 
        });

        box.addEventListener("mouseleave", function () {
            box.querySelectorAll(".resize-handle").forEach(h => h.classList.add("hidden-handle"));
            box.style.zIndex = "";
        });

        boxesContainer.appendChild(box);
    });
}

// ==========================================================
// RENDER SIDEBAR LIST (UI) - UPDATED STRUCTURE
// ==========================================================

function updateBoundingBoxList(annotations) {
    const listContainer = document.getElementById("bounding-boxes-values");
    listContainer.innerHTML = "";

    annotations.forEach((ann, index) => {
        let item = document.createElement("div");
        item.className = "bounding-box-item";
        
        if (window.classesAndColors && window.classesAndColors[ann.label]) {
            const c = window.classesAndColors[ann.label];
            item.style.borderLeftColor = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        } else {
            item.style.borderLeftColor = '#ffaad4';
        }

        // Логика "Светофора" для процентов
        const confVal = ann.confidence || 1.0;
        const confPercent = Math.round(confVal * 100);
        
        let confClass = 'low'; // Красный по дефолту (< 40)
        if (confPercent >= 70) {
            confClass = 'high'; // Зеленый
        } else if (confPercent >= 40) {
            confClass = 'mid';  // Желтый
        }

        item.innerHTML = `
            <div class="bb-header">
                <div class="bb-header-left">
                    <span class="bb-class-name">${ann.label}</span>
                    <span class="bb-conf ${confClass}" title="Confidence: ${confVal.toFixed(4)}">${confPercent}%</span>
                </div>
                <button class="bb-delete-btn" title="Delete">×</button>
            </div>
            <div class="bb-stats-grid">
                <div class="bb-stat">
                    <span class="bb-key">X</span>
                    <span class="bb-val">${ann.x.toFixed(3)}</span>
                </div>
                <div class="bb-stat">
                    <span class="bb-key">Y</span>
                    <span class="bb-val">${ann.y.toFixed(3)}</span>
                </div>
                <div class="bb-stat">
                    <span class="bb-key">W</span>
                    <span class="bb-val">${ann.width.toFixed(3)}</span>
                </div>
                <div class="bb-stat">
                    <span class="bb-key">H</span>
                    <span class="bb-val">${ann.height.toFixed(3)}</span>
                </div>
            </div>
        `;

        item.addEventListener("mouseenter", function () {
            const boxOnImage = document.querySelector(`.bounding-box[data-index="${index}"]`);
            if (boxOnImage) {
                boxOnImage.style.borderWidth = "3px";
                boxOnImage.style.zIndex = "100";
                boxOnImage.style.boxShadow = "0 0 15px rgba(255,255,255,0.9)";
            }
        });

        item.addEventListener("mouseleave", function () {
            drawBoundingBoxes(annotations);
        });

        const deleteBtn = item.querySelector('.bb-delete-btn');
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation(); 
            deleteObjectByIndex(index);
        });

        listContainer.appendChild(item);
    });
}

/**
 * Helper to delete object by index (used by list button and context menu)
 */
function deleteObjectByIndex(index) {
    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);
    
    if(!frameData) return;

    showConfirmBox("Are you sure you want to delete this object?", function (confirmed) {
        if (!confirmed) return;

        const label = frameData.annotations[index].label;

        // Remove
        frameData.annotations.splice(index, 1);

        // Check if color legend needs update
        const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === label).length;
        if (labelOccurences === 0) {
            delete window.classesAndColors[label];
            displayClassesAndColors(window.classesAndColors);
        }

        drawBoundingBoxes(frameData.annotations);
        updateBoundingBoxList(frameData.annotations);
    });
}

// ==========================================================
// RESIZE LOGIC
// ==========================================================

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

    if (resizeDir.includes("l")) { // Left
        newWidth = Math.max(5, startWidth - dx); // min 5px
        newLeft = startLeft + dx;
    }
    if (resizeDir.includes("r")) { // Right
        newWidth = Math.max(5, startWidth + dx);
    }
    if (resizeDir.includes("t")) { // Top
        newHeight = Math.max(5, startHeight - dy);
        newTop = startTop + dy;
    }
    if (resizeDir.includes("b")) { // Bottom
        newHeight = Math.max(5, startHeight + dy);
    }

    // Boundaries check
    if (newLeft < 0) { newWidth += newLeft; newLeft = 0; }
    if (newTop < 0) { newHeight += newTop; newTop = 0; }
    if (newLeft + newWidth > image.width) newWidth = image.width - newLeft;
    if (newTop + newHeight > image.height) newHeight = image.height - newTop;

    // Apply changes based on center point (YOLO format)
    if (resizeDir.includes("l") || resizeDir.includes("r")) {
        currentAnnotation.width = newWidth / image.width;
        currentAnnotation.x = (newLeft + newWidth / 2) / image.width;
    }
    if (resizeDir.includes("t") || resizeDir.includes("b")) {
        currentAnnotation.height = newHeight / image.height;
        currentAnnotation.y = (newTop + newHeight / 2) / image.height;
    }

    // Live update
    const boxEl = document.querySelector(`.bounding-box[data-index="${allFrames.find(f => f.frame_index === parseInt(document.getElementById("frame-number").textContent)).annotations.indexOf(currentAnnotation)}"]`);
    if(boxEl) {
        // Optimization: Update CSS directly instead of full redraw for performance
        boxEl.style.left = newLeft + 'px';
        boxEl.style.top = newTop + 'px';
        boxEl.style.width = newWidth + 'px';
        boxEl.style.height = newHeight + 'px';
    }
}

function stopResize() {
    resizing = false;
    window.removeEventListener("mousemove", resizeBoundingBox);
    window.removeEventListener("mouseup", stopResize);
    // Full redraw to update list values
    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);
    drawBoundingBoxes(frameData.annotations);
    updateBoundingBoxList(frameData.annotations);
}

// ==========================================================
// MOVE LOGIC
// ==========================================================

function startMove(e) {
    if (e.target.classList.contains('resize-handle')) return;
    e.stopPropagation();

    isMoving = true;
    const index = parseInt(e.currentTarget.dataset.index);

    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);
    if (!frameData) return;

    currentAnnotation = frameData.annotations[index];
    const image = document.getElementById("frame-image");

    moveStartX = e.clientX;
    moveStartY = e.clientY;

    moveStartLeft = (currentAnnotation.x - currentAnnotation.width / 2) * image.width;
    moveStartTop = (currentAnnotation.y - currentAnnotation.height / 2) * image.height;

    window.addEventListener("mousemove", moveBoundingBox);
    window.addEventListener("mouseup", stopMove);
}

function moveBoundingBox(e) {
    if (!isMoving) return;

    const currentScale = (window.transformState && window.transformState.scale) ? window.transformState.scale : 1;
    const image = document.getElementById("frame-image");

    const dx = (e.clientX - moveStartX) / currentScale;
    const dy = (e.clientY - moveStartY) / currentScale;

    let newLeft = moveStartLeft + dx;
    let newTop = moveStartTop + dy;

    const boxWidth = currentAnnotation.width * image.width;
    const boxHeight = currentAnnotation.height * image.height;

    // Boundaries
    if (newLeft < 0) newLeft = 0;
    if (newLeft + boxWidth > image.width) newLeft = image.width - boxWidth;
    if (newTop < 0) newTop = 0;
    if (newTop + boxHeight > image.height) newTop = image.height - boxHeight;

    currentAnnotation.x = (newLeft + boxWidth / 2) / image.width;
    currentAnnotation.y = (newTop + boxHeight / 2) / image.height;

    // Optimization: Update style directly
    const boxEl = document.querySelector(`.bounding-box[data-index="${allFrames.find(f => f.frame_index === parseInt(document.getElementById("frame-number").textContent)).annotations.indexOf(currentAnnotation)}"]`);
    if(boxEl) {
        boxEl.style.left = newLeft + 'px';
        boxEl.style.top = newTop + 'px';
    }
}

function stopMove() {
    isMoving = false;
    window.removeEventListener("mousemove", moveBoundingBox);
    window.removeEventListener("mouseup", stopMove);
    
    // Update list values on stop
    const frameIndex = parseInt(document.getElementById("frame-number").textContent);
    const frameData = allFrames.find(f => f.frame_index === frameIndex);
    updateBoundingBoxList(frameData.annotations);
}

// ==========================================================
// CONTEXT MENU
// ==========================================================
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

// ==========================================================
// INITIALIZATION & EVENTS
// ==========================================================
document.addEventListener("DOMContentLoaded", function () {

    const addBoundingBoxButton = document.getElementById("add-bounding-box-btn");

    // Shortcut: Ctrl+V to Paste
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyV' || e.key === 'v')) {
            if (bufferAnnotationsData) {
                const frameIndex = parseInt(document.getElementById("frame-number").textContent);
                const frameData = allFrames.find(f => f.frame_index === frameIndex);

                if (!frameData) return;

                const newAnnotation = JSON.parse(JSON.stringify(bufferAnnotationsData));
                newAnnotation.x += 0.01; // Offset slightly
                newAnnotation.y += 0.01;

                frameData.annotations.push(newAnnotation);
                drawBoundingBoxes(frameData.annotations);
                updateBoundingBoxList(frameData.annotations);
            }
        }
    });

    // Add New Object Button
    addBoundingBoxButton.addEventListener("click", function () {
        showPromptBox("Enter class for new object:", "", function (result) {
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
                        x: 0.5, y: 0.5, width: 0.2, height: 0.2, confidence: 1.0
                    };

                    frameData.annotations.push(newAnnotation);
                    drawBoundingBoxes(frameData.annotations);
                    updateBoundingBoxList(frameData.annotations);
                }
            }
        });
    });


    // --- Context Menu Handlers ---

    // 1. EDIT CLASS
    const ctxChangeBtn = document.getElementById("ctx-bb-change-class");
    if (ctxChangeBtn) {
        ctxChangeBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;

            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);
            const currentAnnotation = frameData.annotations[contextMenuTargetIndex];
            const oldLabel = currentAnnotation.label;

            showPromptBox("Enter new class name:", oldLabel, function (result) {
                if (result.confirmed) {
                    const newLabel = result.value.trim();
                    if (newLabel !== null && newLabel !== "") {
                        currentAnnotation.label = newLabel;

                        if (!window.classesAndColors[newLabel]) {
                            window.classesAndColors[newLabel] = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
                            displayClassesAndColors(window.classesAndColors);
                        }
                        
                        // Cleanup old color if unused
                        const labelOccurences = allFrames.map(f => f.annotations).flat().filter(a => a.label === oldLabel).length;
                        if (labelOccurences === 0) {
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

    // 2. DUPLICATE
    const ctxDuplicateBtn = document.getElementById("ctx-bb-duplicate");
    if (ctxDuplicateBtn) {
        ctxDuplicateBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;

            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);

            const original = frameData.annotations[contextMenuTargetIndex];
            const duplicate = JSON.parse(JSON.stringify(original));
            duplicate.x += 0.02;
            duplicate.y += 0.02;

            frameData.annotations.push(duplicate);
            drawBoundingBoxes(frameData.annotations);
            updateBoundingBoxList(frameData.annotations);
            hideContextMenu();
        });
    }

    // 3. COPY
    const ctxCopyBtn = document.getElementById("ctx-bb-copy");
    if (ctxCopyBtn) {
        ctxCopyBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;
            const frameIndex = parseInt(document.getElementById("frame-number").textContent);
            const frameData = allFrames.find(f => f.frame_index === frameIndex);
            bufferAnnotationsData = frameData.annotations[contextMenuTargetIndex];
            hideContextMenu();
        });
    }

    // 4. DELETE (Context Menu)
    const ctxDeleteBtn = document.getElementById("ctx-bb-delete");
    if (ctxDeleteBtn) {
        ctxDeleteBtn.addEventListener("click", function () {
            if (contextMenuTargetIndex === null) return;
            deleteObjectByIndex(contextMenuTargetIndex);
            hideContextMenu();
        });
    }
});