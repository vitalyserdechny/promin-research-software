document.addEventListener('DOMContentLoaded', function () {
    const uploadModal = document.getElementById('upload-modal')
    const openModal = document.getElementById('open-modal')
    const projectsSelect = document.getElementById('projects-select')
    const projectSelectLabel = document.getElementById('project-select-label')
    const openProjectSubmitBtn = document.getElementById('open-project-submit-btn')

    // Открытие модалки Upload
    document.getElementById('new-project-btn').addEventListener('click', function () {
        openModalWindow(uploadModal)
    })

    // Открытие модалки Open
    document.getElementById('open-project-btn').addEventListener('click', function () {
        openModalWindow(openModal)
        loadProjects()
    })

    openProjectSubmitBtn.addEventListener('click', function() {
        const project = projectsSelect.value
        if (project) {
            closeModalWindow(openModal)
            window.location.href = `/open?project_name=${encodeURIComponent(project)}`
        }
    })

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            console.log('Close button clicked')
            const modal = btn.closest('.modal-overlay')
            if (modal) closeModalWindow(modal)
        })
    })

    function loadProjects() {
        fetch('/get-projects')
            .then(response => response.json())
            .then(projects => {
                projectsSelect.innerHTML = ''
                if (projects.length === 0) {
                    projectsSelect.style.display = 'none'
                    projectSelectLabel.innerText = 'No Projects Yet (-_-)'
                    openProjectSubmitBtn.style.display = 'none'
                } else {
                    projectsSelect.style.display = 'block'
                    projectSelectLabel.innerText = 'Choose project to open: '
                    openProjectSubmitBtn.style.display = 'block'
                }

                projects.forEach(project => {
                    const option = document.createElement('option')
                    option.value = project['name']
                    option.innerText = project['name']
                    projectsSelect.appendChild(option)
                })
            })
            .catch(error => console.error('Projects list loading error:', error))
    }
})

// Открыть модалку с анимацией
function openModalWindow(modalElement) {
    console.log('Opening modal:', modalElement.id)
     modalElement.style.display = 'flex'
    // даём чуть-чуть времени, чтобы `display: flex` применилось, прежде чем анимация начнётся
    requestAnimationFrame(() => {
        modalElement.classList.add('active')
    })
}

// Закрыть модалку с задержкой (под анимацию)
function closeModalWindow(modalElement) {
    console.log('Closing modal:', modalElement.id)
    modalElement.classList.remove('active')
    // дожидаемся завершения анимации перед скрытием
    setTimeout(() => {
        modalElement.style.display = 'none'
    }, 300) // соответствует CSS transition: 0.3s
}
