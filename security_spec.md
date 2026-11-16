# Security Specification — Cabiao SHS Student Clearance System

## 1. Data Invariants
1. **Admin Authority**: Only verified Registrar administrators (`admins/{uid}` or verified `romandidter@gmail.com`) may create, modify, or deactivate `staff/{staffId}` accounts and grant staff roles.
2. **Instant Staff Revocation**: Every staff-gated rule evaluates the live `staff/{staffId}.active == true` flag via `get()`, so disabling a staff account revokes access immediately.
3. **UID-to-Staff Integrity**: A user can only bind `staff_roles/{uid}` if a matching active `staff/{staffId}` record exists with their exact verified email and role.
4. **PII Isolation**: User private contact info (`email`, `phone`, `lrn`, `address`) is isolated inside `users/{userId}/private/info`, readable and writable only by the owning user (`request.auth.uid == userId`) or an admin.
5. **Public Tracking Projection**: Anyone with a tracking code `CSHS-XXXX-XXXX` may `get` the non-PII `requests_public/{tracking}` status card, while `list` is forbidden to prevent enumeration.
6. **Atomic Request + Tracking Creation**: Creating `requests/{requestId}` requires an atomic batch write that simultaneously creates `requests_public/{tracking}` (`existsAfter`).
7. **State Machine Integrity**: Requests start in `status == 'pending'`, `idVerified == false`. Only verified staff can verify documents, record authorization checks, approve/reject, or advance `release` (`preparing` -> `ready` -> `claimed`). Terminal `'claimed'` and `'rejected'` states are locked against non-admin mutations.
8. **Temporal & ID Integrity**: All document IDs match `isValidId()` (or 12-digit LRN / `CSHS-XXXX-XXXX` tracking patterns), and all `createdAt` / `updatedAt` timestamps must equal `request.time`.

## 2. Dirty Dozen Adversarial Payloads
1. **Unverified Email Spoofing**: Authenticated user with `email: "romandidter@gmail.com"` and `email_verified: false` attempts to list `staff` -> **DENIED**.
2. **Self-Assigned Role Escalation**: Student creates `staff_roles/{uid}` with `role: "registrar"` pointing to a non-existent `staffId` -> **DENIED**.
3. **Revoked Staff Access**: Former staff member whose `staff/{staffId}.active` was set to `false` attempts to approve a request -> **DENIED**.
4. **Cross-User PII Read**: Signed-in User A attempts `get` on `users/{userB}/private/info` -> **DENIED**.
5. **Blanket List Query on Requests**: Signed-in student runs `list` on `requests` without filtering `ownerUid == request.auth.uid` -> **DENIED**.
6. **Public Tracking Enumeration**: Anonymous or signed-in user runs `list` on `requests_public` -> **DENIED**.
7. **Shadow Field Injection**: Student creates `requests/{id}` with extra undocumented field `isAdminApproved: true` -> **DENIED**.
8. **Pre-Approved Request Spoof**: Student creates `requests/{id}` with `status: "approved"` or `idVerified: true` -> **DENIED**.
9. **Orphaned Request Without Tracking**: Student creates `requests/{id}` without atomically writing `requests_public/{tracking}` -> **DENIED**.
10. **Terminal State Tampering**: Non-admin staff member attempts to modify a request after `release == "claimed"` -> **DENIED**.
11. **Backdated Timestamp Attack**: Client sends custom `createdAt` timestamp different from `request.time` -> **DENIED**.
12. **Resource Exhaustion / ID Poisoning**: Client attempts to create a `students/{lrn}` with a 500-char ID or 100KB `firstName` -> **DENIED**.
