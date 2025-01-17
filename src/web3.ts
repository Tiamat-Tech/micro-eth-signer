import { keccak_256 } from '@noble/hashes/sha3';
import { hex } from '@scure/base';
import * as P from 'micro-packed';
// What we're doing with TypeScript compiler here is crazy
export type Bytes = Uint8Array;
export type Option<T> = T | undefined;

// Used by library as interface for network code
export type Web3CallArgs = {
  to?: string;
  from?: string;
  data?: string;
  nonce?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  tag?: number | 'latest' | 'earliest' | 'pending';
};

export type Web3API = {
  ethCall: (args: Web3CallArgs) => Promise<string>;
  estimateGas: (args: Web3CallArgs) => Promise<bigint>;
};

// Utils
export function add0x(hex: string) {
  return /^0x/i.test(hex) ? hex : `0x${hex}`;
}

export function strip0x(hex: string) {
  return hex.replace(/^0x/i, '');
}

export function omit<T extends object, K extends Extract<keyof T, string>>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  let res: any = Object.assign({}, obj);
  for (let key of keys) delete res[key];
  return res;
}

export function zip<A, B>(a: A[], b: B[]): [A, B][] {
  let res: [A, B][] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) res.push([a[i], b[i]]);
  return res;
}

export const PRECISION = 18;
export const Decimal = P.coders.decimal(PRECISION);

// /Utils

function EPad<T>(p: P.CoderType<T>) {
  return P.padLeft(32, p, P.ZeroPad);
}
// Save pointers values next to array. ETH only stuff.
function wrappedArray<T>(len: P.Length, inner: P.CoderType<T>): P.CoderType<T[]> {
  return P.wrap({
    size: typeof len === 'number' && inner.size ? len * inner.size : undefined,
    encodeStream: (w: P.Writer, value: T[]) => {
      w.length(len, value.length);
      w.bytes(P.array(value.length, inner).encode(value));
    },
    decodeStream: (r: P.Reader): T[] =>
      P.array(r.length(len), inner).decodeStream(
        new P.Reader(r.absBytes(r.pos), r.path, r.fieldPath)
      ),
  });
}

const PTR = EPad(P.U32BE);
const ARRAY_RE = /(.+)(\[(\d+)?\])$/;
// Because u32 in eth is not real u32, just U256BE with limits...
const ethInt = (bits: number, signed = false) => {
  if (!Number.isSafeInteger(bits) || bits <= 0 || bits % 8 !== 0 || bits > 256)
    throw new Error('ethInt: invalid numeric type');
  const _bits = BigInt(bits);
  const inner = P.bigint(32, false, signed);
  return P.wrap({
    size: inner.size,
    encodeStream: (w: P.Writer, value: bigint) => {
      const _value = BigInt(value);
      P.checkBounds(w, _value, _bits, !!signed);
      inner.encodeStream(w, BigInt(_value));
    },
    decodeStream: (r: P.Reader): bigint => {
      const value = inner.decodeStream(r);
      P.checkBounds(r, value, _bits, !!signed);
      return value;
    },
  });
};

// Ugly hack, because tuple of pointers considered "dynamic" without any reason.
function isDyn<T>(args: P.CoderType<T>[] | Record<string, P.CoderType<T>>) {
  let res = false;
  if (Array.isArray(args)) {
    for (let arg of args) if (arg.size === undefined) res = true;
  } else {
    for (let arg in args) if (args[arg].size === undefined) res = true;
  }
  return res;
}

// as const returns readonly stuff, remove readonly property
type Writable<T> = T extends {}
  ? {
      -readonly [P in keyof T]: Writable<T[P]>;
    }
  : T;
type ArrLike<T> = Array<T> | ReadonlyArray<T>;
export type Component<T extends string> = {
  readonly name?: string;
  readonly type: T;
};
export type NamedComponent<T extends string> = Component<T> & { readonly name: string };
export type BaseComponent = Component<string>;
export type Tuple<TC extends ArrLike<Component<string>>> = {
  readonly name?: string;
  readonly type: 'tuple';
  readonly components: TC;
};

