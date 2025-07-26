/**
 * Модуль Playground для интерактивного тестирования препроцессинга и аннотирования кадров 🎮
 * 
 * Функции:
 * ▶️ Запуск playground
 * 💁🏽 Интерпретация пользовательских команд (annotate, preproc, reset)
 * ⬜ Отображение bounding box'ов поверх изображения
 * ⚙️ Применение препроцессоров с параметрами
 * 
 * ❓Полное описание поддерживаемых комманд и параметров:
 * https://docs.google.com/document/d/10LXocIGpwtbXtbOFVqhC3_P-Sia7UjunlS3frc5V8M0/edit?usp=sharing
 * 
 * Автор: Сердечный Виталий ♥️
 */

document.addEventListener("DOMContentLoaded", function () {

    const playgroundPanel = document.getElementById('playground-panel');
    const enterPlaygroundBtn = document.getElementById('enter_playground_btn');
    const playgroundInput = document.getElementById("playground-command-input");
    const closePlaygroundPanelBtn = document.getElementById('close-playground-panel-btn');
    const log = document.getElementById('playground-log-output');
    const img = document.getElementById('playground-frame-image');

    // История команд в консоли Playground
    let commandHistory = [];
    let historyIndex = -1;

    // Вывод строки в лог (имитация консоли)
    function appendToPlaygroundLog(message, skip_selector_char = false) {
        if (!skip_selector_char) {
            log.textContent += "> " + message + '\n';
        }
        else {
            log.textContent += message + '\n';
        }
        log.scrollTop = log.scrollHeight;
    }

    // Очистка лога
    function clearPlaygroundLog() {
        log.textContent = "";
    }

    // Сброс аннотаций в Playground (все bounding box'ы удаляются)
    function resetPlaygroundAnnotations() {
        const overlay = document.getElementById('playground-bounding-boxes');
        overlay.innerHTML = '';
        appendToPlaygroundLog('✅ All annotations removed!');
    }

    // Сброс всех шагов препроцессинга (изображение возвращается к исходному состоянию)
    function resetPlaygroundPreproc() {
        fetch(`/reset-preproc?frame_index=${currentFrameIndex}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.image_base64) {
                    img.src = `data:image/jpeg;base64,${data.image_base64}`;
                    appendToPlaygroundLog('✅ Preprocessing steps removed!');
                } else {
                    appendToPlaygroundLog("🛑 Unknown error! Details: " + data.error);
                }
            })
            .catch(err => appendToPlaygroundLog("🛑 Preprocessing reset error: " + err.message));
    }

    // Обработчик клика по кнопке "Playground"
    enterPlaygroundBtn.addEventListener('click', function () {
        playgroundPanel.classList.add('active');
        fetch(`/initialize-playground?frame_index=${currentFrameIndex}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.image_base64) {
                    img.src = `data:image/jpeg;base64,${data.image_base64}`;
                    appendToPlaygroundLog("Playground initialized!");
                } else {
                    appendToPlaygroundLog('🛑 Playground initialization:' + data.error);
                }
            })
            .catch(err => appendToPlaygroundLog("🛑 Playground initialization error: " + err.message));
    })

    // Функция для аннотирования текущего кадра с помощью выбранной модели
    function playgroundAnnotate(model, confidence) {
        fetch(`/annotate-playground-frame?frame_index=${currentFrameIndex}&model=${model}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success' && data.annotations && data.time) {

                    const filteredAnnotations = data.annotations.filter(annotation => {
                        const parts = annotation.trim().split(' ');
                        const conf = parseFloat(parts[parts.length - 1]);
                        return conf >= confidence;
                    });

                    appendToPlaygroundLog(`✅ Annotated with ${model} model\ntime: ${data.time} s\nconfidence: ${confidence}`);
                    appendToPlaygroundLog("Bounding boxes:", skip_selector_char = true)
                    filteredAnnotations.forEach(ann => {
                        appendToPlaygroundLog(ann, skip_selector_char = true)
                    });

                    const overlay = document.getElementById('playground-bounding-boxes');
                    const container = document.getElementById('playground-image-container');

                    overlay.innerHTML = '';

                    const imgRect = img.getBoundingClientRect();
                    const containerRect = container.getBoundingClientRect();

                    const offsetX = imgRect.left - containerRect.left;
                    const offsetY = imgRect.top - containerRect.top;

                    const imgWidth = img.clientWidth;
                    const imgHeight = img.clientHeight;

                    filteredAnnotations.forEach(annotation => {
                        const parts = annotation.trim().split(' ');

                        const conf = parts.pop();
                        const height = parts.pop();
                        const width = parts.pop();
                        const y_center = parts.pop();
                        const x_center = parts.pop();

                        const label = parts.join(' ');

                        const confNum = parseFloat(conf).toFixed(2);
                        const x = (parseFloat(x_center) - parseFloat(width) / 2) * imgWidth + offsetX;
                        const y = (parseFloat(y_center) - parseFloat(height) / 2) * imgHeight + offsetY;
                        const boxWidth = parseFloat(width) * imgWidth;
                        const boxHeight = parseFloat(height) * imgHeight;

                        const box = document.createElement('div');
                        box.classList.add('bounding-box');
                        box.style.position = 'absolute';
                        box.style.left = `${x}px`;
                        box.style.top = `${y}px`;
                        box.style.width = `${boxWidth}px`;
                        box.style.height = `${boxHeight}px`;
                        box.style.border = '2px solid red';
                        box.style.boxSizing = 'border-box';
                        box.style.pointerEvents = 'none';

                        const labelEl = document.createElement('div');
                        labelEl.innerText = `${label} (${confNum})`;
                        labelEl.style.position = 'absolute';
                        labelEl.style.top = '0';
                        labelEl.style.left = '0';
                        labelEl.style.backgroundColor = 'rgba(0,0,0,0.6)';
                        labelEl.style.color = 'white';
                        labelEl.style.fontSize = '12px';
                        labelEl.style.padding = '2px 4px';
                        labelEl.style.pointerEvents = 'none';

                        box.appendChild(labelEl);
                        overlay.appendChild(box);
                    });
                } else {
                    appendToPlaygroundLog("🛑 Unknown error! Details " + data.error);
                }
            })
            .catch(err => appendToPlaygroundLog("🛑 Network error: " + err.message));
    }

    // Обработчик ввода в консоли Playground
    playgroundInput.addEventListener('keydown', function (event) {
        if (event.key == "Enter") {
            event.preventDefault();

            const command = playgroundInput.value.trim();
            if (command != "") {
                commandHistory.push(command);
                historyIndex = -1;

                if (command == "clear") {
                    clearPlaygroundLog()
                }
                else if (command.startsWith("annotate")) {
                    const parts = command.split(" ");
                    if (parts.length >= 3) {
                        const model = parts[1];
                        const confPart = parts[2];

                        const match = confPart.match(/^conf=([\d.]+)$/);
                        if (match) {
                            const conf = parseFloat(match[1]);
                            if (!isNaN(conf)) {
                                playgroundAnnotate(model, conf);
                            } else {
                                appendToPlaygroundLog("🛑 Confidence value invalid!");
                            }
                        } else {
                            appendToPlaygroundLog("🛑 Invalid syntax. Use: annotate [model] conf=[value]");
                        }
                    } else {
                        appendToPlaygroundLog("🛑 Invalid command. Example: annotate yolov5 conf=0.6");
                    }
                }
                else if (command.startsWith("reset")) {
                    const parts = command.split(" ");
                    if (parts.length == 2) {
                        const target = parts[1];
                        if (target == "annotations") {
                            resetPlaygroundAnnotations()
                        }
                        else if (target == "preproc") {
                            resetPlaygroundPreproc()
                        }
                        else if (target == "all") {
                            resetPlaygroundAnnotations()
                            resetPlaygroundPreproc()
                        }
                        else {
                            appendToPlaygroundLog("🛑 Invalid target. Possible values: [annotations, preproc, all]");
                        }
                    }
                    else {
                        appendToPlaygroundLog("🛑 Invalid syntax. Use: reset [target]");
                    }
                }
                else if (command.startsWith("preproc")) {
                    const parts = command.split(" ");
                    if (parts.length >= 2) {
                        const method = parts[1];
                        const params = {};

                        for (let i = 2; i < parts.length; i++) {
                            const paramMatch = parts[i].match(/^([a-zA-Z_][a-zA-Z0-9_]*)=([\w.\-+eE]+)$/);
                            if (paramMatch) {
                                const key = paramMatch[1];
                                const value = paramMatch[2];
                                params[key] = value;
                            } else {
                                appendToPlaygroundLog(`🛑 Invalid parameter syntax: "${parts[i]}"`);
                                return;
                            }
                        }

                        const query = new URLSearchParams({ frame_index: currentFrameIndex, method, ...params }).toString();

                        fetch(`/apply-preproc-to-frame?${query}`)
                            .then(response => response.json())
                            .then(data => {
                                if (data.status === 'success' && data.image_base64) {
                                    img.src = `data:image/jpeg;base64,${data.image_base64}`;
                                    appendToPlaygroundLog(`✅ Preprocessing method ${method} applied!\nParams: ${JSON.stringify(data.params)}`);
                                } else {
                                    appendToPlaygroundLog(`🛑 Preprocessing error: ${data.error || 'Unknown error'}`);
                                }
                            })
                            .catch(err => appendToPlaygroundLog("🛑 Preprocessing error: " + err.message));
                    }
                    else {
                        appendToPlaygroundLog("🛑 Invalid syntax. Use: preproc [method] [param=value ...]");
                    }
                }
                else if (command === "help") {
                    appendToPlaygroundLog("🔗Opening commands and params info in a new tab...");
                    window.open('https://docs.google.com/document/d/10LXocIGpwtbXtbOFVqhC3_P-Sia7UjunlS3frc5V8M0/edit?usp=sharing', '_blank');
                }
                else {
                    appendToPlaygroundLog("🛑 Unknown command!");
                }
            }

            playgroundInput.value = ""
        }
        else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (commandHistory.length === 0) return;

            if (historyIndex === -1) {
                historyIndex = commandHistory.length - 1;
            } else if (historyIndex > 0) {
                historyIndex--;
            }
            playgroundInput.value = commandHistory[historyIndex];
            setTimeout(() => playgroundInput.setSelectionRange(playgroundInput.value.length, playgroundInput.value.length), 0);
        }
        else if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (commandHistory.length === 0) return;

            if (historyIndex === -1) return; // Нет куда идти вниз

            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                playgroundInput.value = commandHistory[historyIndex];
            } else {
                historyIndex = -1;
                playgroundInput.value = '';
            }
            setTimeout(() => playgroundInput.setSelectionRange(playgroundInput.value.length, playgroundInput.value.length), 0);
        }
    })

    // Обработчик клика по кнопке закрытия Playground-а
    closePlaygroundPanelBtn.addEventListener('click', function () {
        playgroundPanel.classList.remove('active'); // Скрываем панель
        const overlay = document.getElementById('playground-bounding-boxes');
        overlay.innerHTML = '';
        clearPlaygroundLog();
        fetch('/close-playground', {
            method: 'POST'
        })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    console.log('Playground закрыт успешно');
                } else {
                    console.error('Ошибка при закрытии playground:', data.error || 'Неизвестная ошибка');
                }
            })
            .catch(err => {
                console.error('Ошибка при отправке запроса на закрытие playground:', err);
            });
    });

});