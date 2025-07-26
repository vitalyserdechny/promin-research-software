document.addEventListener('DOMContentLoaded', function() {
    const socket = io.connect(this.location.origin)
    const statusMessage = document.getElementById('status-message');
    const progressBar = document.getElementById('progress-bar')
    socket.on('video-processing-progress', function(data) {
        statusMessage.innerText = 'Вилучення кадрів з відео: ' + data.frame + '/' + data.total_frames
        progressBar.style.width = data.progress + '%'
    })
    
    socket.on('video-processing-complete', function(data) {
        statusMessage.innerText = data.message;
        window.location.href = `/open?project_name=${encodeURIComponent(data.project_name)}`;
    })

    const canvas = document.getElementById("neuralCanvas");
    const ctx = canvas.getContext("2d");

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener("resize", () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const neurons = [];
    const neuronCount = 70;
    const maxConnections = 4;

    for (let i = 0; i < neuronCount; i++) {
      neurons.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 3.5 + Math.random() * 1.5,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        glow: Math.random(),
        connections: []
      });
    }

    for (let i = 0; i < neuronCount; i++) {
      for (let j = 0; j < neuronCount; j++) {
        if (i !== j && neurons[i].connections.length < maxConnections) {
          if (Math.random() < 0.035) {
            neurons[i].connections.push(j);
          }
        }
      }
    }

    function draw() {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      neurons.forEach((n, i) => {
        n.connections.forEach(j => {
          const target = neurons[j];
          const grad = ctx.createLinearGradient(n.x, n.y, target.x, target.y);
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

      neurons.forEach(n => {
        const pulse = Math.sin(Date.now() / 500 + n.glow * 10) * 1.2;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + pulse, 0, Math.PI * 2);
        ctx.fillStyle = "#3366ff";
        ctx.shadowBlur = 5;
        ctx.shadowColor = "#99ccff55";
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      neurons.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > width) n.vx *= -1;
        if (n.y < 0 || n.y > height) n.vy *= -1;
      });

      requestAnimationFrame(draw);
    }

    draw();
})