// Basic type support
// int<M>: two’s complement signed integer type of M bits, 0 < M <= 256, M % 8 == 0.
// prettier-ignore
type IntIdxType = ''    | '8'   | '16'  | '24'  | '32'  | '40'  | '48'  | '56'  |
  '64'  | '72'  | '80'  | '88'  | '96'  | '104' | '112' | '120' | '128' | '136' |
  '144' | '152' | '160' | '168' | '176' | '184' | '192' | '200' | '208' | '216' |
  '224' | '232' | '240' | '248' | '256';
type UintType = `uint${IntIdxType}`;
type IntType = `int${IntIdxType}`;
type NumberType = UintType | IntType;
// bytes<M>: binary type of M bytes, 0 < M <= 32.
// prettier-ignore
type ByteIdxType = '' | '1' | '2'  | '3'  | '4'  | '5'  | '6'  | '7'  | '8'  | '9'  |
  '10' | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20' | '21' |
  '22' | '23' | '24' | '25' | '26' | '27' | '28' | '29' | '30' | '31' | '32';
type ByteType = `bytes${ByteIdxType}`;
// Arrays
// We support fixed size arrays up to bytes[999], 2d up to bytees[39][39]
// 1-9
type DigitsType = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
// 1-39
type ThrityDigits = DigitsType | `${'1' | '2' | '3'}${'0' | DigitsType}`;
// 1-99
type TwoDigits = DigitsType | `${DigitsType}${'0' | DigitsType}`;
// 1-999
type ThreeDigits = TwoDigits | `${TwoDigits}${'0' | DigitsType}`;
// For static 1d arrays: 1-999: string[], string[1], ..., string[999]
type ArrType<T extends string> = `${T}[${'' | ThreeDigits}]`;
// For 2d arrays 1-39 per dimension (99 is too slow, 9k types):
// string[][], string[][1], ..., string[39][39]
type Arr2dType<T extends string> = `${T}[${'' | ThrityDigits}][${'' | ThrityDigits}]`;

// [{name: 'a', type: 'string'}, {name: 'b', type: 'uint'}] -> {a: string, b: bigint};
export type MapTuple<T> = T extends ArrLike<Component<string> & { name: string }>
  ? {
      [K in T[number] as K['name']]: MapType<K>;
    }
  : T extends ArrLike<Component<string>>
    ? // [{name: 'a', type: 'string'}, {type: 'uint'}] -> [string, bigint];
      {
        [K in keyof T]: T[K] extends BaseComponent ? MapType<T[K]> : unknown;
      }
    : unknown;

// prettier-ignore
export type MapType<T extends BaseComponent> =
  T extends Component<'string'> ? string :
  T extends Component<ArrType<'string'>> ? string[] :
  T extends Component<Arr2dType<'string'>> ? string[][] :
  T extends Component<'address'> ? string :
  T extends Component<ArrType<'address'>> ? string[] :
  T extends Component<Arr2dType<'address'>> ? string[][] :
  T extends Component<'bool'> ? boolean :
  T extends Component<ArrType<'bool'>> ? boolean[] :
  T extends Component<Arr2dType<'bool'>> ? boolean[][] :
  T extends Component<NumberType> ? bigint :
  T extends Component<ArrType<NumberType>> ? bigint[] :
  T extends Component<Arr2dType<NumberType>> ? bigint[][] :
  T extends Component<ByteType> ? Bytes :
  T extends Component<ArrType<ByteType>> ? Bytes[] :
  T extends Component<Arr2dType<ByteType>> ? Bytes[][] :
  T extends Tuple<Array<Component<string>>> ? MapTuple<T['components']> :
  // Default
  unknown;

