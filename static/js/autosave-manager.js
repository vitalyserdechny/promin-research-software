/**
 * autosave-manager.js
 * Отвечает за автоматическое сохранение данных проекта на сервер.
 */

const AutoSaveManager = {
    endpoints: {
        saveAnnotations: "/save-annotations",
        saveMetadata: "/save-project-data"
    },

    setStatus: (status) => {
        const el = document.getElementById("autosave-status");
        if (!el) return;
        
        el.style.opacity = "1";
        el.style.transition = "none"; 

        if (status === 'saving') {
            el.innerHTML = "⏳ Saving...";
            el.style.color = "rgba(236, 161, 75, 0.7)";
        } else if (status === 'saved') {
            el.innerHTML = "☁️ All changes saved";
            el.style.color = "#4cd964"; 
            el.style.transition = "opacity 2s ease-in-out"; 
            
            setTimeout(() => {
                if (el.innerHTML.includes("saved")) { 
                    el.style.opacity = "0.5";
                }
            }, 2000);
        } else if (status === 'error') {
            el.innerHTML = "❌ Save failed!";
            el.style.color = "#ff3b30";
        }
    },


    saveCurrentFrame: async () => {
        if (typeof window.allFrames === 'undefined') {
            console.warn("Autosave skipped: window.allFrames is undefined");
            return;
        }

        AutoSaveManager.setStatus('saving');
        
        const frameNumEl = document.getElementById("frame-number");
        if (!frameNumEl) return;
        
        const currentIdx = parseInt(frameNumEl.textContent);
        
        const frameData = window.allFrames.find(f => f.frame_index === currentIdx);

        if (!frameData) {
            console.error(`Autosave error: Frame ${currentIdx} not found in memory`);
            AutoSaveManager.setStatus('error');
            return;
        }

        const payload = [{
            frame_index: frameData.frame_index,
            annotations: frameData.annotations
        }];

        try {
            const response = await fetch(AutoSaveManager.endpoints.saveAnnotations, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                setTimeout(() => AutoSaveManager.setStatus('saved'), 300);
            } else {
                throw new Error(`Server returned ${response.status}`);
            }
        } catch (e) {
            console.error("Autosave network error:", e);
            AutoSaveManager.setStatus('error');
        }
    },

    saveMetadata: async () => {
        const projectData = {
            classes_and_colors: window.classesAndColors || {},
            last_frame_index: window.currentFrameIndex || 0,
            page_number: (window.paginationInfo && window.paginationInfo.currentPage) ? window.paginationInfo.currentPage : 1
        };

        try {
            await fetch(AutoSaveManager.endpoints.saveMetadata, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(projectData)
            });
            console.log("Metadata autosaved silently.");
        } catch (e) {
            console.error("Metadata save error:", e);
        }
    }
};