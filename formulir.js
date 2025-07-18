import { SCRIPT_URL, GEMINI_API_KEY } from './config.js'; // Impor dari config.js

document.addEventListener('DOMContentLoaded', main);

function main() {
    // --- KONFIGURASI ---
    // URL sudah diimpor, jadi hapus deklarasi di sini
    // API Key sudah diimpor, hapus deklarasi lokal
    
    const BLUR_THRESHOLD = 100;

    // --- Pengecekan Konfigurasi ---
    if (!SCRIPT_URL || SCRIPT_URL.includes("GANTI_DENGAN_URL_WEB_APP_ANDA")) {
        document.getElementById('app-content').classList.add('hidden');
        const warning = document.getElementById('config-warning-overlay');
        warning.querySelector('h2').textContent = 'Konfigurasi Google Sheet Diperlukan';
        warning.querySelector('p:nth-of-type(1)').innerHTML = 'Aplikasi ini belum terhubung ke Google Sheet. Harap masukkan <strong>URL Web App</strong> Anda di dalam kode HTML.';
        warning.querySelector('p:nth-of-type(2)').innerHTML = '(Lihat variabel <code>SCRIPT_URL</code>).';
        warning.classList.remove('hidden');
        return;
    }

    // --- Elemen DOM ---
    const elements = {
        ktpUpload: document.getElementById('ktp-upload'),
        nama: document.getElementById('nama'),
        nik: document.getElementById('nik'),
        tgl_lahir: document.getElementById('tgl_lahir'),
        ocrResults: document.getElementById('ocr-results'),
        imagePreview: document.getElementById('image-preview'),
        imageStatus: document.getElementById('image-status'),
        submitBtn: document.getElementById('submit-btn'),
        dataForm: document.getElementById('data-form'),
        uploadBox: document.getElementById('upload-box'),
        previewArea: document.getElementById('preview-area'),
        cropModal: document.getElementById('crop-modal'),
        imageToCrop: document.getElementById('image-to-crop'),
        cropBtn: document.getElementById('crop-btn'),
        cancelCropBtn: document.getElementById('cancel-crop-btn'),
        notificationModal: document.getElementById('notification-modal'),
        notificationContent: document.getElementById('notification-content'),
        closeModalBtn: document.getElementById('close-modal-btn'),
    };

    let cropper, ktpImageBase64 = null;

    // Cek Pustaka Cropper.js
    if (typeof Cropper === 'undefined') {
        document.getElementById('app-content').classList.add('hidden');
        const warningOverlay = document.getElementById('config-warning-overlay');
        warningOverlay.querySelector('h2').textContent = 'Pustaka Hilang';
        warningOverlay.querySelector('p').textContent = 'Pustaka Cropper.js gagal dimuat. Harap periksa koneksi internet dan muat ulang halaman.';
        warningOverlay.classList.remove('hidden');
        return;
    }

    // --- FUNGSI-FUNGSI ---

    const showCropper = (imageUrl) => {
        elements.imageToCrop.src = imageUrl;
        elements.cropModal.classList.remove('hidden');
        if (cropper) cropper.destroy();
        cropper = new Cropper(elements.imageToCrop, {
            aspectRatio: 85.6 / 54, viewMode: 2, dragMode: 'move',
            background: false, autoCropArea: 0.9
        });
    };

    const resetApp = () => {
        elements.dataForm.reset();
        elements.ktpUpload.value = '';
        if(cropper) cropper.destroy();
        elements.cropModal.classList.add('hidden');
        elements.previewArea.classList.add('hidden');
        elements.uploadBox.classList.remove('hidden');
        elements.imageStatus.textContent = '';
        elements.submitBtn.disabled = true;
        const originalButtonHTML = `<svg class="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg> Kirim Data`;
        elements.submitBtn.innerHTML = originalButtonHTML;
        ktpImageBase64 = null;
        elements.ocrResults.classList.add('hidden');
        makeOcrFieldsEditable(false);
    };

    const calculateBlurScore = (imageDataUrl) => {
        return new Promise((resolve, reject) => {
            const i = new Image();
            i.src = imageDataUrl;
            i.onload = () => {
                const c = document.createElement('canvas'), x = c.getContext('2d', { willReadFrequently: true });
                c.width = i.width; c.height = i.height;
                x.drawImage(i, 0, 0);
                const d = x.getImageData(0, 0, c.width, c.height);
                const g = [];
                for (let j = 0; j < d.data.length; j += 4) g.push(d.data[j] * 0.299 + d.data[j + 1] * 0.587 + d.data[j + 2] * 0.114);
                const l = [0, 1, 0, 1, -4, 1, 0, 1, 0];
                let s = 0, q = 0; const v = [];
                for (let y = 1; y < c.height - 1; y++) for (let z = 1; z < c.width - 1; z++) {
                    let a = 0, k = 0;
                    for (let ky = -1; ky <= 1; ky++) for (let kx = -1; kx <= 1; kx++) a += g[(y + ky) * c.width + (z + kx)] * l[k++];
                    v.push(a); s += a; q += a * a;
                }
                const m = s / v.length;
                resolve(q / v.length - m * m);
            };
            i.onerror = reject;
        });
    };

    const makeOcrFieldsEditable = (isEditable) => {
        ['nama', 'nik', 'tgl_lahir'].forEach(id => {
            const el = document.getElementById(id);
            el.readOnly = !isEditable;
            if (isEditable) {
                el.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-500', 'dark:text-gray-400');
                el.classList.add('bg-gray-50', 'dark:bg-gray-700', 'text-gray-900', 'dark:text-white', 'focus:ring-2', 'focus:ring-[#1390d0]');
            } else {
                el.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-500', 'dark:text-gray-400');
                el.classList.remove('bg-gray-50', 'dark:bg-gray-700', 'text-gray-900', 'dark:text-white', 'focus:ring-2', 'focus:ring-[#1390d0]');
            }
        });
    };

    const extractKtpData = async (base64ImageData) => {
        if (!GEMINI_API_KEY || GEMINI_API_KEY === "MASUKKAN_API_KEY_VALID_ANDA_DI_SINI") {
             elements.imageStatus.innerHTML = `<span class="text-yellow-500">Fitur OCR non-aktif. Silakan isi data manual.</span>`;
             elements.ocrResults.classList.remove('hidden');
             makeOcrFieldsEditable(true);
             elements.submitBtn.disabled = false;
             return;
         }
        elements.imageStatus.innerHTML = `<div class="spinner"></div><span>Mengekstrak data dari KTP...</span>`;
        const prompt = `From the provided image of an Indonesian KTP (identity card), extract the following information and return it as a valid JSON object. 1. "nama": The full name. 2. "nik": The 16-digit NIK. 3. "tgl_lahir": The date of birth, formatted as DD-MM-YYYY. If a field is not found, return null for that specific field.`;
        const payload = {
            contents: [{ parts: [ { text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64ImageData.split(',')[1] }}] }],
            generationConfig: { responseMimeType: "application/json" }
        };
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData?.error?.message || 'Unknown API error.';
                throw new Error(`API request failed: ${errorMessage}`);
            }
            const result = await response.json();
            if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
                throw new Error('Invalid response structure from API.');
            }
            const textContent = result.candidates[0].content.parts[0].text;
            const ocrData = JSON.parse(textContent);
            elements.nama.value = ocrData.nama || '';
            elements.nik.value = ocrData.nik || '';
            elements.tgl_lahir.value = ocrData.tgl_lahir || '';
            elements.ocrResults.classList.remove('hidden');
            elements.imageStatus.innerHTML = `<span class="text-green-500">✓ Ekstraksi berhasil. Mohon periksa kembali data Anda.</span>`;
            makeOcrFieldsEditable(true);
            elements.submitBtn.disabled = false;
        } catch (error) {
            console.error("OCR Extraction Error:", error);
            elements.ocrResults.classList.remove('hidden');
            makeOcrFieldsEditable(true);
            elements.imageStatus.innerHTML = `<span class="text-red-500">Gagal ekstrak data: ${error.message}. Silakan isi manual.</span>`;
            elements.submitBtn.disabled = false;
        }
    };
    
    const showNotification = (mainMessage, subMessage, data = null, isError = false) => {
        let iconHtml = '';
        if (isError) {
            iconHtml = `
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <svg class="h-6 w-6 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                </div>`;
        } else {
            iconHtml = `
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <svg class="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </div>`;
        }

        let dataSummaryHtml = '';
        if (data) {
            const dataMap = {
                'Nama': data.nama, 'NIK': data.nik, 'Tgl Lahir': data.tgl_lahir,
                'No. WhatsApp': data.whatsapp, 'Email': data.email, 'Alamat': data.alamat,
                'Paket Layanan': data.paket_layanan, 'Catatan': data.catatan
            };
            let itemsHtml = '';
            for (const key in dataMap) {
                if (dataMap[key]) {
                    itemsHtml += `
                        <div class="summary-item">
                            <span class="summary-label">${key}</span>
                            <span class="summary-value">${dataMap[key]}</span>
                        </div>`;
                }
            }
            dataSummaryHtml = `<div class="mt-4"><div class="summary-list">${itemsHtml}</div></div>`;
        }

        elements.notificationContent.innerHTML = `
            ${iconHtml}
            <div class="mt-3 text-center sm:mt-4">
                <h3 class="text-lg leading-6 font-bold text-gray-900 dark:text-white">${mainMessage}</h3>
                <div class="mt-2">
                    <p class="text-sm text-gray-500 dark:text-gray-400">${subMessage}</p>
                </div>
            </div>
            ${dataSummaryHtml}
        `;
        
        elements.notificationModal.classList.remove('hidden');
    };
    
    const submitToGoogleSheet = async (data, notificationHtml) => {
        try {
            elements.submitBtn.innerHTML = `<div class="spinner"></div><span>Mengirim data...</span>`;
            
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                // PENTING: Body tidak memerlukan properti "action" agar dikenali sebagai "create"
                body: JSON.stringify({ ...data, notificationHtml: notificationHtml })
            });

            const result = await response.json();

            if (result.status === "success") {
                return { success: true };
            } else {
                throw new Error(result.message || "Unknown error from Google Script.");
            }
        } catch (error) {
            console.error("Google Sheet Submission Error:", error);
            return { success: false, message: `Gagal menyimpan ke Google Sheet: ${error.message}` };
        }
    };

    // --- EVENT LISTENERS ---
    elements.ktpUpload.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => showCropper(event.target.result);
        reader.readAsDataURL(file);
    });

    elements.cancelCropBtn.addEventListener('click', resetApp);
    
    elements.cropBtn.addEventListener('click', async () => {
        if (!cropper) return;
        elements.imageStatus.innerHTML = `<div class="spinner"></div><span>Menganalisis kualitas gambar...</span>`;
        const highQualityCanvas = cropper.getCroppedCanvas({ width: 800, fillColor: '#fff' });
        ktpImageBase64 = highQualityCanvas.toDataURL('image/jpeg', 0.9);
        const analysisCanvas = document.createElement('canvas'), analysisCtx = analysisCanvas.getContext('2d');
        const analysisWidth = 200;
        analysisCanvas.width = analysisWidth;
        analysisCanvas.height = highQualityCanvas.height * (analysisWidth / highQualityCanvas.width);
        analysisCtx.drawImage(highQualityCanvas, 0, 0, analysisCanvas.width, analysisCanvas.height);
        const analysisImageDataUrl = analysisCanvas.toDataURL('image/jpeg');
        elements.imagePreview.src = ktpImageBase64;
        elements.uploadBox.classList.add('hidden');
        elements.previewArea.classList.remove('hidden');
        elements.cropModal.classList.add('hidden');
        try {
            const score = await calculateBlurScore(analysisImageDataUrl);
            if (score >= BLUR_THRESHOLD) {
                await extractKtpData(ktpImageBase64);
            } else {
                elements.imageStatus.innerHTML = `<span class="text-red-500">✗ Gambar buram! Harap unggah foto yang lebih jelas.</span>`;
                ktpImageBase64 = null; elements.submitBtn.disabled = true;
            }
        } catch (error) {
            console.error("Image Analysis Error:", error);
            elements.imageStatus.innerHTML = `<span class="text-red-500">Gagal menganalisis gambar. Coba lagi.</span>`;
            ktpImageBase64 = null; elements.submitBtn.disabled = true;
        }
    });
    
    elements.dataForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!ktpImageBase64) {
            showNotification('Gagal', 'Harap unggah gambar KTP yang valid.', null, true);
            return;
        }
        
        const originalButtonHTML = elements.submitBtn.innerHTML;
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = `<div class="spinner"></div><span>Mengumpulkan data...</span>`;
        
        const formData = {
            nama: elements.nama.value,
            nik: elements.nik.value,
            tgl_lahir: elements.tgl_lahir.value,
            whatsapp: document.getElementById('whatsapp').value,
            email: document.getElementById('email').value,
            alamat: document.getElementById('alamat').value,
            paket_layanan: document.getElementById('paket_layanan').value,
            catatan: document.getElementById('catatan').value,
            ktpImageBase64: ktpImageBase64
        };

        try {
        // Ambil HTML dari notifikasi sebelum dikirim
            const notificationElement = document.getElementById('notification-content');
            // Tampilkan notifikasi terlebih dahulu untuk mendapatkan innerHTML-nya
            showNotification('Pendaftaran Berhasil!', 'Terima kasih...', formData, false);
            const notificationHtml = notificationElement.innerHTML;

            // Kirim data form beserta HTML notifikasi ke backend
            const result = await submitToGoogleSheet(formData, notificationHtml);

            if (result.success) {
                // Jika SUKSES, ubah teks pesan pada notifikasi yang sudah ditampilkan
                notificationElement.querySelector('p').textContent = 'Terima kasih. Data pendaftaran Anda telah kami terima, mohon tunjukkan bukti pendaftaran kepada sales.';
            } else {
                // Jika GAGAL, tampilkan notifikasi error yang baru
                showNotification('GAGAL', `Gagal menyimpan data. ${result.message || 'Silakan coba lagi.'}`, null, true);
            }
        } catch(error) {
            console.error("Submission Process Error:", error);
            showNotification('Gagal', 'Terjadi kesalahan tak terduga pada proses pengiriman.', null, true);
        } finally {
            elements.submitBtn.innerHTML = originalButtonHTML;
            elements.submitBtn.disabled = false;
        }
    });

    elements.closeModalBtn.addEventListener('click', () => {
        elements.notificationModal.classList.add('hidden');
        const isError = elements.notificationContent.querySelector('.bg-red-100') !== null;
        if (!isError) {
            resetApp();
        }
    });
}