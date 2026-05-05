export class FileSystemError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'FileSystemError'
  }
}

export class FileNotFoundError extends FileSystemError {
  constructor(path: string) {
    super(`File not found: ${path}`, 'FILE_NOT_FOUND')
    this.name = 'FileNotFoundError'
  }
}

export class DirectoryNotFoundError extends FileSystemError {
  constructor(path: string) {
    super(`Directory not found: ${path}`, 'DIR_NOT_FOUND')
    this.name = 'DirectoryNotFoundError'
  }
}

export class PermissionDeniedError extends FileSystemError {
  constructor(path: string) {
    super(`Permission denied: ${path}`, 'PERMISSION_DENIED')
    this.name = 'PermissionDeniedError'
  }
}

export class FileAlreadyExistsError extends FileSystemError {
  constructor(path: string) {
    super(`File already exists: ${path}`, 'FILE_EXISTS')
    this.name = 'FileAlreadyExistsError'
  }
}
