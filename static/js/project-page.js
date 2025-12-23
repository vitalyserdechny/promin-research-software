/**
 * Core Logic for Project Workspace 🛠️
 */

// ============================================================
// 1. GLOBAL MODAL SYSTEM
// ============================================================

window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Сброс вида панели анализа при открытии
    if (modalId === 'analysis-panel' && typeof window.toggleView === 'function') {
        window.toggleView("analysis_setup"); 
    }

    modal.classList.add('visible');
    setTimeout(() => { modal.classList.add('active'); }, 10);
};

window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => { modal.classList.remove('visible'); }, 300);
};

document.addEventListener("DOMContentLoaded", function () {
    console.log("🚀 Project Page JS Initialized");

    const loader = document.getElementById('loading-panel');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hidden'); 
        }, 500);
    }

    // --- 1. BINDING MENU ITEMS ---
    const bindModal = (btnId, modalId, closeBtnId) => {
        const openBtn = document.getElementById(btnId);
        const closeBtn = document.getElementById(closeBtnId);

        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.openModal(modalId);
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.closeModal(modalId);
            });
        }
    };

    bindModal('models-analysis-btn', 'analysis-panel', 'close-analysis-panel-btn');
    bindModal('enter_playground_btn', 'playground-panel', 'close-playground-panel-btn');
    bindModal('get-reports-btn', 'select-report-panel', 'close-select-report-panel-btn');
    
    const closeViewReportBtn = document.getElementById('close-view-report-panel-btn');
    if (closeViewReportBtn) {
        closeViewReportBtn.addEventListener('click', () => window.closeModal('view-report-panel'));
    }

    // --- 2. SAVE PROJECT LOGIC ---
    const saveProjectButton = document.getElementById("save-project-btn");
    if (saveProjectButton) {
        saveProjectButton.addEventListener("click", async function (e) {
            e.preventDefault();
            
            if (typeof allFrames === 'undefined') {
                alert("Error: Project data missing!");
                return;
            }

            const annotationsData = allFrames.map(frame => ({
                frame_index: frame.frame_index,
                annotations: frame.annotations
            }));

            const projectData = {
                classes_and_colors: window.classesAndColors || {},
                last_frame_index: window.currentFrameIndex || 0,
                page_number: window.currentPage || 1
            };

            try {
                const [annotResponse, metaResponse] = await Promise.all([
                    fetch("/save-annotations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(annotationsData)
                    }),
                    fetch("/save-project-data", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(projectData)
                    })
                ]);

                if (annotResponse.ok && metaResponse.ok) {
                    showMessageBox("Project saved! 💾", "success");
                } else {
                    showMessageBox("Error saving data", "error");
                }
            } catch (error) {
                console.error(error);
                showMessageBox("Network error", "error");
            }
        });
    }

    // --- 3. UTILITIES ---
    const cudaStatusBtn = document.getElementById('cuda_status_btn');
    if (cudaStatusBtn) {
        cudaStatusBtn.addEventListener('click', function (e) {
            e.preventDefault();
            fetch(`/check-cuda`)
                .then(response => response.json())
                .then(data => {
                    const msg = `Status: ${data.cuda_available ? "🟢 On" : "🔴 Off"}<br>Device: ${data.cuda_devices || "None"}`;
                    showMessageBox(msg, "info");
                })
                .catch(err => alert("CUDA Check Error"));
        });
    }

    const closeProjectButton = document.getElementById("close-project-btn");
    if (closeProjectButton) {
        closeProjectButton.addEventListener("click", function (e) {
            e.preventDefault();
            const action = () => window.location.href = "/close-project";
            showConfirmBox("Close project? Unsaved changes may be lost.", (yes) => { if(yes) action(); });
        });
    }
});