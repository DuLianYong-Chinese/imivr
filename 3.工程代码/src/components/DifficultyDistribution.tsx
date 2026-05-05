import { useState, useCallback, useMemo, useEffect } from 'react'
import { useThemeStore } from '@/stores/themeStore'

interface DifficultyLevel {
  key: string
  label: string
  color: string
}

const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  { key: 'L1-初级', label: 'L1-初级', color: '#52c41a' },
  { key: 'L2-中级', label: 'L2-中级', color: '#1677ff' },
  { key: 'L3-高级', label: 'L3-高级', color: '#fa8c16' },
  { key: 'L4-专家', label: 'L4-专家', color: '#ff4d4f' },
  { key: 'L5-大神', label: 'L5-大神', color: '#722ed1' },
]

interface DifficultyDistributionProps {
  selectedLevels: string[]
  onChange: (distributions: Record<string, number>) => void
}

export default function DifficultyDistribution({ selectedLevels, onChange }: DifficultyDistributionProps) {
  const { colors } = useThemeStore()
  
  const [distributions, setDistributions] = useState<Record<string, number>>({})

  useEffect(() => {
    if (selectedLevels.length === 0) {
      setDistributions({})
      onChange({})
      return
    }
    
    if (selectedLevels.length === 1) {
      const result = { [selectedLevels[0]]: 100 }
      setDistributions(result)
      onChange(result)
      return
    }
    
    const equalShare = Math.floor(100 / selectedLevels.length)
    const result: Record<string, number> = {}
    selectedLevels.forEach((level, index) => {
      result[level] = index === selectedLevels.length - 1 
        ? 100 - equalShare * (selectedLevels.length - 1) 
        : equalShare
    })
    setDistributions(result)
    onChange(result)
  }, [selectedLevels])

  const sortedLevels = useMemo(() => {
    return DIFFICULTY_LEVELS.filter(level => selectedLevels.includes(level.key))
  }, [selectedLevels])

  const handleSliderChange = useCallback((index: number, newValue: number) => {
    const newDistributions = { ...distributions }
    const currentValues = Object.values(newDistributions)
    const diff = newValue - currentValues[index]
    
    for (let i = 0; i < currentValues.length; i++) {
      if (i !== index) {
        const availableSpace = sortedLevels.length - 1
        if (availableSpace > 0) {
          newDistributions[sortedLevels[i].key] = Math.max(0, currentValues[i] - Math.round(diff / availableSpace))
        }
      }
    }
    
    newDistributions[sortedLevels[index].key] = Math.min(100, Math.max(0, newValue))
    
    const total = Object.values(newDistributions).reduce((sum, val) => sum + val, 0)
    if (total !== 100 && sortedLevels.length > 1) {
      const lastIndex = sortedLevels.length - 1
      newDistributions[sortedLevels[lastIndex].key] += 100 - total
    }
    
    setDistributions(newDistributions)
    onChange(newDistributions)
  }, [distributions, onChange, sortedLevels])

  if (sortedLevels.length === 0) {
    return (
      <div style={{ 
        padding: '16px 0', 
        textAlign: 'center',
        color: colors.textTertiary,
        fontSize: 13
      }}>
        请先选择题库
      </div>
    )
  }

  const isManyLevels = sortedLevels.length > 3

  return (
    <div style={{ 
      width: '100%',
      marginTop: 4,
      background: colors.surfaceHover,
      borderRadius: 8,
      padding: 10,
      border: `1px solid ${colors.border}`
    }}>
      <div style={{
        display: 'flex',
        height: 24,
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: 8,
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
        position: 'relative'
      }}>
        {sortedLevels.map((level, index) => {
          const percentage = distributions[level.key] || 0
          return (
            <div
              key={level.key}
              style={{
                flex: `${percentage} 0 0%`,
                minWidth: percentage > 0 ? '30px' : '0px',
                background: level.color,
                transition: 'flex 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                opacity: 0.85
              }}
            >
              <span style={{
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: percentage > 15 ? 12 : 10,
                  textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                }}>
                  {percentage}%
                </span>
              </div>
            )
        })}
      </div>

      {sortedLevels.length > 1 && (
        <div style={{
          position: 'relative',
          height: 24,
          margin: '4px 0 8px 0'
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 6,
            background: `linear-gradient(to right, ${sortedLevels.map(l => l.color).join(', ')})`,
            borderRadius: 3,
            opacity: 0.3
          }} />
          
          {sortedLevels.slice(0, -1).map((_, index) => {
            let leftPercentage = 0
            for (let i = 0; i <= index; i++) {
              leftPercentage += (distributions[sortedLevels[i].key] || 0)
            }
            
            return (
              <div
                key={`handle-${index}`}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onTouchStart={(e) => handleTouchStart(e, index)}
                style={{
                  position: 'absolute',
                  left: `calc(${leftPercentage}% - 8px)`,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#fff',
                  border: '2px solid',
                  borderColor: sortedLevels[index + 1]?.color || sortedLevels[index].color,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                  cursor: 'ew-resize',
                  zIndex: 10,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1.15)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(-50%) scale(1)'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)'
                }}
              />
            )
          })}
        </div>
      )}

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: isManyLevels ? 4 : 6,
        flexWrap: isManyLevels ? 'wrap' : 'nowrap',
      }}>
        {sortedLevels.map((level, index) => (
          <div
            key={`label-${index}`}
            style={{
              flex: 1,
              minWidth: isManyLevels ? 48 : 0,
              textAlign: 'center',
              padding: isManyLevels ? '3px 4px' : '4px 6px',
              borderRadius: 6,
              background: `${distributions[level.key] || 0} > 20 ? level.color + '20' : 'transparent'`,
              border: `1px solid ${level.color + '40'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{
              fontSize: isManyLevels ? 13 : 14,
              fontWeight: 700,
              color: level.color,
              lineHeight: 1.2
            }}>
              {distributions[level.key] || 0}%
            </div>
            <div style={{
              fontSize: 10,
              color: colors.textSecondary,
              marginTop: 1
            }}>
              {level.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  function handleMouseDown(e: React.MouseEvent, handleIndex: number) {
    e.preventDefault()
    const sliderRect = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect()
    if (!sliderRect) return
    const sliderWidth = sliderRect.width
    const startValue = distributions[sortedLevels[handleIndex].key] || 0
    const startClientX = e.clientX
    const minValue = 10
    const maxValue = 80
    const combinedTotal = startValue + (distributions[sortedLevels[handleIndex + 1].key] || 0)
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaPixels = moveEvent.clientX - startClientX
      const deltaPercent = (deltaPixels / sliderWidth) * 100
      let newValue = Math.round(startValue + deltaPercent)
      newValue = Math.max(minValue, Math.min(maxValue, newValue))
      const otherValue = combinedTotal - newValue
      if (otherValue < minValue) {
        newValue = combinedTotal - minValue
      }
      if (otherValue > maxValue) {
        newValue = combinedTotal - maxValue
      }
      
      const newDistributions = { ...distributions }
      newDistributions[sortedLevels[handleIndex].key] = newValue
      newDistributions[sortedLevels[handleIndex + 1].key] = combinedTotal - newValue
      
      setDistributions(newDistributions)
      onChange(newDistributions)
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  function handleTouchStart(e: React.TouchEvent, handleIndex: number) {
    e.preventDefault()
    const sliderRect = (e.currentTarget.parentElement as HTMLElement)?.getBoundingClientRect()
    if (!sliderRect) return
    const sliderWidth = sliderRect.width
    const startValue = distributions[sortedLevels[handleIndex].key] || 0
    const startClientX = e.touches[0].clientX
    const minValue = 10
    const maxValue = 80
    const combinedTotal = startValue + (distributions[sortedLevels[handleIndex + 1].key] || 0)
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const deltaPixels = moveEvent.touches[0].clientX - startClientX
      const deltaPercent = (deltaPixels / sliderWidth) * 100
      let newValue = Math.round(startValue + deltaPercent)
      newValue = Math.max(minValue, Math.min(maxValue, newValue))
      const otherValue = combinedTotal - newValue
      if (otherValue < minValue) {
        newValue = combinedTotal - minValue
      }
      if (otherValue > maxValue) {
        newValue = combinedTotal - maxValue
      }
      
      const newDistributions = { ...distributions }
      newDistributions[sortedLevels[handleIndex].key] = newValue
      newDistributions[sortedLevels[handleIndex + 1].key] = combinedTotal - newValue
      
      setDistributions(newDistributions)
      onChange(newDistributions)
    }
    
    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
    
    document.addEventListener('touchmove', handleTouchMove)
    document.addEventListener('touchend', handleTouchEnd)
  }
}