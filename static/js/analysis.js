/**
 * Analysis Module 📊
 * Handles model selection, preprocessing pipeline visualization,
 * and executes the analysis via Socket.IO/Fetch.
 * * Refactored for PROMIN "Cute Science" UI.
 */

document.addEventListener("DOMContentLoaded", function () {
    
    // --- DOM ELEMENTS ---
    const analysisPanel = document.getElementById('analysis-panel');
    const runAnalysisBtn = document.getElementById('run-analysis-btn');
    const analysisDoneBtn = document.getElementById('analysis-done-btn');
    
    // Audio
    const analysisAudio = document.getElementById('bg-analysis-music');
    const doneAudio = document.getElementById('done-sound');

    // UI Sections
    const setupElements = document.querySelectorAll('.outside-div-elems'); // Elements to hide during process
    const analysisProcessDiv = document.getElementById('analysis-process');
    const analysisDoneDiv = document.getElementById('analysis-done-div');
    const analysisMsgText = document.getElementById('analysis-message-text');

    // Inputs
    const fileInput = document.getElementById('preproc-file-input');
    const selectAllCheckbox = document.getElementById('select_all_models');
    const showSchemeBtn = document.getElementById('show-preproc-scheme-btn');

    // State
    let preprocJsonObject = null;
    let preprocStepColors = [];
    const socket = io.connect(this.location.origin);


    // ============================================================
    // 1. STATE MANAGEMENT (Toggle Views)
    // ============================================================

    /**
     * Switches between Setup, Processing, and Finished states.
     * Exposed globally so project-page.js can reset view on open.
     * @param {string} mode - 'setup' | 'process' | 'finished'
     */
    window.toggleView = function(mode) {
        if (mode === "analysis_setup") {
            // Show configuration controls
            setupElements.forEach(el => {
                // 🔥 ФИКС ЗВЕЗДЫ: Если элемент - это сетка, возвращаем GRID, а не BLOCK
                if (el.querySelector('.grid-selection') || el.classList.contains('grid-selection')) {
                    el.style.display = 'grid'; 
                } else {
                    el.style.display = 'block';
                }
                
                // Если внутри есть вложенная сетка, чиним и её
                const innerGrid = el.querySelector('.grid-selection');
                if (innerGrid) innerGrid.style.display = 'grid';
            });
            if(runAnalysisBtn) runAnalysisBtn.style.display = 'block';
            
            // Hide progress & result
            if(analysisProcessDiv) analysisProcessDiv.style.display = 'none';
            if(analysisDoneDiv) analysisDoneDiv.style.display = 'none';
            
            // Reset Audio
            if(analysisAudio) { analysisAudio.pause(); analysisAudio.currentTime = 0; }
        } 
        else if (mode === "analysis_process") {
            // Hide controls
            setupElements.forEach(el => el.style.display = 'none');
            if(runAnalysisBtn) runAnalysisBtn.style.display = 'none';
            
            // Show loader
            if(analysisProcessDiv) analysisProcessDiv.style.display = 'flex';
        } 
        else if (mode === "analysis_finished") {
            // Hide loader
            if(analysisProcessDiv) analysisProcessDiv.style.display = 'none';
            
            // Show Success
            if(analysisDoneDiv) analysisDoneDiv.style.display = 'flex';
        }
    };


    // ============================================================
    // 2. SOCKET.IO HANDLERS
    // ============================================================

    socket.on('analysis-progress-update', function (data) {
        const msg = data.message;
        const step = data.step;

        // Step 1 usually involves frame extraction which has a counter
        if (step == 1 && data.total_frames) {
            analysisMsgText.textContent = `${msg}... (${data.frame}/${data.total_frames})`;
        } else {
            analysisMsgText.textContent = msg;
        }
    });


    // ============================================================
    // 3. EVENT LISTENERS
    // ============================================================

    // --- Select All Models ---
    if(selectAllCheckbox) {
        selectAllCheckbox.addEventListener('click', function () {
            const modelCheckboxes = document.querySelectorAll('#model-selection input[name="model"]');
            modelCheckboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
        });
    }

    // --- File Upload (Preprocessing Pipeline) ---
    if(fileInput) {
        fileInput.addEventListener('change', function () {
            const file = fileInput.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    preprocJsonObject = JSON.parse(e.target.result);
                    // Generate random colors for visualization
                    preprocStepColors = preprocJsonObject.map(() => getRandomPipelineColor());
                    
                    console.log("Pipeline loaded:", preprocJsonObject);
                    
                    // Show confirmation
                    if(typeof showMessageBox === 'function') {
                        showMessageBox("Pipeline configuration loaded successfully! 🛠️", "success");
                    }
                } catch (err) {
                    console.error("JSON Parse Error:", err);
                    if(typeof showMessageBox === 'function') {
                        showMessageBox("Invalid JSON file!", "error");
                    }
                }
            };
            reader.readAsText(file);
        });
    }

    // --- Show Pipeline Scheme Button ---
    if(showSchemeBtn) {
        showSchemeBtn.addEventListener('click', () => {
            if (!preprocJsonObject) {
                showMessageBox("Please load a JSON pipeline file first!", "warning");
                return;
            }
            
            const modal = document.getElementById('preproc-scheme-modal');
            const canvas = document.getElementById('preproc-canvas');
            const closeBtn = document.getElementById('preproc-scheme-modal-ok-btn');

            if(modal && canvas) {
                drawPipelineOnCanvas(preprocJsonObject, canvas, preprocStepColors);
                
                // Show custom modal manually (simple block/none logic for this specific helper)
                modal.style.display = 'block'; 
                
                // One-time listener to close
                closeBtn.onclick = () => { modal.style.display = 'none'; };
            }
        });
    }

    // --- RUN ANALYSIS (Main Logic) ---
    if(runAnalysisBtn) {
        runAnalysisBtn.addEventListener('click', async function () {
            // 1. Validation
            const selectedModels = Array.from(document.querySelectorAll('#model-selection input[name="model"]:checked'))
                .filter(cb => cb.value !== 'select_all')
                .map(cb => cb.value);

            if (selectedModels.length === 0) {
                showMessageBox('Please select at least one model!', 'error');
                return;
            }

            // 2. UI Updates
            window.toggleView("analysis_process");
            if(analysisAudio) {
                analysisAudio.currentTime = 0;
                analysisAudio.play().catch(e => console.log("Audio autoplay blocked:", e));
            }

            // 3. Prepare Payload
            const payload = {
                models: selectedModels,
                preprocessing_pipeline: preprocJsonObject ? preprocJsonObject : []
            };

            // 4. Send Request
            try {
                const response = await fetch("/run-analysis", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    // Success
                    window.toggleView("analysis_finished");
                    if(analysisAudio) analysisAudio.pause();
                    if(doneAudio) {
                        doneAudio.currentTime = 0;
                        doneAudio.play().catch(e => console.log("Audio autoplay blocked:", e));
                    }
                } else {
                    throw new Error("Server returned " + response.status);
                }
            } catch (error) {
                console.error("Analysis failed:", error);
                showMessageBox('Error running analysis. See console.', 'error');
                window.toggleView("analysis_setup"); // Revert to setup
                if(analysisAudio) analysisAudio.pause();
            }
        });
    }

    // --- Done Button ---
    if(analysisDoneBtn) {
        analysisDoneBtn.addEventListener('click', function () {
            // Close modal via global helper from project-page.js
            if(window.closeModal) {
                window.closeModal('analysis-panel');
            } else {
                // Fallback
                analysisPanel.style.display = 'none';
            }
        });
    }
});


