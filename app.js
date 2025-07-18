import { SCRIPT_URL } from './config.js'; // Impor dari config.js

// --- SCRIPT UTAMA DASBOR ---
document.addEventListener('DOMContentLoaded', function main() {
    // --- KONFIGURASI ---
    const ROWS_PER_PAGE = 10;
    const DB_NAME = 'SehatDatabase';    const STORE_NAME = 'pelanggan';
    const DB_VERSION = 1;

    // --- ELEMEN DOM ---
    const elements = {
        tableBody: document.getElementById('data-table-body'),
        searchInput: document.getElementById('search-input'),
        refreshBtn: document.getElementById('refresh-btn'),
        ktpModal: document.getElementById('ktp-modal'),
        editModal: document.getElementById('edit-modal'),
        deleteModal: document.getElementById('delete-modal'),
        editForm: document.getElementById('edit-form'),
        cancelEditBtn: document.getElementById('cancel-edit-btn'),
        submitEditBtn: document.getElementById('submit-edit-btn'),
        paginationControls: document.getElementById('pagination-controls'),
        paginationInfo: document.getElementById('pagination-info'),
        prevPageBtn: document.getElementById('prev-page-btn'),
        nextPageBtn: document.getElementById('next-page-btn'),
        filterToggleBtn: document.getElementById('filter-toggle-btn'),
        filterControls: document.getElementById('filter-controls'),
        filterService: document.getElementById('filter-service'),
        filterStartDate: document.getElementById('filter-start-date'),
        filterEndDate: document.getElementById('filter-end-date'),
        clearFiltersBtn: document.getElementById('clear-filters-btn'),
        toastContainer: document.getElementById('toast-container'),
        // Elemen untuk Cropper
        ktpUpload: document.getElementById('edit-ktp-upload'),
        ktpCropperModal: document.getElementById('ktp-cropper-modal'),
        ktpCropperImage: document.getElementById('ktp-cropper-image'),
        ktpCropperSave: document.getElementById('ktp-cropper-save'),
        ktpCropperCancel: document.getElementById('ktp-cropper-cancel'),
        ktpCropperPreview: document.getElementById('ktp-cropper-preview'),
    };

    // --- STATE APLIKASI ---
    let allData = []; // Menyimpan semua data dari server/cache
    let displayedData = []; // Data yang sudah difilter dan diurutkan
    let currentEditingRecord = null;
    let state = {
        currentPage: 1,
        sort: { column: 'Timestamp', order: 'desc' }
    };
    let debounceTimeout;
    let db; // Variabel untuk instance database
    let cropper = null; // Instance Cropper.js
    let croppedKtpBlob = null; // Menyimpan blob gambar yang sudah di-crop

    // --- MANAJEMEN TEMA & IKON ---
    (() => {
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        const darkIcon = document.createElement('div');
        darkIcon.innerHTML = '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path></svg>';
        const lightIcon = document.createElement('div');
        lightIcon.innerHTML = '<svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fill-rule="evenodd" clip-rule="evenodd"></path></svg>';
        themeToggleBtn.appendChild(darkIcon);
        themeToggleBtn.appendChild(lightIcon);
        
        const refreshBtn = document.getElementById('refresh-btn');
        const refreshIcon = document.createElement('div');
        refreshIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 3v5h-5"/></svg>`;
        const refreshSpinner = document.createElement('div');
        refreshSpinner.innerHTML = `<svg class="w-6 h-6 animate-spin hidden" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
        refreshBtn.appendChild(refreshIcon);
        refreshBtn.appendChild(refreshSpinner);

        const filterBtn = document.getElementById('filter-toggle-btn');
        filterBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>`;

        const applyTheme = (theme) => {
            if (theme === 'dark') {
                document.documentElement.classList.add('dark');
                darkIcon.classList.remove('hidden');
                lightIcon.classList.add('hidden');
            } else {
                document.documentElement.classList.remove('dark');
                darkIcon.classList.add('hidden');
                lightIcon.classList.remove('hidden');
            }
            localStorage.setItem('theme', theme);
        };

        const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(savedTheme);

        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(currentTheme);
        });
    })();

    // --- HELPER INDEXEDDB ---
    function openDb() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = (event) => reject("Gagal membuka IndexedDB.");
            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
            request.onupgradeneeded = (event) => {
                const store = event.target.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
            };
        });
    }

    function dbGet(key) {
        return new Promise((resolve, reject) => {
            if (!db) { return resolve(null); }
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.value : null);
            request.onerror = () => reject("Gagal membaca dari DB.");
        });
    }

    function dbSet(key, value) {
        return new Promise((resolve, reject) => {
             if (!db) { return resolve(); }
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ key, value });
            request.onsuccess = () => resolve();
            request.onerror = () => reject("Gagal menyimpan ke DB.");
        });
    }

    // --- FUNGSI REQUEST KE GOOGLE APPS SCRIPT ---
    async function fetchFromScript(action, payload = {}) {
        try {
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action, payload })
            });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            return result;
        } catch (error) {
            console.error(`Error during action '${action}':`, error);
            showToast(error.message, 'error');
            throw error;
        }
    }

    // --- FUNGSI PENGAMBILAN & PEMROSESAN DATA ---
    async function fetchAllDataFromServer() {
        let loadedData = [];
        let currentPage = 1;
        const BATCH_SIZE = 100;
        const MAX_PAGES = 100;

        while (currentPage <= MAX_PAGES) {
            const payload = {
                page: currentPage,
                rowsPerPage: BATCH_SIZE,
                sort: { column: 'Timestamp', order: 'desc' },
                filters: { search: '', service: '', startDate: '', endDate: '' }
            };
            const result = await fetchFromScript('read', payload);
            
            if (result.data && result.data.length > 0) {
                loadedData.push(...result.data);
                if (result.data.length < BATCH_SIZE) break;
                currentPage++;
            } else {
                break;
            }
        }
        return loadedData;
    }

    async function syncData(isInitialLoad = false) {
        toggleLoading(true, elements.refreshBtn);
        if (isInitialLoad) {
            elements.tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-12"><div class="spinner mx-auto"></div><p class="mt-2 text-gray-500 dark:text-slate-400">Memuat data dari server...</p></td></tr>`;
        }

        try {
            const freshData = await fetchAllDataFromServer();
            const oldDataString = JSON.stringify(allData);
            const freshDataString = JSON.stringify(freshData);

            if (oldDataString !== freshDataString) {
                allData = freshData;
                await dbSet('allData', freshData);
                
                populateServiceFilter(allData);
                state.currentPage = 1;
                updateDisplay();
                showToast(`Data berhasil disinkronkan (${freshData.length} baris).`, 'success');
            } else if (!isInitialLoad) {
                showToast('Data sudah yang terbaru.', 'info');
            }
        } catch (error) {
            if (allData.length === 0) {
                 elements.tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-12"><p class="text-red-500">Gagal memuat data. Periksa koneksi Anda dan coba lagi.</p></td></tr>`;
            }
        } finally {
            toggleLoading(false, elements.refreshBtn);
        }
    }
    
    function updateDisplay() {
        const filters = {
            search: elements.searchInput.value.toLowerCase(),
            service: elements.filterService.value,
            startDate: elements.filterStartDate.value,
            endDate: elements.filterEndDate.value
        };

        let filteredData = allData.filter(row => {
            const searchMatch = filters.search ? 
                Object.values(row).some(val => String(val).toLowerCase().includes(filters.search))
                : true;
            const serviceMatch = filters.service ? row['Paket Layanan'] === filters.service : true;
            const dateMatch = (() => {
                if (!filters.startDate && !filters.endDate) return true;
                try {
                    const rowDate = new Date(row.Timestamp);
                    if (isNaN(rowDate.getTime())) return false;
                    
                    let start = filters.startDate ? new Date(filters.startDate) : null;
                    if(start) start.setHours(0, 0, 0, 0);

                    let end = filters.endDate ? new Date(filters.endDate) : null;
                    if(end) end.setHours(23, 59, 59, 999);
                    
                    if (start && end) return rowDate >= start && rowDate <= end;
                    if (start) return rowDate >= start;
                    if (end) return rowDate <= end;
                    return true;
                } catch(e) { return false; }
            })();
            return searchMatch && serviceMatch && dateMatch;
        });

        const { column, order } = state.sort;
        filteredData.sort((a, b) => {
            let valA = a[column] || '';
            let valB = b[column] || '';

            if (column === 'Timestamp') {
                valA = new Date(valA).getTime() || 0;
                valB = new Date(valB).getTime() || 0;
            }

            if (typeof valA === 'string') {
                return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            } else {
                return order === 'asc' ? valA - valB : valB - valA;
            }
        });
        
        updateSortIndicators();
        displayedData = filteredData;
        renderTableForCurrentPage();
        renderPagination();
    }

    function populateServiceFilter(data) {
        const services = [...new Set(data.map(item => item['Paket Layanan']).filter(Boolean))];
        elements.filterService.innerHTML = '<option value="">Semua Paket</option>';
        services.sort().forEach(service => {
            const option = document.createElement('option');
            option.value = service;
            option.textContent = service;
            elements.filterService.appendChild(option);
        });
    }

    // --- FUNGSI RENDER UI ---
    function renderTableForCurrentPage() {
        const start = (state.currentPage - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        const pageData = displayedData.slice(start, end);
        renderTable(pageData);
    }

    function renderTable(registrations) {
        elements.tableBody.innerHTML = '';
        if (!registrations || registrations.length === 0) {
            elements.tableBody.innerHTML = `<tr><td colspan="7" class="text-center p-12"><p class="text-gray-500 dark:text-slate-400">Tidak ada data yang cocok.</p></td></tr>`;
            return;
        }
        registrations.forEach(reg => {
            const tr = document.createElement('tr');
            tr.className = "group hover:bg-gray-50 dark:hover:bg-slate-700";
            tr.dataset.rowId = reg.rowId; 
            tr.dataset.record = JSON.stringify(reg);

            const registrationDate = reg.Timestamp ? new Date(reg.Timestamp).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
            const whatsappLink = formatWhatsAppLink(reg.WhatsApp, reg.Nama, reg['Paket Layanan']);
            const birthDate = formatDate(reg['Tgl Lahir']);

            tr.innerHTML = `
                <td class="px-4 py-4" data-label="Pelanggan"><div class="cell-content-stacked"><div class="text-sm font-medium text-gray-900 dark:text-white">${reg.Nama || '-'}</div><div class="text-sm text-gray-500 dark:text-slate-400">NIK: ${reg.NIK || '-'}</div><div class="text-sm text-gray-500 dark:text-slate-400">Tgl Lahir: ${birthDate}</div></div></td>
                <td class="px-4 py-4" data-label="Kontak"><div class="cell-content-stacked space-y-1"><div class="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M19.05 4.94A10.02 10.02 0 0 0 12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.45 1.27 4.94L2 22l5.06-1.27c1.49.81 3.17 1.27 4.94 1.27h.01c5.52 0 10-4.48 10-10a9.99 9.99 0 0 0-3.01-7.06zM12 20.01h-.01c-1.61 0-3.15-.42-4.49-1.21L7 18.54l-3.32.83.84-3.23a8.01 8.01 0 0 1-1.2-4.63c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8zm4.3-7.5c-.2-.1-.5-.2-1.1-.5s-1.8-.9-2.1-1c-.3-.1-.5-.1-.7.1-.2.2-.8.9-.9 1.1-.1.2-.2.2-.4.1-.2-.1-.8-.3-1.6-1-.6-.5-1-1.1-1.2-1.3-.1-.2 0-.3.1-.4l.2-.2c.1-.1.2-.2.3-.3.1-.1.1-.2.2-.4.1-.2 0-.4 0-.5C10 9.2 9.4 7.8 9.2 7.3c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.8.8-.8 2s.8 2.3 1 2.5c.1.1 1.6 2.5 4 3.5.6.2 1 .4 1.3.5.6.2 1.1.1 1.5.1.4-.1 1.1-.5 1.3-1 .2-.5.2-1 .1-1s-.2-.1-.4-.2z"></path></svg><a href="${whatsappLink}" target="_blank" rel="noopener noreferrer" class="hover:underline text-green-600 dark:text-green-400" title="Kirim pesan WhatsApp">${reg.WhatsApp || '-'}</a></div><div class="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-4 h-4 text-slate-400 flex-shrink-0"><path d="M2.5 3A1.5 1.5 0 0 0 1 4.5v7A1.5 1.5 0 0 0 2.5 13h11a1.5 1.5 0 0 0 1.5-1.5v-7A1.5 1.5 0 0 0 13.5 3h-11ZM2 4.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5v1.269l-5.245 3.497a1.5 1.5 0 0 1-1.51 0L2 5.769V4.5Zm11.5 8h-11a.5.5 0 0 1-.5-.5V6.31l5.022 3.348a2.5 2.5 0 0 0 2.516 0L14 6.31v6.19a.5.5 0 0 1-.5.5Z" /></svg><span>${reg.Email || '-'}</span></div></div></td>
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-slate-400" data-label="Alamat"><div class="max-w-xs lg:max-w-md whitespace-normal" title="${reg.Alamat || ''}">${reg.Alamat || '-'}</div></td>
                <td class="px-4 py-4 text-sm font-medium text-gray-800 dark:text-slate-200" data-label="Layanan">${reg['Paket Layanan'] || '-'}</td>
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-slate-400" data-label="Catatan"><div class="max-w-xs whitespace-normal" title="${reg.Catatan || ''}">${reg.Catatan || '-'}</div></td>
                <td class="px-4 py-4 text-sm text-gray-500 dark:text-slate-400" data-label="Tgl Registrasi">${registrationDate}</td>
                <td class="px-4 py-4 text-center text-sm font-medium action-cell" data-label="Aksi">
                    <div class="flex items-center justify-center space-x-1">
                        <button class="copy-btn p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700" title="Salin Data"></button>
                        <button class="view-ktp-btn p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700" title="Lihat KTP"></button>
                        <button class="edit-btn p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700" title="Edit"></button>
                                <button id="delete-btn-${reg.rowId}" class="delete-btn p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700" title="Hapus"></button>
                    </div>
                </td>
            `;
            tr.querySelector('.copy-btn').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1390d0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>`;
            tr.querySelector('.view-ktp-btn').innerHTML = `<i class="fa-regular fa-id-card text-[#1390d0]" style="font-size: 1.1rem;"></i>`;
            tr.querySelector('.edit-btn').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1390d0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`;
            tr.querySelector('.delete-btn').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 text-[#1390d0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`;
            elements.tableBody.appendChild(tr);
        });
    }

    function renderPagination() {
        const totalRows = displayedData.length;
        const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
        const from = totalRows === 0 ? 0 : (state.currentPage - 1) * ROWS_PER_PAGE + 1;
        const to = Math.min(from + ROWS_PER_PAGE - 1, totalRows);
        
        elements.paginationInfo.textContent = `${from}-${to} dari ${totalRows} data`;
        elements.prevPageBtn.disabled = state.currentPage === 1;
        elements.nextPageBtn.disabled = state.currentPage >= totalPages;
        elements.paginationControls.style.display = totalRows <= ROWS_PER_PAGE ? 'none' : 'flex';
    }
    
    function updateSortIndicators() {
        document.querySelectorAll('.sortable').forEach(header => {
            header.classList.remove('asc', 'desc');
            if (header.dataset.sort === state.sort.column) {
                header.classList.add(state.sort.order);
            }
        });
    }

    // --- FUNGSI HELPER & AKSI ---
    function toggleLoading(isLoading, button) {
        button.disabled = isLoading;
        const text = button.querySelector('.btn-text');
        const spinner = button.querySelector('.btn-spinner') || button.querySelector('.animate-spin');
        if (text && spinner) {
            if (isLoading) {
                button.dataset.originalWidth = button.offsetWidth;
                button.style.minWidth = `${button.dataset.originalWidth}px`;
            }
            text.classList.toggle('hidden', isLoading);
            spinner.classList.toggle('hidden', !isLoading);
        } else if (spinner) {
            const icon = button.querySelector('svg:not(.animate-spin)');
            if (icon) icon.classList.toggle('hidden', isLoading);
            spinner.classList.toggle('hidden', !isLoading);
        }
    }
    
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : 'toast-info')}`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function formatDate(dateString) {
        if (!dateString) return '-';
        try {
            const parts = String(dateString).match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
            if (parts) {
                const date = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
                 if (isNaN(date.getTime())) return dateString;
                return `${parts[1]}-${parts[2]}-${parts[3]}`;
            }
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return dateString;
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch (e) {
            return dateString || '-';
        }
    }

    function formatWhatsAppLink(number, name) {
        if (!number) return '#';
        let cleanedNumber = String(number).replace(/[^0-9]/g, '');
        if (!cleanedNumber) return '#';
        if (cleanedNumber.startsWith('0')) {
            cleanedNumber = '62' + cleanedNumber.substring(1);
        } else if (!cleanedNumber.startsWith('62')) {
            cleanedNumber = '62' + cleanedNumber;
        }
        const message = `Halo ${name}`;
        return `https://wa.me/${cleanedNumber}?text=${encodeURIComponent(message)}`;
    }

    function getDirectGdriveLink(url) {
        if (typeof url !== 'string' || !url.includes('drive.google.com')) return url; 
        const regex = /\/d\/(.*?)(?:\/view|\?usp=sharing|\?usp=drivesdk|$)/;
        const match = url.match(regex);
        return (match && match[1]) ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
    }

    function copyRecordToClipboard(record) {
        const birthDate = formatDate(record['Tgl Lahir']);
        const textToCopy = `
Nama: ${record.Nama || '-'}
NIK: ${record.NIK || '-'}
Tgl Lahir: ${birthDate}
No. WhatsApp: ${record.WhatsApp || '-'}
Email: ${record.Email || '-'}
Alamat: ${record.Alamat || '-'}
Paket Layanan: ${record['Paket Layanan'] || '-'}
Catatan: ${record.Catatan || '-'}
                `.trim().replace(/^\s+/gm, '');
        navigator.clipboard.writeText(textToCopy)
            .then(() => showToast('Data disalin.', 'success'))
            .catch(() => showToast('Gagal menyalin data.', 'error'));
    }

    async function handleUpdate(e) {
        e.preventDefault();
        if (!currentEditingRecord) return;

        toggleLoading(true, elements.submitEditBtn);
        const rowId = document.getElementById('edit-row-id').value;

        // This is the final object sent to the 'update' action
        const updatePayload = {
            rowId: parseInt(rowId),
            data: {
                'Timestamp': currentEditingRecord.Timestamp,
                'Nama': document.getElementById('edit-nama').value,
                'NIK': document.getElementById('edit-nik').value,
                'Tgl Lahir': document.getElementById('edit-tgl_lahir').value,
                'WhatsApp': document.getElementById('edit-whatsapp').value,
                'Email': document.getElementById('edit-email').value,
                'Alamat': document.getElementById('edit-alamat').value,
                'Paket Layanan': document.getElementById('edit-paket_layanan').value,
                'Catatan': document.getElementById('edit-catatan').value,
                'URL Foto KTP': currentEditingRecord['URL Foto KTP'], // Send old URL as a fallback
            }
        };

        try {
            // If there's a new cropped image, convert it to base64 and add it to the payload.
            // The backend 'update' action will need to handle this `ktpFileData` object.
            if (croppedKtpBlob) {
                showToast('Menyiapkan foto KTP...', 'info');
                const base64Image = await blobToBase64(croppedKtpBlob);
                const namaPelanggan = updatePayload.data.Nama.replace(/\s+/g, '_').toUpperCase();
                // Add the file data directly into the data object.
                // The backend can check for this property.
                updatePayload.data.ktpFileData = {
                    fileName: `KTP_${namaPelanggan}_${updatePayload.data.NIK || Date.now()}.jpg`,
                    mimeType: croppedKtpBlob.type,
                    data: base64Image.split(',')[1] // Send only base64 data
                };
            }

            // Send a single 'update' request with all data (text and potentially image)
            await fetchFromScript('update', updatePayload);
            
            showToast('Data berhasil diperbarui. Memuat ulang...', 'success');
            elements.editModal.classList.add('hidden');
            
            // The simplest and most reliable way to see the change (especially the new image URL)
            // is to re-sync all data from the server.
            await syncData(false);

        } catch (error) {
            // Error is already handled by showToast in fetchFromScript
        } finally {
            toggleLoading(false, elements.submitEditBtn);
            currentEditingRecord = null;
        }
    }

    async function handleDelete(rowId) {
        try {
            await fetchFromScript('delete', { rowId });
            showToast('Data berhasil dihapus.', 'success');
            elements.deleteModal.innerHTML = '';
            elements.deleteModal.classList.add('hidden');
            
            const wasOnPage = state.currentPage;
            allData = allData.filter(item => item.rowId != rowId);
            await dbSet('allData', allData);
            
            // Check if the page the user was on is now empty and it wasn't the first page.
            const totalPagesAfterDelete = Math.ceil(displayedData.length / ROWS_PER_PAGE);
            if (wasOnPage > totalPagesAfterDelete && wasOnPage > 1) {
                state.currentPage = totalPagesAfterDelete > 0 ? totalPagesAfterDelete : 1;
            }
            updateDisplay();
        } catch (error) { /* Error ditangani */ }
    }

    // --- FITUR UPLOAD & CROP KTP ---
    function setupKtpCropper() {
        elements.ktpUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                elements.ktpCropperImage.src = ev.target.result;
                elements.ktpCropperModal.classList.remove('hidden');
                if (cropper) cropper.destroy();
                setTimeout(() => { // Beri sedikit waktu agar modal terlihat sebelum cropper aktif
                    cropper = new Cropper(elements.ktpCropperImage, {
                        aspectRatio: 16 / 10,
                        viewMode: 1,
                        autoCropArea: 1,
                        responsive: true,
                        background: false,
                    });
                }, 100);
            };
            reader.readAsDataURL(file);
        });

        elements.ktpCropperCancel.addEventListener('click', () => {
            elements.ktpCropperModal.classList.add('hidden');
            if (cropper) cropper.destroy();
            cropper = null;
            elements.ktpUpload.value = ''; // Reset input file
        });

        elements.ktpCropperSave.addEventListener('click', () => {
            if (!cropper) return;
            cropper.getCroppedCanvas({ width: 800 }).toBlob(blob => {
                croppedKtpBlob = blob;
                const url = URL.createObjectURL(blob);
                elements.ktpCropperPreview.innerHTML = `<img src="${url}" class="max-h-32 rounded border mt-2 shadow-sm" alt="Pratinjau KTP">`;
                elements.ktpCropperModal.classList.add('hidden');
                if (cropper) cropper.destroy();
                cropper = null;
            }, 'image/jpeg', 0.9);
        });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // --- SETUP EVENT LISTENERS ---
    function setupEventListeners() {
        elements.refreshBtn.addEventListener('click', () => syncData(false));

        elements.searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                state.currentPage = 1;
                updateDisplay();
            }, 50);
        });
        
        elements.tableBody.addEventListener('click', (e) => {
            const recordRow = e.target.closest('tr');
            if (!recordRow || !recordRow.dataset.record) return;
            const record = JSON.parse(recordRow.dataset.record);
            if (e.target.closest('.copy-btn')) copyRecordToClipboard(record);
            if (e.target.closest('.edit-btn')) showModal('edit', record);
            if (e.target.closest('.delete-btn')) showModal('delete', record);
            if (e.target.closest('.view-ktp-btn')) showModal('ktp', record);
        });

        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const column = header.dataset.sort;
                if (state.sort.column === column) {
                    state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sort.column = column;
                    state.sort.order = 'asc';
                }
                updateDisplay();
            });
        });

        elements.prevPageBtn.addEventListener('click', () => { 
            if (state.currentPage > 1) { 
                state.currentPage--; 
                renderTableForCurrentPage(); 
                renderPagination(); 
            } 
        });
        elements.nextPageBtn.addEventListener('click', () => { 
            const totalPages = Math.ceil(displayedData.length / ROWS_PER_PAGE);
            if (state.currentPage < totalPages) { 
                state.currentPage++; 
                renderTableForCurrentPage(); 
                renderPagination(); 
            } 
        });
        
        elements.filterToggleBtn.addEventListener('click', () => elements.filterControls.classList.toggle('hidden'));
        
        const applyFilters = () => { state.currentPage = 1; updateDisplay(); };
        elements.filterService.addEventListener('change', applyFilters);
        elements.filterStartDate.addEventListener('change', applyFilters);
        elements.filterEndDate.addEventListener('change', applyFilters);
        elements.clearFiltersBtn.addEventListener('click', () => {
            elements.filterService.value = '';
            elements.filterStartDate.value = '';
            elements.filterEndDate.value = '';
            applyFilters();
        });

        elements.editForm.addEventListener('submit', handleUpdate);
        elements.cancelEditBtn.addEventListener('click', () => {
            elements.editModal.classList.add('hidden');
            currentEditingRecord = null;
        });
    }
    
    function showModal(type, record) {
        let modal;
        switch (type) {
            case 'edit':
                // Reset state cropper sebelum menampilkan modal
                elements.ktpCropperPreview.innerHTML = '';
                croppedKtpBlob = null;
                elements.ktpUpload.value = '';

                currentEditingRecord = record;
                const timestampDisplay = document.getElementById('edit-timestamp-display');
                timestampDisplay.textContent = record.Timestamp ? `Registrasi: ${new Date(record.Timestamp).toLocaleString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB` : '';
                
                document.getElementById('edit-row-id').value = record.rowId;
                document.getElementById('edit-nama').value = record.Nama || '';
                document.getElementById('edit-nik').value = record.NIK || '';
                document.getElementById('edit-tgl_lahir').value = formatDate(record['Tgl Lahir']);
                document.getElementById('edit-whatsapp').value = record.WhatsApp || '';
                document.getElementById('edit-email').value = record.Email || '';
                document.getElementById('edit-alamat').value = record.Alamat || '';
                document.getElementById('edit-paket_layanan').value = record['Paket Layanan'] || '';
                document.getElementById('edit-catatan').value = record.Catatan || '';
                elements.editModal.classList.remove('hidden');
                break;
                case 'delete':
                modal = elements.deleteModal;
                modal.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-sm w-full text-center"><h3 class="text-lg font-medium text-gray-900 dark:text-white mt-5">Hapus Data</h3><p class="mt-2 text-sm text-gray-500 dark:text-slate-400">Yakin ingin menghapus data untuk <strong>${record.Nama}</strong>?</p><div class="mt-6 flex justify-center space-x-3"><button class="modal-cancel-btn px-4 py-2 bg-gray-200 dark:bg-slate-600 rounded-md">Batal</button><button class="modal-confirm-delete-btn px-4 py-2 bg-red-600 text-white rounded-md">Ya, Hapus</button></div></div>`;
                modal.classList.remove('hidden');

                const cancelButton = modal.querySelector('.modal-cancel-btn');
                const confirmButton = modal.querySelector('.modal-confirm-delete-btn');
                cancelButton.onclick = () => modal.classList.add('hidden');
                confirmButton.onclick = async () => { 
                    toggleLoading(true, confirmButton);
                    try {
                        await handleDelete(record.rowId);
                        modal.classList.add('hidden');
                    } finally {
                        toggleLoading(false, confirmButton);
                    }                
                };
                // Add spinner and initial HTML structure
                confirmButton.innerHTML = `<span class="btn-text">Ya, Hapus</span><svg class="animate-spin h-5 w-5 text-white hidden btn-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;

                break;
            case 'ktp':
                modal = elements.ktpModal;
                const directKtpUrl = getDirectGdriveLink(record['URL Foto KTP']);
                const imageContainerId = `ktp-image-container-${record.rowId}`;
                const errorContainerId = `ktp-error-container-${record.rowId}`;

                modal.innerHTML = `
                    <div class="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 max-w-lg w-full relative flex flex-col">
                        <button class="modal-cancel-btn absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                        <div class="flex flex-col items-center text-center">
                            <h3 class="text-xl font-bold mb-4 w-full break-words">KTP: ${record.Nama}</h3>
                            <div class="w-full h-64 bg-gray-200 dark:bg-slate-700 flex items-center justify-center rounded mt-2">
                                <div id="${imageContainerId}">
                                    <img src="${directKtpUrl}" class="max-w-full max-h-full object-contain" onerror="document.getElementById('${imageContainerId}').classList.add('hidden'); document.getElementById('${errorContainerId}').classList.remove('hidden');">
                                </div>
                                <div id="${errorContainerId}" class="hidden"><span class="text-gray-500 dark:text-slate-400">Gambar Tidak Tersedia</span></div>
                            </div>
                        </div>
                    </div>`;
                modal.classList.remove('hidden');
                modal.querySelector('.modal-cancel-btn').onclick = () => modal.classList.add('hidden');
                break;
        }
    }

    // --- INISIALISASI APLIKASI ---
    async function initializeApp() {
        try {
            await openDb();
            const cachedData = await dbGet('allData');

            if (cachedData && cachedData.length > 0) {
                showToast('Memuat data dari cache...', 'info');
                allData = cachedData;
                populateServiceFilter(allData);
                updateDisplay();
                syncData(false);
            } else {
                syncData(true);
            }
        } catch (error) {
            console.error("Gagal menginisialisasi DB, menggunakan mode fallback:", error);
            showToast("Gagal memuat cache, mengambil data langsung.", "error");
            syncData(true);
        }

        setupEventListeners();
        setupKtpCropper(); // Panggil setup untuk cropper
        updateSortIndicators();
    }

    initializeApp();
});