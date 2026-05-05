import { useEffect, useMemo, useRef, useState } from 'react'
import { useThemeStore } from '@/stores/themeStore'

interface LogoSvgProps {
  width?: number
  height?: number
  style?: React.CSSProperties
}

function hexToHue(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return h * 360
}

const LOGO_BASE_HUE = hexToHue('#1958FF')
const LOGO_SRC = '/imivr-logo.svg'
const FAVICON_SIZE = 64

const ORIGINAL_FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#1958FF"/><text x="16" y="23" text-anchor="middle" font-size="18" font-weight="bold" font-family="Arial" fill="white">面</text></svg>`

export default function LogoSvg({ width = 32, height = 32, style }: LogoSvgProps) {
  const { config, colors } = useThemeStore()
  const isDark = config.mode === 'dark'
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const filterStyle = useMemo(() => {
    const targetHue = hexToHue(colors.primary)
    const hueShift = targetHue - LOGO_BASE_HUE

    const filters: string[] = []
    if (Math.abs(hueShift) > 1) {
      filters.push(`hue-rotate(${hueShift}deg)`)
    }

    if (isDark) {
      filters.push('invert(1)')
      const darkHueShift = (targetHue + 180) - (LOGO_BASE_HUE + 180)
      if (Math.abs(darkHueShift) > 1) {
        filters.push(`hue-rotate(${darkHueShift}deg)`)
      }
      filters.push('brightness(0.9)')
    }

    return filters.length > 0 ? filters.join(' ') : undefined
  }, [colors.primary, isDark])

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
    img.onerror = () => {
      imgRef.current = null
      setImgLoaded(false)
    }
    img.src = LOGO_SRC
  }, [])

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link)
    }

    if (imgRef.current) {
      const canvas = document.createElement('canvas')
      canvas.width = FAVICON_SIZE
      canvas.height = FAVICON_SIZE
      const ctx = canvas.getContext('2d')
      if (ctx) {
        if (filterStyle) {
          ctx.filter = filterStyle
        }
        ctx.drawImage(imgRef.current, 0, 0, FAVICON_SIZE, FAVICON_SIZE)
        link.type = 'image/png'
        link.href = canvas.toDataURL('image/png')
      }
    } else {
      let svgToUse = ORIGINAL_FAVICON_SVG
      svgToUse = svgToUse.replace(/#1958FF/gi, colors.primary)
      if (isDark) {
        svgToUse = svgToUse.replace(/fill="white"/gi, `fill="${colors.primary}"`)
        svgToUse = svgToUse.replace(/fill="#fff"/gi, `fill="${colors.primary}"`)
        svgToUse = svgToUse.replace(/fill="#ffffff"/gi, `fill="${colors.primary}"`)
      }
      link.type = 'image/svg+xml'
      link.href = `data:image/svg+xml,${encodeURIComponent(svgToUse)}`
    }
  }, [filterStyle, imgLoaded, colors.primary, isDark])

  return (
    <img
      src={LOGO_SRC}
      alt="我是面试官"
      style={{
        width,
        height,
        filter: filterStyle,
        ...style,
      }}
    />
  )
}