// =================================================================
// KONFIGURASI UTAMA (UNTUK FORMULIR & DASBOR)
// =================================================================
const SHEET_NAME = "Data Registrasi"; 
const DRIVE_FOLDER_ID = "1FJZp9ZxEt7V047W3atnOMtjieU-gOuxO";

// =================================================================
// FUNGSI UTAMA (ROUTER)
// =================================================================

/**
 * Fungsi utama yang menerima semua permintaan POST.
 * Fungsi ini akan membedakan permintaan dari formulir (membuat data baru)
 * atau dari dasbor (membaca, update, hapus data).
 */
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);

    // Jika ada properti 'action', maka ini adalah permintaan dari dasbor.
    if (request.action) {
      switch (request.action) {
        case 'read':
          return handleRead(request.payload);
        case 'update':
          return handleUpdate(request.payload);
        case 'delete':
          return handleDelete(request.payload);
        case 'getServices':
          return handleGetServices();
        // PERBAIKAN: Menambahkan case untuk ekspor, meskipun tombolnya dihapus di UI,
        // ini membuat skrip lebih lengkap jika dibutuhkan lagi.
        case 'exportAll':
          return handleExportAll();
        default:
          return createJsonResponse({ status: 'error', message: 'Aksi dasbor tidak valid' });
      }
    } 
    // Jika tidak ada 'action', maka ini adalah kiriman data baru dari formulir registrasi.
    else {
      return handleCreate(request);
    }
  } catch (error) {
    Logger.log("Error di doPost: " + error.toString() + " | Data: " + e.postData.contents);
    return createJsonResponse({ status: 'error', message: `Server Error: ${error.toString()}` });
  }
}

// =================================================================
// HANDLER UNTUK SETIAP AKSI
// =================================================================

/**
 * HANDLER UNTUK FORMULIR: Membuat data baru.
 */
