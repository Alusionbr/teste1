import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', C='00000000-0000-4000-8000-000000000003',
  H='00000000-0000-4000-8000-000000000004', H2='00000000-0000-4000-8000-000000000005',
  P='00000000-0000-4000-8000-000000000006', P2='00000000-0000-4000-8000-000000000007',
  T='00000000-0000-4000-8000-000000000008', T2='00000000-0000-4000-8000-000000000009';
test('household routine: pantry movements, waste value, shared tasks and idempotent recurrence', async t => {
  const db=new PGlite(); t.after(()=>db.close());
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
  for (const file of ['20261004024051_family_app.sql','20261005055306_family_preferences.sql','20261005180000_household_routine.sql'])
    await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await db.exec(`insert into auth.users values('${A}'),('${B}'),('${C}');insert into fin_homes(id,name,owner_id) values('${H}','Synthetic home','${A}'),('${H2}','Other home','${C}');insert into fin_members(home_id,user_id,display_name,role) values('${H}','${A}','Admin','admin'),('${H}','${B}','Member','member'),('${H2}','${C}','Other','admin');`);
  const asUser=async id=>db.exec(`reset role;set request.jwt.claim.sub='${id}';set role authenticated;`);
  const one=async sql=>(await db.query(sql)).rows[0];

  // Existing pantry rows receive a location; the default keeps old clients working.
  await asUser(B);
  await db.exec(`insert into fin_pantry(id,home_id,name,unit,quantity,minimum,price_cents) values('${P}','${H}','Synthetic rice','kg',5,1,800)`);
  assert.equal((await one(`select location from fin_pantry where id='${P}'`)).location,'kitchen');
  await assert.rejects(db.exec(`update fin_pantry set location='garage' where id='${P}'`));

  // Usage, loss and count are atomic with their history; loss never exceeds the stock.
  assert.equal(Number((await one(`select fin_pantry_move('${P}','used',1.5) q`)).q),3.5);
  assert.equal(Number((await one(`select fin_pantry_move('${P}','lost',10) q`)).q),0);
  const lost=await one(`select quantity,value_cents from fin_pantry_events where kind='lost'`);
  assert.equal(Number(lost.quantity),3.5);
  assert.equal(Number(lost.value_cents),2800);
  assert.equal(Number((await one(`select fin_pantry_move('${P}','counted',2) q`)).q),2);
  assert.equal(Number((await one(`select fin_pantry_move('${P}','finished',0) q`)).q),0);
  await assert.rejects(db.exec(`select fin_pantry_move('${P}','used',0)`));
  await assert.rejects(db.exec(`select fin_pantry_move('${P}','stolen',1)`));
  await assert.rejects(db.exec(`select fin_pantry_move('${P}','used',-1)`));
  assert.equal((await db.query('select * from fin_pantry_events')).rows.length,4);
  // History cannot be forged for another person nor rewritten.
  await assert.rejects(db.exec(`insert into fin_pantry_events(home_id,pantry_id,name,kind,quantity,actor_id) values('${H}','${P}','x','lost',1,'${A}')`));
  await assert.rejects(db.exec(`update fin_pantry_events set value_cents=0`));
  await assert.rejects(db.exec(`delete from fin_pantry_events`));

  // Another home cannot read or move this pantry.
  await asUser(C);
  await db.exec(`insert into fin_pantry(id,home_id,name,unit,quantity,minimum) values('${P2}','${H2}','Other stock','kg',1,1)`);
  assert.equal((await db.query('select * from fin_pantry_events')).rows.length,0);
  await assert.rejects(db.exec(`select fin_pantry_move('${P}','used',1)`));

  // Pantry permission is required for movements.
  await db.exec(`reset role;update fin_members set permissions=jsonb_set(permissions,'{pantry}','false') where user_id='${B}'`);
  await asUser(B);
  await assert.rejects(db.exec(`select fin_pantry_move('${P}','counted',3)`));
  await db.exec(`reset role;update fin_members set permissions=jsonb_set(permissions,'{pantry}','true') where user_id='${B}'`);

  // Tasks are shared with the home, attributed to the signed-in member.
  await asUser(B);
  await assert.rejects(db.exec(`insert into fin_tasks(home_id,title,created_by) values('${H}','Impersonated','${A}')`));
  await assert.rejects(db.exec(`insert into fin_tasks(home_id,title,assignee_id,created_by) values('${H}','Foreign assignee','${C}','${B}')`));
  await db.exec(`insert into fin_tasks(id,home_id,title,kind,assignee_id,due_date,repeat,created_by) values('${T}','${H}','Clean bathroom','cleaning','${A}','2026-10-01','weekly','${B}'),('${T2}','${H}','Fix shower','maintenance',null,null,'none','${B}')`);
  await assert.rejects(db.exec(`update fin_tasks set done_at=now(),done_by='${A}' where id='${T2}'`));
  await assert.rejects(db.exec(`update fin_tasks set created_by='${A}' where id='${T}'`));
  await asUser(C);
  assert.equal((await db.query('select * from fin_tasks')).rows.length,0);
  await assert.rejects(db.exec(`select fin_complete_task('${T}','2026-10-05')`));

  // Completing twice creates exactly one next occurrence, counted from the completion day.
  await asUser(A);
  const first=(await one(`select fin_complete_task('${T}','2026-10-05') id`)).id;
  assert.ok(first);
  assert.equal((await one(`select fin_complete_task('${T}','2026-10-05') id`)).id,null);
  const next=await one(`select due_date::text d,assignee_id,repeat,done_at from fin_tasks where previous_id='${T}'`);
  assert.equal(next.d,'2026-10-12');
  assert.equal(next.assignee_id,A);
  assert.equal(next.done_at,null);
  assert.equal((await one(`select done_by from fin_tasks where id='${T}'`)).done_by,A);
  assert.equal((await one(`select fin_complete_task('${T2}','2026-10-05') id`)).id,null);
  assert.equal((await db.query(`select * from fin_tasks where previous_id='${T2}'`)).rows.length,0);

  // Monthly repeat clamps to the end of shorter months.
  await db.exec(`insert into fin_tasks(id,home_id,title,repeat,created_by) values('00000000-0000-4000-8000-000000000010','${H}','Pay attention to filter','monthly','${A}')`);
  await db.exec(`select fin_complete_task('00000000-0000-4000-8000-000000000010','2026-01-31')`);
  assert.equal((await one(`select due_date::text d from fin_tasks where previous_id='00000000-0000-4000-8000-000000000010'`)).d,'2026-02-28');

  // A suspended assignee is not carried to the next occurrence.
  await db.exec(`insert into fin_tasks(id,home_id,title,assignee_id,repeat,created_by) values('00000000-0000-4000-8000-000000000011','${H}','Laundry','${B}','daily','${A}')`);
  await db.exec(`reset role;update fin_members set active=false where user_id='${B}'`);
  await asUser(A);
  await db.exec(`select fin_complete_task('00000000-0000-4000-8000-000000000011','2026-10-05')`);
  const laundry=await one(`select assignee_id,due_date::text d from fin_tasks where previous_id='00000000-0000-4000-8000-000000000011'`);
  assert.equal(laundry.assignee_id,null);
  assert.equal(laundry.d,'2026-10-06');
  await asUser(B);
  assert.equal((await db.query('select * from fin_tasks')).rows.length,0,'suspended member must not read tasks');
  await assert.rejects(db.exec(`select fin_pantry_move('${P}','counted',3)`));

  // Only creator or administrator may delete a task.
  await db.exec(`reset role;update fin_members set active=true where user_id='${B}'`);
  await asUser(B);
  assert.equal((await db.query(`delete from fin_tasks where created_by='${A}' returning id`)).rows.length,0);
  assert.equal((await db.query(`delete from fin_tasks where id='${T2}' returning id`)).rows.length,1);

  // Deleting a product keeps its history, now detached.
  await db.exec(`delete from fin_pantry where id='${P}'`);
  assert.equal((await db.query('select * from fin_pantry_events where pantry_id is null')).rows.length,4);

  await db.exec('reset role;set role anon');
  await assert.rejects(db.query('select * from fin_tasks'));
  await assert.rejects(db.query('select * from fin_pantry_events'));
});
