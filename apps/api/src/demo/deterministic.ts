export interface DemoRandom {
  float(): number;
  integer(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
  uuid(namespace: string): string;
}

function hashText(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193) >>> 0;
    second = Math.imul(second ^ code, 0x85ebca6b) >>> 0;
  }

  const raw = `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
  return `${raw}${raw}`;
}

export function createDeterministicRandom(seed: number): DemoRandom {
  if (!Number.isSafeInteger(seed)) {
    throw new Error("Demo random seed must be a safe integer");
  }

  let state = seed >>> 0;
  const namespaceCounters = new Map<string, number>();

  const float = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    float,
    integer(min, max) {
      if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
        throw new Error("Demo random integer bounds must be ordered safe integers");
      }
      return Math.floor(float() * (max - min + 1)) + min;
    },
    pick<T>(items: readonly T[]) {
      if (items.length === 0) {
        throw new Error("Demo random selection requires at least one item");
      }
      return items[Math.floor(float() * items.length)]!;
    },
    chance(probability) {
      if (probability < 0 || probability > 1) {
        throw new Error("Demo random probability must be between 0 and 1");
      }
      return float() < probability;
    },
    uuid(namespace) {
      const counter = namespaceCounters.get(namespace) ?? 0;
      namespaceCounters.set(namespace, counter + 1);
      const hash = hashText(`${seed}:${namespace}:${counter}`);
      return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
    },
  };
}
