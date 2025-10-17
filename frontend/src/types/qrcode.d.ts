declare module 'qrcode' {
  interface QRCodeOptions {
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
    quality?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    width?: number;
    height?: number;
  }

  function toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
  function toString(text: string, options?: QRCodeOptions): Promise<string>;
  function toBuffer(text: string, options?: QRCodeOptions): Promise<Buffer>;
  function toFile(path: string, text: string, options?: QRCodeOptions): Promise<void>;
  function toFileStream(stream: NodeJS.WritableStream, text: string, options?: QRCodeOptions): Promise<void>;

  export = {
    toDataURL,
    toString,
    toBuffer,
    toFile,
    toFileStream
  };
}
