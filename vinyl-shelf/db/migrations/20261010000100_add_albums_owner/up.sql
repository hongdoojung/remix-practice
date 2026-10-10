alter table albums add column owner_id integer references users (id);
