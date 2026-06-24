// ===== Firebase Config =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, push, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyB9xbxS4TTADWrs1oxT5ZbImiK0rtOgHpc",
    authDomain: "one-to-ten-92b88.firebaseapp.com",
    databaseURL: "https://one-to-ten-92b88-default-rtdb.firebaseio.com",
    projectId: "one-to-ten-92b88",
    storageBucket: "one-to-ten-92b88.firebasestorage.app",
    messagingSenderId: "529395513518",
    appId: "1:529395513518:web:5832a4804f09a0d78b953f",
    measurementId: "G-R9Y96743YQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const reviewsRef = ref(db, 'reviews');

// ===== State =====
let allReviews = {};
let currentView = 'all';
let searchQuery = '';
let sortBy = 'dateReviewed';

// ===== DOM Elements =====
const mainContent = document.getElementById('mainContent');
const modalOverlay = document.getElementById('modalOverlay');
const reviewForm = document.getElementById('reviewForm');
const addReviewBtn = document.getElementById('addReviewBtn');
const modalClose = document.getElementById('modalClose');
const cancelBtn = document.getElementById('cancelBtn');
const modalTitle = document.getElementById('modalTitle');
const scoreSlider = document.getElementById('reviewScore');
const scoreDisplay = document.getElementById('scoreDisplay');
const navTabs = document.getElementById('navTabs');
const toast = document.getElementById('toast');

// ===== Type Config =====
const TYPE_CONFIG = {
    movie: { icon: '🎬', label: 'Movie' },
    tvshow: { icon: '📺', label: 'TV Show' },
    videogame: { icon: '🎮', label: 'Video Game' },
    boardgame: { icon: '🎲', label: 'Board Game' },
    book: { icon: '📚', label: 'Book' }
};

const SOURCE_LABELS = {
    imdb: 'IMDb',
    tvdb: 'TVDB',
    bgg: 'BoardGameGeek',
    igdb: 'IGDB',
    steam: 'Steam',
    goodreads: 'Goodreads',
    openlibrary: 'OpenLibrary',
    other: 'Link'
};

// ===== Router =====
function getRoute() {
    const hash = window.location.hash || '#/';
    const parts = hash.replace('#/', '').split('/');
    return { path: parts[0] || 'all', param: parts[1] || null };
}

function navigate(hash) {
    window.location.hash = hash;
}

window.addEventListener('hashchange', handleRoute);

function handleRoute() {
    const route = getRoute();

    if (route.path === 'review' && route.param) {
        renderSingleReview(route.param);
    } else if (route.path === 'add') {
        openModal();
    } else if (route.path === 'edit' && route.param) {
        openModal(route.param);
    } else {
        currentView = route.path || 'all';
        updateActiveTab();
        renderReviewList();
    }
}

function updateActiveTab() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        const type = tab.dataset.type;
        tab.classList.toggle('active', type === currentView);
    });
}

// ===== Firebase Listeners =====
onValue(reviewsRef, (snapshot) => {
    allReviews = snapshot.val() || {};
    handleRoute();
});

// ===== Render: Review List =====
function renderReviewList() {
    let reviews = Object.entries(allReviews).map(([id, data]) => ({ id, ...data }));

    // Filter by type
    if (currentView !== 'all') {
        const typeMap = {
            movies: 'movie',
            tvshows: 'tvshow',
            videogames: 'videogame',
            boardgames: 'boardgame',
            books: 'book'
        };
        const filterType = typeMap[currentView] || currentView;
        reviews = reviews.filter(r => r.type === filterType);
    }

    // Filter by search
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        reviews = reviews.filter(r =>
            r.title.toLowerCase().includes(q) ||
            (r.tags && r.tags.some(t => t.toLowerCase().includes(q)))
        );
    }

    // Sort
    reviews.sort((a, b) => {
        switch (sortBy) {
            case 'score': return (b.score || 0) - (a.score || 0);
            case 'title': return (a.title || '').localeCompare(b.title || '');
            case 'dateConsumed': return (b.dateConsumed || '').localeCompare(a.dateConsumed || '');
            default: return (b.createdAt || 0) - (a.createdAt || 0);
        }
    });

    const typeName = currentView === 'all' ? 'All Reviews' :
        TYPE_CONFIG[currentView]?.label + 's' ||
        currentView.charAt(0).toUpperCase() + currentView.slice(1);

    mainContent.innerHTML = `
        <div class="reviews-header">
            <h1>${typeName} (${reviews.length})</h1>
            <div class="reviews-controls">
                <input type="text" class="search-input" id="searchInput" 
                    placeholder="Search..." value="${escapeHtml(searchQuery)}">
                <select class="sort-select" id="sortSelect">
                    <option value="dateReviewed" ${sortBy === 'dateReviewed' ? 'selected' : ''}>Newest</option>
                    <option value="score" ${sortBy === 'score' ? 'selected' : ''}>Score</option>
                    <option value="title" ${sortBy === 'title' ? 'selected' : ''}>Title</option>
                    <option value="dateConsumed" ${sortBy === 'dateConsumed' ? 'selected' : ''}>Date Consumed</option>
                </select>
            </div>
        </div>
        ${reviews.length === 0 ? renderEmptyState() : `
            <div class="review-grid">
                ${reviews.map(renderCard).join('')}
            </div>
        `}
    `;

    // Attach event listeners
    document.getElementById('searchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderReviewList();
    });
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        sortBy = e.target.value;
        renderReviewList();
    });

    // Card click handlers
    document.querySelectorAll('.review-card').forEach(card => {
        card.addEventListener('click', () => {
            navigate(`#/review/${card.dataset.id}`);
        });
    });
}

