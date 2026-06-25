// ===== Firebase Config =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getDatabase, ref, push, set, update, remove, onValue, get } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-database.js";
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
let reviewsRef = null;
let reviewsListener = null;

// ===== Auth State =====
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateAuthUI();
    setupReviewsListener();
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
let filterScore = '';
let filterTag = '';
let filterStatus = '';
let filterCreator = '';
let filterYearFrom = '';
let filterYearTo = '';
let bulkMode = false;
let selectedIds = new Set();

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
    epic: 'Epic Games',
    gog: 'GOG',
    ubisoft: 'Ubisoft',
    xbox: 'Xbox',
    playstation: 'PlayStation',
    goodreads: 'Goodreads',
    openlibrary: 'OpenLibrary',
    iranketab: 'IranKetab',
    wikipedia: 'Wikipedia',
    other: 'Link'
};

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([val, label]) =>
    `<option value="${val}">${label}</option>`
).join('');

const TYPE_SOURCES = {
    movie: ['imdb', 'wikipedia', 'other'],
    tvshow: ['imdb', 'tvdb', 'wikipedia', 'other'],
    videogame: ['steam', 'epic', 'gog', 'ubisoft', 'xbox', 'playstation', 'igdb', 'wikipedia', 'other'],
    boardgame: ['bgg', 'wikipedia', 'other'],
    book: ['goodreads', 'openlibrary', 'iranketab', 'wikipedia', 'other']
};

function getSourceOptionsForType(type) {
    const sources = TYPE_SOURCES[type];
    if (!sources) return SOURCE_OPTIONS;
    return sources.map(val =>
        `<option value="${val}">${SOURCE_LABELS[val] || val}</option>`
    ).join('');
}

// ===== Router =====
function getRoute() {
    const hash = window.location.hash || '#/';
    const parts = hash.replace('#/', '').split('/');
    return { path: parts[0] || 'all', param: parts[1] || null, param2: parts[2] || null };
}

function navigate(hash) {
    window.location.hash = hash;
}

window.addEventListener('hashchange', handleRoute);

