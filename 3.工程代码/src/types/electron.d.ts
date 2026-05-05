export interface ElectronAPI {
  getConfig: () => Promise<Record<string, any>>
  saveConfig: (config: Record<string, any>) => Promise<boolean>
  selectDirectory: () => Promise<string | null>
  selectAndSetDirectory: () => Promise<string | null>
  readFile: (path: string) => Promise<string | null>
  writeFile: (path: string, content: string) => Promise<boolean>
  deleteFile: (path: string) => Promise<boolean>
  fileExists: (path: string) => Promise<boolean>
  listFiles: (prefix: string) => Promise<string[]>
  createDirectory: (path: string) => Promise<boolean>
  deleteDirectory: (path: string) => Promise<boolean>
  directoryExists: (path: string) => Promise<boolean>
  getUserPath: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}