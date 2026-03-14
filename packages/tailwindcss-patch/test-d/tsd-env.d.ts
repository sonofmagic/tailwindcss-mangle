declare module 'cac' {
  export interface Command {
    option(...args: any[]): Command
    action(handler: (...args: any[]) => any): Command
    alias(name: string): Command
  }

  export interface CAC {
    command(name: string, description?: string): Command
  }

  export default function cac(name?: string): CAC
}

declare module '@tailwindcss/node' {
  export const __unstable__loadDesignSystem: (...args: any[]) => Promise<any>
}
