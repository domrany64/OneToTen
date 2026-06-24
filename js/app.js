// ===== Firebase Config =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, push, set, update, remove, onValue } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

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
const auth = getAuth(app);
const reviewsRef = ref(db, 'reviews');

// ===== Auth State =====
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthUI();
    handleRoute(); // re-render to show/hide edit buttons
});

function updateAuthUI() {
    const addBtn = document.getElementById('addReviewBtn');
    const authBtn = document.getElementById('authBtn');
    if (currentUser) {
        addBtn.style.display = '';
        authBtn.textContent = 'Logout';
        authBtn.onclick = () => signOut(auth);
    } else {
        addBtn.style.display = 'none';
        authBtn.textContent = 'Login';
        authBtn.onclick = showLoginModal;
    }
}

function showLoginModal() {
    const overlay = document.getElementById('loginOverlay');
    overlay.classList.add('active');
}

function hideLoginModal() {
    const overlay = document.getElementById('loginOverlay');
    overlay.classList.remove('active');
    document.getElementById('loginError').textContent = '';
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            hideLoginModal();
            showToast('Logged in!');
        })
        .catch((err) => {
            errorEl.textContent = 'Invalid email or password';
        });
}

function isLoggedIn() {
    return currentUser !== null;
}

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
    wikipedia: 'Wikipedia',
    other: 'Link'
};

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([val, label]) =>
    `<option value="${val}">${label}</option>`
).join('');

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

            ${(() => {
                let links = review.externalLinks || [];
                if (links.length === 0 && review.externalUrl) {
                    links = [{ url: review.externalUrl, source: review.externalSource || 'other' }];
                }
                if (links.length === 0) return '';
                return `<div class="review-detail-section">
                    <h3>External Links</h3>
                    ${links.map(l => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="review-detail-link">
                        🔗 ${SOURCE_LABELS[l.source] || 'Link'}
                    </a>`).join('')}
                </div>`;
            })()}

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
                ${isLoggedIn() ? `
                    <button class="btn btn-primary" onclick="openModal('${id}')">✏️ Edit</button>
                    <button class="btn btn-danger" onclick="deleteReview('${id}')">🗑️ Delete</button>
                ` : ''}
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
        { id: 'format', label: 'Format', type: 'select', options: ['Physical', 'eBook', 'Audiobook'] },
        { id: 'narrator', label: 'Narrator / Reader', type: 'text' },
        { id: 'publisher', label: 'Audiobook Publisher', type: 'text' }
    ]
};

function renderTypeFields(type, data = {}) {
    const container = document.getElementById('typeSpecificFields');
    const fields = TYPE_FIELDS[type];
    if (!fields) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `<div class="type-fields-grid">
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
            if (f.id === 'year') {
                return `<div class="form-group">
                    <label for="field_${f.id}">${f.label}</label>
                    <div class="year-input-wrapper">
                        <input type="number" id="field_${f.id}" value="${escapeHtml(data[f.id] || '')}" placeholder="e.g. 2024 or 1403">
                        <button type="button" class="btn btn-secondary btn-sm year-toggle" onclick="toggleYearCalendar('field_${f.id}')" title="Convert Shamsi ↔ Gregorian">🔄</button>
                    </div>
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

// ===== Multi External Links =====
let linkCounter = 0;

function addLinkRow(url = '', source = '') {
    const container = document.getElementById('externalLinksContainer');
    const idx = linkCounter++;
    if (!source && url) source = detectSource(url);
    const row = document.createElement('div');
    row.className = 'link-row';
    row.dataset.idx = idx;
    row.innerHTML = `
        <input type="url" class="link-url" placeholder="https://..." value="${escapeHtml(url)}">
        <select class="link-source">
            <option value="">Auto-detect</option>
            ${SOURCE_OPTIONS}
        </select>
        <button type="button" class="btn btn-danger btn-sm link-remove" onclick="removeLinkRow(${idx})">✕</button>
    `;
    container.appendChild(row);
    if (source) row.querySelector('.link-source').value = source;
}

function removeLinkRow(idx) {
    const row = document.querySelector(`.link-row[data-idx="${idx}"]`);
    if (row) row.remove();
}

function getExternalLinks() {
    const rows = document.querySelectorAll('.link-row');
    const links = [];
    rows.forEach(row => {
        const url = row.querySelector('.link-url').value.trim();
        if (!url) return;
        let source = row.querySelector('.link-source').value;
        if (!source) source = detectSource(url);
        links.push({ url, source });
    });
    return links;
}

function renderLinksInForm(links) {
    const container = document.getElementById('externalLinksContainer');
    container.innerHTML = '';
    linkCounter = 0;
    if (links && links.length > 0) {
        links.forEach(l => addLinkRow(l.url, l.source));
    } else {
        addLinkRow(); // start with one empty row
    }
}

// ===== Persian (Jalali) / Gregorian Year Conversion =====
function gregorianToJalali(gy) {
    // Approximate: only converts year (assumes March 21 as new year)
    if (gy <= 621) return gy;
    return gy - 621;
}

function jalaliToGregorian(jy) {
    return jy + 621;
}

function isJalaliYear(year) {
    // Jalali years are typically < 1500, Gregorian > 1500
    return year < 1500;
}

function toggleYearCalendar(fieldId) {
    const input = document.getElementById(fieldId);
    const val = parseInt(input.value);
    if (!val) return;
    if (isJalaliYear(val)) {
        input.value = jalaliToGregorian(val);
        showToast(`Converted: ${val} شمسی → ${input.value} AD`);
    } else {
        const jalali = gregorianToJalali(val);
        input.value = jalali;
        showToast(`Converted: ${val} AD → ${jalali} شمسی`);
    }
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
        // Migrate old single-link to multi-link format
        let links = review.externalLinks || [];
        if (links.length === 0 && review.externalUrl) {
            links = [{ url: review.externalUrl, source: review.externalSource || '' }];
        }
        renderLinksInForm(links);
        document.getElementById('imageUrl').value = review.imageUrl || '';
        document.getElementById('dateConsumed').value = review.dateConsumed || '';
        document.getElementById('reviewTags').value = (review.tags || []).join(', ');
        renderTypeFields(review.type, review.meta || {});
    } else {
        modalTitle.textContent = 'Add Review';
        renderLinksInForm([]);
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

    const externalLinks = getExternalLinks();

    const type = document.getElementById('reviewType').value;
    const reviewData = {
        type: type,
        status: document.getElementById('reviewStatus').value,
        title: document.getElementById('reviewTitle').value.trim(),
        score: parseInt(scoreSlider.value),
        review: document.getElementById('reviewText').value.trim(),
        reviewLang: document.getElementById('reviewLang').value,
        externalLinks: externalLinks,
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
    if (url.includes('wikipedia.org')) return 'wikipedia';
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
        author: 'Author', translator: 'Translator', format: 'Format',
        narrator: 'Narrator', publisher: 'Publisher'
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

// Add Link button
document.getElementById('addLinkBtn').addEventListener('click', () => addLinkRow());

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

// ===== Expose functions for inline onclick handlers =====
window.openModal = openModal;
window.deleteReview = deleteReview;
window.copyShareLink = copyShareLink;
window.handleLogin = handleLogin;
window.hideLoginModal = hideLoginModal;
window.removeLinkRow = removeLinkRow;
window.toggleYearCalendar = toggleYearCalendar;

// ===== Init =====
handleRoute();
