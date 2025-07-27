document.addEventListener("DOMContentLoaded", function () {

    const saveProjectButton = document.getElementById("save-project-btn");
    const closeProjectButton = document.getElementById("close-project-btn");
    const cudaStatusBtn = document.getElementById('cuda_status_btn');

    cudaStatusBtn.addEventListener('click', function () {
        fetch(`/check-cuda`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    showMessageBox("CUDA status: " + data.cuda_available + "<br>Devices: " + data.cuda_devices, "info");
                }
                else {
                    showMessageBox("An error occurred while checking CUDA status", "error");
                }
            })
    })

    closeProjectButton.addEventListener("click", function () {
        window.location.href = "/close-project";
    });

    saveProjectButton.addEventListener("click", function () {
        let successfully = true;

        const dataToSend = allFrames.map(frame => ({
            frame_index: frame.frame_index,
            annotations: frame.annotations
        }));

        fetch("/save-annotations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(dataToSend)
        })
            .then(response => {
                if (response.ok) {
                    console.log("Annotations saved successfully!");
                } else {
                    console.error("Error saving annotations");
                    successfully = false;
                }
            })
            .catch(error => console.error("Error saving annotations:", error));

        fetch("/save-project-data", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                classes_and_colors: classesAndColors,
                last_frame_index: currentFrameIndex,
                page_number: currentPage
            })
        })
            .then(response => {
                if (response.ok) {
                    console.log("Project data saved successfully!");
                } else {
                    console.error("Error saving project data");
                    successfully = false;
                }
            })
            .catch(error => console.error("Error saving project data:", error));

        if (successfully) {
            showMessageBox("The project has been successfully saved!", "info");
        }
        else {
            showMessageBox("An error occurred while saving. Please try again", "error");
        }
    });

});