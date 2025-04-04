// Telegram Web App initialization
const tgApp = window.Telegram.WebApp;
tgApp.expand(); // Expand to fullscreen mode
tgApp.enableClosingConfirmation(); // Ask before closing

// Apply Telegram theme variables
document.documentElement.style.setProperty('--safe-area-inset-bottom', tgApp.viewportStableHeight ? `${window.innerHeight - tgApp.viewportStableHeight}px` : '0px');

// If the theme is light, apply light mode styles
if (tgApp.colorScheme === 'light') {
    document.body.classList.add('telegram-light');
}

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let currentUserId = tgApp.initDataUnsafe.user ? tgApp.initDataUnsafe.user.id.toString() : '';
let selectedImdbId = '';
let currentRating = 5;
let currentTab = 'ratings-section';

// DOM elements
const userInfoDiv = document.getElementById('user-info');
const searchQueryInput = document.getElementById('searchQuery');
const searchButton = document.getElementById('searchButton');
const searchResultsDiv = document.getElementById('searchResults');
const userRatingsDiv = document.getElementById('userRatings');
const userProductsDiv = document.getElementById('userProducts');
const ratingModal = document.getElementById('ratingModal');
const productModal = document.getElementById('productModal');
const movieInfoDiv = document.getElementById('movieInfo');
const submitRatingBtn = document.getElementById('submitRating');
const addProductForm = document.getElementById('addProductForm');
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');
const ratingStars = document.querySelectorAll('input[name="rating"]');
const ratingValueDisplay = document.querySelector('.rating-value');
const addProductFab = document.getElementById('addProductFab');
const closeBtns = document.querySelectorAll('.close');

// Weather elements
const cityInput = document.getElementById('cityInput');
const getWeatherBtn = document.getElementById('getWeatherBtn');
const weatherResultDiv = document.getElementById('weatherResult');

// Currency elements
const amountInput = document.getElementById('amountInput');
const fromCurrencySelect = document.getElementById('fromCurrency');
const toCurrencySelect = document.getElementById('toCurrency');
const convertBtn = document.getElementById('convertBtn');
const conversionResultDiv = document.getElementById('conversionResult');

// Event listeners
searchButton.addEventListener('click', searchMovies);
searchQueryInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchMovies();
    }
});
submitRatingBtn.addEventListener('click', submitRating);
addProductForm.addEventListener('submit', addProduct);
addProductFab.addEventListener('click', openProductModal);

// Weather event listener
getWeatherBtn.addEventListener('click', getWeather);
cityInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        getWeather();
    }
});

// Currency event listener
convertBtn.addEventListener('click', convertCurrency);

// Modal close buttons
closeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
        ratingModal.style.display = 'none';
        productModal.style.display = 'none';
    });
});

window.addEventListener('click', function(e) {
    if (e.target === ratingModal) {
        ratingModal.style.display = 'none';
    }
    if (e.target === productModal) {
        productModal.style.display = 'none';
    }
});

