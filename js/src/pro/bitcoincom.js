//  ---------------------------------------------------------------------------
import hitbtc from './hitbtc.js';
import hitbtcRest from '../hitbtc.js';
import bitcoincomRest from '../bitcoincom.js';
// ---------------------------------------------------------------------------
export default class bitcoincom extends hitbtc {
    describe() {
        // eslint-disable-next-line new-cap
        const describeExtended = this.getDescribeForExtendedWsExchange(new bitcoincomRest(), new hitbtcRest(), super.describe());
        return this.deepExtend(describeExtended, {
            'id': 'bitcoincom',
            'name': 'bitcoin.com',
            'countries': ['KN'],
            'urls': {
                'logo': 'https://user-images.githubusercontent.com/1294454/97296144-514fa300-1861-11eb-952b-3d55d492200b.jpg',
                'api': {
                    'ws': 'wss://api.fmfw.io/api/2/ws',
                },
            },
            'fees': {
                'trading': {
                    'maker': this.parseNumber('0.0015'),
                    'taker': this.parseNumber('0.002'),
                },
            },
        });
    }
}
