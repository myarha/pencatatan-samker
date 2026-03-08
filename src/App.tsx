import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Loader2, Receipt, FileText, CheckCircle2, Sparkles, Database, PlusCircle, Trash2, Image as ImageIcon, AlertCircle, Eye, EyeOff, ChevronDown, Lock, User, LogOut, Search, X, FileBarChart, Pencil, Keyboard } from 'lucide-react';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { supabase } from './lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MONTHS = [
  { value: '01', label: 'Januari' },
  { value: '02', label: 'Februari' },
  { value: '03', label: 'Maret' },
  { value: '04', label: 'April' },
  { value: '05', label: 'Mei' },
  { value: '06', label: 'Juni' },
  { value: '07', label: 'Juli' },
  { value: '08', label: 'Agustus' },
  { value: '09', label: 'September' },
  { value: '10', label: 'Oktober' },
  { value: '11', label: 'November' },
  { value: '12', label: 'Desember' }
];

const YEARS = [
  { value: '2026', label: '2026' },
  { value: '2027', label: '2027' },
  { value: '2028', label: '2028' },
  { value: '2029', label: '2029' },
  { value: '2030', label: '2030' }
];

interface TaxData {
  id?: string;
  username?: string;
  tanggalInput?: string;
  tanggalBayar: string;
  nomorPolisi: string;
  nama: string;
  masaPajak: string;
  jumlahPkb: string;
  jumlahOpsenPkb: string;
  isTunggakan?: boolean;
  imageData?: string;
}

