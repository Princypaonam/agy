// Application State
let state = {
    feedTitle: "BigQuery Release Notes",
    entries: [],
    filters: {
        searchQuery: "",
        category: "All",
        sortOrder: "desc"
    },
    counts: {
        All: 0,
        Feature: 0,
        Issue: 0,
        Deprecation: 0,
        Announcement: 0
    },
    activeTweetData: null
};

// DOM Elements
const refreshBtn = document.getElementById("refresh-btn");
const refreshIcon = document.getElementById("refresh-icon");
const retryBtn = document.getElementById("retry-btn");
const resetFiltersBtn = document.getElementById("reset-filters-btn");
const searchInput = document.getElementById("search-input");
const clearSearchBtn = document.getElementById("clear-search");
const sortOrderBtn = document.getElementById("sort-order-btn");
const categoryFiltersContainer = document.getElementById("category-filters");
const skeletonLoader = document.getElementById("skeleton-loader");
const feedContainer = document.getElementById("feed-container");
const emptyState = document.getElementById("empty-state");
const errorState = document.getElementById("error-state");
const errorMessage = document.getElementById("error-message");

// Stats counters
const statTotal = document.getElementById("stat-total");
const statFeatures = document.getElementById("stat-features");
const statIssues = document.getElementById("stat-issues");
const statDeprecations = document.getElementById("stat-deprecations");

// Modal Elements
const tweetModal = document.getElementById("tweet-modal");
const tweetTextarea = document.getElementById("tweet-textarea");
const charCounter = document.getElementById("char-counter");
const tweetWarning = document.getElementById("tweet-warning");
const cancelTweetBtn = document.getElementById("cancel-tweet-btn");
const submitTweetBtn = document.getElementById("submit-tweet-btn");
const closeModalBtn = document.getElementById("close-modal-btn");
const tweetContextDate = document.getElementById("tweet-context-date");
const tweetContextBadge = document.getElementById("tweet-context-badge");
const tweetContextDesc = document.getElementById("tweet-context-desc");

