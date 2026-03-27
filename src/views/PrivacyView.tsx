import PrivacyPanel from '../components/PrivacyPanel'

export default function PrivacyView() {
  return (
    <div className="h-full max-w-2xl mx-auto">
      <div
        className="rounded-xl border border-[var(--border)] overflow-hidden glass-surface"
        style={{ minHeight: 500 }}
      >
        <PrivacyPanel />
      </div>
    </div>
  )
}
