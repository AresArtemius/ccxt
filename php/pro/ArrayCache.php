<?php

namespace ccxt\pro;

class ArrayCache extends BaseCache {
    public $hashmap;
    public $new_updates_by_symbol;
    public $seen_updates_by_symbol;
    public $seen_updates_all;
    public $clear_updates_by_symbol;
    public $nested_new_updates_by_symbol;
    public $all_new_updates;
    public $clear_all_updates;

    public function __construct($max_size = null) {
        parent::__construct($max_size);
        $this->hashmap = array();
        $this->nested_new_updates_by_symbol = false;
        // $new_updates_by_symbol holds a plain integer count per key. The keyed
        // subclasses count DISTINCT ids / sides, so they keep the membership set
        // itself in $seen_updates_by_symbol and write its size back here - that
        // way getLimit() never has to guess whether it is holding a number or a
        // set, and never type-puns one for the other
        $this->new_updates_by_symbol = array();
        $this->seen_updates_by_symbol = array();
        # the same, but cleared only by the GLOBAL getLimit() scope - the two poll
        # scopes are independent, so each needs its own memory of what it has seen
        $this->seen_updates_all = array();
        $this->clear_updates_by_symbol = array();
        $this->all_new_updates = 0;
        $this->clear_all_updates = false;
    }

    public function getLimit($symbol, $limit) {
        $new_updates_value = null;

        if ($symbol === null) {
            $new_updates_value = $this->all_new_updates;
            $this->clear_all_updates = true;
        } else {
            // always an int, for every cache flavour
            $new_updates_value = $this->new_updates_by_symbol[$symbol] ?? null;
            $this->clear_updates_by_symbol[$symbol] = true;
        }

        if ($new_updates_value === null) {
            return $limit;
        }
        else if ($limit !== null) {
            return min($new_updates_value, $limit);
        } else {
            return $new_updates_value;
        }
    }

    # drop every row filed under $key - the symbol for the symbol-keyed caches,
    # the outcome for ArrayCacheByOutcomeById - together with its bookkeeping.
    # A caller that has to invalidate a single key must NOT reach for clear():
    # that wipes the counters of every OTHER key too, and re-appending the rows
    # it meant to keep re-reports them to `newUpdates => false` consumers as
    # fresh updates. Retracting one key keeps both poll scopes exact, because
    # $all_new_updates is the sum of the per-key $seen_updates_all sizes for the
    # keyed subclasses, so the global counter loses precisely what this key put in
    public function removeSymbol($key) {
        $key_field = $this->key_field ?? 'symbol';
        # the hashmap and the bookkeeping maps were keyed the way append() keyed
        # them - through as_string() - so the retraction has to normalise the same
        # way or it looks in a different bucket than the one append() created
        $key_string = ($key === null) ? '' : $this->as_string($key);
        # compact in place so the retained rows keep their relative order, and
        # REBUILD the deque rather than unset()-ing rows out of it: unset() leaves
        # a hole, the deque stops being a 0..n-1 list, and BaseCache::offsetExists()
        # - an `$index < count()` range check - then lies about which rows exist
        $retained = array();
        $retained_positions = array();
        $array_length = count($this->deque);
        for ($i = 0; $i < $array_length; $i++) {
            # mirror how append() picks the key, including the `outcome` fallback
            # prediction-market items carry instead of a `symbol`
            $existing_key = $this->deque[$i][$key_field] ?? $this->deque[$i]['outcome'] ?? null;
            $existing_string = ($existing_key === null) ? '' : $this->as_string($existing_key);
            if ($existing_string !== $key_string) {
                # keep the by-reference linkage - the hashmap entry and the deque
                # row alias the same zval, and a plain copy would detach them
                $retained[] = &$this->deque[$i];
                $retained_positions[] = $i;
            }
        }
        $this->deque = $retained;
        # the keyed subclasses carry a positional sidecar index alongside the
        # deque; it has to lose exactly the same positions, or every later
        # append() of an existing key splices the wrong row out of the deque
        $this->compact_index($retained_positions);
        unset($this->hashmap[$key_string]);
        unset($this->new_updates_by_symbol[$key_string]);
        unset($this->seen_updates_by_symbol[$key_string]);
        unset($this->clear_updates_by_symbol[$key_string]);
        # a plain ArrayCache has no per-key ledger for the global scope - it counts
        # raw appends - so only the keyed subclasses can retract exactly; there the
        # seen set IS this key's contribution since the last global poll
        if (array_key_exists($key_string, $this->seen_updates_all)) {
            $this->all_new_updates = $this->all_new_updates - count($this->seen_updates_all[$key_string]);
            unset($this->seen_updates_all[$key_string]);
        }
    }

    # hook for the keyed subclasses: each of them keeps a PRIVATE positional index
    # next to the deque, which this class cannot reach. Handed the positions that
    # survived removeSymbol(), a subclass compacts its own index through the very
    # same ones, so the two arrays stay aligned element for element
    protected function compact_index($retained_positions) {
    }

    # support transpiled snake_case calls
    public function remove_symbol($key) {
        return $this->removeSymbol($key);
    }

    public function append($item) {
        if ($this->max_size && (count($this->deque) === $this->max_size)) {
            array_shift($this->deque);
        }
        $this->deque[] = $item;
        if ($this->clear_all_updates) {
            $this->clear_all_updates = false;
            # the global poll consumes only the global scope
            $this->all_new_updates = 0;
            $this->seen_updates_all = array();
        }
        // prediction-market items carry an `outcome` handle instead of a `symbol`
        $symbol = $item['symbol'] ?? $item['outcome'] ?? '';
        if ($this->clear_updates_by_symbol[$symbol] ?? false) {
            $this->clear_updates_by_symbol[$symbol] = false;
            $this->new_updates_by_symbol[$symbol] = 0;
        }
        $this->new_updates_by_symbol[$symbol] = ($this->new_updates_by_symbol[$symbol] ?? 0) + 1;
        $this->all_new_updates = ($this->all_new_updates ?? 0) + 1;
    }

    public function clear() {
        # the keyed index and the new-updates bookkeeping have to be wiped
        # together with the deque, otherwise a re-appended row is matched
        # against a hashmap entry whose deque row no longer exists
        parent::clear();
        $this->hashmap = array();
        $this->new_updates_by_symbol = array();
        $this->seen_updates_by_symbol = array();
        $this->seen_updates_all = array();
        $this->clear_updates_by_symbol = array();
        $this->all_new_updates = 0;
        $this->clear_all_updates = false;
    }
}
