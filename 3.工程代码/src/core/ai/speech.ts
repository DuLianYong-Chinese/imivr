import { AICallError } from './errors'

export interface SpeechConfig {
  apiKey: string
  baseURL: string
  model: string
}

export async function transcribeAudio(audioBlob: Blob, config: SpeechConfig): Promise<string> {
  const formData = new FormData()
  formData.append('file', audioBlob, 'recording.webm')
  formData.append('model', config.model)

  const response = await fetch(`${config.baseURL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new AICallError(`语音转文字API错误: ${response.status} - ${error}`)
  }

  const contentType = response.headers.get('content-type') || ''
  
  if (contentType.includes('text/event-stream') || contentType.includes('text/plain')) {
    const text = await response.text()
    let fullText = ''
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        if (parsed.text) fullText += parsed.text
        if (parsed.delta?.text) fullText += parsed.delta.text
      } catch {
        if (!fullText && data) fullText = data
      }
    }
    return fullText || text
  }

  const data = await response.json()
  return data.text || ''
}

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private stream: MediaStream | null = null

  async start(): Promise<void> {
    this.chunks = []
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.getSupportedMimeType(),
    })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.chunks.push(e.data)
      }
    }

    this.mediaRecorder.start(1000)
  }

  stop(): Blob {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop()
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    const mimeType = this.getSupportedMimeType()
    return new Blob(this.chunks, { type: mimeType })
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/wav']
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type
    }
    return 'audio/webm'
  }
}