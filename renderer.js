// Safe module loading for Electron / Browser Web Demo compatibility
let clipboard, shell, ipcRenderer, nativeImage;

if (typeof require !== 'undefined') {
    try {
        const electron = require('electron');
        clipboard = electron.clipboard;
        shell = electron.shell;
        ipcRenderer = electron.ipcRenderer;
        nativeImage = electron.nativeImage;
    } catch (e) {
        // Fallback for browser environment
    }
}

// Browser Fallback Mocks
if (!clipboard) {
    clipboard = {
        readText: () => '',
        writeText: (text) => {
            if (navigator.clipboard) navigator.clipboard.writeText(text);
        },
        readImage: () => ({ isEmpty: () => true, toDataURL: () => '' })
    };
}
if (!shell) {
    shell = {
        openExternal: (url) => window.open(url, '_blank')
    };
}
if (!ipcRenderer) {
    ipcRenderer = {
        send: () => {},
        on: () => {}
    };
}
if (!nativeImage) {
    nativeImage = {
        createFromDataURL: () => ({ isEmpty: () => true })
    };
}

// 1. Data Persistence & State
let clipboardHistory = [];
try {
    clipboardHistory = JSON.parse(localStorage.getItem('clipboardHistory')) || [];
} catch (e) {
    clipboardHistory = [];
}

// Seed sample items if history is empty (ideal for Web Demo)
if (clipboardHistory.length === 0) {
    clipboardHistory = [
        {
            id: Date.now() - 3600000,
            text: 'https://github.com/ngoducmanh-nrd/ClipboardX',
            type: 'Link',
            workspace: 'Programming',
            isFavorite: true,
            isPinned: true,
            time: new Date(Date.now() - 3600000).toLocaleString('vi-VN')
        },
        {
            id: Date.now() - 7200000,
            text: 'const clipboard = require("electron").clipboard;\nconsole.log("Welcome to ClipboardX!");',
            type: 'Code',
            workspace: 'Programming',
            isFavorite: false,
            isPinned: false,
            time: new Date(Date.now() - 7200000).toLocaleString('vi-VN')
        },
        {
            id: Date.now() - 10800000,
            text: 'contact@clipboardx.app',
            type: 'Email',
            workspace: 'Personal',
            isFavorite: true,
            isPinned: false,
            time: new Date(Date.now() - 10800000).toLocaleString('vi-VN')
        },
        {
            id: Date.now() - 14400000,
            text: 'Welcome to ClipboardX - Premium Clipboard Manager!',
            type: 'Text',
            workspace: 'Study',
            isFavorite: false,
            isPinned: false,
            time: new Date(Date.now() - 14400000).toLocaleString('vi-VN')
        }
    ];
    localStorage.setItem('clipboardHistory', JSON.stringify(clipboardHistory));
}

// Chuẩn hóa dữ liệu ban đầu
clipboardHistory.forEach(item => {
    if (!item.workspace) {
        item.workspace = 'Programming';
    }
    if (item.isFavorite === undefined) {
        item.isFavorite = false;
    }
    if (item.isPinned === undefined) {
        item.isPinned = false;
    }
});

const clipboardListEl = document.getElementById('clipboard-list');
const emptyView = document.getElementById('empty-view');
const detailView = document.getElementById('detail-view');
const detailTitle = document.getElementById('detail-title');
const detailTime = document.getElementById('detail-time');
const detailIcon = document.getElementById('detail-icon');
const detailIconBg = document.getElementById('detail-icon-bg');
const detailBadgeTop = document.getElementById('detail-badge-top');
const detailTypeText = document.getElementById('detail-type-text');
const detailStar = document.getElementById('detail-star');
const btnOpenBrowser = document.getElementById('btn-open-browser');
const workspaceSelect = document.getElementById('detail-workspace-select');
const btnSaveImage = document.getElementById('btn-save-image');

// Elements cho hiển thị Ảnh trong Detail View
const detailImageWrapper = document.getElementById('detail-image-wrapper');
const detailImageView = document.getElementById('detail-image-view');
const detailContentWrapper = document.querySelector('.detail-content-wrapper');

let selectedIndex = null;
let currentWorkspaceFilter = 'All';
let currentFilter = 'All Items';
let activeTab = 'Timeline';
let searchQuery = '';

// Security state
let isPersonalUnlocked = false; // Bắt đầu ở trạng thái khóa
let personalPin = localStorage.getItem('personalPin') || '1234';

// Helper để lưu trữ dữ liệu
function saveToLocalStorage() {
    localStorage.setItem('clipboardHistory', JSON.stringify(clipboardHistory));
}

// Cập nhật ngày tháng trên giao diện
document.getElementById('current-date').innerText = `Today - ${new Date().toLocaleDateString('vi-VN')}`;