function renderCard(review) {
    const config = TYPE_CONFIG[review.type] || { icon: '❓', label: 'Unknown' };
    const imageHtml = review.imageUrl
        ? `<img class="card-image" src="${escapeHtml(review.imageUrl)}" alt="${escapeHtml(review.title)}" loading="lazy">`
        : `<div class="card-image-placeholder">${config.icon}</div>`;

    return `
        <div class="review-card" data-id="${review.id}">
            ${imageHtml}
            <div class="card-body">
                <div class="card-top">
                    <div>
                        <div class="card-title">${escapeHtml(review.title)}</div>
                        <div class="card-meta">
                            <span class="card-type-badge">${config.icon} ${config.label}</span>
                            ${review.status ? `<span class="card-status ${review.status}">${formatStatus(review.status)}</span>` : ''}
                        </div>
                    </div>
                    <div class="score-badge score-${review.score}">${review.score}</div>
                </div>
                ${review.dateConsumed ? `<div class="card-meta" style="margin-top: 0.5rem;">${formatDate(review.dateConsumed)}</div>` : ''}
            </div>
        </div>
    `;
}

function renderEmptyState() {
    return `
        <div class="empty-state">
            <div class="empty-state-icon">🎯</div>
            <h2>No reviews yet</h2>
            <p>Add your first review using the button above.</p>
        </div>
    `;
}

