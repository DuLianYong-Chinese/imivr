import type { Plugin, PluginMetadata, Dimension } from '@/types'
import { getDefaultPrompts, getPromptsForJobRole } from './prompts'
import { readFile, exists, listFiles } from '../filesystem'
import { parseMarkdown } from '../markdown'

class PluginManager {
  private plugins: Map<string, Plugin> = new Map()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return

    const pluginPaths = await listFiles('plugins/')
    const pluginDirs = new Set(
      pluginPaths
        .map(p => p.split('/')[1])
        .filter(Boolean)
    )

    for (const dir of pluginDirs) {
      try {
        const plugin = await this.loadPlugin(`plugins/${dir}`)
        if (plugin) {
          this.plugins.set(plugin.metadata.plugin_id, plugin)
        }
      } catch (error) {
        console.warn(`Failed to load plugin: ${dir}`, error)
      }
    }

    this.initialized = true
  }

  private async loadPlugin(pluginPath: string): Promise<Plugin | null> {
    const metadataPath = `${pluginPath}/plugin.json`
    
    if (!(await exists(metadataPath))) {
      return null
    }

    const metadataContent = await readFile(metadataPath)
    const metadata: PluginMetadata = JSON.parse(metadataContent)

    const prompts = getPromptsForJobRole(metadata.plugin_id)

    return {
      metadata,
      prompts: prompts as any,
    }
  }

  getPlugin(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values())
  }

  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  getEvaluationDimensions(pluginId: string): Dimension[] {
    const plugin = this.getPlugin(pluginId)
    return plugin?.metadata.evaluation_dimensions || []
  }

  getDifficultyMapping(pluginId: string): Record<string, string[]> {
    const plugin = this.getPlugin(pluginId)
    return plugin?.metadata.difficulty_mapping || {}
  }
}

export const pluginManager = new PluginManager()

export function getPlugin(pluginId: string): Plugin | undefined {
  return pluginManager.getPlugin(pluginId)
}

export function getAllPlugins(): Plugin[] {
  return pluginManager.getAllPlugins()
}

export function getEvaluationDimensions(pluginId: string): Dimension[] {
  return pluginManager.getEvaluationDimensions(pluginId)
}

export { getDefaultPrompts, getPromptsForJobRole } from './prompts'
