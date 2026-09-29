<?php

namespace App\Services;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use UnexpectedValueException;

/**
 * Verifies a Google "Sign In With Google" ID token (the `credential` JWT
 * the frontend's Google Identity Services button hands back) entirely
 * offline against Google's public signing keys — the approach Google's own
 * docs recommend for production traffic, as opposed to calling their
 * tokeninfo endpoint per request (rate-limited, meant for debugging).
 */
class GoogleTokenVerifier
{
    private const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    /**
     * @return array{sub: string, email: string, email_verified: bool, name: ?string}
     *
     * @throws UnexpectedValueException if the token is invalid, expired, or
     *                                   not issued for this app
     */
    public function verify(string $idToken): array
    {
        $clientId = config('services.google.client_id');
        if (empty($clientId)) {
            throw new RuntimeException("La connexion Google n'est pas configurée (GOOGLE_CLIENT_ID manquant).");
        }

        $keys = $this->fetchKeys();
        $payload = (array) JWT::decode($idToken, JWK::parseKeySet($keys));

        if (! in_array($payload['iss'] ?? null, self::ISSUERS, true)) {
            throw new UnexpectedValueException('Émetteur du jeton invalide.');
        }

        if (($payload['aud'] ?? null) !== $clientId) {
            throw new UnexpectedValueException("Ce jeton n'a pas été émis pour cette application.");
        }

        if (empty($payload['email'])) {
            throw new UnexpectedValueException('Aucune adresse e-mail associée à ce compte Google.');
        }

        return [
            'sub' => (string) $payload['sub'],
            'email' => (string) $payload['email'],
            'email_verified' => (bool) ($payload['email_verified'] ?? false),
            'name' => $payload['name'] ?? null,
        ];
    }

    /**
     * Google rotates these keys infrequently; caching avoids a round trip
     * on every sign-in while still picking up rotation within the hour.
     */
    private function fetchKeys(): array
    {
        return Cache::remember('google_jwks', now()->addHour(), function () {
            $response = Http::timeout(5)->get(self::JWKS_URL);
            $response->throw();

            return $response->json();
        });
    }
}
