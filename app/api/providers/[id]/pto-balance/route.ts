import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { calculatePTODays } from '@/lib/ptoCalculation';
import { PTOTimeBlock } from '@/lib/types';

export interface PTOBalanceResponse {
  provider_id: string;
  provider_name: string;
  provider_initials: string;
  role: string;
  year: number;
  annual_allowance: number;
  carryover_days: number;
  total_available: number;
  days_used: number;
  days_remaining: number;
  pending_days: number;
  allowance_source: 'provider_config' | 'role_default' | 'system_default';
  warning: {
    level: 'none' | 'approaching' | 'exceeded';
    message: string | null;
  };
}

// GET /api/providers/[id]/pto-balance - Get PTO balance for a provider
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // Get provider with role and work_days
    const { data: provider, error: providerError } = await supabase
      .from('providers')
      .select('id, name, initials, role, work_days')
      .eq('id', id)
      .single();

    if (providerError) {
      if (providerError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }
      throw providerError;
    }

    // Try to get provider-specific config for this year
    let annualAllowance: number | null = null;
    let carryoverDays = 0;
    let allowanceSource: 'provider_config' | 'role_default' | 'system_default' = 'system_default';

    // Check for provider-specific config
    const { data: providerConfig } = await supabase
      .from('provider_pto_config')
      .select('annual_allowance, carryover_days')
      .eq('provider_id', id)
      .eq('year', year)
      .single();

    if (providerConfig?.annual_allowance !== null && providerConfig?.annual_allowance !== undefined) {
      annualAllowance = providerConfig.annual_allowance;
      carryoverDays = providerConfig.carryover_days || 0;
      allowanceSource = 'provider_config';
    }

    // If no provider config, try role default
    if (annualAllowance === null) {
      const { data: roleDefault } = await supabase
        .from('pto_role_defaults')
        .select('annual_allowance')
        .eq('role', provider.role)
        .single();

      if (roleDefault?.annual_allowance !== null && roleDefault?.annual_allowance !== undefined) {
        annualAllowance = roleDefault.annual_allowance;
        allowanceSource = 'role_default';
        // Still check for carryover from provider config
        if (providerConfig?.carryover_days) {
          carryoverDays = providerConfig.carryover_days;
        }
      }
    }

    // Fallback to system default if tables don't exist or no data
    if (annualAllowance === null) {
      // Default allowances by role
      const defaultAllowances: Record<string, number> = {
        'Attending': 20,
        'Fellow': 15,
        'NP': 15,
        'PA': 15
      };
      annualAllowance = defaultAllowances[provider.role] || 20;
      allowanceSource = 'system_default';
    }

    const totalAvailable = annualAllowance + carryoverDays;

    // Calculate used PTO days from approved requests
    const { data: approvedRequests } = await supabase
      .from('pto_requests')
      .select('start_date, end_date, time_block')
      .eq('provider_id', id)
      .eq('status', 'approved')
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`);

    const workDays = provider.work_days || [1, 2, 3, 4, 5];

    let daysUsed = 0;
    for (const req of approvedRequests || []) {
      daysUsed += calculatePTODays(
        req.start_date,
        req.end_date,
        req.time_block as PTOTimeBlock,
        workDays
      );
    }

    // Calculate pending PTO days
    const { data: pendingRequests } = await supabase
      .from('pto_requests')
      .select('start_date, end_date, time_block')
      .eq('provider_id', id)
      .eq('status', 'pending')
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`);

    let pendingDays = 0;
    for (const req of pendingRequests || []) {
      pendingDays += calculatePTODays(
        req.start_date,
        req.end_date,
        req.time_block as PTOTimeBlock,
        workDays
      );
    }

    const daysRemaining = totalAvailable - daysUsed;

    // Determine warning level
    let warningLevel: 'none' | 'approaching' | 'exceeded' = 'none';
    let warningMessage: string | null = null;

    const usagePercentage = (daysUsed / totalAvailable) * 100;

    if (daysRemaining < 0) {
      warningLevel = 'exceeded';
      warningMessage = `PTO balance exceeded by ${Math.abs(daysRemaining)} day(s)`;
    } else if (usagePercentage >= 80) {
      warningLevel = 'approaching';
      warningMessage = `${daysRemaining} day(s) remaining (${Math.round(usagePercentage)}% used)`;
    }

    const response: PTOBalanceResponse = {
      provider_id: id,
      provider_name: provider.name,
      provider_initials: provider.initials,
      role: provider.role,
      year,
      annual_allowance: annualAllowance,
      carryover_days: carryoverDays,
      total_available: totalAvailable,
      days_used: daysUsed,
      days_remaining: daysRemaining,
      pending_days: pendingDays,
      allowance_source: allowanceSource,
      warning: {
        level: warningLevel,
        message: warningMessage
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching PTO balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch PTO balance' },
      { status: 500 }
    );
  }
}
