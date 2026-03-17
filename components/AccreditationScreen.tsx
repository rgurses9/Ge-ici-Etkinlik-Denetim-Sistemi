import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Event, AccreditationPersonnel } from '../types';
import { Shield, Send, Download, Home, Plus, Users, Search, X, CheckCircle } from 'lucide-react';

interface AccreditationScreenProps {
    event: Event;
    targetCount: number;
    onExit: () => void;
    onSave: (personnelList: AccreditationPersonnel[]) => void;
}

const GOOGLE_SHEETS_CSV_URL = "https://docs.google.com/spreadsheets/d/1J6SFLRCGk2-iBzi7TTjthyNzN4dWHH8A/gviz/tq?tqx=out:csv&gid=1490010137";

const AccreditationScreen: React.FC<AccreditationScreenProps> = ({ event, targetCount, onExit, onSave }) => {
    const [personnelList, setPersonnelList] = useState<AccreditationPersonnel[]>([]);
    const [addedPersonnel, setAddedPersonnel] = useState<AccreditationPersonnel[]>(event.accreditationPersonnel || []);
    const [searchText, setSearchText] = useState("");
    const [isLoading, setIsLoading] = useState(true);
    const [isReadyCardVisible, setIsReadyCardVisible] = useState(false);

    useEffect(() => {
        // Escape key handling
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isReadyCardVisible) {
                onExit();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onExit, isReadyCardVisible]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(GOOGLE_SHEETS_CSV_URL);
                const text = await response.text();
                const workbook = XLSX.read(text, { type: 'string', raw: true });
                const sheetName = workbook.SheetNames[0];
                const data = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName], { defval: "" });

                const mappedData: AccreditationPersonnel[] = data.map((row: any) => ({
                    sn: String(row['SN.'] || ''),
                    sicili: String(row['SİCİLİ'] || ''),
                    tcKimlik: String(row['TC. KİMLİK'] || ''),
                    adi: String(row['ADI'] || ''),
                    rutbesi: String(row['RÜTBESİ'] || ''),
                    dogumTarihi: String(row['DOGUM TARİHİ'] || ''),
                    cepTel: String(row['CEP TEL'] || '')
                })).filter((p) => p.adi && p.adi.trim() !== "");

                setPersonnelList(mappedData);
            } catch (error) {
                console.error("Error fetching Google Sheets data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const filteredPersonnel = useMemo(() => {
        if (!searchText.trim()) return [];
        const lowerSearch = searchText.toLowerCase();
        return personnelList.filter(p => p.adi.toLowerCase().includes(lowerSearch) && !addedPersonnel.some(ap => ap.sicili === p.sicili));
    }, [searchText, personnelList, addedPersonnel]);

    const addPersonnel = (p: AccreditationPersonnel) => {
        if (addedPersonnel.length >= targetCount) return;
        const newList = [...addedPersonnel, p];
        setAddedPersonnel(newList);
        onSave(newList);
        setSearchText("");
    };

    const removePersonnel = (sicili: string) => {
        const newList = addedPersonnel.filter(p => p.sicili !== sicili);
        setAddedPersonnel(newList);
        onSave(newList);
    };

    // Removed automatic popup effect so users can review/edit the list.

    const handleDownloadExcel = () => {
        const excelData = addedPersonnel.map((p, i) => {
            // Check fresh database for the correct date format if old state has corrupted it
            const freshPersonnel = personnelList.find(fp => fp.sicili === p.sicili);
            let displayDogumTarihi = freshPersonnel?.dogumTarihi || p.dogumTarihi;

            // Format number gracefully as a string in javascript (Fallback)
            if (!isNaN(Number(displayDogumTarihi)) && Number(displayDogumTarihi) > 10000) {
                const serial = Number(displayDogumTarihi);
                const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
                displayDogumTarihi = `${String(date.getUTCDate()).padStart(2, '0')}.${String(date.getUTCMonth() + 1).padStart(2, '0')}.${date.getUTCFullYear()}`;
            }

            return {
                "SN.": i + 1,
                "SİCİLİ": p.sicili,
                "TC. KİMLİK": p.tcKimlik,
                "ADI": p.adi,
                "RÜTBESİ": p.rutbesi,
                "DOGUM TARİHİ": displayDogumTarihi,
                "CEP TEL": p.cepTel
            };
        });

        const ws = XLSX.utils.json_to_sheet(excelData);

        // Auto-sizing columns based on content length
        const cols = Object.keys(excelData[0] || {}).map(key => {
            const maxLen = Math.max(
                key.length,
                ...excelData.map(row => String((row as any)[key] || '').length)
            );
            return { wch: maxLen + 2 };
        });
        ws['!cols'] = cols;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Personel_Listesi");
        XLSX.writeFile(wb, `${event.name} Özel Güvenlik Şube Müdürlüğü.xlsx`);
    };

    const handleSendToWhatsApp = () => {
        // encodeURIComponent gives spaces as %20.
        const message = `Sayın Onur Özkan,\n\n"${event.name}" müsabakası için hedefimiz olan ${targetCount} personelin akreditasyon listesi hazırlanmıştır.`;
        const encodedText = encodeURIComponent(message);
        window.open(`https://api.whatsapp.com/send?phone=905437803272&text=${encodedText}`, '_blank');
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-[100] bg-[#0d1627] flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <p className="text-gray-400 font-medium">Personel Listesi Yükleniyor...</p>
                </div>
            </div>
        );
    }

    // Ready Card Full Screen Overlay
    if (isReadyCardVisible) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0d1627] text-white">
                <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-8 text-center text-gray-800 shadow-2xl relative">
                    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-green-500" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">Liste Hazır!</h2>
                    <p className="text-gray-500 mb-8">Hedeflenen <span className="font-bold text-gray-700">{targetCount}</span> personel sayısına ulaşıldı.</p>

                    <div className="space-y-3">
                        <button
                            onClick={handleDownloadExcel}
                            className="w-full bg-[#1e4dec] hover:bg-blue-700 text-white font-semibold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Download size={18} />
                            Excel Olarak İndir ve Kaydet
                        </button>
                        <button
                            onClick={onExit}
                            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 mt-4"
                        >
                            <Home size={18} />
                            Ana Ekrana Dön
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] bg-[#0d1627] flex flex-col font-sans overflow-auto select-none">
            {/* Header */}
            <header className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 lg:px-8 bg-[#0d1627]">
                <div className="flex items-center gap-4 w-full justify-between sm:justify-start sm:w-auto">
                    <div className="flex gap-3 items-center">
                        <div className="p-2 sm:p-3 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/20">
                            <Shield size={24} className="sm:w-8 sm:h-8" />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">AKREDİTASYON SİSTEMİ</h1>
                            <p className="text-[10px] sm:text-xs text-blue-300/80 font-semibold uppercase tracking-wider">Kart Oluşturma & Görev Takip</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-5 mt-4 sm:mt-0 w-full justify-end sm:w-auto">
                    <div className="text-right flex flex-col items-end hidden sm:flex">
                        <span className="text-white text-sm font-bold">Yönetici</span>
                        <span className="text-red-400/90 text-[11px] font-black tracking-wide uppercase">Yönetici</span>
                    </div>
                    <button onClick={onExit} className="p-2 sm:p-3 bg-gray-800/80 rounded-xl hover:bg-gray-700 transition" title="Ana Sayfaya Dön (ESC)">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex-1 overflow-auto">
                <div className="flex flex-col lg:flex-row gap-6 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 pb-20">

                    {/* Left Side: Adding Personnel */}
                    <div className="w-full lg:w-[45%]">
                        <div className="bg-white rounded-[1.5rem] shadow-2xl overflow-hidden min-h-[400px]">
                            <div className="p-6 pb-4 border-b border-gray-100 flex items-center gap-3">
                                <div className="text-blue-500">
                                    <span className="text-2xl"><Users size={26} strokeWidth={2.5} /></span>
                                </div>
                                <h2 className="text-[1.35rem] font-bold text-gray-800">Personel Ekleme</h2>
                            </div>

                            <div className="p-6">
                                <label className="block text-sm font-bold text-gray-600 mb-2">
                                    Personel Seç (Ad Soyad)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="İsim arayın..."
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        className="w-full pl-4 pr-10 py-3.5 rounded-xl border-2 border-blue-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition outline-none text-gray-700 font-medium"
                                    />
                                    {!searchText && <Search size={20} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400" />}
                                    {searchText && <X size={20} className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer" onClick={() => setSearchText("")} />}
                                </div>

                                {/* Suggestions Dropdown */}
                                {searchText && filteredPersonnel.length > 0 && (
                                    <div className="mt-2 border border-blue-100 rounded-xl overflow-hidden shadow-lg max-h-56 overflow-y-auto">
                                        {filteredPersonnel.map(p => (
                                            <button
                                                key={p.sicili}
                                                onClick={() => addPersonnel(p)}
                                                className="w-full text-left px-4 py-3 bg-white hover:bg-blue-50 border-b border-gray-100 last:border-0 transition flex justify-between items-center group focus:outline-none focus:bg-blue-50"
                                            >
                                                <div>
                                                    <div className="font-bold text-gray-800">{p.adi}</div>
                                                    <div className="text-xs text-gray-500 font-medium mt-0.5">{p.rutbesi} - {p.sicili}</div>
                                                </div>
                                                <Plus size={20} className="text-gray-300 group-hover:text-blue-600 transition" />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {searchText && filteredPersonnel.length === 0 && (
                                    <div className="mt-2 p-5 text-center text-sm font-medium text-gray-400 border border-gray-100 bg-gray-50 rounded-xl">
                                        Personel bulunamadı veya daha önce eklendi.
                                    </div>
                                )}

                                {!searchText && (
                                    <div className="mt-6 bg-blue-50/70 p-5 rounded-2xl text-blue-700/80 text-sm font-semibold border border-blue-100/50">
                                        Listeden personeli seçerek ekleyebilirsiniz.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Added Personnel List */}
                    <div className="w-full lg:w-[55%]">
                        <div className="bg-white rounded-[1.5rem] shadow-2xl overflow-hidden flex flex-col h-[500px] lg:h-[600px]">
                            <div className="p-6 border-b border-gray-100 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="pr-4 max-w-[75%]">
                                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">
                                        {event.name}
                                    </h2>
                                    <p className="text-sm font-semibold text-gray-400 mt-1">Personel Listesi</p>
                                </div>
                                <div className="flex items-baseline gap-1 self-end sm:self-auto">
                                    <span className="text-4xl font-black text-blue-600 tracking-tighter">{addedPersonnel.length}</span>
                                    <span className="text-xl font-bold text-gray-300">/{targetCount}</span>
                                </div>
                            </div>

                            <div className="flex-1 p-6 flex flex-col overflow-hidden bg-white">
                                {addedPersonnel.length === 0 ? (
                                    <div className="m-auto flex flex-col items-center justify-center text-gray-400 gap-4">
                                        <div className="w-24 h-24 bg-gray-50/80 rounded-full flex items-center justify-center">
                                            <Users size={40} className="text-gray-300/80" />
                                        </div>
                                        <p className="font-bold text-lg text-gray-400">Henüz personel eklenmedi.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                        {addedPersonnel.map((p, index) => (
                                            <div key={p.sicili} className="flex items-center justify-between p-4 bg-white border-2 border-gray-50 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-100 transition">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center text-sm shrink-0">
                                                        {index + 1}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-gray-800">{p.adi}</h4>
                                                        <p className="text-xs text-gray-400 font-semibold mt-0.5">{p.rutbesi} &bull; {p.sicili}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => removePersonnel(p.sicili)}
                                                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition focus:outline-none focus:bg-red-50 focus:text-red-500"
                                                    title="Sil"
                                                >
                                                    <X size={20} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Tamamla / Kaydet Butonu */}
                            <div className="p-6 border-t border-gray-100 bg-gray-50/50">
                                <button
                                    onClick={() => setIsReadyCardVisible(true)}
                                    disabled={addedPersonnel.length === 0}
                                    className="w-full bg-[#1e4dec] hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-md"
                                >
                                    <CheckCircle size={20} />
                                    {addedPersonnel.length >= targetCount ? "Listeyi Tamamla ve İndir" : "Listeyi Kaydet"}
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AccreditationScreen;
