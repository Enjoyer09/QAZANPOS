// Reusable QZ Tray WebSocket Connector (Zero-dependency implementation)
export class QzTrayService {
  private socket: WebSocket | null = null;
  private connected = false;
  private messageId = 1;
  private pendingRequests = new Map<number, { resolve: Function; reject: Function }>();

  constructor() {}

  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        return resolve(true);
      }

      // Try secure port 8182 first
      const wsUrl = "wss://localhost:8182";
      
      try {
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
          this.connected = true;
          console.log("QZ Tray: Connected successfully on port 8182");
          resolve(true);
        };

        this.socket.onerror = () => {
          // Fallback to non-secure port 8181
          try {
            this.socket = new WebSocket("ws://localhost:8181");
            this.socket.onopen = () => {
              this.connected = true;
              console.log("QZ Tray: Connected successfully on port 8181");
              resolve(true);
            };
            this.socket.onerror = () => {
              this.connected = false;
              console.log("QZ Tray: Service is offline or not installed");
              resolve(false);
            };
            this.socket.onmessage = (msg) => this.handleMessage(msg);
          } catch (e) {
            this.connected = false;
            resolve(false);
          }
        };

        this.socket.onmessage = (msg) => this.handleMessage(msg);
        
        this.socket.onclose = () => {
          this.connected = false;
          console.log("QZ Tray: Connection closed");
        };

      } catch (e) {
        this.connected = false;
        resolve(false);
      }
    });
  }

  private handleMessage(msg: MessageEvent) {
    try {
      const response = JSON.parse(msg.data);
      if (response.id && this.pendingRequests.has(response.id)) {
        const { resolve, reject } = this.pendingRequests.get(response.id)!;
        this.pendingRequests.delete(response.id);
        
        if (response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response.result);
        }
      }
    } catch (e) {
      console.error("QZ Tray parsing error", e);
    }
  }

  private sendRequest(method: string, params: any[]): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return reject(new Error("QZ Tray is not connected"));
      }

      const id = this.messageId++;
      this.pendingRequests.set(id, { resolve, reject });

      const payload = JSON.stringify({
        call: method,
        params: params,
        id: id
      });

      this.socket.send(payload);
    });
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getPrinters(): Promise<string[]> {
    return this.sendRequest("printers.find", []);
  }

  public printHTML(printerName: string, htmlContent: string, options: any = {}): Promise<any> {
    const widthVal = options.width || "80mm";
    
    // QZ Tray JSON structure for printer config and plain HTML printing
    const config = {
      printer: printerName,
      units: "mm",
      size: { width: parseFloat(widthVal) || 80 },
      margins: 0
    };
    
    const data = [{
      type: 'html',
      format: 'plain',
      data: htmlContent
    }];
    
    return this.sendRequest("print", [config, data]);
  }
}

export const qzService = new QzTrayService();