type Tab = 'input' | 'history';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('input');
  const [transactions, setTransactions] = useState<TaxData[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [viewImage, setViewImage] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMonth, setFilterMonth] = useState(() => {
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth.toString().padStart(2, '0');
  });
  const [filterYear, setFilterYear] = useState(() => {
    return new Date().getFullYear().toString();
  });
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, nopol: string} | null>(null);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const yearDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchTransactions();
    }
  }, [isAuthenticated, currentUser]);

  const fetchTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('username', currentUser)
        .order('tanggalInput', { ascending: false });
        
      if (error) {
        console.error('Error fetching transactions:', error);
        alert('Gagal mengambil data dari database: ' + error.message);
        return;
      }
      if (data) {
        setTransactions(Array.isArray(data) ? data as TaxData[] : []);
      }
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const filteredTransactions = transactions.filter(trx => {
    if (!trx) return false;
    const nopol = String(trx.nomorPolisi || '');
    const nama = String(trx.nama || '');
    const searchStr = String(searchQuery || '').toLowerCase();
    const matchesSearch = (nopol.toLowerCase().includes(searchStr) || nama.toLowerCase().includes(searchStr));
    
    let trxMonth = '';
    let trxYear = '';
    
    if (trx.tanggalBayar) {
      const parts = String(trx.tanggalBayar).split(/[-/ ]/);
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          // Format YYYY-MM-DD
          trxYear = parts[0];
          trxMonth = parts[1];
        } else if (parts[2].length >= 4) {
          // Format DD-MM-YYYY or DD MMM YYYY
          trxMonth = parts[1];
          trxYear = parts[2].substring(0, 4);
        }
        
        // Convert month names to numbers if necessary
        const monthNames: {[key: string]: string} = {
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mei': '05', 'jun': '06',
          'jul': '07', 'agu': '08', 'sep': '09', 'okt': '10', 'nov': '11', 'des': '12'
        };
        const lowerMonth = String(trxMonth).toLowerCase().substring(0, 3);
        if (monthNames[lowerMonth]) {
          trxMonth = monthNames[lowerMonth];
        }
      }
    }

    // Fallback if parsing fails or data is missing
    if ((!trxMonth || !trxYear || trxMonth.length !== 2) && trx.tanggalInput) {
      try {
        // Handle Supabase ISO string
        const date = new Date(trx.tanggalInput);
        if (!isNaN(date.getTime())) {
          trxMonth = (date.getMonth() + 1).toString().padStart(2, '0');
          trxYear = date.getFullYear().toString();
        }
      } catch (e) {
        // Ignore
      }
    }

    // Final fallback for optimistic updates or completely unparseable dates
    if (!trxMonth || !trxYear || trxMonth.length !== 2) {
      const now = new Date();
      trxMonth = (now.getMonth() + 1).toString().padStart(2, '0');
      trxYear = now.getFullYear().toString();
    }

    const matchesMonth = filterMonth ? trxMonth === filterMonth : true;
    const matchesYear = filterYear ? trxYear === filterYear : true;

    return matchesSearch && matchesMonth && matchesYear;
  });
  
  const generatePDFReport = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text('Laporan Pencatatan Transaksi', 14, 22);

    // Subtitle (Filter info)
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139); // slate-500
    const monthLabel = MONTHS.find(m => m.value === filterMonth)?.label || 'Semua Bulan';
    doc.text(`Periode: ${monthLabel} ${filterYear} | SAMSAT ${String(currentUser || '').replace('SAMSAT ', '').toUpperCase()}`, 14, 30);

    // Helper to parse date for sorting
    const parseDate = (dateStr: string) => {
      if (!dateStr) return new Date(0).getTime();
      const parts = String(dateStr).split(/[-/ ]/);
      if (parts.length >= 3) {
        if (parts[0].length === 4) {
          return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime();
        } else {
          const monthNames: {[key: string]: string} = {
            'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'mei': '05', 'jun': '06',
            'jul': '07', 'agu': '08', 'sep': '09', 'okt': '10', 'nov': '11', 'des': '12'
          };
          let month = parts[1];
          const lowerMonth = String(month).toLowerCase().substring(0, 3);
          if (monthNames[lowerMonth]) {
            month = monthNames[lowerMonth];
          }
          return new Date(`${parts[2].substring(0, 4)}-${month}-${parts[0]}`).getTime();
        }
      }
      return new Date(0).getTime();
    };

    // Sort data by tanggalBayar ascending
    const sortedTransactions = [...filteredTransactions].sort((a, b) => {
      return parseDate(a.tanggalBayar) - parseDate(b.tanggalBayar);
    });

    // Table Data
    const tableColumn = ["No", "Tanggal Bayar", "Nomor Polisi", "Nama", "PKB", "Opsen PKB", "Tunggakan"];
    const tableRows: any[] = [];

    let totalPkb = 0;
    let totalOpsenPkb = 0;
    let tunggakanCount = 0;
    let nonTunggakanCount = 0;

    sortedTransactions.forEach((trx, index) => {
      const rowData = [
        index + 1,
        trx.tanggalBayar,
        trx.nomorPolisi,
        trx.nama,
        trx.jumlahPkb,
        trx.jumlahOpsenPkb,
        trx.isTunggakan ? 'Ya' : 'Tidak'
      ];
      tableRows.push(rowData);

      // Calculate totals
      const pkbStr = String(trx.jumlahPkb || '');
      const pkbValue = parseInt(pkbStr.replace(/[^0-9]/g, '')) || 0;
      totalPkb += pkbValue;

      const opsenPkbStr = String(trx.jumlahOpsenPkb || '');
      const opsenPkbValue = parseInt(opsenPkbStr.replace(/[^0-9]/g, '')) || 0;
      totalOpsenPkb += opsenPkbValue;

      if (trx.isTunggakan) {
        tunggakanCount++;
      } else {
        nonTunggakanCount++;
      }
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 38,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3, textColor: [51, 65, 85], lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 26 },
        2: { cellWidth: 25, fontStyle: 'bold' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 22, halign: 'center' }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 6) {
          if (data.cell.raw === 'Ya') {
            data.cell.styles.textColor = [220, 38, 38];
          } else {
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      }
    });

    // Recapitulation
    const finalY = (doc as any).lastAutoTable.finalY || 40;
    
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text('Rekapitulasi:', 14, finalY + 10);
    
    const rekapRows = [
      ['Jumlah Transaksi', `${sortedTransactions.length} Unit`],
      ['Jumlah PKB', `Rp ${totalPkb.toLocaleString('id-ID')}`],
      ['Jumlah Opsen PKB', `Rp ${totalOpsenPkb.toLocaleString('id-ID')}`],
      ['Jumlah Tunggakan', `${tunggakanCount} Unit`],
      ['Jumlah Non Tunggakan', `${nonTunggakanCount} Unit`]
    ];

    autoTable(doc, {
      body: rekapRows,
      startY: finalY + 14,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, textColor: [51, 65, 85], lineColor: [200, 200, 200], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 45, fontStyle: 'bold', fillColor: [248, 250, 252] },
        1: { cellWidth: 35 }
      },
      margin: { left: 14 }
    });

    doc.save(`Laporan_Transaksi_${monthLabel}_${filterYear}.pdf`);
  };

  // Input State
  const [image, setImage] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [formData, setFormData] = useState<TaxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualInputModal, setShowManualInputModal] = useState(false);
  const [manualFormErrors, setManualFormErrors] = useState<{[key: string]: string}>({});
  const [editFormErrors, setEditFormErrors] = useState<{[key: string]: string}>({});
  const [aiFormErrors, setAiFormErrors] = useState<{[key: string]: string}>({});
  const [manualFormData, setManualFormData] = useState<TaxData>({
    tanggalBayar: new Date().toISOString().split('T')[0],
    nomorPolisi: '',
    nama: '',
    masaPajak: '1 TAHUN 0 BULAN',
    jumlahPkb: '',
    jumlahOpsenPkb: '',
    isTunggakan: false
  });
  
  // Edit State
  const [editingTransaction, setEditingTransaction] = useState<TaxData | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Meningkatkan resolusi maksimal menjadi 1600 untuk OCR yang lebih baik pada gambar buram
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Meningkatkan kualitas JPEG menjadi 0.85 agar teks buram tetap terbaca oleh AI
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setImage(compressedDataUrl);
          setMimeType('image/jpeg');
        } else {
          // Fallback if canvas fails
          setImage(reader.result as string);
          setMimeType(file.type);
        }
        setFormData(null); // Reset form data when new image is selected
        setError(null);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const analyzeImage = async () => {
    if (!image || !mimeType) return;
    
    setLoading(true);
    setError(null);
    setFormData(null);
    
    try {
      const base64Data = image.split(',')[1];
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType,
              },
            },
            {
              text: 'Identifikasi dokumen SSPD/Notice Pajak ini secara cepat dan akurat. FOKUS UTAMA: Nomor Polisi, Nama Pemilik, Masa Pajak, Tanggal Bayar, PKB, dan Opsen PKB. PENTING: 1) Jika gambar sedikit buram, lakukan inferensi terbaik berdasarkan konteks huruf/angka yang terlihat. 2) Teks pada dokumen mungkin bergeser atau tidak sejajar dengan baris/kolomnya. Gunakan pola data (seperti format plat nomor 1-2 huruf, 1-4 angka, 1-3 huruf) untuk mengidentifikasi nilai yang benar. 3) Jika BUKAN SSPD/Notice Pajak, set isValidSspd: false. Jika YA, set isValidSspd: true dan ekstrak datanya. Pastikan mengambil nilai PKB dan Opsen PKB HANYA dari kolom "JUMLAH" (paling kanan). Untuk status tunggakan, perhatikan dengan teliti angka pada kolom "SANKSI ADMINISTRATIF" khusus untuk baris PKB dan OPSEN PKB. 4) FORMAT TANGGAL WAJIB: DD-MM-YYYY (contoh: 09-03-2025). Ubah format jika di dokumen tertulis berbeda.',
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isValidSspd: {
                type: Type.BOOLEAN,
                description: "True jika gambar adalah dokumen SSPD/Notice Pajak kendaraan, False jika bukan."
              },
              nomorPolisi: { 
                type: Type.STRING, 
                description: "Nomor Polisi kendaraan TANPA SPASI ATAU TANDA HUBUNG (contoh: DK2925UBO). Jika posisinya bergeser turun ke baris Nama, tetap ambil nilai plat nomornya berdasarkan format huruf-angka-huruf." 
              },
              nama: { 
                type: Type.STRING, 
                description: "Nama Pemilik" 
              },
              masaPajak: { 
                type: Type.STRING, 
                description: "Masa Pajak (contoh: 1 Tahun 0 bulan)" 
              },
              tanggalBayar: {
                type: Type.STRING,
                description: "Tanggal Bayar, cari di bagian bawah pada kolom TGL. BAYAR. WAJIB FORMAT: DD-MM-YYYY (contoh: 27-02-2026)"
              },
              jumlahPkb: { 
                type: Type.STRING, 
                description: "Jumlah total pada baris PKB, ambil angka dari kolom JUMLAH paling kanan (contoh: 148.600)" 
              },
              jumlahOpsenPkb: { 
                type: Type.STRING, 
                description: "Jumlah total pada baris OPSEN PKB, ambil angka dari kolom JUMLAH paling kanan (contoh: 98.100)" 
              },
              isTunggakan: {
                type: Type.BOOLEAN,
                description: "True jika terdapat angka lebih dari 0 pada kolom SANKSI ADMINISTRATIF khusus untuk baris PKB, OPSEN PKB, atau SWDKLLJ. Set False jika SEMUA baris di kolom SANKSI ADMINISTRATIF bernilai 0 atau kosong (walaupun baris BBN KB bernilai 0, jika baris PKB ada sanksi, maka True)."
              }
            },
            required: ["nomorPolisi", "nama", "masaPajak", "tanggalBayar", "jumlahPkb", "jumlahOpsenPkb", "isTunggakan"]
          }
        }
      });
      
      if (response.text) {
        const parsedData = JSON.parse(response.text);
        
        if (parsedData.isValidSspd === false) {
          setError('Gambar yang diunggah tidak terdeteksi sebagai dokumen SSPD/Notice Pajak yang valid. Silakan unggah gambar yang benar.');
          setFormData(null);
        } else {
          // Format nomor polisi: hapus spasi, tanda hubung, dan karakter non-alfanumerik, lalu jadikan huruf besar
          if (parsedData.nomorPolisi) {
            parsedData.nomorPolisi = String(parsedData.nomorPolisi).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          }
          setFormData(parsedData as TaxData);
        }
      } else {
        setError('Gagal mengekstrak data dari gambar.');
      }
    } catch (err) {
      console.error('Error analyzing image:', err);
      setError('Terjadi kesalahan saat menganalisis gambar. Pastikan gambar jelas dan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualInputOpen = () => {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();
    
    setManualFormData({
      tanggalBayar: `${dd}-${mm}-${yyyy}`,
      nomorPolisi: '',
      nama: '',
      masaPajak: '1 TAHUN 0 BULAN',
      jumlahPkb: '',
      jumlahOpsenPkb: '',
      isTunggakan: false
    });
    setManualFormErrors({});
    setShowManualInputModal(true);
  };

  const validateForm = (data: TaxData) => {
    const errors: {[key: string]: string} = {};
    if (!data.nomorPolisi) errors.nomorPolisi = 'Nomor Polisi wajib diisi';
    if (!data.nama) errors.nama = 'Nama Pemilik wajib diisi';
    
    if (!data.tanggalBayar) {
      errors.tanggalBayar = 'Tanggal Bayar wajib diisi';
    } else {
      const dateRegex = /^(\d{2})-(\d{2})-(\d{4})$/;
      const match = data.tanggalBayar.match(dateRegex);
      
      if (!match) {
        errors.tanggalBayar = 'Format tanggal harus DD-MM-YYYY (contoh: 09-03-2025)';
      } else {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const year = parseInt(match[3], 10);
        
        const dateObj = new Date(year, month - 1, day);
        
        // Cek apakah tanggal valid secara kalender
        if (
          dateObj.getFullYear() !== year ||
          dateObj.getMonth() + 1 !== month ||
          dateObj.getDate() !== day
        ) {
          errors.tanggalBayar = 'Tanggal tidak valid (cek tanggal/bulan/tahun)';
        }
        
        // Cek range tahun yang masuk akal
        if (year < 2000 || year > 2100) {
             errors.tanggalBayar = 'Tahun tidak valid (harus antara 2000-2100)';
        }
      }
    }

    if (!data.masaPajak) errors.masaPajak = 'Masa Pajak wajib diisi';
    if (!data.jumlahPkb) errors.jumlahPkb = 'Jumlah PKB wajib diisi';
    if (!data.jumlahOpsenPkb) errors.jumlahOpsenPkb = 'Opsen PKB wajib diisi';
    
    return errors;
  };

  const generateDefaultImage = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Background
      ctx.fillStyle = '#f8fafc'; // slate-50
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Border
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 20;
      ctx.strokeRect(0, 0, canvas.width, canvas.height);
      
      // Warning Triangle Icon
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2 - 50;
      const size = 120;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY - size); // Top
      ctx.lineTo(centerX + size, centerY + size * 0.8); // Bottom Right
      ctx.lineTo(centerX - size, centerY + size * 0.8); // Bottom Left
      ctx.closePath();
      
      ctx.fillStyle = '#fef3c7'; // amber-100
      ctx.fill();
      
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#f59e0b'; // amber-500
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Exclamation Mark
      ctx.fillStyle = '#d97706'; // amber-600
      ctx.font = 'bold 100px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', centerX, centerY + 20);
      
      // Main Text
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TIDAK ADA FOTO/DOKUMEN', canvas.width / 2, canvas.height / 2 + 100);
      
      // Sub Text
      ctx.font = 'italic 24px sans-serif';
      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.fillText('Manual Transaksi', canvas.width / 2, canvas.height / 2 + 140);
      
      return canvas.toDataURL('image/jpeg', 0.8);
    }
    return '';
  };

  const handleSaveManualTransaction = async () => {
    const errors = validateForm(manualFormData);
    if (Object.keys(errors).length > 0) {
      setManualFormErrors(errors);
      setShowErrorToast('Mohon lengkapi semua data yang wajib diisi');
      setTimeout(() => setShowErrorToast(null), 3000);
      return;
    }

    setSaving(true);
    
    const transactionId = Date.now().toString();
    const defaultImage = generateDefaultImage();
    
    // OPTIMISTIC UI UPDATE
    const optimisticTransaction: TaxData = {
      ...manualFormData,
      id: transactionId,
      username: currentUser,
      imageData: defaultImage, 
      tanggalInput: new Date().toLocaleString('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    };
    
    setTransactions([optimisticTransaction, ...transactions]);
    setShowManualInputModal(false);
    setActiveTab('history');
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 3000);

    try {
      // Upload default image first to get a URL
      let publicUrl = '';
      const imageBlob = dataURLtoBlob(defaultImage);
      const fileName = `${currentUser}_${transactionId}_manual.jpeg`;

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('receipts')
        .upload(fileName, imageBlob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (!uploadError) {
        const { data: urlData } = supabase
          .storage
          .from('receipts')
          .getPublicUrl(fileName);
        publicUrl = urlData.publicUrl;
      }

      const transactionToSave = {
        ...optimisticTransaction,
        imageData: publicUrl
      };

      const { data: savedData, error: dbError } = await supabase
        .from('transactions')
        .insert([transactionToSave])
        .select()
        .single();

      if (dbError) {
        console.error('Error saving to Supabase:', dbError);
        setTransactions(prev => prev.filter(t => t.id !== transactionId));
        setShowErrorToast('Gagal menyimpan ke database: ' + dbError.message);
        setTimeout(() => setShowErrorToast(null), 5000);
        return;
      }
      
      setTransactions(prev => prev.map(t => t.id === transactionId ? savedData : t));
      
    } catch (err: any) {
      console.error('Error saving transaction in background:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleManualInputChange = (field: keyof TaxData, value: any) => {
    let finalValue = value;
    let errorMsg = '';

    if (field === 'nomorPolisi') {
      finalValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }

    if (field === 'tanggalBayar') {
      // Allow only digits and dashes
      finalValue = String(value || '').replace(/[^0-9-]/g, '');
      // Auto-format DD-MM-YYYY
      if (finalValue.length === 2 && !finalValue.includes('-')) finalValue += '-';
      if (finalValue.length === 5 && finalValue.split('-').length === 2) finalValue += '-';
      if (finalValue.length > 10) finalValue = finalValue.substring(0, 10);
    }

    if (field === 'jumlahPkb' || field === 'jumlahOpsenPkb') {
      // Remove dots to check for non-digits
      const rawValue = String(value).replace(/\./g, '');
      
      if (/[^0-9]/.test(rawValue)) {
        errorMsg = 'Hanya angka yang diperbolehkan';
        // Keep the invalid input so user sees it, but mark as error
        finalValue = value;
      } else {
        // Format with dots if valid number
        if (rawValue) {
          finalValue = parseInt(rawValue).toLocaleString('id-ID');
        } else {
          finalValue = '';
        }
      }
    }

    setManualFormData(prev => ({ ...prev, [field]: finalValue }));
    
    // Update errors
    setManualFormErrors(prev => {
      const newErrors = { ...prev };
      if (errorMsg) {
        newErrors[field] = errorMsg;
      } else {
        delete newErrors[field];
      }
      return newErrors;
    });
  };

  const handleInputChange = (field: keyof TaxData, value: any) => {
    if (formData) {
      let finalValue = value;
      // Format nomor polisi saat diketik manual
      if (field === 'nomorPolisi') {
        finalValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      }

      if (field === 'tanggalBayar') {
        // Allow only digits and dashes
        finalValue = String(value || '').replace(/[^0-9-]/g, '');
        // Auto-format DD-MM-YYYY
        if (finalValue.length === 2 && !finalValue.includes('-')) finalValue += '-';
        if (finalValue.length === 5 && finalValue.split('-').length === 2) finalValue += '-';
        if (finalValue.length > 10) finalValue = finalValue.substring(0, 10);
      }
      setFormData({ ...formData, [field]: finalValue });

      // Clear error
      if (aiFormErrors[field]) {
        setAiFormErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  const handleEditInputChange = (field: keyof TaxData, value: any) => {
    if (editingTransaction) {
      let finalValue = value;
      let errorMsg = '';

      if (field === 'nomorPolisi') {
        finalValue = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      }

      if (field === 'tanggalBayar') {
        // Allow only digits and dashes
        finalValue = String(value || '').replace(/[^0-9-]/g, '');
        // Auto-format DD-MM-YYYY
        if (finalValue.length === 2 && !finalValue.includes('-')) finalValue += '-';
        if (finalValue.length === 5 && finalValue.split('-').length === 2) finalValue += '-';
        if (finalValue.length > 10) finalValue = finalValue.substring(0, 10);
      }

      if (field === 'jumlahPkb' || field === 'jumlahOpsenPkb') {
        // Remove dots to check for non-digits
        const rawValue = String(value).replace(/\./g, '');
        
        if (/[^0-9]/.test(rawValue)) {
          errorMsg = 'Hanya angka yang diperbolehkan';
          // Keep the invalid input so user sees it, but mark as error
          finalValue = value;
        } else {
          // Format with dots if valid number
          if (rawValue) {
            finalValue = parseInt(rawValue).toLocaleString('id-ID');
          } else {
            finalValue = '';
          }
        }
      }

      setEditingTransaction({ ...editingTransaction, [field]: finalValue });

      // Update errors
      setEditFormErrors(prev => {
        const newErrors = { ...prev };
        if (errorMsg) {
          newErrors[field] = errorMsg;
        } else {
          delete newErrors[field];
        }
        return newErrors;
      });
    }
  };

  const dataURLtoBlob = (dataurl: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const handleSaveTransaction = async () => {
    if (formData && image) {
      const errors = validateForm(formData);
      if (Object.keys(errors).length > 0) {
        setAiFormErrors(errors);
        setShowErrorToast('Mohon lengkapi semua data yang wajib diisi');
        setTimeout(() => setShowErrorToast(null), 3000);
        return;
      }

      setSaving(true);
      
      // Destructure to remove isValidSspd if it exists, as it's not in the DB schema
      const { isValidSspd, ...cleanFormData } = formData as any;
      const transactionId = Date.now().toString();
      
      // OPTIMISTIC UI UPDATE: Update UI immediately so it feels instant
      const optimisticTransaction: TaxData = {
        ...cleanFormData,
        id: transactionId,
        username: currentUser,
        imageData: image,
        tanggalInput: new Date().toLocaleString('id-ID', {
          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        })
      };
      
      // Update UI immediately
      setTransactions([optimisticTransaction, ...transactions]);
      setImage(null);
      setMimeType(null);
      setFormData(null);
      setActiveTab('history');
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);

      // Do the heavy lifting (upload and DB insert) in the background
      try {
        let publicUrl = '';

        if (image) {
          // 1. Convert Base64 to Blob
          const imageBlob = dataURLtoBlob(image);
          const fileExtension = mimeType?.split('/')[1] || 'jpeg';
          const fileName = `${currentUser}_${transactionId}.${fileExtension}`;

          // 2. Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('receipts')
            .upload(fileName, imageBlob, {
              contentType: mimeType || 'image/jpeg',
              upsert: false
            });

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            // We don't alert here because the UI has already moved on, but we could show a toast
            return;
          }

          // 3. Get Public URL
          const { data: urlData } = supabase
            .storage
            .from('receipts')
            .getPublicUrl(fileName);
            
          publicUrl = urlData.publicUrl;
        }

        // 4. Save to Database
        const newTransaction: TaxData = {
          ...optimisticTransaction,
          imageData: publicUrl // Replace base64 with real URL or empty string
        };
        
        const { data: savedData, error: dbError } = await supabase
          .from('transactions')
          .insert([newTransaction])
          .select()
          .single();

        if (dbError) {
          console.error('Error saving to Supabase:', dbError);
          // Revert optimistic update
          setTransactions(prev => prev.filter(t => t.id !== transactionId));
          setShowErrorToast('Gagal menyimpan ke database: ' + dbError.message);
          setTimeout(() => setShowErrorToast(null), 5000);
          return;
        }
        
        // 5. Silently update the transaction in state with the real data from DB
        setTransactions(prev => prev.map(t => t.id === transactionId ? savedData : t));
        
      } catch (err: any) {
        console.error('Error saving transaction in background:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const confirmDelete = (id: string, nopol: string) => {
    setDeleteConfirm({ id, nopol });
  };

  const executeDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    
    try {
      // Find the transaction to get the image URL
      const transactionToDelete = transactions.find(t => t.id === id);
      
      // Delete from Database first
      const { error: dbError } = await supabase.from('transactions').delete().eq('id', id);
      if (dbError) {
        console.error('Error deleting from Supabase:', dbError);
        alert('Gagal menghapus dari database: ' + dbError.message);
        return;
      }

      // Delete image from Storage if it exists and is a Supabase URL
      if (transactionToDelete?.imageData && transactionToDelete.imageData.includes('supabase.co/storage/v1/object/public/receipts/')) {
        const fileName = transactionToDelete.imageData.split('/').pop();
        if (fileName) {
          const { error: storageError } = await supabase.storage.from('receipts').remove([fileName]);
          if (storageError) {
            console.error('Error deleting image from storage:', storageError);
            // We don't block the UI update here since the DB record is already deleted
          }
        }
      }
      
      // Update UI
      setTransactions(transactions.filter(t => t.id !== id));
      setDeleteConfirm(null);
      setShowDeleteToast(true);
      setTimeout(() => setShowDeleteToast(false), 3000);
    } catch (err: any) {
      console.error('Error deleting transaction:', err);
      alert('Terjadi kesalahan sistem: ' + err.message);
    }
  };

  const handleUpdateTransaction = async () => {
    if (!editingTransaction || !editingTransaction.id) return;
    
    const errors = validateForm(editingTransaction);
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      setShowErrorToast('Mohon lengkapi semua data yang wajib diisi');
      setTimeout(() => setShowErrorToast(null), 3000);
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          nomorPolisi: editingTransaction.nomorPolisi,
          nama: editingTransaction.nama,
          masaPajak: editingTransaction.masaPajak,
          tanggalBayar: editingTransaction.tanggalBayar,
          jumlahPkb: editingTransaction.jumlahPkb,
          jumlahOpsenPkb: editingTransaction.jumlahOpsenPkb,
          isTunggakan: editingTransaction.isTunggakan
        })
        .eq('id', editingTransaction.id);

      if (error) throw error;

      // Update local state
      setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? editingTransaction : t));
      
      // Show success toast
      setShowUpdateToast(true);
      setTimeout(() => setShowUpdateToast(false), 3000);
      
      setEditingTransaction(null);
    } catch (err: any) {
      console.error('Error updating transaction:', err);
      alert('Gagal memperbarui data: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const cancelInput = () => {
    setImage(null);
    setMimeType(null);
    setFormData(null);
    setError(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={(username) => {
      setCurrentUser(username);
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {showSuccessToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[13px] font-medium tracking-wide">Berhasil disimpan</span>
        </div>
      )}
      {showUpdateToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[13px] font-medium tracking-wide">Berhasil diubah</span>
        </div>
      )}
      {showDeleteToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-[13px] font-medium tracking-wide">Berhasil dihapus</span>
        </div>
      )}
      {showErrorToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-red-600/95 backdrop-blur-sm text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-5 duration-300">
          <AlertCircle className="w-4 h-4 text-white" />
          <span className="text-[13px] font-medium tracking-wide">{showErrorToast}</span>
        </div>
      )}
      <header className="bg-white shadow-sm sticky top-0 z-20 border-b border-slate-200">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-wide">Catatan Transaksi</h1>
            <div className="flex items-center gap-1 mt-1">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
                S<span className="text-red-600">A</span>MSAT
              </span>
              <span className="text-xs font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-blue-500 to-orange-500 uppercase tracking-widest">
                {String(currentUser || '').replace('SAMSAT ', '').toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={generatePDFReport}
              className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shadow-sm hover:bg-indigo-50 hover:border-indigo-200 transition-colors group"
              title="Laporan"
            >
              <FileBarChart className="w-5 h-5 text-slate-500 group-hover:text-indigo-600 transition-colors" />
            </button>
            <button 
              onClick={() => setLogoutConfirm(true)}
              className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shadow-sm hover:bg-red-50 hover:border-red-200 transition-colors group"
              title="Keluar"
            >
              <LogOut className="w-5 h-5 text-slate-500 group-hover:text-red-600 transition-colors" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-24">
        {activeTab === 'input' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Upload Section (Only show if no image selected) */}
            {!image && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
                <p className="text-slate-500 text-center mb-6 text-sm">
                  Upload atau foto dokumen SSPD/Notice Pajak untuk mengekstrak data secara otomatis dengan AI.
                </p>

                <div className="grid grid-cols-3 gap-4">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-4 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-100 hover:border-slate-300 transition-all active:scale-95"
                  >
                    <Camera className="w-7 h-7 mb-2 text-slate-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Kamera</span>
                  </button>
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center p-4 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-xl hover:bg-indigo-100 hover:border-indigo-200 transition-all active:scale-95"
                  >
                    <Upload className="w-7 h-7 mb-2 text-indigo-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Upload</span>
                  </button>

                  <button
                    onClick={handleManualInputOpen}
                    className="flex flex-col items-center justify-center p-4 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 hover:border-emerald-200 transition-all active:scale-95"
                  >
                    <Keyboard className="w-7 h-7 mb-2 text-emerald-600" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Manual</span>
                  </button>
                </div>
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              className="hidden"
              onChange={handleImageSelection}
            />
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageSelection}
            />

            {/* Image Preview & AI Action */}
            {image && !formData && !loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-2 bg-slate-100">
                  <img src={image} alt="Dokumen SSPD" className="w-full h-auto object-contain max-h-64 rounded-xl" />
                </div>
                <div className="p-5 flex flex-col gap-3">
                  <button 
                    onClick={analyzeImage}
                    className="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3.5 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98]"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Catat SSPD AI
                  </button>
                  <button 
                    onClick={cancelInput}
                    className="w-full flex items-center justify-center bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl transition-colors active:scale-[0.98]"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-slate-500 mb-6">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-4" />
                <p className="text-sm font-medium">Mengekstrak data dokumen...</p>
                <p className="text-xs text-slate-400 mt-2 text-center">AI sedang membaca nomor polisi, nama, dan rincian pajak.</p>
              </div>
            )}

            {/* Error Modal */}
            {error && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                  <div className="p-6 flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-100">
                      <AlertCircle className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Validasi Gagal</h3>
                    <p className="text-sm text-slate-600 mb-6 leading-relaxed">{error}</p>
                    <button 
                      onClick={cancelInput}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors active:scale-[0.98] shadow-md"
                    >
                      Mengerti & Coba Lagi
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Extracted Data Form */}
            {formData && !loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center text-slate-800 font-medium">
                    <FileText className="w-5 h-5 mr-2 text-indigo-600" />
                    SSPD Tercatat
                  </div>
                  {formData && (
                    <div className={`flex items-center text-xs font-medium px-3 py-1.5 rounded-full border ${formData.isTunggakan ? 'text-red-600 bg-red-50 border-red-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                      {formData.isTunggakan ? (
                        <AlertCircle className="w-4 h-4 mr-1.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                      )}
                      {formData.isTunggakan ? 'Tunggakan' : 'Non Tunggakan'}
                    </div>
                  )}
                </div>
                
                <div className="p-5 space-y-4">
                  <InputField 
                    label="Nomor Polisi" 
                    value={formData?.nomorPolisi || ''} 
                    onChange={(e) => handleInputChange('nomorPolisi', e.target.value)} 
                    error={aiFormErrors.nomorPolisi}
                  />
                  <InputField 
                    label="Nama Pemilik" 
                    value={formData?.nama || ''} 
                    onChange={(e) => handleInputChange('nama', e.target.value)} 
                    error={aiFormErrors.nama}
                  />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <InputField 
                      label="Tanggal Bayar" 
                      value={formData?.tanggalBayar || ''} 
                      onChange={(e) => handleInputChange('tanggalBayar', e.target.value)} 
                      error={aiFormErrors.tanggalBayar}
                    />
                    <InputField 
                      label="Masa Pajak" 
                      value={formData?.masaPajak || ''} 
                      onChange={(e) => handleInputChange('masaPajak', e.target.value)} 
                      error={aiFormErrors.masaPajak}
                    />
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-100">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Rincian Pembayaran</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <AmountField 
                        label="PKB" 
                        value={formData?.jumlahPkb || ''} 
                        onChange={(e) => handleInputChange('jumlahPkb', e.target.value)} 
                        error={aiFormErrors.jumlahPkb}
                      />
                      <AmountField 
                        label="Opsen PKB" 
                        value={formData?.jumlahOpsenPkb || ''} 
                        onChange={(e) => handleInputChange('jumlahOpsenPkb', e.target.value)} 
                        error={aiFormErrors.jumlahOpsenPkb}
                      />
                    </div>
                  </div>

                  {!formData && (
                    <div className="flex items-center mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer" onClick={() => handleInputChange('isTunggakan', !(formData?.isTunggakan || false))}>
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center mr-3 transition-colors ${formData?.isTunggakan ? 'bg-red-500 border-red-500' : 'bg-white border-2 border-slate-300'}`}>
                        {formData?.isTunggakan && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">Tandai sebagai Tunggakan</p>
                        <p className="text-xs text-slate-500 mt-0.5">Centang jika ini adalah pembayaran tunggakan</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-6">
                    <button 
                      onClick={cancelInput}
                      className="flex-1 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl transition-colors active:scale-[0.98]"
                    >
                      Batal
                    </button>
                    <button 
                      onClick={handleSaveTransaction}
                      disabled={saving}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98] disabled:opacity-70 flex items-center justify-center"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Menyimpan...
                        </>
                      ) : (
                        'Simpan Transaksi'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 flex flex-col h-full">
            <div className="sticky top-[81px] z-10 bg-slate-50 pt-2 pb-4 px-1">
              <div className="space-y-3 relative z-10">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari plat nomor atau nama..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-0 focus:border-slate-200 text-sm shadow-sm transition-all"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1" ref={monthDropdownRef}>
                    <button
                      onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
                      className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl pl-4 pr-3 py-2.5 text-sm text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                    >
                      <span>{MONTHS.find(m => m.value === filterMonth)?.label || 'Pilih Bulan'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isMonthDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {MONTHS.map((month) => (
                          <button
                            key={month.value}
                            onClick={() => {
                              setFilterMonth(month.value);
                              setIsMonthDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${filterMonth === month.value ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 font-medium'}`}
                          >
                            {month.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative flex-1" ref={yearDropdownRef}>
                    <button
                      onClick={() => setIsYearDropdownOpen(!isYearDropdownOpen)}
                      className="w-full flex items-center justify-between bg-white border border-slate-200 rounded-xl pl-4 pr-3 py-2.5 text-sm text-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium transition-all"
                    >
                      <span>{YEARS.find(y => y.value === filterYear)?.label || 'Pilih Tahun'}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isYearDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-auto py-1 animate-in fade-in slide-in-from-top-2 duration-200">
                        {YEARS.map((year) => (
                          <button
                            key={year.value}
                            onClick={() => {
                              setFilterYear(year.value);
                              setIsYearDropdownOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors ${filterYear === year.value ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 font-medium'}`}
                          >
                            {year.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-4 left-0 right-0 h-4 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none"></div>
            </div>
            
            <div className="px-1 pt-2 pb-24">
              {isLoadingTransactions ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">Memuat data transaksi...</p>
                  <p className="text-sm text-slate-400">Harap tunggu sebentar, sedang mengambil data dari server.</p>
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Receipt className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-600 font-medium mb-1">Belum ada transaksi</p>
                  <p className="text-sm text-slate-400">Data yang Anda simpan akan muncul di sini.</p>
                  <button 
                    onClick={() => setActiveTab('input')}
                    className="mt-6 text-indigo-600 text-sm font-semibold uppercase tracking-wider"
                  >
                    + Tambah Transaksi
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredTransactions.map((trx) => (
                    <div key={trx.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
                        <span className="text-xs font-medium text-slate-500">{trx.tanggalBayar || trx.tanggalInput}</span>
                        <div className="flex items-center gap-3">
                          {trx.imageData && (
                            <button 
                              onClick={() => setViewImage(trx.imageData!)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Lihat Dokumen"
                            >
                              <ImageIcon className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => setEditingTransaction(trx)}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                            title="Edit Transaksi"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => confirmDelete(trx.id!, trx.nomorPolisi)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                            title="Hapus Transaksi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-3 gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-800 text-lg truncate">{trx.nomorPolisi}</h3>
                            <p className="text-sm text-slate-600 truncate">{trx.nama}</p>
                          </div>
                          <div className="text-right flex-shrink-0 flex flex-col items-end gap-1.5">
                            <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-md whitespace-nowrap">
                              {trx.masaPajak}
                            </span>
                            <span className={`inline-block text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${trx.isTunggakan ? 'text-red-500' : 'text-emerald-500'}`}>
                              {trx.isTunggakan ? 'Tunggakan' : 'Non Tunggakan'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center pt-3 border-t border-slate-200">
                          <div className="flex-1 text-left pr-3 border-r border-slate-200">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">PKB</p>
                            <p className="text-sm font-semibold text-slate-700">Rp {trx.jumlahPkb}</p>
                          </div>
                          <div className="flex-1 text-right pl-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opsen PKB</p>
                            <p className="text-sm font-semibold text-slate-700">Rp {trx.jumlahOpsenPkb}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Image Viewer Modal */}
      {viewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Dokumen SSPD</h3>
              <button 
                onClick={() => setViewImage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <PlusCircle className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-2 overflow-auto bg-slate-100 flex-1 flex items-center justify-center">
              <img src={viewImage} alt="Dokumen SSPD" className="max-w-full h-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe z-20">
        <div className="max-w-md mx-auto flex">
          <button 
            onClick={() => setActiveTab('input')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 ${activeTab === 'input' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <PlusCircle className={`w-5 h-5 mb-0 ${activeTab === 'input' ? 'fill-indigo-50' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Catat Baru</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex flex-col items-center justify-center py-1.5 ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Database className={`w-5 h-5 mb-0 ${activeTab === 'history' ? 'fill-indigo-50' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">Data Transaksi</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      {/* Edit Modal */}
      {editingTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" />
                Ubah Transaksi
              </h3>
              <button 
                onClick={() => setEditingTransaction(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <InputField 
                label="Nomor Polisi" 
                value={editingTransaction.nomorPolisi || ''} 
                onChange={(e) => handleEditInputChange('nomorPolisi', e.target.value)} 
                placeholder="Contoh: DK1234AB"
                error={editFormErrors.nomorPolisi}
              />
              <InputField 
                label="Nama Pemilik" 
                value={editingTransaction.nama || ''} 
                onChange={(e) => handleEditInputChange('nama', e.target.value)} 
                error={editFormErrors.nama}
              />
              <InputField 
                label="Tanggal Bayar" 
                value={editingTransaction.tanggalBayar || ''} 
                onChange={(e) => handleEditInputChange('tanggalBayar', e.target.value)} 
                placeholder="Contoh: 09-03-2025"
                error={editFormErrors.tanggalBayar}
              />
              <InputField 
                label="Masa Pajak" 
                value={editingTransaction.masaPajak || ''} 
                onChange={(e) => handleEditInputChange('masaPajak', e.target.value)} 
                placeholder="Contoh: 1 TAHUN 0 BULAN"
                error={editFormErrors.masaPajak}
              />
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">Status Pembayaran</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editingTransaction.isTunggakan}
                      onChange={(e) => setEditingTransaction({...editingTransaction, isTunggakan: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    <span className={`ml-3 text-sm font-bold ${editingTransaction.isTunggakan ? 'text-red-600' : 'text-emerald-600'}`}>
                      {editingTransaction.isTunggakan ? 'TUNGGAKAN' : 'NON TUNGGAKAN'}
                    </span>
                  </label>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <AmountField 
                    label="PKB" 
                    value={editingTransaction.jumlahPkb || ''} 
                    onChange={(e) => handleEditInputChange('jumlahPkb', e.target.value)} 
                    error={editFormErrors.jumlahPkb}
                  />
                  <AmountField 
                    label="Opsen PKB" 
                    value={editingTransaction.jumlahOpsenPkb || ''} 
                    onChange={(e) => handleEditInputChange('jumlahOpsenPkb', e.target.value)} 
                    error={editFormErrors.jumlahOpsenPkb}
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
              <button 
                onClick={() => setEditingTransaction(null)}
                className="flex-1 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-2.5 px-4 rounded-xl transition-colors active:scale-[0.98]"
              >
                Batal
              </button>
              <button 
                onClick={handleUpdateTransaction}
                disabled={isUpdating}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98] disabled:opacity-70 flex items-center justify-center"
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Perubahan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Input Modal */}
      {showManualInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Keyboard className="w-5 h-5 text-emerald-600" />
                Manual Transaksi
              </h3>
              <button 
                onClick={() => setShowManualInputModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <InputField 
                label="Nomor Polisi" 
                value={manualFormData.nomorPolisi || ''} 
                onChange={(e) => handleManualInputChange('nomorPolisi', e.target.value)} 
                placeholder="Contoh: DK1234AB"
                error={manualFormErrors.nomorPolisi}
              />
              <InputField 
                label="Nama Pemilik" 
                value={manualFormData.nama || ''} 
                onChange={(e) => handleManualInputChange('nama', e.target.value)} 
                error={manualFormErrors.nama}
              />
              <InputField 
                label="Tanggal Bayar" 
                value={manualFormData.tanggalBayar || ''} 
                onChange={(e) => handleManualInputChange('tanggalBayar', e.target.value)} 
                placeholder="Contoh: 09-03-2025"
                error={manualFormErrors.tanggalBayar}
              />
              <InputField 
                label="Masa Pajak" 
                value={manualFormData.masaPajak || ''} 
                onChange={(e) => handleManualInputChange('masaPajak', e.target.value)} 
                placeholder="Contoh: 1 TAHUN 0 BULAN"
                error={manualFormErrors.masaPajak}
              />
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">Status Pembayaran</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={manualFormData.isTunggakan}
                      onChange={(e) => setManualFormData({...manualFormData, isTunggakan: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    <span className={`ml-3 text-sm font-bold ${manualFormData.isTunggakan ? 'text-red-600' : 'text-emerald-600'}`}>
                      {manualFormData.isTunggakan ? 'TUNGGAKAN' : 'NON TUNGGAKAN'}
                    </span>
                  </label>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <AmountField 
                    label="PKB" 
                    value={manualFormData.jumlahPkb || ''} 
                    onChange={(e) => handleManualInputChange('jumlahPkb', e.target.value)} 
                    error={manualFormErrors.jumlahPkb}
                  />
                  <AmountField 
                    label="Opsen PKB" 
                    value={manualFormData.jumlahOpsenPkb || ''} 
                    onChange={(e) => handleManualInputChange('jumlahOpsenPkb', e.target.value)} 
                    error={manualFormErrors.jumlahOpsenPkb}
                  />
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-white flex gap-3">
              <button 
                onClick={() => setShowManualInputModal(false)}
                className="flex-1 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-2.5 px-4 rounded-xl transition-colors active:scale-[0.98]"
              >
                Batal
              </button>
              <button 
                onClick={handleSaveManualTransaction}
                disabled={saving}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98] disabled:opacity-70 flex items-center justify-center"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  'Simpan Transaksi'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-100">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Data?</h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Anda yakin ingin menghapus data dengan nomor polisi <span className="font-bold text-slate-800">{deleteConfirm.nopol}</span>?
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl transition-colors active:scale-[0.98]"
                >
                  Batal
                </button>
                <button 
                  onClick={executeDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98]"
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {logoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mb-4 border border-slate-200">
                <LogOut className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Keluar Aplikasi?</h3>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Anda yakin ingin keluar dari akun <span className="font-bold text-slate-800">{currentUser}</span>?
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  onClick={() => setLogoutConfirm(false)}
                  className="flex-1 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 font-medium py-3 px-4 rounded-xl transition-colors active:scale-[0.98]"
                >
                  Batal
                </button>
                <button 
                  onClick={() => {
                    setIsAuthenticated(false);
                    setCurrentUser('');
                    setTransactions([]);
                    setLogoutConfirm(false);
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-sm active:scale-[0.98]"
                >
                  Ya, Keluar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components for UI
const InputField = ({ 
  label, 
  value, 
  onChange, 
  isTextArea = false,
  placeholder = '',
  error
}: { 
  label: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  isTextArea?: boolean;
  placeholder?: string;
  error?: string;
}) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
      {label}
    </label>
    {isTextArea ? (
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={2}
        className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-medium text-sm resize-none ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'}`}
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-medium text-sm ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'}`}
      />
    )}
    {error && <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">{error}</p>}
  </div>
);

const AmountField = ({ 
  label, 
  value, 
  onChange,
  error
}: { 
  label: string; 
  value: string; 
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) => (
  <div>
    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
      {label}
    </label>
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={onChange}
        className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-bold text-sm ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'}`}
      />
    </div>
    {error && <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">{error}</p>}
  </div>
);

// Login Component
interface LoginProps {
  onLogin: (username: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('Kerti 1');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Password tidak boleh kosong');
      return;
    }

    // Validasi dummy: password harus "123456"
    if (password !== '123456') {
      setError('Username atau password salah');
      return;
    }

    onLogin(username);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden font-sans">
      <div className="w-full max-w-md px-6 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center w-full">
          
          {/* Logo Area */}
          <div className="flex flex-col items-center justify-center mb-10">
            {/* SAMSAT Text */}
            <div className="flex items-center">
              <h1 className="text-3xl font-light text-slate-800 tracking-[0.15em] uppercase">
                S<span className="text-red-600 font-medium">A</span>MSAT
              </h1>
            </div>
            
            {/* Subtitle */}
            <div className="flex items-center mt-2">
              <span className="text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 via-blue-500 to-orange-500 uppercase tracking-[0.2em]">
                KERTI
              </span>
            </div>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="w-full mb-6 text-red-500 text-sm font-medium text-center bg-red-50 py-3 px-4 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2 duration-200 flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="w-full space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Username
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full pl-11 pr-10 py-4 bg-white border ${isDropdownOpen ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-200'} rounded-2xl transition-all text-slate-800 font-semibold text-sm cursor-pointer shadow-sm flex items-center justify-between text-left`}
                >
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <User className={`w-5 h-5 ${isDropdownOpen ? 'text-red-500' : 'text-slate-400'}`} />
                  </div>
                  <span>{username}</span>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <ChevronDown className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180 text-red-500' : 'text-slate-400'}`} />
                  </div>
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    {['Kerti 1', 'Kerti 2', 'Kerti 3'].map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setUsername(option);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-5 py-3.5 text-sm font-medium transition-colors ${
                          username === option 
                            ? 'bg-red-50 text-red-700' 
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full pl-11 pr-12 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all text-slate-800 font-medium text-sm shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-8 bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-4 rounded-2xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98] uppercase tracking-wider text-sm flex items-center justify-center"
            >
              Masuk
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
