document.addEventListener('DOMContentLoaded', () => {
    const title = document.querySelector('.title');
    const centerBird = document.querySelector('.center-bird');
    const buttonContainer = document.querySelector('.button-container');
    let animationInProgress = false;

    title.addEventListener('click', async () => {
        if (animationInProgress) return;
        animationInProgress = true;

        // Reset animations and state
        centerBird.classList.remove('bird-drop', 'bird-fade-out');
        buttonContainer.classList.remove('buttons-reveal');
        
        // Reset button container
        buttonContainer.style.visibility = 'hidden';
        buttonContainer.style.opacity = '0';

        // Start animation sequence
        try {
            // Drop bird
            await animateBirdDrop();
            
            // Pause briefly
            await wait(200);
            
            // Fade out bird
            await animateBirdFadeOut();
            
            // Reveal buttons
            await animateButtonsReveal();
        } catch (error) {
            console.error('Animation error:', error);
        } finally {
            animationInProgress = false;
        }
    });

    // Animation helper functions
    function animateBirdDrop() {
        return new Promise(resolve => {
            centerBird.classList.add('bird-drop');
            centerBird.addEventListener('animationend', resolve, { once: true });
        });
    }

    function animateBirdFadeOut() {
        return new Promise(resolve => {
            centerBird.classList.add('bird-fade-out');
            centerBird.addEventListener('animationend', resolve, { once: true });
        });
    }

    function animateButtonsReveal() {
        return new Promise(resolve => {
            buttonContainer.style.visibility = 'visible';
            buttonContainer.classList.add('buttons-reveal');
            buttonContainer.addEventListener('animationend', resolve, { once: true });
        });
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Add button click handlers
    document.querySelectorAll('.action-button').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.textContent.toLowerCase();
            switch(action) {
                case 'add to server':
                    window.open('https://discord.com/oauth2/authorize?client_id=1377869398731264150', '_blank');
                    break;
                case 'dashboard':
                    window.open('YOUR_DOCS_LINK', '_blank');
                    break;
                case 'support':
                    window.open('YOUR_SUPPORT_SERVER_LINK', '_blank');
                    break;
            }
        });
    });

    // Add star background animation
    const starsContainer = document.querySelector('.stars-container');
    const numberOfStars = 200;

    function createStar() {
        const star = document.createElement('div');
        star.className = 'star';
        
        // Random size between 1 and 3 pixels
        const size = Math.random() * 2 + 1;
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        
        // Random position
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        
        // Random animation delay
        star.style.animationDelay = `${Math.random() * 3}s`;
        
        return star;
    }

    function initStars() {
        // Clear existing stars
        starsContainer.innerHTML = '';
        
        // Create new stars
        for (let i = 0; i < numberOfStars; i++) {
            starsContainer.appendChild(createStar());
        }
    }

    // Initialize stars
    initStars();

    // Reinitialize stars on window resize
    window.addEventListener('resize', () => {
        initStars();
    });

    // Add wing animation handling
    title.addEventListener('mouseenter', () => {
        if (!animationInProgress) {
            centerBird.style.animationDuration = '0.6s';
        }
    });

    title.addEventListener('mouseleave', () => {
        if (!animationInProgress) {
            centerBird.style.animationDuration = '0.8s';
        }
    });

    // Add OAuth2 handling
    function handleDiscordLogin() {
        const { clientId, redirectUri, scopes } = {
            clientId: '1377869398731264150',
            redirectUri: encodeURIComponent('http://localhost:3000/auth/callback'),
            scopes: ['identify', 'guilds']
        };

        const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scopes.join('%20')}`;
        
        // Store current page state
        sessionStorage.setItem('preAuthPage', window.location.href);
        
        // Redirect to Discord auth
        window.location.href = authUrl;
    }

    // Update login button handler
    const loginButton = document.querySelector('.login-button');
    const loginWrapper = document.querySelector('.login-wrapper');

    loginButton.addEventListener('click', () => {
        // Add click effect
        loginWrapper.style.transform = 'scale(0.95)';
        setTimeout(() => {
            loginWrapper.style.transform = 'scale(1)';
            handleDiscordLogin();
        }, 100);
    });

    // Check for auth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
        handleAuthCallback(code);
    }

    async function handleAuthCallback(code) {
        try {
            const response = await fetch('/auth/callback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ code })
            });

            if (!response.ok) throw new Error('Auth failed');

            const data = await response.json();
            
            // Store auth data
            localStorage.setItem('discordUser', JSON.stringify(data.user));
            localStorage.setItem('discordGuilds', JSON.stringify(data.guilds));

            // Update UI
            updateLoginState(data);
            
            // Redirect back to pre-auth page
            const preAuthPage = sessionStorage.getItem('preAuthPage');
            if (preAuthPage) {
                sessionStorage.removeItem('preAuthPage');
                window.location.href = preAuthPage;
            }

        } catch (error) {
            console.error('Auth error:', error);
            // Show error notification
            showNotification('Login failed. Please try again.', 'error');
        }
    }

    function updateLoginState(authData) {
        const { user, guilds } = authData;
        
        // Update login button UI
        const loginText = document.querySelector('.login-text');
        const loginIcon = loginText.querySelector('i');
        
        loginText.innerHTML = `
            <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" 
                 alt="${user.username}" 
                 class="user-avatar">
            <span>${user.username}</span>
        `;

        // Add user menu
        const userMenu = document.createElement('div');
        userMenu.className = 'user-menu';
        userMenu.innerHTML = `
            <div class="menu-item">Dashboard</div>
            <div class="menu-item">My Servers</div>
            <div class="menu-item logout">Logout</div>
        `;
        
        loginWrapper.appendChild(userMenu);
        
        // Add logout handler
        userMenu.querySelector('.logout').addEventListener('click', handleLogout);
    }

    function handleLogout() {
        // Clear auth data
        localStorage.removeItem('discordUser');
        localStorage.removeItem('discordGuilds');
        
        // Reset UI
        window.location.reload();
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Prevent button animation from affecting wrapper
    loginButton.addEventListener('mousedown', (e) => {
        e.stopPropagation();
    });
});