interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  comparison?: number | null;
  isPercentage?: boolean;
}

export default function KPICard({ title, value, subtitle, comparison, isPercentage }: KPICardProps) {
  const hasComparison = comparison !== null && comparison !== undefined && comparison !== 0;
  const isPositive = hasComparison && comparison > 0;
  const isNegative = hasComparison && comparison < 0;

  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-sm text-gray-500 font-medium">{title}</p>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="text-2xl font-bold" style={{ color: '#003D7A' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {hasComparison && (
          <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? (
              <svg className="w-4 h-4 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
            {isPositive ? '+' : ''}{isPercentage ? comparison.toFixed(1) : Math.abs(comparison).toLocaleString()}
            {isPercentage ? 'pp' : ''}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}
