import assert from 'assert';
import Precise from '../../../base/Precise.js';
import testSharedMethods from './test.sharedMethods.js';
function testMarket(exchange, skippedProperties, method, market) {
    const format = {
        'id': 'btcusd',
        'symbol': 'BTC/USD',
        'base': 'BTC',
        'quote': 'USD',
        'taker': exchange.parseNumber('0.0011'),
        'maker': exchange.parseNumber('0.0009'),
        'baseId': 'btc',
        'quoteId': 'usd',
        'active': false,
        'type': 'spot',
        'linear': false,
        'inverse': false,
        'spot': false,
        'swap': false,
        'future': false,
        'option': false,
        'margin': false,
        'contract': false,
        'contractSize': exchange.parseNumber('0.001'),
        'expiry': 1656057600000,
        'expiryDatetime': '2022-06-24T08:00:00.000Z',
        'optionType': 'put',
        'strike': exchange.parseNumber('56000'),
        'settle': 'XYZ',
        'settleId': 'Xyz',
        'precision': {
            // todo : handle precision types after another PR is merged
            'price': exchange.parseNumber('0.001'),
            'amount': exchange.parseNumber('0.001'),
            'cost': exchange.parseNumber('0.001'), // integer or fraction
        },
        // value limits when placing orders on this market
        'limits': {
            'amount': {
                'min': exchange.parseNumber('0.01'),
                'max': exchange.parseNumber('1000'), // order amount should be < max
            },
            'price': {
                'min': exchange.parseNumber('0.01'),
                'max': exchange.parseNumber('1000'), // order price should be < max
            },
            // order cost = price * amount
            'cost': {
                'min': exchange.parseNumber('0.01'),
                'max': exchange.parseNumber('1000'), // order cost should be < max
            },
        },
        'marginModes': {
            'cross': true,
            'isolated': false,
        },
        'info': {},
    };
    const emptyAllowedFor = ['linear', 'inverse', 'settle', 'settleId', 'expiry', 'expiryDatetime', 'optionType', 'strike', 'margin', 'contractSize'];
    testSharedMethods.assertStructure(exchange, skippedProperties, method, market, format, emptyAllowedFor);
    testSharedMethods.assertSymbol(exchange, skippedProperties, method, market, 'symbol');
    const logText = testSharedMethods.logTemplate(exchange, method, market);
    //
    const validTypes = ['spot', 'margin', 'swap', 'future', 'option', 'index', 'other'];
    testSharedMethods.assertInArray(exchange, skippedProperties, method, market, 'type', validTypes);
    const hasIndex = ('index' in market); // todo: add in all
    // check if string is consistent with 'type'
    if (market['spot']) {
        assert(market['type'] === 'spot', '"type" string should be "spot" when spot is true' + logText);
    }
    else if (market['swap']) {
        assert(market['type'] === 'swap', '"type" string should be "swap" when swap is true' + logText);
    }
    else if (market['future']) {
        assert(market['type'] === 'future', '"type" string should be "future" when future is true' + logText);
    }
    else if (market['option']) {
        assert(market['type'] === 'option', '"type" string should be "option" when option is true' + logText);
    }
    else if (hasIndex && market['index']) {
        // todo: add index in all implementations
        assert(market['type'] === 'index', '"type" string should be "index" when index is true' + logText);
    }
    // margin check (todo: add margin as mandatory, instead of undefined)
    if (market['spot']) {
        // for spot market, 'margin' can be either true/false or undefined
        testSharedMethods.assertInArray(exchange, skippedProperties, method, market, 'margin', [true, false, undefined]);
    }
    else {
        // otherwise, it must be false or undefined
        testSharedMethods.assertInArray(exchange, skippedProperties, method, market, 'margin', [false, undefined]);
    }
    if (!('contractSize' in skippedProperties)) {
        if (!market['spot']) {
            // if not spot, then contractSize should be defined
            assert(market['contractSize'] !== undefined, '"contractSize" must be defined when "spot" is false' + logText);
        }
        testSharedMethods.assertGreater(exchange, skippedProperties, method, market, 'contractSize', '0');
    }
    // typical values
    testSharedMethods.assertGreater(exchange, skippedProperties, method, market, 'expiry', '0');
    testSharedMethods.assertGreater(exchange, skippedProperties, method, market, 'strike', '0');
    testSharedMethods.assertInArray(exchange, skippedProperties, method, market, 'optionType', ['put', 'call']);
    testSharedMethods.assertGreater(exchange, skippedProperties, method, market, 'taker', '-100');
    testSharedMethods.assertGreater(exchange, skippedProperties, method, market, 'maker', '-100');
    // 'contract' boolean check
    if (market['future'] || market['swap'] || market['option'] || (hasIndex && market['index'])) {
        // if it's some kind of contract market, then `conctract` should be true
        assert(market['contract'], '"contract" must be true when "future", "swap", "option" or "index" is true' + logText);
    }
    else {
        assert(!market['contract'], '"contract" must be false when neither "future", "swap","option" or "index" is true' + logText);
    }
    const isSwapOrFuture = market['swap'] || market['future'];
    const contractSize = exchange.safeString(market, 'contractSize');
    // contract fields
    if (market['contract']) {
        // linear & inverse should have different values (true/false)
        // todo: expand logic on other market types
        if (isSwapOrFuture) {
            assert(market['linear'] !== market['inverse'], 'market linear and inverse must not be the same' + logText);
            if (!('contractSize' in skippedProperties)) {
                // contract size should be defined
                assert(contractSize !== undefined, '"contractSize" must be defined when "contract" is true' + logText);
                // contract size should be above zero
                assert(Precise.stringGt(contractSize, '0'), '"contractSize" must be > 0 when "contract" is true' + logText);
            }
            if (!('settle' in skippedProperties)) {
                // settle should be defined
                assert((market['settle'] !== undefined) && (market['settleId'] !== undefined), '"settle" & "settleId" must be defined when "contract" is true' + logText);
            }
        }
        // spot should be false
        assert(!market['spot'], '"spot" must be false when "contract" is true' + logText);
    }
    else {
        // linear & inverse needs to be undefined
        assert((market['linear'] === undefined) && (market['inverse'] === undefined), 'market linear and inverse must be undefined when "contract" is false' + logText);
        // contract size should be undefined
        if (!('contractSize' in skippedProperties)) {
            assert(contractSize === undefined, '"contractSize" must be undefined when "contract" is false' + logText);
        }
        // settle should be undefined
        assert((market['settle'] === undefined) && (market['settleId'] === undefined), '"settle" must be undefined when "contract" is false' + logText);
        // spot should be true
        assert(market['spot'], '"spot" must be true when "contract" is false' + logText);
    }
    // option fields
    if (market['option']) {
        // if option, then strike and optionType should be defined
        assert(market['strike'] !== undefined, '"strike" must be defined when "option" is true' + logText);
        assert(market['optionType'] !== undefined, '"optionType" must be defined when "option" is true' + logText);
    }
    else {
        // if not option, then strike and optionType should be undefined
        assert(market['strike'] === undefined, '"strike" must be undefined when "option" is false' + logText);
        assert(market['optionType'] === undefined, '"optionType" must be undefined when "option" is false' + logText);
    }
    // future, swap and option should be mutually exclusive
    if (market['future']) {
        assert(!market['swap'] && !market['option'], 'market swap and option must be false when "future" is true' + logText);
    }
    else if (market['swap']) {
        assert(!market['future'] && !market['option'], 'market future and option must be false when "swap" is true' + logText);
    }
    else if (market['option']) {
        assert(!market['future'] && !market['swap'], 'market future and swap must be false when "option" is true' + logText);
    }
    // expiry field
    if (market['future'] || market['option']) {
        // future or option markets need 'expiry' and 'expiryDatetime'
        assert(market['expiry'] !== undefined, '"expiry" must be defined when "future" is true' + logText);
        assert(market['expiryDatetime'] !== undefined, '"expiryDatetime" must be defined when "future" is true' + logText);
        // expiry datetime should be correct
        const isoString = exchange.iso8601(market['expiry']);
        assert(market['expiryDatetime'] === isoString, 'expiryDatetime ("' + market['expiryDatetime'] + '") must be equal to expiry in iso8601 format "' + isoString + '"' + logText);
    }
    else {
        // otherwise, they need to be undefined
        assert((market['expiry'] === undefined) && (market['expiryDatetime'] === undefined), '"expiry" and "expiryDatetime" must be undefined when it is not future|option market' + logText);
    }
    // check precisions
    if (!('precision' in skippedProperties)) {
        const precisionKeys = Object.keys(market['precision']);
        const keysLength = precisionKeys.length;
        assert(keysLength >= 2, 'precision should have "amount" and "price" keys at least' + logText);
        for (let i = 0; i < precisionKeys.length; i++) {
            testSharedMethods.checkPrecisionAccuracy(exchange, skippedProperties, method, market['precision'], precisionKeys[i]);
        }
    }
    const isInactiveMarket = market['active'] === false;
    // check limits
    if (!('limits' in skippedProperties)) {
        const limitsKeys = Object.keys(market['limits']);
        const keysLength = limitsKeys.length;
        assert(keysLength >= 3, 'limits should have "amount", "price" and "cost" keys at least' + logText);
        for (let i = 0; i < limitsKeys.length; i++) {
            const key = limitsKeys[i];
            const limitEntry = market['limits'][key];
            if (isInactiveMarket) {
                // for inactive markets, there might be `0` for min & max values, so we skip
                continue;
            }
            // min >= 0
            testSharedMethods.assertGreaterOrEqual(exchange, skippedProperties, method, limitEntry, 'min', '0');
            // max >= 0
            testSharedMethods.assertGreater(exchange, skippedProperties, method, limitEntry, 'max', '0');
            // max >= min
            const minString = exchange.safeString(limitEntry, 'min');
            if (minString !== undefined) {
                testSharedMethods.assertGreaterOrEqual(exchange, skippedProperties, method, limitEntry, 'max', minString);
            }
        }
    }
    // check whether valid currency ID and CODE is used
    if (!('currency' in skippedProperties) && !('currencyIdAndCode' in skippedProperties)) {
        testSharedMethods.assertValidCurrencyIdAndCode(exchange, skippedProperties, method, market, market['baseId'], market['base']);
        testSharedMethods.assertValidCurrencyIdAndCode(exchange, skippedProperties, method, market, market['quoteId'], market['quote']);
        testSharedMethods.assertValidCurrencyIdAndCode(exchange, skippedProperties, method, market, market['settleId'], market['settle']);
    }
    testSharedMethods.assertTimestamp(exchange, skippedProperties, method, market, undefined, 'created');
    // margin modes
    if (!('marginModes' in skippedProperties)) {
        const marginModes = exchange.safeDict(market, 'marginModes'); // in future, remove safeDict
        assert('cross' in marginModes, 'marginModes should have "cross" key' + logText);
        assert('isolated' in marginModes, 'marginModes should have "isolated" key' + logText);
        testSharedMethods.assertInArray(exchange, skippedProperties, method, marginModes, 'cross', [true, false, undefined]);
        testSharedMethods.assertInArray(exchange, skippedProperties, method, marginModes, 'isolated', [true, false, undefined]);
    }
}
export default testMarket;