function handleRoute() {
    const route = getRoute();

    if (route.path === 'review' && route.param) {
        // Support both #/review/{uid}/{id} and legacy #/review/{id}
        if (route.param2) {
            renderSingleReview(route.param2, route.param); // uid, id
        } else {
            // Legacy link or own review
            renderSingleReview(route.param, currentUser ? currentUser.uid : null);
        }
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
function setupReviewsListener() {
    // Detach old listener
    if (reviewsListener) {
        reviewsListener();
        reviewsListener = null;
    }
    if (!currentUser) {
        allReviews = {};
        reviewsRef = null;
        handleRoute();
        return;
    }
    reviewsRef = ref(db, `reviews/${currentUser.uid}`);
    reviewsListener = onValue(reviewsRef, (snapshot) => {
        allReviews = snapshot.val() || {};
        handleRoute();
    });
}

// ===== Creator Filter Helpers =====
function getCreatorFieldsForView() {
    const typeMap = { movies: 'movie', tvshows: 'tvshow', videogames: 'videogame', boardgames: 'boardgame', books: 'book' };
    const view = typeMap[currentView] || currentView;
    switch (view) {
        case 'movie':
        case 'tvshow':
            return ['director', 'creator', 'actors'];
        case 'videogame':
            return ['developer'];
        case 'boardgame':
            return ['designer'];
        case 'book':
            return ['author', 'narrator'];
        default: // 'all'
            return ['author', 'narrator', 'director', 'creator', 'actors', 'designer', 'developer'];
    }
}

function getCreatorLabel() {
    const typeMap = { movies: 'movie', tvshows: 'tvshow', videogames: 'videogame', boardgames: 'boardgame', books: 'book' };
    const view = typeMap[currentView] || currentView;
    switch (view) {
        case 'movie':
        case 'tvshow':
            return 'Director / Actor';
        case 'videogame':
            return 'Developer';
        case 'boardgame':
            return 'Designer';
        case 'book':
            return 'Author / Narrator';
        default:
            return null; // hide on All page
    }
}

function shouldShowReviewInCreatorList(r) {
    const typeMap = { movies: 'movie', tvshows: 'tvshow', videogames: 'videogame', boardgames: 'boardgame', books: 'book' };
    const view = typeMap[currentView] || currentView;
    if (view === 'all') return true;
    return r.type === view;
}

// ===== Combobox Helper =====
function setupCombobox(inputId, dropdownId, options, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    function showDropdown(filter) {
        const query = filter.toLowerCase();
        const filtered = query
            ? options.filter(o => o.toLowerCase().includes(query))
            : options;
        if (filtered.length === 0) {
            dropdown.innerHTML = '';
            dropdown.classList.remove('open');
            return;
        }
        dropdown.innerHTML = filtered.map(o =>
            `<div class="combobox-option" data-value="${escapeHtml(o)}">${escapeHtml(o)}</div>`
        ).join('');
        dropdown.classList.add('open');

        dropdown.querySelectorAll('.combobox-option').forEach(opt => {
            opt.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = opt.dataset.value;
                dropdown.classList.remove('open');
                onSelect(opt.dataset.value);
            });
        });
    }

    input.addEventListener('focus', () => showDropdown(input.value));
    input.addEventListener('input', () => showDropdown(input.value));
    input.addEventListener('blur', () => {
        setTimeout(() => dropdown.classList.remove('open'), 150);
    });

    // Allow clearing by emptying the field
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            dropdown.classList.remove('open');
            onSelect(input.value);
        }
        if (e.key === 'Escape') {
            dropdown.classList.remove('open');
            input.blur();
        }
    });
    // Clear filter if input is cleared
    input.addEventListener('change', () => {
        if (!input.value) onSelect('');
    });
}

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

    // Filter by search (title, tags, meta values)
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        reviews = reviews.filter(r =>
            r.title.toLowerCase().includes(q) ||
            (r.tags && r.tags.some(t => t.toLowerCase().includes(q))) ||
            (r.meta && Object.values(r.meta).some(v => String(v).toLowerCase().includes(q)))
        );
    }

    // Filter by score range
    if (filterScore) {
        if (filterScore === '10') {
            reviews = reviews.filter(r => r.score === 10);
        } else {
            const [min, max] = filterScore.split('-').map(Number);
            reviews = reviews.filter(r => r.score >= min && r.score <= max);
        }
    }

    // Filter by tag
    if (filterTag) {
        const ft = filterTag.toLowerCase();
        reviews = reviews.filter(r => r.tags && r.tags.some(t => t.toLowerCase() === ft));
    }

    // Filter by status
    if (filterStatus) {
        reviews = reviews.filter(r => r.status === filterStatus);
    }

    // Filter by creator (context-specific)
    if (filterCreator) {
        const fc = filterCreator.toLowerCase();
        reviews = reviews.filter(r => {
            if (!r.meta) return false;
            const fields = getCreatorFieldsForView();
            return fields.some(field => r.meta[field] && r.meta[field].toLowerCase().includes(fc));
        });
    }

    // Filter by year range
    if (filterYearFrom) {
        reviews = reviews.filter(r => r.meta && r.meta.year && parseInt(r.meta.year) >= parseInt(filterYearFrom));
    }
    if (filterYearTo) {
        reviews = reviews.filter(r => r.meta && r.meta.year && parseInt(r.meta.year) <= parseInt(filterYearTo));
    }

    // Sort
    reviews.sort((a, b) => {
        switch (sortBy) {
            case 'score': return (b.score || 0) - (a.score || 0);
            case 'scoreLow': return (a.score || 0) - (b.score || 0);
            case 'title': return (a.title || '').localeCompare(b.title || '');
            case 'dateConsumed': return (b.dateConsumed || '').localeCompare(a.dateConsumed || '');
            default: return (b.createdAt || 0) - (a.createdAt || 0);
        }
    });

    // Collect all tags and creators for filter dropdowns (context-specific)
    const allTags = new Set();
    const allCreators = new Set();
    const creatorFields = getCreatorFieldsForView();
    Object.values(allReviews).forEach(r => {
        if (r.tags) r.tags.forEach(t => allTags.add(t));
        if (r.meta && shouldShowReviewInCreatorList(r)) {
            creatorFields.forEach(field => {
                if (r.meta[field]) {
                    r.meta[field].split(',').forEach(v => {
                        const trimmed = v.trim();
                        if (trimmed) allCreators.add(trimmed);
                    });
                }
            });
        }
    });

    const typeName = currentView === 'all' ? 'All Reviews' :
        (TYPE_CONFIG[currentView]?.label ? TYPE_CONFIG[currentView].label + 's' :
        currentView.charAt(0).toUpperCase() + currentView.slice(1));

    const hasActiveFilters = filterScore || filterTag || filterStatus || filterCreator || filterYearFrom || filterYearTo;
    const creatorLabel = getCreatorLabel();
    const tagOptions = [...allTags].sort();
    const creatorOptions = [...allCreators].sort();

    mainContent.innerHTML = `
        <div class="list-layout">
            <aside class="sidebar">
                <div class="sidebar-section">
                    <h3>Sort</h3>
                    <select class="sidebar-select" id="sortSelect">
                        <option value="dateReviewed" ${sortBy === 'dateReviewed' ? 'selected' : ''}>Newest First</option>
                        <option value="score" ${sortBy === 'score' ? 'selected' : ''}>Highest Score</option>
                        <option value="scoreLow" ${sortBy === 'scoreLow' ? 'selected' : ''}>Lowest Score</option>
                        <option value="title" ${sortBy === 'title' ? 'selected' : ''}>Title A–Z</option>
                        <option value="dateConsumed" ${sortBy === 'dateConsumed' ? 'selected' : ''}>Date Consumed</option>
                    </select>
                </div>
                <div class="sidebar-section">
                    <h3>Score</h3>
                    <select class="sidebar-select" id="filterScoreSelect">
                        <option value="">All</option>
                        <option value="10" ${filterScore === '10' ? 'selected' : ''}>10 ⭐</option>
                        <option value="8-9" ${filterScore === '8-9' ? 'selected' : ''}>8–9</option>
                        <option value="6-7" ${filterScore === '6-7' ? 'selected' : ''}>6–7</option>
                        <option value="4-5" ${filterScore === '4-5' ? 'selected' : ''}>4–5</option>
                        <option value="1-3" ${filterScore === '1-3' ? 'selected' : ''}>1–3</option>
                    </select>
                </div>
                <div class="sidebar-section">
                    <h3>Status</h3>
                    <select class="sidebar-select" id="filterStatusSelect">
                        <option value="">All</option>
                        <option value="completed" ${filterStatus === 'completed' ? 'selected' : ''}>Completed</option>
                        <option value="in-progress" ${filterStatus === 'in-progress' ? 'selected' : ''}>In Progress</option>
                        <option value="dropped" ${filterStatus === 'dropped' ? 'selected' : ''}>Dropped</option>
                        <option value="playing" ${filterStatus === 'playing' ? 'selected' : ''}>Playing</option>
                        <option value="abandoned" ${filterStatus === 'abandoned' ? 'selected' : ''}>Abandoned</option>
                        <option value="avoid" ${filterStatus === 'avoid' ? 'selected' : ''}>Avoid</option>
                    </select>
                </div>
                <div class="sidebar-section">
                    <h3>Year</h3>
                    <div class="sidebar-year-range">
                        <input type="number" class="sidebar-input" id="filterYearFrom" placeholder="From" value="${filterYearFrom}">
                        <span class="sidebar-year-sep">–</span>
                        <input type="number" class="sidebar-input" id="filterYearTo" placeholder="To" value="${filterYearTo}">
                    </div>
                </div>
                ${tagOptions.length > 0 ? `
                    <div class="sidebar-section">
                        <h3>Tag</h3>
                        <div class="combobox" id="tagCombobox">
                            <input type="text" class="sidebar-input" id="filterTagInput" placeholder="Type to filter..." value="${escapeHtml(filterTag)}" autocomplete="off">
                            <div class="combobox-dropdown" id="tagDropdown"></div>
                        </div>
                    </div>
                ` : ''}
                ${creatorLabel && creatorOptions.length > 0 ? `
                    <div class="sidebar-section">
                        <h3>${creatorLabel}</h3>
                        <div class="combobox" id="creatorCombobox">
                            <input type="text" class="sidebar-input" id="filterCreatorInput" placeholder="Type to filter..." value="${escapeHtml(filterCreator)}" autocomplete="off">
                            <div class="combobox-dropdown" id="creatorDropdown"></div>
                        </div>
                    </div>
                ` : ''}
                ${hasActiveFilters ? `
                    <button class="btn btn-secondary btn-sm" id="clearFiltersBtn" style="margin-top: 0.75rem; width: 100%;">Clear Filters</button>
                ` : ''}
            </aside>
            <div class="list-content">
                <div class="reviews-header">
                    <h1>${typeName} (${reviews.length})</h1>
                    <div class="reviews-header-actions">
                        ${isLoggedIn() ? `<button class="btn btn-secondary btn-sm" id="bulkToggleBtn">${bulkMode ? 'Cancel' : 'Select'}</button>` : ''}
                        <input type="text" class="search-input" id="searchInput" 
                            placeholder="Search title, author, tag..." value="${escapeHtml(searchQuery)}">
                    </div>
                </div>
                ${bulkMode ? `
                    <div class="bulk-actions-bar">
                        <label class="bulk-select-all"><input type="checkbox" id="bulkSelectAll"> Select All (${reviews.length})</label>
                        <span class="bulk-count" id="bulkCount">${selectedIds.size} selected</span>
                        <button class="btn btn-primary btn-sm" id="bulkModifyBtn" disabled>Modify</button>
                        <button class="btn btn-danger btn-sm" id="bulkDeleteBtn" disabled>Delete</button>
                    </div>
                ` : ''}
                ${reviews.length === 0 ? renderEmptyState() : `
                    <div class="review-grid">
                        ${reviews.map(r => renderCard(r, bulkMode)).join('')}
                    </div>
                `}
            </div>
        </div>
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
    document.getElementById('filterScoreSelect').addEventListener('change', (e) => {
        filterScore = e.target.value;
        renderReviewList();
    });
    document.getElementById('filterStatusSelect').addEventListener('change', (e) => {
        filterStatus = e.target.value;
        renderReviewList();
    });

    // Year range filters
    const yearFromInput = document.getElementById('filterYearFrom');
    const yearToInput = document.getElementById('filterYearTo');
    yearFromInput.addEventListener('change', (e) => {
        filterYearFrom = e.target.value;
        renderReviewList();
    });
    yearToInput.addEventListener('change', (e) => {
        filterYearTo = e.target.value;
        renderReviewList();
    });

    // Searchable tag combobox
    setupCombobox('filterTagInput', 'tagDropdown', tagOptions, (val) => {
        filterTag = val;
        renderReviewList();
    });

    // Searchable creator combobox
    setupCombobox('filterCreatorInput', 'creatorDropdown', creatorOptions, (val) => {
        filterCreator = val;
        renderReviewList();
    });

    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            filterScore = '';
            filterTag = '';
            filterStatus = '';
            filterCreator = '';
            filterYearFrom = '';
            filterYearTo = '';
            renderReviewList();
        });
    }

    // Card click handlers
    document.querySelectorAll('.review-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (bulkMode) {
                e.stopPropagation();
                const id = card.dataset.id;
                if (selectedIds.has(id)) selectedIds.delete(id);
                else selectedIds.add(id);
                renderReviewList();
                return;
            }
            navigate(`#/review/${card.dataset.id}`);
        });
    });

    // Bulk checkboxes
    document.querySelectorAll('.bulk-checkbox').forEach(cb => {
        cb.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = cb.dataset.id;
            if (cb.checked) selectedIds.add(id);
            else selectedIds.delete(id);
            updateBulkUI();
        });
    });

    // Bulk toggle button
    const bulkToggleBtn = document.getElementById('bulkToggleBtn');
    if (bulkToggleBtn) {
        bulkToggleBtn.addEventListener('click', () => {
            bulkMode = !bulkMode;
            selectedIds.clear();
            renderReviewList();
        });
    }

    // Bulk select all
    const selectAllCb = document.getElementById('bulkSelectAll');
    if (selectAllCb) {
        selectAllCb.addEventListener('change', () => {
            const allCards = document.querySelectorAll('.review-card');
            if (selectAllCb.checked) {
                allCards.forEach(c => selectedIds.add(c.dataset.id));
            } else {
                selectedIds.clear();
            }
            renderReviewList();
        });
    }

    // Bulk modify
    const bulkModifyBtn = document.getElementById('bulkModifyBtn');
    if (bulkModifyBtn) {
        bulkModifyBtn.addEventListener('click', showBulkModifyModal);
    }

    // Bulk delete
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', bulkDelete);
    }

    updateBulkUI();
}