// Bottom navigation
navItems.forEach(item => {
    item.addEventListener('click', () => {
        // Update active nav item
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        
        // Show corresponding tab content
        const tabId = item.getAttribute('data-tab');
        tabContents.forEach(tab => tab.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        
        currentTab = tabId;
        
        // Send analytics to Telegram
        tgApp.HapticFeedback.impactOccurred('light');
        
        // Set backbutton action for Telegram
        if (tabId !== 'ratings-section') {
            tgApp.BackButton.show();
            tgApp.BackButton.onClick(() => {
                // Go back to ratings tab
                navItems.forEach(nav => nav.classList.remove('active'));
                document.querySelector('[data-tab="ratings-section"]').classList.add('active');
                
                tabContents.forEach(tab => tab.classList.remove('active'));
                document.getElementById('ratings-section').classList.add('active');
                
                currentTab = 'ratings-section';
                tgApp.BackButton.hide();
            });
        } else {
            tgApp.BackButton.hide();
        }
    });
});

// Star rating system
ratingStars.forEach(star => {
    star.addEventListener('change', () => {
        currentRating = star.value;
        ratingValueDisplay.textContent = `${currentRating}/10`;
        tgApp.HapticFeedback.selectionChanged();
    });
});

// Ripple effect
document.querySelectorAll('.ripple').forEach(button => {
    button.addEventListener('mousedown', function(e) {
        const x = e.pageX - this.offsetLeft;
        const y = e.pageY - this.offsetTop;
        
        const rippleElement = document.createElement('span');
        rippleElement.classList.add('ripple-effect');
        rippleElement.style.left = `${x}px`;
        rippleElement.style.top = `${y}px`;
        
        this.appendChild(rippleElement);
        
        setTimeout(() => {
            rippleElement.remove();
        }, 600);
    });
});

// Functions
function displayUserInfo() {
    if (!tgApp.initDataUnsafe.user) {
        return;
    }
    
    const user = tgApp.initDataUnsafe.user;
    let userAvatar = '';
    
    // Create user avatar or initials
    if (user.photo_url) {
        userAvatar = `<img src="${user.photo_url}" alt="${user.first_name}" class="user-avatar">`;
    } else {
        const initials = (user.first_name.charAt(0) + (user.last_name ? user.last_name.charAt(0) : '')).toUpperCase();
        userAvatar = `<div class="user-avatar">${initials}</div>`;
    }
    
    userInfoDiv.innerHTML = `
        ${userAvatar}
        <div class="user-name">${user.first_name}${user.last_name ? ' ' + user.last_name : ''}</div>
    `;
}

async function loadUserData() {
    if (!currentUserId) {
        showToast('User ID not available');
        return;
    }
    
    // Load user ratings and tracked products
    await fetchUserRatings();
    await fetchUserProducts();
    
    // Set main button in Telegram
    tgApp.MainButton.setParams({
        text: 'SHARE PROFILE',
        color: tgApp.themeParams.button_color || '#31748f',
        text_color: tgApp.themeParams.button_text_color || '#ffffff'
    });
    
    tgApp.MainButton.onClick(() => {
        // Create share URL for the user's profile
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`Check out my ratings and tracked items!`)}`;
        tgApp.openLink(shareUrl);
    });
    
    tgApp.MainButton.show();
}

async function fetchUserRatings() {
    try {
        showLoading(userRatingsDiv);
        const response = await fetch(`${API_BASE_URL}/ratings/user/${currentUserId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch user ratings');
        }
        
        const ratings = await response.json();
        displayUserRatings(ratings);
    } catch (error) {
        console.error('Error:', error);
        userRatingsDiv.innerHTML = `<p class="error-message">${error.message}</p>`;
    }
}

function displayUserRatings(ratings) {
    if (ratings.length === 0) {
        userRatingsDiv.innerHTML = '<p class="placeholder-text">No ratings found. Search for movies to rate them.</p>';
        return;
    }
    
    let html = '';
    ratings.forEach(movie => {
        html += `
            <div class="movie-card">
                <img src="${movie.poster || 'https://via.placeholder.com/300x450?text=No+Poster'}" alt="${movie.title}" class="movie-poster">
                <div class="movie-info">
                    <div class="movie-title">${movie.title}</div>
                    <div class="movie-year">${movie.year || 'N/A'}</div>
                    <div class="movie-rating">${movie.rating}/10</div>
                    <button class="rate-button ripple" onclick="openRatingModal('${movie.imdbId}', '${movie.title.replace(/'/g, "\\'")}', '${movie.year}', '${movie.poster}')">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                </div>
            </div>
        `;
    });
    
    userRatingsDiv.innerHTML = html;
    
    // Re-add ripple effect to new buttons
    addRippleEffect();
}

async function fetchUserProducts() {
    try {
        showLoading(userProductsDiv);
        const response = await fetch(`${API_BASE_URL}/tracker/user/${currentUserId}`);
        
        if (!response.ok) {
            throw new Error('Failed to fetch tracked products');
        }
        
        const products = await response.json();
        displayUserProducts(products);
    } catch (error) {
        console.error('Error:', error);
        userProductsDiv.innerHTML = `<p class="error-message">${error.message}</p>`;
    }
}