function handleCreate(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  
  // Handle upload gambar ke Google Drive
  let imageUrl = "Tidak ada gambar";
  if (data.ktpImageBase64) {
    try {
      const decodedImage = Utilities.base64Decode(data.ktpImageBase64.split(',')[1]);
      const blob = Utilities.newBlob(decodedImage, 'image/jpeg', `KTP_${data.nama.replace(/\s/g, '_')}_${new Date().getTime()}.jpg`);
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      imageUrl = file.getUrl();
    } catch (driveError) {
       Logger.log("Google Drive Error: " + driveError.toString());
       imageUrl = "Error: " + driveError.toString();
    }
  }

    // --- Membuat dan menyimpan PDF Bukti Pendaftaran ---
  let pdfUrl = "Gagal membuat PDF";
  if (data.notificationHtml) {
    // Kita tidak lagi menggunakan data.notificationHtml, tapi keberadaannya
    // menandakan bahwa ini adalah panggilan dari formulir yang butuh PDF.
    try {
      const dataMap = {
        'Nama': data.nama, 'NIK': data.nik, 'Tgl Lahir': data.tgl_lahir,
        'No. WhatsApp': data.whatsapp, 'Email': data.email, 'Alamat': data.alamat,
        'Paket Layanan': data.paket_layanan, 'Catatan': data.catatan
      };
      
      let summaryRows = '';
      for (const key in dataMap) {
        if (dataMap[key]) {
          summaryRows += `
            <tr>
              <td class="label">${key}</td>
              <td class="value">${dataMap[key]}</td>
            </tr>`;
        }
      }

      // Template HTML baru yang meniru tampilan formulir dengan CSS inline.
      const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; color: #374151; font-size: 14px; }
            .container { width: 450px; margin: auto; padding: 24px; border-radius: 1rem; border: 1px solid #e5e7eb; }
            .header { text-align: center; }
            .icon-wrapper { display: inline-block; background-color: #dcfce7; border-radius: 9999px; padding: 12px; }
            .icon-wrapper svg { width: 24px; height: 24px; stroke: #166534; }
            .title { font-size: 1.125rem; font-weight: bold; margin-top: 12px; margin-bottom: 0; color: #111827;}
            .subtitle { font-size: 0.875rem; color: #6b7280; margin-top: 8px; }
            .summary-table { width: 100%; border-collapse: collapse; margin-top: 20px; border-top: 1px solid #e5e7eb; }
            .summary-table td { padding: 10px 4px; border-bottom: 1px solid #e5e7eb; }
            .label { color: #6b7280; font-weight: 500; }
            .value { text-align: right; font-weight: 600; color: #111827; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              </div>
              <h3 class="title">Pendaftaran Berhasil!</h3>
              <p class="subtitle">Terima kasih. Data pendaftaran Anda telah kami terima.</p>
            </div>
            <table class="summary-table">
              ${summaryRows}
            </table>
          </div>
        </body>
      </html>`;

      const htmlFile = DriveApp.createFile('temp_receipt.html', htmlContent, MimeType.HTML);      
      // Konversi HTML ke PDF
      const pdfBlob = htmlFile.getAs(MimeType.PDF);
      pdfBlob.setName(`Bukti_Pendaftaran_${data.nama.replace(/\s/g, '_')}_${new Date().getTime()}.pdf`);
      
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const pdfFile = folder.createFile(pdfBlob);
      pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      pdfUrl = pdfFile.getUrl();
      
      DriveApp.getFileById(htmlFile.getId()).setTrashed(true); // Hapus file HTML sementara
    } catch(pdfError) { Logger.log("PDF Creation Error: " + pdfError.toString()); pdfUrl = "Error: " + pdfError.toString(); }
  }

  // Tambahkan baris baru ke sheet. Pastikan urutan kolom di sheet Anda sama.
  sheet.appendRow([
    new Date(), // Timestamp
    data.nama || '',
    data.nik || '',
    data.tgl_lahir || '',
    data.whatsapp || '',
    data.email || '',
    data.alamat || '',
    data.paket_layanan || '',
    data.catatan || '',
    imageUrl, // URL Foto KTP
    pdfUrl // URL Bukti Pendaftaran
  ]);

  return createJsonResponse({ status: 'success', message: 'Data berhasil disimpan!' });
}


/**
 * HANDLER UNTUK DASBOR: Membaca data dengan filter, sort, dan paginasi.
 */
function handleRead(payload) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const allData = sheet.getDataRange().getValues();
  const headers = allData.shift();

  let records = allData.map((row, index) => {
    let record = {};
    headers.forEach((header, i) => {
      if (header === 'Timestamp' && row[i] instanceof Date) {
        record[header] = row[i].toISOString();
      } else {
        record[header] = row[i];
      }
    });
    record.rowId = index + 2;
    return record;
  }).reverse(); // Membaca dari data terbaru

  // Filter, Sort, dan Paginasi
  if (payload.filters) {
    const { search, service, startDate, endDate } = payload.filters;
    records = records.filter(rec => {
      const searchMatch = !search || Object.values(rec).some(val => 
        String(val).toLowerCase().includes(search.toLowerCase())
      );
      const serviceMatch = !service || rec['Paket Layanan'] === service;
      
      // --- PERBAIKAN LOGIKA FILTER TANGGAL ---
      const recordDate = new Date(rec['Timestamp']);
      
      let startMatch = true;
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Set ke awal hari
        startMatch = recordDate >= start;
      }

      let endMatch = true;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Set ke akhir hari
        endMatch = recordDate <= end;
      }
      // --- AKHIR PERBAIKAN ---

      return searchMatch && serviceMatch && startMatch && endMatch;
    });
  }
  
  const totalFilteredRows = records.length;

  if (payload.sort && payload.sort.column) {
    const { column, order } = payload.sort;
    const sortColumnName = getHeaderName(column);
    records.sort((a, b) => {
      let valA = a[sortColumnName] || '';
      let valB = b[sortColumnName] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const from = (payload.page - 1) * payload.rowsPerPage;
  const to = from + payload.rowsPerPage;
  const paginatedData = records.slice(from, to);

  return createJsonResponse({
    status: 'success',
    data: paginatedData,
    totalRows: totalFilteredRows
  });
}

/**
 * HANDLER UNTUK DASBOR: Memperbarui satu baris data, termasuk foto KTP jika ada.
 */
function handleUpdate(payload) {
  const { rowId, data } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Salin data yang ada untuk dimodifikasi
  let updatedData = { ...data };

  // 1. Periksa apakah ada file KTP baru yang diunggah (`ktpFileData` dikirim dari frontend)
  if (updatedData.ktpFileData) {
    try {
      const fileData = updatedData.ktpFileData;
      const decodedData = Utilities.base64Decode(fileData.data, Utilities.Charset.UTF_8);
      const blob = Utilities.newBlob(decodedData, fileData.mimeType, fileData.fileName);
      
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const newFile = folder.createFile(blob);
      newFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); // Pastikan file bisa diakses
      
      // 2. Dapatkan URL file baru dan perbarui kolom 'URL Foto KTP'
      updatedData['URL Foto KTP'] = newFile.getUrl(); 
      
    } catch (e) {
      Logger.log("Gagal mengunggah file KTP saat update: " + e.toString());
      // Jika gagal, URL foto tidak akan diubah dan akan menggunakan nilai lama.
    }
  }
  
  // 3. Hapus properti ktpFileData agar tidak coba ditulis ke sheet
  delete updatedData.ktpFileData;

  // 4. Urutkan data yang akan diupdate sesuai dengan urutan header di sheet
  const rowData = headers.map(header => updatedData[header] !== undefined ? updatedData[header] : '');
  
  // 5. Tulis data yang sudah diupdate ke baris yang benar
  sheet.getRange(rowId, 1, 1, rowData.length).setValues([rowData]);
  
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Data berhasil diperbarui' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * HANDLER UNTUK DASBOR: Menghapus satu baris data.
 */
function handleDelete(payload) {
  const { rowId } = payload;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  sheet.deleteRow(rowId);
  
  return createJsonResponse({ status: 'success', message: 'Data berhasil dihapus' });
}

/**
 * HANDLER UNTUK DASBOR: Mendapatkan daftar unik paket layanan.
 */
function handleGetServices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const serviceColumnIndex = sheet.getDataRange().getValues()[0].indexOf('Paket Layanan') + 1;
  if (serviceColumnIndex === 0) return createJsonResponse({ status: 'success', data: [] });

  const values = sheet.getRange(2, serviceColumnIndex, sheet.getLastRow() - 1, 1).getValues();
  const uniqueServices = [...new Set(values.map(item => item[0]).filter(Boolean))];
  
  return createJsonResponse({ status: 'success', data: uniqueServices });
}

/**
 * HANDLER UNTUK DASBOR: Mengambil semua data untuk diekspor.
 */
function handleExportAll() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const allData = sheet.getDataRange().getValues();
  const headers = allData.shift();

  const records = allData.map((row, index) => {
    let record = {};
    headers.forEach((header, i) => {
      record[header] = row[i];
    });
    record.rowId = index + 2;
    return record;
  });

  return createJsonResponse({ status: 'success', data: records });
}


// =================================================================
// FUNGSI BANTU
// =================================================================

// Membuat respons JSON standar
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Mengonversi key JS ke nama header sheet untuk dicocokkan saat sorting/filtering
function getHeaderName(key) {
    const map = {
        'created_at': 'Timestamp',
        'paket_layanan': 'Paket Layanan',
        'nama': 'Nama',
        // tambahkan pemetaan lain jika ada
    };
    if (map[key]) return map[key];
    // fallback jika tidak ada di map
    return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
