import { expect, test } from 'bun:test';
import { readGatewayDeployments } from '../../supabase/functions/_shared/gatewayDeployments';
test('admin reconciliation reads every page, including private routes hidden from caller-filtered lists', async () => {
  const calls: string[] = [];
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    const page = new URL(String(url)).searchParams.get('page');
    return Response.json({ data: page === '1' ? [{ model_name: 'market-model' }] : [{ model_name: 'mine/garage-m4/granite' }], total_pages: 2 });
  }) as typeof fetch;
  expect(await readGatewayDeployments('https://llm.garageai.eu', 'fixture-key')).toEqual([{ model_name: 'market-model' }, { model_name: 'mine/garage-m4/granite' }]);
  expect(calls).toEqual(['https://llm.garageai.eu/v2/model/info?page=1&size=100','https://llm.garageai.eu/v2/model/info?page=2&size=100']);
});
test('failed inventory reads are inconclusive, never an empty desired/actual list', async () => {
  globalThis.fetch = (async () => new Response('', { status: 503 })) as typeof fetch;
  await expect(readGatewayDeployments('https://llm.garageai.eu', 'fixture-key')).rejects.toThrow('inventory unavailable');
});