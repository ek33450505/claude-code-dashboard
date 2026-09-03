import { useQuery } from '@tanstack/react-query'
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

async function fetchRules(): Promise<RuleFile[]> {
  const res = await fetch('/api/rules')
  if (!res.ok) throw new Error('Failed to fetch rules')
  return res.json()
}

async function fetchSkills(): Promise<SkillFile[]> {
  const res = await fetch('/api/skills')
  if (!res.ok) throw new Error('Failed to fetch skills')
  return res.json()
}

async function fetchCommands(): Promise<CommandFile[]> {
  const res = await fetch('/api/commands')
  if (!res.ok) throw new Error('Failed to fetch commands')
  return res.json()
}

export const useRules = () =>
  useQuery({ queryKey: ['rules'], queryFn: fetchRules })

export const useSkills = () =>
  useQuery({ queryKey: ['skills'], queryFn: fetchSkills })

export const useCommands = () =>
  useQuery({ queryKey: ['commands'], queryFn: fetchCommands })

// The caller supplies the whole URL (not just a resource segment), so it's
// returned verbatim rather than composed from a base path.
export const useFileContent = createResourceHook<{ body: string }>({
  path: (params) => String(params?.url ?? ''),
  queryKey: ['file-content'],
  enabled: (params) => !!params?.url,
})