// Hệ thống thông báo Toast
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'bx-check-circle';
    if (type === 'info') icon = 'bx-info-circle';
    if (type === 'warning') icon = 'bx-error';
    
    toast.innerHTML = `
        <i class='bx ${icon}'></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    toast.offsetHeight; // Force reflow
    toast.classList.add('show');

    // Tự động xóa sau 2.5s
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 2500);
}

// Hàm nhận diện loại dữ liệu (Link, Code, Email, Path, Image, Text)
function detectType(text) {
    if (!text) {
        return { type: 'Text', icon: 'bx-text', bg: 'bg-gray-light', textCol: 'text-gray' };
    }
    
    const trimmed = text.trim();

    // 1. Nhận dạng Ảnh (Base64 data URL của hình ảnh)
    if (trimmed.startsWith('data:image/')) {
        return { type: 'Image', icon: 'bx-image', bg: 'bg-red-light', textCol: 'text-red' };
    }

    // 2. Nhận dạng Link
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/i;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || urlPattern.test(trimmed)) {
        return { type: 'Link', icon: 'bx-globe', bg: 'bg-blue-light', textCol: 'text-blue' };
    }

    // 3. Nhận dạng Email
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailPattern.test(trimmed) || (trimmed.includes('@') && trimmed.includes('.') && !trimmed.includes(' '))) {
        return { type: 'Email', icon: 'bx-envelope', bg: 'bg-green-light', textCol: 'text-green' };
    }

    // 4. Nhận dạng Đường dẫn (File Path / Folder Path - hỗ trợ Windows & Unix)
    const isWindowsPath = /^[a-zA-Z]:\\(?:[^\\\/:*?"<>|]+\\)*[^\\\/:*?"<>|]*$/i.test(trimmed);
    const isUnixPath = /^\/(?:[^/]+\/)*[^/]*$/.test(trimmed);
    if (isWindowsPath || isUnixPath) {
        if (trimmed.length > 3 && (trimmed.includes('/') || trimmed.includes('\\'))) {
            return { type: 'Path', icon: 'bx-folder', bg: 'bg-yellow-light', textCol: 'text-yellow' };
        }
    }

    // 5. Nhận dạng Code (sử dụng danh sách từ khóa đặc trưng và cấu trúc cú pháp)
    const codeMarkers = [
        // JavaScript/TypeScript/C-family
        'const ', 'let ', 'var ', 'function ', 'class ', 'import ', 'export ', 'console.log', 'typeof ', 'return ',
        // Python
        'def ', 'elif ', 'import ', 'print(', '__main__', 'lambda ', 'self.',
        // HTML/XML
        '</div>', '</span>', '</a>', '<html>', '<body>', '<ul>', '<li>', '<script', '<style', '<div', '<p>', '<h1', '<h2', '<h3', '<a href',
        // CSS
        'margin:', 'padding:', 'color:', 'background-color:', 'display:', 'position:', 'border-radius:', '@media',
        // SQL
        'SELECT ', 'INSERT INTO', 'UPDATE ', 'DELETE FROM', 'CREATE TABLE',
        // C/C++/Java/C#
        '#include', '#define', 'using namespace', 'public static void', 'std::', 'System.out.println', 'using System;',
        // Dấu ngoặc hoặc cấu pháp đặc trưng
        '{\n', '};\n', '() =>', 'class='
    ];

    const hasCodeKeywords = codeMarkers.some(marker => text.includes(marker));
    const hasCurlySemicolon = text.includes('{') && text.includes('}') && text.includes(';');
    const hasHtmlTags = /<[a-z/][^>]*>/i.test(trimmed);

    if (hasCodeKeywords || hasCurlySemicolon || hasHtmlTags) {
        return { type: 'Code', icon: 'bx-code-alt', bg: 'bg-purple-light', textCol: 'text-purple' };
    }

    // Mặc định là Text thường
    return { type: 'Text', icon: 'bx-text', bg: 'bg-gray-light', textCol: 'text-gray' }; 
}

// Helper tránh lỗi Regex khi highlight chữ tìm kiếm
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// === 1. HÀM CẬP NHẬT SỐ LƯỢNG (BADGES) ===
function updateSidebarStats() {
    let stats = {
        all: 0, fav: 0, text: 0, code: 0, link: 0, email: 0, path: 0, image: 0,
        programming: 0, study: 0, personal: 0
    };

    clipboardHistory.forEach(item => {
        // Nếu Workspace Personal đang bị khóa, KHÔNG tính các item Personal vào bộ đếm thống kê
        if (!isPersonalUnlocked && item.workspace === 'Personal') {
            return;
        }

        stats.all++;
        if (item.isFavorite) stats.fav++;

        const typeInfo = detectType(item.text);
        if (typeInfo.type === 'Text') stats.text++;
        if (typeInfo.type === 'Code') stats.code++;
        if (typeInfo.type === 'Link') stats.link++;
        if (typeInfo.type === 'Email') stats.email++;
        if (typeInfo.type === 'Path') stats.path++;
        if (typeInfo.type === 'Image') stats.image++;

        const ws = item.workspace || 'Programming';
        if (ws === 'Programming') stats.programming++;
        if (ws === 'Study') stats.study++;
        if (ws === 'Personal') stats.personal++;
    });

    // Cập nhật lên HTML
    document.getElementById('badge-all').innerText = stats.all;
    document.getElementById('badge-fav').innerText = stats.fav;
    document.getElementById('badge-text').innerText = stats.text;
    document.getElementById('badge-code').innerText = stats.code;
    document.getElementById('badge-link').innerText = stats.link;
    document.getElementById('badge-email').innerText = stats.email;
    document.getElementById('badge-path').innerText = stats.path;
    document.getElementById('badge-image').innerText = stats.image;
    document.getElementById('badge-programming').innerText = stats.programming;
    document.getElementById('badge-study').innerText = stats.study;
    document.getElementById('badge-personal').innerText = stats.personal;
    
    const badgeWsAll = document.getElementById('badge-ws-all');
    if (badgeWsAll) badgeWsAll.innerText = stats.all;

    // Cập nhật biểu tượng Khóa cho Workspace Personal bên trái sidebar
    const personalLockIcon = document.getElementById('personal-lock-icon');
    const personalChangePinIcon = document.getElementById('personal-change-pin-icon');
    if (personalLockIcon) {
        personalLockIcon.className = isPersonalUnlocked ? 'bx bx-lock-open-alt' : 'bx bx-lock-alt';
        personalLockIcon.title = isPersonalUnlocked ? 'Lock Personal Workspace' : 'Unlock Personal Workspace';
    }
    if (personalChangePinIcon) {
        personalChangePinIcon.style.display = isPersonalUnlocked ? 'inline-block' : 'none';
    }
}

// === 2. HÀM RENDER DỮ LIỆU ===
function renderHistory() {
    clipboardListEl.innerHTML = ''; 
    
    // Lọc mảng trước khi vẽ ra
    const filteredHistory = clipboardHistory.filter(item => {
        // 1. Lọc Workspace bảo mật Personal
        if (!isPersonalUnlocked && item.workspace === 'Personal') {
            return false;
        }

        // 2. Bộ lọc tìm kiếm
        // Không tìm kiếm trên hình ảnh dưới dạng text thô
        const isImg = detectType(item.text).type === 'Image';
        if (searchQuery && (isImg || !item.text.toLowerCase().includes(searchQuery.toLowerCase()))) {
            return false;
        }

        // 3. Bộ lọc Workspace
        if (currentWorkspaceFilter !== 'All' && item.workspace !== currentWorkspaceFilter) {
            return false;
        }

        // 4. Bộ lọc Tab (Timeline vs Favorites)
        if (activeTab === 'Favorites' && !item.isFavorite) {
            return false;
        }

        // 5. Bộ lọc Sidebar Quick actions / Types
        if (currentFilter === 'Favorites') {
            if (!item.isFavorite) return false;
        } else if (currentFilter !== 'All Items') {
            const typeInfo = detectType(item.text);
            if (typeInfo.type !== currentFilter) return false;
        }

        return true;
    });

    // Sắp xếp: Đưa các mục được ghim (isPinned) lên trên cùng
    const sortedHistory = [...filteredHistory].sort((a, b) => {
        const aPinned = a.isPinned ? 1 : 0;
        const bPinned = b.isPinned ? 1 : 0;
        return bPinned - aPinned; // Pinned trước, không Pinned sau
    });

    sortedHistory.forEach((item) => {
        const originalIndex = clipboardHistory.indexOf(item); 
        const typeInfo = detectType(item.text);
        
        let contentHTML = '';
        if (typeInfo.type === 'Image') {
            // Hiển thị ảnh thu nhỏ
            contentHTML = `<img src="${item.text}" class="timeline-card-image" alt="Captured Image">`;
        } else {
            const shortText = item.text.length > 50 ? item.text.substring(0, 50) + '...' : item.text;
            let highlightedText = escapeHTML(shortText);
            
            // Highlight từ khóa tìm kiếm nếu có
            if (searchQuery) {
                try {
                    const regex = new RegExp(`(${escapeRegExp(searchQuery)})`, 'gi');
                    highlightedText = highlightedText.replace(regex, '<mark class="search-highlight">$1</mark>');
                } catch (e) {}
            }
            contentHTML = `<h4>${highlightedText}</h4>`;
        }
        
        // Nút sao vàng (Favorites) & Pin icon
        const starIcon = item.isFavorite ? 'bxs-star text-yellow' : 'bx-star';
        const pinIcon = item.isPinned ? 'bxs-pin text-yellow' : 'bx-pin';

        const itemHTML = `
            <div class="timeline-item">
                <div class="time">${item.time}</div>
                <div class="dot"></div>
                <div class="card ${originalIndex === selectedIndex ? 'active-card' : ''}" 
                     data-index="${originalIndex}" 
                     draggable="true"
                     onclick="selectItem(${originalIndex})"
                     ondblclick="doubleClickCopy(${originalIndex})">
                    <div class="icon-box ${typeInfo.bg}"><i class='bx ${typeInfo.icon} ${typeInfo.textCol}'></i></div>
                    <div class="card-info" style="overflow: hidden;">
                        ${contentHTML}
                        <p class="${typeInfo.textCol}">${typeInfo.type}</p>
                    </div>
                    <div class="card-actions">
                        <i class='bx ${pinIcon}' onclick="togglePin(event, ${originalIndex})" title="Pin to top"></i>
                        <i class='bx ${starIcon}' onclick="toggleFavorite(event, ${originalIndex})" title="Favorite"></i>
                        <i class='bx bx-trash' onclick="deleteItem(event, ${originalIndex})" title="Delete"></i>
                    </div>
                </div>
            </div>
        `;
        clipboardListEl.insertAdjacentHTML('beforeend', itemHTML);
    });

    // Thêm sự kiện Drag cho các card mới vẽ
    bindCardDragEvents();
    updateSidebarStats();
}

// Simple HTML escaping to avoid XSS
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// === 3. XỬ LÝ LẮNG NGHE CLIPBOARD (HÌNH ẢNH & CHỮ & TRÁNH TRÙNG LẶP) ===
let lastText = clipboard.readText();
let lastImageBase64 = '';

// Khởi tạo trạng thái ban đầu của hình ảnh để tránh capture trùng
const firstItem = clipboardHistory[0];
if (firstItem && detectType(firstItem.text).type === 'Image') {
    lastImageBase64 = firstItem.text;
}

setInterval(() => {
    const currentText = clipboard.readText();
    const currentImage = clipboard.readImage();

    // 1. Xử lý khi có text mới
    if (currentText && currentText !== lastText) {
        lastText = currentText;
        lastImageBase64 = ''; // Reset image cache để bắt tiếp tục
        
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Kiểm tra trùng lặp
        const existingIndex = clipboardHistory.findIndex(item => item.text === currentText);
        let existingItem = null;
        
        if (existingIndex !== -1) {
            existingItem = clipboardHistory[existingIndex];
            clipboardHistory.splice(existingIndex, 1);
            
            if (selectedIndex !== null) {
                if (selectedIndex === existingIndex) {
                    selectedIndex = 0;
                } else if (selectedIndex < existingIndex) {
                    selectedIndex++;
                }
            }
        } else {
            if (selectedIndex !== null) selectedIndex++;
        }
        
        if (existingItem) {
            existingItem.time = timeString;
            clipboardHistory.unshift(existingItem);
            showToast('Existing item moved to top!', 'info');
        } else {
            clipboardHistory.unshift({ 
                text: currentText, 
                time: timeString,
                isFavorite: false,
                isPinned: false,
                workspace: 'Programming'
            });
            showToast('New clipboard text captured!', 'info');
        }
        
        saveToLocalStorage();
        renderHistory();
        
    // 2. Xử lý khi có hình ảnh mới
    } else if (!currentImage.isEmpty()) {
        const dataUrl = currentImage.toDataURL();
        if (dataUrl !== lastImageBase64) {
            lastImageBase64 = dataUrl;
            lastText = ''; // Reset text cache
            
            const now = new Date();
            const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            // Kiểm tra trùng lặp ảnh
            const existingIndex = clipboardHistory.findIndex(item => item.text === dataUrl);
            let existingItem = null;
            
            if (existingIndex !== -1) {
                existingItem = clipboardHistory[existingIndex];
                clipboardHistory.splice(existingIndex, 1);
                
                if (selectedIndex !== null) {
                    if (selectedIndex === existingIndex) {
                        selectedIndex = 0;
                    } else if (selectedIndex < existingIndex) {
                        selectedIndex++;
                    }
                }
            } else {
                if (selectedIndex !== null) selectedIndex++;
            }
            
            if (existingItem) {
                existingItem.time = timeString;
                clipboardHistory.unshift(existingItem);
                showToast('Existing image moved to top!', 'info');
            } else {
                clipboardHistory.unshift({ 
                    text: dataUrl, 
                    time: timeString,
                    isFavorite: false,
                    isPinned: false,
                    workspace: 'Programming'
                });
                showToast('New clipboard image captured!', 'info');
            }
            
            saveToLocalStorage();
            renderHistory();
        }
    }
}, 500);

// === 4. XỬ LÝ CLICK MENU BÊN TRÁI ===
// Workspaces menu click
const workspaceItems = document.querySelectorAll('#workspace-menu .menu-item');
workspaceItems.forEach(item => {
    item.addEventListener('click', (e) => {
        const ws = item.getAttribute('data-workspace') || 'All';
        
        // Bảo mật: Nếu nhấn vào Personal và đang bị khóa, yêu cầu nhập PIN
        if (ws === 'Personal' && !isPersonalUnlocked) {
            e.stopPropagation();
            showPinLockModal(() => {
                // Success Callback: Unlock and redirect to Personal
                isPersonalUnlocked = true;
                updateSidebarStats();
                document.querySelector('#workspace-menu .menu-item.active')?.classList.remove('active');
                item.classList.add('active');
                currentWorkspaceFilter = 'Personal';
                renderHistory();
            });
            return;
        }

        document.querySelector('#workspace-menu .menu-item.active')?.classList.remove('active');
        item.classList.add('active');
        currentWorkspaceFilter = ws;
        renderHistory();
    });
});

// Lock/Unlock click trực tiếp vào icon khóa của Personal
const personalLockIcon = document.getElementById('personal-lock-icon');
if (personalLockIcon) {
    personalLockIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPersonalUnlocked) {
            // Thực hiện khóa lại
            isPersonalUnlocked = false;
            updateSidebarStats();
            showToast('Personal Workspace locked!', 'warning');
            
            // Nếu đang đứng ở Personal, quay về All Workspaces
            if (currentWorkspaceFilter === 'Personal') {
                currentWorkspaceFilter = 'All';
                document.querySelector('#workspace-menu .menu-item.active')?.classList.remove('active');
                document.querySelector('[data-workspace="All"]')?.classList.add('active');
            }
            
            // Đóng panel chi tiết nếu mục đang chọn thuộc Personal
            if (selectedIndex !== null && clipboardHistory[selectedIndex] && clipboardHistory[selectedIndex].workspace === 'Personal') {
                selectedIndex = null;
                detailView.style.display = 'none';
                emptyView.style.display = 'block';
            }
            
            renderHistory();
        } else {
            // Mở khóa
            showPinLockModal(() => {
                isPersonalUnlocked = true;
                updateSidebarStats();
                showToast('Personal Workspace unlocked!', 'success');
                renderHistory();
            });
        }
    });
}

// Nhấp vào icon đổi PIN của Personal
const personalChangePinIcon = document.getElementById('personal-change-pin-icon');
if (personalChangePinIcon) {
    personalChangePinIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPersonalUnlocked) {
            showChangePinModal();
        }
    });
}

// Quick Action and Types menu click
const filterItems = document.querySelectorAll('#filter-menu .menu-item, #type-menu .menu-item');
filterItems.forEach(item => {
    item.addEventListener('click', () => {
        document.querySelector('#filter-menu .menu-item.active, #type-menu .menu-item.active')?.classList.remove('active');
        item.classList.add('active');
        currentFilter = item.getAttribute('data-filter') || 'All Items';
        renderHistory();
    });
});

// Tab switching
const tabs = document.querySelectorAll('.tabs .tab');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.textContent.trim();
        renderHistory();
    });
});

// Search input listener
const searchInput = document.getElementById('search-input');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value;
        renderHistory();
    });
}

// Clear All
document.querySelector('.btn-clear').addEventListener('click', () => {
    if (clipboardHistory.length === 0) {
        showToast('Clipboard history is already empty!', 'info');
        return;
    }
    if (confirm('Are you sure you want to clear all clipboard history?')) {
        clipboardHistory = [];
        saveToLocalStorage();
        selectedIndex = null;
        renderHistory();
        
        detailView.style.display = 'none';
        emptyView.style.display = 'block';
        showToast('All clipboard history cleared!', 'success');
    }
});

// === 5. PINNED TO TOP & FAVORITES & DELETE CARD ACTIONS ===
function togglePin(event, index) {
    if (event) event.stopPropagation();
    clipboardHistory[index].isPinned = !clipboardHistory[index].isPinned;
    saveToLocalStorage();
    renderHistory();
    if (selectedIndex === index) {
        selectItem(index);
    }
    showToast(clipboardHistory[index].isPinned ? 'Pinned to top!' : 'Unpinned from top!', 'success');
}

function toggleFavorite(event, index) {
    if (event) event.stopPropagation();
    clipboardHistory[index].isFavorite = !clipboardHistory[index].isFavorite;
    saveToLocalStorage();
    renderHistory();
    if (selectedIndex === index) {
        selectItem(index);
    }
    showToast(clipboardHistory[index].isFavorite ? 'Added to Favorites!' : 'Removed from Favorites!', 'success');
}

function deleteItem(event, index) {
    if (event) event.stopPropagation();
    clipboardHistory.splice(index, 1);
    saveToLocalStorage();
    
    if (selectedIndex === index) {
        selectedIndex = null;
        detailView.style.display = 'none';
        emptyView.style.display = 'block';
    } else if (selectedIndex !== null && selectedIndex > index) {
        selectedIndex--;
    }
    
    renderHistory();
    showToast('Item deleted!', 'success');
}

// Double click to copy & hide window
function doubleClickCopy(index) {
    if (!clipboardHistory[index]) return;
    const text = clipboardHistory[index].text;
    const typeInfo = detectType(text);
    
    if (typeInfo.type === 'Image') {
        const img = nativeImage.createFromDataURL(text);
        clipboard.writeImage(img);
        lastImageBase64 = text;
    } else {
        clipboard.writeText(text);
        lastText = text;
    }
    
    showToast('Copied and hiding app...', 'success');
    setTimeout(() => {
        ipcRenderer.send('window-hide');
    }, 400);
}

// === 6. XỬ LÝ CỘT BÊN PHẢI (CHI TIẾT & PREVIEWS) ===
function selectItem(index) {
    selectedIndex = index;
    const item = clipboardHistory[index];
    if (!item) return;
    
    const typeInfo = detectType(item.text);

    // Hiển thị panel chi tiết, giấu panel rỗng
    emptyView.style.display = 'none';
    detailView.style.display = 'block';

    // Xử lý ẩn hiện khối văn bản / khối hình ảnh tùy theo loại tệp
    if (typeInfo.type === 'Image') {
        detailContentWrapper.style.display = 'none';
        detailImageWrapper.style.display = 'block';
        detailImageView.src = item.text;
        btnSaveImage.style.display = 'flex';
    } else {
        detailContentWrapper.style.display = 'flex';
        detailImageWrapper.style.display = 'none';
        btnSaveImage.style.display = 'none';
        
        detailTitle.textContent = item.text;
    }
    
    detailTime.innerText = `${item.time} - Today`;
    
    // Cập nhật icon và màu sắc
    detailIcon.className = `bx ${typeInfo.icon}`;
    detailIconBg.className = `big-icon-box ${typeInfo.bg} ${typeInfo.textCol}`;
    
    // Cập nhật Badge (Loại dữ liệu)
    detailBadgeTop.innerText = typeInfo.type;
    detailTypeText.innerText = typeInfo.type;

    // Cập nhật Ngôi sao
    detailStar.className = item.isFavorite ? 'bx bxs-star text-yellow star-icon' : 'bx bx-star star-icon';

    // Cập nhật dropdown Workspace
    if (workspaceSelect) {
        workspaceSelect.value = item.workspace || 'Programming';
    }

    // Nếu là Link thì hiện nút "Open in Browser", không thì giấu đi
    if (typeInfo.type === 'Link') {
        btnOpenBrowser.style.display = 'flex';
    } else {
        btnOpenBrowser.style.display = 'none';
    }

    // Làm nổi bật cái thẻ (card) đang chọn ở cột giữa
    document.querySelectorAll('.card').forEach(card => {
        const cardIdx = parseInt(card.getAttribute('data-index'), 10);
        if (cardIdx === index) {
            card.classList.add('active-card');
        } else {
            card.classList.remove('active-card');
        }
    });
}

// Xử lý đổi Workspace từ Dropdown trong Chi tiết
if (workspaceSelect) {
    workspaceSelect.addEventListener('change', () => {
        if (selectedIndex !== null && clipboardHistory[selectedIndex]) {
            const oldWorkspace = clipboardHistory[selectedIndex].workspace;
            const newWorkspace = workspaceSelect.value;
            if (oldWorkspace !== newWorkspace) {
                // Bảo mật: Nếu Workspace mới chuyển thành Personal và đang bị khóa,
                // ta cho phép gán nhưng cảnh báo hoặc ẩn luôn
                clipboardHistory[selectedIndex].workspace = newWorkspace;
                saveToLocalStorage();
                
                // Nếu Personal đang khóa, mục này sẽ tự ẩn đi khỏi màn hình render hiện tại
                if (newWorkspace === 'Personal' && !isPersonalUnlocked) {
                    selectedIndex = null;
                    detailView.style.display = 'none';
                    emptyView.style.display = 'block';
                    showToast('Moved to locked Personal Workspace (Hidden)!', 'warning');
                } else {
                    showToast(`Moved to Workspace: ${newWorkspace}`, 'success');
                }
                renderHistory();
            }
        }
    });
}

// === 7. CÁC NÚT ACTION CHI TIẾT ===
// Nút Copy Again
document.getElementById('btn-copy-again').addEventListener('click', () => {
    if (selectedIndex === null) return;
    const text = clipboardHistory[selectedIndex].text;
    const typeInfo = detectType(text);
    
    if (typeInfo.type === 'Image') {
        const img = nativeImage.createFromDataURL(text);
        clipboard.writeImage(img);
        lastImageBase64 = text;
    } else {
        clipboard.writeText(text);
        lastText = text;
    }
    
    showToast('Copied to clipboard!', 'success');
});

// Nút Save Image (Tải ảnh bằng HTML5 link)
if (btnSaveImage) {
    btnSaveImage.addEventListener('click', () => {
        if (selectedIndex === null || !clipboardHistory[selectedIndex]) return;
        const text = clipboardHistory[selectedIndex].text;
        if (detectType(text).type === 'Image') {
            const link = document.createElement('a');
            link.href = text;
            link.download = `clipboard_img_${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Image downloading...', 'success');
        }
    });
}

