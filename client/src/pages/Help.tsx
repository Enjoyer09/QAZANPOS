import React, { useState } from "react";
import { 
  HelpCircle, 
  Search, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Sparkles, 
  ShieldCheck, 
  Printer, 
  WifiOff, 
  Tag, 
  Truck, 
  UserCheck, 
  Send, 
  Sliders,
  DollarSign,
  RotateCcw,
  Globe
} from "lucide-react";

interface HelpTopic {
  id: string;
  title: string;
  category: "maliyye" | "anbar" | "sistem" | "tehlukesizlik";
  icon: any;
  content: React.ReactNode;
}

export default function Help() {
  const [searchQuery, setSearchQuery] = useState("");
  const [openTopicId, setOpenTopicId] = useState<string | null>("birmarket");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const topics: HelpTopic[] = [
    {
      id: "birmarket",
      title: "🌐 birmarket.az və Marketplace Komissiyalarının Uçotu",
      category: "maliyye",
      icon: Globe,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Əgər məhsullarınızı **birmarket.az** və ya digər onlayn marketplace platformalarında satırsınızsa, platformanın tutduğu satış komissiyalarını (xidmət haqlarını) sistemdə avtomatik hesablaya bilərsiniz.
          </p>
          <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-black text-purple-700 uppercase block tracking-wider">Açar Üstünlük</span>
            <span className="text-xs text-purple-950 font-semibold block">
              Siz satışı tam məbləğlə POS-da bağlayırsınız (anbar düzgün azalır), lakin platformanın tutduğu faiz avtomatik olaraq <b>"Xərclər"</b> bölməsinə <b>komissiya xərci</b> kimi qeyd edilir! Kassa balansınız və mənfəətiniz 100% dəqiq olur.
            </span>
          </div>
          <h4 className="font-extrabold text-gray-900 text-xs mt-3 uppercase tracking-wider">Addım-Addım Təlimat:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>Komissiya Faizlərini Təyin Edin:</b> <a href="/ayarlar" className="text-primary hover:underline font-bold">Ayarlar</a> səhifəsinə daxil olun, <b>"Marketplace Komissiyaları"</b> tabına keçin. Mövcud məhsul kateqoriyalarınız üçün platformanın tutduğu faiz dərəcəsini (%) daxil edin (məs. <i>Mətbəx</i> - 5%, <i>Telefonlar</i> - 10%) və yadda saxlayın.
            </li>
            <li>
              <b>Kassada Satış Kanalını Seçin:</b> Satış edərkən POS ekranında sağ tərəfdəki <b>"Satış Kanalı"</b> açılan siyahısından <b>"🌐 birmarket.az (Marketplace)"</b> rejimini seçin.
            </li>
            <li>
              <b>Xalis Qazancı Görün:</b> Sistem səbətdəki malların kateqoriyalarına görə platforma komissiyasını və sizə qalan <b>Xalis Məbləği</b> real vaxtda hesablayıb ekranda göstərəcək.
            </li>
            <li>
              <b>Avtomatik Uçot:</b> Satış tamamlandığı an, sistem arxa planda avtomatik olaraq <b>"Xərclər Modulu"</b> üzərində <i>"Marketplace Komissiyası"</i> kateqoriyalı xərc qeydi yaradacaq. Sizin əlavə xərc yazmağınıza ehtiyac qalmır!
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "tax-ayarlar",
      title: "🏛️ Azərbaycan Vergi Sistemi və VÖEN Ayarları",
      category: "sistem",
      icon: Sliders,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Müəssisənizin dövlət vergi orqanları qarşısında hesabatlılığı və müştərilərə təqdim olunan çeklərin/qaimələrin rəsmi uyğunluğu üçün vergi profilinizi asanlıqla sazlayın.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">İstifadə Qaydası:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <a href="/ayarlar" className="text-primary hover:underline font-bold">Ayarlar</a> səhifəsindəki <b>"Vergi Ayarları"</b> tabına klikləyin.
            </li>
            <li>
              Şirkətinizin və ya fərdi sahibkarınızın <b>VÖEN-ini</b> (9 və ya 10 rəqəmli vergi kodunu) daxil edin.
            </li>
            <li>
              Müvafiq **Vergi Rejimini** seçin:
              <ul className="list-disc pl-4 mt-1 space-y-1 text-gray-600 font-medium">
                <li><i>Sadələşdirilmiş vergi</i> (Default olaraq 2% dərəcə ilə hesablama aparır).</li>
                <li><i>ƏDV Ödəyicisi</i> (Məhsulların qiyməti daxilində avtomatik 18% ƏDV hesablayır).</li>
                <li><i>Gəlir/Mənfəət vergisi</i> və ya <i>Vergidən Azad</i> statusları.</li>
              </ul>
            </li>
            <li>
              <b>Görünüş Tənzimləmələri:</b> Vergi məlumatlarının termal çeklərdə (POS) və ya rəsmi A4 satış qaimələrində (PDF Invoice) yazılmasını aktivləşdirib-deaktiv edə bilərsiniz.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "employee-advances",
      title: "💸 İşçilərə Avans (Məxaric) və Əməkhaqqı Tarixçəsi",
      category: "maliyye",
      icon: DollarSign,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Əməkdaşlarınıza ay ərzində verilən maaş avanslarını, cari borc qalıqlarını və ödəniş tarixlərini mərkəzləşdirilmiş şəkildə izləyə bilərsiniz.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Avansın Verilməsi və Uçotu:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>Əməkdaş Seçin:</b> <a href="/hr" className="text-primary hover:underline font-bold">HR & Əməkhaqqı</a> səhifəsinə daxil olun. <b>"Maaş Hesabatı"</b> tabında müvafiq ay üçün siyahıdan işçinin <b>adı üzərinə klikləyin</b>.
            </li>
            <li>
              <b>Ödəniş Pəncərəsi:</b> Açılan əməkdaş kartında <b>"Ödəniş Et 💸"</b> düyməsini sıxın.
            </li>
            <li>
              <b>Tez Qeyd (Avans):</b> Ödəniş modalında sürətli **"Avans (Məxaric) 💸"** düyməsinə klikləyin. Sistem avtomatik olaraq qeyd hissəsinə <i>"Avans"</i> yazacaq.
            </li>
            <li>
              Məbləği və ödəniş üsulunu (Nağd, Kart, Köçürmə) yazıb təsdiqləyin.
            </li>
            <li>
              <b>Avtomatik Hesablama:</b> Avans ödənilən kimi həmin işçinin aylıq maaş qalığı (borc) dərhal azalır və kassadan məxaric kimi qeydə alınır. Sətirdəki <b>"Tarixçə 📋"</b> düyməsindən işçinin aldığı bütün avans və yekun maaş tarixlərini şəffaf görə bilərsiniz.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "credit-rollback",
      title: "🔄 Səhvən Bağlanmış Müştəri Nisyə Borcunun Bərpası",
      category: "maliyye",
      icon: RotateCcw,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Əgər kassir müştərinin nisyə borcunu (kreditini) tam ödəmədiyi halda səhvən <b>"Tam Borcu Bağla"</b> düyməsi ilə tamamilə ödənilmiş kimi qeydə alarsa (məsələn, 5000 ₼ borcu olan müştəri 1000 ₼ verib, lakin səhvən hamısı bağlansa), bu səhvi asanlıqla geri qaytara bilərsiniz.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Borcun Bərpası Addımları (Yalnız Adminlər üçün):</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>Qaiməyə Giriş:</b> Səhv edilmiş satışın hesab-faktura (Invoice) səhifəsinə daxil olun. Bunu <a href="/satislar" className="text-primary hover:underline font-bold font-sans">Satış Tarixçəsi</a> bölməsində müvafiq çekin nömrəsinə və ya müştərinin kartındakı satışa klikləyərək edə bilərsiniz.
            </li>
            <li>
              <b>Ödəniş Tarixçəsi:</b> Səhifənin aşağısındakı <b>"Ödəniş Tarixçəsi"</b> panelinə enin.
            </li>
            <li>
              <b>Səhv Ödənişi Silin:</b> Səhv qeyd olunmuş tranzaksiyanın yanındakı qırmızı zibil qutusu (**Sil 🗑️**) düyməsinə klikləyin və əməliyyatı təsdiqləyin.
            </li>
            <li>
              <b>Borcun Geri Qayıtması:</b> Sistem həmin ödənişi tamamilə ləğv edəcək, ödənilməmiş məbləği **kredit borcu kimi müştərinin kartına geri yükləyəcək** və satış statusunu yenidən <b>"Nisyə" (Ödənilməyib)</b> vəziyyətinə gətirəcəkdir.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "2fa",
      title: "🔒 İki-Mərhələli Təhlükəsizlik (Google Authenticator 2FA)",
      category: "tehlukesizlik",
      icon: ShieldCheck,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Sisteminizin və maliyyə məlumatlarınızın kənar şəxslərdən tam qorunması üçün **Google Authenticator (TOTP)** inteqrasiyasını aktiv edin.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Aktivləşdirmək üçün:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li><b>Ayarlar</b> panelində <b>"İstifadəçilər və Təhlükəsizlik"</b> bölməsinə keçin.</li>
            <li><b>"2FA-nı Aktiv Et"</b> düyməsini sıxın.</li>
            <li>Mobil telefonunuzdakı Google Authenticator tətbiqi ilə ekrandakı **QR kodu skan edin** və 6 rəqəmli doğrulama kodunu daxil edərək təsdiqləyin.</li>
            <li><b>Giriş Yadda Saxlama:</b> Giriş edərkən <i>"Bu cihazı 30 gün yadda saxla"</i> xanasını işarələsəniz, növbəti 30 gün ərzində eyni brauzerdən 2FA kodu tələb olunmayacaq.</li>
          </ol>
        </div>
      )
    },
    {
      id: "silent-printing",
      title: "🖨️ Səssiz Çek Çapı (QZ Tray WebSocket İnteqrasiyası)",
      category: "sistem",
      icon: Printer,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Müştərilərə sürətli xidmət göstərmək və hər satışda standart brauzer çap pəncərəsinin açılmasının qarşısını almaq üçün səssiz çap sistemini qurun.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Quraşdırma:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>Kompüterinizə rəsmi **QZ Tray** proqramını yükləyin və işə salın.</li>
            <li>BirSaaS **Ayarlar** səhifəsində **"Çap və Çek Dizaynı"** tabına keçin.</li>
            <li>QQZ Statusu yaşıl rəngdə **"QOŞULDU"** olduqdan sonra, siyahıdan mağazadakı termal printeri seçib yadda saxlayın.</li>
            <li>İndi hər satış tamamlandığı an, heç bir çap ekranı çıxmadan çek printerdən avtomatik çap olunacaq.</li>
          </ol>
        </div>
      )
    },
    {
      id: "offline-pos",
      title: "📡 Oflayn POS Satış və Sinxronizasiya Mühərriki",
      category: "sistem",
      icon: WifiOff,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            İnternet kəsildikdə belə satışlarınızı dayandırmayın. BirSaaS oflayn satış mühərriki heç bir problem olmadan işləyir.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">İşləmə Qaydası:</h4>
          <ul className="list-disc pl-4 space-y-2 text-xs font-semibold text-gray-600">
            <li><b>Oflayn Rejimə Keçid:</b> İnternet bağlantısı itdiyi an POS ekranında sarı rəngli **"Oflayn Rejim 📡"** bildirişi aktivləşir.</li>
            <li><b>Anbar Qalıqları:</b> Satışlar yerli keşdən oxunan qalıqlar üzərindən aparılır və hər satışda anbar qalığı yerli olaraq çıxılır (ikiqat satışın qarşısı alınır).</li>
            <li><b>Avtomatik Sinxronizasiya:</b> İnternet bərpa olunan kimi sistem yaddaşdakı oflayn satışları avtomatik bulud bazasına ötürür və anbarı mərkəzi şəkildə yeniləyir.</li>
          </ul>
        </div>
      )
    },
    {
      id: "label-designer",
      title: "🏷️ Qiymət Etiketi və Barkod Generatoru",
      category: "anbar",
      icon: Tag,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Məhsulların rəf etiketlərini və yapışqanlı barkod etiketlərini vizual dizayner vasitəsilə sıfırdan hazırlayıb çap edə bilərsiniz.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">İstifadəsi:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>Menudan **Etiketlər** (`/etiketler`) səhifəsinə daxil olun.</li>
            <li><b>Kağız Ölçülərini</b> daxil edin (məs. 40x20 mm).</li>
            <li>Ekranda yerləşən elementləri (Məhsul adı, qiyməti, barkod, dükan adı) öz istəyinizə uyğun böyüdüb-kiçildin və yerini dəyişin.</li>
            <li>Dizaynı bitirdikdən sonra çap etmək istədiyiniz məhsulları və sayını seçib **"PDF Çıxart / Çap Et"** düyməsinə klikləyin.</li>
          </ol>
        </div>
      )
    },
    {
      id: "vendor-ledger",
      title: "🚚 Tədarükçülər və Borclar Uçotu (Vendor Ledger)",
      category: "anbar",
      icon: Truck,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Topdansatış firmaları ilə hesablaşmaları, kreditli mal alışlarını və ödəniş tarixlərini mürəkkəb proqramlara ehtiyac olmadan idarə edin.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Hesablaşma addımları:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>**Tədarükçülər** (`/tedarukculer`) bölməsində partnyor firmaları reyestrə əlavə edin.</li>
            <li>**Anbara Mədaxil** edərkən yuxarıdakı **"Tədarükçü"** sahəsindən həmin firmanın adını seçin.</li>
            <li>Mədaxili **"Nisyə"** olaraq qeyd etsəniz, məbləğ avtomatik tədarükçünün borc balansına (sizə olan nisyəsinə) yazılacaq.</li>
            <li>Borcu hissə-hissə və ya tam ödəmək üçün tədarükçü kartında **"Ödəniş et 💸"** düyməsini sıxmağınız kifayətdir.</li>
          </ol>
        </div>
      )
    },
    {
      id: "telegram-bot",
      title: "🤖 Telegram Bildiriş Botunun Qoşulması",
      category: "sistem",
      icon: Send,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Mağazanızda baş verən hər POS satışından və kassa məxariclərindən anında telefonunuza Telegram bildirişləri alın.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Quraşdırma addımları:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>Telegram-da `@BotFather` vasitəsilə `/newbot` komandası ilə öz botunuzu yaradın və botun **API Tokenini** kopyalayın.</li>
            <li><b>⚠️ Çox Vacib:</b> İndicə yaratdığınız botu Telegram-da tapıb söhbəti başladın (**START** düyməsinə klikləyin).</li>
            <li>Telegram-da `@userinfobot` botuna daxil olaraq öz şəxsi **Chat ID** (9-10 rəqəmli kod) nömrənizi öyrənin.</li>
            <li>Hər iki kodu BirSaaS **Ayarlar** (`/ayarlar`) səhifəsindəki **Telegram** bölməsinə daxil edib testi icra edin və yadda saxlayın.</li>
          </ol>
        </div>
      )
    }
  ];

  // Filtering topics based on category and query
  const filteredTopics = topics.filter(topic => {
    const matchesCategory = activeCategory === "all" || topic.category === activeCategory;
    const matchesSearch = topic.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          topic.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6 select-none animate-in fade-in-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1 bg-primary/10 border border-primary/20 text-primary text-[9px] font-black uppercase px-2.5 py-1 rounded-md tracking-wider">
            <BookOpen className="w-3.5 h-3.5" />
            Yardım və Dəstək
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight mt-1.5">
            İstifadəçi Təlimatları & Kömək 📘
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            QAZANPOS platformasının premium modulları haqqında ətraflı addım-addım təlimatlar
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Mövzu axtarın (məs. komissiya, avans, 2fa)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary bg-white shadow-xs text-xs font-semibold"
          />
        </div>

        {/* Category Filters */}
        <div className="flex bg-white/70 p-1 rounded-xl border border-gray-200/50 shadow-xs gap-1">
          <button
            onClick={() => setActiveCategory("all")}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all ${
              activeCategory === "all" ? "bg-primary text-white shadow-xs" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Hamısı
          </button>
          <button
            onClick={() => setActiveCategory("maliye")}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all ${
              activeCategory === "maliye" ? "bg-primary text-white shadow-xs" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Maliyyə
          </button>
          <button
            onClick={() => setActiveCategory("anbar")}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all ${
              activeCategory === "anbar" ? "bg-primary text-white shadow-xs" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Anbar
          </button>
          <button
            onClick={() => setActiveCategory("sistem")}
            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-all ${
              activeCategory === "sistem" ? "bg-primary text-white shadow-xs" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            Sistem
          </button>
        </div>
      </div>

      {/* Accordion Topics List */}
      <div className="space-y-4">
        {filteredTopics.length === 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-xs font-bold text-gray-400 shadow-xs glass-card">
            Axtarışa və ya kateqoriyaya uyğun təlimat tapılmadı...
          </div>
        ) : (
          filteredTopics.map((topic) => {
            const isOpen = openTopicId === topic.id;
            const TopicIcon = topic.icon;
            return (
              <div 
                key={topic.id}
                className={`bg-white border rounded-2xl shadow-xs transition-all duration-300 overflow-hidden ${
                  isOpen ? "border-primary/30 ring-1 ring-primary/5" : "border-gray-100 hover:border-gray-200/80"
                }`}
              >
                {/* Header */}
                <button
                  onClick={() => setOpenTopicId(isOpen ? null : topic.id)}
                  className="w-full flex items-center justify-between p-5 text-left cursor-pointer hover:bg-gray-50/20 transition-all"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`size-9 rounded-xl flex items-center justify-center transition-all ${
                      isOpen ? "bg-primary/10 text-primary" : "bg-gray-50 text-gray-500"
                    }`}>
                      <TopicIcon className="w-4.5 h-4.5" />
                    </div>
                    <span className="font-extrabold text-gray-900 text-xs sm:text-sm tracking-tight">
                      {topic.title}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Content Panel */}
                {isOpen && (
                  <div className="p-6 pt-0 border-t border-gray-50/50 bg-gray-50/10 text-xs font-semibold animate-in slide-in-from-top-2.5 duration-200">
                    <div className="mt-4">
                      {topic.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
