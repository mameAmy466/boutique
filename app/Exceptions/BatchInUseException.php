<?php

namespace App\Exceptions;

use RuntimeException;

class BatchInUseException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Ce lot ne peut pas être supprimé : il a déjà été utilisé dans une ou plusieurs ventes.');
    }
}
