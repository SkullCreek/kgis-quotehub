const TONES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  sent: "bg-blue-50 text-blue-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  paid: "bg-emerald-600 text-white",
  cancelled: "bg-slate-200 text-slate-500 line-through",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize " +
        (TONES[status] ?? TONES.draft)
      }
    >
      {status}
    </span>
  );
}