export type UnmapType<T> = T extends MapType<infer U> ? U : never;
// NOTE: we need as const if we want to access string as values inside types :(
export function mapComponent<T extends BaseComponent>(c: T): P.CoderType<MapType<Writable<T>>> {
  // Arrays (should be first one, since recursive)
  let m;
  if ((m = ARRAY_RE.exec(c.type))) {
    const inner = mapComponent({ ...c, type: m[1] });
    if (inner.size === 0)
      throw new Error('mapComponent: arrays of zero-size elements disabled (possible DoS attack)');
    // Static array
    if (m[3] !== undefined) {
      if (!Number.isSafeInteger(+m[3])) throw new Error(`mapComponent: wrong array size=${m[3]}`);
      let out = P.array(+m[3], inner);
      // Static array of dynamic values should be behind pointer too, again without reason.
      if (inner.size === undefined) out = P.pointer(PTR, out);
      return out as any;
    } else {
      // Dynamic array
      return P.pointer(PTR, wrappedArray(P.U256BE, inner)) as any;
    }
  }
  if (c.type === 'tuple') {
    const components: (Component<string> & { name?: string })[] = (c as any).components;
    let hasNames = true;
    const args: P.CoderType<any>[] = [];
    for (let comp of components) {
      if (!comp.name) hasNames = false;
      args.push(mapComponent(comp));
    }
    let out: any;
    // If there is names for all fields -- return struct, otherwise tuple
    if (hasNames) {
      const struct: Record<string, P.CoderType<unknown>> = {};
      for (const arg of components) {
        if (struct[arg.name!]) throw new Error(`mapType: same field name=${arg.name}`);
        struct[arg.name!] = mapComponent(arg);
      }
      out = P.struct(struct);
    } else out = P.tuple(args);
    // If tuple has dynamic elements it becomes dynamic too, without reason.
    if (isDyn(args)) out = P.pointer(PTR, out);
    return out;
  }
  if (c.type === 'string')
    return P.pointer(PTR, P.padRight(32, P.string(P.U256BE), P.ZeroPad)) as any;
  if (c.type === 'bytes')
    return P.pointer(PTR, P.padRight(32, P.bytes(P.U256BE), P.ZeroPad)) as any;
  if (c.type === 'address') return EPad(P.hex(20, false, true)) as any;
  if (c.type === 'bool') return EPad(P.bool) as any;
  if ((m = /^(u?)int([0-9]+)?$/.exec(c.type)))
    return ethInt(m[2] ? +m[2] : 256, m[1] !== 'u') as any;
  if ((m = /^bytes([0-9]{1,2})$/.exec(c.type))) {
    if (!+m[1] || +m[1] > 32) throw new Error('wrong bytes<N> type');
    return P.padRight(32, P.bytes(+m[1]), P.ZeroPad) as any;
  }
  throw new Error(`mapComponent: unknown component=${c}`);
}

// If only one arg -- use as is, otherwise construct tuple by tuple rules
export type ArgsType<T> = T extends [Component<string>]
  ? MapType<T[0]>
  : T extends undefined
    ? 1
    : MapTuple<T>;
// Because args and output are not tuple
// TODO: try merge with mapComponent
export function mapArgs<T extends ArrLike<Component<string>>>(
  args: T
): P.CoderType<ArgsType<Writable<T>>> {
  // More ergonomic input/output
  if (args.length === 1) return mapComponent(args[0] as any) as any;
  let hasNames = true;
  for (const arg of args) if (!arg.name) hasNames = false;
  if (hasNames) {
    const out: Record<string, P.CoderType<unknown>> = {};
    for (const arg of args) {
      const name = (arg as any).name;
      if (out[name]) throw new Error(`mapArgs: same field name=${name}`);
      out[name] = mapComponent(arg as any) as any;
    }
    return P.struct(out) as any;
  } else return P.tuple(args.map(mapComponent)) as any;
}

export type FunctionType = Component<'function'> & {
  readonly inputs?: ReadonlyArray<Component<string>>;
  readonly outputs?: ReadonlyArray<Component<string>>;
};

