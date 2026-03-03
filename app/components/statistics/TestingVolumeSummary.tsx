interface DeptStats {
  total: number;
  completed: number;
  arrived: number;
  noShows: number;
  lateCancels: number;
}

interface TestingVolumeSummaryProps {
  current: Record<string, DeptStats>;
  comparison?: Record<string, DeptStats> | null;
}

const DEPT_ORDER = ['CVI Echo', 'Echo Lab (4th Floor)', 'Vascular', 'Nuclear', 'EP', 'CT', 'Cardio Vein'];

function formatChange(current: number, comparison: number): { text: string; color: string } {
  const diff = current - comparison;
  if (diff === 0) return { text: '--', color: 'text-gray-400' };

  const pct = comparison > 0 ? ((diff / comparison) * 100).toFixed(1) : '--';
  const sign = diff > 0 ? '+' : '';
  const pctStr = pct !== '--' ? ` (${sign}${pct}%)` : '';

  return {
    text: `${sign}${diff.toLocaleString()}${pctStr}`,
    color: diff > 0 ? 'text-green-600' : 'text-red-600',
  };
}

export default function TestingVolumeSummary({ current, comparison }: TestingVolumeSummaryProps) {
  const allDepts = new Set([...DEPT_ORDER, ...Object.keys(current)]);
  const departments = Array.from(allDepts).filter(d => current[d] && d !== 'Other');

  if (departments.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-400 text-sm">
        No testing data available for this period.
      </div>
    );
  }

  const totalSeen = departments.reduce((sum, dept) => {
    const stats = current[dept];
    return sum + stats.completed + stats.arrived;
  }, 0);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-5 py-4 border-b">
        <h3
          className="text-base font-semibold pl-4"
          style={{ color: '#003D7A', borderLeft: '4px solid #00A3AD' }}
        >
          Testing Volume by Department
        </h3>
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Department</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Patients Seen</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">% of Total</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">No Shows</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Late Cancels</th>
            <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</th>
            {comparison && (
              <th className="px-5 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {departments.map((dept, idx) => {
            const stats = current[dept];
            const seen = stats.completed + stats.arrived;
            const compStats = comparison?.[dept];
            const compSeen = compStats ? compStats.completed + compStats.arrived : 0;
            const change = compStats ? formatChange(seen, compSeen) : null;

            return (
              <tr key={dept} className={`hover:bg-gray-50 transition-colors duration-150 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                <td className="px-5 py-3 text-sm font-medium text-gray-900">{dept}</td>
                <td className="px-5 py-3 text-sm text-gray-700 text-right">{seen.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-gray-400 text-right">
                  {totalSeen > 0 ? `${((seen / totalSeen) * 100).toFixed(1)}%` : '--'}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500 text-right">{stats.noShows.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-gray-500 text-right">{stats.lateCancels.toLocaleString()}</td>
                <td className="px-5 py-3 text-sm text-gray-500 text-right">{stats.total.toLocaleString()}</td>
                {comparison && (
                  <td className={`px-5 py-3 text-sm text-right font-medium ${change ? change.color : 'text-gray-400'}`}>
                    {change ? change.text : '--'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