function displayUserProducts(products) {
    if (products.length === 0) {
        userProductsDiv.innerHTML = '<p class="placeholder-text">No tracked products found. Add some using the + button.</p>';
        return;
    }
    
    let html = '';
    products.forEach(product => {
        html += `
            <div class="product-item">
                <div class="product-info">
                    <div class="product-name">${product.productName}</div>
                    <div class="product-category">${product.category || 'No category'}</div>
                </div>
                <div class="product-price">$${product.price ? product.price.toFixed(2) : 'N/A'}</div>
                <div class="product-link">
                    ${product.url ? `<a href="#" onclick="openExternalLink('${product.url}'); return false;">
                        <span class="material-symbols-outlined">open_in_new</span>
                    </a>` : ''}
                </div>
            </div>
        `;
    });
    
    userProductsDiv.innerHTML = html;
}

function openExternalLink(url) {
    // Use Telegram's openLink method to safely open external URLs
    tgApp.openLink(url);
}

async function searchMovies() {
    const query = searchQueryInput.value.trim();
    if (!query) {
        showToast('Please enter a search query');
        tgApp.HapticFeedback.notificationOccurred('error');
        return;
    }
    
    try {
        showLoading(searchResultsDiv);
        const response = await fetch(`${API_BASE_URL}/ratings/search/${query}`);
        
        if (!response.ok) {
            throw new Error('Failed to search movies');
        }
        
        const results = await response.json();
        displaySearchResults(results);
        tgApp.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error('Error:', error);
        searchResultsDiv.innerHTML = `<p class="error-message">${error.message}</p>`;
        tgApp.HapticFeedback.notificationOccurred('error');
    }
}

function displaySearchResults(results) {
    if (!results || results.length === 0) {
        searchResultsDiv.innerHTML = '<p class="placeholder-text">No results found. Try a different search.</p>';
        return;
    }
    
    let html = '';
    results.forEach(movie => {
        html += `
            <div class="movie-card">
                <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster'}" alt="${movie.Title}" class="movie-poster">
                <div class="movie-info">
                    <div class="movie-title">${movie.Title}</div>
                    <div class="movie-year">${movie.Year}</div>
                    <button class="rate-button ripple" onclick="openRatingModal('${movie.imdbID}', '${movie.Title.replace(/'/g, "\\'")}', '${movie.Year}', '${movie.Poster}')">
                        <span class="material-symbols-outlined">star</span>
                        Rate
                    </button>
                </div>
            </div>
        `;
    });
    
    searchResultsDiv.innerHTML = html;
    
    // Re-add ripple effect to new buttons
    addRippleEffect();
}

// Rating modal functions
function openRatingModal(imdbId, title, year, poster) {
    if (!currentUserId) {
        showToast('User ID not available');
        return;
    }
    
    selectedImdbId = imdbId;
    
    // Check if poster is 'N/A' or undefined
    const posterUrl = (poster && poster !== 'N/A') ? poster : 'https://via.placeholder.com/120x180?text=No+Poster';
    
    movieInfoDiv.innerHTML = `
        <img src="${posterUrl}" alt="${title}">
        <div class="movie-details">
            <h4>${title}</h4>
            <p>${year}</p>
        </div>
    `;
    
    // Reset star rating to 5 by default
    currentRating = 5;
    ratingValueDisplay.textContent = '5/10';
    document.getElementById('star5').checked = true;
    
    ratingModal.style.display = 'block';
    tgApp.HapticFeedback.impactOccurred('medium');
}

function openProductModal() {
    if (!currentUserId) {
        showToast('User ID not available');
        return;
    }
    
    // Reset form
    addProductForm.reset();
    
    productModal.style.display = 'block';
    tgApp.HapticFeedback.impactOccurred('medium');
}

