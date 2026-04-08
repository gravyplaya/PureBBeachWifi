export function StatsCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-stone-500">{title}</p>
      <p className="mt-1 text-2xl font-bold text-stone-900">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
      )}
    </div>
  );
}
