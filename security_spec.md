# Security Specification for GameVault

## 1. Data Invariants
- A game record must belong to a valid authenticated user.
- The `ownerId` field must match the creator's UID and cannot be changed.
- `createdAt` is immutable.
- `status` must be one of: 'Jogando', 'Pendente', 'Zerado', 'Abandonado'.
- `rating` must be a number between 0 and 10.
- `title` and `platform` are required strings and must not exceed 200 characters.

## 2. The "Dirty Dozen" Payloads (Denial Tests)
1. **Identity Spoofing**: Create a game with `ownerId` of another user.
2. **Missing Auth**: Create a game without being signed in.
3. **Invalid Status**: Update a game with status 'Completed' (not in enum).
4. **Rating Overload**: Set `rating` to 11.
5. **Rating Underload**: Set `rating` to -1.
6. **Title Bloat**: Set `title` to a 2000 character string.
7. **Owner Mutation**: Update an existing game and try to change `ownerId`.
8. **Created Mutation**: Update an existing game and try to change `createdAt`.
9. **Junk ID**: Attempt to create/read a document with a 2KB garbage ID.
10. **Shadow Field**: Add `isAdmin: true` to a game document update.
11. **Malicious Platform**: Set `platform` to a massive array instead of a string.
12. **Cross-User Read**: Try to list or get games belonging to another user.

## 3. Test Runner (Draft)
```typescript
// firestore.rules.test.ts (logic check)
// This file will be used to verify rules against the payloads.
```
