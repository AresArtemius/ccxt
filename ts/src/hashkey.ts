
//  ---------------------------------------------------------------------------

import Exchange from './abstract/hashkey.js';
import { TICK_SIZE } from './base/functions/number.js';
import { } from './base/errors.js';
import type { } from './base/types.js';

//  ---------------------------------------------------------------------------

/**
 * @class hashkey
 * @augments Exchange
 */
export default class hashkey extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'hashkey',
            'name': 'Hashkey Global',
            'countries': [ 'BM' ], // Bermudas
            'version': 'v1',
            'rateLimit': 100,
            'hostname': 'https://global.hashkey.com/en-US',
            'pro': true,
            'certified': true,
            'has': {
                'CORS': true, // todo what means CORS
                'spot': true,
                'margin': false,
                'swap': true,
                'future': false, // todo why false
                'option': false,
                'borrowCrossMargin': false,
                'cancelAllOrders': false,
                'cancelAllOrdersAfter': false,
                'cancelOrder': false,
                'cancelOrders': false,
                'cancelOrdersForSymbols': false,
                'closeAllPositions': false,
                'closePosition': false,
                'createMarketBuyOrderWithCost': false,
                'createMarketSellOrderWithCost': false,
                'createOrder': false,
                'createOrders': false,
                'createOrderWithTakeProfitAndStopLoss': false,
                'createPostOnlyOrder': false,
                'createReduceOnlyOrder': false,
                'createStopLimitOrder': false,
                'createStopLossOrder': false,
                'createStopMarketOrder': false,
                'createStopOrder': false,
                'createTakeProfitOrder': false,
                'createTrailingAmountOrder': false,
                'createTriggerOrder': false,
                'editOrder': false,
                'fetchBalance': false,
                'fetchBorrowInterest': false,
                'fetchBorrowRateHistories': false,
                'fetchBorrowRateHistory': false,
                'fetchCanceledAndClosedOrders': false,
                'fetchCanceledOrders': false,
                'fetchClosedOrder': false,
                'fetchClosedOrders': false,
                'fetchCrossBorrowRate': false,
                'fetchCrossBorrowRates': false,
                'fetchCurrencies': false,
                'fetchDeposit': false,
                'fetchDepositAddress': false,
                'fetchDepositAddresses': false,
                'fetchDepositAddressesByNetwork': false,
                'fetchDeposits': false,
                'fetchDepositWithdrawFee': false,
                'fetchDepositWithdrawFees': false,
                'fetchFundingHistory': false,
                'fetchFundingRate': false,
                'fetchFundingRateHistory': false,
                'fetchFundingRates': false,
                'fetchGreeks': false,
                'fetchIndexOHLCV': false,
                'fetchIsolatedBorrowRate': false,
                'fetchIsolatedBorrowRates': false,
                'fetchLedger': false,
                'fetchLeverage': false,
                'fetchLeverageTiers': false,
                'fetchMarginAdjustmentHistory': false,
                'fetchMarketLeverageTiers': false,
                'fetchMarkets': false,
                'fetchMarkOHLCV': false,
                'fetchMyLiquidations': false,
                'fetchMySettlementHistory': false,
                'fetchMyTrades': false,
                'fetchOHLCV': false,
                'fetchOpenInterest': false,
                'fetchOpenInterestHistory': false,
                'fetchOpenOrder': false,
                'fetchOpenOrders': false,
                'fetchOption': false,
                'fetchOptionChain': false,
                'fetchOrder': false,
                'fetchOrderBook': false,
                'fetchOrders': false,
                'fetchOrderTrades': false,
                'fetchPosition': false,
                'fetchPositionHistory': false,
                'fetchPositions': false,
                'fetchPositionsHistory': false,
                'fetchPremiumIndexOHLCV': false,
                'fetchSettlementHistory': false,
                'fetchTicker': false,
                'fetchTickers': false,
                'fetchTime': false,
                'fetchTrades': false,
                'fetchTradingFee': false,
                'fetchTradingFees': false,
                'fetchTransactions': false,
                'fetchTransfers': false,
                'fetchUnderlyingAssets': false,
                'fetchVolatilityHistory': false,
                'fetchWithdrawals': false,
                'repayCrossMargin': false,
                'sandbox': false,
                'setLeverage': false,
                'setMarginMode': false,
                'setPositionMode': false,
                'transfer': false,
                'withdraw': false,
            },
            'timeframes': {
                '1m': '1m',
                '3m': '3m',
                '5m': '5m',
                '15m': '15m',
                '30m': '30m',
                '1h': '1h',
                '2h': '2h',
                '4h': '4h',
                '6h': '6h',
                '8h': '8h',
                '12h': '12h',
                '1d': '1d',
                '1w': '1w',
                '1M': '1M',
            },
            'urls': {
                'test': {
                    'public': 'https://api-glb.sim.hashkeydev.com',
                    'private': 'https://api-glb.sim.hashkeydev.com',
                },
                'logo': '',
                'api': {
                    'public': 'https://api-glb.hashkey.com',
                    'private': 'https://api-glb.hashkey.com',
                },
                'www': 'https://global.hashkey.com/en-US',
                'doc': [
                    'https://hashkeyglobal-apidoc.readme.io',
                ],
                'fees': 'https://support.global.hashkey.com/hc/en-us/articles/13199900083612-HashKey-Global-Fee-Structure',
                'referral': '',
            },
            'api': {
                'public': {
                    'get': {
                        'api/v1/exchangeInfo': 1,
                        'quote/v1/depth': 1,
                        'quote/v1/trades': 1,
                        'quote/v1/klines': 1,
                        'quote/v1/ticker/24hr': 1,
                        'quote/v1/ticker/price': 1,
                        'quote/v1/ticker/bookTicker': 1,
                        'quote/v1/depth/merged': 1,
                        'quote/v1/markPrice': 1,
                        'quote/v1/index': 1,
                    },
                },
                'private': {
                    'get': {
                        'api/v1/spot/order': 1,
                        'api/v1/spot/openOrders': 1,
                        'api/v1/spot/tradeOrders': 5,
                        'api/v1/futures/leverage': 1,
                        'api/v1/futures/order': 1,
                        'api/v1/futures/openOrders': 1,
                        'api/v1/futures/userTrades': 1,
                        'api/v1/futures/positions': 1,
                        'api/v1/futures/historyOrders': 1,
                        'api/v1/futures/balance': 1,
                        'api/v1/futures/liquidationAssignStatus': 1,
                        'api/v1/futures/fundingRate': 1,
                        'api/v1/futures/historyFundingRate': 1,
                        'api/v1/futures/riskLimit': 1,
                        'api/v1/futures/commissionRate': 1,
                        'api/v1/futures/getBestOrder': 1,
                        'api/v1/account/vipInfo': 5,
                        'api/v1/account': 5,
                        'api/v1/account/trades': 5,
                        'api/v1/account/type': 5,
                        'api/v1/account/checkApiKey': 1,
                        'api/v1/account/balanceFlow': 5,
                        'api/v1/spot/subAccount/openOrders': 1,
                        'api/v1/spot/subAccount/tradeOrders': 1,
                        'api/v1/subAccount/trades': 1,
                        'api/v1/futures/subAccount/openOrders': 1,
                        'api/v1/futures/subAccount/historyOrders': 1,
                        'api/v1/futures/subAccount/userTrades': 1,
                        'api/v1/account/deposit/address': 1,
                        'api/v1/account/depositOrders': 1,
                        'api/v1/account/withdrawOrders': 5,
                        'api/v1/account/withdraw': 1,
                        'api/v1/ping': 1,
                        'api/v1/time': 1,
                    },
                    'post': {
                        'api/v1/spot/orderTest': 1,
                        'api/v1/spot/order': 1,
                        'api/v1/spot/batchOrders': 1,
                        'api/v1/futures/leverage': 1,
                        'api/v1/futures/order': 1,
                        'api/v1/futures/position/trading-stop': 3,
                        'api/v1/futures/batchOrders': 5,
                        'api/v1/account/assetTransfer': 1,
                        'api/v1/account/authAddress': 1,
                        'api/v1/userDataStream': 1,
                    },
                    'delete': {
                        'api/v1/spot/order': 1,
                        'api/v1/spot/openOrders': 5,
                        'api/v1/spot/cancelOrderByIds': 5,
                        'api/v1/futures/order': 1,
                        'api/v1/futures/batchOrders': 5,
                        'api/v1/futures/cancelOrderByIds': 5,
                    },
                },
            },
            'exceptions': {
                'exact': {
                },
                'broad': {
                },
            },
            'precisionMode': TICK_SIZE,
            'options': {
                'sandboxMode': false,
                'networks': {
                },
                'networksById': {
                },
                'defaultNetwork': 'ERC20',
                'defaultNetworks': {
                    'USDT': 'ERC20',
                },
            },
            'fees': {
                'trading': {
                },
                'funding': {
                },
            },
        });
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        let url = this.implodeHostname (this.urls['api'][api]) + '/' + path;
        if (api === 'public') {
            if (Object.keys (params).length) {
                url += '?' + this.rawencode (params);
            }
        }
        return { 'url': url, 'method': method, 'body': body, 'headers': headers };
    }
}
