<?php

namespace App\Exceptions;

use RuntimeException;

class PriceBelowMinimumException extends RuntimeException
{
    public function __construct(public readonly float $minPrice, public readonly float $attemptedPrice)
    {
        parent::__construct(sprintf(
            'Vente impossible : le prix de vente (%s) est inférieur au prix minimum autorisé de %s.',
            number_format($attemptedPrice, 2),
            number_format($minPrice, 2)
        ));
    }
}
