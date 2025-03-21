'use strict';

var bitfinex1$1 = require('../bitfinex1.js');
var errors = require('../base/errors.js');
var Cache = require('../base/ws/Cache.js');
var Precise = require('../base/Precise.js');
var sha512 = require('../static_dependencies/noble-hashes/sha512.js');

//  ---------------------------------------------------------------------------
//  ---------------------------------------------------------------------------
class bitfinex1 extends bitfinex1$1 {
    describe() {
        return this.deepExtend(super.describe(), {
            'has': {
                'ws': true,
                'watchTicker': true,
                'watchTickers': false,
                'watchOrderBook': true,
                'watchTrades': true,
                'watchTradesForSymbols': false,
                'watchBalance': false,
                'watchOHLCV': false, // missing on the exchange side in v1
            },
            'urls': {
                'api': {
                    'ws': {
                        'public': 'wss://api-pub.bitfinex.com/ws/1',
                        'private': 'wss://api.bitfinex.com/ws/1',
                    },
                },
            },
            'options': {
                'watchOrderBook': {
                    'prec': 'P0',
                    'freq': 'F0',
                },
                'ordersLimit': 1000,
            },
        });
    }
    async subscribe(channel, symbol, params = {}) {
        await this.loadMarkets();
        const market = this.market(symbol);
        const marketId = market['id'];
        const url = this.urls['api']['ws']['public'];
        const messageHash = channel + ':' + marketId;
        // const channel = 'trades';
        const request = {
            'event': 'subscribe',
            'channel': channel,
            'symbol': marketId,
            'messageHash': messageHash,
        };
        return await this.watch(url, messageHash, this.deepExtend(request, params), messageHash);
    }
    /**
     * @method
     * @name bitfinex1#watchTrades
     * @description get the list of most recent trades for a particular symbol
     * @see https://docs.bitfinex.com/v1/reference/ws-public-trades
     * @param {string} symbol unified symbol of the market to fetch trades for
     * @param {int} [since] timestamp in ms of the earliest trade to fetch
     * @param {int} [limit] the maximum amount of trades to fetch
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object[]} a list of [trade structures]{@link https://docs.ccxt.com/#/?id=public-trades}
     */
    async watchTrades(symbol, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        symbol = this.symbol(symbol);
        const trades = await this.subscribe('trades', symbol, params);
        if (this.newUpdates) {
            limit = trades.getLimit(symbol, limit);
        }
        return this.filterBySinceLimit(trades, since, limit, 'timestamp', true);
    }
    /**
     * @method
     * @name bitfinex1#watchTicker
     * @description watches a price ticker, a statistical calculation with the information calculated over the past 24 hours for a specific market
     * @see https://docs.bitfinex.com/v1/reference/ws-public-ticker
     * @param {string} symbol unified symbol of the market to fetch the ticker for
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} a [ticker structure]{@link https://docs.ccxt.com/#/?id=ticker-structure}
     */
    async watchTicker(symbol, params = {}) {
        return await this.subscribe('ticker', symbol, params);
    }
    handleTrades(client, message, subscription) {
        //
        // initial snapshot
        //
        //     [
        //         2,
        //         [
        //             [ null, 1580565020, 9374.9, 0.005 ],
        //             [ null, 1580565004, 9374.9, 0.005 ],
        //             [ null, 1580565003, 9374.9, 0.005 ],
        //         ]
        //     ]
        //
        // when a trade does not have an id yet
        //
        //     // channel id, update type, seq, time, price, amount
        //     [ 2, "te", "28462857-BTCUSD", 1580565041, 9374.9, 0.005 ],
        //
        // when a trade already has an id
        //
        //     // channel id, update type, seq, trade id, time, price, amount
        //     [ 2, "tu", "28462857-BTCUSD", 413357662, 1580565041, 9374.9, 0.005 ]
        //
        const channel = this.safeValue(subscription, 'channel');
        const marketId = this.safeString(subscription, 'pair');
        const messageHash = channel + ':' + marketId;
        const tradesLimit = this.safeInteger(this.options, 'tradesLimit', 1000);
        const market = this.safeMarket(marketId);
        const symbol = market['symbol'];
        const data = this.safeValue(message, 1);
        let stored = this.safeValue(this.trades, symbol);
        if (stored === undefined) {
            stored = new Cache.ArrayCache(tradesLimit);
            this.trades[symbol] = stored;
        }
        if (Array.isArray(data)) {
            const trades = this.parseTrades(data, market);
            for (let i = 0; i < trades.length; i++) {
                stored.append(trades[i]);
            }
        }
        else {
            const second = this.safeString(message, 1);
            if (second !== 'tu') {
                return;
            }
            const trade = this.parseTrade(message, market);
            stored.append(trade);
        }
        client.resolve(stored, messageHash);
    }
    parseTrade(trade, market = undefined) {
        //
        // snapshot trade
        //
        //     // null, time, price, amount
        //     [ null, 1580565020, 9374.9, 0.005 ],
        //
        // when a trade does not have an id yet
        //
        //     // channel id, update type, seq, time, price, amount
        //     [ 2, "te", "28462857-BTCUSD", 1580565041, 9374.9, 0.005 ],
        //
        // when a trade already has an id
        //
        //     // channel id, update type, seq, trade id, time, price, amount
        //     [ 2, "tu", "28462857-BTCUSD", 413357662, 1580565041, 9374.9, 0.005 ]
        //
        if (!Array.isArray(trade)) {
            return super.parseTrade(trade, market);
        }
        const tradeLength = trade.length;
        const event = this.safeString(trade, 1);
        let id = undefined;
        if (event === 'tu') {
            id = this.safeString(trade, tradeLength - 4);
        }
        const timestamp = this.safeTimestamp(trade, tradeLength - 3);
        const price = this.safeString(trade, tradeLength - 2);
        let amount = this.safeString(trade, tradeLength - 1);
        let side = undefined;
        if (amount !== undefined) {
            side = Precise["default"].stringGt(amount, '0') ? 'buy' : 'sell';
            amount = Precise["default"].stringAbs(amount);
        }
        const seq = this.safeString(trade, 2);
        const parts = seq.split('-');
        let marketId = this.safeString(parts, 1);
        if (marketId !== undefined) {
            marketId = marketId.replace('t', '');
        }
        const symbol = this.safeSymbol(marketId, market);
        const takerOrMaker = undefined;
        const orderId = undefined;
        return this.safeTrade({
            'info': trade,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'symbol': symbol,
            'id': id,
            'order': orderId,
            'type': undefined,
            'takerOrMaker': takerOrMaker,
            'side': side,
            'price': price,
            'amount': amount,
            'cost': undefined,
            'fee': undefined,
        });
    }
    handleTicker(client, message, subscription) {
        //
        //     [
        //         2,             // 0 CHANNEL_ID integer Channel ID
        //         236.62,        // 1 BID float Price of last highest bid
        //         9.0029,        // 2 BID_SIZE float Size of the last highest bid
        //         236.88,        // 3 ASK float Price of last lowest ask
        //         7.1138,        // 4 ASK_SIZE float Size of the last lowest ask
        //         -1.02,         // 5 DAILY_CHANGE float Amount that the last price has changed since yesterday
        //         0,             // 6 DAILY_CHANGE_PERC float Amount that the price has changed expressed in percentage terms
        //         236.52,        // 7 LAST_PRICE float Price of the last trade.
        //         5191.36754297, // 8 VOLUME float Daily volume
        //         250.01,        // 9 HIGH float Daily high
        //         220.05,        // 10 LOW float Daily low
        //     ]
        //
        const marketId = this.safeString(subscription, 'pair');
        const symbol = this.safeSymbol(marketId);
        const channel = 'ticker';
        const messageHash = channel + ':' + marketId;
        const last = this.safeString(message, 7);
        const change = this.safeString(message, 5);
        let open = undefined;
        if ((last !== undefined) && (change !== undefined)) {
            open = Precise["default"].stringSub(last, change);
        }
        const result = this.safeTicker({
            'symbol': symbol,
            'timestamp': undefined,
            'datetime': undefined,
            'high': this.safeString(message, 9),
            'low': this.safeString(message, 10),
            'bid': this.safeString(message, 1),
            'bidVolume': undefined,
            'ask': this.safeString(message, 3),
            'askVolume': undefined,
            'vwap': undefined,
            'open': this.parseNumber(open),
            'close': this.parseNumber(last),
            'last': this.parseNumber(last),
            'previousClose': undefined,
            'change': this.parseNumber(change),
            'percentage': this.safeString(message, 6),
            'average': undefined,
            'baseVolume': this.safeString(message, 8),
            'quoteVolume': undefined,
            'info': message,
        });
        this.tickers[symbol] = result;
        client.resolve(result, messageHash);
    }
    /**
     * @method
     * @name bitfinex1#watchOrderBook
     * @description watches information on open orders with bid (buy) and ask (sell) prices, volumes and other data
     * @see https://docs.bitfinex.com/v1/reference/ws-public-order-books
     * @param {string} symbol unified symbol of the market to fetch the order book for
     * @param {int} [limit] the maximum amount of order book entries to return
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object} A dictionary of [order book structures]{@link https://docs.ccxt.com/#/?id=order-book-structure} indexed by market symbols
     */
    async watchOrderBook(symbol, limit = undefined, params = {}) {
        if (limit !== undefined) {
            if ((limit !== 25) && (limit !== 100)) {
                throw new errors.ExchangeError(this.id + ' watchOrderBook limit argument must be undefined, 25 or 100');
            }
        }
        const options = this.safeValue(this.options, 'watchOrderBook', {});
        const prec = this.safeString(options, 'prec', 'P0');
        const freq = this.safeString(options, 'freq', 'F0');
        const request = {
            // "event": "subscribe", // added in subscribe()
            // "channel": channel, // added in subscribe()
            // "symbol": marketId, // added in subscribe()
            'prec': prec,
            'freq': freq,
            'len': limit, // string, number of price points, '25', '100', default = '25'
        };
        const orderbook = await this.subscribe('book', symbol, this.deepExtend(request, params));
        return orderbook.limit();
    }
    handleOrderBook(client, message, subscription) {
        //
        // first message (snapshot)
        //
        //     [
        //         18691, // channel id
        //         [
        //             [ 7364.8, 10, 4.354802 ], // price, count, size > 0 = bid
        //             [ 7364.7, 1, 0.00288831 ],
        //             [ 7364.3, 12, 0.048 ],
        //             [ 7364.9, 3, -0.42028976 ], // price, count, size < 0 = ask
        //             [ 7365, 1, -0.25 ],
        //             [ 7365.5, 1, -0.00371937 ],
        //         ]
        //     ]
        //
        // subsequent updates
        //
        //     [
        //         30,     // channel id
        //         9339.9, // price
        //         0,      // count
        //         -1,     // size > 0 = bid, size < 0 = ask
        //     ]
        //
        const marketId = this.safeString(subscription, 'pair');
        const symbol = this.safeSymbol(marketId);
        const channel = 'book';
        const messageHash = channel + ':' + marketId;
        const prec = this.safeString(subscription, 'prec', 'P0');
        const isRaw = (prec === 'R0');
        // if it is an initial snapshot
        if (Array.isArray(message[1])) {
            const limit = this.safeInteger(subscription, 'len');
            if (isRaw) {
                // raw order books
                this.orderbooks[symbol] = this.indexedOrderBook({}, limit);
            }
            else {
                // P0, P1, P2, P3, P4
                this.orderbooks[symbol] = this.countedOrderBook({}, limit);
            }
            const orderbook = this.orderbooks[symbol];
            if (isRaw) {
                const deltas = message[1];
                for (let i = 0; i < deltas.length; i++) {
                    const delta = deltas[i];
                    const id = this.safeString(delta, 0);
                    const price = this.safeFloat(delta, 1);
                    const delta2Value = delta[2];
                    const size = (delta2Value < 0) ? -delta2Value : delta2Value;
                    const side = (delta2Value < 0) ? 'asks' : 'bids';
                    const bookside = orderbook[side];
                    bookside.storeArray([price, size, id]);
                }
            }
            else {
                const deltas = message[1];
                for (let i = 0; i < deltas.length; i++) {
                    const delta = deltas[i];
                    const delta2 = delta[2];
                    const size = (delta2 < 0) ? -delta2 : delta2;
                    const side = (delta2 < 0) ? 'asks' : 'bids';
                    const countedBookSide = orderbook[side];
                    countedBookSide.storeArray([delta[0], size, delta[1]]);
                }
            }
            client.resolve(orderbook, messageHash);
        }
        else {
            const orderbook = this.orderbooks[symbol];
            if (isRaw) {
                const id = this.safeString(message, 1);
                const price = this.safeString(message, 2);
                const message3 = message[3];
                const size = (message3 < 0) ? -message3 : message3;
                const side = (message3 < 0) ? 'asks' : 'bids';
                const bookside = orderbook[side];
                // price = 0 means that you have to remove the order from your book
                const amount = Precise["default"].stringGt(price, '0') ? size : '0';
                bookside.storeArray([this.parseNumber(price), this.parseNumber(amount), id]);
            }
            else {
                const message3Value = message[3];
                const size = (message3Value < 0) ? -message3Value : message3Value;
                const side = (message3Value < 0) ? 'asks' : 'bids';
                const countedBookSide = orderbook[side];
                countedBookSide.storeArray([message[1], size, message[2]]);
            }
            client.resolve(orderbook, messageHash);
        }
    }
    handleHeartbeat(client, message) {
        //
        // every second (approx) if no other updates are sent
        //
        //     { "event": "heartbeat" }
        //
        const event = this.safeString(message, 'event');
        client.resolve(message, event);
    }
    handleSystemStatus(client, message) {
        //
        // todo: answer the question whether handleSystemStatus should be renamed
        // and unified as handleStatus for any usage pattern that
        // involves system status and maintenance updates
        //
        //     {
        //         "event": "info",
        //         "version": 2,
        //         "serverId": "e293377e-7bb7-427e-b28c-5db045b2c1d1",
        //         "platform": { status: 1 }, // 1 for operative, 0 for maintenance
        //     }
        //
        return message;
    }
    handleSubscriptionStatus(client, message) {
        //
        //     {
        //         "event": "subscribed",
        //         "channel": "book",
        //         "chanId": 67473,
        //         "symbol": "tBTCUSD",
        //         "prec": "P0",
        //         "freq": "F0",
        //         "len": "25",
        //         "pair": "BTCUSD"
        //     }
        //
        const channelId = this.safeString(message, 'chanId');
        client.subscriptions[channelId] = message;
        return message;
    }
    async authenticate(params = {}) {
        const url = this.urls['api']['ws']['private'];
        const client = this.client(url);
        const future = client.future('authenticated');
        const method = 'auth';
        const authenticated = this.safeValue(client.subscriptions, method);
        if (authenticated === undefined) {
            const nonce = this.milliseconds();
            const payload = 'AUTH' + nonce.toString();
            const signature = this.hmac(this.encode(payload), this.encode(this.secret), sha512.sha384, 'hex');
            const request = {
                'apiKey': this.apiKey,
                'authSig': signature,
                'authNonce': nonce,
                'authPayload': payload,
                'event': method,
                'filter': [
                    'trading',
                    'wallet',
                ],
            };
            this.spawn(this.watch, url, method, request, 1);
        }
        return await future;
    }
    handleAuthenticationMessage(client, message) {
        const status = this.safeString(message, 'status');
        if (status === 'OK') {
            // we resolve the future here permanently so authentication only happens once
            const future = this.safeValue(client.futures, 'authenticated');
            future.resolve(true);
        }
        else {
            const error = new errors.AuthenticationError(this.json(message));
            client.reject(error, 'authenticated');
            // allows further authentication attempts
            const method = this.safeString(message, 'event');
            if (method in client.subscriptions) {
                delete client.subscriptions[method];
            }
        }
    }
    async watchOrder(id, symbol = undefined, params = {}) {
        await this.loadMarkets();
        const url = this.urls['api']['ws']['private'];
        await this.authenticate();
        return await this.watch(url, id, undefined, 1);
    }
    /**
     * @method
     * @name bitfinex1#watchOrders
     * @description watches information on multiple orders made by the user
     * @see https://docs.bitfinex.com/v1/reference/ws-auth-order-updates
     * @see https://docs.bitfinex.com/v1/reference/ws-auth-order-snapshots
     * @param {string} symbol unified market symbol of the market orders were made in
     * @param {int} [since] the earliest time in ms to fetch orders for
     * @param {int} [limit] the maximum number of order structures to retrieve
     * @param {object} [params] extra parameters specific to the exchange API endpoint
     * @returns {object[]} a list of [order structures]{@link https://docs.ccxt.com/#/?id=order-structure}
     */
    async watchOrders(symbol = undefined, since = undefined, limit = undefined, params = {}) {
        await this.loadMarkets();
        await this.authenticate();
        if (symbol !== undefined) {
            symbol = this.symbol(symbol);
        }
        const url = this.urls['api']['ws']['private'];
        const orders = await this.watch(url, 'os', undefined, 1);
        if (this.newUpdates) {
            limit = orders.getLimit(symbol, limit);
        }
        return this.filterBySymbolSinceLimit(orders, symbol, since, limit, true);
    }
    handleOrders(client, message, subscription) {
        //
        // order snapshot
        //
        //     [
        //         0,
        //         "os",
        //         [
        //             [
        //                 45287766631,
        //                 "ETHUST",
        //                 -0.07,
        //                 -0.07,
        //                 "EXCHANGE LIMIT",
        //                 "ACTIVE",
        //                 210,
        //                 0,
        //                 "2020-05-16T13:17:46Z",
        //                 0,
        //                 0,
        //                 0
        //             ]
        //         ]
        //     ]
        //
        // order cancel
        //
        //     [
        //         0,
        //         "oc",
        //         [
        //             45287766631,
        //             "ETHUST",
        //             -0.07,
        //             -0.07,
        //             "EXCHANGE LIMIT",
        //             "CANCELED",
        //             210,
        //             0,
        //             "2020-05-16T13:17:46Z",
        //             0,
        //             0,
        //             0,
        //         ]
        //     ]
        //
        const data = this.safeValue(message, 2, []);
        const messageType = this.safeString(message, 1);
        if (messageType === 'os') {
            for (let i = 0; i < data.length; i++) {
                const value = data[i];
                this.handleOrder(client, value);
            }
        }
        else {
            this.handleOrder(client, data);
        }
        if (this.orders !== undefined) {
            client.resolve(this.orders, 'os');
        }
    }
    parseWsOrderStatus(status) {
        const statuses = {
            'ACTIVE': 'open',
            'CANCELED': 'canceled',
        };
        return this.safeString(statuses, status, status);
    }
    handleOrder(client, order) {
        // [ 45287766631,
        //     "ETHUST",
        //     -0.07,
        //     -0.07,
        //     "EXCHANGE LIMIT",
        //     "CANCELED",
        //     210,
        //     0,
        //     "2020-05-16T13:17:46Z",
        //     0,
        //     0,
        //     0 ]
        const id = this.safeString(order, 0);
        const marketId = this.safeString(order, 1);
        const symbol = this.safeSymbol(marketId);
        let amount = this.safeString(order, 2);
        let remaining = this.safeString(order, 3);
        let side = 'buy';
        if (Precise["default"].stringLt(amount, '0')) {
            amount = Precise["default"].stringAbs(amount);
            remaining = Precise["default"].stringAbs(remaining);
            side = 'sell';
        }
        let type = this.safeString(order, 4);
        if (type.indexOf('LIMIT') > -1) {
            type = 'limit';
        }
        else if (type.indexOf('MARKET') > -1) {
            type = 'market';
        }
        const status = this.parseWsOrderStatus(this.safeString(order, 5));
        const price = this.safeString(order, 6);
        const rawDatetime = this.safeString(order, 8);
        const timestamp = this.parse8601(rawDatetime);
        const parsed = this.safeOrder({
            'info': order,
            'id': id,
            'clientOrderId': undefined,
            'timestamp': timestamp,
            'datetime': this.iso8601(timestamp),
            'lastTradeTimestamp': undefined,
            'symbol': symbol,
            'type': type,
            'side': side,
            'price': price,
            'stopPrice': undefined,
            'triggerPrice': undefined,
            'average': undefined,
            'amount': amount,
            'remaining': remaining,
            'filled': undefined,
            'status': status,
            'fee': undefined,
            'cost': undefined,
            'trades': undefined,
        });
        if (this.orders === undefined) {
            const limit = this.safeInteger(this.options, 'ordersLimit', 1000);
            this.orders = new Cache.ArrayCacheBySymbolById(limit);
        }
        const orders = this.orders;
        orders.append(parsed);
        client.resolve(parsed, id);
        return parsed;
    }
    handleMessage(client, message) {
        if (Array.isArray(message)) {
            const channelId = this.safeString(message, 0);
            //
            //     [
            //         1231,
            //         "hb",
            //     ]
            //
            if (message[1] === 'hb') {
                return; // skip heartbeats within subscription channels for now
            }
            const subscription = this.safeValue(client.subscriptions, channelId, {});
            const channel = this.safeString(subscription, 'channel');
            const name = this.safeString(message, 1);
            const methods = {
                'book': this.handleOrderBook,
                // 'ohlc': this.handleOHLCV,
                'ticker': this.handleTicker,
                'trades': this.handleTrades,
                'os': this.handleOrders,
                'on': this.handleOrders,
                'oc': this.handleOrders,
            };
            const method = this.safeValue2(methods, channel, name);
            if (method !== undefined) {
                method.call(this, client, message, subscription);
            }
        }
        else {
            // todo add bitfinex handleErrorMessage
            //
            //     {
            //         "event": "info",
            //         "version": 2,
            //         "serverId": "e293377e-7bb7-427e-b28c-5db045b2c1d1",
            //         "platform": { status: 1 }, // 1 for operative, 0 for maintenance
            //     }
            //
            const event = this.safeString(message, 'event');
            if (event !== undefined) {
                const methods = {
                    'info': this.handleSystemStatus,
                    // 'book': 'handleOrderBook',
                    'subscribed': this.handleSubscriptionStatus,
                    'auth': this.handleAuthenticationMessage,
                };
                const method = this.safeValue(methods, event);
                if (method !== undefined) {
                    method.call(this, client, message);
                }
            }
        }
    }
}

module.exports = bitfinex1;
