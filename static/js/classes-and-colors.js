/**
 * Модуль для загрузки и отображения классов и цветов аннотаций проекта 🎨
 * * Функции:
 * 🌍 Загрузка классов и цветов из сервера
 * 👀 Отображение классов и цветов в интерфейсе
 * 🖱️ Обработка кликов по цветам для изменения цвета
 * * * Автор: Сердечный Виталий ♥️
 */

window.displayClassesAndColors = function(classesColors) {
    const classesList = document.getElementById('classes-and-colors-list');
    if (!classesList) return;

    classesList.innerHTML = '';

    // Проверка на пустоту
    if (!classesColors || Object.keys(classesColors).length === 0) {
        classesList.innerHTML = '<div style="padding:10px; color:gray; font-size:0.9em;">Немає класів</div>';
        return;
    }

    for (const className in classesColors) {
        if (classesColors.hasOwnProperty(className)) {
            const color = classesColors[className];
            // Защита от битых цветов (если вдруг придет null)
            if (!color || color.length < 3) continue;

            const colorString = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;

            const classCard = document.createElement('div');
            classCard.classList.add('class-card');
            classCard.innerHTML = `
                    <div class="color-preview" style="background-color: ${colorString};"></div>
                    <span class="class-name">${className}</span>
                `;

            classesList.appendChild(classCard);
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {

    window.classesAndColors = {};

    fetch('/get-classes-colors')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(colors => {
            console.log("Classes loaded:", colors); 
            
            window.classesAndColors = colors;
            window.displayClassesAndColors(colors);
        })
        .catch(error => {
            console.error("Error loading classes and colors:", error);
            if (typeof showMessageBox === 'function') {
                showMessageBox("Помилка завантаження класів", "error");
            }
        });
});