// ===== Render: Single Review =====
function renderSingleReview(id) {
    const review = allReviews[id];
    if (!review) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <h2>Review not found</h2>
                <p>This review may have been deleted.</p>
                <a href="#/" class="btn btn-primary">Back to Reviews</a>
            </div>
        `;
        return;
    }

    const config = TYPE_CONFIG[review.type] || { icon: '❓', label: 'Unknown' };
    const imageHtml = review.imageUrl
        ? `<img class="review-detail-image" src="${escapeHtml(review.imageUrl)}" alt="${escapeHtml(review.title)}">`
        : `<div class="review-detail-image-placeholder">${config.icon}</div>`;

    const shareUrl = `${window.location.origin}${window.location.pathname}#/review/${id}`;

    mainContent.innerHTML = `
        <div class="review-detail">
            <a href="#/" class="review-detail-back">← Back to Reviews</a>
            
            <div class="review-detail-header">
                ${imageHtml}
                <div class="review-detail-info">
                    <h1 class="review-detail-title">${escapeHtml(review.title)}</h1>
                    <div class="review-detail-meta">
                        <span class="card-type-badge">${config.icon} ${config.label}</span>
                        ${review.status ? `<span class="card-status ${review.status}">${formatStatus(review.status)}</span>` : ''}
                        ${review.dateConsumed ? `<span>Consumed: ${formatDate(review.dateConsumed)}</span>` : ''}
                    </div>
                    <div class="score-badge review-detail-score score-${review.score}">${review.score}</div>
                </div>
            </div>

            ${review.review ? `
                <div class="review-detail-section">
                    <h3>Review</h3>
                    <div class="review-text ${review.reviewLang === 'fa' ? 'review-text-fa' : ''}">${escapeHtml(review.review)}</div>
                </div>
            ` : ''}

            ${review.meta && Object.keys(review.meta).length > 0 ? `
                <div class="review-detail-section">
                    <h3>Details</h3>
                    <div class="review-detail-meta-list">
                        ${Object.entries(review.meta).map(([key, val]) => `<span class="meta-item"><strong>${formatMetaLabel(key)}:</strong> ${escapeHtml(val)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}

            ${review.externalUrl ? `
                <div class="review-detail-section">
                    <h3>External Link</h3>
                    <a href="${escapeHtml(review.externalUrl)}" target="_blank" rel="noopener noreferrer" class="review-detail-link">
                        🔗 View on ${SOURCE_LABELS[review.externalSource] || 'External Site'}
                    </a>
                </div>
            ` : ''}

            ${review.tags && review.tags.length > 0 ? `
                <div class="review-detail-section">
                    <h3>Tags</h3>
                    <div class="review-detail-tags">
                        ${review.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="review-detail-actions">
                <button class="btn btn-secondary" onclick="copyShareLink('${id}')">📋 Copy Link</button>
                <button class="btn btn-primary" onclick="openModal('${id}')">✏️ Edit</button>
                <button class="btn btn-danger" onclick="deleteReview('${id}')">🗑️ Delete</button>
            </div>
        </div>
    `;
}

// ===== Modal =====
// ===== Type-Specific Fields =====
const TYPE_FIELDS = {
    movie: [
        { id: 'director', label: 'Director', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'studio', label: 'Studio / Company', type: 'text' }
    ],
    tvshow: [
        { id: 'creator', label: 'Creator', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'network', label: 'Network / Platform', type: 'text' },
        { id: 'seasons', label: 'Seasons', type: 'number' },
        { id: 'episodes', label: 'Episodes', type: 'number' }
    ],
    videogame: [
        { id: 'developer', label: 'Developer', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'platform', label: 'Platform', type: 'text' }
    ],
    boardgame: [
        { id: 'designer', label: 'Designer', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'playerCount', label: 'Player Count', type: 'text' }
    ],
    book: [
        { id: 'author', label: 'Author', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'translator', label: 'Translator (if any)', type: 'text' },
        { id: 'format', label: 'Format', type: 'select', options: ['Physical', 'eBook', 'Audiobook'] }
    ]
};

function renderTypeFields(type, data = {}) {
    const container = document.getElementById('typeSpecificFields');
    const fields = TYPE_FIELDS[type];
    if (!fields) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div class="form-row type-fields-row">
        ${fields.map(f => {
            if (f.type === 'select') {
                return `<div class="form-group">
                    <label for="field_${f.id}">${f.label}</label>
                    <select id="field_${f.id}">
                        <option value="">Select...</option>
                        ${f.options.map(o => `<option value="${o}" ${data[f.id] === o ? 'selected' : ''}>${o}</option>`).join('')}
                    </select>
                </div>`;
            }
            return `<div class="form-group">
                <label for="field_${f.id}">${f.label}</label>
                <input type="${f.type}" id="field_${f.id}" value="${escapeHtml(data[f.id] || '')}" placeholder="${f.label}">
            </div>`;
        }).join('')}
    </div>`;
}

function getTypeFieldValues(type) {
    const fields = TYPE_FIELDS[type];
    if (!fields) return {};
    const values = {};
    fields.forEach(f => {
        const el = document.getElementById(`field_${f.id}`);
        if (el && el.value.trim()) values[f.id] = el.value.trim();
    });
    return values;
}

function openModal(editId = null) {
    modalOverlay.classList.add('active');
    reviewForm.reset();
    document.getElementById('reviewId').value = '';
    document.getElementById('typeSpecificFields').innerHTML = '';
    scoreDisplay.textContent = '5';
    scoreSlider.value = 5;

    if (editId && allReviews[editId]) {
        const review = allReviews[editId];
        modalTitle.textContent = 'Edit Review';
        document.getElementById('reviewId').value = editId;
        document.getElementById('reviewType').value = review.type || '';
        document.getElementById('reviewStatus').value = review.status || 'completed';
        document.getElementById('reviewTitle').value = review.title || '';
        scoreSlider.value = review.score || 5;
        scoreDisplay.textContent = review.score || 5;
        document.getElementById('reviewLang').value = review.reviewLang || 'en';
        document.getElementById('reviewText').value = review.review || '';
        updateReviewTextDirection();
        document.getElementById('externalUrl').value = review.externalUrl || '';
        document.getElementById('externalSource').value = review.externalSource || '';
        document.getElementById('imageUrl').value = review.imageUrl || '';
        document.getElementById('dateConsumed').value = review.dateConsumed || '';
        document.getElementById('reviewTags').value = (review.tags || []).join(', ');
        renderTypeFields(review.type, review.meta || {});
    } else {
        modalTitle.textContent = 'Add Review';
    }
}

function closeModal() {
    modalOverlay.classList.remove('active');
    // If we navigated to #/add or #/edit, go back
    const route = getRoute();
    if (route.path === 'add' || route.path === 'edit') {
        navigate('#/');
    }
}

// ===== Form Submit =====
reviewForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const id = document.getElementById('reviewId').value;
    const tagsRaw = document.getElementById('reviewTags').value;
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];

    const externalUrl = document.getElementById('externalUrl').value.trim();
    let externalSource = document.getElementById('externalSource').value;

    // Auto-detect source from URL
    if (externalUrl && !externalSource) {
        externalSource = detectSource(externalUrl);
    }

    const type = document.getElementById('reviewType').value;
    const reviewData = {
        type: type,
        status: document.getElementById('reviewStatus').value,
        title: document.getElementById('reviewTitle').value.trim(),
        score: parseInt(scoreSlider.value),
        review: document.getElementById('reviewText').value.trim(),
        reviewLang: document.getElementById('reviewLang').value,
        externalUrl: externalUrl,
        externalSource: externalSource,
        imageUrl: document.getElementById('imageUrl').value.trim(),
        dateConsumed: document.getElementById('dateConsumed').value,
        dateReviewed: new Date().toISOString().split('T')[0],
        tags: tags,
        meta: getTypeFieldValues(type),
        updatedAt: Date.now()
    };

    if (id) {
        // Update existing
        update(ref(db, `reviews/${id}`), reviewData);
        showToast('Review updated!');
    } else {
        // Create new
        reviewData.createdAt = Date.now();
        const newRef = push(reviewsRef);
        set(newRef, reviewData);
        showToast('Review added!');
    }

    closeModal();
});

