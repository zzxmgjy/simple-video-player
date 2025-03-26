interface ExecutionContext {
  waitUntil(promise: Promise<any>): void
  passThroughOnException(): void
}

interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>
  put(key: string, value: string | ReadableStream | ArrayBuffer | FormData): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: { name: string; expiration?: number }[]; list_complete: boolean; cursor?: string }>
} 