import "@testing-library/jest-dom/vitest";

// O Node 22+ expõe um `localStorage` experimental que falha sem --localstorage-file
// e sobrescreve o do jsdom, deixando `globalThis.localStorage` indefinido nos testes.
// Garantimos aqui uma implementação em memória, instalada no Storage.prototype
// para que spies em Storage.prototype.setItem (testes de falha de armazenamento)
// continuem funcionando.
if (!globalThis.localStorage || typeof globalThis.localStorage.clear !== "function") {
  const store = new Map<string, string>();
  Storage.prototype.clear = function () {
    store.clear();
  };
  Storage.prototype.getItem = function (key: string) {
    return store.has(key) ? store.get(key)! : null;
  };
  Storage.prototype.key = function (index: number) {
    return Array.from(store.keys())[index] ?? null;
  };
  Storage.prototype.removeItem = function (key: string) {
    store.delete(key);
  };
  Storage.prototype.setItem = function (key: string, value: string) {
    store.set(key, String(value));
  };
  const localStorageMock: Storage = Object.create(Storage.prototype);
  Object.defineProperty(localStorageMock, "length", {
    configurable: true,
    get() {
      return store.size;
    },
  });
  Object.defineProperty(globalThis, "localStorage", {
    writable: true,
    configurable: true,
    value: localStorageMock,
  });
  Object.defineProperty(window, "localStorage", {
    writable: true,
    configurable: true,
    value: localStorageMock,
  });
}

Object.defineProperty(window, "scrollTo", {
  writable: true,
  value: () => {},
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
