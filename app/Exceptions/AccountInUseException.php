<?php

namespace App\Exceptions;

use RuntimeException;

class AccountInUseException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Ce compte ne peut pas être supprimé : il est utilisé dans des écritures ou des règles comptables.');
    }
}
