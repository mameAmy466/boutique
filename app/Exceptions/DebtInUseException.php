<?php

namespace App\Exceptions;

use RuntimeException;

class DebtInUseException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Cette dette ne peut pas être supprimée : des paiements y sont déjà enregistrés.');
    }
}
