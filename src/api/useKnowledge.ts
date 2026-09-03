import { createResourceHook } from './createResourceHook'

interface RuleFile {
  filename: string
  path: string
  preview: string
  modifiedAt: string
}

interface SkillFile {
  name: string
  description: string
  path: string
  modifiedAt: string
}

interface CommandFile {
  name: string
  preview: string
  path: string
  modifiedAt: string
}

export const useRules = createResourceHook<RuleFile[]>({
  path: '/api/rules',
  queryKey: ['rules'],
})

export const useSkills = createResourceHook<SkillFile[]>({
  path: '/api/skills',
  queryKey: ['skills'],
})

export const useCommands = createResourceHook<CommandFile[]>({
  path: '/api/commands',
  queryKey: ['commands'],
})

// The caller supplies the whole URL (not just a resource segment), so it's
// returned verbatim rather than composed from a base path.
export const useFileContent = createResourceHook<{ body: string }>({
  path: (params) => String(params?.url ?? ''),
  queryKey: ['file-content'],
  enabled: (params) => !!params?.url,
})