export type FunctionWithInputs = FunctionType & {
  inputs: ReadonlyArray<Component<string>>;
};

export type FunctionWithOutputs = FunctionType & {
  outputs: ReadonlyArray<Component<string>>;
};

type ContractMethodDecode<
  T extends FunctionType,
  O = ArgsType<T['outputs']>,
> = T extends FunctionWithOutputs
  ? { decodeOutput: (b: Bytes) => O }
  : {
      decodeOutput: (b: Bytes) => void;
    };

type ContractMethodEncode<
  T extends FunctionType,
  I = ArgsType<T['inputs']>,
> = T extends FunctionWithInputs ? { encodeInput: (v: I) => Bytes } : { encodeInput: () => Bytes };

type ContractMethodGas<
  T extends FunctionType,
  I = ArgsType<T['inputs']>,
> = T extends FunctionWithInputs
  ? { estimateGas: (v: I) => Promise<bigint> }
  : { estimateGas: () => Promise<bigint> };

type ContractMethodCall<
  T extends FunctionType,
  I = ArgsType<T['inputs']>,
  O = ArgsType<T['outputs']>,
> = T extends FunctionWithInputs
  ? T extends FunctionWithOutputs
    ? {
        // inputs, outputs
        call: (v: I) => Promise<O>;
      }
    : {
        // inputs, no outputs
        call: (v: I) => Promise<void>;
      }
  : T extends FunctionWithOutputs
    ? {
        // no inputs, outputs
        call: () => Promise<O>;
      }
    : {
        // no inputs, no outputs
        call: () => Promise<void>;
      };

export type ContractMethod<T extends FunctionType> = ContractMethodEncode<T> &
  ContractMethodDecode<T>;

export type ContractMethodNet<T extends FunctionType> = ContractMethod<T> &
  ContractMethodGas<T> &
  ContractMethodCall<T>;

export type FnArg = {
  readonly type: string;
  readonly name?: string;
  readonly components?: ArrLike<FnArg>;
  readonly inputs?: ArrLike<FnArg>;
  readonly outputs?: ArrLike<FnArg>;
  readonly anonymous?: boolean;
  readonly indexed?: boolean;
};

export type ContractTypeFilter<T> = {
  [K in keyof T]: T[K] extends FunctionType & { name: string } ? T[K] : never;
};

export type ContractType<T extends Array<FnArg>, N, F = ContractTypeFilter<T>> = F extends ArrLike<
  FunctionType & { name: string }
>
  ? {
      [K in F[number] as K['name']]: N extends Web3API ? ContractMethodNet<K> : ContractMethod<K>;
    }
  : never;

function fnSignature(o: FnArg): string {
  if (!o.type) throw new Error('ABI.fnSignature wrong argument');
  if (o.type === 'function' || o.type === 'event')
    return `${o.name || 'function'}(${(o.inputs || []).map((i) => fnSignature(i)).join(',')})`;
  if (o.type.startsWith('tuple')) {
    if (!o.components || !o.components.length) throw new Error('ABI.fnSignature wrong tuple');
    return `(${o.components.map((i) => fnSignature(i)).join(',')})${o.type.slice(5)}`;
  }
  return o.type;
}
// Function signature hash
export function evSigHash(o: FnArg): string {
  return hex.encode(keccak_256(fnSignature(o)));
}
export function fnSigHash(o: FnArg): string {
  return evSigHash(o).slice(0, 8);
}

// High-level constructs for common ABI use-cases