function renderCard(review, showCheckbox = false) {
    const config = TYPE_CONFIG[review.type] || { icon: '❓', label: 'Unknown' };
    const imageHtml = review.imageUrl
        ? `<img class="card-image" src="${escapeHtml(review.imageUrl)}" alt="${escapeHtml(review.title)}" loading="lazy">`
        : `<div class="card-image-placeholder">${config.icon}</div>`;

    return `
        <div class="review-card ${showCheckbox ? 'bulk-selectable' : ''} ${selectedIds.has(review.id) ? 'bulk-selected' : ''}" data-id="${review.id}">
            ${showCheckbox ? `<input type="checkbox" class="bulk-checkbox" data-id="${review.id}" ${selectedIds.has(review.id) ? 'checked' : ''}>` : ''}
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

// ===== Bulk Actions =====
function updateBulkUI() {
    const countEl = document.getElementById('bulkCount');
    const modBtn = document.getElementById('bulkModifyBtn');
    const delBtn = document.getElementById('bulkDeleteBtn');
    if (countEl) countEl.textContent = `${selectedIds.size} selected`;
    if (modBtn) modBtn.disabled = selectedIds.size === 0;
    if (delBtn) delBtn.disabled = selectedIds.size === 0;
}

async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} reviews? This cannot be undone.`)) return;

    let deleted = 0;
    for (const id of selectedIds) {
        try {
            await remove(ref(db, `reviews/${currentUser.uid}/${id}`));
            deleted++;
        } catch (e) {
            console.error('Delete failed:', id, e);
        }
    }
    showToast(`Deleted ${deleted} reviews`);
    selectedIds.clear();
    bulkMode = false;
}

