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

    // --- 2. UTILITIES ---
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
            showConfirmBox("Close this project?", (yes) => { if(yes) action(); });
        });
    }
});