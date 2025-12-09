// ========================================
// WHEEL CONFIGURATION
// ========================================

const wheelSegments = [
    {
        label: "Chatbots\n10% OFF",
        domain: "Chatbots",
        discount: 10,
        couponCode: "ZTX-CBOT10",
        color: "#4d6aff"
    },
    {
        label: "Chatbots\n15% OFF",
        domain: "Chatbots",
        discount: 15,
        couponCode: "ZTX-CBOT15",
        color: "#a855f7"
    },
    {
        label: "Websites\n10% OFF",
        domain: "Websites",
        discount: 10,
        couponCode: "ZTX-WEB10",
        color: "#4d6aff"
    },
    {
        label: "Websites\n15% OFF",
        domain: "Websites",
        discount: 15,
        couponCode: "ZTX-WEB15",
        color: "#a855f7"
    },
    {
        label: "Mobile Apps\n10% OFF",
        domain: "Mobile Apps",
        discount: 10,
        couponCode: "ZTX-MAPP10",
        color: "#4d6aff"
    },
    {
        label: "Mobile Apps\n15% OFF",
        domain: "Mobile Apps",
        discount: 15,
        couponCode: "ZTX-MAPP15",
        color: "#a855f7"
    },
    {
        label: "Custom Software\n10% OFF",
        domain: "Custom Software",
        discount: 10,
        couponCode: "ZTX-CUST10",
        color: "#4d6aff"
    },
    {
        label: "Custom Software\n15% OFF",
        domain: "Custom Software",
        discount: 15,
        couponCode: "ZTX-CUST15",
        color: "#a855f7"
    }
];

// ========================================
// GLOBAL VARIABLES
// ========================================

let canvas, ctx;
let isSpinning = false;
let currentRotation = 0;
let userName = '';
let userEmail = '';
let userPhone = '';

// ========================================
// INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // Get user data from sessionStorage
    userName = sessionStorage.getItem('userName');
    userEmail = sessionStorage.getItem('userEmail');
    userPhone = sessionStorage.getItem('userPhone');
    
    // If no user data, redirect back to form
    if (!userName || !userEmail || !userPhone) {
        window.location.href = '/';
        return;
    }
    
    // Display user info
    document.getElementById('displayName').textContent = userName;
    document.getElementById('displayEmail').textContent = userEmail;
    
    // Initialize wheel
    canvas = document.getElementById('wheelCanvas');
    ctx = canvas.getContext('2d');
    drawWheel();
    
    // Event listeners
    document.getElementById('spinButton').addEventListener('click', handleSpin);
    document.getElementById('closePopup').addEventListener('click', closeResultPopup);
    document.getElementById('closeError').addEventListener('click', closeErrorPopup);
});

// ========================================
// WHEEL DRAWING
// ========================================

function drawWheel(rotation = 0) {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = canvas.width / 2 - 10;
    const segmentAngle = (2 * Math.PI) / wheelSegments.length;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();
    
    // Rotate canvas
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);
    ctx.translate(-centerX, -centerY);

    // Draw segments
    wheelSegments.forEach((segment, index) => {
        const startAngle = index * segmentAngle - Math.PI / 2;
        const endAngle = startAngle + segmentAngle;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = segment.color;
        ctx.fill();

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + segmentAngle / 2);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter, Arial, sans-serif';
        
        // Split label by newline and draw each line
        const lines = segment.label.split('\n');
        const lineHeight = 20;
        const textRadius = radius * 0.65;
        
        lines.forEach((line, i) => {
            const yOffset = (i - (lines.length - 1) / 2) * lineHeight;
            ctx.fillText(line, textRadius, yOffset);
        });
        
        ctx.restore();
    });

    // Draw center circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e3a8a';
    ctx.fill();
    ctx.strokeStyle = '#4d6aff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Restore context
    ctx.restore();
}

// ========================================
// SPIN ANIMATION
// ========================================

