# Required database verification (not yet executed)

Use a dedicated SharikX2 test project and separate auth tokens A, B, and C.

1. Record project owner_id and balances. A is the existing Android owner.
2. With B call restore_sharikx2_owner_project_v2 using valid owner credentials.
3. Confirm owner_id and balances did not change, and is_owner is true for A and B.
4. With C join using only the share PIN: is_owner must be false; business writes must fail.
5. With an invalid password, restoration must fail and no owner session may be created.
6. Confirm both owner tokens can access a free project without paid sharing.
7. Change project password through the existing credential RPC; B's previous grant must no longer authorize writes. Restore with the new password to reauthorize.
8. Test deletion on disposable projects only, using phone/password verification from each authorized device.

This migration must run transactionally after migration 29. Previously demoted identities are not automatically promoted: they must sign in again with project credentials. Anonymous auth tokens must be retained by each client, not recreated on each page reload. Session logout/revocation is a separate lifecycle concern; no browser password is stored by this migration.