/*
Call functions always takes two args: array/obj of input values and overrdides of tx params
output is array/obj too, but if there is single input or output, then they processed as-is without wrapping in array/obj.
if there is at least one named input/output (like (uin256 balance, address)) then it is processed as object, where unnamed elements
is refered by index position. Unfortunately it is impossible to do args/kwargs, since named arguments can be before unnamed one.
*/
export function contract<T extends ArrLike<FnArg>>(
  abi: T,
  net: Web3API,
  contract?: string
): ContractType<Writable<T>, Web3API>;
export function contract<T extends ArrLike<FnArg>>(
  abi: T,
  net?: undefined,
  contract?: string
): ContractType<Writable<T>, undefined>;
export function contract<T extends ArrLike<FnArg>>(
  abi: T,
  net?: Web3API,
  contract?: string
): ContractType<Writable<T>, undefined> {
  // Find non-uniq function names so we can handle overloads
  let nameCnt: Record<string, number> = {};
  for (let fn of abi) {
    if (fn.type !== 'function') continue;
    const name = fn.name || 'function';
    if (!nameCnt[name]) nameCnt[name] = 1;
    else nameCnt[name]++;
  }
  const res: Record<string, any> = {};
  for (let fn of abi) {
    if (fn.type !== 'function') continue;
    let name = fn.name || 'function';
    if (nameCnt[name] > 1) name = fnSignature(fn);
    const sh = fnSigHash(fn);
    const inputs = fn.inputs ? mapArgs(fn.inputs) : undefined;
    const outputs = fn.outputs ? mapArgs(fn.outputs) : undefined;
    const decodeOutput = (b: Bytes) => outputs && outputs.decode(b);
    const encodeInput = (v: unknown) =>
      P.concatBytes(hex.decode(sh), inputs ? inputs.encode(v as any) : new Uint8Array());
    res[name] = { decodeOutput, encodeInput };
    if (!net) continue;
    res[name].call = async (args: unknown, overrides: Web3CallArgs = {}) => {
      const input = encodeInput(args);
      if (!contract && !overrides.to) throw new Error('No contract address');
      return decodeOutput(
        hex.decode(
          strip0x(
            await net.ethCall(
              Object.assign({ to: contract, data: add0x(hex.encode(input)) }, overrides)
            )
          )
        )
      );
    };
    res[name].estimateGas = async (args: unknown, overrides: Web3CallArgs = {}) => {
      const input = encodeInput(args);
      if (!contract && !overrides.to) throw new Error('No contract address');
      return await net.estimateGas(
        Object.assign({ to: contract, data: add0x(hex.encode(input)) }, overrides)
      );
    };
  }
  return res as any;
}

export type EventType = NamedComponent<'event'> & {
  readonly inputs: ReadonlyArray<Component<string>>;
};

export type ContractEventTypeFilter<T> = { [K in keyof T]: T[K] extends EventType ? T[K] : never };

export type TopicsValue<T> = { [K in keyof T]: T[K] | null };

export type EventMethod<T extends EventType> = {
  decode: (topics: string[], data: string) => ArgsType<T['inputs']>;
  topics: (values: TopicsValue<ArgsType<T['inputs']>>) => (string | null)[];
};

export type ContractEventType<
  T extends Array<FnArg>,
  F = ContractEventTypeFilter<T>,
> = F extends ArrLike<EventType>
  ? {
      [K in F[number] as K['name']]: EventMethod<K>;
    }
  : never;