// Nút Open Browser (Chỉ hiện khi là Link)
btnOpenBrowser.addEventListener('click', () => {
    if (selectedIndex === null) return;
    let url = clipboardHistory[selectedIndex].text;
    if (!url.startsWith('http')) {
        url = 'https://' + url;
    }
    shell.openExternal(url);
    showToast('Opening link in browser...', 'info');
});

// Nút Edit
document.getElementById('btn-edit').addEventListener('click', () => {
    if (selectedIndex === null) return;
    const item = clipboardHistory[selectedIndex];
    const typeInfo = detectType(item.text);
    if (typeInfo.type === 'Image') {
        showToast('Images cannot be edited as text!', 'warning');
        return;
    }
    
    const currentText = item.text;
    const newText = prompt("Chỉnh sửa nội dung:", currentText);
    
    if (newText && newText !== currentText) {
        clipboardHistory[selectedIndex].text = newText;
        saveToLocalStorage();
        renderHistory();
        selectItem(selectedIndex);
        showToast('Clipboard item updated!', 'success');
    }
});

// Nút Delete ở cột phải
document.getElementById('btn-delete-detail').addEventListener('click', () => {
    if (selectedIndex === null) return;
    deleteItem(null, selectedIndex);
});

// Nút Star ở cột phải
detailStar.addEventListener('click', () => {
    if (selectedIndex === null) return;
    toggleFavorite(null, selectedIndex);
});

