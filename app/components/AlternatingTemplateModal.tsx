'use client';

import { useState, useEffect } from 'react';
import { ScheduleTemplate } from '@/lib/types';

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  border: '#E5E7EB',
  purple: '#7C3AED',
};

interface AlternatingTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (result: any) => void;
}

const PATTERN_PRESETS = [
  { label: 'A-B (Alternate)', pattern: [0, 1], description: 'Week A, Week B, Week A, Week B...' },
  { label: 'A-A-B-B (Two weeks each)', pattern: [0, 0, 1, 1], description: 'Two weeks A, then two weeks B...' },
  { label: 'A-B-C (Three-way)', pattern: [0, 1, 2], description: 'Rotate through three templates' },
];

export default function AlternatingTemplateModal({
  isOpen,
  onClose,
  onApply,
}: AlternatingTemplateModalProps) {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>(['', '']);
  const [patternType, setPatternType] = useState<'preset' | 'custom'>('preset');
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [customPattern, setCustomPattern] = useState('0,1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conflictMode, setConflictMode] = useState<'replace' | 'fill'>('fill');

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/templates?type=weekly');
      const data = await response.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTemplate = () => {
    setSelectedTemplates([...selectedTemplates, '']);
  };

  const handleRemoveTemplate = (index: number) => {
    if (selectedTemplates.length <= 2) return;
    setSelectedTemplates(selectedTemplates.filter((_, i) => i !== index));
  };

  const handleTemplateChange = (index: number, value: string) => {
    const newTemplates = [...selectedTemplates];
    newTemplates[index] = value;
    setSelectedTemplates(newTemplates);
  };

  const getPattern = (): number[] => {
    if (patternType === 'preset') {
      return PATTERN_PRESETS[selectedPreset].pattern;
    }
    return customPattern.split(',').map((n) => parseInt(n.trim())).filter((n) => !isNaN(n));
  };

  const handleApply = async () => {
    const validTemplates = selectedTemplates.filter((t) => t);
    if (validTemplates.length < 2 || !startDate || !endDate) return;

    const pattern = getPattern();

    // Validate pattern
    for (const idx of pattern) {
      if (idx < 0 || idx >= validTemplates.length) {
        setError(`Pattern index ${idx} is invalid. Must be 0-${validTemplates.length - 1}`);
        return;
      }
    }

    setApplying(true);
    setError(null);

    try {
      const response = await fetch('/api/templates/apply-alternating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templates: validTemplates,
          pattern,
          startDate,
          endDate,
          options: {
            clearExisting: conflictMode === 'replace',
            skipConflicts: conflictMode === 'fill',
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to apply templates');
        return;
      }

      onApply(result);
      handleClose();
    } catch (err) {
      setError('Failed to apply templates');
      console.error('Error applying templates:', err);
    } finally {
      setApplying(false);
    }
  };

  const handleClose = () => {
    setSelectedTemplates(['', '']);
    setPatternType('preset');
    setSelectedPreset(0);
    setCustomPattern('0,1');
    setStartDate('');
    setEndDate('');
    setError(null);
    onClose();
  };

  const getPreviewWeeks = () => {
    if (!startDate || !endDate) return [];

    const pattern = getPattern();
    const validTemplates = selectedTemplates.filter((t) => t);
    const weeks = [];

    const current = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    let weekIndex = 0;

    // Move to Sunday
    const dayOfWeek = current.getDay();
    current.setDate(current.getDate() - dayOfWeek);

    while (current <= end && weeks.length < 12) {
      const patternIdx = weekIndex % pattern.length;
      const templateIdx = pattern[patternIdx];
      const templateId = validTemplates[templateIdx];
      const template = templates.find((t) => t.id === templateId);

      weeks.push({
        start: current.toISOString().split('T')[0],
        templateName: template?.name || `Template ${templateIdx + 1}`,
        letter: String.fromCharCode(65 + templateIdx), // A, B, C...
      });

      current.setDate(current.getDate() + 7);
      weekIndex++;
    }

    return weeks;
  };

  if (!isOpen) return null;

  const previewWeeks = getPreviewWeeks();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <h3 className="text-xl font-bold mb-4" style={{ color: colors.primaryBlue }}>
          Apply Alternating Templates
        </h3>

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-4">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Templates</label>
              {selectedTemplates.map((templateId, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <span
                    className="w-8 h-8 flex items-center justify-center rounded font-bold text-white"
                    style={{ backgroundColor: index === 0 ? colors.teal : index === 1 ? colors.purple : colors.lightBlue }}
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  <select
                    value={templateId}
                    onChange={(e) => handleTemplateChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border rounded"
                    style={{ borderColor: colors.border }}
                    disabled={loading}
                  >
                    <option value="">Select template...</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {selectedTemplates.length > 2 && (
                    <button
                      onClick={() => handleRemoveTemplate(index)}
                      className="px-2 py-1 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {selectedTemplates.length < 4 && (
                <button
                  onClick={handleAddTemplate}
                  className="text-sm hover:underline"
                  style={{ color: colors.lightBlue }}
                >
                  + Add another template
                </button>
              )}
            </div>

            {/* Pattern Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Pattern</label>
              <div className="space-y-2">
                {PATTERN_PRESETS.slice(0, selectedTemplates.filter(t => t).length >= 3 ? 3 : 2).map((preset, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${
                      patternType === 'preset' && selectedPreset === idx ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    style={{ borderColor: patternType === 'preset' && selectedPreset === idx ? colors.lightBlue : colors.border }}
                  >
                    <input
                      type="radio"
                      name="pattern"
                      checked={patternType === 'preset' && selectedPreset === idx}
                      onChange={() => {
                        setPatternType('preset');
                        setSelectedPreset(idx);
                      }}
                    />
                    <div>
                      <div className="font-medium text-sm">{preset.label}</div>
                      <div className="text-xs text-gray-500">{preset.description}</div>
                    </div>
                  </label>
                ))}
                <label
                  className={`flex items-center gap-2 p-2 border rounded cursor-pointer ${
                    patternType === 'custom' ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                  style={{ borderColor: patternType === 'custom' ? colors.lightBlue : colors.border }}
                >
                  <input
                    type="radio"
                    name="pattern"
                    checked={patternType === 'custom'}
                    onChange={() => setPatternType('custom')}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-sm">Custom Pattern</div>
                    {patternType === 'custom' && (
                      <input
                        type="text"
                        value={customPattern}
                        onChange={(e) => setCustomPattern(e.target.value)}
                        placeholder="e.g., 0,1,0,1"
                        className="w-full mt-1 px-2 py-1 border rounded text-sm"
                        style={{ borderColor: colors.border }}
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  style={{ borderColor: colors.border }}
                />
              </div>
            </div>

            {/* Conflict Mode */}
            <div>
              <label className="block text-sm font-medium mb-2">Existing Assignments</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="conflict"
                    checked={conflictMode === 'fill'}
                    onChange={() => setConflictMode('fill')}
                  />
                  <span className="text-sm">Fill empty only</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="conflict"
                    checked={conflictMode === 'replace'}
                    onChange={() => setConflictMode('replace')}
                  />
                  <span className="text-sm">Replace all</span>
                </label>
              </div>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div>
            <label className="block text-sm font-medium mb-2">Preview</label>
            <div className="border rounded p-3 max-h-64 overflow-auto" style={{ borderColor: colors.border }}>
              {previewWeeks.length > 0 ? (
                <div className="space-y-1">
                  {previewWeeks.map((week, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm py-1 px-2 rounded"
                      style={{
                        backgroundColor:
                          week.letter === 'A' ? `${colors.teal}20` :
                          week.letter === 'B' ? `${colors.purple}20` :
                          `${colors.lightBlue}20`,
                      }}
                    >
                      <span
                        className="w-6 h-6 flex items-center justify-center rounded text-white text-xs font-bold"
                        style={{
                          backgroundColor:
                            week.letter === 'A' ? colors.teal :
                            week.letter === 'B' ? colors.purple :
                            colors.lightBlue,
                        }}
                      >
                        {week.letter}
                      </span>
                      <span className="text-gray-600">{week.start}</span>
                      <span className="text-gray-400">-</span>
                      <span className="truncate">{week.templateName}</span>
                    </div>
                  ))}
                  {previewWeeks.length >= 12 && (
                    <div className="text-xs text-gray-500 text-center py-1">
                      ... and more weeks
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  Select templates and dates to see preview
                </div>
              )}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded text-sm" style={{ backgroundColor: `${colors.ptoRed}10`, color: colors.ptoRed }}>
            {error}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleApply}
            disabled={
              selectedTemplates.filter((t) => t).length < 2 ||
              !startDate ||
              !endDate ||
              applying
            }
            className="flex-1 px-4 py-2 rounded text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: colors.primaryBlue }}
          >
            {applying ? 'Applying...' : 'Apply Alternating Pattern'}
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded border"
            style={{ borderColor: colors.border }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
