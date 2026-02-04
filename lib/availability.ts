import { supabase } from './supabase';
import { ProviderAvailabilityRule, AvailabilityCheckResult, AvailabilityViolation } from './types';

/**
 * Check if a provider is available for a specific service/date/time combination
 */
export async function checkProviderAvailability(
  providerId: string,
  serviceId: string,
  date: string,
  timeBlock: string
): Promise<AvailabilityCheckResult> {
  const dateObj = new Date(date + 'T00:00:00');
  const dayOfWeek = dateObj.getDay();

  // Get all rules for this provider and service
  const { data: rules, error } = await supabase
    .from('provider_availability_rules')
    .select('*')
    .eq('provider_id', providerId)
    .eq('service_id', serviceId);

  if (error) {
    console.error('Error fetching availability rules:', error);
    return { allowed: true, enforcement: null, reason: null, rule: null };
  }

  // If no rules exist, provider is allowed (default behavior)
  if (!rules || rules.length === 0) {
    return { allowed: true, enforcement: null, reason: null, rule: null };
  }

  // Check for "allow" rules - if they exist, provider can ONLY work specified slots
  const allowRules = rules.filter(r => r.rule_type === 'allow');
  if (allowRules.length > 0) {
    // Provider has allow rules - check if this slot is allowed
    const matchingAllowRule = allowRules.find(r =>
      r.day_of_week === dayOfWeek &&
      timeBlockMatches(r.time_block, timeBlock)
    );

    if (!matchingAllowRule) {
      // Not in allowed slots - find the most restrictive enforcement
      const hasHardBlock = allowRules.some(r => r.enforcement === 'hard');
      const sampleRule = allowRules[0];
      return {
        allowed: false,
        enforcement: hasHardBlock ? 'hard' : 'warn',
        reason: 'Provider is only available on specific days/times',
        rule: sampleRule
      };
    }
    return { allowed: true, enforcement: null, reason: null, rule: matchingAllowRule };
  }

  // Check for "block" rules
  const blockRules = rules.filter(r => r.rule_type === 'block');
  const matchingBlockRule = blockRules.find(r =>
    r.day_of_week === dayOfWeek &&
    timeBlockMatches(r.time_block, timeBlock)
  );

  if (matchingBlockRule) {
    return {
      allowed: false,
      enforcement: matchingBlockRule.enforcement,
      reason: matchingBlockRule.reason || 'Provider is blocked for this time slot',
      rule: matchingBlockRule
    };
  }

  return { allowed: true, enforcement: null, reason: null, rule: null };
}

/**
 * Check if two time blocks overlap
 */
function timeBlockMatches(ruleBlock: string, requestedBlock: string): boolean {
  if (ruleBlock === 'BOTH' || requestedBlock === 'BOTH') return true;
  return ruleBlock === requestedBlock;
}

/**
 * Batch check availability for multiple assignments (for bulk operations)
 */
export async function checkBulkAvailability(
  assignments: Array<{
    provider_id: string;
    service_id: string;
    date: string;
    time_block: string;
  }>
): Promise<{
  violations: AvailabilityViolation[];
  hardBlocks: AvailabilityViolation[];
  warnings: AvailabilityViolation[];
}> {
  const violations: AvailabilityViolation[] = [];

  if (assignments.length === 0) {
    return { violations: [], hardBlocks: [], warnings: [] };
  }

  // Get unique provider/service combinations
  const providerIds = [...new Set(assignments.map(a => a.provider_id))];
  const serviceIds = [...new Set(assignments.map(a => a.service_id))];

  // Fetch all relevant rules in one query
  const { data: rules } = await supabase
    .from('provider_availability_rules')
    .select('*, provider:providers(initials), service:services(name)')
    .in('provider_id', providerIds)
    .in('service_id', serviceIds);

  if (!rules || rules.length === 0) {
    return { violations: [], hardBlocks: [], warnings: [] };
  }

  // Build lookup map
  const rulesByProviderService = new Map<string, typeof rules>();
  rules.forEach(rule => {
    const key = `${rule.provider_id}|${rule.service_id}`;
    const existing = rulesByProviderService.get(key) || [];
    existing.push(rule);
    rulesByProviderService.set(key, existing);
  });

  // Check each assignment
  for (const assignment of assignments) {
    const key = `${assignment.provider_id}|${assignment.service_id}`;
    const providerRules = rulesByProviderService.get(key);

    if (!providerRules) continue;

    const dateObj = new Date(assignment.date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay();

    // Check allow rules
    const allowRules = providerRules.filter(r => r.rule_type === 'allow');
    if (allowRules.length > 0) {
      const matchingAllow = allowRules.find(r =>
        r.day_of_week === dayOfWeek &&
        timeBlockMatches(r.time_block, assignment.time_block)
      );

      if (!matchingAllow) {
        const sample = allowRules[0];
        violations.push({
          provider_id: assignment.provider_id,
          provider_initials: sample.provider?.initials || 'Unknown',
          date: assignment.date,
          time_block: assignment.time_block,
          service_name: sample.service?.name || 'Unknown',
          enforcement: allowRules.some(r => r.enforcement === 'hard') ? 'hard' : 'warn',
          reason: 'Provider is only available on specific days/times'
        });
      }
      continue;
    }

    // Check block rules
    const blockRules = providerRules.filter(r => r.rule_type === 'block');
    const matchingBlock = blockRules.find(r =>
      r.day_of_week === dayOfWeek &&
      timeBlockMatches(r.time_block, assignment.time_block)
    );

    if (matchingBlock) {
      violations.push({
        provider_id: assignment.provider_id,
        provider_initials: matchingBlock.provider?.initials || 'Unknown',
        date: assignment.date,
        time_block: assignment.time_block,
        service_name: matchingBlock.service?.name || 'Unknown',
        enforcement: matchingBlock.enforcement,
        reason: matchingBlock.reason || 'Provider is blocked for this time slot'
      });
    }
  }

  return {
    violations,
    hardBlocks: violations.filter(v => v.enforcement === 'hard'),
    warnings: violations.filter(v => v.enforcement === 'warn')
  };
}

/**
 * Get all availability rules for a provider (for UI display)
 */
export async function getProviderAvailabilityRules(
  providerId: string
): Promise<ProviderAvailabilityRule[]> {
  const { data, error } = await supabase
    .from('provider_availability_rules')
    .select('*, service:services(*)')
    .eq('provider_id', providerId)
    .order('service_id')
    .order('day_of_week');

  if (error) {
    console.error('Error fetching provider availability rules:', error);
    return [];
  }

  return data || [];
}
