# 📦 QazanPOS — STOK İDARƏÇİLİĞİ TƏLİMATI

**Hazırlanma tarixi:** 07.07.2026  
**Kimlər üçün:** Kassirlər, Anbar işçiləri, Satıcı heyət

---

## ⚠️ ƏSAS PRİNSİP (Bunu hər kəs bilməlidir)

**Sistem iş prinsipi:** Hər bir məhsulun stoku avtomatik hesablanır:

```
STOK = GƏLƏN MAL - SATILAN MAL + QAYIDAN MAL
```

Yəni **əgər malı əvvəlcə anbara daxil etməsəniz**, sistem həmin malı "bilmir" və satış zamanı stok **mənfiyə** düşə bilər.

---

## 1️⃣ ADDIM: MAL GƏLDİ → "ANBARA MƏDAXİL" ET

**Nə vaxt:** Tədarükçüdən mal gələndə

**Kim edir:** Anbar işçisi və ya Admin

**Necə:**
1. Sol menyudan **"Anbar"** → **"Anbara Mədaxil"** düyməsinə klikləyin
2. Məhsul seçin (əgər məhsul yoxdursa, əvvəlcə kataloqda yaradın)
3. Miqdarı daxil edin (neçə ədəd gəlib)
4. Alış qiymətini qeyd edin (bir ədədin neçəyə alınıb)
5. Tədarükçünü seçin (əgər varsa)
6. Ödəniş üsulunu seçin: **Nəğd** / **Kart** / **Nisyə**
7. **"Mədaxil Et"** düyməsinə klikləyin

✅ **Nəticə:** Mal anbara əlavə olundu. Stok artdı.

> **💡 Məsləhət:** Mədaxil etmədən satış etməyə çalışsanız, sistem **xəta verəcək** və satışı bloklayacaq. Bu, sizi səhvən stoksuz satışdan qorumaq üçündür.

---

## 2️⃣ ADDIM: MÜŞTƏRİ ALIR → POS-DA SATIŞ ET

**Nə vaxt:** Müştəri məhsulu alanda

**Kim edir:** Kassir / Satıcı

**Necə:**
1. Sol menyudan **"POS Terminal"** səhifəsinə keçin
2. Məhsulu axtarın (ad, barkod və ya IMEI ilə)
3. Məhsulu səbətə əlavə edin
4. Miqdarı düzəldin (lazım olarsa)
5. Müştəri məlumatını daxil edin (istəyə bağlı)
6. Ödəniş üsulunu seçin: **Nəğd** / **Kart** / **Nisyə**
7. **"Satışı Tamamla"** düyməsinə klikləyin

✅ **Nəticə:** Satış qeydə alındı. Stok avtomatik **azaldı**.

> **⚠️ Vacib:** Əgər məhsul anbara daxil edilməyibsə, satış zamanı aşağıdakı xəta çıxacaq:
> ```
> ❌ "Məhsulun adı" üçün anbarda kifayət qədər mal yoxdur! (Tələb: X, Mövcud: 0)
> ```
> **Həlli:** Satışı dayandırın, əvvəlcə "Anbara Mədaxil" edin, sonra satışa davam edin.

---

## 3️⃣ ADDIM: MAL QAYIDIR → "QAYTARIŞ" ET

**Nə vaxt:** Müştəri məhsulu geri qaytaranda

**Kim edir:** Kassir / Admin

**Necə:**
1. **"Satışlar"** səhifəsindən müvafiq qaiməni tapın
2. Qaimənin üzərindəki **"Qaytarış"** düyməsinə klikləyin
3. Qaytarılan məhsulu və miqdarı seçin
4. Səbəbi qeyd edin
5. Statusu seçin: **"Anbara Qayıdan"** (təzədən satıla bilər) və ya **"Deffekt (Zay)"** (satıla bilməz)
6. **"Qaytarışı Tamamla"** düyməsinə klikləyin

✅ **Nəticə:** Stok **artdı** (əgər "Anbara Qayıdan" seçilibsə).

---

## 4️⃣ ADDIM: AYDA 1 DƏFƏ "SAYIM" ET

**Nə vaxt:** Ayda ən azı 1 dəfə (və ya rəhbərlik istədikdə)