async function submitRating() {
    try {
        tgApp.HapticFeedback.impactOccurred('medium');
        
        const response = await fetch(`${API_BASE_URL}/ratings/add/${currentUserId}_${selectedImdbId}_${currentRating}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to add rating');
        }
        
        // Close modal and refresh user ratings
        ratingModal.style.display = 'none';
        await fetchUserRatings();
        
        // Show success message
        showToast('Rating submitted successfully!');
        tgApp.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error('Error:', error);
        showToast(`Error: ${error.message}`);
        tgApp.HapticFeedback.notificationOccurred('error');
    }
}

async function addProduct(e) {
    e.preventDefault();
    
    if (!currentUserId) {
        showToast('User ID not available');
        return;
    }
    
    const productData = {
        userId: currentUserId,
        productId: document.getElementById('productId').value,
        productName: document.getElementById('productName').value,
        category: document.getElementById('category').value,
        price: document.getElementById('price').value ? parseFloat(document.getElementById('price').value) : null,
        url: document.getElementById('url').value
    };
    
    try {
        tgApp.HapticFeedback.impactOccurred('medium');
        
        const response = await fetch(`${API_BASE_URL}/tracker/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(productData)
        });
        
        if (!response.ok) {
            throw new Error('Failed to add product');
        }
        
        // Reset form and close modal
        addProductForm.reset();
        productModal.style.display = 'none';
        
        // Refresh user products
        await fetchUserProducts();
        
        // Show success message
        showToast('Product added successfully!');
        tgApp.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error('Error:', error);
        showToast(`Error: ${error.message}`);
        tgApp.HapticFeedback.notificationOccurred('error');
    }
}

// Weather function (mock implementation - would need actual API)
async function getWeather() {
    const city = cityInput.value.trim();
    if (!city) {
        showToast('Please enter a city name');
        tgApp.HapticFeedback.notificationOccurred('warning');
        return;
    }
    
    showLoading(weatherResultDiv);
    tgApp.HapticFeedback.impactOccurred('light');
    
    // This is a mock implementation - in a real app, you would call a weather API
    try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock weather data
        const mockWeathers = {
            'new york': { temp: 12, condition: 'Cloudy', humidity: 65, wind: 10 },
            'los angeles': { temp: 24, condition: 'Sunny', humidity: 45, wind: 5 },
            'chicago': { temp: 8, condition: 'Windy', humidity: 55, wind: 25 },
            'london': { temp: 11, condition: 'Rainy', humidity: 80, wind: 15 },
            'tokyo': { temp: 18, condition: 'Clear', humidity: 50, wind: 8 },
            'paris': { temp: 15, condition: 'Partly Cloudy', humidity: 60, wind: 12 }
        };
        
        const cityLower = city.toLowerCase();
        const weatherData = mockWeathers[cityLower] || {
            temp: Math.floor(Math.random() * 30),
            condition: ['Sunny', 'Cloudy', 'Rainy', 'Snowy', 'Windy'][Math.floor(Math.random() * 5)],
            humidity: Math.floor(Math.random() * 100),
            wind: Math.floor(Math.random() * 30)
        };
        
        weatherResultDiv.innerHTML = `
            <div class="weather-details">
                <h3>${city.charAt(0).toUpperCase() + city.slice(1)}</h3>
                <div class="weather-main">
                    <span class="material-symbols-outlined weather-icon">
                        ${getWeatherIcon(weatherData.condition)}
                    </span>
                    <div class="temperature">${weatherData.temp}°C</div>
                </div>
                <div class="weather-condition">${weatherData.condition}</div>
                <div class="weather-info">
                    <div class="humidity">
                        <span class="material-symbols-outlined">water_drop</span>
                        ${weatherData.humidity}%
                    </div>
                    <div class="wind">
                        <span class="material-symbols-outlined">air</span>
                        ${weatherData.wind} km/h
                    </div>
                </div>
            </div>
        `;
        
        tgApp.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error('Error:', error);
        weatherResultDiv.innerHTML = `<p class="error-message">Failed to get weather data</p>`;
        tgApp.HapticFeedback.notificationOccurred('error');
    }
}

