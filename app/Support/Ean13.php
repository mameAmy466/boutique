<?php

namespace App\Support;

/**
 * Barcodes generated for products that come without one. They start with 2,
 * the EAN-13 range reserved for in-store use, so they can never clash with a
 * manufacturer's code, and end with the standard check digit so any scanner
 * reads them.
 */
class Ean13
{
    public static function forProduct(int $productId): string
    {
        $body = '2'.str_pad((string) $productId, 11, '0', STR_PAD_LEFT);

        return $body.self::checkDigit($body);
    }

    public static function checkDigit(string $twelveDigits): int
    {
        $sum = 0;
        foreach (str_split($twelveDigits) as $i => $digit) {
            $sum += (int) $digit * ($i % 2 === 0 ? 1 : 3);
        }

        return (10 - $sum % 10) % 10;
    }
}
