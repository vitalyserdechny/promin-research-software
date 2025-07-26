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

    const analysisWelcomeText = document.getElementById('analysis-welcome-text');
    const analysisAudio = document.getElementById('bg-analysis-music');

    const modelSelectionDiv = document.getElementById('model-selection');
    const preprocSelectionDiv = document.getElementById('preproc-selection');

    const analysisPanel = document.getElementById('analysis-panel');
    const analysisPanelContent = document.getElementById('analysis-panel-content');

    const openAnalysisPanelBtn = document.getElementById('models-analysis-btn');
    const closeAnalysisPanelBtn = document.getElementById('close-analysis-panel-btn');

    const runAnalysisBtn = document.getElementById('run-analysis-btn');
    const analysisMsgText = document.getElementById('analysis-message-text');
    const analysisLoader = document.getElementById('analysis-loader');
    const analysisDoneBtn = document.getElementById('analysis-done-btn');

    const fileInput = document.getElementById('preproc-file-input');
    const textarea = document.getElementById('preproc-textarea');

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

    fileInput.addEventListener('change', function () {
        const file = fileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            textarea.value = e.target.result;
        };
        reader.readAsText(file);
    });

    openAnalysisPanelBtn.addEventListener('click', function () {
        const analysisDoneDiv = document.getElementById('analysis-done-div');

        const outsideElems = analysisPanelContent.querySelectorAll('.outside-div-elems')
        outsideElems.forEach(el => {
            el.style.display = 'block'
        })

        analysisLoader.style.display = 'none';
        analysisMsgText.style.display = 'none';
        analysisWelcomeText.style.display = 'none';
        analysisDoneDiv.style.display = 'none';

        modelSelectionDiv.style.display = 'flex';
        preprocSelectionDiv.style.display = 'flex';
        runAnalysisBtn.style.display = 'block';

        analysisPanel.classList.add('active');
    });

    closeAnalysisPanelBtn.addEventListener('click', function () {
        analysisPanel.classList.remove('active');
    });

    analysisDoneBtn.addEventListener('click', function () {
        analysisPanel.classList.remove('active');
    })

    runAnalysisBtn.addEventListener('click', function () {
        const selectedModels = Array.from(document.querySelectorAll('#model-selection input[name="model"]:checked')).filter(checkbox => checkbox.value != 'select_all')
            .map(checkbox => checkbox.value);

        if (selectedModels.length === 0) {
            alert('Please select at least one model!');
            return;
        }
        
        analysisLoader.style.display = 'block';
        analysisMsgText.style.display = 'block';
        analysisWelcomeText.style.display = 'block';

        modelSelectionDiv.style.display = 'none';
        preprocSelectionDiv.style.display = 'none';
        runAnalysisBtn.style.display = 'none';

        analysisAudio.currentTime = 0
        analysisAudio.play()

        const outsideElems = analysisPanelContent.querySelectorAll('.outside-div-elems')
        outsideElems.forEach(el => {
            el.style.display = 'none'
        })

        const preprocSteps = textarea.value.trim().split('\n').filter(line => line.trim() !== '');

        const dataToSend = {
            models: selectedModels,
            preprocessing_pipeline: preprocSteps.length === 0 ? [] : preprocSteps
        };

        console.log(JSON.stringify(dataToSend))

        fetch("/run-analysis", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dataToSend)
        })
            .then(response => {
                if (response.ok) {
                    console.log("Analysis completed successfully!");
                    response.json().then(results => {
                        const analysisDoneDiv = document.getElementById('analysis-done-div');
                        analysisLoader.style.display = 'none';
                        analysisMsgText.style.display = 'none';
                        analysisWelcomeText.style.display = 'none';
                        analysisDoneDiv.style.display = 'flex';
                        analysisAudio.pause()
                    });
                } else {
                    console.error("Error running analysis");
                }
            })
            .catch(error => console.error("Error running analysis:", error));
    });

});