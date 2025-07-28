/**
 * Модуль Analysis для реализации функционала анализа моделей компьютерного зрения 📊📈
 * 
 * Функции:
 * 👀 Отображение панели анализа с выбором моделей и шагов предобработки
 * ▶️ Запуск анализа выбранных моделей с отображением прогресса
 * ℹ️ Обработка результатов анализа и отображение информационных сообщений
 * 
 * Автор: Сердечный Виталий ♥️
 */

document.addEventListener("DOMContentLoaded", function () {

    const socket = io.connect(this.location.origin)

    const analysisAudio = document.getElementById('bg-analysis-music');
    const doneAudio = document.getElementById('done-sound');

    const modelSelectionDiv = document.getElementById('model-selection');
    const preprocSelectionDiv = document.getElementById('preproc-selection');

    const analysisPanel = document.getElementById('analysis-panel');
    const analysisPanelContent = document.getElementById('analysis-panel-content');

    const openAnalysisPanelBtn = document.getElementById('models-analysis-btn');
    const closeAnalysisPanelBtn = document.getElementById('close-analysis-panel-btn');

    const runAnalysisBtn = document.getElementById('run-analysis-btn');
    const analysisMsgText = document.getElementById('analysis-message-text');
    const analysisDoneBtn = document.getElementById('analysis-done-btn');

    const fileInput = document.getElementById('preproc-file-input');
    const textarea = document.getElementById('preproc-textarea');

    const analysisProcessDiv = document.getElementById('analysis-process');
    const analysisDoneDiv = document.getElementById('analysis-done-div');

    const outsideElems = analysisPanelContent.querySelectorAll('.outside-div-elems');

    const selectAllModelsCheckbox = document.getElementById('select_all_models');

    const showSchemeBtn = document.getElementById('show-preproc-scheme-btn');

    let preprocJsonObject = null;
    let preprocStepColors = [];

    socket.on('analysis-progress-update', function (data) {
        const msg = data.message;
        const step = data.step;

        if (step == 1) {
            const frame = data.frame;
            const total_frames = data.total_frames;
            analysisMsgText.textContent = msg + '...' + '(' + frame + '/' + total_frames + ')';
        }
        else {
            analysisMsgText.textContent = msg;
        }
    });

    // mode может быть "analysis_setup", "analysis_process" или "analysis_finished"
    function toggleView(mode) {
        if (mode == "analysis_setup") {
            // Отображаем все элементы для настройки анализа
            modelSelectionDiv.style.display = 'flex';
            preprocSelectionDiv.style.display = 'flex';
            runAnalysisBtn.style.display = 'block';

            outsideElems.forEach(el => {
                el.style.display = 'block';
            })

            // Скрываем элементы, которые не нужны на этапе настройки
            analysisProcessDiv.style.display = 'none';
            analysisDoneDiv.style.display = 'none';
        }
        else if (mode == "analysis_process") {
            modelSelectionDiv.style.display = 'none';
            preprocSelectionDiv.style.display = 'none';
            runAnalysisBtn.style.display = 'none';

            analysisProcessDiv.style.display = 'flex';

            outsideElems.forEach(el => {
                el.style.display = 'none';
            })
        }
        else if (mode == "analysis_finished") {
            modelSelectionDiv.style.display = 'none';
            preprocSelectionDiv.style.display = 'none';
            runAnalysisBtn.style.display = 'none';

            analysisDoneDiv.style.display = 'flex';

            outsideElems.forEach(el => {
                el.style.display = 'none';
            })

            analysisProcessDiv.style.display = 'none';
        }
        else {
            console.error("Unknown view mode:", mode);
            showMessageBox('Oops... something went wrong internally...', 'error');
        }
    }

    selectAllModelsCheckbox.addEventListener('click', function () {
        const modelCheckboxes = document.querySelectorAll('#model-selection input[name="model"]');
        modelCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllModelsCheckbox.checked;
        });
    })

    function getRandomDarkColor() {
        // H: оттенок от 0 до 360, S: насыщенность 60–100%, L: светлота 20–40%
        const h = Math.floor(Math.random() * 360);
        const s = 70 + Math.floor(Math.random() * 30);  // насыщенность 70–100%
        const l = 25 + Math.floor(Math.random() * 15);  // светлота 25–40%
        return `hsl(${h}, ${s}%, ${l}%)`;
    }

    function drawPreprocStepsOnCanvas(preprocSteps, canvas) {
        const ctx = canvas.getContext('2d');

        const blockWidth = 220;
        const gap = 50;

        // Устанавливаем динамическую ширину canvas на основе количества блоков
        canvas.width = preprocSteps.length * (blockWidth + gap) + 40;
        canvas.height = 180;

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const blockHeight = 100;
        const padding = 12;
        const borderRadius = 15;

        ctx.textBaseline = 'top';
        // Функция для рисования скругленного прямоугольника
        function roundRect(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        }

        // Функция для переноса текста по строкам
        function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            let testLine = '';
            let lineArray = [];
            for (let n = 0; n < words.length; n++) {
                testLine += words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                const testWidth = metrics.width;
                if (testWidth > maxWidth && n > 0) {
                    lineArray.push(line.trim());
                    line = words[n] + ' ';
                    testLine = words[n] + ' ';
                } else {
                    line += words[n] + ' ';
                }
                if (n === words.length - 1) {
                    lineArray.push(line.trim());
                }
            }

            for (let i = 0; i < lineArray.length; i++) {
                ctx.fillText(lineArray[i], x, y + (i * lineHeight));
            }
        }

        function paramToString(value) {
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    return `[${value.map(paramToString).join(', ')}]`;
                } else {
                    return '{' + Object.entries(value).map(([k, v]) => `${k}:${paramToString(v)}`).join(', ') + '}';
                }
            }
            return String(value);
        }

        // Вычисляем горизонтальное смещение для центрирования всех блоков
        const totalWidth = preprocSteps.length * (blockWidth + gap) - gap;
        let startX = Math.max((width - totalWidth) / 2, 20);
        const y = (height - blockHeight) / 2;

        preprocSteps.forEach((step, index) => {
            const x = startX + index * (blockWidth + gap);

            // Рисуем фон с закруглениями
            roundRect(ctx, x, y, blockWidth, blockHeight, borderRadius);
            const bgColor = preprocStepColors[index] || '#444';
            ctx.fillStyle = bgColor;
            ctx.fill();

            // Обводка
            ctx.strokeStyle = '#2C3E50';
            ctx.lineWidth = 2;
            roundRect(ctx, x, y, blockWidth, blockHeight, borderRadius);
            ctx.stroke();

            // Текст: название метода жирным шрифтом
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 18px Arial';
            ctx.fillText(step.method || "Unknown", x + padding, y + padding);

            // Текст параметров
            ctx.font = '14px Arial';
            const params = Object.entries(step)
                .filter(([key]) => key !== 'method')
                .map(([key, value]) => `${key}=${paramToString(value)}`)
                .join(', ');

            // Перенос текста с паддингами, сдвиг по Y чтобы не пересекаться с заголовком
            wrapText(ctx, params, x + padding, y + padding + 28, blockWidth - padding * 2, 18);

            // Рисуем стрелку к следующему блоку, если он есть
            if (index < preprocSteps.length - 1) {
                const arrowStartX = x + blockWidth;
                const arrowStartY = y + blockHeight / 2;
                const arrowEndX = arrowStartX + gap - 15;
                const arrowEndY = arrowStartY;

                ctx.strokeStyle = '#2C3E50';
                ctx.lineWidth = 3;

                // Линия стрелки
                ctx.beginPath();
                ctx.moveTo(arrowStartX, arrowStartY);
                ctx.lineTo(arrowEndX, arrowEndY);
                ctx.stroke();

                // Голова стрелки
                ctx.beginPath();
                ctx.moveTo(arrowEndX, arrowEndY);
                ctx.lineTo(arrowEndX - 10, arrowEndY - 7);
                ctx.lineTo(arrowEndX - 10, arrowEndY + 7);
                ctx.closePath();
                ctx.fillStyle = '#2C3E50';
                ctx.fill();
            }
        });
    }

    fileInput.addEventListener('change', function () {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const preprocSchemeModal = document.getElementById('preproc-scheme-modal');
                if (!preprocSchemeModal) throw new Error("Preprocessing scheme modal not found");

                const preprocSchemeOkBtn = document.getElementById('preproc-scheme-modal-ok-btn');
                if (!preprocSchemeOkBtn) throw new Error("Preprocessing scheme OK button not found");

                preprocSchemeOkBtn.addEventListener('click', function () {
                    preprocSchemeModal.style.display = 'none';
                });

                preprocJsonObject = JSON.parse(e.target.result);
                preprocStepColors = preprocJsonObject.map(() => getRandomDarkColor());
                console.log("JSON loaded:", preprocJsonObject);

                // textarea.value = JSON.stringify(preprocJsonObject, null, 2);
                preprocSchemeModal.style.display = 'block';
                drawPreprocStepsOnCanvas(preprocJsonObject, document.getElementById('preproc-canvas'));
            } catch (err) {
                console.error("Error parsing JSON:", err);
                showMessageBox("Unable to read JSON-file!", "error");
            }
        };
        reader.readAsText(file);
    });

    openAnalysisPanelBtn.addEventListener('click', function () {
        toggleView("analysis_setup");
        analysisPanel.classList.add('active');
    });

    closeAnalysisPanelBtn.addEventListener('click', function () {
        analysisPanel.classList.remove('active');
    });

    analysisDoneBtn.addEventListener('click', function () {
        analysisPanel.classList.remove('active');
    })

    showSchemeBtn.addEventListener('click', () => {
        const preprocSchemeModal = document.getElementById('preproc-scheme-modal');
        if (!preprocSchemeModal) return;

        if (!preprocJsonObject) {
            showMessageBox("Please load a JSON pipeline file first!", "warning");
            return;
        }

        preprocSchemeModal.style.display = 'block';

        drawPreprocStepsOnCanvas(preprocJsonObject, document.getElementById('preproc-canvas'));
    });

    runAnalysisBtn.addEventListener('click', function () {
        const selectedModels = Array.from(document.querySelectorAll('#model-selection input[name="model"]:checked')).filter(checkbox => checkbox.value != 'select_all')
            .map(checkbox => checkbox.value);

        if (selectedModels.length === 0) {
            showMessageBox('Please select at least one model for analysis!', 'error');
            return;
        }

        toggleView("analysis_process");

        analysisAudio.currentTime = 0
        analysisAudio.play()

        const dataToSend = {
            models: selectedModels,
            preprocessing_pipeline: preprocJsonObject ? preprocJsonObject : []
        };

        console.log("preprocJsonObject:", preprocJsonObject);
        console.log("typeof preprocJsonObject:", typeof preprocJsonObject);
        console.log("stringify dataToSend:", JSON.stringify(dataToSend));

        fetch("/run-analysis", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dataToSend)
        })
            .then(response => {
                if (response.ok) {
                    toggleView("analysis_finished");
                    analysisAudio.pause()
                    doneAudio.currentTime = 0
                    doneAudio.play()
                } else {
                    showMessageBox('Error running analysis 🥲', 'error');
                }
            })
            .catch(error => {
                showMessageBox('Error running analysis 🥲', 'error');
                console.error("Error running analysis:", error)
            });
    });
});