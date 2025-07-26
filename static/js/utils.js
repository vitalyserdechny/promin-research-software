/**
 * Вспомогательные функции 🛠️
 * 
 * Назначение:
 * ℹ️ Общие утилиты, используемые в разных частях проекта
 * ℹ️ Не зависят от конкретного UI или контекста
 * 
 * Автор: Сердечный Виталий ♥️
 */

// Преобразование строки timestamp в читаемую дату
function formatTimestamp(timestamp) {
    if (!timestamp || !/^\d{8}_\d{6}$/.test(timestamp)) return 'Unknown date';

    const year = timestamp.slice(0, 4);
    const month = timestamp.slice(4, 6);
    const day = timestamp.slice(6, 8);
    const hour = timestamp.slice(9, 11);
    const minute = timestamp.slice(11, 13);
    const second = timestamp.slice(13, 15);

    const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);

    return date.toLocaleString('uk-UA', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Проверка, является ли элемент потомком другого элемента
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