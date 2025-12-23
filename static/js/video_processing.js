document.addEventListener('DOMContentLoaded', function() {
    
    // --- Socket.IO & UI Setup ---
    const socket = io.connect(this.location.origin);
    const statusMessage = document.getElementById('status-message');
    const progressBar = document.getElementById('progress-bar');

    // Update progress bar and status text
    socket.on('video-processing-progress', function(data) {
        statusMessage.innerText = 'Extracting frames: ' + data.frame + '/' + data.total_frames;
        progressBar.style.width = data.progress + '%';
    });
    
    // Handle completion and redirect
    socket.on('video-processing-complete', function(data) {
        statusMessage.innerText = data.message; 
        window.location.href = `/open?project_name=${encodeURIComponent(data.project_name)}`;
    });

    // --- Neural Network Animation ---
    const canvas = document.getElementById("neuralCanvas");
    const ctx = canvas.getContext("2d");

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // Handle window resize
    window.addEventListener("resize", () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    // Configuration
    const neurons = [];
    const neuronCount = 70;
    const maxConnections = 4;

    // Initialize Neurons (Particles)
    for (let i = 0; i < neuronCount; i++) {
        neurons.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 3.5 + Math.random() * 1.5,      // Radius
            vx: (Math.random() - 0.5) * 0.2,   // Velocity X
            vy: (Math.random() - 0.5) * 0.2,   // Velocity Y
            glow: Math.random(),               // Glow intensity
            connections: []                    // Neighbors
        });
    }

    // Create random connections between neurons
    for (let i = 0; i < neuronCount; i++) {
        for (let j = 0; j < neuronCount; j++) {
            if (i !== j && neurons[i].connections.length < maxConnections) {
                // 3.5% chance to form a connection
                if (Math.random() < 0.035) {
                    neurons[i].connections.push(j);
                }
            }
        }
    }

    // Main Animation Loop
    function draw() {
        // Clear background (White)
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);

        // 1. Draw Connections (Lines)
        neurons.forEach((n, i) => {
            n.connections.forEach(j => {
                const target = neurons[j];
                const grad = ctx.createLinearGradient(n.x, n.y, target.x, target.y);
                
                // Blueish gradient for lines
                grad.addColorStop(0, "rgba(102, 204, 255, 0.2)");
                grad.addColorStop(1, "rgba(51, 102, 255, 0.15)");

                ctx.strokeStyle = grad;
                ctx.lineWidth = 0.3;
                ctx.beginPath();
                ctx.moveTo(n.x, n.y);
                ctx.lineTo(target.x, target.y);
                ctx.stroke();
            });
        });

        // 2. Draw Neurons (Dots)
        neurons.forEach(n => {
            // Pulsating effect
            const pulse = Math.sin(Date.now() / 500 + n.glow * 10) * 1.2;

            ctx.beginPath();
            ctx.arc(n.x, n.y, n.r + pulse, 0, Math.PI * 2);
            ctx.fillStyle = "#3366ff"; // Main blue color
            ctx.shadowBlur = 5;
            ctx.shadowColor = "#99ccff55";
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        // 3. Update Positions (Physics)
        neurons.forEach(n => {
            n.x += n.vx;
            n.y += n.vy;
            
            // Bounce off walls
            if (n.x < 0 || n.x > width) n.vx *= -1;
            if (n.y < 0 || n.y > height) n.vy *= -1;
        });

        requestAnimationFrame(draw);
    }

    // Start animation
    draw();
});