function showBulkModifyModal() {
    if (selectedIds.size === 0) return;
    const overlay = document.getElementById('bulkModifyOverlay');
    overlay.classList.add('active');
    document.getElementById('bulkModifyCount').textContent = selectedIds.size;
}

function hideBulkModifyModal() {
    document.getElementById('bulkModifyOverlay').classList.remove('active');
}

async function applyBulkModify() {
    const field = document.getElementById('bulkField').value;
    const value = document.getElementById('bulkValue').value.trim();
    if (!field) { showToast('Select a field'); return; }

    const updates = {};
    for (const id of selectedIds) {
        if (field === 'score') {
            updates[`reviews/${currentUser.uid}/${id}/score`] = parseInt(value) || 0;
        } else if (field === 'status') {
            updates[`reviews/${currentUser.uid}/${id}/status`] = value;
        } else if (field === 'tags') {
            updates[`reviews/${currentUser.uid}/${id}/tags`] = value.split(',').map(t => t.trim()).filter(Boolean);
        } else {
            // meta fields
            updates[`reviews/${currentUser.uid}/${id}/meta/${field}`] = value;
        }
    }

    try {
        await update(ref(db), updates);
        showToast(`Updated ${selectedIds.size} reviews`);
        hideBulkModifyModal();
        selectedIds.clear();
        bulkMode = false;
    } catch (e) {
        showToast('Error: ' + e.message);
    }
}

