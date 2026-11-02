<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private function owner(): User
    {
        $role = Role::firstOrCreate(['slug' => Role::SUPER_ADMIN], ['name' => Role::SUPER_ADMIN]);

        return User::factory()->create([
            'email' => 'awa@example.com',
            'password' => 'ancien-mdp',
            'role_id' => $role->id,
            'organization_id' => $this->createOrganization()->id,
        ]);
    }

    public function test_a_forgotten_password_can_be_reset_with_the_emailed_link(): void
    {
        Notification::fake();
        config(['app.url' => 'https://app.myboutiqu.com']);
        $user = $this->owner();
        $user->createToken('api');

        $this->postJson('/api/forgot-password', ['email' => 'awa@example.com'])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user, &$token) {
            $token = $notification->token;
            $mail = $notification->toMail($user);
            $this->assertSame('Réinitialisation de ton mot de passe', $mail->subject);
            $this->assertStringStartsWith('https://app.myboutiqu.com/reinitialiser-mot-de-passe?token=', $mail->actionUrl);

            return true;
        });

        $this->postJson('/api/reset-password', [
            'token' => $token, 'email' => 'awa@example.com',
            'password' => 'nouveau-mdp', 'password_confirmation' => 'nouveau-mdp',
        ])->assertOk();

        $this->postJson('/api/login', ['email' => 'awa@example.com', 'password' => 'nouveau-mdp'])->assertOk();
        $this->postJson('/api/login', ['email' => 'awa@example.com', 'password' => 'ancien-mdp'])->assertStatus(422);
        // Every session that used the old password is closed.
        $this->assertSame(1, $user->fresh()->tokens()->count());
    }

    public function test_the_answer_does_not_reveal_whether_an_account_exists(): void
    {
        Notification::fake();
        $this->owner();

        $known = $this->postJson('/api/forgot-password', ['email' => 'awa@example.com'])->assertOk()->json('message');
        $unknown = $this->postJson('/api/forgot-password', ['email' => 'personne@example.com'])->assertOk()->json('message');

        $this->assertSame($known, $unknown);
    }

    public function test_a_wrong_or_reused_token_is_refused(): void
    {
        $this->owner();

        $this->postJson('/api/reset-password', [
            'token' => 'faux-jeton', 'email' => 'awa@example.com',
            'password' => 'nouveau-mdp', 'password_confirmation' => 'nouveau-mdp',
        ])->assertStatus(422)->assertJsonValidationErrors('email');

        $this->postJson('/api/login', ['email' => 'awa@example.com', 'password' => 'ancien-mdp'])->assertOk();
    }

    public function test_the_super_admin_can_set_a_new_password_for_a_client_user(): void
    {
        $owner = $this->owner();
        $operator = User::factory()->create(['organization_id' => null, 'role_id' => null, 'is_platform_admin' => true]);

        $this->actingAs($operator, 'sanctum')
            ->postJson("/api/platform/organizations/{$owner->organization_id}/users/{$owner->id}/password", ['password' => 'provisoire1'])
            ->assertOk();

        $this->postJson('/api/login', ['email' => 'awa@example.com', 'password' => 'provisoire1'])->assertOk();

        // A client cannot use it.
        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/platform/organizations/{$owner->organization_id}/users/{$owner->id}/password", ['password' => 'piratage1'])
            ->assertForbidden();
    }
}
