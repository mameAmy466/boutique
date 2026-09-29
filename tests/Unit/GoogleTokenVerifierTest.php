<?php

namespace Tests\Unit;

use App\Services\GoogleTokenVerifier;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;
use UnexpectedValueException;

/**
 * Exercises the actual RS256 verification path against a locally-generated
 * keypair standing in for Google's — this is the security-critical part of
 * "Sign in with Google" (anyone who can forge a token here can log in as
 * anyone), so it's worth testing the real crypto, not just mocking it away.
 */
class GoogleTokenVerifierTest extends TestCase
{
    private string $privateKey;

    private array $jwks;

    protected function setUp(): void
    {
        parent::setUp();

        config(['services.google.client_id' => 'test-client-id']);

        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        $privateKey = '';
        openssl_pkey_export($resource, $privateKey);
        $this->privateKey = $privateKey;
        $details = openssl_pkey_get_details($resource);

        $this->jwks = [
            'keys' => [[
                'kty' => 'RSA',
                'kid' => 'test-key-1',
                'use' => 'sig',
                'alg' => 'RS256',
                'n' => rtrim(strtr(base64_encode($details['rsa']['n']), '+/', '-_'), '='),
                'e' => rtrim(strtr(base64_encode($details['rsa']['e']), '+/', '-_'), '='),
            ]],
        ];

        Http::fake(['https://www.googleapis.com/oauth2/v3/certs' => Http::response($this->jwks)]);
    }

    private function makeToken(array $overrides = []): string
    {
        $payload = array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => 'test-client-id',
            'sub' => 'google-sub-123',
            'email' => 'awa@example.com',
            'email_verified' => true,
            'name' => 'Awa Diop',
            'iat' => time(),
            'exp' => time() + 3600,
        ], $overrides);

        return JWT::encode($payload, $this->privateKey, 'RS256', 'test-key-1');
    }

    public function test_a_validly_signed_token_for_this_app_is_accepted(): void
    {
        $result = (new GoogleTokenVerifier())->verify($this->makeToken());

        $this->assertSame('google-sub-123', $result['sub']);
        $this->assertSame('awa@example.com', $result['email']);
        $this->assertTrue($result['email_verified']);
    }

    public function test_a_token_issued_for_another_application_is_rejected(): void
    {
        $this->expectException(UnexpectedValueException::class);
        (new GoogleTokenVerifier())->verify($this->makeToken(['aud' => 'someone-elses-client-id']));
    }

    public function test_a_token_from_an_unexpected_issuer_is_rejected(): void
    {
        $this->expectException(UnexpectedValueException::class);
        (new GoogleTokenVerifier())->verify($this->makeToken(['iss' => 'https://evil.example.com']));
    }

    public function test_an_expired_token_is_rejected(): void
    {
        $this->expectException(\Throwable::class);
        (new GoogleTokenVerifier())->verify($this->makeToken(['exp' => time() - 60]));
    }

    public function test_a_token_signed_by_a_different_key_is_rejected(): void
    {
        $otherResource = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        openssl_pkey_export($otherResource, $otherPrivateKey);

        $forged = JWT::encode([
            'iss' => 'https://accounts.google.com',
            'aud' => 'test-client-id',
            'sub' => 'attacker',
            'email' => 'attacker@example.com',
            'email_verified' => true,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $otherPrivateKey, 'RS256', 'test-key-1');

        $this->expectException(\Throwable::class);
        (new GoogleTokenVerifier())->verify($forged);
    }
}