// Nút Copy mini trong preview block
const btnCopyMini = document.getElementById('btn-copy-mini');
if (btnCopyMini) {
    btnCopyMini.addEventListener('click', () => {
        if (selectedIndex !== null && clipboardHistory[selectedIndex]) {
            const text = clipboardHistory[selectedIndex].text;
            clipboard.writeText(text);
            lastText = text;
            showToast('Copied preview content!', 'success');
        }
    });
}

// === 8. KÉO THẢ TỆP TIN VÀ CARD WORKSPACE TAGGING ===
// Bật drag cho các card trong timeline
function bindCardDragEvents() {
    const cards = document.querySelectorAll('.timeline-list .card');
    cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
            const idx = card.getAttribute('data-index');
            const item = clipboardHistory[idx];
            if (item) {
                e.dataTransfer.setData('text/plain', item.text);
                e.dataTransfer.setData('application/json', JSON.stringify({ index: parseInt(idx, 10) }));
                e.dataTransfer.effectAllowed = 'copyMove';
            }
        });
    });
}

// Drag & drop file/text từ ngoài máy tính vào Timeline
const timelineArea = document.querySelector('.timeline-area');
if (timelineArea) {
    timelineArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        timelineArea.classList.add('drag-over');
    });
    timelineArea.addEventListener('dragleave', () => {
        timelineArea.classList.remove('drag-over');
    });
    timelineArea.addEventListener('drop', (e) => {
        e.preventDefault();
        timelineArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        const text = e.dataTransfer.getData('text/plain');
        
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // 1. Thả file từ File Explorer
        if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
                const filePath = files[i].path; // Electron cho phép lấy đường dẫn thực tế của tệp
                if (filePath) {
                    clipboardHistory.unshift({
                        text: filePath,
                        time: timeString,
                        isFavorite: false,
                        isPinned: false,
                        workspace: currentWorkspaceFilter !== 'All' ? currentWorkspaceFilter : 'Programming'
                    });
                }
            }
            saveToLocalStorage();
            renderHistory();
            showToast(`Imported ${files.length} file path(s) via Drag & Drop!`, 'success');
            
        // 2. Thả văn bản từ bên ngoài
        } else if (text) {
            // Tránh gán tag nhầm khi kéo nội bộ timeline (chỉ nhận drop ngoài)
            const jsonData = e.dataTransfer.getData('application/json');
            if (!jsonData) {
                clipboardHistory.unshift({
                    text: text,
                    time: timeString,
                    isFavorite: false,
                    isPinned: false,
                    workspace: currentWorkspaceFilter !== 'All' ? currentWorkspaceFilter : 'Programming'
                });
                saveToLocalStorage();
                renderHistory();
                showToast('Imported text content via Drag & Drop!', 'success');
            }
        }
    });
}

