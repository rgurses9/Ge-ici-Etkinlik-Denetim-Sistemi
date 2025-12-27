import React, { useState } from 'react';
import { X, AlertCircle, Smartphone, Trash2, Info, CheckCircle, CreditCard, Users, Shield, Play, FileText, Database, RefreshCw, Target, BookOpen } from 'lucide-react';

interface HelpGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

const HelpGuide: React.FC<HelpGuideProps> = ({ isOpen, onClose }) => {
    const [activeSection, setActiveSection] = useState<'quick' | 'full'>('quick');

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 p-5 flex items-center justify-between text-white shrink-0">
                    <div>
                        <h3 className="font-bold flex items-center gap-2 text-lg">
                            <BookOpen size={24} className="text-blue-200" />
                            Yardım ve Kullanım Kılavuzu
                        </h3>
                        <p className="text-xs text-blue-200 mt-1">Geçici Etkinlik Denetim Sistemi</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="hover:bg-blue-800 dark:hover:bg-blue-900 p-1.5 rounded-full transition-colors"
                        aria-label="Kapat"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <div className="flex">
                        <button
                            onClick={() => setActiveSection('quick')}
                            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeSection === 'quick'
                                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <AlertCircle size={16} />
                                <span>Hızlı Yardım</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveSection('full')}
                            className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${activeSection === 'full'
                                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                        >
                            <div className="flex items-center justify-center gap-2">
                                <FileText size={16} />
                                <span>Detaylı Kılavuz</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 overflow-y-auto bg-gray-50 dark:bg-gray-900 custom-scrollbar">
                    {activeSection === 'quick' ? (
                        <div className="space-y-6">

                            {/* Veritabanında Bulunamadı Uyarısı */}
                            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={24} />
                                    <div>
                                        <h4 className="font-bold text-red-900 dark:text-red-100 text-base mb-2">
                                            "Veritabanında Bulunamadı" Uyarısı
                                        </h4>
                                        <p className="text-red-800 dark:text-red-200 text-sm leading-relaxed mb-3">
                                            Kimlik okutma sırasında bu uyarıyı görürseniz, lütfen aşağıdaki kontrolleri yapın:
                                        </p>
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2">
                                                <CreditCard className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={16} />
                                                <p className="text-sm text-red-800 dark:text-red-200">
                                                    <strong>Kimlik Kartı Kontrolü:</strong> Kişinin kimlik kartının geçerlilik süresini kontrol edin.
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <CheckCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={16} />
                                                <p className="text-sm text-red-800 dark:text-red-200">
                                                    <strong>Özel Güvenlik Kimlik Kartı:</strong> Eğer kişinin geçerli bir özel güvenlik kimlik kartı varsa, etkinlikte görev alabilir.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Mobil Kullanım */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-lg p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <Smartphone className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" size={24} />
                                    <div>
                                        <h4 className="font-bold text-blue-900 dark:text-blue-100 text-base mb-2">
                                            Telefonda Kullanım
                                        </h4>
                                        <div className="bg-blue-100 dark:bg-blue-800/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                                            <p className="text-sm text-blue-900 dark:text-blue-100 font-semibold flex items-center gap-2">
                                                <Smartphone className="rotate-90" size={18} />
                                                Telefonunuzu <span className="text-blue-600 dark:text-blue-400 font-bold">YATAY (Landscape)</span> konumda kullanın
                                            </p>
                                            <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                                                Yatay mod, kimlik okutma ve veri girişi için daha geniş alan sağlar.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Kimlik Silme */}
                            <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 rounded-lg p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <Trash2 className="text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" size={24} />
                                    <div>
                                        <h4 className="font-bold text-orange-900 dark:text-orange-100 text-base mb-2">
                                            Yanlış Kimlik Okutma
                                        </h4>
                                        <div className="space-y-2">
                                            <div className="flex items-start gap-2">
                                                <div className="bg-orange-600 dark:bg-orange-500 text-white rounded px-2 py-0.5 text-xs font-bold shrink-0 mt-0.5">1</div>
                                                <p className="text-sm text-orange-800 dark:text-orange-200">
                                                    Okutulan kimliğin yanındaki <strong>silme (çöp kutusu) butonuna</strong> tıklayın
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <div className="bg-orange-600 dark:bg-orange-500 text-white rounded px-2 py-0.5 text-xs font-bold shrink-0 mt-0.5">2</div>
                                                <p className="text-sm text-orange-800 dark:text-orange-200">
                                                    Onay mesajını kabul ederek yanlış kaydı silebilirsiniz
                                                </p>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <div className="bg-orange-600 dark:bg-orange-500 text-white rounded px-2 py-0.5 text-xs font-bold shrink-0 mt-0.5">3</div>
                                                <p className="text-sm text-orange-800 dark:text-orange-200">
                                                    Doğru kimliği tekrar okutun
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Önemli Bilgilendirmeler */}
                            <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 rounded-lg p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <Info className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" size={24} />
                                    <div>
                                        <h4 className="font-bold text-purple-900 dark:text-purple-100 text-base mb-2">
                                            Önemli Bilgilendirmeler
                                        </h4>
                                        <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-200">
                                            <li className="flex items-start gap-2">
                                                <Database size={16} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                                <span><strong>Veritabanı Kontrolü:</strong> Yeşil renk geçerli, kırmızı renk bulunamadı/süresi doldu anlamına gelir</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <AlertCircle size={16} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                                <span><strong>Çakışma Kontrolü:</strong> Bir kişi aynı anda sadece bir aktif etkinlikte bulunabilir</span>
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <RefreshCw size={16} className="text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                                                <span><strong>Canlı Senkronizasyon:</strong> Tüm okutmalar anlık olarak diğer cihazlara yansır</span>
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="space-y-6">

                            {/* Amaç ve Kapsam */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-3 flex items-center gap-2">
                                    <Target size={20} className="text-blue-600" />
                                    Amaç ve Kapsam
                                </h4>
                                <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                                    <p>
                                        <strong className="text-gray-900 dark:text-white">Amaç:</strong> Bu sistemin amacı, geçici etkinliklerde görev alacak personelin kimlik doğrulamalarını yapmak, belirlenen kotaları takip etmek ve aynı personelin çakışan saatlerde farklı etkinliklerde görev almasını (mükerrer kayıt) engellemektir.
                                    </p>
                                    <p>
                                        <strong className="text-gray-900 dark:text-white">Kapsam:</strong> Bu kılavuz; sisteme giriş, etkinlik yönetimi, kimlik sorgulama ekranları, veritabanı entegrasyonu ve raporlama süreçlerinin tamamını kapsar.
                                    </p>
                                </div>
                            </div>

                            {/* Giriş İşlemleri */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-3 flex items-center gap-2">
                                    <Users size={20} className="text-green-600" />
                                    Giriş İşlemleri
                                </h4>
                                <div className="space-y-4">
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                                        <h5 className="font-bold text-green-900 dark:text-green-100 mb-2">Kullanıcı Girişi</h5>
                                        <p className="text-sm text-green-800 dark:text-green-200">
                                            Saha personeli için tasarlanmıştır. Sadece denetim başlatabilir ve kimlik okutabilir.
                                        </p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
                                        <h5 className="font-bold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                                            <Shield size={16} />
                                            Yönetici Girişi
                                        </h5>
                                        <p className="text-sm text-red-800 dark:text-red-200">
                                            Sistem yöneticileri içindir. Etkinlik oluşturma, kullanıcı yönetimi ve raporlama yetkisi vardır.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Yönetici Kılavuzu */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-3 flex items-center gap-2">
                                    <Shield size={20} className="text-red-600" />
                                    Yönetici Kılavuzu
                                </h4>
                                <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold shrink-0">•</span>
                                        <span><strong>Ana Panel:</strong> Aktif, Devam Eden ve Pasif etkinliklerinizi buradan takip edebilirsiniz.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold shrink-0">•</span>
                                        <span><strong>Etkinlik Yönetimi:</strong> Yeni etkinlik ekleyebilir, silebilir veya pasif etkinlikleri tekrar aktif hale getirebilirsiniz.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold shrink-0">•</span>
                                        <span><strong>Excel Yükle:</strong> Denetim ekranında toplu TC listesi yükleyerek hızlı kayıt yapabilirsiniz.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-blue-600 font-bold shrink-0">•</span>
                                        <span><strong>Kullanıcılar:</strong> "Kullanıcılar" sekmesinden yeni personel ekleyebilir, yetki değiştirebilir veya şifre sıfırlayabilirsiniz.</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Kullanıcı Kılavuzu */}
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm border border-gray-200 dark:border-gray-700">
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg mb-3 flex items-center gap-2">
                                    <Play size={20} className="text-blue-600" />
                                    Kullanıcı Kılavuzu
                                </h4>
                                <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <div className="bg-blue-600 text-white rounded px-2 py-0.5 text-xs font-bold shrink-0 mt-0.5">1</div>
                                        <span><strong>Denetim Başlat:</strong> Atandığınız etkinliği seçerek "Denetimi Başlat" butonuna basın.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="bg-blue-600 text-white rounded px-2 py-0.5 text-xs font-bold shrink-0 mt-0.5">2</div>
                                        <span><strong>TC Okutma:</strong> Kimlik numarasını girin. Sistem otomatik olarak veritabanı, çakışma ve kota kontrolü yapar.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <div className="bg-blue-600 text-white rounded px-2 py-0.5 text-xs font-bold shrink-0 mt-0.5">3</div>
                                        <span><strong>Denetimi Bitir:</strong> Hedef sayıya ulaşıldığında buton aktif olur. Basıldığında liste Excel olarak iner ve etkinlik kapanır.</span>
                                    </li>
                                </ul>
                            </div>

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-gray-100 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors shadow-sm"
                    >
                        Anladım
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelpGuide;
