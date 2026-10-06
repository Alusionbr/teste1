-- Separate due dates from general reminders and allow undated shared sticky notes.
alter table public.fin_reminders
  add column kind text not null default 'reminder',
  add column note text not null default '',
  add column color text not null default 'yellow';

alter table public.fin_reminders alter column due_on drop not null;
alter table public.fin_reminders
  add constraint fin_reminders_kind_check check(kind in ('reminder','due_date','post_it')),
  add constraint fin_reminders_note_length_check check(length(note) <= 3000),
  add constraint fin_reminders_color_check check(color in ('yellow','blue','pink','green')),
  add constraint fin_reminders_schedule_check check(
    (kind='post_it' and due_on is null and recurrence='once')
    or (kind in ('reminder','due_date') and due_on is not null)
  );

create index fin_reminders_home_kind_due
  on public.fin_reminders(home_id,kind,due_on) where not completed;
