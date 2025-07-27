/**
 * Модуль для загрузки и отображения классов и цветов аннотаций проекта 🎨
 * 
 * Функции:
 * 🌍 Загрузка классов и цветов из сервера
 * 👀 Отображение классов и цветов в интерфейсе
 * 🖱️ Обработка кликов по цветам для изменения цвета
 * 
 * 
 * Автор: Сердечный Виталий ♥️
 */

function displayClassesAndColors(classesColors) {
    const classesList = document.getElementById('classes-and-colors-list');
    if (!classesList) return;

    classesList.innerHTML = '';

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
        }
    }
}

document.addEventListener("DOMContentLoaded", function () {

    window.classesAndColors = null;

    fetch('/get-classes-colors')
        .then(response => response.json())
        .then(colors => {
            classesAndColors = colors;
            displayClassesAndColors(colors);
        })
        .catch(error => {
            console.error("Error loading classes and colors:", error);
            showMessageBox("An error occurred while loading classes and colors", "error")
        });
});