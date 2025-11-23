// global.d.ts

declare module 'web3.storage' {
  // Minimal, “good enough” typings so TypeScript stops complaining

  export interface Web3StorageOptions {
    token: string
    endpoint?: string
  }

  export class Web3Storage {
    constructor(config: Web3StorageOptions)

    // we only really need put() for now
    put(
      files: Iterable<any> | AsyncIterable<any>,
      options?: {
        name?: string
        maxRetries?: number
      }
    ): Promise<string>
  }

  // File export – we can keep it as loose as 'any' for now
  export class File {
    constructor(parts: any[], filename: string, options?: any)
  }
}
