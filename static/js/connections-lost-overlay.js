/**
 * Module for handling Server Connection Loss 📡
 * Styled for "PROMIN" aesthetic.
 * * Features:
 * - Shows a glass-morphism overlay when ping fails
 * - Automatically retries connection every 5 seconds
 * - Replaces legacy img icons with Emojis
 * * Author: Vitalii Serdechnyi 💜
 */

function showConnectionLostOverlay() {
    const overlay = document.getElementById('connection-lost-overlay');
    if (!overlay) return;

    // Use flex to layout, but visibility is handled by opacity in CSS
    overlay.style.display = 'flex';
    
    // Trigger animation
    requestAnimationFrame(() => {
        overlay.classList.add('active');
    });

    // UX: Inject Emoji if an image is still present (Legacy support)
    const iconEl = overlay.querySelector('.connection-lost-icon');
    if (iconEl && iconEl.tagName === 'IMG') {
        const newIcon = document.createElement('div');
        newIcon.className = 'connection-lost-icon';
        newIcon.innerText = '📡'; // Satellite antenna emoji
        iconEl.parentNode.replaceChild(newIcon, iconEl);
        
        // Add a friendly subtext if not present
        const box = overlay.querySelector('.connection-lost-box');
        if (!box.querySelector('.connection-lost-subtext')) {
            const sub = document.createElement('p');
            sub.className = 'connection-lost-subtext';
            sub.innerText = 'Attempting to reconnect...';
            box.appendChild(sub);
        }
    }
}

function hideConnectionLostOverlay() {
    const overlay = document.getElementById('connection-lost-overlay');
    if (!overlay) return;

    overlay.classList.remove('active');
    
    // Wait for CSS transition (0.5s) before setting display: none
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 500);
}

// Periodic Server Heartbeat
function monitorConnection() {
    let isOffline = false;

    setInterval(() => {
        fetch("/ping") 
            .then((response) => {
                if (!response.ok) throw new Error("Bad response");
                
                // If we were offline and now we are back
                if (isOffline) {
                    hideConnectionLostOverlay();
                    isOffline = false;
                    console.log("[Connection] Restored 🟢");
                }
            })
            .catch((error) => {
                // If we were online and now failed
                if (!isOffline) {
                    showConnectionLostOverlay();
                    isOffline = true;
                    console.warn("[Connection] Lost 🔴");
                }
            });
    }, 5000); // Check every 5 seconds
}

document.addEventListener("DOMContentLoaded", monitorConnection);