// Drag timeline card thả vào Workspaces bên sidebar để gán tag
const workspaceSidebarItems = document.querySelectorAll('#workspace-menu .menu-item');
workspaceSidebarItems.forEach(wsItem => {
    const ws = wsItem.getAttribute('data-workspace');
    if (ws && ws !== 'All') {
        wsItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            wsItem.classList.add('drag-over-sidebar');
        });
        wsItem.addEventListener('dragleave', () => {
            wsItem.classList.remove('drag-over-sidebar');
        });
        wsItem.addEventListener('drop', (e) => {
            e.preventDefault();
            wsItem.classList.remove('drag-over-sidebar');
            try {
                const jsonData = e.dataTransfer.getData('application/json');
                if (jsonData) {
                    const data = JSON.parse(jsonData);
                    const idx = data.index;
                    if (idx !== undefined && clipboardHistory[idx]) {
                        clipboardHistory[idx].workspace = ws;
                        saveToLocalStorage();
                        
                        // Nếu gán vào Personal mà Personal đang bị khóa, tự động ẩn chi tiết và item khỏi timeline
                        if (ws === 'Personal' && !isPersonalUnlocked) {
                            if (selectedIndex === idx) {
                                selectedIndex = null;
                                detailView.style.display = 'none';
                                emptyView.style.display = 'block';
                            }
                            showToast('Moved item to secured Personal Workspace (Hidden)!', 'warning');
                        } else {
                            showToast(`Moved item to Workspace: ${ws}`, 'success');
                        }
                        
                        renderHistory();
                    }
                }
            } catch (err) {
                console.error('Lỗi khi kéo thả gán tag:', err);
            }
        });
    }
});

