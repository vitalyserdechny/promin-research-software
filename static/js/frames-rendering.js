/**
 * Модуль для отображения и управления кадрами 🖼️
 * 
 * Функции:
 * 🌍 Загрузка последнего кадра и номера страницы при загрузке страницы.
 * 👀 Отображение списка кадров с возможностью навигации по страницам.
 * 🖱️ Обработка кликов по кадрам для отображения выбранного кадра и его аннотаций.
 * 
 * 
 * Автор: Сердечный Виталий ♥️
 */

function showFrame(frameData) {
    const frameImage = document.getElementById("frame-image");
    const frameNumber = document.getElementById("frame-number");

    frameImage.onload = () => {
        drawBoundingBoxes(frameData.annotations);
        updateBoundingBoxList(frameData.annotations);
    };
    frameImage.src = '';
    frameImage.src = frameData.url;
    frameNumber.textContent = frameData.frame_index;
    window.currentFrameIndex = frameData.frame_index;
}

function markActiveImage(imgElement) {
    document.querySelectorAll(".frames-list img").forEach(img => img.classList.remove("active"));
    imgElement.classList.add("active");
}

function renderFramesPage(page, selectedFrameIndex = null) {
    const pagesCounterSpan = document.getElementById("pages-counter");

    const start = (page - 1) * MAX_FRAMES_PER_PAGE;
    const end = start + MAX_FRAMES_PER_PAGE;
    const frames = window.allFrames.slice(start, end);

    const frameList = document.querySelector(".frames-list");
    if (!frameList) return;

    frameList.classList.add("hidden");

    pagesCounterSpan.textContent = `${page} / ${Math.ceil(window.allFrames.length / MAX_FRAMES_PER_PAGE)}`;
    frameList.innerHTML = "";

    frames.forEach((frameData) => {
        let img = document.createElement("img");
        img.src = frameData.url;
        img.alt = `Frame ${frameData.frame_index}`;
        img.dataset.index = frameData.frame_index;
        img.dataset.annotations = JSON.stringify(frameData.annotations);

        img.addEventListener("click", function () {
            showFrame(frameData);
            markActiveImage(img);
        });

        frameList.appendChild(img);
    });

    const defaultFrameData = selectedFrameIndex !== null
        ? frames.find(f => f.frame_index === selectedFrameIndex)
        : frames[0];

    if (defaultFrameData) {
        showFrame(defaultFrameData);
        const selectedImg = Array.from(frameList.children).find(img =>
            parseInt(img.dataset.index) === defaultFrameData.frame_index
        );
        if (selectedImg) markActiveImage(selectedImg);
    }

    frameList.classList.remove("hidden");
    frameList.scrollLeft = 0;
}

document.addEventListener("DOMContentLoaded", function () {
    window.currentFrameIndex = 0;
    window.currentPage = 1;
    window.allFrames = [];
    window.MAX_FRAMES_PER_PAGE = 50

    const nextButton = document.getElementById("next-page");
    const prevButton = document.getElementById("prev-page");

    fetch("/get-frames")
        .then(response => response.json())
        .then(frames => {
            const loadingPanel = document.getElementById("loading-panel");

            frames.forEach((frameData) => {
                window.allFrames.push(frameData);
            });

            window.allFrames.sort((a, b) => a.frame_index - b.frame_index);
            loadingPanel.classList.add("hidden");
            renderFramesPage(currentPage)
        })
        .catch(error => console.error("Error loading frames:", error));

    fetch('/get-last-frame-and-page-number')
        .then(response => response.json())
        .then(data => {
            window.currentFrameIndex = data.last_frame_index;
            window.currentPage = data.page_number;
            renderFramesPage(currentPage, window.currentFrameIndex);
        })
        .catch(error => console.error("Error loading last frame index and page number:", error));

    nextButton.addEventListener("click", function () {
        if (currentPage < Math.ceil(allFrames.length / window.MAX_FRAMES_PER_PAGE)) {
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
});