// Init application
document.addEventListener("DOMContentLoaded", () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Events
function setupEventListeners() {
    refreshBtn.addEventListener("click", fetchReleaseNotes);
    retryBtn.addEventListener("click", fetchReleaseNotes);
    resetFiltersBtn.addEventListener("click", resetFilters);
    
    // Search input
    searchInput.addEventListener("input", (e) => {
        state.filters.searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = state.filters.searchQuery ? "block" : "none";
        renderFeed();
    });
    
    clearSearchBtn.addEventListener("click", () => {
        searchInput.value = "";
        state.filters.searchQuery = "";
        clearSearchBtn.style.display = "none";
        searchInput.focus();
        renderFeed();
    });
    
    // Sort toggle
    sortOrderBtn.addEventListener("click", () => {
        const currentOrder = sortOrderBtn.getAttribute("data-order");
        const newOrder = currentOrder === "desc" ? "asc" : "desc";
        sortOrderBtn.setAttribute("data-order", newOrder);
        sortOrderBtn.querySelector("span").textContent = newOrder === "desc" ? "Newest First" : "Oldest First";
        state.filters.sortOrder = newOrder;
        renderFeed();
    });
    
    // Category filters (sidebar clicks)
    categoryFiltersContainer.addEventListener("click", (e) => {
        const button = e.target.closest(".filter-btn");
        if (!button) return;
        
        document.querySelectorAll(".filter-btn").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        
        state.filters.category = button.getAttribute("data-category");
        renderFeed();
    });

    // Stats card quick filters
    document.querySelectorAll(".stat-card").forEach(card => {
        card.addEventListener("click", () => {
            const filterType = card.getAttribute("data-filter");
            
            // Sync with sidebar filter buttons
            document.querySelectorAll(".filter-btn").forEach(btn => {
                if (btn.getAttribute("data-category") === filterType) {
                    btn.classList.add("active");
                } else {
                    btn.classList.remove("active");
                }
            });
            
            state.filters.category = filterType;
            renderFeed();
            
            // Smooth scroll to feed controls on mobile
            document.querySelector(".controls-panel").scrollIntoView({ behavior: 'smooth' });
        });
    });

    // Tweet Modal actions
    closeModalBtn.addEventListener("click", closeTweetModal);
    cancelTweetBtn.addEventListener("click", closeTweetModal);
    tweetModal.addEventListener("click", (e) => {
        if (e.target === tweetModal) closeTweetModal();
    });
    
    tweetTextarea.addEventListener("input", updateTweetCharCount);
    
    submitTweetBtn.addEventListener("click", publishTweet);
}

// Reset filters
function resetFilters() {
    searchInput.value = "";
    state.filters.searchQuery = "";
    clearSearchBtn.style.display = "none";
    state.filters.category = "All";
    state.filters.sortOrder = "desc";
    
    sortOrderBtn.setAttribute("data-order", "desc");
    sortOrderBtn.querySelector("span").textContent = "Newest First";
    
    document.querySelectorAll(".filter-btn").forEach(btn => {
        if (btn.getAttribute("data-category") === "All") {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });
    
    renderFeed();
}

// Fetch notes
function fetchReleaseNotes() {
    showLoading(true);
    
    fetch('/api/release-notes')
        .then(response => {
            if (!response.ok) {
                throw new Error("HTTP error " + response.status);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            
            state.feedTitle = data.feed_title;
            state.entries = data.entries;
            
            // Calculate global statistics
            calculateStats();
            
            showLoading(false);
            renderFeed();
        })
        .catch(err => {
            console.error("Fetch failed:", err);
            errorMessage.textContent = err.message || "Failed to load release notes. Please verify internet connection.";
            showLoading(false);
            showError(true);
        });
}

// Show/Hide sections
function showLoading(isLoading) {
    if (isLoading) {
        skeletonLoader.style.display = "block";
        feedContainer.style.display = "none";
        emptyState.style.display = "none";
        errorState.style.display = "none";
        refreshBtn.classList.add("loading");
        refreshBtn.disabled = true;
    } else {
        skeletonLoader.style.display = "none";
        refreshBtn.classList.remove("loading");
        refreshBtn.disabled = false;
    }
}

function showError(isError) {
    if (isError) {
        errorState.style.display = "block";
        feedContainer.style.display = "none";
        emptyState.style.display = "none";
        skeletonLoader.style.display = "none";
    } else {
        errorState.style.display = "none";
    }
}

// Compute counts of categories
function calculateStats() {
    // Reset
    state.counts = { All: 0, Feature: 0, Issue: 0, Deprecation: 0, Announcement: 0 };
    
    state.entries.forEach(entry => {
        entry.updates.forEach(update => {
            state.counts.All++;
            
            const type = update.type;
            if (state.counts.hasOwnProperty(type)) {
                state.counts[type]++;
            } else {
                // If it's a category not pre-defined, check close matches or default
                if (type.toLowerCase().includes("feature")) state.counts.Feature++;
                else if (type.toLowerCase().includes("issue") || type.toLowerCase().includes("bug")) state.counts.Issue++;
                else if (type.toLowerCase().includes("deprecat")) state.counts.Deprecation++;
                else if (type.toLowerCase().includes("announc")) state.counts.Announcement++;
                else {
                    // Accumulate others under All
                }
            }
        });
    });
    
    // Update top dashboard counters
    statTotal.textContent = state.counts.All;
    statFeatures.textContent = state.counts.Feature;
    statIssues.textContent = state.counts.Issue;
    statDeprecations.textContent = state.counts.Deprecation;
    
    // Update sidebar categories badges
    document.querySelectorAll(".filter-btn").forEach(btn => {
        const cat = btn.getAttribute("data-category");
        if (state.counts.hasOwnProperty(cat)) {
            btn.setAttribute("data-count", state.counts[cat]);
        } else {
            btn.setAttribute("data-count", 0);
        }
    });
}

// Render the main updates feed
function renderFeed() {
    showError(false);
    
    const { searchQuery, category, sortOrder } = state.filters;
    
    // Filter and reconstruct groups
    let filteredEntries = [];
    
    state.entries.forEach(entry => {
        // Filter updates inside the entry
        const matchedUpdates = entry.updates.filter(update => {
            // Category check
            const matchesCategory = category === "All" || 
                update.type.toLowerCase() === category.toLowerCase() ||
                (category === "Feature" && update.type.toLowerCase().includes("feature")) ||
                (category === "Issue" && (update.type.toLowerCase().includes("issue") || update.type.toLowerCase().includes("bug"))) ||
                (category === "Deprecation" && update.type.toLowerCase().includes("deprecat")) ||
                (category === "Announcement" && update.type.toLowerCase().includes("announc"));
                
            if (!matchesCategory) return false;
            
            // Search text check
            if (searchQuery) {
                const searchStr = `${entry.date} ${update.type} ${update.description_text}`.toLowerCase();
                return searchStr.includes(searchQuery);
            }
            
            return true;
        });
        
        if (matchedUpdates.length > 0) {
            filteredEntries.push({
                ...entry,
                updates: matchedUpdates
            });
        }
    });
    
    // Sort entries by timestamp
    filteredEntries.sort((a, b) => {
        if (sortOrder === "asc") {
            return a.timestamp - b.timestamp;
        } else {
            return b.timestamp - a.timestamp;
        }
    });
    
    // Check if empty
    if (filteredEntries.length === 0) {
        feedContainer.style.display = "none";
        emptyState.style.display = "block";
        return;
    }
    
    emptyState.style.display = "none";
    feedContainer.style.display = "block";
    feedContainer.innerHTML = "";
    
    // Build HTML DOM
    filteredEntries.forEach(entry => {
        const dayGroup = document.createElement("div");
        dayGroup.className = "day-group";
        
        // Group Header (Date)
        const dateHeader = document.createElement("h2");
        dateHeader.className = "day-date-title";
        dateHeader.innerHTML = `${entry.date}`;
        
        if (entry.link) {
            const linkTag = document.createElement("span");
            linkTag.innerHTML = `<a href="${entry.link}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: none;">View Original ↗</a>`;
            dateHeader.appendChild(linkTag);
        }
        
        dayGroup.appendChild(dateHeader);
        
        // Cards List
        const cardsList = document.createElement("div");
        cardsList.className = "day-cards-list";
        
        entry.updates.forEach(update => {
            const card = document.createElement("div");
            
            // Styling class based on type
            let typeClass = "default-card";
            const typeLower = update.type.toLowerCase();
            if (typeLower.includes("feature")) typeClass = "feature-card";
            else if (typeLower.includes("issue") || typeLower.includes("bug")) typeClass = "issue-card";
            else if (typeLower.includes("deprecation") || typeLower.includes("deprecat")) typeClass = "deprecation-card";
            else if (typeLower.includes("announcement") || typeLower.includes("announc")) typeClass = "announcement-card";
            
            card.className = `release-card ${typeClass}`;
            
            // Card Header
            const cardHeader = document.createElement("div");
            cardHeader.className = "card-header";
            
            // Badge style class
            let badgeStyle = "update";
            if (typeClass === "feature-card") badgeStyle = "feature";
            else if (typeClass === "issue-card") badgeStyle = "issue";
            else if (typeClass === "deprecation-card") badgeStyle = "deprecation";
            else if (typeClass === "announcement-card") badgeStyle = "announcement";
            
            cardHeader.innerHTML = `<span class="badge ${badgeStyle}">${update.type}</span>`;
            card.appendChild(cardHeader);
            
            // Card Content (HTML)
            const cardContent = document.createElement("div");
            cardContent.className = "card-content";
            cardContent.innerHTML = update.description_html;
            card.appendChild(cardContent);
            
            // Card Actions
            const cardActions = document.createElement("div");
            cardActions.className = "card-actions";
            
            const tweetBtn = document.createElement("button");
            tweetBtn.className = "btn-card-action btn-tweet-card";
            tweetBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>Tweet Update</span>
            `;
            
            // Click to tweet
            tweetBtn.addEventListener("click", () => {
                openTweetComposer(entry, update);
            });
            
            cardActions.appendChild(tweetBtn);
            
            // Add a small source text in actions
            const sourceText = document.createElement("span");
            sourceText.style.fontSize = "0.75rem";
            sourceText.style.color = "var(--text-muted)";
            sourceText.textContent = "Google Cloud Feed";
            cardActions.appendChild(sourceText);
            
            card.appendChild(cardActions);
            
            cardsList.appendChild(card);
        });
        
        dayGroup.appendChild(cardsList);
        feedContainer.appendChild(dayGroup);
    });
}

// Open tweet dialog with customized prefilled text
function openTweetComposer(entry, update) {
    state.activeTweetData = { entry, update };
    
    // Set preview details in modal header context
    tweetContextDate.textContent = entry.date;
    tweetContextBadge.className = `badge ${update.type.toLowerCase().includes("feature") ? "feature" : update.type.toLowerCase().includes("issue") ? "issue" : update.type.toLowerCase().includes("deprecat") ? "deprecation" : update.type.toLowerCase().includes("announc") ? "announcement" : "update"}`;
    tweetContextBadge.textContent = update.type;
    tweetContextDesc.textContent = update.description_text;
    
    // Build perfect Draft Tweet
    // Base formatting: 📢 BigQuery (June 15, 2026): [Feature] {Desc}... Link #BigQuery #GoogleCloud
    const headerStr = `📢 BigQuery Update (${entry.date}) - [${update.type}]: `;
    const linkStr = entry.link ? `\n\nLink: ${entry.link}` : '';
    const footerStr = `\n#BigQuery #GoogleCloud`;
    
    // Calculate space for description
    const totalAuxLength = headerStr.length + linkStr.length + footerStr.length;
    const maxDescLength = 280 - totalAuxLength - 4; // 4 characters for spacer or "..."
    
    let descriptionPart = update.description_text;
    if (descriptionPart.length > maxDescLength) {
        descriptionPart = descriptionPart.substring(0, maxDescLength).trim() + "...";
    }
    
    const draftTweet = `${headerStr}${descriptionPart}${linkStr}${footerStr}`;
    
    tweetTextarea.value = draftTweet;
    updateTweetCharCount();
    
    // Open modal
    tweetModal.style.display = "flex";
    setTimeout(() => {
        tweetModal.classList.add("open");
        tweetTextarea.focus();
    }, 10);
}

function closeTweetModal() {
    tweetModal.classList.remove("open");
    setTimeout(() => {
        tweetModal.style.display = "none";
        state.activeTweetData = null;
    }, 300);
}

function updateTweetCharCount() {
    const text = tweetTextarea.value;
    const len = text.length;
    
    charCounter.textContent = `${len} / 280`;
    
    // Highlight counters based on limit
    charCounter.className = "char-counter";
    if (len > 280) {
        charCounter.classList.add("danger");
        tweetWarning.style.display = "block";
    } else if (len > 250) {
        charCounter.classList.add("warning");
        tweetWarning.style.display = "none";
    } else {
        tweetWarning.style.display = "none";
    }
}

// Fire tweet intent in new tab
function publishTweet() {
    const text = tweetTextarea.value;
    if (!text.trim()) return;
    
    const encodedText = encodeURIComponent(text);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
    closeTweetModal();
}
