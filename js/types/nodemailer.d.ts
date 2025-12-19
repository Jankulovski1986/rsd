declare module "nodemailer" {
  export type Transporter = any;
  export interface TransportOptions {
    [key: string]: any;
  }

  export function createTransport(options?: TransportOptions): Transporter;
  export const Transporter: Transporter;

  const nodemailer: {
    createTransport: typeof createTransport;
    Transporter: typeof Transporter;
  };

  export default nodemailer;
}