// ============================================================
// 4. CANVAS DRAWING HELPERS (Visualization)
// ============================================================

function getRandomPipelineColor() {
    // Generates a darkish, professional HSL color
    const h = Math.floor(Math.random() * 360);
    const s = 60 + Math.floor(Math.random() * 20);
    const l = 30 + Math.floor(Math.random() * 15);
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function drawPipelineOnCanvas(steps, canvas, colors) {
    const ctx = canvas.getContext('2d');
    
    // Config
    const blockWidth = 220;
    const blockHeight = 100;
    const gap = 50;
    const padding = 12;
    const borderRadius = 15;

    // Resize canvas
    canvas.width = steps.length * (blockWidth + gap) + 40;
    canvas.height = 180;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Helpers
    const roundRect = (x, y, w, h, r) => {
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
    };

    const wrapText = (text, x, y, maxWidth, lineHeight) => {
        const words = text.split(' ');
        let line = '';
        
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                ctx.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, y);
    };

    const paramToString = (val) => {
        if (typeof val === 'object' && val !== null) return JSON.stringify(val);
        return String(val);
    };

    // Drawing Loop
    const startX = 20; // Fixed padding left
    const startY = (canvas.height - blockHeight) / 2;

    steps.forEach((step, index) => {
        const x = startX + index * (blockWidth + gap);

        // 1. Background
        roundRect(x, startY, blockWidth, blockHeight, borderRadius);
        ctx.fillStyle = colors[index] || '#444';
        ctx.fill();

        // 2. Border
        ctx.strokeStyle = '#2C3E50';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Title (Method Name)
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 16px "Quicksand", sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(step.method || "Unknown", x + padding, startY + padding);

        // 4. Params
        ctx.font = '12px "Fira Code", monospace';
        const paramsStr = Object.entries(step)
            .filter(([k]) => k !== 'method')
            .map(([k, v]) => `${k}:${paramToString(v)}`)
            .join(', ');
        
        wrapText(paramsStr, x + padding, startY + padding + 25, blockWidth - padding*2, 14);

        // 5. Arrow (if not last)
        if (index < steps.length - 1) {
            const arrowX = x + blockWidth;
            const arrowY = startY + blockHeight / 2;
            const arrowEnd = arrowX + gap - 10;

            ctx.beginPath();
            ctx.moveTo(arrowX, arrowY);
            ctx.lineTo(arrowEnd, arrowY);
            ctx.strokeStyle = '#2C3E50';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Arrowhead
            ctx.beginPath();
            ctx.moveTo(arrowEnd, arrowY);
            ctx.lineTo(arrowEnd - 8, arrowY - 6);
            ctx.lineTo(arrowEnd - 8, arrowY + 6);
            ctx.fillStyle = '#2C3E50';
            ctx.fill();
        }
    });
}