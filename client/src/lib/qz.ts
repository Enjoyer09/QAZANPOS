// @ts-ignore
import qz from "qz-tray";

export class QzTrayService {
  private initialized = false;

  constructor() {}

  private initSecurity() {
    if (this.initialized) return;

    // 1. Set the signature algorithm to SHA512 to match our server
    qz.security.setSignatureAlgorithm("SHA512");

    // 2. Set the digital certificate loader promise
    qz.security.setCertificatePromise((resolve: (value: string) => void, reject: (reason: any) => void) => {
      fetch("/api/auth/qz-certificate")
        .then((res) => {
          if (!res.ok) throw new Error("Sertifikat yüklənmədi");
          return res.text();
        })
        .then(resolve)
        .catch((err) => {
          console.error("QZ Cert error:", err);
          reject(err);
        });
    });

    // 3. Set the signature loader promise (SHA-512)
    qz.security.setSignaturePromise((toSign: string) => {
      return (resolve: (value: string) => void, reject: (reason: any) => void) => {
        fetch("/api/auth/qz-sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ request: toSign }),
        })
          .then((res) => {
            if (!res.ok) throw new Error("İmza alınmadı");
            return res.text();
          })
          .then(resolve)
          .catch((err) => {
            console.error("QZ Sign error:", err);
            reject(err);
          });
      };
    });

    this.initialized = true;
  }

  public async connect(): Promise<boolean> {
    try {
      this.initSecurity();

      if (qz.websocket.isActive()) {
        return true;
      }

      await qz.websocket.connect();
      console.log("QZ Tray: Connected successfully via qz-tray SDK");
      return true;
    } catch (e) {
      console.warn("QZ Tray: Connection failed or offline", e);
      return false;
    }
  }

  public isConnected(): boolean {
    return qz.websocket.isActive();
  }

  public async getPrinters(): Promise<string[]> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }
      return await qz.printers.find();
    } catch (e) {
      console.error("QZ Tray: Failed to get printers", e);
      return [];
    }
  }

  public async printHTML(printerName: string, htmlContent: string, options: any = {}): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      const widthVal = options.width || "80mm";
      const config = qz.configs.create(printerName, {
        units: "mm",
        size: { width: parseFloat(widthVal) || 80, height: 300 },
        margins: 0,
        scaleContent: false
      });

      const data = [{
        type: 'html',
        format: 'plain',
        data: htmlContent
      }];

      return await qz.print(config, data);
    } catch (e) {
      console.error("QZ Tray: HTML print failed", e);
      throw e;
    }
  }
}

export const qzService = new QzTrayService();