// ===== Render: Single Review =====
async function renderSingleReview(id, uid = null) {
    let review = null;
    const isOwnReview = uid && currentUser && uid === currentUser.uid;

    if (!uid || isOwnReview) {
        // Local data
        review = allReviews[id];
    } else {
        // Fetch from another user's data
        try {
            const snap = await get(ref(db, `reviews/${uid}/${id}`));
            review = snap.val();
        } catch (e) {
            review = null;
        }
    }

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

    const shareUid = uid || (currentUser ? currentUser.uid : '');
    const shareUrl = `${window.location.origin}${window.location.pathname}#/review/${shareUid}/${id}`;

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
                        ${getOrderedMeta(review).map(({key, val}) => {
                            if (key === 'year') {
                                return `<div class="meta-item">${formatYearDisplay(val)}</div>`;
                            }
                            return `<div class="meta-item"><strong>${formatMetaLabel(key)}:</strong> ${escapeHtml(val)}</div>`;
                        }).join('')}
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
                ${isOwnReview || (!uid && isLoggedIn()) ? `
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
        { id: 'director', label: 'Director(s)', type: 'text' },
        { id: 'actors', label: 'Actor(s)', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'studio', label: 'Studio / Company', type: 'text' }
    ],
    tvshow: [
        { id: 'creator', label: 'Creator(s)', type: 'text' },
        { id: 'actors', label: 'Actor(s)', type: 'text' },
        { id: 'year', label: 'Year (e.g. 2021-2024)', type: 'text' },
        { id: 'network', label: 'Network / Platform', type: 'text' },
        { id: 'showStatus', label: 'Show Status', type: 'select', options: ['Ongoing', 'Completed', 'Canceled'] },
        { id: 'seasons', label: 'Seasons', type: 'number' },
        { id: 'episodes', label: 'Episodes', type: 'number' },
        { id: 'lastWatched', label: 'Last Watched (e.g. S02E05)', type: 'text' }
    ],
    videogame: [
        { id: 'developer', label: 'Developer(s)', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'platform', label: 'Platform(s)', type: 'text' }
    ],
    boardgame: [
        { id: 'designer', label: 'Designer(s)', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'playerCount', label: 'Player Count', type: 'text' }
    ],
    book: [
        { id: 'author', label: 'Author(s)', type: 'text' },
        { id: 'year', label: 'Year', type: 'number' },
        { id: 'translator', label: 'Translator(s)', type: 'text' },
        { id: 'format', label: 'Format', type: 'select', options: ['Physical', 'eBook', 'Audiobook'] },
        { id: 'narrator', label: 'Narrator(s)', type: 'text' },
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
                const yearVal = data[f.id] || '';
                const yearNum = parseInt(yearVal);
                const calLabel = yearNum ? (isJalaliYear(yearNum) ? '☀️ شمسی' : '📅 AD') : '';
                const inputType = f.type === 'text' ? 'text' : 'number';
                const placeholder = f.type === 'text' ? 'e.g. 2021-2024 or 1400-1403' : 'e.g. 2024 or 1403';
                return `<div class="form-group">
                    <label for="field_${f.id}">${f.label}</label>
                    <div class="year-input-wrapper">
                        <input type="${inputType}" id="field_${f.id}" value="${escapeHtml(yearVal)}" placeholder="${placeholder}">
                        <span class="year-cal-label" id="yearCalLabel_${f.id}">${calLabel}</span>
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

    // Attach year input listener for live calendar label update
    const yearInput = document.getElementById('field_year');
    if (yearInput) {
        yearInput.addEventListener('input', () => updateYearCalLabel('field_year'));
    }
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
    const currentType = document.getElementById('reviewType')?.value || '';
    const options = getSourceOptionsForType(currentType);
    const row = document.createElement('div');
    row.className = 'link-row';
    row.dataset.idx = idx;
    row.draggable = true;
    row.innerHTML = `
        <span class="link-drag-handle" title="Drag to reorder">⠿</span>
        <input type="url" class="link-url" placeholder="https://..." value="${escapeHtml(url)}">
        <select class="link-source">
            <option value="">Auto-detect</option>
            ${options}
        </select>
        <button type="button" class="btn btn-danger btn-sm link-remove" onclick="removeLinkRow(${idx})">✕</button>
    `;
    container.appendChild(row);
    if (source) row.querySelector('.link-source').value = source;
    setupLinkDrag(row);
}

function removeLinkRow(idx) {
    const row = document.querySelector(`.link-row[data-idx="${idx}"]`);
    if (row) row.remove();
}

let draggedLinkRow = null;

function setupLinkDrag(row) {
    const handle = row.querySelector('.link-drag-handle');

    // Only start drag from the handle
    handle.addEventListener('mousedown', () => { row.draggable = true; });
    row.addEventListener('mousedown', (e) => {
        if (!e.target.classList.contains('link-drag-handle')) row.draggable = false;
    });

    row.addEventListener('dragstart', (e) => {
        draggedLinkRow = row;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        draggedLinkRow = null;
        document.querySelectorAll('.link-row.drag-over').forEach(r => r.classList.remove('drag-over'));
    });

    row.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (draggedLinkRow && draggedLinkRow !== row) {
            e.dataTransfer.dropEffect = 'move';
            row.classList.add('drag-over');
        }
    });

    row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
    });

    row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        if (draggedLinkRow && draggedLinkRow !== row) {
            const container = document.getElementById('externalLinksContainer');
            const rows = [...container.querySelectorAll('.link-row')];
            const fromIdx = rows.indexOf(draggedLinkRow);
            const toIdx = rows.indexOf(row);
            if (fromIdx < toIdx) {
                row.after(draggedLinkRow);
            } else {
                row.before(draggedLinkRow);
            }
        }
    });
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
    const raw = input.value.trim();
    if (!raw) return;

    // Handle year ranges like "2021-2024" or "2021-"
    if (raw.includes('-')) {
        const parts = raw.split('-');
        const start = parseInt(parts[0]);
        const end = parts[1] ? parseInt(parts[1]) : null;
        if (!start) return;
        if (isJalaliYear(start)) {
            const convStart = jalaliToGregorian(start);
            const convEnd = end ? jalaliToGregorian(end) : '';
            input.value = `${convStart}-${convEnd}`;
            showToast(`Converted: ${raw} شمسی → ${input.value} AD`);
        } else {
            const convStart = gregorianToJalali(start);
            const convEnd = end ? gregorianToJalali(end) : '';
            input.value = `${convStart}-${convEnd}`;
            showToast(`Converted: ${raw} AD → ${input.value} شمسی`);
        }
    } else {
        const val = parseInt(raw);
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
    updateYearCalLabel(fieldId);
}

