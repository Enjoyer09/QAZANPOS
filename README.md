<div align="center">

# QAZANPOS 🚀
### Modern, Multi-tenant Cloud POS & Retail ERP Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![TailwindCSS v4](https://img.shields.io/badge/TailwindCSS-v4.0-38bdf8.svg)](https://tailwindcss.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F.svg)](https://orm.drizzle.team/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

An enterprise-ready, open-source Point of Sale (POS), Inventory, and Kitchen Management platform featuring silent thermal receipt printing (QZ Tray), automated fiscal compliance, and real-time ledger accounting.

[English Documentation](#english-overview) · [Azərbaycan Dilində Təsvir](#az%C9%99rbaycan-dilind%C9%99) · [Contributing](./CONTRIBUTING.md)

</div>

---

## English Overview

**QAZANPOS** is designed for modern retail, hospitality, and dining establishments requiring rapid checkout ergonomics, hardware printer integration, and robust inventory control.

### Key Highlights
- **High-Velocity POS Terminal**: Built with React 19 and Tailwind CSS v4, optimized for touchscreens and barcode scanners.
- **Silent Hardware Printing**: Seamless thermal slip and kitchen order printing over WebSocket via QZ Tray integration.
- **Relational Integrity & Multi-Tenancy**: Engineered on PostgreSQL with schema migrations managed by Drizzle ORM.
- **Fiscal & Tax Engine**: Dynamic tax categorization, VAT calculation, and fiscal registry integration.
- **Full-Stack Type Safety**: End-to-end typing spanning the REST API contracts, business services, and frontend state.

---

<a name="azərbaycan-dilində"></a>
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
