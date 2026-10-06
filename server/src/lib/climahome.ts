import { db } from "../db/index.js";
import * as schema from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export interface ClimahomeConfig {
  enabled: boolean;
  baseUrl: string;
  token: string | null;
  lastSync: string | null;
  autoSync: boolean;
}

export interface ClimahomeApiResponse<T = any> {
  success: boolean;
  data?: T;
  meta?: {
    page: number;
    perPage: number;
    total: number;
    lastPage: number;
    hasMore: boolean;
  };
  code?: string;
  message?: string;
  errors?: Record<string, any>;
}

export class ClimahomeService {
  /**
   * Tenant üçün Climahome konfiqurasiyasını gətirir
   */
  static async getConfig(tenantId: number): Promise<ClimahomeConfig> {
    const tenantSettings = await db.query.settings.findFirst({
      where: eq(schema.settings.tenantId, tenantId),
    });

    return {
      enabled: tenantSettings?.climahomeEnabled === 1,
      baseUrl: tenantSettings?.climahomeBaseUrl || "https://api.climahome.az/api",
      token: tenantSettings?.climahomeToken || null,
      lastSync: tenantSettings?.climahomeLastSync || null,
      autoSync: tenantSettings?.climahomeAutoSync === 1,
    };
  }

  /**
   * Climahome API-yə təhlükəsiz HTTP sorğu göndərir (Server-to-Server)
   */
  static async request<T = any>(
    config: ClimahomeConfig,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; meta?: any }> {
    if (!config.token) {
      throw new Error("Climahome POS Token təyin edilməyib. Zəhmət olmasa Ayarlar bölməsində tokeni qeyd edin.");
    }

    const cleanBase = config.baseUrl.replace(/\/+$/, "");
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${cleanBase}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Authorization": `Bearer ${config.token}`,
      "X-Pos-Token": config.token,
      ...(options.headers as Record<string, string> || {}),
    };

    let res = await fetch(url, {
      ...options,
      headers,
    });

    // Rate Limit 429 idarəetməsi
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : 2;
      console.warn(`Climahome API Rate Limit çatdı. ${waitSeconds} saniyə gözlənilir...`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      res = await fetch(url, { ...options, headers });
    }

    const json: ClimahomeApiResponse<T> = await res.json().catch(() => ({
      success: false,
      code: "PARSE_ERROR",
      message: "Climahome serverindən düzgün JSON cavabı alınmadı",
    }));

    if (!res.ok || json.success === false) {
      const errCode = json.code || `HTTP_${res.status}`;
      const errMsg = json.message || "Climahome API sorğusu uğursuz oldu";
      throw new Error(`[Climahome ${errCode}]: ${errMsg}`);
    }

