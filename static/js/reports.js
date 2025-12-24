/**
 * Отчетный модуль UI: загрузка, просмотр и визуализация отчетов 📝
 * 
 * Функции:
 * 📂 Открытие панели выбора отчета
 * 📋 Загрузка списка доступных отчетов
 * 🌍 Загрузка выбранного отчета с сервера
 * 📈 Отображение таблицы метрик и графика по выбранной метрике с возможностью сортировки
 * 
 * Автор: Сердечный Виталий ♥️
 */

document.addEventListener("DOMContentLoaded", function () {

    const selectReportBtn = document.getElementById('get-reports-btn');
    const selectReportPanel = document.getElementById('select-report-panel');
    const viewReportPanel = document.getElementById('view-report-panel');
    const closeSelectReportPanelBtn = document.getElementById('close-select-report-panel-btn');
    const closeViewReportPanelBtn = document.getElementById('close-view-report-panel-btn');
    const viewReportBtn = document.getElementById('select-report-btn');
    const reportSelect = document.getElementById('report-selector');

    // Обработка выбора отчета и отображения его содержимого
    viewReportBtn.addEventListener('click', function () {
        const selectedValue = reportSelect.value;

        if (!selectedValue || !selectedValue.includes('|')) {
            showMessageBox("Please select a valid report", "warning");
            return;
        }

        const [dirname, filename] = selectedValue.split('|');

        fetch(`/get-selected-report?dirname=${encodeURIComponent(dirname)}&filename=${encodeURIComponent(filename)}`)
            .then(response => response.json())
            .then(data => {
                const content = document.getElementById('view-report-panel-content');
                content.innerHTML = '';

                const summary = document.createElement('div');
                summary.className = 'report-summary';

                const date = new Date(data.datetime_iso);
                summary.innerHTML = `
                    <p><strong>Datetime:</strong> ${date.toLocaleString()}</p>
                    <p><strong>Preprocessing pipeline:</strong> ${data.preprocessing_pipeline.map(step => {
                    let paramsStr = '';
                    const keys = Object.keys(step.params);
                    if (keys.length > 0) {
                        paramsStr = ' (' + keys.map(k => `${k}: ${step.params[k]}`).join(', ') + ')';
                    }
                    return step.method + paramsStr;
                }).join(' → ')}</p>
                    <p><strong>Models:</strong> ${data.models?.join(', ') || '—'}</p>
                `;

                const table = document.createElement('table');
                table.className = 'report-table';

                // Метрики, отображаемые в таблице и графике
                const metrics = [
                    { key: 'FPS', label: 'FPS' },
                    { key: 'mAP@0.5', label: 'mAP@0.5' },
                    { key: 'mAP@.5:.95', label: 'mAP@.5:.95' },
                    { key: 'Precision (Global@0.5)', label: 'Precision' },
                    { key: 'Recall (Global@0.5)', label: 'Recall' },
                    { key: 'F1-score (Global@0.5)', label: 'F1-score' },
                    { key: 'IoU (of True Positives@0.5)', label: 'IoU' }
                ];

                let currentSort = { key: null, ascending: false };

                let chartInstance = null;

                // Построение столбчатого графика по выбранной метрике
                function updateChart(dataRows, metricKey) {
                    const labels = dataRows.map(row => row.model);
                    const values = dataRows.map(row => row[metricKey] ?? 0);

                    const ctx = document.getElementById('report-chart').getContext('2d');
                    if (chartInstance) {
                        chartInstance.destroy();
                    }

                    chartInstance = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: metricKey,
                                data: values,
                                backgroundColor: '#007acc'
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: {
                                    ticks: {
                                        autoSkip: false,
                                        maxRotation: 90,
                                        minRotation: 45
                                    }
                                },
                                y: {
                                    beginAtZero: true
                                }
                            },
                            plugins: {
                                legend: {
                                    display: false
                                }
                            }
                        }
                    });
                }

                // Рендеринг таблицы моделей с возможной сортировкой
                function renderTableBody(sortKey = null) {
                    const tbody = document.createElement('tbody');

                    const rows = Object.entries(data.results).map(([model, values]) => {
                        return {
                            model,
                            ...values
                        };
                    });

                    if (sortKey) {
                        rows.sort((a, b) => {
                            const aVal = a[sortKey] ?? -Infinity;
                            const bVal = b[sortKey] ?? -Infinity;
                            return currentSort.ascending
                                ? aVal - bVal
                                : bVal - aVal;
                        });
                    }

                    rows.forEach(row => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                <td>${row.model}</td>
                ${metrics.map(m => `<td>${row[m.key]?.toFixed(3) ?? '-'}</td>`).join('')}
            `;
                        tbody.appendChild(tr);
                    });

                    const oldTbody = table.querySelector('tbody');
                    if (oldTbody) oldTbody.remove();
                    table.appendChild(tbody);
                    updateChart(rows, sortKey || 'mAP@0.5');
                }

                const thead = document.createElement('thead');
                const headerRow = document.createElement('tr');
                headerRow.innerHTML = `<th>Model</th>` + metrics.map(m => `<th class="sortable" data-key="${m.key}">${m.label}</th>`).join('');
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const container = document.createElement('div');
                container.className = 'report-split-container';

                const tableWrapper = document.createElement('div');
                tableWrapper.className = 'report-table-wrapper';

                const chartWrapper = document.createElement('div');
                chartWrapper.className = 'report-chart-wrapper';
                chartWrapper.innerHTML = `<canvas id="report-chart"></canvas>`;

                tableWrapper.appendChild(table);

                container.appendChild(tableWrapper);
                container.appendChild(chartWrapper);

                const wrapper = document.createElement('div');
                wrapper.className = 'report-content-wrapper';
                wrapper.appendChild(summary);
                wrapper.appendChild(container);

                content.appendChild(wrapper);

                renderTableBody();

                // Сортировка по заголовкам столбцов таблицы
                table.addEventListener('click', (event) => {
                    const th = event.target.closest('th.sortable');
                    if (!th) return;

                    const sortKey = th.dataset.key;
                    if (currentSort.key === sortKey) {
                        currentSort.ascending = !currentSort.ascending;
                    } else {
                        currentSort.key = sortKey;
                        currentSort.ascending = false;
                    }
                    renderTableBody(sortKey);
                });
            })
            .catch(error => {
                showMessageBox("Failed to load report 🥲<br>Error details: " + error, "error");
                console.error('Failed to load report:', error);
            });

        window.closeModal('select-report-panel');
        window.openModal('view-report-panel');
    })

    // Открытие панели выбора отчета и загрузка доступных отчетов ТЕКУЩЕГО ПРОЕКТА
    selectReportBtn.addEventListener('click', function () {
        // Меняем URL на новый
        fetch(`/get-project-reports`)
            .then(response => response.json())
            .then(data => {
                reportSelect.innerHTML = '';
                
                if (data.length === 0) {
                    const emptyOption = document.createElement('option');
                    emptyOption.textContent = 'No reports found for this project';
                    emptyOption.disabled = true;
                    emptyOption.selected = true;
                    reportSelect.appendChild(emptyOption);
                    return;
                }

                data.forEach(report => {
                    const option = document.createElement('option');
                    
                    const dateObj = new Date(report.datetime_iso);
                    const formattedDate = dateObj.toLocaleString(); 
                    
                    const modelsStr = report.models && report.models.length > 0 
                        ? ` (${report.models.length} models)` 
                        : '';

                    const filename = report.filename;
                    const dirname = report.dirname || '';

                    option.value = `${dirname}|${filename}`;
                    option.textContent = `${formattedDate}${modelsStr}`;
                    
                    reportSelect.appendChild(option);
                });
                
                // Открываем панель только после успешной загрузки
                window.openModal('select-report-panel');
                setTimeout(() => { selectReportPanel.classList.add('active'); }, 10);
            })
            .catch(error => {
                showMessageBox("Failed to load reports 🥲", "error");
                console.error('Failed to load reports:', error);
            });
    })

    closeSelectReportPanelBtn.addEventListener('click', function () {
        selectReportPanel.classList.remove('active');
    })

    closeViewReportPanelBtn.addEventListener('click', function () {
        viewReportPanel.classList.remove('active');
    })
});