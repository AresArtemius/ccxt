<?php
namespace ccxt;

// ----------------------------------------------------------------------------

// PLEASE DO NOT EDIT THIS FILE, IT IS GENERATED AND WILL BE OVERWRITTEN:
// https://github.com/ccxt/ccxt/blob/master/CONTRIBUTING.md#how-to-contribute-code

// -----------------------------------------------------------------------------
use React\Async;
use React\Promise;
include_once PATH_TO_CCXT . '/test/exchange/base/test_order_book.php';

function test_fetch_order_books($exchange, $skipped_properties) {
    return Async\async(function () use ($exchange, $skipped_properties) {
        $method = 'fetchOrderBooks';
        $symbol = $exchange->symbols[0];
        $order_books = Async\await($exchange->fetch_order_books([$symbol]));
        assert(is_array($order_books), $exchange->id . ' ' . $method . ' must return an object. ' . $exchange->json($order_books));
        $order_book_keys = is_array($order_books) ? array_keys($order_books) : array();
        assert(count($order_book_keys), $exchange->id . ' ' . $method . ' returned 0 length data');
        for ($i = 0; $i < count($order_book_keys); $i++) {
            $symbol_inner = $order_book_keys[$i];
            test_order_book($exchange, $skipped_properties, $method, $order_books[$symbol_inner], $symbol_inner);
        }
        return true;
    }) ();
}
