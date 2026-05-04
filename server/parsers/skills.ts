import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { SKILLS_DIR } from '../constants.js'
import { safeResolve } from '../utils/safeResolve.js'

export interface SkillFile {
  name: string
  description: string
  path: string
  modifiedAt: string
}

export function loadSkills(): SkillFile[] {
  if (!fs.existsSync(SKILLS_DIR)) return []

  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())

  const skills: SkillFile[] = []

  for (const dir of dirs) {
    const skillMd = path.join(SKILLS_DIR, dir.name, 'SKILL.md')
    if (!fs.existsSync(skillMd)) continue

    const raw = fs.readFileSync(skillMd, 'utf-8')
    let data: Record<string, unknown> = {}
    try {
      data = matter(raw).data
    } catch (err) {
      console.warn('[parser] skipping malformed frontmatter:', skillMd, err)
      continue
    }
    const stat = fs.statSync(skillMd)

    skills.push({
      name: (data.name as string) || dir.name,
      description: (data.description as string) || '',
      path: skillMd,
      modifiedAt: stat.mtime.toISOString(),
    })
  }

  return skills
}

export function readSkill(name: string): string | null {
  const skillMd = safeResolve(SKILLS_DIR, name, 'SKILL.md')
  if (!skillMd || !fs.existsSync(skillMd)) return null
  return fs.readFileSync(skillMd, 'utf-8')
}
