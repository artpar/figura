/**
 * clipLibrary.js — Manages BVH source data as parsed low-level DSL keyframes.
 *
 * Contract: register parsed keyframe data by name, extract time-range slices.
 */

export function create() {
  const store = new Map();

  return {
    register(name, parsed) {
      store.set(name, parsed);
    },

    extract(name, startTime, endTime) {
      const parsed = store.get(name);
      if (!parsed) throw new Error(`Source "${name}" not registered`);

      const keyframes = [];
      for (const kf of parsed.keyframes) {
        if (kf.time >= startTime - 1e-6 && kf.time <= endTime + 1e-6) {
          keyframes.push({
            time: kf.time - startTime,
            bones: kf.bones,
          });
        }
      }

      return {
        duration: endTime - startTime,
        keyframes,
      };
    },

    duration(name) {
      const parsed = store.get(name);
      if (!parsed) throw new Error(`Source "${name}" not registered`);
      return parsed.duration;
    },

    has(name) {
      return store.has(name);
    },

    sources() {
      return [...store.keys()];
    },
  };
}