    return { data: json.data as T, meta: json.meta };
  }

  /**
   * Əlaqəni test edir (Connection health check)
   */
  static async testConnection(tenantId: number): Promise<{ success: boolean; message: string; totalProducts?: number }> {
    const config = await this.getConfig(tenantId);
    if (!config.token) {
      return { success: false, message: "Token daxil edilməyib." };
    }

    try {
      const { meta } = await this.request(config, "/pos/products?per_page=1&page=1");
      return {
        success: true,
        message: `Əlaqə uğurla quruldu! Climahome bazasında ümumi ${meta?.total ?? 0} məhsul mövcuddur.`,
        totalProducts: meta?.total,
      };
    } catch (err: any) {
      return { success: false, message: err.message || "Əlaqə xətası baş verdi." };
    }
  }

  /**
   * Climahome-dan məhsulları QAZANPOS bazasına sinxronizasiya edir (Full və ya Delta)
   */
  static async syncProducts(
    tenantId: number,
    options: { full?: boolean } = {}
  ): Promise<{
    success: boolean;
    createdCount: number;
    updatedCount: number;
    totalProcessed: number;
    lastSync: string;
  }> {
    const config = await this.getConfig(tenantId);
    if (!config.token) {
      throw new Error("Climahome POS Token təyin edilməyib.");
    }

    let page = 1;
    const perPage = 50; // Təhlükəsiz batch ölçüsü
    let hasMore = true;
    let createdCount = 0;
    let updatedCount = 0;
    let totalProcessed = 0;

    const queryParams = new URLSearchParams();
    queryParams.set("per_page", perPage.toString());
    queryParams.set("status", "active");

    // Əgər tam deyil və əvvəlki sinxronizasiya varsa, delta sync işlədirik
    if (!options.full && config.lastSync) {
      const datePart = config.lastSync.split("T")[0];
      queryParams.set("updated_since", datePart);
      queryParams.set("sort", "updated");
    } else {
      queryParams.set("sort", "newest");
    }

    // Default anbar təyini
    let defaultWarehouseId: number | null = null;
    const defaultWarehouse = await db.query.warehouses.findFirst({
      where: and(eq(schema.warehouses.tenantId, tenantId), eq(schema.warehouses.isDefault, 1)),
    });
    if (defaultWarehouse) {
      defaultWarehouseId = defaultWarehouse.id;
    }

    while (hasMore) {
      queryParams.set("page", page.toString());
      const endpoint = `/pos/products?${queryParams.toString()}`;

      const { data: rawProducts, meta } = await this.request<any[]>(config, endpoint);
      const productList = Array.isArray(rawProducts) ? rawProducts : [];

      if (productList.length === 0) {
        break;
      }

      for (const item of productList) {
        totalProcessed++;

        // Variantlı məhsul və ya tək məhsul
        const itemsToProcess: Array<{
          name: string;
          barcode: string;
          externalId: string;
          category: string | null;
          price: number;
          costPrice: number;
          stockCount: number;
          imageUrl: string | null;
          description: string | null;
        }> = [];

        if (item.hasVariants && Array.isArray(item.variants) && item.variants.length > 0) {
          for (const v of item.variants) {
            const vPrice = v.priceQepik ? v.priceQepik / 100 : (Number(v.price) || 0);
            const vCost = v.costPriceQepik ? v.costPriceQepik / 100 : (Number(v.costPrice) || 0);
            itemsToProcess.push({
              name: `${item.name} (${v.label || v.sku || "Variant"})`,
              barcode: v.sku || v.barcode || `${item.product_code || item.id}-${v.id}`,
              externalId: `variant_${v.id}`,
              category: item.category?.name || item.category || null,
              price: vPrice,
              costPrice: vCost,
              stockCount: Number(v.stockCount) || 0,
              imageUrl: v.image || item.image || (item.images && item.images[0]) || null,
              description: item.description || null,
            });
          }
        } else {
          const itemPrice = item.priceQepik ? item.priceQepik / 100 : (Number(item.price) || 0);
          const itemCost = item.costPriceQepik ? item.costPriceQepik / 100 : (Number(item.costPrice) || 0);
          itemsToProcess.push({
            name: item.name,
            barcode: item.product_code || item.barcode || `CLIMA-${item.id}`,
            externalId: `prod_${item.id}`,
            category: item.category?.name || item.category || null,
            price: itemPrice,
            costPrice: itemCost,
            stockCount: Number(item.stockCount) || 0,
            imageUrl: item.image || (item.images && item.images[0]) || null,
            description: item.description || null,
          });
        }

        for (const prodData of itemsToProcess) {
          // Mövcud məhsulu externalId və ya barcode ilə axtarırıq
          let existingProduct = await db.query.products.findFirst({
            where: and(
              eq(schema.products.tenantId, tenantId),
              sql`(${schema.products.externalId} = ${prodData.externalId} OR (${schema.products.barcode} = ${prodData.barcode} AND ${prodData.barcode} != ''))`
            ),
          });

          let currentProductId: number;

          if (existingProduct) {
            currentProductId = existingProduct.id;
            // Məhsul məlumatlarını yeniləyirik
            await db.update(schema.products)
              .set({
                name: prodData.name,
                category: prodData.category || existingProduct.category,
                imageUrl: prodData.imageUrl || existingProduct.imageUrl,
                externalSource: "climahome",
                externalId: prodData.externalId,
              })
              .where(eq(schema.products.id, existingProduct.id));

            updatedCount++;
          } else {
            // Yeni məhsul daxil edirik
            const [newProd] = await db.insert(schema.products).values({
              tenantId,
              name: prodData.name,
              category: prodData.category,
              unit: "ədəd",
              barcode: prodData.barcode,
              description: prodData.description,
              imageUrl: prodData.imageUrl,
              externalSource: "climahome",
              externalId: prodData.externalId,
            }).returning();

            currentProductId = newProd.id;
            createdCount++;
          }

          // Qalıq və qiymət yenilənməsi: stockEntries yoxlanışı
          // Əgər məhsulun anbar girişi yoxdursa və ya qalıq fərqlidirsə, mədaxil əlavə edirik
          const existingEntries = await db.query.stockEntries.findMany({
            where: and(
              eq(schema.stockEntries.tenantId, tenantId),
              eq(schema.stockEntries.productId, currentProductId)
            ),
          });

          if (existingEntries.length === 0 && prodData.stockCount > 0) {
            await db.insert(schema.stockEntries).values({
              tenantId,
              productId: currentProductId,
              quantity: prodData.stockCount,
              purchasePrice: prodData.costPrice || prodData.price * 0.8,
              supplier: "Climahome Kataloqu",
              notes: "Climahome ilkin sinxronizasiyası ilə daxil edildi",
              paymentType: "Nəğd",
              paidStatus: "paid",
              entryDate: new Date().toISOString(),
              warehouseId: defaultWarehouseId,
            });
          }
        }
      }

      hasMore = meta?.hasMore === true && page < (meta?.lastPage || 100);
      page++;

      // Rate limit qarşısını almaq üçün kiçik fasilə
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    const nowIso = new Date().toISOString();
    await db.update(schema.settings)
      .set({ climahomeLastSync: nowIso })
      .where(eq(schema.settings.tenantId, tenantId));

    return {
      success: true,
      createdCount,
      updatedCount,
      totalProcessed,
      lastSync: nowIso,
    };
  }

  /**
   * POS Kassada barkod və ya kodla Climahome bazasında canlı axtarış
   */
  static async searchProductByBarcode(tenantId: number, code: string): Promise<any> {
    const config = await this.getConfig(tenantId);
    if (!config.token) {
      throw new Error("Climahome inteqrasiyası aktiv deyil.");
    }

    const trimmedCode = code.trim();
    if (!trimmedCode) return null;

    // 1. Əvvəlcə dəqiq kodla axtarırıq: code=...
    let searchResult: any[] = [];
    try {
      const { data } = await this.request<any[]>(config, `/pos/products?code=${encodeURIComponent(trimmedCode)}&status=active`);
      if (Array.isArray(data) && data.length > 0) {
        searchResult = data;
      }
    } catch (e) {
      console.warn("Climahome code lookup failed, falling back to q:", e);
    }

    // 2. Tapılmasa q=... sərbəst axtarış
    if (searchResult.length === 0) {
      try {
        const { data } = await this.request<any[]>(config, `/pos/products?q=${encodeURIComponent(trimmedCode)}&status=active&per_page=5`);
        if (Array.isArray(data) && data.length > 0) {
          searchResult = data;
        }
      } catch (e) {
        console.warn("Climahome q lookup failed:", e);
      }
    }

    if (searchResult.length === 0) {
      return null;
    }

    const item = searchResult[0];
    const price = item.priceQepik ? item.priceQepik / 100 : (Number(item.price) || 0);
    const costPrice = item.costPriceQepik ? item.costPriceQepik / 100 : (Number(item.costPrice) || 0);
    const barcode = item.product_code || item.barcode || trimmedCode;

    // Məhsulu yerli QAZANPOS bazasına avtomatik daxil edirik və ya tapırıq
    let localProduct = await db.query.products.findFirst({
      where: and(
        eq(schema.products.tenantId, tenantId),
        sql`(${schema.products.externalId} = ${`prod_${item.id}`} OR ${schema.products.barcode} = ${barcode})`
      ),
    });

    if (!localProduct) {
      const [newProd] = await db.insert(schema.products).values({
        tenantId,
        name: item.name,
        category: item.category?.name || item.category || "Climahome",
        unit: "ədəd",
        barcode,
        description: item.description || null,
        imageUrl: item.image || (item.images && item.images[0]) || null,
        externalSource: "climahome",
        externalId: `prod_${item.id}`,
      }).returning();
      localProduct = newProd;

      // Anbara 1 ədəd ilkin mədaxil salırıq ki, kassada dərhal satıla bilsin
      await db.insert(schema.stockEntries).values({
        tenantId,
        productId: newProd.id,
        quantity: Math.max(1, Number(item.stockCount) || 1),
        purchasePrice: costPrice || price * 0.8,
        supplier: "Climahome Kassa Axtarışı",
        notes: "Barkod oxudulduqda avtomatik əlavə edildi",
        paymentType: "Nəğd",
        paidStatus: "paid",
        entryDate: new Date().toISOString(),
      });
    }

    return {
      productId: localProduct.id,
      productName: localProduct.name,
      category: localProduct.category,
      unit: localProduct.unit,
      barcode: localProduct.barcode,
      salePrice: price,
      purchasePrice: costPrice,
      currentQuantity: Math.max(1, Number(item.stockCount) || 1),
      source: "climahome",
      climahomeId: item.id,
      imageUrl: localProduct.imageUrl,
    };
  }

  /**
   * POS Kassada müştəri telefon nömrəsi ilə Climahome Bonus Balansını yoxlayır
   */
  static async lookupCustomerBonus(tenantId: number, phone: string): Promise<any> {
    const config = await this.getConfig(tenantId);
    if (!config.token) {
      throw new Error("Climahome inteqrasiyası aktiv deyil.");
    }

    const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, "");
    if (!cleanPhone) {
      throw new Error("Telefon nömrəsi daxil edilməlidir.");
    }

    try {
      const { data } = await this.request<any>(config, `/pos/bonus/lookup?phone=${encodeURIComponent(cleanPhone)}&limit=10`);
      return {
        success: true,
        found: true,
        customer: data?.customer || null,
        bonus: {
          balance: data?.bonus?.balance ?? (data?.bonus?.balanceQepik ? data.bonus.balanceQepik / 100 : 0),
          balanceQepik: data?.bonus?.balanceQepik ?? Math.round((data?.bonus?.balance || 0) * 100),
          purchasePercent: data?.settings?.purchasePercent ?? 2,
          referralPercent: data?.settings?.referralPercent ?? 1,
        },
        recentTransactions: data?.recentTransactions || [],
      };
    } catch (err: any) {
      if (err.message && err.message.includes("POS_CUSTOMER_NOT_FOUND")) {
        return {
          success: true,
          found: false,
          message: "Climahome bonus sistemində bu nömrə ilə müştəri tapılmadı.",
        };
      }
      throw err;
    }
  }
}
