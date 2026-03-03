interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  comparison?: number | null;
  isPercentage?: boolean;
  accentColor?: string;
}

export default function KPICard({ title, value, subtitle, comparison, isPercentage, accentColor }: KPICardProps) {
  const hasComparison = comparison !== null && comparison !== undefined && comparison !== 0;
  const isPositive = hasComparison && comparison > 0;

  return (
    <div
      className="bg-white rounded-xl shadow-sm p-5 min-h-[120px]"
      style={{ borderTop: `3px solid ${accentColor || '#003D7A'}` }}
    >
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="text-3xl font-bold" style={{ color: '#003D7A' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
      {hasComparison && (
        <div className="mt-1.5">
          <span
            className={`inline-flex items-center text-sm font-medium px-2 py-0.5 rounded-full ${
              isPositive
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {isPositive ? (
              <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            {isPositive ? '+' : ''}{isPercentage ? comparison.toFixed(1) : Math.abs(comparison).toLocaleString()}
            {isPercentage ? 'pp' : ''}
          </span>
        </div>
      )}
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
