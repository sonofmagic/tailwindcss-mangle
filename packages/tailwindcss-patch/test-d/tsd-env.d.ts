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
