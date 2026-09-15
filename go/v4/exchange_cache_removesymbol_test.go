package ccxt

import "testing"

// Mirrors the TS removeSymbol () contract and the exact shape the transpiled
// bingx handler uses: the cache is held as `any` and reached through the
// SymbolRemover interface assertion emitted by build/goTranspiler.ts.
func TestRemoveSymbolRetractsOneKeyOnly(t *testing.T) {
	c := NewArrayCacheBySymbolBySide()
	row := func(symbol string, side string, contracts int) map[string]any {
		return map[string]any{"symbol": symbol, "side": side, "contracts": contracts}
	}
	c.Append(row("ETH/USDT:USDT", "long", 4))
	c.Append(row("ETH/USDT:USDT", "short", 5))
	c.Append(row("LTC/USDT:USDT", "long", 2))

	// drain both poll scopes
	if got := c.GetLimit(nil, nil); got != 3 {
		t.Fatalf("seed: global GetLimit = %v, want 3", got)
	}
	c.GetLimit("ETH/USDT:USDT", nil)
	c.GetLimit("LTC/USDT:USDT", nil)

	// the transpiled call site: `cache.(ccxt.SymbolRemover).RemoveSymbol(symbol)`
	var cache any = c
	remover, ok := cache.(SymbolRemover)
	if !ok {
		t.Fatal("ArrayCacheBySymbolBySide does not satisfy SymbolRemover - the go emit would panic")
	}
	remover.RemoveSymbol("LTC/USDT:USDT")
	c.Append(row("LTC/USDT:USDT", "both", 0))

	if got := c.GetLimit(nil, nil); got != 1 {
		t.Fatalf("global GetLimit = %v, want 1 (only the one-way row is new, ETH must not be re-reported)", got)
	}
	rows := c.ToArray()
	if len(rows) != 3 {
		t.Fatalf("len = %d, want 3 (both ETH sides retained + the new LTC row)", len(rows))
	}
	// retained rows keep their order
	if rows[0].(map[string]any)["side"] != "long" || rows[1].(map[string]any)["side"] != "short" {
		t.Fatalf("retained ETH rows lost their order: %v", rows)
	}
	for _, r := range rows[:2] {
		if r.(map[string]any)["symbol"] != "ETH/USDT:USDT" {
			t.Fatalf("unexpected retained row %v", r)
		}
	}
	if rows[2].(map[string]any)["side"] != "both" {
		t.Fatalf("the one-way row did not replace the previous LTC direction: %v", rows[2])
	}

	// retracting an absent key is a no-op and must not move the counters
	before := c.GetLimit(nil, nil)
	remover.RemoveSymbol("DOGE/USDT:USDT")
	if got := c.GetLimit(nil, nil); got != before {
		t.Fatalf("absent-key retraction moved the global counter: %v -> %v", before, got)
	}
	if len(c.ToArray()) != 3 {
		t.Fatalf("absent-key retraction dropped rows")
	}
}

// The hashmap entry must go too, otherwise the next Append merges into an
// orphaned reference and the row is silently lost.
func TestRemoveSymbolDropsHashmapEntry(t *testing.T) {
	c := NewArrayCacheBySymbolBySide()
	c.Append(map[string]any{"symbol": "LTC/USDT:USDT", "side": "long", "contracts": 2})
	c.RemoveSymbol("LTC/USDT:USDT")
	if _, still := c.Hashmap["LTC/USDT:USDT"]; still {
		t.Fatal("hashmap still claims the retracted symbol")
	}
	c.Append(map[string]any{"symbol": "LTC/USDT:USDT", "side": "both", "contracts": 0})
	rows := c.ToArray()
	if len(rows) != 1 {
		t.Fatalf("re-append after retraction produced %d rows, want 1", len(rows))
	}
	if rows[0].(map[string]any)["side"] != "both" {
		t.Fatalf("re-appended row was merged into a stale reference: %v", rows[0])
	}
}
