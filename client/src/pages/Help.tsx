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
  Globe,
  CreditCard,
  Calendar
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
          
          <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 space-y-2">
            <span className="text-[10px] font-black text-amber-800 uppercase block tracking-wider">💡 Praktik Nümunə (800 ₼ Maaş + Həftəlik 100 ₼ Avans):</span>
            <p className="text-xs text-amber-950 font-medium leading-relaxed">
              Təsəvvür edək ki, <b>800 AZN</b> maaş alan işçiyə hər həftə <b>100 AZN</b> avans verirsiniz, ay sonunda isə qalan <b>400 AZN</b> yekun məbləği ödəyirsiniz. Sistemdə bunu etmək çox asandır:
            </p>
            <ul className="list-disc pl-4 text-[11px] text-amber-900 font-semibold space-y-1">
              <li>Maaş hesabatını çıxardıqdan sonra işçinin sətirində <b>"Ödə 💸"</b> düyməsini sıxın.</li>
              <li>Açılan pəncərədə məbləğə <b>100</b> yazıb, <b>"Avans (Məxaric) 💸"</b> sürətli qeydinə klikləyin və ödənişi təsdiqləyin. İşçinin qalıq borcu 700 ₼ olacaq və kassa balansı azalacaq.</li>
              <li>Hər həftə bu prosesi təkrarlayın. 4 həftənin sonunda işçinin ödənilmiş cəmi 400 ₼, qalıq maaş öhdəliyi isə 400 ₼ olacaq.</li>
              <li>Ay sonunda yenidən <b>"Ödə 💸"</b> düyməsinə kliklədikdə, sistem avtomatik olaraq qalıq məbləği (<b>400.00 ₼</b>) hazır gətirəcək. <b>"Maaş (Yekun) 💵"</b> qeydini seçib ödənişi təsdiqləyin və işçinin maaş kartını tam bağlayın (status <b>Ödənilib ✅</b> olacaq).</li>
            </ul>
          </div>

          <h4 className="font-extrabold text-gray-900 text-xs mt-3 uppercase tracking-wider">Ümumi Avansın Verilməsi və Uçotu Addımları:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>Əməkdaş Seçin:</b> <a href="/hr" className="text-primary hover:underline font-bold">HR & Əməkhaqqı</a> səhifəsinə daxil olun. <b>"Maaş Hesabatı"</b> tabında müvafiq ay üçün siyahıdan işçinin sətirində yerləşən yaşıl <b>"Ödə 💸"</b> düyməsinə klikləyin.
            </li>
            <li>
              <b>Tez Qeyd (Avans):</b> Ödəniş modalında sürətli <b>"Avans (Məxaric) 💸"</b> düyməsinə klikləyin. Sistem avtomatik olaraq qeyd hissəsinə <i>"Avans"</i> sözünü yazacaq.
            </li>
            <li>
              Məbləği və ödəniş üsulunu (Nağd, Kart, Köçürmə) daxil edib təsdiqləyin.
            </li>
            <li>
              <b>Şəffaf Tarixçə:</b> İşçinin adının yanındakı <b>"Tarixçə (History 🔍)"</b> düyməsindən onun cari ay üzrə aldığı bütün avans və yekun maaş tarixçəsini anında görə bilərsiniz.
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
    },
    {
      id: "bank-seçimi",
      title: "🏦 Azərbaycan Bankları Seçimi və Kart Ödənişləri Uçotu",
      category: "maliyye",
      icon: CreditCard,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Kartla edilən ödənişlərin (həm müştəri satışlarında, həm də tədarükçülərdən mal alışlarında) hansı bank hesabı (məs. Kapital Bank, PASHA Bank, ABB və s.) üzərindən icra olunduğunu dəqiq izləyə bilərsiniz.
          </p>
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-black text-blue-700 uppercase block tracking-wider">Məqsəd</span>
            <span className="text-xs text-blue-950 font-semibold block">
              Ay sonunda hansı bank hesabınıza nə qədər vəsait daxil olduğunu və banklararası köçürmələri asanlıqla izləyə bilərsiniz.
            </span>
          </div>
          <h4 className="font-extrabold text-gray-900 text-xs mt-3 uppercase tracking-wider">İstifadə Addımları:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>Banklarınızı Aktiv Edin:</b> <a href="/ayarlar" className="text-primary hover:underline font-bold">Ayarlar</a> səhifəsində <b>"Bank Ayarları 🏦"</b> tabına keçin. İstifadə etdiyiniz Azərbaycan banklarının yanındakı checkbox-ları işarələyin. Siyahıda olmayan bankınız varsa, <i>"Yeni bank əlavə et"</i> sahəsindən yazıb əlavə edərək ayarları saxlayın.
            </li>
            <li>
              <b>POS Satışında Bank Seçin:</b> Kassa (POS) ekranında ödəniş üsulunu <b>"Kart"</b> seçdiyiniz an, dinamik olaraq <b>"Bank Hesabı *"</b> dropdown-u açılacaq. Buradan ödənişin keçdiyi bankı seçin.
            </li>
            <li>
              <b>Mədaxil Zamanı Bank Seçin:</b> Anbara mal qəbul edərkən (Stock In) ödənişi Kartla etmisinizsə, eyni şəkildə müvafiq bank hesabını seçərək mədaxili təsdiqləyin.
            </li>
            <li>
              <b>Hesabatlar və Çeklər:</b> Seçilmiş bank adı rəsmi satış qaimələrində (A4 Invoice), satış tarixçəsi sətirlərində və müştəriyə verilən termal çeklərdə (məs. <i>Ödəniş: Kart (Kapital Bank)</i>) avtomatik çap olunur.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "filtered-stock-value",
      title: "📊 Anbarda Axtarılan Malların Dinamik Dəyər Hesabı",
      category: "anbar",
      icon: Sliders,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Böyük anbar qalıqlarında axtarış apardığınız zaman, sistem sizə yalnız ekranınızda filtrlənmiş/tapılmış məhsulların cəmi maya dəyərini real vaxtda hesablayaraq göstərir.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Necə İşləyir?</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <a href="/anbar" className="text-primary hover:underline font-bold">Anbar Qalıqları</a> səhifəsinə daxil olun.
            </li>
            <li>
              Axtarış xanasına hər hansı brend, kateqoriya və ya məhsul adı yazın (məsələn: <i>"Lenovo"</i> və ya <i>"Qazan"</i>).
            </li>
            <li>
              Ekranın sağ aşağı hissəsində standart "Cəmi Anbar Dəyəri" kartının yanında dinamik olaraq yeni mavi rəngli **"Axtarış üzrə Dəyər"** kartı açılacaqdır.
            </li>
            <li>
              Bu kartda yalnız daxil etdiyiniz sözə uyğun tapılmış (məs. filtrlənmiş 5 məhsulun) cəmi miqdarı və FIFO üzrə cəmi alış dəyəri (AZN) anında əks olunacaq. Xananı təmizlədiyinizdə isə bu kart avtomatik olaraq gizlənəcəkdir.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "initial-imei-entry",
      title: "🏷️ Yeni Məhsul Yaradılarkən İlkin Serial Nömrəsinin (IMEI) Daxil Edilməsi",
      category: "anbar",
      icon: Tag,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Kataloqa yeni noutbuk, telefon və ya digər serial nömrəli cihaz əlavə edərkən, anbara mal mədaxil etmək üçün əlavə səhifələrə keçmədən, elə yaradılış anında cihazın ilk serial nömrəsini (IMEI) skan edərək daxil edə bilərsiniz.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Addım-Addım Təlimat:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <a href="/mehsullar" className="text-primary hover:underline font-bold">Məhsul Kataloqu</a> səhifəsində <b>"Yeni Məhsul"</b> düyməsinə klikləyin.
            </li>
            <li>
              <b>"İzləmə Növü"</b> olaraq <b>"Serial Nömrə (IMEI ilə izlənilən)"</b> rejimini seçin.
            </li>
            <li>
              Bu zaman açılan **"Serial Nömrə / IMEI (İlkin)"** xanasına noutbukun arxasındakı zəmanət/serial nömrəsini (məs. <i>LEGION-SN-994</i>) yazın və ya barkod skaneri vasitəsilə birbaşa skan edin.
            </li>
            <li>
              <b>Avtomatik Uçot:</b> Məhsulu yadda saxladığınız an, sistem arxa planda avtomatik olaraq bu serial nömrəsi ilə anbara <b>1 ədəd</b> mədaxil (Stock Entry) edir. Məhsul dərhal stokda görünür və heç bir əlavə əməliyyat olmadan POS ekranda satılmağa hazır vəziyyətə gəlir.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "automated-warranty",
      title: "🛡️ Zəmanət (Qarantiya) Müddətinin Avtomatik Hesablanması və Çapı",
      category: "tehlukesizlik",
      icon: ShieldCheck,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Satılan cihazların zəmanət (qarantiya) müddətlərini proqram daxilində avtomatik izləyə və müştəriyə təqdim olunan qaimə və ya çeki rəsmi zəmanət talonu kimi təqdim edə bilərsiniz.
          </p>
          <h4 className="font-extrabold text-gray-900 text-xs mt-2 uppercase tracking-wider">Zəmanətin Qurulması və Çap Edilməsi:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>Məhsula Zəmanət Təyin Edin:</b> Məhsul Kataloqunda (Yeni Məhsul və ya Düzəliş modalında) **"Zəmanət Müddəti (Ay)"** sahəsinə ay sayını yazın (məs. 12 və ya 24) və yadda saxlayın. Siyahıda məhsulun yanında mavi rəngdə zəmanət nişanı görünəcək.
            </li>
            <li>
              <b>Kassada Satış:</b> Kassa (POS) ekranında həmin məhsulu müştəriyə satın.
            </li>
            <li>
              <b>Avtomatik Bitmə Tarixi Hesabı:</b> Satış tamamlandıqdan sonra Qaimə (Invoice) səhifəsinə daxil olduqda, sistem satış tarixinin üzərinə zəmanət ayını gələrək avtomatik olaraq <b>"Zəmanət Bitmə Tarixini"</b> hesablayır və göstərir (məsələn: <i>Zəmanət: 12 ay (Bitmə tarixi: 09.06.2027)</i>).
            </li>
            <li>
              <b>Zəmanət Talonlu Çek:</b> Termal çek printerindən çıxan qəbzin üzərində də müvafiq kompüter modelinin arxasındakı serial nömrəsinin (S/N) altında avtomatik olaraq zəmanət müddəti və bitmə tarixi çap olunur.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "apply-edv-toggle",
      title: "🏷️ Dinamik 18% ƏDV Tətbiq Edilməsi (Toggle)",
      category: "maliyye",
      icon: DollarSign,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Məhsul mədaxili və satışı zamanı vergi öhdəliklərinizə uyğun olaraq 18% ƏDV (Əlavə Dəyər Vergisi) tətbiq edilib-edilməməsini hər tranzaksiya üçün fərdi şəkildə seçə bilərsiniz.
          </p>
          <div className="bg-green-50/50 border border-green-100 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-black text-green-700 uppercase block tracking-wider">Mühüm Qeyd</span>
            <span className="text-xs text-green-950 font-semibold block">
              Bu seçim yalnız mağazanızın vergi statusu <b>\"ƏDV Ödəyicisi\"</b> olaraq konfiqurasiya edildikdə POS terminalında və mal mədaxili pəncərəsində görünəcəkdir.
            </span>
          </div>
          <h4 className="font-extrabold text-gray-900 text-xs mt-3 uppercase tracking-wider">İstifadə Qaydası:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>POS Terminalda Satış:</b> Səbətə malları əlavə etdikdən sonra ödəniş bölməsində <b>\"18% ƏDV Tətbiq Edilsin\"</b> keçiricisini (toggle) görəcəksiniz. Satışa ƏDV tətbiq etmək istəyirsinizsə, bu xananı işarəli saxlayın. Satış ƏDV-siz olacaqsa (Vergidən azad tranzaksiya), xananı söndürün.
            </li>
            <li>
              <b>Mal Mədaxilində (Stock In):</b> Yeni mal daxil edərkən və ya daxil edilmiş mədaxili redaktə edərkən eyni keçiricini aktiv/deaktiv edərək mal alışını ƏDV-li və ya ƏDV-siz qeydə ala bilərsiniz.
            </li>
            <li>
              <b>İnvoys və Qəbzdə Əks Olunması:</b> Əgər ƏDV tətbiqi söndürülübsə, çap olunan qəbzdə və rəsmi A4 qaiməsində ƏDV sətiri görünməyəcək və sənəd rəsmi olaraq <b>\"ƏDV-siz (Vergidən Azad)\"</b> statusu ilə çıxacakdır.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "serial-stock-ui",
      title: "🏷️ Anbarda Seriallı (SN) Məhsulların Fərqləndirilməsi və IMEI Siyahısı (Popup)",
      category: "anbar",
      icon: Tag,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Anbar qalıqları səhifəsində unikal serial nömrəsi (IMEI) ilə izlənilən məhsullar xüsusi vizual dizayn ilə digər məhsullardan dərhal fərqləndirilir.
          </p>
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-black text-blue-700 uppercase block tracking-wider">Vizual Fərqlər</span>
            <span className="text-xs text-blue-950 font-semibold block">
              Serial nömrəli məhsullar sətirdə sol tərəfdən mavi rəngli qalın xətt (border), açıq mavi fon və xüsusi <b>\"🏷️ Seriallı (IMEI)\"</b> nişanı ilə seçilir.
            </span>
          </div>
          <h4 className="font-extrabold text-gray-900 text-xs mt-3 uppercase tracking-wider">İstifadəsi və Serial Nömrələri Popup-ı:</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <a href="/anbar" className="text-primary hover:underline font-bold font-sans">Anbar Qalıqları</a> səhifəsinə daxil olun.
            </li>
            <li>
              Siyahıda mavi haşiyəli hər hansı serial nömrəli məhsulun adına və ya məhsulun altında çıxan <b>\"🔍 [Sayı] IMEI / Serial Göstər\"</b> düyməsinə klikləyin.
            </li>
            <li>
              Ekranda frosted-glass (şüşə) effektli premium **Popup (modal)** pəncərəsi açılacaqdır.
            </li>
            <li>
              Bu pəncərədə həmin məhsulun anbarda olan bütün aktiv serial nömrələri (IMEI) ardıcıl şəkildə siyahılanacaq və hər birinin yanında <b>\"Stokda\"</b> vergi/anbar status nişanı göstəriləcəkdir.
            </li>
          </ol>
        </div>
      )
    },
    {
      id: "product-keywords",
      title: "🔑 Məhsul Kataloqunda Açar Sözlər (Keywords) və Oxşar Məhsul Məhdudiyyəti",
      category: "anbar",
      icon: HelpCircle,
      content: (
        <div className="space-y-3 leading-relaxed text-gray-700">
          <p>
            Mağaza əməkdaşlarının eyni məhsulu müxtəlif adlarla (və ya hərf xətaları ilə) təkrar-təkrar qeydiyyatdan keçirib anbar hesabatlarını korlamasının qarşısını almaq üçün sistemdə <b>ağıllı açar sözlər (keyword mapping)</b> tətbiq olunmuşdur.
          </p>
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3.5 space-y-1">
            <span className="text-[10px] font-black text-primary uppercase block tracking-wider">İşləmə Mexanizmi</span>
            <span className="text-xs text-primary/90 font-semibold block">
              Məhsul Kataloqunda yeni məhsul yaradarkən və ya redaktə edərkən <b>\"Təsvir (Qeyd)\"</b> sahəsinə vergüllə ayrılmış alternativ adları (açar sözləri) yazın (məselen: <code>ayfon 11, ip11, iphone 11</code>). Sistem avtomatik olaraq bu adları yadda saxlayır və qoruyur.
            </span>
          </div>
          <h4 className="font-extrabold text-gray-900 text-xs mt-3 uppercase tracking-wider">Bu Modul Hansı İmkanları Təqdim Edir?</h4>
          <ol className="list-decimal pl-4 space-y-2 text-xs font-semibold">
            <li>
              <b>Axtarış Zamanı Tapılma:</b> Kassir POS satışında və ya anbara yeni mədaxil edərkən axtarış sahəsinə həmin açar sözlərdən birini (məs. <code>ip11</code>) yazarsa, sistem əsas məhsulu (məs. <code>iPhone 11</code>) dərhal tapıb siyahıda göstərir. Bu, təkrar məhsul yaradılmasının qarşısını alır.
            </li>
            <li>
              <b>Təkrarlanmanın Tam Bloklanması:</b> Hər hansı işçi kataloqa daxil olub adını <code>Ayfon 11</code> və ya <code>ip11</code> yazaraq yeni bir məhsul kartı açmağa çalışsa, sistem dərhal xəbərdarlıq edib əməliyyatı bloklayır: <i>\"Bu məhsul artıq mövcuddur (Açar sözlər ilə eşləşdi: 'iPhone 11').\"</i>
            </li>
            <li>
              <b>Açar Söz Toqquşmasının Qarşısının Alınması:</b> Yeni yaradılan məhsulun açar sözlərindən biri mövcud olan digər məhsulun adı və ya açar sözü ilə eyni ola bilməz.
            </li>
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