// === 9. BẢO MẬT WORKSPACE PERSONAL & PIN LOCK CODE ===
let pinInputBuffer = '';
let onPinSuccessCallback = null;

function showPinLockModal(onSuccess) {
    pinInputBuffer = '';
    onPinSuccessCallback = onSuccess;
    updatePinDots('pin-display-lock');
    document.getElementById('pin-lock-modal').style.display = 'flex';
}

function closePinLockModal() {
    document.getElementById('pin-lock-modal').style.display = 'none';
    pinInputBuffer = '';
    onPinSuccessCallback = null;
}

// Đổi PIN modal variables
let changePinState = 1; // 1: Nhập cũ, 2: Nhập mới, 3: Xác nhận mới
let oldPinInput = '';
let newPinInput = '';
let confirmPinInput = '';
let changePinBuffer = '';

function showChangePinModal() {
    changePinState = 1;
    changePinBuffer = '';
    oldPinInput = '';
    newPinInput = '';
    confirmPinInput = '';
    document.getElementById('change-pin-step-label').innerText = 'Enter current 4-digit PIN:';
    updatePinDots('pin-display-change');
    document.getElementById('change-pin-modal').style.display = 'flex';
}

function closeChangePinModal() {
    document.getElementById('change-pin-modal').style.display = 'none';
    changePinBuffer = '';
}