**Kim edir:** Admin (və ya Admin nəzarətində işçi)

**Necə:**
1. Sol menyudan **"Anbar"** səhifəsinə keçin
2. **"Sayım Et"** tab-ına klikləyin
3. Sayım aparılacaq **Anbarı seçin**
4. Hər məhsulun yanında **saydığınız miqdarı** daxil edin:
   - ✅ **"Uyğun"** — sistemdəki ilə eynidir
   - ➕ **"Artıq"** — sistemdəkindən çoxdur (səhvən əksik yazılıb)
   - ➖ **"Əskik"** — sistemdəkindən azdır (itib, oğurlanıb və ya səhv satılıb)
5. Hər fərq üçün **qeyd / səbəb** yazın
6. **"Sayımı Tamamla"** düyməsinə klikləyin

✅ **Nəticə:** Stok rəqəmləri real vəziyyətə uyğunlaşdırıldı.

---

## 5️⃣ ADDIM: ANBAR Transferi (YERDƏYİŞMƏ)

**Nə vaxt:** Malı bir anbardan digər anbara köçürəndə

**Kim edir:** Admin

**Necə:**
1. **"Anbar"** səhifəsində **"Yerdəyişmə Et"** düyməsinə klikləyin
2. Məhsulu seçin
3. Göndərən anbarı seçin
4. Qəbul edən anbarı seçin
5. Miqdarı daxil edin
6. **"Yerdəyişməni Tamamla"** düyməsinə klikləyin

✅ **Nəticə:** Bir anbardan çıxdı, digərinə əlavə olundu.

---

## 📋 STOK EKRANINDA GÖSTERGƏLƏR

Stok səhifəsində hər məhsulun yanında rəngli status var:

| Rəng | Status | Mənası |
|------|--------|--------|
| 🟢 **Normal** | Yaşıl | Qalıq ≥ 5 ədəd |
| 🟡 **Az qalıb** | Sarı | Qalıq < 5 ədəd |
| 🔴 **Bitib** | Qırmızı | Qalıq = 0 və ya mənfi (mədaxil lazımdır) |

**POS Terminal-da da eyni göstəricilər var:**
- Məhsul axtararkən "Bitib" və "Az qalıb" badge-ləri görünür
- "⚠️ Mədaxil edilməyib" yazısı çıxır

---

## ❌ TEZ-TEZ OLUNAN SƏHVLƏR

### Səhv 1: Mədaxilsiz satış
```
Xəta: "Məhsul üçün anbarda kifayət qədər mal yoxdur!"
```
**Səbəb:** Mal gələndə "Anbara Mədaxil" edilməyib.  
**Həll:** Satışı dayandırın → Anbara Mədaxil edin → Sonra satışı tamamlayın.

### Səhv 2: Stok səhifəsində mənfi rəqəm
```
Qalıq: -5 ədəd
```
**Səbəb:** Mədaxil edilmədən bir neçə dəfə satılıb.  
**Həll:** Məhsulu anbara daxil edin. Bundan sonra sistem avtomatik düzələcək.

### Səhv 3: Satışdan sonra stok dəyişmədi
**Səbəb:** Mədaxil olmamış məhsul satılıb.  
**Həll:** Bu, əvvəlki səhvlərdən qalan keçmiş data ola bilər. Yeni gələn malları mütləq mədaxil edin.

---

## ✅ DÜZGÜN İŞ AXIŞI (XÜLASƏ)

```
MAL GƏLDİ → "Anbara Mədaxil" et → Stok artdı ✅
MÜŞTƏRİ ALDI → POS-da sat → Stok azaldı ✅
MÜŞTƏRİ QAYTARDI → "Qaytarış" et → Stok artdı (seçilərsə) ✅
AYDA 1 DƏFƏ → "Sayım" et → Stok dəqiqləşdi ✅
ANBARARASI → "Yerdəyişmə" et → Stok dəyişdi ✅
```

---

## 🆘 YARDIM

Hər hansı problem yaşasanız:
- **Admin-ə müraciət edin**
- Və ya sistemdəki **"Kömək"** səhifəsinə baxın

---

*© QazanPOS — Avtomatik stok idarəçiliyi sistemi*
