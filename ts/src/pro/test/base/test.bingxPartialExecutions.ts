// NO_AUTO_TRANSPILE
import assert from 'assert';
import Bingx from '../../bingx.js';

// Native test: exercise the real public method and handlers without sockets or sleeps.
// Shared static WS fixtures separately cover the cross-language public output.
async function testBingxPartialExecutions (ExchangeClass: typeof Bingx = Bingx, selected: string[] = []) {
    const symbol = 'LTC/USDT:USDT';
    const secondSymbol = 'BTC/USDT:USDT';
    const order = '230000000000000001';
    const otherOrder = '230000000000000002';
    const ids = [ '9007199254741001', '9007199254741002', '9007199254741003' ];
    const timestamp = 1720000000000;
    let checks = 0;
    let cases = 0;
    function equal (actual: any, expected: any, message: string) {
        checks += 1;
        assert.deepStrictEqual (actual, expected, message);
    }
    function frame (overrides: any = {}) {
        const data = {
            's': 'LTC-USDT', 'i': order, 'S': 'BUY', 'o': 'LIMIT',
            'q': '5', 'p': '100', 'ap': '98', 'x': 'TRADE', 'X': 'PARTIALLY_FILLED',
            'l': '1', 'L': '90', 'z': '1', 'T': timestamp + 10, 't': ids[0],
            'N': 'USDT', 'n': '-0.09', 'm': false, 'ps': 'LONG', 'rp': '0',
            ...overrides,
        };
        return { 'e': 'ORDER_TRADE_UPDATE', 'E': data['T'] + 1, 'o': data };
    }
    function withoutId (message: any) {
        const copy = structuredClone (message);
        delete copy['o']['id'];
        delete copy['o']['t'];
        return copy;
    }
    const partial = frame ();
    const nextPartial = frame ({ 'l': '2', 'L': '95', 'z': '3', 'T': timestamp + 20, 't': ids[1], 'n': '-0.19' });
    const final = frame ({ 'X': 'FILLED', 'l': '2', 'L': '105', 'z': '5', 'T': timestamp + 30, 't': ids[2], 'n': '-0.21' });
    async function scenario (name: string, callback: (context: any) => Promise<void>, options: any = {}) {
        if ((selected.length > 0) && !selected.includes (name)) {
            return;
        }
        cases += 1;
        const exchange: any = new ExchangeClass ({
            'enableRateLimit': false,
            'options': { 'tradesLimit': options['limit'] === undefined ? 1000 : options['limit'], 'listenKey': 'offline-only' },
        });
        exchange.newUpdates = options['newUpdates'] === true;
        let networkCalls = 0;
        const deny = () => {
            networkCalls += 1;
            throw new Error ('Unexpected network path in ' + name);
        };
        const markets = [
            [ 'LTC/USDT', 'LTC-USDT', 'LTC', false ],
            [ symbol, 'LTC-USDT', 'LTC', true ],
            [ secondSymbol, 'BTC-USDT', 'BTC', true ],
        ].map ((item) => {
            const isSwap = item[3] === true;
            return exchange.safeMarketStructure ({
                'symbol': item[0], 'id': item[1], 'base': item[2], 'baseId': item[2],
                'quote': 'USDT', 'quoteId': 'USDT', 'type': isSwap ? 'swap' : 'spot',
                'spot': !isSwap, 'swap': isSwap, 'future': false, 'option': false,
                'contract': isSwap, 'linear': isSwap ? true : undefined, 'inverse': isSwap ? false : undefined,
                'settle': isSwap ? 'USDT' : undefined, 'settleId': isSwap ? 'USDT' : undefined,
                'contractSize': isSwap ? 1 : undefined, 'active': true,
                'precision': { 'price': 0.01, 'amount': 0.1 },
            });
        });
        exchange.setMarkets (markets);
        for (const method of [ 'fetch', 'fetch2', 'request', 'loadMarkets', 'watchMultiple' ]) {
            exchange[method] = deny;
        }
        exchange.authenticate = async () => {};
        // Stub only transport. watchMyTrades still performs its real unwrapping,
        // newUpdates accounting and symbol/since/limit filtering.
        exchange.watch = async () => {
            assert (exchange.myTrades !== undefined, name + ': expected an accepted execution');
            return exchange.myTrades;
        };
        const notifications: string[] = [];
        const client: any = {
            'url': 'wss://offline.invalid', 'subscriptions': {}, 'futures': {},
            'resolve': (_value: any, hash: string) => notifications.push (hash),
            'reject': (error: Error) => { throw error; },
        };
        const context = {
            exchange,
            feed: (message: any) => exchange.handleMessage (client, structuredClone (message)),
            read: (marketSymbol: any = symbol, since: any = undefined, limit: any = undefined, type = 'swap') => exchange.watchMyTrades (marketSymbol, since, limit, { type }),
            all: () => exchange.watchMyTrades (undefined, undefined, undefined, { 'type': 'swap' }),
            notifications: (type = 'swap') => notifications.filter ((hash) => hash === type + ':mytrades').length,
            status: () => Array.from (exchange.orders === undefined ? [] : exchange.orders).find ((item: any) => item['id'] === order) as any,
        };
        try {
            await callback (context);
            equal (networkCalls, 0, name + ': no network path');
            equal (Object.keys (exchange.clients), [], name + ': no WS clients opened');
        } catch (error) {
            if (error instanceof Error) {
                error.message = name + ': ' + error.message;
            }
            throw error;
        } finally {
            await exchange.close ();
        }
    }
    await scenario ('partial sequence', async (c) => {
        c.feed (frame ({ 'x': 'NEW', 'X': 'NEW', 'l': '0', 'L': '0', 'z': '0' }));
        equal (c.notifications (), 0, 'NEW must not create a trade');
        for (const message of [ partial, nextPartial, final ]) c.feed (message);
        const rows = await c.read ();
        equal (rows.map ((trade: any) => trade['id']), ids, 'all three fill IDs must be returned');
        equal (rows.map ((trade: any) => [ trade['amount'], trade['price'], trade['cost'] ]), [ [ 1, 90, 90 ], [ 2, 95, 190 ], [ 2, 105, 210 ] ], 'values must describe each fill');
        equal (rows[0]['info'], partial['o'], 'raw exchange payload must survive');
        equal (rows.some ((trade: any) => 'trade' in trade), false, 'internal wrappers must not escape');
        equal (c.status ()['status'], 'closed', 'final fill closes the order');
    });
    await scenario ('partial then cancel', async (c) => {
        c.feed (partial);
        c.feed (frame ({ 'x': 'CANCELED', 'X': 'CANCELED', 'l': '0', 'L': '0' }));
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ ids[0] ], 'canceling the remainder must preserve its earlier fill');
        equal (c.status ()['status'], 'canceled', 'order cancellation must still be delivered');
        equal (c.notifications (), 1, 'cancellation is not another trade');
    });
    await scenario ('repeat suppression', async (c) => {
        c.feed (partial);
        c.feed (partial);
        c.feed (frame ({ 'X': 'FILLED' }));
        equal ((await c.read ()).length, 1, 'same execution must retain one row');
        equal (c.notifications (), 1, 'raw status changes must not re-emit unchanged unified trade data');
        equal (c.status ()['status'], 'closed', 'suppressed trade replay must still update the order');
    });
    await scenario ('fills without IDs', async (c) => {
        for (const message of [ partial, nextPartial, final ]) c.feed (withoutId (message));
        const rows = await c.read ();
        equal (rows.map ((trade: any) => trade['amount']), [ 1, 2, 2 ], 'missing IDs must not collapse fills');
        equal (rows.map ((trade: any) => trade['id']), [ undefined, undefined, undefined ], 'internal UUIDs are not exchange IDs');
        equal (rows.map ((trade: any) => trade['order']), [ order, order, order ], 'actual order IDs must survive');
        equal (rows.some ((trade: any) => 'trade' in trade), false, 'missing-ID rows must also be unwrapped');
    });
    await scenario ('different orders without IDs', async (c) => {
        c.feed (withoutId (partial));
        c.feed (withoutId (frame ({ 'i': otherOrder })));
        equal ((await c.read ()).map ((trade: any) => trade['order']), [ order, otherOrder ], 'same-symbol orders must not overwrite each other');
    });
    await scenario ('equal timestamps', async (c) => {
        c.feed (partial);
        c.feed (frame ({ 't': ids[1], 'z': '2' }));
        equal ((await c.read ()).map ((trade: any) => trade['id']), ids.slice (0, 2), 'timestamp coincidence must not collapse different IDs');
    });
    await scenario ('ambiguous fallback', async (c) => {
        c.feed (partial);
        c.feed (frame ({ 't': ids[1] }));
        c.feed (withoutId (partial));
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ ids[0], ids[1], undefined ], 'distinct known IDs and an ambiguous fallback must remain separate');
    });
    await scenario ('known ID then missing ID', async (c) => {
        c.feed (partial);
        c.feed (withoutId (partial));
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ ids[0] ], 'a replay must not erase the known exchange ID');
        equal (c.notifications (), 1, 'an otherwise unchanged missing-ID replay must be suppressed');
    });
    await scenario ('missing ID then known ID', async (c) => {
        c.feed (withoutId (partial));
        equal ((await c.read ())[0]['id'], undefined, 'do not synthesize the initially missing ID');
        c.feed (partial);
        c.feed (partial);
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ ids[0] ], 'ID enrichment must update the same cached execution');
        equal (c.notifications (), 2, 'enrichment is one update, its replay is not');
    });
    await scenario ('normalized cumulative quantity', async (c) => {
        c.feed (withoutId (frame ({ 'z': '1.000' })));
        c.feed (withoutId (frame ({ 'z': 1 })));
        equal ((await c.read ()).length, 1, 'equivalent string/numeric quantities identify one execution');
        equal (c.notifications (), 1, 'raw numeric formatting alone must not re-emit');
    });
    await scenario ('bounded retention', async (c) => {
        const orders = [ order, otherOrder, '230000000000000003' ];
        for (const id of orders) c.feed (withoutId (frame ({ 'i': id })));
        equal ((await c.read ()).map ((trade: any) => trade['order']), orders.slice (1), 'eviction must retain the latest two unidentified fills');
        c.feed (withoutId (partial));
        equal ((await c.read ()).map ((trade: any) => trade['order']), [ orders[2], order ], 'an evicted fill is outside the deduplication window');
    }, { 'limit': 2 });
    await scenario ('incomplete and zero partial fields', async (c) => {
        for (const field of [ 'l', 'L' ]) {
            const missing = structuredClone (partial);
            delete (missing['o'] as any)[field];
            c.feed (missing);
            c.feed (frame ({ [field]: '0' }));
            c.feed (frame ({ [field]: '-1' }));
        }
        equal (c.notifications (), 0, 'partial trades require both positive last-fill fields');
        const legacy = structuredClone (final);
        delete (legacy['o'] as any)['l'];
        delete (legacy['o'] as any)['L'];
        c.feed (legacy);
        const rows = await c.read ();
        equal ([ rows[0]['amount'], rows[0]['price'] ], [ 5, 100 ], 'legacy final parsing must remain unchanged');
    });
    await scenario ('public filtering', async (c) => {
        c.feed (partial);
        c.feed (nextPartial);
        c.feed (frame ({ 's': 'BTC-USDT', 'i': otherOrder, 't': ids[2], 'T': timestamp + 30 }));
        equal ((await c.all ()).length, 3, 'global output must contain all trades, not wrappers');
        equal ((await c.read (symbol, timestamp + 20, 1)).map ((trade: any) => trade['id']), [ ids[1] ], 'symbol/since/limit must filter actual trade fields');
        equal ((await c.read (secondSymbol)).map ((trade: any) => trade['id']), [ ids[2] ], 'a second symbol must have independent output');
    });
    await scenario ('independent newUpdates scopes', async (c) => {
        c.feed (partial);
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ ids[0] ], 'first symbol update');
        c.feed (nextPartial);
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ ids[1] ], 'second symbol poll returns only the new fill');
        c.feed (frame ({ 's': 'BTC-USDT', 'i': otherOrder, 't': '9007199254741004', 'T': timestamp + 25 }));
        equal ((await c.all ()).length, 3, 'symbol polls must not consume the global scope');
        c.feed (final);
        equal ((await c.all ()).map ((trade: any) => trade['id']), [ ids[2] ], 'global scope must reset on the next append');
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ ids[2] ], 'global poll must not consume the symbol scope');
    }, { 'newUpdates': true });
    await scenario ('spot and linear coexist', async (c) => {
        c.feed (withoutId (partial));
        const spot = { 'dataType': 'spot.executionReport', 'data': { ...partial['o'], 'e': 'executionReport', 'q': '1', 'p': '90', 'X': 'FILLED', 't': '123456' } };
        c.feed (spot);
        c.feed (spot);
        equal ((await c.read ('LTC/USDT', undefined, undefined, 'spot')).map ((trade: any) => trade['id']), [ '123456' ], 'spot ID cache behavior must remain unchanged');
        equal (c.notifications ('spot'), 2, 'spot notification behavior must remain unchanged');
        equal ((await c.read ()).map ((trade: any) => trade['id']), [ undefined ], 'linear wrappers must not collide with spot rows');
    });
    await scenario ('unidentifiable events', async (c) => {
        const message = withoutId (partial);
        delete message['o']['i'];
        delete message['o']['z'];
        c.feed (message);
        c.feed (message);
        const rows = await c.read ();
        equal (rows.length, 2, 'insufficient identity must not silently merge potentially distinct fills');
        equal (rows.map ((trade: any) => [ trade['id'], trade['order'] ]), [ [ undefined, undefined ], [ undefined, undefined ] ], 'no exchange identity may be invented');
    });
    await scenario ('changed unified data', async (c) => {
        c.feed (partial);
        c.feed (frame ({ 'L': '91', 'n': '-0.091' }));
        const rows = await c.read ();
        equal (rows.length, 1, 'a correction must reuse the same cache entry');
        equal ([ rows[0]['price'], rows[0]['cost'], rows[0]['fee']['cost'] ], [ 91, 91, 0.091 ], 'corrected unified values must replace the old values');
        equal (c.notifications (), 2, 'changed unified data must be delivered');
    });
    return { cases, checks };
}

export default testBingxPartialExecutions;
