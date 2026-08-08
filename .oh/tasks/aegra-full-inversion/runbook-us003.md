# Runbook — US-003: Aegra sidecar on `:2026`

Operator-executed. The sandbox agent has no Docker socket, so the container and
database steps are yours; the files they use are in this PR.

**What this proves:** Aegra boots, applies its own migration chain, and reads
Orchestra's existing store *without altering it*. **What it does not prove:**
that Orchestra's agent works under Aegra — that is US-008's factory graph. The
sidecar deliberately registers only a trivial `hello` graph so a green result
cannot be mistaken for more than it is.

## 1. Create the copy database

```bash
docker exec postgres pg_dump -U admin -Fc lg_template_dev > /tmp/lg_template_dev.dump
docker exec postgres createdb -U admin orchestra_aegra
docker exec -i postgres pg_restore -U admin -d orchestra_aegra < /tmp/lg_template_dev.dump
```

Keep `/tmp/lg_template_dev.dump`. Step 3 diffs against it, and US-020's restore
drill needs a *fresh* dump anyway — do not reuse this one there.

## 2. Capture the pre-boot digest

Row counts prove nothing: a rewrite that preserves cardinality passes a
`count(*)` check unchanged. Diff stable keys plus a content digest.

```sql
-- against orchestra_aegra, BEFORE aegra first starts
\copy (
  SELECT 'checkpoints' AS t, thread_id::text||'|'||checkpoint_id::text AS k,
         md5(checkpoint::text) AS d FROM checkpoints
  UNION ALL
  SELECT 'store', prefix||'|'||key, md5(value::text) FROM store
  UNION ALL
  SELECT 'store_vectors', prefix||'|'||key||'|'||field_name,
         md5(embedding::text) FROM store_vectors
  ORDER BY 1,2
) TO '/tmp/pre.csv' CSV
```

## 3. Start the sidecar and re-diff

```bash
make dev.aegra.up
curl -s localhost:2026/health          # expect {"status":"healthy"}
make dev.aegra.logs                    # confirm its alembic chain applied
```

Re-run the step-2 query to `/tmp/post.csv`, then:

```bash
diff /tmp/pre.csv /tmp/post.csv && echo "STORE INTACT"
```

**A non-empty diff is a stop condition**, not a curiosity. Aegra is expected to
*add* its own tables (`assistant`, `thread`, `run`, `cron`, …) and to leave every
pre-existing row byte-identical.

## 4. Prove a real read, not just "some rows"

Pick a known item and fetch it by its exact namespace and key:

```bash
curl -s -H "Authorization: Bearer <token>" \
  'localhost:2026/store/items?namespace=<user_id>.<entity>&key=<key>'
```

Assert the value matches what Orchestra wrote. "The endpoint returned 200" is
not the check.

## 5. Namespace mapping — write this down before stage 2

Two different shapes coexist, and conflating them is how data goes missing:

| Surface | Namespace shape | Applied by |
|---|---|---|
| Orchestra's 11 entity repos (in-process) | `(user_id, entity)` | `BaseRepo._get_namespace()` |
| Aegra's `/store/*` HTTP handlers | auto-prefixed `["users", <identity>, …]` | `apply_namespace_scoping()` (`api/store.py:282-303`) |

In-process callers are **not** scoped — that is why zero entity repos change in
this migration. The consequence: **the frontend must never use the SDK's store
methods.** Anything written through `/store/*` lands under `["users", …]` and is
invisible to `BaseRepo`. Orchestra store access goes through the custom routes.

## 6. Operator switch-over — pointing your own stack at the copy

When you want to exercise the copy with the real app:

1. Change `POSTGRES_CONNECTION_STRING` to `…@postgres:5432/orchestra_aegra`.
2. **Set `DISTRIBUTED_WORKERS=false` for that session, or repoint the worker
   too.** An app on the copy with a worker still on `lg_template_dev` enqueues
   against one database and executes against the other — the run vanishes.
3. Restart both the backend and worker panes so they re-read the env; they load
   it at startup, not per-request. The vite pane holds no DB connection and does
   not need restarting.

**Using the copy makes it drift from production.** After any real use it is no
longer a faithful snapshot, so US-020's restore drill must re-restore from a
fresh dump rather than reuse a worn copy.

## 7. Teardown

```bash
make dev.aegra.down
```

The sidecar is scaffolding. It is deleted outright at stage 6, along with this
compose overlay, the Dockerfile, and `hello_graph.py`.
