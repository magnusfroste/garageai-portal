import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: hasRole } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!hasRole) {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const method = req.method;

    if (method === 'GET' || method === 'POST') {
      let body: Record<string, unknown> = {};

      if (method === 'POST') {
        const contentType = req.headers.get('content-type') || '';
        const rawBody = await req.text();

        if (rawBody.trim().length > 0 && contentType.includes('application/json')) {
          try {
            body = JSON.parse(rawBody) as Record<string, unknown>;
          } catch {
            return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      }

      const action = (body.action as string) || 'status';

      if (action === 'update_key') {
        // We can't update Supabase secrets from edge functions, 
        // so we return instructions
        return new Response(JSON.stringify({
          error: 'The Stripe key cannot be updated from here. Contact support or update it in Lovable Cloud.',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Default: check status
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (!stripeKey) {
        return new Response(JSON.stringify({
          connected: false,
          error: 'STRIPE_SECRET_KEY is not configured',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const account = await stripe.accounts.retrieve();
        
        // Get recent balance
        const balance = await stripe.balance.retrieve();
        const availableAmount = balance.available.reduce((sum, b) => sum + b.amount, 0) / 100;
        const pendingAmount = balance.pending.reduce((sum, b) => sum + b.amount, 0) / 100;

        // Get customer count
        const customers = await stripe.customers.list({ limit: 1 });
        const hasCustomers = customers.data.length > 0;

        return new Response(JSON.stringify({
          connected: true,
          account: {
            id: account.id,
            business_name: account.settings?.dashboard?.display_name || account.business_profile?.name || 'N/A',
            country: account.country,
            default_currency: account.default_currency?.toUpperCase(),
            email: account.email,
          },
          balance: {
            available: availableAmount,
            pending: pendingAmount,
            currency: balance.available[0]?.currency?.toUpperCase() || 'USD',
          },
          has_customers: hasCustomers,
          key_prefix: stripeKey.substring(0, 8) + '...',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (stripeError) {
        return new Response(JSON.stringify({
          connected: false,
          error: 'Invalid Stripe key or connection error',
          details: stripeError.message,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stripe status error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