// TODO: try to simplify further
export function events<T extends ArrLike<FnArg>>(abi: T): ContractEventType<Writable<T>> {
  let res: Record<string, any> = {};
  for (let elm of abi) {
    // Only named events supported
    if (elm.type !== 'event' || !elm.name) continue;
    const inputs = elm.inputs || [];
    let hasNames = true;
    for (let i of inputs) if (!i.name) hasNames = false;
    const plainInp = inputs.filter((i) => !i.indexed);
    const indexedInp = inputs.filter((i) => i.indexed);
    const indexed = indexedInp.map((i) =>
      !['string', 'bytes', 'tuple'].includes(i.type) && !ARRAY_RE.exec(i.type)
        ? (mapArgs([i]) as any)
        : null
    );
    const parser = mapArgs(hasNames ? plainInp : plainInp.map((i) => omit(i, 'name'))) as any;
    const sigHash = evSigHash(elm);
    res[elm.name] = {
      decode(topics: string[], _data: string) {
        const data = hex.decode(strip0x(_data));
        if (!elm.anonymous) {
          if (!topics[0]) throw new Error('No signature on non-anonymous event');
          if (strip0x(topics[0]).toLowerCase() !== sigHash) throw new Error('Wrong signature');
          topics = topics.slice(1);
        }
        if (topics.length !== indexed.length) throw new Error('Wrong topics length');
        let parsed = parser ? parser.decode(data) : hasNames ? {} : [];
        const indexedParsed = indexed.map((p, i) =>
          p ? p.decode(hex.decode(strip0x(topics[i]))) : topics[i]
        );
        if (plainInp.length === 1) parsed = hasNames ? { [plainInp[0].name!]: parsed } : [parsed];
        if (hasNames) {
          let res = { ...parsed };
          for (let [a, p] of zip(indexedInp, indexedParsed)) res[a.name!] = p;
          return res;
        } else return inputs.map((i) => (!i.indexed ? parsed : indexedParsed).shift());
      },
      topics(values: any[] | Record<string, any>) {
        let res = [];
        if (!elm.anonymous) res.push(add0x(sigHash));
        // We require all keys to be set, even if they are null, to be sure nothing is accidentaly missed
        if ((hasNames ? Object.keys(values) : values).length !== inputs.length)
          throw new Error('Wrong topics args');
        for (let i = 0, ii = 0; i < inputs.length && ii < indexed.length; i++) {
          const [input, packer] = [inputs[i], indexed[ii]];
          if (!input.indexed) continue;
          const value = (values as any)[Array.isArray(values) ? i : inputs[i].name!];
          if (value === null) {
            res.push(null);
            continue;
          }
          let topic: string;
          if (packer) topic = hex.encode(packer.encode(value));
          else if (['string', 'bytes'].includes(input.type)) topic = hex.encode(keccak_256(value));
          else {
            let m: any, parts: Bytes[];
            if ((m = ARRAY_RE.exec(input.type)))
              parts = value.map((j: any) => mapComponent({ type: m[1] }).encode(j));
            else if (input.type === 'tuple' && input.components)
              parts = input.components.map((j) => (mapArgs([j]) as any).encode(value[j.name!]));
            else throw new Error('Unknown unsized type');
            topic = hex.encode(keccak_256(P.concatBytes(...parts)));
          }
          res.push(add0x(topic));
          ii++;
        }
        return res;
      },
    };
  }
  return res as any;
}

// Same as 'Transaction Action' on Etherscan, provides human readable interpritation of decoded data
export type ContractABI = ReadonlyArray<FnArg & { readonly hint?: HintFn; readonly hook?: HookFn }>;
export type ContractInfo = {
  abi: 'ERC20' | 'ERC721' | ContractABI;
  symbol?: string;
  decimals?: number;
  // For useful common contracts/exchanges
  name?: string;
  // Stable coin price against USD
  price?: number;
};
export type HintOpt = {
  contract?: string;
  amount?: bigint;
  contractInfo?: ContractInfo;
  contracts?: Record<string, ContractInfo>;
};
export type HintFn = (value: unknown, opt: HintOpt) => string;
export type HookFn = (
  decoder: Decoder,
  contract: string,
  info: SignatureInfo,
  opt: HintOpt
) => SignatureInfo;
type SignaturePacker = {
  name: string;
  signature: string;
  packer: P.CoderType<unknown>;
  hint?: HintFn;
  // Modifies decoder output. For multicall calls.
  hook?: HookFn;
};
type EventSignatureDecoder = {
  name: string;
  signature: string;
  decoder: (topics: string[], _data: string) => unknown;
  hint?: HintFn;
};