// ===== Delete =====
function deleteReview(id) {
    if (confirm('Are you sure you want to delete this review?')) {
        remove(ref(db, `reviews/${id}`));
        showToast('Review deleted');
        navigate('#/');
    }
}

// ===== Share =====
function copyShareLink(id) {
    const url = `${window.location.origin}${window.location.pathname}#/review/${id}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
    }).catch(() => {
        // Fallback
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Link copied!');
    });
}

// ===== Helpers =====
function detectSource(url) {
    if (url.includes('imdb.com')) return 'imdb';
    if (url.includes('thetvdb.com')) return 'tvdb';
    if (url.includes('boardgamegeek.com')) return 'bgg';
    if (url.includes('igdb.com')) return 'igdb';
    if (url.includes('store.steampowered.com')) return 'steam';
    if (url.includes('goodreads.com')) return 'goodreads';
    if (url.includes('openlibrary.org')) return 'openlibrary';
    return 'other';
}

function formatStatus(status) {
    switch (status) {
        case 'completed': return 'Completed';
        case 'in-progress': return 'In Progress';
        case 'dropped': return 'Dropped';
        default: return status;
    }
}

function formatMetaLabel(key) {
    const labels = {
        director: 'Director', creator: 'Creator', year: 'Year',
        studio: 'Studio', network: 'Network', seasons: 'Seasons', episodes: 'Episodes',
        developer: 'Developer', platform: 'Platform',
        designer: 'Designer', playerCount: 'Players',
        author: 'Author', translator: 'Translator', format: 'Format'
    };
    return labels[key] || key;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== Event Listeners =====
addReviewBtn.addEventListener('click', () => openModal());
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

scoreSlider.addEventListener('input', () => {
    scoreDisplay.textContent = scoreSlider.value;
});

// Type change → render type-specific fields
document.getElementById('reviewType').addEventListener('change', (e) => {
    renderTypeFields(e.target.value);
});

// Language change → update textarea direction
document.getElementById('reviewLang').addEventListener('change', updateReviewTextDirection);

function updateReviewTextDirection() {
    const lang = document.getElementById('reviewLang').value;
    const textarea = document.getElementById('reviewText');
    if (lang === 'fa') {
        textarea.dir = 'rtl';
        textarea.classList.add('rtl-input');
        textarea.placeholder = 'بررسی خود را بنویسید...';
    } else {
        textarea.dir = 'ltr';
        textarea.classList.remove('rtl-input');
        textarea.placeholder = 'Write your review...';
    }
}

// ===== Init =====
handleRoute();
