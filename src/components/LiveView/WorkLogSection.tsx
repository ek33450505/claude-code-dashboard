import React from 'react'
import { Eye, FileEdit, ShieldCheck, FlaskConical, Lightbulb } from 'lucide-react'
import type { ParsedWorkLog } from '../../types/index'

interface WorkLogSectionProps {
  workLog: ParsedWorkLog
}

function LogItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground font-mono leading-relaxed">
      <span className="mt-0.5 flex-shrink-0 opacity-60">{icon}</span>
      <span className="break-all">{children}</span>
    </div>
  )
}

export default function WorkLogSection({ workLog }: WorkLogSectionProps) {
  const hasContent =
    workLog.filesRead.length > 0 ||
    workLog.filesChanged.length > 0 ||
    workLog.codeReviewerResult ||
    workLog.testWriterResult ||
    workLog.decisions.length > 0

  if (!hasContent && workLog.items.length === 0) return null

  return (
    <div className="mt-2 pl-2 border-l border-border/40 flex flex-col gap-0.5">
      {workLog.filesRead.map((file, i) => (
        <LogItem key={`r-${i}`} icon={<Eye size={11} />}>
          Read: {file}
        </LogItem>
      ))}
      {workLog.filesChanged.map((file, i) => (
        <LogItem key={`c-${i}`} icon={<FileEdit size={11} />}>
          Changed: {file}
        </LogItem>
      ))}
      {workLog.codeReviewerResult && (
        <LogItem icon={<ShieldCheck size={11} />}>
          code-reviewer: {workLog.codeReviewerResult}
        </LogItem>
      )}
      {workLog.testWriterResult && (
        <LogItem icon={<FlaskConical size={11} />}>
          test-writer: {workLog.testWriterResult}
        </LogItem>
      )}
      {workLog.decisions.map((d, i) => (
        <LogItem key={`d-${i}`} icon={<Lightbulb size={11} />}>
          {d}
        </LogItem>
      ))}
      {/* Fallback: render raw items if none of the structured fields matched */}
      {!hasContent && workLog.items.map((item, i) => (
        <LogItem key={`raw-${i}`} icon={<span className="opacity-40">·</span>}>
          {item}
        </LogItem>
      ))}
    </div>
  )
}
