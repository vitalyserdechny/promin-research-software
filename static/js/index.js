document.addEventListener('DOMContentLoaded', function () {
    
    // --- Configuration ---
    const ANIMATION_DURATION = 300; // Matches CSS transition time (0.3s)

    // --- DOM Elements ---
    const uploadModal = document.getElementById('upload-modal');
    const openModal = document.getElementById('open-modal');
    
    const newProjectBtn = document.getElementById('new-project-btn');
    const openProjectBtn = document.getElementById('open-project-btn');
    
    const projectsSelect = document.getElementById('projects-select');
    const projectSelectLabel = document.getElementById('project-select-label');
    const openProjectSubmitBtn = document.getElementById('open-project-submit-btn');
    
    const closeButtons = document.querySelectorAll('.close-btn');

    // --- Event Listeners ---

    // Open "New Project" Modal
    newProjectBtn.addEventListener('click', function () {
        openModalWindow(uploadModal);
    });

    // Open "Open Project" Modal & Load Data
    openProjectBtn.addEventListener('click', function () {
        openModalWindow(openModal);
        loadProjects();
    });

    // Handle "Open" Button Click (Redirect)
    openProjectSubmitBtn.addEventListener('click', function(e) {
        // Prevent default form submission if needed, though here we use button type="submit" in form
        // But since we handle redirect manually in original logic:
        e.preventDefault(); 
        
        const project = projectsSelect.value;
        if (project) {
            closeModalWindow(openModal);
            // Redirect to project page
            window.location.href = `/open?project_name=${encodeURIComponent(project)}`;
        }
    });

    // Handle Close Buttons (x)
    closeButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const modal = btn.closest('.modal-overlay');
            if (modal) closeModalWindow(modal);
        });
    });

    // Handle "Escape" Key to Close Modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay.active');
            if (activeModal) {
                closeModalWindow(activeModal);
            }
        }
    });

    // --- Helper Functions ---

    /**
     * Opens a modal with a fade-in animation
     * @param {HTMLElement} modalElement 
     */
    function openModalWindow(modalElement) {
        modalElement.style.display = 'flex';
        // RequestAnimationFrame ensures the browser paints the 'flex' display 
        // before adding the class, triggering the CSS transition.
        requestAnimationFrame(() => {
            modalElement.classList.add('active');
        });
    }

    /**
     * Closes a modal with a fade-out animation delay
     * @param {HTMLElement} modalElement 
     */
    function closeModalWindow(modalElement) {
        modalElement.classList.remove('active');
        // Wait for CSS transition to finish before hiding element
        setTimeout(() => {
            modalElement.style.display = 'none';
        }, ANIMATION_DURATION);
    }

    /**
     * Fetches project list from server and populates the select dropdown
     */
    function loadProjects() {
        fetch('/get-projects')
            .then(response => response.json())
            .then(projects => {
                projectsSelect.innerHTML = ''; // Clear existing options

                if (projects.length === 0) {
                    // Empty State
                    projectsSelect.style.display = 'none';
                    projectSelectLabel.innerText = 'Nothing here yet 🥺';
                    openProjectSubmitBtn.style.display = 'none';
                } else {
                    // Populate List
                    projectsSelect.style.display = 'block';
                    projectSelectLabel.innerText = 'Select a project to open:';
                    openProjectSubmitBtn.style.display = 'block'; // Make sure button is visible

                    projects.forEach(project => {
                        const option = document.createElement('option');
                        option.value = project['name'];
                        option.innerText = project['name'];
                        projectsSelect.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error loading projects:', error);
                projectSelectLabel.innerText = 'Error loading projects ⚠️';
            });
    }

    // --- SEASONAL ATMOSPHERE GENERATOR ---
    
    initSeasonalAtmosphere();

    function initSeasonalAtmosphere() {
        const month = new Date().getMonth(); // 0 = Jan, 11 = Dec
        let particles = [];
        
        // Configuration based on season
        // Winter: Dec (11), Jan (0), Feb (1)
        if (month === 11 || month === 0 || month === 1) {
            particles = ['❄️', '❄️', '❄️', '❄️']; 
        } 
        // Spring: Mar (2), Apr (3), May (4)
        else if (month >= 2 && month <= 4) {
            particles = ['🌸', '💮', '🌺', '🍃'];
        } 
        // Summer: Jun (5), Jul (6), Aug (7)
        else if (month >= 5 && month <= 7) {
            particles = ['🌻', '🌼', '🌷', '🦋', '🐝']; 
        } 
        // Autumn: Sep (8), Oct (9), Nov (10)
        else {
            particles = ['🍁', '🍂', '🍄', '🌾', '🌰'];
        }

        // Generate a particle every 400ms (relaxing pace)
        setInterval(() => createParticle(particles), 400);
    }

    function createParticle(allowedParticles) {
        const particle = document.createElement('div');
        
        // Randomly select an icon
        particle.innerText = allowedParticles[Math.floor(Math.random() * allowedParticles.length)];
        particle.classList.add('seasonal-particle');

        // Random horizontal start position (0 to 100vw)
        particle.style.left = Math.random() * 100 + 'vw';

        // Random size (font-size) - varied for depth
        const size = Math.random() * 20 + 10; // 10px to 30px
        particle.style.fontSize = size + 'px';

        // Random fall duration (slow and relaxing: 8s to 15s)
        const duration = Math.random() * 7 + 8; 
        particle.style.animationDuration = `${duration}s, ${Math.random() * 5 + 3}s, ${Math.random() * 10 + 5}s`; // fall, sway, spin times

        // Random delays so they don't start all at once
        particle.style.animationDelay = `0s, ${Math.random() * 5}s, 0s`;

        document.body.appendChild(particle);

        // Remove element after animation finishes to keep DOM clean
        setTimeout(() => {
            particle.remove();
        }, duration * 1000);
    }
});