function updatePinDots(containerId) {
    const bufferLength = containerId === 'pin-display-lock' ? pinInputBuffer.length : changePinBuffer.length;
    const dots = document.querySelectorAll(`#${containerId} .pin-dot`);
    dots.forEach((dot, index) => {
        if (index < bufferLength) {
            dot.classList.add('filled');
        } else {
            dot.classList.remove('filled');
        }
    });
}

// Bắt sự kiện bàn phím bấm Keypad
function handleLockKeypadClick(key) {
    if (pinInputBuffer.length < 4) {
        pinInputBuffer += key;
        updatePinDots('pin-display-lock');
        
        // Nhập đủ 4 ký tự thì tự kiểm tra PIN
        if (pinInputBuffer.length === 4) {
            setTimeout(() => {
                if (pinInputBuffer === personalPin) {
                    const callback = onPinSuccessCallback;
                    closePinLockModal();
                    if (callback) callback();
                } else {
                    showToast('Incorrect PIN! Please try again.', 'warning');
                    pinInputBuffer = '';
                    updatePinDots('pin-display-lock');
                }
            }, 200);
        }
    }
}

function handleChangeKeypadClick(key) {
    if (changePinBuffer.length < 4) {
        changePinBuffer += key;
        updatePinDots('pin-display-change');
        
        if (changePinBuffer.length === 4) {
            setTimeout(() => {
                if (changePinState === 1) {
                    // Bước 1: Xác nhận PIN cũ
                    if (changePinBuffer === personalPin) {
                        oldPinInput = changePinBuffer;
                        changePinBuffer = '';
                        changePinState = 2;
                        document.getElementById('change-pin-step-label').innerText = 'Enter new 4-digit PIN:';
                        updatePinDots('pin-display-change');
                    } else {
                        showToast('Incorrect current PIN!', 'warning');
                        changePinBuffer = '';
                        updatePinDots('pin-display-change');
                    }
                } else if (changePinState === 2) {
                    // Bước 2: Nhập PIN mới
                    newPinInput = changePinBuffer;
                    changePinBuffer = '';
                    changePinState = 3;
                    document.getElementById('change-pin-step-label').innerText = 'Confirm new 4-digit PIN:';
                    updatePinDots('pin-display-change');
                } else if (changePinState === 3) {
                    // Bước 3: Xác nhận lại PIN mới
                    confirmPinInput = changePinBuffer;
                    if (confirmPinInput === newPinInput) {
                        personalPin = newPinInput;
                        localStorage.setItem('personalPin', personalPin);
                        closeChangePinModal();
                        showToast('PIN passcode changed successfully!', 'success');
                    } else {
                        showToast('New PINs do not match! Restarting...', 'warning');
                        changePinState = 2;
                        changePinBuffer = '';
                        document.getElementById('change-pin-step-label').innerText = 'Enter new 4-digit PIN:';
                        updatePinDots('pin-display-change');
                    }
                }
            }, 200);
        }
    }
}

