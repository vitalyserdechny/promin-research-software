/**
 * Модуль для отображения оверлея при потере соединения с сервером 🛜
 * 
 * Функционал:
 * - Показывает оверлей с сообщением о потере соединения
 * - Скрывает оверлей при восстановлении соединения
 * - Периодически проверяет соединение с сервером
 * 
 * Автор: Сердечный Виталий ♥️
 */

function showConnectionLostOverlay() {
  document.getElementById('connection-lost-overlay').style.display = 'flex';
}

function hideConnectionLostOverlay() {
  document.getElementById('connection-lost-overlay').style.display = 'none';
}

// Периодическая проверка соединения с сервером
function monitorConnection() {
  let isOffline = false;

  setInterval(() => {
    fetch("/ping") 
      .then((response) => {
        if (!response.ok) throw new Error("Bad response");
        if (isOffline) {
          hideConnectionLostOverlay();
          isOffline = false;
        }
      })
      .catch((error) => {
        if (!isOffline) {
          showConnectionLostOverlay();
          isOffline = true;
        }
      });
  }, 5000);
}

document.addEventListener("DOMContentLoaded", monitorConnection);