function updateYearCalLabel(fieldId) {
    const input = document.getElementById(fieldId);
    const label = document.getElementById(`yearCalLabel_${fieldId.replace('field_', '')}`);
    if (!label) return;
    const val = parseInt(input.value);
    if (!val) { label.textContent = ''; return; }
    label.textContent = isJalaliYear(val) ? '☀️ شمسی' : '📅 AD';
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
        updateStatusOptions(review.type || '', review.status || 'completed');
        document.getElementById('reviewStatus').value = review.status || 'completed';
        document.getElementById('reviewTitle').value = review.title || '';
        scoreSlider.value = review.score != null ? review.score : 5;
        scoreDisplay.textContent = review.score != null ? review.score : 5;
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
        update(ref(db, `reviews/${currentUser.uid}/${id}`), reviewData);
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
        remove(ref(db, `reviews/${currentUser.uid}/${id}`));
        showToast('Review deleted');
        navigate('#/');
    }
}

// ===== Share =====
function copyShareLink(id) {
    const uid = currentUser ? currentUser.uid : '';
    const url = `${window.location.origin}${window.location.pathname}#/review/${uid}/${id}`;
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
    if (url.includes('store.steampowered.com') || url.includes('steampowered.com')) return 'steam';
    if (url.includes('epicgames.com') || url.includes('store.epicgames.com')) return 'epic';
    if (url.includes('gog.com')) return 'gog';
    if (url.includes('ubisoft.com') || url.includes('store.ubi.com')) return 'ubisoft';
    if (url.includes('xbox.com') || url.includes('microsoft.com/store')) return 'xbox';
    if (url.includes('playstation.com') || url.includes('store.playstation.com')) return 'playstation';
    if (url.includes('goodreads.com')) return 'goodreads';
    if (url.includes('openlibrary.org')) return 'openlibrary';
    if (url.includes('iranketab.ir')) return 'iranketab';
    if (url.includes('wikipedia.org')) return 'wikipedia';
    return 'other';
}

