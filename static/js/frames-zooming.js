const viewer = document.getElementById('frame-viewer');
const container = document.getElementById('image-container');

// Состояние трансформации
let transformState = {
    scale: 1,
    panning: false,
    pointX: 0,
    pointY: 0,
    startX: 0,
    startY: 0
};

// Константы
const ZOOM_SPEED = 0.1;
const MAX_SCALE = 5; // Максимальный зум (500%)
const MIN_SCALE = 0.5; // Минимальный зум (50%)

// Функция применения трансформации
function setTransform() {
    container.style.transform = `translate(${transformState.pointX}px, ${transformState.pointY}px) scale(${transformState.scale})`;
}

// 1. ЗУМ (Колесико мыши)
viewer.addEventListener('wheel', (e) => {
    e.preventDefault(); // Чтобы страница не скроллилась

    const xs = (e.clientX - transformState.pointX) / transformState.scale;
    const ys = (e.clientY - transformState.pointY) / transformState.scale;

    const delta = -Math.sign(e.deltaY);
    const newScale = transformState.scale + (delta * ZOOM_SPEED);

    if (newScale > MIN_SCALE && newScale < MAX_SCALE) {
        transformState.pointX = e.clientX - (xs * newScale);
        transformState.pointY = e.clientY - (ys * newScale);
        transformState.scale = newScale;
        setTransform();
    }
});

// 2. ПАНОРАМИРОВАНИЕ (Перетаскивание мышкой)
viewer.addEventListener('mousedown', (e) => {
    // Если кликнули не по resize-ручке бокса (проверка классов важна, если ты редактируешь боксы)
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('bounding-box')) {
        return; // Не начинаем панорамирование, если юзер тянет за рамку
    }
    
    transformState.panning = true;
    transformState.startX = e.clientX - transformState.pointX;
    transformState.startY = e.clientY - transformState.pointY;
    viewer.style.cursor = 'grabbing';
});

viewer.addEventListener('mouseup', () => {
    transformState.panning = false;
    viewer.style.cursor = 'grab';
});

viewer.addEventListener('mouseleave', () => { // Если мышка ушла за пределы
    transformState.panning = false;
    viewer.style.cursor = 'grab';
});

viewer.addEventListener('mousemove', (e) => {
    if (!transformState.panning) return;
    
    e.preventDefault();
    transformState.pointX = e.clientX - transformState.startX;
    transformState.pointY = e.clientY - transformState.startY;
    setTransform();
});

// Сброс зума двойным кликом (опционально)
viewer.addEventListener('dblclick', () => {
    transformState.scale = 1;
    transformState.pointX = 0;
    transformState.pointY = 0;
    setTransform();
});

window.transformState = transformState;