# QAZANPOS - Modern Bulud POS, Anbar & Satış İdarəetmə Sistemi 🚀

QAZANPOS, Azərbaycan biznesləri üçün xüsusi olaraq hazırlanmış, çox-tenantlı (multi-tenant), ultra-sürətli, səssiz termal çap dəstəkli və dövlət vergi standartlarına tam uyğun POS, Anbar və HR/Əməkhaqqı idarəetmə sistemidir.

---

## 🏗️ Texnologiya Steki

* **Frontend**: React, TypeScript, TailwindCSS, TanStack Query, Wouter.
* **Backend**: Node.js, Express, tsx.
* **Verilənlər Bazası**: PostgreSQL (Drizzle ORM ilə idarə olunur).
* **Silent Printing**: QZ Tray WebSocket API vasitəsilə local termal printerlərə birbaşa səssiz çap.

---

## ✨ Xüsusi İnteqrasiyalar & Üstünlüklər

### 1. 🇦🇿 Azərbaycan Vergi Sistemi İnteqrasiyası (DVX Compliance)
Hər bir tenant (biznes) öz **Ayarlar (Settings) -> Vergi Ayarları** panelindən öz vergi profilini sərbəst şəkildə idarə edə bilər:
* **VÖEN Qeydiyyatı**: 9-10 rəqəmli rəsmi taxpayer ID.
* **Vergi Rejimləri**:
  * *Sadələşdirilmiş Vergi* (Fərdiləşdirilə bilən faiz ilə, məs: `2%`)
  * *ƏDV Ödəyicisi* (Fərdiləşdirilə bilən faiz ilə, məs: `18%`)
  * *Gəlir/Mənfəət vergisi*
  * *Vergidən Azad*
* **Çap Standartları**:
  * POS termal çeklərində və rəsmi satış qaimələrində (Invoices) dinamik olaraq VÖEN, vergi kateqoriyası və ƏDV daxil/sadələşdirilmiş vergi məbləğlərinin avtomatik hesablanaraq göstərilməsi.

### 2. 🏢 Ödənişlərdə "Köçürmə" (Bank Transfer) Dəstəyi
Bütün ödəniş axınları (POS Checkout, Mədaxil [StockIn], Təchizatçı Ledgerləri [Debts/Vendors] və Əməkdaş Payroll-u) rəsmi bank hesabı transferlərini tam dəstəkləyir.

### 3. 👥 HR & Əməkdaş Avans ("Avans") Qeydiyyatı & Tarixçəsi
* **İnteraktiv Ödəniş Tarixçələri**: Maaş Hesabatı və ya Əməkdaşlar siyahısında hər hansı bir işçinin adına tıkladıqda dərhal o əməkdaşın cari aydakı bütün maaş və avans ödənişlərini, tarixlərini göstərən detallı popup çıxır.
* **Sürətli Avans Düymələri**: Maaş ödəniş modalında tək kliklə `Avans (Məxaric)` və ya `Maaş (Yekun)` qeydi daxil etmək mümkündür.

### 4. 🔮 Premium "Liquid Glass" Dizayn Sistemi
Sistemdəki bütün popup pəncərələr frosted şüşə (glassmorphic) və slate-900 arxa fon buluru (`backdrop-blur-md saturate-140%`) ilə premium səviyyədə dizayn edilib.

---

## 💻 Local Quraşdırma & İşə Salma

### 1. Dependencies yükləyin
```bash
npm install
```

### 2. Local Environment (.env) quraşdırın
`server/.env` faylını yaradın və PostgreSQL verilənlər bazası URL-ni qeyd edin:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/qazanpos
```

### 3. Database Push (Drizzle ORM)
Database cədvəllərini sinxronlaşdırın:
```bash
npm run db:push --workspace=server
```

### 4. Developer rejimində işə salın
Həm klient, həm də serveri eyni anda başladın:
```bash
npm run dev
```

### 5. Production build yoxlanışı
Dəyişiklikləri compile edin:
```bash
npm run build
```
