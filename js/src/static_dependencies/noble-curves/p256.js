/*! noble-curves - MIT License (c) 2022 Paul Miller (paulmillr.com) */
import { createCurve } from './_shortw_utils.js';
import { sha256 } from '../noble-hashes/sha256.js';
import { Fp as Field } from './abstract/modular.js';
import { mapToCurveSimpleSWU } from './abstract/weierstrass.js';
import * as htf from './abstract/hash-to-curve.js';
// NIST secp256r1 aka P256
// https://www.secg.org/sec2-v2.pdf, https://neuromancer.sk/std/nist/P-256
// Field over which we'll do calculations; 2n**224n * (2n**32n-1n) + 2n**192n + 2n**96n-1n
const Fp = Field(BigInt('0xffffffff00000001000000000000000000000000ffffffffffffffffffffffff'));
const CURVE_A = Fp.create(BigInt('-3'));
const CURVE_B = BigInt('0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604b');
const mapSWU = mapToCurveSimpleSWU(Fp, {
    A: CURVE_A,
    B: CURVE_B,
    Z: Fp.create(BigInt('-10')),
});
export const P256 = createCurve({
    // Params: a, b
    a: CURVE_A,
    b: CURVE_B,
    Fp,
    // Curve order, total count of valid points in the field
    n: BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551'),
    // Base point (x, y) aka generator point
    Gx: BigInt('0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296'),
    Gy: BigInt('0x4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5'),
    h: BigInt(1),
    lowS: false,
}, sha256);
export const secp256r1 = P256;
const { hashToCurve, encodeToCurve } = htf.createHasher(secp256r1.ProjectivePoint, (scalars) => mapSWU(scalars[0]), {
    DST: 'P256_XMD:SHA-256_SSWU_RO_',
    encodeDST: 'P256_XMD:SHA-256_SSWU_NU_',
    p: Fp.ORDER,
    m: 1,
    k: 128,
    expand: 'xmd',
    hash: sha256,
});
export { hashToCurve, encodeToCurve };