function getWeatherIcon(condition) {
    switch (condition.toLowerCase()) {
        case 'sunny': return 'wb_sunny';
        case 'clear': return 'clear_day';
        case 'cloudy': return 'cloud';
        case 'partly cloudy': return 'partly_cloudy_day';
        case 'rainy': return 'rainy';
        case 'snowy': return 'weather_snowy';
        case 'windy': return 'air';
        default: return 'cloud';
    }
}

// Currency function (mock implementation - would need actual API)
async function convertCurrency() {
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount)) {
        showToast('Please enter a valid amount');
        tgApp.HapticFeedback.notificationOccurred('warning');
        return;
    }
    
    const fromCurrency = fromCurrencySelect.value;
    const toCurrency = toCurrencySelect.value;
    
    showLoading(conversionResultDiv);
    tgApp.HapticFeedback.impactOccurred('light');
    
    // This is a mock implementation - in a real app, you would call a currency API
    try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mock exchange rates (relative to USD)
        const rates = {
            USD: 1.0,
            EUR: 0.93,
            GBP: 0.79,
            JPY: 153.82,
            CAD: 1.35
        };
        
        // Convert to USD first, then to target currency
        const usdAmount = amount / rates[fromCurrency];
        const convertedAmount = usdAmount * rates[toCurrency];
        
        conversionResultDiv.innerHTML = `
            <div class="conversion-details">
                <h3 class="conversion-result-value">${amount.toFixed(2)} ${fromCurrency} = ${convertedAmount.toFixed(2)} ${toCurrency}</h3>
                <p class="conversion-rate">1 ${fromCurrency} = ${(rates[toCurrency] / rates[fromCurrency]).toFixed(4)} ${toCurrency}</p>
                <p class="conversion-time">Updated: ${new Date().toLocaleTimeString()}</p>
            </div>
        `;
        
        tgApp.HapticFeedback.notificationOccurred('success');
    } catch (error) {
        console.error('Error:', error);
        conversionResultDiv.innerHTML = `<p class="error-message">Failed to convert currency</p>`;
        tgApp.HapticFeedback.notificationOccurred('error');
    }
}

// Helper functions
function showLoading(element) {
    element.innerHTML = '<div class="loading"></div>';
}

function showToast(message) {
    // Remove any existing toasts
    document.querySelectorAll('.toast').forEach(t => t.remove());
    
    const toast = document.createElement('div');
    toast.classList.add('toast');
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function addRippleEffect() {
    document.querySelectorAll('.ripple:not(.ripple-initialized)').forEach(button => {
        button.classList.add('ripple-initialized');
        button.addEventListener('mousedown', function(e) {
            const x = e.pageX - this.offsetLeft;
            const y = e.pageY - this.offsetTop;
            
            const rippleElement = document.createElement('span');
            rippleElement.classList.add('ripple-effect');
            rippleElement.style.left = `${x}px`;
            rippleElement.style.top = `${y}px`;
            
            this.appendChild(rippleElement);
            
            setTimeout(() => {
                rippleElement.remove();
            }, 600);
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    // Add ripple effect styling
    const style = document.createElement('style');
    style.textContent = `
        .ripple-effect {
            position: absolute;
            border-radius: 50%;
            background-color: rgba(255, 255, 255, 0.3);
            width: 100px;
            height: 100px;
            margin-top: -50px;
            margin-left: -50px;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        }
        
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Initialize star rating system
    const ratingInputs = document.querySelectorAll('input[name="rating"]');
    ratingInputs.forEach(input => {
        input.addEventListener('change', function() {
            currentRating = this.value;
            ratingValueDisplay.textContent = `${currentRating}/10`;
        });
    });
    
    // Set default rating
    document.getElementById('star5').checked = true;
    
    // Display user info from Telegram
    displayUserInfo();
    
    // Load user data automatically
    loadUserData();
    
    // Add ripple effect to all buttons with the ripple class
    addRippleEffect();
    
    // Tell Telegram that the web app is ready
    tgApp.ready();
});

// Make functions accessible globally
window.openRatingModal = openRatingModal;
window.openProductModal = openProductModal;
window.openExternalLink = openExternalLink;