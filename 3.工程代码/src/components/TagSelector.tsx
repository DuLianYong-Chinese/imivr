import type { CandidateTag } from '@/modules/interview'
import { useThemeStore } from '@/stores/themeStore'

const CATEGORY_META: Record<string, { icon: string; color: string }> = {
  '技术类': { icon: '⚡', color: '#1677ff' },
  '项目类': { icon: '🏗', color: '#52c41a' },
  '软技能类': { icon: '🤝', color: '#fa8c16' },
  '职业规划类': { icon: '🎯', color: '#722ed1' },
  '岗位挑战类': { icon: '🔥', color: '#ff4d4f' },
  '领导力类': { icon: '👑', color: '#13c2c2' },
  '行业洞察类': { icon: '💡', color: '#eb2f96' },
}

interface TagSelectorProps {
  candidateTags: CandidateTag[]
  selectedTags: Record<string, number>
  onSelect: (tags: Record<string, number>) => void
}

export default function TagSelector({ candidateTags, selectedTags, onSelect }: TagSelectorProps) {
  const { colors, config } = useThemeStore()
  const isDark = config.mode === 'dark'

  const handleToggle = (tag: string) => {
    if (tag in selectedTags) {
      const next = { ...selectedTags }
      delete next[tag]
      onSelect(next)
    } else {
      onSelect({ ...selectedTags, [tag]: 3 })
    }
  }

  const handleCountChange = (tag: string, val: number) => {
    onSelect({ ...selectedTags, [tag]: Math.max(1, Math.min(10, val)) })
  }

  const totalCount = Object.values(selectedTags).reduce((a, b) => a + b, 0)
  const selectedCount = Object.keys(selectedTags).length

  if (candidateTags.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: 24,
        background: colors.surfaceHover,
        borderRadius: 8,
        border: `1px dashed ${colors.border}`,
      }}>
        <p style={{ color: colors.textTertiary, fontSize: 13, margin: 0 }}>请先上传简历并生成标签</p>
      </div>
    )
  }

  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 1.5 }}>
          选择需要出题的标签，每个标签默认3道题，可调整数量
        </div>
        {selectedCount > 0 && (
          <div style={{
            fontSize: 11,
            color: colors.primary,
            fontWeight: 600,
            background: colors.primaryBg,
            padding: '2px 8px',
            borderRadius: 10,
          }}>
            {selectedCount} 个标签 · {totalCount} 道题
          </div>
        )}
      </div>

      <div style={{
        maxHeight: candidateTags.length > 5 ? 400 : 'none',
        overflowY: candidateTags.length > 5 ? 'auto' : 'visible',
        paddingRight: candidateTags.length > 5 ? 4 : 0,
      }}>
        {candidateTags.map(group => {
          const meta = CATEGORY_META[group.category] || { icon: '📌', color: colors.primary }
          const groupSelectedCount = group.tags.filter(t => t in selectedTags).length

          return (
            <div key={group.category} style={{
              marginBottom: 8,
              borderRadius: 8,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
              padding: '8px 10px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}>
                  <span style={{ fontSize: 13 }}>{meta.icon}</span>
                  <span style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: meta.color,
                  }}>
                    {group.category}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: colors.textTertiary,
                  }}>
                    ({group.tags.length})
                  </span>
                </div>
                {groupSelectedCount > 0 && (
                  <span style={{
                    fontSize: 10,
                    color: meta.color,
                    background: hexToRgba(meta.color, isDark ? 0.15 : 0.08),
                    padding: '1px 6px',
                    borderRadius: 8,
                    fontWeight: 500,
                  }}>
                    已选 {groupSelectedCount}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {group.tags.map(tag => {
                  const isSelected = tag in selectedTags
                  const count = selectedTags[tag] || 3
                  return (
                    <div
                      key={tag}
                      onClick={() => handleToggle(tag)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '3px 8px',
                        borderRadius: 14,
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        userSelect: 'none',
                        lineHeight: 1.4,
                        color: isSelected ? '#fff' : colors.textSecondary,
                        background: isSelected ? meta.color : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
                        border: `1px solid ${isSelected ? meta.color : colors.border}`,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {tag}
                      {isSelected && (
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={count}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleCountChange(tag, parseInt(e.target.value) || 1)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: 28,
                            height: 18,
                            textAlign: 'center',
                            fontSize: 10,
                            fontWeight: 600,
                            lineHeight: '18px',
                            padding: 0,
                            borderRadius: 4,
                            border: `1px solid rgba(255,255,255,0.4)`,
                            background: 'rgba(255,255,255,0.2)',
                            color: '#fff',
                            outline: 'none',
                            MozAppearance: 'textfield',
                          }}
                          className="tag-count-input"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <style>{`
        .tag-count-input::-webkit-inner-spin-button,
        .tag-count-input::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
      `}</style>
    </div>
  )
}