// Bind các sự kiện bấm phím trên các Keypad Modal
document.querySelectorAll('#pin-keypad-lock button').forEach(btn => {
    btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        const act = btn.getAttribute('data-action');
        
        if (key) {
            handleLockKeypadClick(key);
        } else if (act === 'clear') {
            pinInputBuffer = '';
            updatePinDots('pin-display-lock');
        } else if (act === 'cancel') {
            closePinLockModal();
        }
    });
});

document.querySelectorAll('#pin-keypad-change button').forEach(btn => {
    btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        const act = btn.getAttribute('data-action');
        
        if (key) {
            handleChangeKeypadClick(key);
        } else if (act === 'clear') {
            changePinBuffer = '';
            updatePinDots('pin-display-change');
        } else if (act === 'cancel') {
            closeChangePinModal();
        }
    });
});

// === 10. WINDOW CONTROLS & IPC ===
document.querySelector('.bx-minus').addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
});
document.querySelector('.bx-square').addEventListener('click', () => {
    ipcRenderer.send('window-maximize');
});
document.querySelector('.bx-x').addEventListener('click', () => {
    ipcRenderer.send('window-close');
});

// === 11. DARK MODE TOGGLE ===
const darkModeToggle = document.getElementById('dark-mode-toggle');
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    document.body.classList.add('dark-theme');
    if (darkModeToggle) {
        darkModeToggle.className = 'bx bx-sun';
    }
}

if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        darkModeToggle.className = isDark ? 'bx bx-sun' : 'bx bx-moon';
        showToast(isDark ? 'Dark mode enabled!' : 'Light mode enabled!', 'info');
    });
}

// === 12. AUTOSTART SETTINGS ===
const autostartToggle = document.getElementById('autostart-toggle');
if (autostartToggle) {
    // Sync current setting from main process on load
    ipcRenderer.invoke('get-autostart').then((enabled) => {
        autostartToggle.checked = enabled;
    }).catch(err => {
        console.error('Failed to get autostart settings:', err);
    });

    // Listen to changes on the toggle checkbox
    autostartToggle.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        ipcRenderer.invoke('set-autostart', enabled).then((status) => {
            showToast(status ? 'Enabled launch with Windows!' : 'Disabled launch with Windows!', 'success');
        }).catch(err => {
            console.error('Failed to set autostart settings:', err);
            showToast('Failed to update startup settings.', 'warning');
            // Revert state on failure
            autostartToggle.checked = !enabled;
        });
    });
}

// Khởi chạy render dữ liệu
renderHistory();