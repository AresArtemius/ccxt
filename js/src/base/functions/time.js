// @ts-nocheck
const now = Date.now; // TODO: figure out how to utilize performance.now () properly – it's not as easy as it does not return a unix timestamp...
const microseconds = () => now() * 1000; // TODO: utilize performance.now for that purpose
const milliseconds = now;
const seconds = () => Math.floor(now() / 1000);
const uuidv1 = () => {
    const biasSeconds = 12219292800; // seconds from 15th Oct 1572 to Jan 1st 1970
    const bias = biasSeconds * 10000000; // in hundreds of nanoseconds
    const time = microseconds() * 10 + bias;
    const timeHex = time.toString(16);
    const arranged = timeHex.slice(7, 15) + timeHex.slice(3, 7) + '1' + timeHex.slice(0, 3);
    // these should be random, but we're not making more than 10 requests per microsecond so who cares
    const clockId = '9696'; // a 14 bit number
    const macAddress = 'ff'.repeat(6);
    return arranged + clockId + macAddress;
};
const setTimeout_original = setTimeout;
const setTimeout_safe = (done, ms, setTimeout = setTimeout_original /* overrideable for mocking purposes */, targetTime = now() + ms) => {
    // avoid MAX_INT issue https://github.com/ccxt/ccxt/issues/10761
    if (ms >= 2147483647) {
        throw new Error('setTimeout() function was called with unrealistic value of ' + ms.toString());
    }
    // The built-in setTimeout function can fire its callback earlier than specified, so we
    // need to ensure that it does not happen: sleep recursively until `targetTime` is reached...
    let clearInnerTimeout = () => { };
    let active = true;
    const id = setTimeout(() => {
        active = true;
        const rest = targetTime - now();
        if (rest > 0) {
            clearInnerTimeout = setTimeout_safe(done, rest, setTimeout, targetTime); // try sleep more
        }
        else {
            done();
        }
    }, ms);
    return function clear() {
        if (active) {
            active = false; // dunno if IDs are unique on various platforms, so it's better to rely on this flag to exclude the possible cancellation of the wrong timer (if called after completion)
            clearTimeout(id);
        }
        clearInnerTimeout();
    };
};
class TimedOut extends Error {
    constructor() {
        const message = 'timed out';
        super(message);
        this.constructor = TimedOut;
        // // @ts-expect-error
        this.__proto__ = TimedOut.prototype;
        this.message = message;
    }
}
const iso8601 = (timestamp) => {
    let _timestampNumber = undefined;
    if (typeof timestamp === 'number') {
        _timestampNumber = Math.floor(timestamp);
    }
    else {
        _timestampNumber = parseInt(timestamp, 10);
    }
    // undefined, null and lots of nasty non-numeric values yield NaN
    if (Number.isNaN(_timestampNumber) || _timestampNumber < 0) {
        return undefined;
    }
    // last line of defence
    try {
        return new Date(_timestampNumber).toISOString();
    }
    catch (e) {
        return undefined;
    }
};
const parse8601 = (x) => {
    if (typeof x !== 'string' || !x) {
        return undefined;
    }
    if (x.match(/^[0-9]+$/)) {
        // a valid number in a string, not a date.
        return undefined;
    }
    if (x.indexOf('-') < 0 || x.indexOf(':') < 0) { // no date can be without a dash and a colon
        return undefined;
    }
    // last line of defence
    try {
        const candidate = Date.parse(((x.indexOf('+') >= 0) || (x.slice(-1) === 'Z')) ? x : (x + 'Z').replace(/\s(\d\d):/, 'T$1:'));
        if (Number.isNaN(candidate)) {
            return undefined;
        }
        return candidate;
    }
    catch (e) {
        return undefined;
    }
};
const parseDate = (x) => {
    if (typeof x !== 'string' || !x) {
        return undefined;
    }
    if (x.indexOf('GMT') >= 0) {
        try {
            return Date.parse(x);
        }
        catch (e) {
            return undefined;
        }
    }
    return parse8601(x);
};
const rfc2616 = (timestamp = undefined) => new Date(timestamp).toUTCString();
const mdy = (timestamp, infix = '-') => {
    infix = infix || '';
    const date = new Date(timestamp);
    const Y = date.getUTCFullYear().toString();
    let m = date.getUTCMonth() + 1;
    let d = date.getUTCDate();
    m = m < 10 ? ('0' + m) : m.toString();
    d = d < 10 ? ('0' + d) : d.toString();
    return m + infix + d + infix + Y;
};
const ymd = (timestamp, infix, fullYear = true) => {
    infix = infix || '';
    const date = new Date(timestamp);
    const intYear = date.getUTCFullYear();
    const year = fullYear ? intYear : (intYear - 2000);
    const Y = year.toString();
    let m = date.getUTCMonth() + 1;
    let d = date.getUTCDate();
    m = m < 10 ? ('0' + m) : m.toString();
    d = d < 10 ? ('0' + d) : d.toString();
    return Y + infix + m + infix + d;
};
const yymmdd = (timestamp, infix = '') => ymd(timestamp, infix, false);
const yyyymmdd = (timestamp, infix = '-') => ymd(timestamp, infix, true);
const ymdhms = (timestamp, infix = ' ') => {
    const date = new Date(timestamp);
    const Y = date.getUTCFullYear();
    let m = date.getUTCMonth() + 1;
    let d = date.getUTCDate();
    let H = date.getUTCHours();
    let M = date.getUTCMinutes();
    let S = date.getUTCSeconds();
    m = m < 10 ? ('0' + m) : m;
    d = d < 10 ? ('0' + d) : d;
    H = H < 10 ? ('0' + H) : H;
    M = M < 10 ? ('0' + M) : M;
    S = S < 10 ? ('0' + S) : S;
    return Y + '-' + m + '-' + d + infix + H + ':' + M + ':' + S;
};
const sleep = (ms) => new Promise((resolve) => setTimeout_safe(resolve, ms));
const timeout = async (ms, promise) => {
    let clear = () => { };
    const expires = new Promise((resolve) => (clear = setTimeout_safe(resolve, ms)));
    try {
        return await Promise.race([promise, expires.then(() => {
                throw new TimedOut();
            })]);
    }
    finally {
        clear(); // fixes https://github.com/ccxt/ccxt/issues/749
    }
};
export { now, microseconds, milliseconds, seconds, iso8601, parse8601, rfc2616, uuidv1, parseDate, mdy, ymd, yymmdd, yyyymmdd, ymdhms, setTimeout_safe, sleep, TimedOut, timeout, };
