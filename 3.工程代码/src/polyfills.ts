// Buffer polyfill for browser environment
// gray-matter uses Buffer which is not available in browser

// Simple Buffer implementation for gray-matter
class SimpleBuffer {
  private data: Uint8Array

  constructor(input?: string | number | ArrayBuffer | Uint8Array) {
    if (typeof input === 'string') {
      this.data = new TextEncoder().encode(input)
    } else if (typeof input === 'number') {
      this.data = new Uint8Array(input)
    } else if (input instanceof ArrayBuffer) {
      this.data = new Uint8Array(input)
    } else if (input instanceof Uint8Array) {
      this.data = input
    } else {
      this.data = new Uint8Array(0)
    }
  }

  toString(encoding?: string): string {
    return new TextDecoder(encoding || 'utf-8').decode(this.data)
  }

  static from(input: string | ArrayBuffer | Uint8Array, encoding?: string): SimpleBuffer {
    if (typeof input === 'string') {
      if (encoding === 'base64') {
        // Simple base64 decode
        const binary = atob(input)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }
        return new SimpleBuffer(bytes)
      }
      return new SimpleBuffer(input)
    }
    return new SimpleBuffer(input)
  }

  static isBuffer(obj: any): boolean {
    return obj instanceof SimpleBuffer
  }
}

// @ts-ignore
if (typeof window !== 'undefined' && !window.Buffer) {
  // @ts-ignore
  window.Buffer = SimpleBuffer
}

// @ts-ignore
if (typeof globalThis !== 'undefined' && !globalThis.Buffer) {
  // @ts-ignore
  globalThis.Buffer = SimpleBuffer
}

export default SimpleBuffer