function formatStatus(status) {
    switch (status) {
        case 'completed': return 'Completed';
        case 'in-progress': return 'In Progress';
        case 'dropped': return 'Dropped';
        case 'playing': return 'Playing';
        case 'abandoned': return 'Abandoned';
        case 'avoid': return 'Avoid';
        default: return status;
    }
}

function updateStatusOptions(type, currentStatus) {
    const statusSelect = document.getElementById('reviewStatus');
    if (!statusSelect) return;
    let options;
    if (type === 'boardgame') {
        options = [
            { value: 'playing', label: 'Playing' },
            { value: 'abandoned', label: 'Abandoned' },
            { value: 'avoid', label: 'Avoid' }
        ];
    } else {
        options = [
            { value: 'completed', label: 'Completed' },
            { value: 'in-progress', label: 'In Progress' },
            { value: 'dropped', label: 'Dropped' },
            { value: 'avoid', label: 'Avoid' }
        ];
    }
    statusSelect.innerHTML = options.map(o =>
        `<option value="${o.value}" ${currentStatus === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');
}

function formatMetaLabel(key) {
    const labels = {
        director: 'Director', creator: 'Creator', actors: 'Actors', year: 'Year',
        studio: 'Studio', network: 'Network', seasons: 'Seasons', episodes: 'Episodes',
        showStatus: 'Show Status', lastWatched: 'Last Watched',
        developer: 'Developer', platform: 'Platform',
        designer: 'Designer', playerCount: 'Players',
        author: 'Author', translator: 'Translator', format: 'Format',
        narrator: 'Narrator', publisher: 'Publisher'
    };
    return labels[key] || key;
}

function getOrderedMeta(review) {
    const fields = TYPE_FIELDS[review.type];
    if (!fields) {
        return Object.entries(review.meta).map(([key, val]) => ({ key, val }));
    }
    const ordered = [];
    const fieldIds = fields.map(f => f.id);
    // Add fields in TYPE_FIELDS order
    fieldIds.forEach(id => {
        if (review.meta[id] != null && review.meta[id] !== '') {
            ordered.push({ key: id, val: String(review.meta[id]) });
        }
    });
    // Add any extra meta keys not in TYPE_FIELDS
    Object.entries(review.meta).forEach(([key, val]) => {
        if (!fieldIds.includes(key) && val != null && val !== '') {
            ordered.push({ key, val: String(val) });
        }
    });
    return ordered;
}

function formatYearDisplay(val) {
    // Handle year ranges like "2021-2024" or "2021-"
    const parts = String(val).split('-').map(s => s.trim());
    if (parts.length === 1) {
        // Single year
        const yearNum = parseInt(parts[0]);
        if (!yearNum) return `<strong>Year:</strong> ${escapeHtml(val)}`;
        const calType = isJalaliYear(yearNum) ? '☀️ شمسی' : '📅 AD';
        const converted = isJalaliYear(yearNum)
            ? `${jalaliToGregorian(yearNum)} AD`
            : `${gregorianToJalali(yearNum)} شمسی`;
        return `<strong>Year:</strong> ${escapeHtml(val)} <span class="year-cal-badge">${calType}</span> <span class="year-converted">(${converted})</span>`;
    }
    // Year range
    const startYear = parseInt(parts[0]);
    const endYear = parts[1] ? parseInt(parts[1]) : null;
    if (!startYear) return `<strong>Year:</strong> ${escapeHtml(val)}`;
    const startCal = isJalaliYear(startYear) ? 'شمسی' : 'AD';
    let display = `<strong>Year:</strong> ${escapeHtml(val)} <span class="year-cal-badge">${startCal === 'شمسی' ? '☀️ شمسی' : '📅 AD'}</span>`;
    // Show conversion
    if (startCal === 'شمسی') {
        const convStart = jalaliToGregorian(startYear);
        const convEnd = endYear ? jalaliToGregorian(endYear) : '';
        display += ` <span class="year-converted">(${convStart}${convEnd ? '-' + convEnd : '-'} AD)</span>`;
    } else {
        const convStart = gregorianToJalali(startYear);
        const convEnd = endYear ? gregorianToJalali(endYear) : '';
        display += ` <span class="year-converted">(${convStart}${convEnd ? '-' + convEnd : '-'} شمسی)</span>`;
    }
    return display;
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
// Clicking outside the modal no longer closes it to prevent accidental data loss

scoreSlider.addEventListener('input', () => {
    scoreDisplay.textContent = scoreSlider.value;
});

// Type change → render type-specific fields
document.getElementById('reviewType').addEventListener('change', (e) => {
    renderTypeFields(e.target.value);
    updateStatusOptions(e.target.value, document.getElementById('reviewStatus').value);
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
window.hideBulkModifyModal = hideBulkModifyModal;
window.applyBulkModify = applyBulkModify;

// ===== Init =====
handleRoute();
