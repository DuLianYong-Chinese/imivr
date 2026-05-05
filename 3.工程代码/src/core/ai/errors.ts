export class AIError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'AIError'
  }
}

export class AICallError extends AIError {
  constructor(message: string) {
    super(message, 'AI_CALL_ERROR')
    this.name = 'AICallError'
  }
}

export class AIResponseParseError extends AIError {
  constructor(message: string) {
    super(message, 'AI_RESPONSE_PARSE_ERROR')
    this.name = 'AIResponseParseError'
  }
}
