'use client';

import { useState, useEffect } from 'react';
import { Service, ProviderAvailabilityRule } from '@/lib/types';

interface ProviderAvailabilityEditorProps {
  providerId: string;
  providerName: string;
  services: Service[];
  onSave?: () => void;
}

// Slot states: null = no rule (available), or object with rule details
type SlotState = {
  enforcement: 'warn' | 'hard';
} | null;

const DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

const TIME_BLOCKS = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
  { value: 'BOTH', label: 'All Day' },
];

const colors = {
  primaryBlue: '#003D7A',
  lightBlue: '#0078C8',
  teal: '#00A3AD',
  ptoRed: '#DC2626',
  warningYellow: '#F59E0B',
  border: '#E5E7EB',
};

export default function ProviderAvailabilityEditor({
  providerId,
  providerName,
  services,
  onSave
}: ProviderAvailabilityEditorProps) {
  const [rules, setRules] = useState<ProviderAvailabilityRule[]>([]);
  const [selectedService, setSelectedService] = useState<string>('');
  const [slotStates, setSlotStates] = useState<Map<string, SlotState>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter to services that might need availability rules (typically Rooms)
  const roomsServices = services.filter(s =>
    s.name.includes('Rooms') || s.requires_rooms
  );

  useEffect(() => {
    if (providerId) {
      fetchRules();
    }
  }, [providerId]);

  useEffect(() => {
    if (selectedService) {
      // Populate slot states based on existing rules for this service
      const serviceRules = rules.filter(r => r.service_id === selectedService);
      const newStates = new Map<string, SlotState>();

      serviceRules.forEach(rule => {
        const key = `${rule.day_of_week}-${rule.time_block}`;
        // All rules are now "block" rules with either hard or warn enforcement
        newStates.set(key, { enforcement: rule.enforcement });
      });

      setSlotStates(newStates);
    } else {
      setSlotStates(new Map());
    }
  }, [selectedService, rules]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/providers/${providerId}/availability`);
      const data = await response.json();
      setRules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching availability rules:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cycle through states: null → warn → hard → null
  const cycleSlotState = (day: number, timeBlock: string) => {
    const key = `${day}-${timeBlock}`;
    const newStates = new Map(slotStates);
    const currentState = newStates.get(key);

    if (currentState === null || currentState === undefined) {
      // No rule → Soft Warning
      newStates.set(key, { enforcement: 'warn' });
    } else if (currentState.enforcement === 'warn') {
      // Soft Warning → Hard Block
      newStates.set(key, { enforcement: 'hard' });
    } else {
      // Hard Block → No rule (delete)
      newStates.delete(key);
    }

    setSlotStates(newStates);
  };

  const handleSave = async () => {
    if (!selectedService) {
      alert('Please select a service');
      return;
    }

    setSaving(true);
    try {
      // Convert slot states to rules array (only slots with states)
      const newRules: Array<{
        day_of_week: number;
        time_block: string;
        rule_type: string;
        enforcement: string;
      }> = [];

      slotStates.forEach((state, key) => {
        if (state) {
          const [day, timeBlock] = key.split('-');
          newRules.push({
            day_of_week: parseInt(day),
            time_block: timeBlock,
            rule_type: 'block', // All rules are block rules now
            enforcement: state.enforcement
          });
        }
      });

      const response = await fetch(`/api/providers/${providerId}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: selectedService,
          rules: newRules
        })
      });

      if (response.ok) {
        await fetchRules();
        onSave?.();
        alert('Availability rules saved successfully');
      } else {
        const error = await response.json();
        alert(`Error saving rules: ${error.error}`);
      }
    } catch (error) {
      console.error('Error saving availability rules:', error);
      alert('Failed to save availability rules');
    } finally {
      setSaving(false);
    }
  };

  const getSlotStyle = (day: number, timeBlock: string) => {
    const key = `${day}-${timeBlock}`;
    const state = slotStates.get(key);

    if (!state) {
      // No rule - available
      return {
        backgroundColor: 'white',
        borderColor: colors.border,
        icon: null,
        label: ''
      };
    }

    if (state.enforcement === 'warn') {
      // Soft warning
      return {
        backgroundColor: `${colors.warningYellow}30`,
        borderColor: colors.warningYellow,
        icon: '!',
        label: 'Warn'
      };
    }

    // Hard block
    return {
      backgroundColor: `${colors.ptoRed}30`,
      borderColor: colors.ptoRed,
      icon: '\u2717',
      label: 'Block'
    };
  };

  if (loading) {
    return <div className="text-center py-4">Loading availability rules...</div>;
  }

  return (
    <div className="bg-white rounded-lg border p-6" style={{ borderColor: colors.border }}>
      <h3 className="text-lg font-bold mb-4" style={{ color: colors.primaryBlue }}>
        Availability Rules for {providerName}
      </h3>

      {/* Service Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Service</label>
        <select
          value={selectedService}
          onChange={(e) => setSelectedService(e.target.value)}
          className="w-full px-3 py-2 border rounded"
          style={{ borderColor: colors.border }}
        >
          <option value="">Select a service...</option>
          {roomsServices.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {selectedService && (
        <>
          {/* Instructions */}
          <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: '#F3F4F6' }}>
            <p className="font-medium mb-2">Click each cell to cycle through states:</p>
            <div className="flex flex-wrap gap-4">
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded border" style={{ backgroundColor: 'white', borderColor: colors.border }}></span>
                Available
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded border flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${colors.warningYellow}30`, borderColor: colors.warningYellow }}>!</span>
                Soft Warning
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-4 rounded border flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${colors.ptoRed}30`, borderColor: colors.ptoRed }}>{'\u2717'}</span>
                Hard Block
              </span>
            </div>
          </div>

          {/* Day/Time Grid */}
          <div className="overflow-x-auto mb-4">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-sm" style={{ color: colors.primaryBlue }}>
                    Time
                  </th>
                  {DAYS.map(day => (
                    <th
                      key={day.value}
                      className="p-2 text-center text-sm min-w-[70px]"
                      style={{ color: colors.primaryBlue }}
                    >
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TIME_BLOCKS.map(tb => (
                  <tr key={tb.value}>
                    <td className="p-2 text-sm font-medium" style={{ color: colors.lightBlue }}>
                      {tb.label}
                    </td>
                    {DAYS.map(day => {
                      const style = getSlotStyle(day.value, tb.value);
                      return (
                        <td key={`${day.value}-${tb.value}`} className="p-1">
                          <button
                            onClick={() => cycleSlotState(day.value, tb.value)}
                            className="w-full h-12 rounded border-2 transition-all hover:shadow-md flex flex-col items-center justify-center"
                            style={{
                              backgroundColor: style.backgroundColor,
                              borderColor: style.borderColor
                            }}
                            title={`Click to cycle: Available → Soft Warning → Hard Block`}
                          >
                            {style.icon && (
                              <span className="text-lg font-bold" style={{
                                color: style.borderColor
                              }}>
                                {style.icon}
                              </span>
                            )}
                            {style.label && (
                              <span className="text-[10px] font-medium" style={{
                                color: style.borderColor
                              }}>
                                {style.label}
                              </span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm p-3 rounded" style={{ backgroundColor: '#F9FAFB' }}>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 flex items-center justify-center"
                style={{ backgroundColor: 'white', borderColor: colors.border }}
              >
                -
              </div>
              <span>Available (no restriction)</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 flex items-center justify-center font-bold"
                style={{ backgroundColor: `${colors.warningYellow}30`, borderColor: colors.warningYellow, color: colors.warningYellow }}
              >
                !
              </div>
              <span>Soft Warning (allows with confirmation)</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded border-2 flex items-center justify-center font-bold"
                style={{ backgroundColor: `${colors.ptoRed}30`, borderColor: colors.ptoRed, color: colors.ptoRed }}
              >
                {'\u2717'}
              </div>
              <span>Hard Block (prevents assignment)</span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setSlotStates(new Map())}
              className="px-4 py-2 rounded border font-medium hover:bg-gray-50"
              style={{ borderColor: colors.border }}
            >
              Clear All
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 rounded text-white font-medium disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: colors.primaryBlue }}
            >
              {saving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </>
      )}

      {/* Current Rules Summary */}
      {rules.length > 0 && (
        <div className="mt-6 pt-4 border-t" style={{ borderColor: colors.border }}>
          <h4 className="font-medium mb-2" style={{ color: colors.primaryBlue }}>
            Current Rules Summary
          </h4>
          <div className="space-y-2 text-sm">
            {/* Group rules by service */}
            {Array.from(new Set(rules.map(r => r.service_id))).map(serviceId => {
              const serviceRules = rules.filter(r => r.service_id === serviceId);
              const serviceName = serviceRules[0]?.service?.name || 'Unknown';

              // Group by enforcement
              const softWarnings = serviceRules.filter(r => r.enforcement === 'warn');
              const hardBlocks = serviceRules.filter(r => r.enforcement === 'hard');

              return (
                <div key={serviceId} className="p-3 rounded" style={{ backgroundColor: '#F3F4F6' }}>
                  <div className="font-medium mb-1" style={{ color: colors.primaryBlue }}>{serviceName}</div>
                  {softWarnings.length > 0 && (
                    <div className="text-xs mb-1">
                      <span className="font-medium" style={{ color: colors.warningYellow }}>Soft Warnings: </span>
                      <span className="text-gray-600">
                        {softWarnings.map(r =>
                          `${DAYS.find(d => d.value === r.day_of_week)?.label} ${r.time_block}`
                        ).join(', ')}
                      </span>
                    </div>
                  )}
                  {hardBlocks.length > 0 && (
                    <div className="text-xs">
                      <span className="font-medium" style={{ color: colors.ptoRed }}>Hard Blocks: </span>
                      <span className="text-gray-600">
                        {hardBlocks.map(r =>
                          `${DAYS.find(d => d.value === r.day_of_week)?.label} ${r.time_block}`
                        ).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