export type SignatureInfo = { name: string; signature: string; value: unknown; hint?: string };
export class Decoder {
  contracts: Record<string, Record<string, SignaturePacker>> = {};
  sighashes: Record<string, SignaturePacker[]> = {};
  evContracts: Record<string, Record<string, EventSignatureDecoder>> = {};
  evSighashes: Record<string, EventSignatureDecoder[]> = {};
  add(contract: string, abi: ContractABI) {
    const ev: any = events(abi);
    contract = strip0x(contract).toLowerCase();
    if (!this.contracts[contract]) this.contracts[contract] = {};
    if (!this.evContracts[contract]) this.evContracts[contract] = {};
    for (let fn of abi) {
      if (fn.type === 'function') {
        const selector = fnSigHash(fn);
        const value = {
          name: fn.name || 'function',
          signature: fnSignature(fn),
          packer: fn.inputs && fn.inputs.length ? (mapArgs(fn.inputs) as any) : undefined,
          hint: fn.hint,
          hook: fn.hook,
        };
        this.contracts[contract][selector] = value;
        if (!this.sighashes[selector]) this.sighashes[selector] = [];
        this.sighashes[selector].push(value);
      } else if (fn.type === 'event') {
        if (fn.anonymous || !fn.name) continue;
        const selector = evSigHash(fn);
        const value = {
          name: fn.name,
          signature: fnSignature(fn),
          decoder: ev[fn.name]?.decode,
          hint: fn.hint,
        };
        this.evContracts[contract][selector] = value;
        if (!this.evSighashes[selector]) this.evSighashes[selector] = [];
        this.evSighashes[selector].push(value);
      }
    }
  }
  method(contract: string, data: Bytes) {
    contract = strip0x(contract).toLowerCase();
    const sh = hex.encode(data.slice(0, 4));
    if (!this.contracts[contract] || !this.contracts[contract][sh]) return;
    const { name } = this.contracts[contract][sh];
    return name;
  }
  // Returns: exact match, possible options of matches (array) or undefined.
  // Note that empty value possible if there is no arguments in call.
  decode(
    contract: string,
    _data: Bytes,
    opt: HintOpt
  ): SignatureInfo | SignatureInfo[] | undefined {
    contract = strip0x(contract).toLowerCase();
    const sh = hex.encode(_data.slice(0, 4));
    const data = _data.slice(4);
    if (this.contracts[contract] && this.contracts[contract][sh]) {
      let { name, signature, packer, hint, hook } = this.contracts[contract][sh];
      const value = packer ? packer.decode(data) : undefined;
      let res: SignatureInfo = { name, signature, value };
      // NOTE: hint && hook fn is used only on exact match of contract!
      if (hook) res = hook(this, contract, res, opt);
      try {
        if (hint) res.hint = hint(value, Object.assign({ contract: add0x(contract) }, opt));
      } catch (e) {}
      return res;
    }
    if (!this.sighashes[sh] || !this.sighashes[sh].length) return;
    let res: SignatureInfo[] = [];
    for (let { name, signature, packer } of this.sighashes[sh]) {
      try {
        res.push({ name, signature, value: packer ? packer.decode(data) : undefined });
      } catch (err) {}
    }
    if (res.length) return res;
    return;
  }
  decodeEvent(
    contract: string,
    topics: string[],
    data: string,
    opt: HintOpt
  ): SignatureInfo | SignatureInfo[] | undefined {
    contract = strip0x(contract).toLowerCase();
    if (!topics.length) return;
    const sh = strip0x(topics[0]);
    const event = this.evContracts[contract];
    if (event && event[sh]) {
      let { name, signature, decoder, hint } = event[sh];
      const value = decoder(topics, data);
      let res: SignatureInfo = { name, signature, value };
      try {
        if (hint) res.hint = hint(value, Object.assign({ contract: add0x(contract) }, opt));
      } catch (e) {}
      return res;
    }
    if (!this.evSighashes[sh] || !this.evSighashes[sh].length) return;
    let res: SignatureInfo[] = [];
    for (let { name, signature, decoder } of this.evSighashes[sh]) {
      try {
        res.push({ name, signature, value: decoder(topics, data) });
      } catch (err) {}
    }
    if (res.length) return res;
    return;
  }
}