function spinWheel(winningIndex) {
    return new Promise((resolve) => {
        const segmentAngle = (2 * Math.PI) / wheelSegments.length;
        const spinDuration = 4000; // 4 seconds
        const startTime = Date.now();
        
        // Calculate final rotation
        const baseRotations = 5; // Number of full rotations
        const targetAngle = (2 * Math.PI * baseRotations) - (winningIndex * segmentAngle) - (segmentAngle / 2);
        const startRotation = currentRotation;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / spinDuration, 1);
            
            // Easing function (ease-out cubic)
            const eased = 1 - Math.pow(1 - progress, 3);
            
            currentRotation = startRotation + (targetAngle * eased);
            drawWheel(currentRotation);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                currentRotation = currentRotation % (2 * Math.PI);
                isSpinning = false;
                resolve();
            }
        }
        
        isSpinning = true;
        animate();
    });
}

// ========================================
// FORM HANDLING
// ========================================

async function handleSpin(e) {
    if (e) e.preventDefault();
    
    if (isSpinning) return;
    
    // Disable button
    const spinButton = document.getElementById('spinButton');
    spinButton.disabled = true;
    spinButton.textContent = 'Spinning...';
    
    // Randomly select a winning segment
    const winningIndex = Math.floor(Math.random() * wheelSegments.length);
    const winner = wheelSegments[winningIndex];
    
    // Spin the wheel
    await spinWheel(winningIndex);
    
    // Show loading overlay
    showLoading();
    
    // Call backend API
    try {
        const response = await fetch('/api/spin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: userName,
                email: userEmail,
                phone: userPhone,
                domain: winner.domain,
                discount: winner.discount,
                couponCode: winner.couponCode
            })
        });
        
        const data = await response.json();
        
        hideLoading();
        
        if (data.allowed === false && data.message === 'You have already spun the wheel.') {
            // Only show error if user already spun
            showErrorPopup(data.message);
        } else {
            // Always show success popup with coupon
            showResultPopup(winner);
            // Log any issues to console only
            if (!data.allowed || !data.success) {
                console.log('Backend response:', data);
            }
        }
    } catch (error) {
        hideLoading();
        console.error('API Error (showing success anyway):', error);
        // Still show the coupon - user won fair and square!
        showResultPopup(winner);
    }
    
    // Re-enable button
    spinButton.disabled = false;
    spinButton.textContent = '🎡 Spin the Wheel';
}

// ========================================
// POPUP FUNCTIONS
// ========================================

function showResultPopup(winner) {
    document.getElementById('discountValue').textContent = winner.discount;
    document.getElementById('domainValue').textContent = winner.domain;
    document.getElementById('couponCode').textContent = winner.couponCode;
    
    const popup = document.getElementById('resultPopup');
    popup.classList.remove('hidden');
    
    // Create confetti
    createConfetti();
}

function closeResultPopup() {
    document.getElementById('resultPopup').classList.add('hidden');
    
    // Clear confetti
    document.getElementById('confettiContainer').innerHTML = '';
    
    // Redirect back to home
    setTimeout(() => {
        sessionStorage.clear();
        window.location.href = '/';
    }, 500);
}

function showErrorPopup(message) {
    document.getElementById('errorText').textContent = message;
    document.getElementById('errorPopup').classList.remove('hidden');
}

function closeErrorPopup() {
    document.getElementById('errorPopup').classList.add('hidden');
    
    // Redirect back to home
    setTimeout(() => {
        sessionStorage.clear();
        window.location.href = '/';
    }, 500);
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

// ========================================
// CONFETTI ANIMATION
// ========================================

function createConfetti() {
    const container = document.getElementById('confettiContainer');
    const colors = ['#4d6aff', '#a855f7', '#60a5fa', '#c084fc', '#818cf8'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.classList.add('confetti');
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
        
        // Random shapes
        if (Math.random() > 0.5) {
            confetti.style.borderRadius = '50%';
        }
        
        container.appendChild(confetti);
    }
    
    // Remove confetti after animation
    setTimeout(() => {
        container.innerHTML = '';
    }, 4000);
}

// ========================================
// RESPONSIVE CANVAS
// ========================================

window.addEventListener('resize', function() {
    drawWheel(currentRotation);
});
